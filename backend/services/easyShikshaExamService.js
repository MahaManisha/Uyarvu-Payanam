/**
 * easyShikshaExamService — source adapter for the Central Government exam sync.
 *
 * EasyShiksha (https://easyshiksha.com/govt-exam) is the discovery/update
 * source. Its listing page enumerates exam pages under topic tab panes
 * (Banking, Defence, PSU, Railways, SSC, Teaching, UPSC, State PSC, All) and
 * every exam page carries structured sections (Highlights, Dates, Vacancy,
 * Eligibility, ExamPattern, Syllabus, Selection, AdmitCard, Results, Cutoff…).
 *
 * Design rules:
 *  - No hardcoded exam list — exams are discovered from the listing panes and
 *    classified as Central by rules, never by a curated catalogue.
 *  - Never invent data — every field the source does not publish stays ""/[].
 *  - Isolated on purpose — another source adapter can be added beside this one
 *    without touching parsing or persistence code elsewhere.
 *  - Robust to markup drift — tolerant selectors, plain-text sanitization,
 *    per-request timeouts and per-exam error isolation (one bad page never
 *    aborts a run).
 */
const axios = require("axios");
const cheerio = require("cheerio");
const slugify = require("../utils/slugify");
const GraduateExam = require("../models/GraduateExam");
const RecruitmentOrganization = require("../models/RecruitmentOrganization");

const SOURCE_WEBSITE = "EasyShiksha";
const LISTING_URL = "https://easyshiksha.com/govt-exam";
const PAGE_TIMEOUT_MS = 15000;
const CONCURRENCY = 5;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Top-level error for "the source itself could not be fetched" (listing page). */
class SourceFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceFetchError";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Text / value sanitization helpers — the database only ever holds plain text.
   ───────────────────────────────────────────────────────────────────────────── */

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", middot: "·",
};

function decodeEntities(text) {
  const safeChar = (code) => {
    try {
      const ch = String.fromCodePoint(code);
      return ch === "\uFFFD" ? " " : ch;
    } catch {
      return " ";
    }
  };
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (full, name) => NAMED_ENTITIES[name.toLowerCase()] ?? full);
}

function cleanText(value) {
  return decodeEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ") // never carry markup through
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value, max) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const isHttpUrl = (value) => !!value && /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(value).trim());

/** Normalise a "website" cell ("ssc.gov.in", "https://…") to a full URL or "". */
function normalizeUrl(value) {
  const text = cleanText(value);
  if (!text || /\s/.test(text)) return "";
  if (/^https?:\/\//i.test(text)) return isHttpUrl(text) ? text : "";
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(text)) {
    const url = `https://${text}`;
    return isHttpUrl(url) ? url : "";
  }
  return "";
}

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DATE_FIELDS = ["notificationDate", "applicationStartDate", "applicationEndDate", "examDate", "resultDate"];

const isValidISO = (value) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Date extraction — only exact calendar dates are parsed; textual windows
   ("May – June 2026", "Yet to announce") are kept as notes, never converted.
   ───────────────────────────────────────────────────────────────────────────── */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function buildISO(day, month, year) {
  const d = Number(day);
  const key = String(month).toLowerCase().slice(0, 3);
  const m = /^\d+$/.test(key) ? Number(key) : MONTHS[key];
  const y = Number(year);
  if (!m || m < 1 || m > 12 || y < 1990 || y > 2100 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== d) return null; // e.g. 31 Feb
  return iso;
}

/** Every exact date inside `text`, in order of appearance: [{iso, index}]. */
function extractDates(text) {
  const s = String(text || "");
  const found = [];
  const push = (iso, index) => {
    if (iso && !found.some((f) => f.iso === iso && Math.abs(f.index - index) < 5)) {
      found.push({ iso, index });
    }
  };
  let m;
  const numMonth = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+(\d{4})/gi;
  while ((m = numMonth.exec(s))) push(buildISO(m[1], m[2], m[3]), m.index);
  const monthNum = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi;
  while ((m = monthNum.exec(s))) push(buildISO(m[2], m[1], m[3]), m.index);
  const numeric = /\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/g; // Indian convention DD/MM/YYYY
  while ((m = numeric.exec(s))) push(buildISO(m[1], m[2], m[3]), m.index);
  return found.sort((a, b) => a.index - b.index);
}

/** Classify a dates-row label → which field its date(s) belong to. */
function classifyDateLabel(label) {
  const l = ` ${cleanText(label).toLowerCase()} `;
  if (/\b(result|scorecard|merit list|marksheet|answer key)\b/.test(l)) return "result";
  if (/\b(last date|deadline|closing|last day|end date|form closure)\b/.test(l)) return "end";
  if (/\bnotification\b/.test(l)) return "notification";
  const topic = /\b(apply|application|form|registration|online)\b/.test(l);
  if (topic && /\b(start|release|begin|open|from|window|commencement|available)\b/.test(l)) return "start";
  if (/\b(exam|examination|prelim|preliminary|mains|test|cbt|skill|typing)\b/.test(l)) return "exam";
  return null;
}

/**
 * Pull exact dates out of the source "Dates" section. Rows (table rows and
 * labelled list items) are classified by their label; a prose fallback covers
 * sentences such as "application form was closed on 27 February 2026".
 */
function extractSectionDates($) {
  const out = {
    notificationDate: "",
    applicationStartDate: "",
    applicationEndDate: "",
    examDate: "",
    resultDate: "",
  };
  const $sec = $("div.p-y-5#Dates").first();
  if (!$sec.length) return out;

  const consider = (label, valueText) => {
    const kind = classifyDateLabel(label);
    if (!kind || !valueText) return;
    const dates = extractDates(valueText);
    if (!dates.length) return;
    if (kind === "start") {
      if (!out.applicationStartDate) out.applicationStartDate = dates[0].iso;
      // "Application Window 4 February – 27 February 2026" → end = last date.
      if (dates.length >= 2 && !out.applicationEndDate) out.applicationEndDate = dates[dates.length - 1].iso;
    } else if (kind === "end") {
      // Ranges ("21 Oct 2025 – 27 Nov 2025") close on the LAST date.
      if (!out.applicationEndDate) out.applicationEndDate = dates[dates.length - 1].iso;
    } else if (kind === "exam") {
      if (!out.examDate) out.examDate = dates[0].iso;
    } else if (kind === "result") {
      if (!out.resultDate) out.resultDate = dates[0].iso;
    } else if (kind === "notification") {
      if (!out.notificationDate) out.notificationDate = dates[0].iso;
    }
  };

  $sec.find("tr").each((_, tr) => {
    const cells = $(tr).find("th,td").map((__, c) => cleanText($(c).text())).get().filter(Boolean);
    if (cells.length >= 2) consider(cells[0], cells.slice(1).join(" "));
  });
  $sec.find("li").each((_, li) => {
    const text = cleanText($(li).text());
    const idx = text.indexOf(":");
    if (idx > 0 && idx < 80) consider(text.slice(0, idx), text.slice(idx + 1));
  });

  // Prose fallback (sentence-scoped, still label-driven).
  const prose = cleanText($sec.text());
  if (!out.applicationEndDate) {
    const m = prose.match(
      /(?:last date(?:\s+to\s+(?:apply|register|fill))?|deadline|closed on|applications?\s+(?:will\s+)?close)[^0-9]{0,60}(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}|\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/i
    );
    if (m) out.applicationEndDate = extractDates(m[1])[0]?.iso || "";
  }
  if (!out.examDate) {
    const m = prose.match(
      /(?:exam(?:ination)?\b[^.]{0,60}?(?:\bon\b|\bscheduled on\b|\bdate\b[^0-9]{0,30}))(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})/i
    );
    if (m) out.examDate = extractDates(m[1])[0]?.iso || "";
  }

  // Guard against a row soup producing end < start (validation rule upstream).
  if (out.applicationStartDate && out.applicationEndDate && out.applicationEndDate < out.applicationStartDate) {
    out.applicationEndDate = "";
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Status — derived from dates ONLY (never a free-text guess).
   ───────────────────────────────────────────────────────────────────────────── */

function deriveStatus(dates = {}) {
  const today = todayISO();
  const start = isValidISO(dates.applicationStartDate) ? dates.applicationStartDate : "";
  const end = isValidISO(dates.applicationEndDate) ? dates.applicationEndDate : "";
  const exam = isValidISO(dates.examDate) ? dates.examDate : "";

  if (end) {
    if (today > end) return exam && today >= exam ? "Exam Completed" : "Application Closed";
    if (start && today < start) return "Upcoming";
    return "Application Open";
  }
  if (start) {
    if (today < start) return "Upcoming";
    if (exam) return today >= exam ? "Exam Completed" : "Application Open";
    return "Application Open";
  }
  if (exam) return today >= exam ? "Exam Completed" : "Upcoming";
  return "Date Not Available";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Listing discovery — Central classification from the source's own tabs.
   ───────────────────────────────────────────────────────────────────────────── */

// "All" is everything; "PSC" is the State PSC tab — neither makes an exam central.
const NON_TOPIC_PANES = new Set(["all", "psc"]);

const CATEGORY_LABELS = {
  upsc: "UPSC",
  ssc: "SSC",
  banking: "Banking",
  railways: "Railways",
  defence: "Defence",
  psu: "PSU",
  teaching: "Teaching",
};
const CATEGORY_PRIORITY = ["upsc", "ssc", "banking", "railways", "defence", "psu", "teaching"];

// The source files some state/private entities under central-looking tabs
// (state police under Defence, state boards under SSC, state TETs under
// Teaching, state utilities under PSU, private banks under Banking). These
// patterns remove them so only genuinely Union-of-India recruitment remains.
const NON_CENTRAL_PATTERNS = [
  /police/i, // state / UT police forces
  /(^|-)psc$/, // state public service commissions
  /^tnusrb/i, // TN Uniformed Services Recruitment Board
  /^(upsssc|bssc|jssc|uksssc|wbssc|jkssb|hpsssb|rsmssb|mppeb|cgpeb|apssc|tpsc|gpsc|mpsc|bpsc|kpsc|jpssb)(-|$)/i, // state boards
  /^(uptet|hptet|tntet|btet|htet|ktet|rtet|mptet|cgtet|wbtet|otet|tstet|jkset|apset|kset|dsssb|tet)(-|$)/i, // state teaching boards (CTET/UGC-NET/KVS/NVS are central)
  /^(kptcl|bsphcl|uppcl|pspcl|kmml|kccpl|dmrc|tangedco|tneb)(-|$)/i, // state utilities under the PSU tab
  /^(federal-bank|nainital-bank|south-indian-bank|lakshmi-vilas-bank|jk-bank|vcbl)(-|$)/i, // private / state-owned banks
];

const isCentralSlug = (slug) => !NON_CENTRAL_PATTERNS.some((re) => re.test(slug));

/**
 * Parse the listing page into its tab panes.
 * @returns {Map<string, Array<{slug, title}>>} pane id → exam cards
 */
function parseListing(html) {
  const $ = cheerio.load(html);
  const panes = new Map();
  $("div.tab-pane[id]").each((_, pane) => {
    const id = cleanText($(pane).attr("id"));
    if (!id) return;
    const items = [];
    $(pane).find("a[href]").each((__, a) => {
      const href = String($(a).attr("href") || "");
      const m = href.match(/\/govt-exam\/([a-z0-9-]+)/i);
      if (!m) return;
      const slug = m[1].toLowerCase();
      if (items.some((x) => x.slug === slug)) return;
      const title = cleanText($(a).find("h3").first().text()) || cleanText($(a).attr("title")) || cleanText($(a).text());
      items.push({ slug, title });
    });
    if (items.length) panes.set(id, items);
  });
  return panes;
}

/**
 * Discover Central-government exams from the panes.
 * Exams that only appear under "All"/"State PSC" (or match a state/private
 * pattern) are excluded; category comes from the source's own tab grouping.
 * @returns {Array<{slug, title, category}>}
 */
function discoverCentralExams(html) {
  const panes = parseListing(html);
  const bySlug = new Map();
  for (const [paneId, items] of panes) {
    for (const item of items) {
      let rec = bySlug.get(item.slug);
      if (!rec) {
        rec = { slug: item.slug, title: item.title, panes: [] };
        bySlug.set(item.slug, rec);
      }
      rec.panes.push(paneId);
      if (!rec.title && item.title) rec.title = item.title;
    }
  }

  const exams = [];
  for (const rec of bySlug.values()) {
    const topics = rec.panes.filter((id) => !NON_TOPIC_PANES.has(id.toLowerCase()));
    if (!topics.length) continue; // not grouped under any central topic tab
    if (!isCentralSlug(rec.slug)) continue;
    const lower = topics.map((t) => t.toLowerCase());
    let category = "";
    for (const key of CATEGORY_PRIORITY) {
      if (lower.includes(key)) {
        category = CATEGORY_LABELS[key];
        break;
      }
    }
    if (!category) {
      // Unknown (possibly new) topic pane — keep it as its own category label.
      const first = topics[0];
      category = CATEGORY_LABELS[first.toLowerCase()] || first;
    }
    exams.push({ slug: rec.slug, title: rec.title || rec.slug, category });
  }
  return exams.sort((a, b) => a.slug.localeCompare(b.slug));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Exam page parsing
   ───────────────────────────────────────────────────────────────────────────── */

function firstSection($, ids) {
  for (const id of ids) {
    const $sec = $(`div.p-y-5#${id}`).first();
    if ($sec.length) return $sec;
  }
  return null;
}

/** Body text of a section without its headings (headings repeat the title). */
function sectionSummary($, ids, max) {
  const $sec = firstSection($, ids);
  if (!$sec || !$sec.length) return "";
  const $clone = $sec.clone();
  $clone.find("h1,h2,h3,h4,h5,h6").remove();
  const text = cleanText($clone.text());
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return clip(sentences.slice(0, 2).join(" ").trim(), max);
}

/** Highlights table → { key: {value, link} }. Tolerant to any section wrapper. */
function extractHighlights($) {
  let $sec = $("div.p-y-5#Highlights").first();
  if (!$sec.length) $sec = $("div.p-y-5").has("table").first();
  const map = new Map();
  if (!$sec.length) return map;
  $sec.find("table tr").each((_, tr) => {
    const $cells = $(tr).find("th,td");
    if ($cells.length < 2) return;
    const key = cleanText($cells.first().text()).toLowerCase().replace(/\s+/g, " ").replace(/:$/, "").trim();
    if (!key || key.length > 60) return;
    const value = cleanText(
      $cells
        .slice(1)
        .map((__, c) => cleanText($(c).text()))
        .get()
        .filter(Boolean)
        .join(" · ")
    );
    const link = normalizeUrl($(tr).find("a[href]").first().attr("href"));
    if (value && !map.has(key)) map.set(key, { value, link });
  });
  return map;
}

function highlightByPattern(highlights, re) {
  for (const [key, entry] of highlights) {
    if (re.test(key)) return entry;
  }
  return null;
}

function splitList(value) {
  return cleanText(value)
    .split(/,|;|\s+and\s+|\s*\/\s*/)
    .map((s) => clip(s, 100))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * First plausible age range ("20-30 years", "21-30 on Jan 1, 2026").
 * Structured table cells win over narrative prose — post-wise tables are the
 * authoritative row-level data on these pages.
 */
function extractAgeRange($, $sec) {
  if (!$sec || !$sec.length) return null;
  const AGE_RE = /\b(\d{1,2})\s*(?:-|–|—|\bto\b|\band\b)\s*(\d{1,2})\s*(?:years?\b|yrs?\b|on\b)/i;
  const scan = (selector) => {
    let range = null;
    $sec.find(selector).each((__, cell) => {
      if (range) return false;
      const m = AGE_RE.exec(cleanText($(cell).text()));
      if (m) {
        const min = Number(m[1]);
        const max = Number(m[2]);
        if (min >= 10 && max <= 75 && max >= min) range = { min, max };
      }
      return !range;
    });
    return range;
  };
  return scan("td,th") || scan("p,li");
}

function firstExternalLink($, $sec, urlRe) {
  let url = "";
  if (!$sec || !$sec.length) return url;
  $sec.find("a[href]").each((__, a) => {
    if (url) return false;
    const href = cleanText($(a).attr("href"));
    if (!isHttpUrl(href)) return false;
    let host = "";
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return false;
    }
    if (host === "easyshiksha.com" || host.endsWith(".easyshiksha.com")) return false;
    const haystack = `${$(a).text()} ${href}`.toLowerCase();
    if (urlRe && !urlRe.test(haystack)) return false;
    url = href;
    return !url;
  });
  return url;
}

/**
 * Parse one exam page into a normalized, DB-ready plain object.
 * Missing fields are always "" / [] — never invented.
 *
 * @param {string} html
 * @param {{slug: string, listingTitle?: string, category?: string, checkedAt?: string}} context
 */
function parseExamPage(html, context = {}) {
  const $ = cheerio.load(html);
  const canonical = cleanText($('link[rel="canonical"]').attr("href"));

  // ── Identity ──
  let examName = cleanText(context.listingTitle);
  const $h1 = $("h1.exam-head").first();
  if (!examName && $h1.length) examName = cleanText($h1.text()).split(/[:|·]/)[0].trim();
  if (!examName) examName = cleanText(context.slug || "");
  examName = clip(examName, 200);

  const highlights = extractHighlights($);
  const highlight = (re) => highlightByPattern(highlights, re);

  const officialRow = highlight(/official (website|site)|website of (the )?(exam|commission)?/);
  let officialWebsite = "";
  if (officialRow) officialWebsite = officialRow.link || normalizeUrl(officialRow.value);
  if (!officialWebsite) {
    const generic = highlight(/\bwebsite\b/);
    if (generic) officialWebsite = generic.link || normalizeUrl(generic.value);
  }

  // ── Overview ──
  let description = "";
  if ($h1.length) description = cleanText($h1.nextAll("p").first().text());
  if (description.length < 40) {
    description = cleanText(
      $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || ""
    );
  }
  description = clip(description, 700);

  const conductingBody = clip((highlight(/(conducting|recruiting|hiring) body/ ) || {}).value || "", 160);
  const shortName = clip((highlight(/commonly known as|short name/) || {}).value || "", 80);
  const qualification = clip((highlight(/eligib|academic qualification|educational qualification|qualification/) || {}).value || "", 300);
  const salary = clip((highlight(/payscale|pay scale|salary|remuneration|stipend/) || {}).value || "", 300);
  const vacancyInfo = clip(
    (highlight(/vacanc|total vacancies|number of (posts|vacancies)/) || highlight(/^posts$/) || {}).value || "",
    400
  );

  // ── Dates (exact dates only) ──
  const dates = extractSectionDates($);
  const $datesSec = firstSection($, ["Dates"]);
  const datesNotes = clip($datesSec && $datesSec.length ? $datesSec.text() : "", 700);

  // ── Eligibility ──
  const $elig = firstSection($, ["Eligibility"]);
  const additionalEligibility = clip($elig && $elig.length ? $elig.text() : "", 700);
  let age = null;
  const ageRow = highlight(/\bage (limit|criteria|range)\b|^age$/);
  if (ageRow) {
    const m = ageRow.value.match(/\b(\d{1,2})\s*(?:-|–|—|\bto\b|\band\b)\s*(\d{1,2})/);
    if (m && Number(m[2]) >= Number(m[1]) && Number(m[1]) >= 10 && Number(m[2]) <= 75) {
      age = { min: Number(m[1]), max: Number(m[2]) };
    }
  }
  if (!age) age = extractAgeRange($, $elig);

  // ── Recruitment ──
  let selectionProcess = splitList((highlight(/stages of recruitment|selection process|mode of selection|^selection$/) || {}).value || "");
  if (!selectionProcess.length) {
    const $sel = firstSection($, ["Selection", "SelectionProcess"]);
    if ($sel && $sel.length) {
      $sel.find("li").each((__, li) => {
        if (selectionProcess.length < 8) selectionProcess.push(clip($(li).text(), 100));
      });
      if (!selectionProcess.length) {
        $sel.find("table tr").each((__, tr) => {
          if (selectionProcess.length >= 8) return false;
          const first = cleanText($(tr).find("th,td").first().text());
          const isHeader = $(tr).find("th").length > 0;
          if (first && !isHeader) selectionProcess.push(clip(first, 100));
          return !isHeader;
        });
      }
      selectionProcess = selectionProcess.filter(Boolean);
    }
  }

  let posts = [];
  const postsRow = highlight(/^posts$|posts offered|posts announced/);
  if (postsRow) posts = splitList(postsRow.value);

  const admitCardInfo = sectionSummary($, ["AdmitCard", "Admit Card"], 500);
  const resultInfo = sectionSummary($, ["Result", "Results"], 500);
  const cutoffInfo = sectionSummary($, ["CutOff", "Cutoff", "Cut-Off", "Cut off"], 500);

  // ── Exam information ──
  const examPattern = {
    mode: clip((highlight(/exam mode|mode of exam|mode of examination/) || {}).value || "", 80),
    duration: clip((highlight(/exam duration|duration of (the )?exam|^duration$/) || {}).value || "", 120),
    questions: "",
    marks: "",
    subjects: [],
  };
  const $pattern = firstSection($, ["ExamPattern", "Pattern"]);
  if ($pattern && $pattern.length) {
    $pattern.find("li").each((__, li) => {
      if (examPattern.subjects.length >= 10) return false;
      const text = cleanText($(li).text());
      if (text.length >= 3 && text.length <= 120) examPattern.subjects.push(text);
      return true;
    });
  }

  const syllabus = [];
  const $syl = firstSection($, ["Syllabus"]);
  if ($syl && $syl.length) {
    $syl.find("li").each((__, li) => {
      if (syllabus.length >= 15) return false;
      const text = cleanText($(li).text());
      if (text.length >= 3 && text.length <= 160) syllabus.push(text);
      return true;
    });
  }

  // ── Links ──
  const applicationUrl = firstExternalLink($, firstSection($, ["Application", "Applications"]), /apply|career|recruit|job|vacanc|application|register|portal|online/);
  const notificationUrl = firstExternalLink($, firstSection($, ["Notification", "Notifications"]), /notification|pdf|download|recruit|vacanc/);

  const sourceUrl = canonical || (context.slug ? `${LISTING_URL}/${context.slug}` : "");

  return {
    examName,
    shortName,
    governmentType: "Central",
    category: cleanText(context.category || ""),
    description,
    conductingBody,
    qualification,
    additionalEligibility,
    minimumAge: age ? age.min : null,
    maximumAge: age ? age.max : null,
    posts,
    vacancyInfo,
    salary,
    selectionProcess,
    examPattern,
    syllabus,
    notificationDate: dates.notificationDate,
    applicationStartDate: dates.applicationStartDate,
    applicationEndDate: dates.applicationEndDate,
    examDate: dates.examDate,
    resultDate: dates.resultDate,
    datesNotes,
    admitCardInfo,
    resultInfo,
    cutoffInfo,
    officialWebsite,
    notificationUrl,
    applicationUrl,
    sourceUrl,
    sourceWebsite: SOURCE_WEBSITE,
    status: deriveStatus(dates),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Persistence — idempotent upsert keyed by (sourceWebsite, sourceUrl).
   ───────────────────────────────────────────────────────────────────────────── */

// Fields the sync owns on EasyShiksha-sourced records.
const MANAGED_FIELDS = [
  "examName",
  "shortName",
  "governmentType",
  "state",
  "category",
  "description",
  "conductingBody",
  "qualification",
  "eligibleDegrees",
  "minimumAge",
  "maximumAge",
  "ageRelaxation",
  "additionalEligibility",
  "applicationFee",
  "posts",
  "vacancyInfo",
  "salary",
  "selectionProcess",
  "examPattern",
  "syllabus",
  "notificationDate",
  "applicationStartDate",
  "applicationEndDate",
  "examDate",
  "resultDate",
  "datesNotes",
  "admitCardInfo",
  "resultInfo",
  "cutoffInfo",
  "officialWebsite",
  "notificationUrl",
  "applicationUrl",
  "sourceUrl",
  "sourceWebsite",
  "status",
  "sourceLastChecked",
];

const CATEGORY_ORG_SLUG = {
  UPSC: "upsc",
  SSC: "ssc",
  Banking: "banking",
  Railways: "railways",
};

/**
 * Normalize a value for change detection. Mongoose subdocuments (e.g.
 * examPattern) expose internal, potentially circular structures — always
 * convert them with toObject() first, and guard plain data with a seen-set
 * so recursion can never blow the stack.
 */
function normalizeValue(value, seen = new Set()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    return value.map((x) => normalizeValue(x, seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const plain = typeof value.toObject === "function" ? value.toObject() : value;
    return Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, normalizeValue(v, seen)]));
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return value;
}

const sameValue = (a, b) => JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));

async function makeUniqueSlug(baseSlug) {
  const slug = baseSlug || "central-exam";
  let candidate = slug;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await GraduateExam.findOne({ slug: candidate }).select("_id").lean();
    if (!exists) return candidate;
    candidate = `${slug}-${n}`;
    n += 1;
  }
}

/**
 * Upsert one parsed exam.
 * Lookup order: (sourceWebsite, sourceUrl) → stable slug → same name under the
 * target organization. Returns "created" | "updated" | "unchanged".
 */
async function upsertExam(parsed, orgBySlug, checkedAt) {
  const org =
    orgBySlug.get(CATEGORY_ORG_SLUG[parsed.category] || "other-central") ||
    orgBySlug.get("other-central");
  if (!org) throw new Error("No central organization available for mapping");

  const payload = {
    ...parsed,
    organization: org._id,
    state: org.state || "",
    sourceLastChecked: checkedAt,
  };
  delete payload.slug; // slug is assigned only on creation and then stays stable

  const safeName = escapeRegex(parsed.examName);
  let doc = await GraduateExam.findOne({ sourceWebsite: SOURCE_WEBSITE, sourceUrl: parsed.sourceUrl });
  if (!doc && parsed.sourceUrl) {
    doc = await GraduateExam.findOne({
      slug: slugify(parsed.examName),
      governmentType: "Central",
      $or: [{ sourceWebsite: { $in: [null, ""] } }, { sourceWebsite: SOURCE_WEBSITE }],
    });
  }
  if (!doc) {
    doc = await GraduateExam.findOne({
      organization: org._id,
      examName: { $regex: `^${safeName}$`, $options: "i" },
    });
  }

  if (!doc) {
    await GraduateExam.create({ ...payload, slug: await makeUniqueSlug(slugify(parsed.examName)) });
    return "created";
  }

  let changed = false;
  for (const field of MANAGED_FIELDS) {
    if (!sameValue(doc[field], payload[field])) {
      doc[field] = payload[field];
      changed = true;
    }
  }
  if (String(doc.organization) !== String(org._id)) {
    doc.organization = org._id;
    changed = true;
  }

  if (changed) {
    doc.sourceLastChecked = checkedAt;
    await doc.save(); // bumps updatedAt (lastUpdated) only on real changes
    return "updated";
  }

  // Unchanged record: refresh the check timestamp WITHOUT touching updatedAt.
  await GraduateExam.updateOne(
    { _id: doc._id },
    { $set: { sourceLastChecked: checkedAt } },
    { timestamps: false }
  );
  return "unchanged";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Orchestration
   ───────────────────────────────────────────────────────────────────────────── */

async function httpGet(url) {
  let res;
  try {
    res = await axios.get(url, {
      timeout: PAGE_TIMEOUT_MS,
      responseType: "text",
      maxRedirects: 5,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      validateStatus: (s) => s >= 200 && s < 300,
    });
  } catch (error) {
    throw new SourceFetchError(`${url} — ${error.message}`);
  }
  const body = typeof res.data === "string" ? res.data : "";
  if (body.length < 500) throw new SourceFetchError(`${url} — empty or non-HTML response`);
  return body;
}

async function runPool(items, size, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

/**
 * Fetch the EasyShiksha listing, parse every Central exam page and upsert the
 * results. Never throws for individual exam failures — they are counted.
 * The listing itself failing throws SourceFetchError (handled by the caller
 * with a generic, non-technical message).
 *
 * @param {{limit?: number, concurrency?: number}} options
 * @returns {Promise<object>} run summary
 */
async function syncCentralExams(options = {}) {
  const limit = Number(options.limit) > 0 ? Math.floor(Number(options.limit)) : 0;
  const concurrency = Number(options.concurrency) > 0 ? Math.floor(Number(options.concurrency)) : CONCURRENCY;
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();

  const listingHtml = await httpGet(LISTING_URL);
  const catalog = discoverCentralExams(listingHtml);
  const selected = limit > 0 ? catalog.slice(0, limit) : catalog;

  const orgDocs = await RecruitmentOrganization.find({ governmentType: "Central", isActive: true }).lean();
  const orgBySlug = new Map(orgDocs.map((o) => [o.slug, o]));

  const summary = { created: 0, updated: 0, unchanged: 0, failed: 0 };
  const failures = [];

  await runPool(selected, concurrency, async (item) => {
    try {
      const html = await httpGet(`${LISTING_URL}/${item.slug}`);
      const parsed = parseExamPage(html, {
        slug: item.slug,
        listingTitle: item.title,
        category: item.category,
      });
      if (!parsed.examName || !parsed.sourceUrl) throw new Error("page did not yield an exam identity");
      const outcome = await upsertExam(parsed, orgBySlug, checkedAt);
      summary[outcome] += 1;
    } catch (error) {
      summary.failed += 1;
      failures.push(item.slug);
      console.warn(`[easyShiksha] exam skipped (${item.slug}): ${error.message}`);
    }
  });

  const result = {
    success: true,
    source: SOURCE_WEBSITE,
    sourceUrl: LISTING_URL,
    totalFound: catalog.length,
    ...summary,
    lastChecked: checkedAt,
    durationMs: Date.now() - startedAt,
  };
  console.log(
    `[easyShiksha] sync done — found ${result.totalFound}, created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}, failed ${result.failed} (${result.durationMs}ms)`
  );
  if (failures.length) console.warn(`[easyShiksha] failed pages: ${failures.join(", ")}`);
  return result;
}

module.exports = {
  SOURCE_WEBSITE,
  LISTING_URL,
  SourceFetchError,
  // pure helpers (exported for tests)
  cleanText,
  clip,
  normalizeUrl,
  extractDates,
  classifyDateLabel,
  deriveStatus,
  parseListing,
  discoverCentralExams,
  parseExamPage,
  // change-detection helper (exported for the circular-reference regression test)
  normalizeValue,
  // orchestration
  syncCentralExams,
};

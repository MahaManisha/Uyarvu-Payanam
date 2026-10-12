/**
 * easyShikshaExamService tests — listing discovery, Central classification,
 * page parsing, date normalization, sanitization and status derivation.
 *
 * Pure-function tests only (no network, no database): fixtures mirror the real
 * EasyShiksha markup (tab panes, .p-y-5 sections, highlights tables).
 *
 * Run: node backend/tests/easyShikshaExamService.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cleanText,
  clip,
  normalizeUrl,
  extractDates,
  classifyDateLabel,
  deriveStatus,
  parseListing,
  discoverCentralExams,
  parseExamPage,
  normalizeValue,
} = require("../services/easyShikshaExamService");

/* ── helpers ─────────────────────────────────────────────────────────────── */

const p = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const longDate = (d) =>
  `${d.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}`;

const card = (slug, title) =>
  `<a href="https://easyshiksha.com/govt-exam/${slug}"><div class="grid-inner"><div class="head-div"><h3>${title}</h3></div></div></a>`;

const pane = (id, cards) => `<div id="${id}" class="tab-pane fade"><div class="grid-box">${cards.join("")}</div></div>`;

const LISTING_FIXTURE = `<!DOCTYPE html><html><head><link rel="canonical" href="https://easyshiksha.com/govt-exam"></head>
<body><section id="govt-exam"><div class="tab-menu"><ul class="nav nav-tabs">
  <li class="active"><a data-toggle="tab" href="#All">All</a></li>
  <li><a data-toggle="tab" href="#Banking">Banking</a></li>
  <li><a data-toggle="tab" href="#Defence">Defence</a></li>
  <li><a data-toggle="tab" href="#SSC">SSC</a></li>
  <li><a data-toggle="tab" href="#Teaching">Teaching</a></li>
  <li><a data-toggle="tab" href="#UPSC">UPSC</a></li>
  <li><a data-toggle="tab" href="#PSC">State PSC</a></li>
</ul><div class="tab-content">
  ${pane("All", [
    card("ibps-po", "IBPS PO"),
    card("ssc-cgl", "SSC CGL"),
    card("ctet", "CTET"),
    card("cds", "CDS"),
    card("ias-exam", "IAS Exam"),
    card("tnpsc", "TNPSC"),
    card("haryana-police", "Haryana Police"),
    card("uptet", "UP TET"),
    card("federal-bank-po", "Federal Bank PO"),
    card("upsssc", "UPSSSC"),
    card("mystery-exam", "Only In All"),
  ])}
  ${pane("Banking", [card("ibps-po", "IBPS PO"), card("federal-bank-po", "Federal Bank PO")])}
  ${pane("Defence", [card("cds", "CDS"), card("haryana-police", "Haryana Police")])}
  ${pane("SSC", [card("ssc-cgl", "SSC CGL"), card("upsssc", "UPSSSC")])}
  ${pane("Teaching", [card("ctet", "CTET"), card("uptet", "UP TET")])}
  ${pane("UPSC", [card("ias-exam", "IAS Exam")])}
  ${pane("PSC", [card("tnpsc", "TNPSC")])}
</div></div></section></body></html>`;

/* ── text helpers ────────────────────────────────────────────────────────── */

test("cleanText strips markup, collapses whitespace and control chars", () => {
  assert.equal(cleanText("  Tier&nbsp; I:  <b>60</b>\n minutes\u0000 "), "Tier I: 60 minutes");
  assert.equal(cleanText(null), "");
});

test("clip truncates with an ellipsis and never returns raw HTML", () => {
  const long = `<p>${"a".repeat(120)}</p>`;
  const out = clip(long, 50);
  assert.ok(out.length <= 50);
  assert.ok(!out.includes("<"));
  assert.ok(out.endsWith("…"));
  assert.equal(clip("short", 50), "short");
});

test("normalizeUrl accepts bare domains and rejects non-URLs", () => {
  assert.equal(normalizeUrl("ssc.gov.in"), "https://ssc.gov.in");
  assert.equal(normalizeUrl("https://upsc.gov.in/"), "https://upsc.gov.in/");
  assert.equal(normalizeUrl("click here"), "");
  assert.equal(normalizeUrl("not a url ."), "");
});

/* ── listing discovery ───────────────────────────────────────────────────── */

test("parseListing maps every tab pane to its exam cards", () => {
  const panes = parseListing(LISTING_FIXTURE);
  assert.deepEqual([...panes.keys()].sort(), ["All", "Banking", "Defence", "PSC", "SSC", "Teaching", "UPSC"]);
  assert.deepEqual(
    panes.get("Banking").map((x) => x.slug),
    ["ibps-po", "federal-bank-po"]
  );
  assert.equal(panes.get("Banking")[0].title, "IBPS PO");
});

test("discoverCentralExams keeps central exams and drops state/private ones", () => {
  const found = discoverCentralExams(LISTING_FIXTURE);
  const bySlug = Object.fromEntries(found.map((e) => [e.slug, e.category]));

  // Central exams under central tabs
  assert.equal(bySlug["ibps-po"], "Banking");
  assert.equal(bySlug["ssc-cgl"], "SSC");
  assert.equal(bySlug["ctet"], "Teaching");
  assert.equal(bySlug["cds"], "Defence");
  assert.equal(bySlug["ias-exam"], "UPSC");

  // Excluded: state PSC only, state police, state TET, private bank, state board,
  // and exams that only appear in the catch-all "All" pane.
  for (const slug of ["tnpsc", "haryana-police", "uptet", "federal-bank-po", "upsssc", "mystery-exam"]) {
    assert.equal(bySlug[slug], undefined, `${slug} must not be treated as Central`);
  }
  assert.equal(found.length, 5);
});

test("discoverCentralExams returns [] when the source has no tab panes", () => {
  assert.deepEqual(discoverCentralExams("<html><body><p>maintenance</p></body></html>"), []);
});

/* ── dates ───────────────────────────────────────────────────────────────── */

test("extractDates parses day-first, month-first and numeric dates in order", () => {
  const dates = extractDates("Form closes 27 February 2026; exam on August 22, 2026; fee by 31/01/2026");
  assert.deepEqual(
    dates.map((d) => d.iso),
    ["2026-02-27", "2026-08-22", "2026-01-31"]
  );
});

test("extractDates rejects impossible calendar dates", () => {
  assert.deepEqual(extractDates("31 February 2026"), []);
  assert.deepEqual(extractDates("Yet to be announced"), []);
});

test("classifyDateLabel maps real source row labels to fields", () => {
  assert.equal(classifyDateLabel("Start Date To Apply Online for RRB NTPC"), "start");
  assert.equal(classifyDateLabel("Last Date To Apply Online"), "end");
  assert.equal(classifyDateLabel("Closing Date & Time for Payment of Application Fee"), "end");
  assert.equal(classifyDateLabel("Official Notification Released"), "notification");
  assert.equal(classifyDateLabel("Preliminary Examination Date"), "exam");
  assert.equal(classifyDateLabel("Mains exam"), "exam");
  assert.equal(classifyDateLabel("Result Declaration"), "result");
  assert.equal(classifyDateLabel("IBPS PO Exam"), "exam");
  assert.equal(classifyDateLabel("General Info"), null);
});

/* ── status derivation (dates only) ──────────────────────────────────────── */

test("deriveStatus covers every derived value", () => {
  assert.equal(
    deriveStatus({ applicationStartDate: iso(shift(3)), applicationEndDate: iso(shift(30)) }),
    "Upcoming"
  );
  assert.equal(
    deriveStatus({ applicationStartDate: iso(shift(-5)), applicationEndDate: iso(shift(5)) }),
    "Application Open"
  );
  assert.equal(
    deriveStatus({ applicationStartDate: iso(shift(-40)), applicationEndDate: iso(shift(-10)) }),
    "Application Closed"
  );
  assert.equal(
    deriveStatus({ applicationStartDate: iso(shift(-40)), applicationEndDate: iso(shift(-10)), examDate: iso(shift(-1)) }),
    "Exam Completed"
  );
  assert.equal(deriveStatus({}), "Date Not Available");
  assert.equal(deriveStatus({ applicationStartDate: "garbage" }), "Date Not Available");
  // End-only with a future end still counts as open; exam-only flips on exam day.
  assert.equal(deriveStatus({ applicationEndDate: iso(shift(2)) }), "Application Open");
  assert.equal(deriveStatus({ examDate: iso(shift(9)) }), "Upcoming");
});

/* ── exam page parsing ───────────────────────────────────────────────────── */

function examFixture() {
  const start = shift(-3);
  const end = shift(10);
  const examDay = shift(40);
  const notified = shift(-30);
  return {
    start,
    end,
    examDay,
    notified,
    html: `<!DOCTYPE html><html><head>
      <link rel="canonical" href="https://easyshiksha.com/govt-exam/ssc-cgl">
      <meta property="og:description" content="Fallback description.">
    </head><body>
      <h1 class="exam-head">SSC CGL EXAM 2026: Eligibility, Application Form, Exam Pattern</h1>
      <div class="article-meta"><p class="date">Updated On<span> Oct 05, 2026</span></p></div>
      <p>The Staff Selection Commission (SSC) conducts the SSC CGL Exam for the recruitment of Grade B posts.</p>
      <div class="sub-head-2"><h3>Latest Updates</h3><ul><li>21 May, 2026: Application Start Date (Tentative)</li></ul></div>
      <div id="Highlights" class="p-y-5">
        <h3 class="sub-head">Highlights</h3>
        <table class="table table-bordered"><tbody>
          <tr><td>Conducting Body</td><td>Staff Selection Commission</td></tr>
          <tr><td>Exam Mode</td><td>Online</td></tr>
          <tr><td>Exam Duration</td><td>Tier 1 – 60 minutes</td></tr>
          <tr><td>Total Vacancies</td><td>12,256</td></tr>
          <tr><td>Stages of recruitment</td><td>Prelims, Mains and Interview</td></tr>
          <tr><td>Official Website</td><td><a href="https://ssc.gov.in/">ssc.gov.in</a></td></tr>
        </tbody></table>
      </div>
      <div id="Dates" class="p-y-5">
        <h3 class="sub-head">Dates</h3>
        <table class="table"><tbody>
          <tr><td>Official Notification Released</td><td>${longDate(notified)}</td></tr>
          <tr><td>Start Date To Apply Online</td><td>${longDate(start)}</td></tr>
          <tr><td>Last Date To Apply Online</td><td>${longDate(end)}</td></tr>
          <tr><td>Preliminary Examination Date</td><td>${longDate(examDay)}</td></tr>
          <tr><td>Result Declaration</td><td>To be announced</td></tr>
        </tbody></table>
      </div>
      <div id="Vacancy" class="p-y-5"><h3 class="sub-head">Vacancy</h3>
        <p>SSC CGL vacancy trends show how the number of posts changed over the years.</p></div>
      <div id="Eligibility" class="p-y-5">
        <h3 class="sub-head">Eligibility Criteria 2026</h3>
        <p>Candidates who fall in the age group of 18 to 30 years can apply.</p>
        <table><thead><tr><th>Name of Post</th><th>Age Limit</th></tr></thead>
        <tbody><tr><td>Assistant Section Officer</td><td>20–30 years</td></tr></tbody></table>
      </div>
      <div id="Application" class="p-y-5"><h3 class="sub-head">2026 Online Application</h3>
        <p>Apply through the official portal.</p>
        <a href="https://ssc.gov.in/apply">Apply Now</a>
        <a href="https://easyshiksha.com/signup">Apply Now</a></div>
      <div id="ExamPattern" class="p-y-5"><h3 class="sub-head">Exam Pattern</h3>
        <ul><li>General Intelligence</li><li>Quantitative Aptitude</li></ul></div>
      <div id="Syllabus" class="p-y-5"><h3 class="sub-head">Syllabus</h3>
        <ul><li>General Awareness</li><li>English Language</li></ul></div>
      <div id="SelectionProcess" class="p-y-5"><h3 class="sub-head">Selection Process</h3>
        <ul><li>Preliminary Exam</li><li>Mains Exam</li></ul></div>
      <div id="AdmitCard" class="p-y-5"><h3 class="sub-head">Admit card</h3>
        <p>Admit card is released 15 days before the exam. <b>Download</b> it from the portal.</p></div>
      <div id="Results" class="p-y-5"><h3 class="sub-head">Results</h3>
        <p>Results are declared 25 days after the exam.</p></div>
      <div id="CutOff" class="p-y-5"><h3 class="sub-head">Cutoff</h3>
        <p>Cut off marks are released category-wise after the exam.</p></div>
    </body></html>`,
  };
}

test("parseExamPage extracts structured fields from source sections", () => {
  const fx = examFixture();
  const out = parseExamPage(fx.html, { slug: "ssc-cgl", listingTitle: "SSC CGL", category: "SSC" });

  assert.equal(out.examName, "SSC CGL");
  assert.equal(out.conductingBody, "Staff Selection Commission");
  assert.equal(out.category, "SSC");
  assert.equal(out.governmentType, "Central");
  assert.equal(out.sourceUrl, "https://easyshiksha.com/govt-exam/ssc-cgl");
  assert.equal(out.sourceWebsite, "EasyShiksha");
  assert.equal(out.officialWebsite, "https://ssc.gov.in/");
  assert.ok(out.description.includes("Staff Selection Commission"));
  assert.equal(out.vacancyInfo, "12,256");
  assert.equal(out.salary, "");

  // dates: exact calendar dates only, in the right fields
  assert.equal(out.notificationDate, iso(fx.notified));
  assert.equal(out.applicationStartDate, iso(fx.start));
  assert.equal(out.applicationEndDate, iso(fx.end));
  assert.equal(out.examDate, iso(fx.examDay));
  assert.equal(out.resultDate, ""); // "To be announced" → nothing invented

  // eligibility: first plausible range from the age table
  assert.equal(out.minimumAge, 20);
  assert.equal(out.maximumAge, 30);
  assert.ok(out.additionalEligibility.includes("age group of 18 to 30"));

  // Highlights "Stages of recruitment" row wins over the section list;
  // the section under SelectionProcess is the fallback when it is absent.
  assert.deepEqual(out.selectionProcess, ["Prelims", "Mains", "Interview"]);
  assert.deepEqual(out.syllabus, ["General Awareness", "English Language"]);
  assert.deepEqual(out.examPattern.subjects, ["General Intelligence", "Quantitative Aptitude"]);
  assert.equal(out.examPattern.mode, "Online");
  assert.ok(out.admitCardInfo.includes("released 15 days before"));
  assert.ok(out.resultInfo.includes("25 days after"));
  assert.ok(out.cutoffInfo.includes("category-wise"));

  // external links only — easyshiksha's own promo links are not official URLs
  assert.equal(out.applicationUrl, "https://ssc.gov.in/apply");
  assert.equal(out.status, "Application Open");
});

test("parseExamPage never invents missing data and never stores markup", () => {
  const html = `<!DOCTYPE html><html><head><link rel="canonical" href="https://easyshiksha.com/govt-exam/cds"></head>
    <body><h1 class="exam-head">CDS Exam: Eligibility, Application Form</h1>
    <p>A paragraph describing the Combined Defence Services examination entry.</p>
    <div id="Notification" class="p-y-5"><h3>Notification</h3><p>No live notification right now.</p></div>
    <div id="AdmitCard" class="p-y-5"><h3>Admit Card</h3><p>To be released</p></div>
    </body></html>`;
  const out = parseExamPage(html, { slug: "cds", listingTitle: "CDS", category: "Defence" });

  // absent → empty, never fabricated
  assert.equal(out.conductingBody, "");
  assert.equal(out.officialWebsite, "");
  assert.equal(out.applicationStartDate, "");
  assert.equal(out.applicationEndDate, "");
  assert.equal(out.examDate, "");
  assert.equal(out.resultDate, "");
  assert.equal(out.minimumAge, null);
  assert.equal(out.maximumAge, null);
  assert.equal(out.vacancyInfo, "");
  assert.equal(out.applicationUrl, "");
  assert.equal(out.status, "Date Not Available");
  assert.deepEqual(out.selectionProcess, []);
  assert.deepEqual(out.syllabus, []);

  // no markup survives anywhere
  for (const value of [
    out.description,
    out.admitCardInfo,
    out.additionalEligibility,
    out.examName,
    out.datesNotes,
  ]) {
    assert.ok(!/<[^>]+>/.test(value), `markup leaked into ${value}`);
  }
});

test("parseExamPage falls back to the page heading and handles broken markup", () => {
  const html = `<html><body><h1 class="exam-head">Railway <b>NTPC</b> Exam: Details</h1>
    <div id="Dates" class="p-y-5"><h3>Dates</h3><table><tr><td>Last date to register</td><td>27 November 2025</td></tr></table></div>
    </body></html>`;
  const out = parseExamPage(html, { slug: "rrb-ntpc" });
  assert.equal(out.examName, "Railway NTPC Exam");
  assert.equal(out.applicationEndDate, "2025-11-27");
  assert.equal(out.status, "Application Closed");
});

test("selectionProcess falls back to the section list when no Highlights row exists", () => {
  const html = `<html><body><h1 class="exam-head">CDS Exam: Details</h1>
    <p>A paragraph describing the Combined Defence Services examination entry.</p>
    <div id="SelectionProcess" class="p-y-5"><h3>Selection</h3>
      <ul><li>Written Exam</li><li>SSB Interview</li></ul></div>
    </body></html>`;
  const out = parseExamPage(html, { slug: "cds", listingTitle: "CDS" });
  assert.deepEqual(out.selectionProcess, ["Written Exam", "SSB Interview"]);
});

test("normalizeValue survives circular structures (mongoose-document regression)", () => {
  // A plain circular structure must not blow the stack.
  const circular = { mode: "Online" };
  circular.self = circular;
  assert.equal(normalizeValue(circular).self, "[circular]");

  // Objects exposing toObject() (mongoose subdocuments) are compared by their
  // plain data, never by their internal, circular properties.
  const subdoc = {
    toObject() {
      return { mode: "Online", duration: "60 min", subjects: ["Maths"] };
    },
    $__: { parentCircular: null },
  };
  subdoc.$__.parentCircular = subdoc;
  assert.deepEqual(normalizeValue(subdoc), {
    mode: "Online",
    duration: "60 min",
    subjects: ["Maths"],
  });

  // Strings are trimmed; nullish becomes "" so stored vs parsed compare equal.
  assert.equal(normalizeValue("  a  "), "a");
  assert.equal(normalizeValue(null), "");
  assert.equal(normalizeValue(undefined), "");
});

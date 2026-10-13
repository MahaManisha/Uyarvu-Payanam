const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const RecruitmentOrganization = require('../models/RecruitmentOrganization');
const GraduateExam = require('../models/GraduateExam');
const SUPPLIED = require('../seeders/centralExamSyllabusData');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/uyarvu-payanam';
const DRY = process.argv.includes('--dry-run');

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\u2013\u2014-]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function run() {
  if (!MONGO_URI) throw new Error('No MONGO_URI in .env');
  console.log(`Connecting to DB...${DRY ? ' (DRY RUN - no writes)' : ''}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const orgs = await RecruitmentOrganization.find({ governmentType: 'Central' }).lean();
  const orgBySlug = Object.fromEntries(orgs.map((o) => [o.slug, o]));
  const exams = await GraduateExam.find({ governmentType: 'Central' }).lean();

  const report = {
    supplied: 0,
    replaced: 0,
    added: 0,
    unchanged: 0,
    unmatched: [],
    covered: new Set(),
  };

  for (const [slug, entries] of Object.entries(SUPPLIED)) {
    const org = orgBySlug[slug];
    if (!org) {
      for (const e of entries) report.unmatched.push({ org: slug, name: e.name, reason: 'organization not found' });
      continue;
    }
    const orgExams = exams.filter((e) => String(e.organization) === String(org._id));
    const byNorm = new Map();
    for (const e of orgExams) byNorm.set(norm(e.examName), e);

    for (const entry of entries) {
      report.supplied++;
      let target = byNorm.get(norm(entry.name)) || orgExams.find((e) => e.examName === entry.name);
      if (!target) {
        report.unmatched.push({ org: slug, name: entry.name, reason: 'no matching exam' });
        continue;
      }
      if (report.covered.has(String(target._id))) {
        report.unmatched.push({ org: slug, name: entry.name, reason: `duplicate target -> ${target.examName}` });
        continue;
      }
      report.covered.add(String(target._id));

      const same = JSON.stringify(target.syllabus || []) === JSON.stringify(entry.syllabus);
      if (same) {
        report.unchanged++;
        continue;
      }
      const wasEmpty = !(target.syllabus && target.syllabus.length);
      if (!DRY) {
        await GraduateExam.updateOne({ _id: target._id }, { $set: { syllabus: entry.syllabus } });
      }
      if (wasEmpty) report.added++;
      else report.replaced++;
    }
  }

  const uncovered = exams.filter((e) => !report.covered.has(String(e._id))).map((e) => e.examName);

  console.log('\n================ UPDATE REPORT ================');
  console.log(`Supplied entries processed : ${report.supplied}`);
  console.log(`Syllabuses REPLACED        : ${report.replaced}`);
  console.log(`Syllabuses ADDED (was empty): ${report.added}`);
  console.log(`Unchanged                  : ${report.unchanged}`);
  console.log(`Unmatched supplied entries : ${report.unmatched.length}`);
  report.unmatched.forEach((u) => console.log(`   - [${u.org}] "${u.name}" (${u.reason})`));
  console.log(`Central exams NOT covered  : ${uncovered.length}`);
  uncovered.forEach((n) => console.log(`   - ${n}`));
  console.log('==============================================\n');

  if (!DRY) {
    console.log('Verifying writes...');
    let ok = 0;
    let bad = 0;
    for (const [slug, entries] of Object.entries(SUPPLIED)) {
      const org = orgBySlug[slug];
      const orgExams = await GraduateExam.find({ organization: org._id }).lean();
      const byNorm = new Map(orgExams.map((e) => [norm(e.examName), e]));
      for (const entry of entries) {
        const t = byNorm.get(norm(entry.name));
        if (!t) {
          bad++;
          console.log(`   MISSING after update: ${entry.name}`);
          continue;
        }
        if (JSON.stringify(t.syllabus || []) === JSON.stringify(entry.syllabus)) ok++;
        else {
          bad++;
          console.log(`   MISMATCH after update: ${entry.name}`);
        }
      }
    }
    console.log(`Verification: ${ok} OK, ${bad} bad.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

run().catch((error) => {
  console.error('CRITICAL UPDATE ERROR:');
  console.error(error.message || error);
  process.exit(1);
});

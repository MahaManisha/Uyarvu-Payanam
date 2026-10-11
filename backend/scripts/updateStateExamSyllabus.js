const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const GraduateExam = require('../models/GraduateExam');
const SUPPLIED = require('../seeders/stateExamSyllabusData');

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

  const exams = await GraduateExam.find({ governmentType: 'State' }).lean();
  const byExact = new Map(exams.map((e) => [e.examName, e]));
  const byNorm = new Map();
  for (const e of exams) byNorm.set(norm(e.examName), e);

  const report = {
    supplied: 0,
    replaced: 0,
    added: 0,
    unchanged: 0,
    unmatched: [],
    covered: new Set(),
  };

  for (const [name, syllabus] of Object.entries(SUPPLIED)) {
    report.supplied++;
    const target = byExact.get(name) || byNorm.get(norm(name));
    if (!target) {
      report.unmatched.push({ name, reason: 'no matching exam' });
      continue;
    }
    if (report.covered.has(String(target._id))) {
      report.unmatched.push({ name, reason: `duplicate target -> ${target.examName}` });
      continue;
    }
    report.covered.add(String(target._id));

    const same = JSON.stringify(target.syllabus || []) === JSON.stringify(syllabus);
    if (same) {
      report.unchanged++;
      continue;
    }
    const wasEmpty = !(target.syllabus && target.syllabus.length);
    if (!DRY) {
      await GraduateExam.updateOne({ _id: target._id }, { $set: { syllabus } });
    }
    if (wasEmpty) report.added++;
    else report.replaced++;
  }

  const uncovered = exams
    .filter((e) => !report.covered.has(String(e._id)))
    .map((e) => ({ name: e.examName, slug: e.slug, syllabusCount: (e.syllabus || []).length }));

  console.log('\n================ STATE SYLLABUS UPDATE REPORT ================');
  console.log(`Supplied exam entries processed : ${report.supplied}`);
  console.log(`Syllabuses REPLACED             : ${report.replaced}`);
  console.log(`Syllabuses ADDED (was empty)    : ${report.added}`);
  console.log(`Unchanged                       : ${report.unchanged}`);
  console.log(`Unmatched supplied entries      : ${report.unmatched.length}`);
  report.unmatched.forEach((u) => console.log(`   - "${u.name}" (${u.reason})`));
  console.log(`State exams NOT in supplied data: ${uncovered.length}`);
  uncovered.forEach((u) => console.log(`   - ${u.name} [syllabus=${u.syllabusCount}]`));
  console.log('=============================================================\n');

  if (!DRY) {
    console.log('Verifying writes...');
    let ok = 0;
    let bad = 0;
    for (const [name, syllabus] of Object.entries(SUPPLIED)) {
      const t = await GraduateExam.findOne({ governmentType: 'State', examName: name }).lean();
      if (!t) {
        bad++;
        console.log(`   MISSING after update: ${name}`);
        continue;
      }
      if (JSON.stringify(t.syllabus || []) === JSON.stringify(syllabus)) ok++;
      else {
        bad++;
        console.log(`   MISMATCH after update: ${name}`);
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

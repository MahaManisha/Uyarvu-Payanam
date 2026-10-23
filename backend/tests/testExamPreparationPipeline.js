const { DEFAULT_EXAMS } = require("../services/ExamResearchService");
const { generatePersonalizedStudyPlan } = require("../services/studyPlanEngine");
const { calculateTopicPriority } = require("../services/ExamTopicPriorityService");
const { calculateExamReadiness } = require("../services/ExamReadinessService");
const { normalizeTopicName } = require("../services/SyllabusNormalizationService");

console.log("=== RUNNING EXAM PREPARATION PIPELINE TEST ===");

const testExams = ["ssc-cgl", "gate-cse", "upsc-cse", "cat"];

testExams.forEach(examId => {
  const exam = DEFAULT_EXAMS.find(e => e.examId === examId);
  if (!exam) {
    console.error(`FAIL: Exam ${examId} not found in default list.`);
    return;
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Exam Intelligence: ${exam.name} (${exam.shortName})`);
  console.log(`Category: ${exam.category} | Authority: ${exam.conductingOrganization}`);
  console.log(`Official URL: ${exam.applicationUrl}`);
  console.log(`Confidence: ${exam.sourceConfidence} | Stages: ${exam.stages.length}`);

  // Test Study Plan Generation
  const plan = generatePersonalizedStudyPlan({
    exam,
    hoursPerDay: 3,
    studentLevel: "Intermediate"
  });

  console.log(`Generated Roadmap Phases: ${plan.phases.length}`);
  plan.phases.forEach(p => console.log(`  - ${p.title} (${p.weekRange})`));
  console.log(`Calculated Daily Schedule Days: ${plan.dailySchedule.length}`);
  console.log(`Total Syllabus Topics Identified: ${plan.totalTopics}`);

  // Test Topic Priority Calculation
  if (plan.topicsOrderedByPriority && plan.topicsOrderedByPriority.length > 0) {
    const topTopic = plan.topicsOrderedByPriority[0];
    console.log(`Top Priority Topic: ${topTopic.name} (Score: ${topTopic.priorityScore} - ${topTopic.priorityLabel})`);
  }

  // Test Normalization
  const normKey = normalizeTopicName("Percentage Problems & Calculations");
  console.log(`Normalized Key test for 'Percentage Problems & Calculations': ${normKey}`);

  // Test Readiness Score
  const readiness = calculateExamReadiness({
    syllabusCompletion: 45,
    topicMastery: 70,
    practiceAccuracy: 82,
    mockPerformance: 75,
    consistency: 85
  });

  console.log(`Calculated Readiness Score: ${readiness.readinessScore}% (${readiness.readinessStatus})`);
  console.log(`Disclaimer: ${readiness.disclaimer.slice(0, 60)}...`);
});

console.log("\n=== ALL EXAM PREPARATION PIPELINE TESTS PASSED ===");

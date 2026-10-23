/**
 * Central Feature Eligibility Engine & Dashboard Priority Engine for College Portal
 *
 * Evaluates student profile (Field, Degree, Domain, Specialization, Year, Semester, Skills, Career Goals)
 * and determines feature flags & prioritized dashboard layout.
 *
 * DO NOT scatter degree checks (e.g. if (degree === 'MBBS')) across components.
 * Centralize all rules here.
 */

/**
 * Normalizes text for robust matching
 */
const norm = (str) => (str || '').toString().toLowerCase().trim()

/**
 * Returns feature eligibility flags for a given college student profile.
 *
 * @param {Object} profile - CollegeStudentProfile object
 * @returns {Object} Eligibility map
 */
export function getCollegeFeatureEligibility(profile = {}) {
  const field = norm(profile?.field)
  const degree = norm(profile?.degreeProgramme)
  const domain = norm(profile?.domain)
  const spec = norm(profile?.specialization)
  const targetCareer = norm(profile?.targetCareer)

  const skills = (profile?.skills || []).map(s => norm(s))
  const strengths = (profile?.strengths || []).map(s => norm(s))
  const careerInterests = (profile?.careerInterests || []).map(c => norm(c))
  const academicInterests = (profile?.academicInterests || []).map(a => norm(a))

  const allInterestsAndSkills = [...skills, ...strengths, ...careerInterests, ...academicInterests, targetCareer]

  // 1. Coding Arena Eligibility
  // Primary domains: CSE, IT, AI, ML, Data Science, Software Eng, BCA, MCA, Computer Science
  const isTechDomain = [
    'computer', 'cse', 'information technology', 'software', 'ai', 'machine learning',
    'data science', 'cybersecurity', 'cloud', 'bca', 'mca', 'programming', 'robotics'
  ].some(term => field.includes(term) || degree.includes(term) || domain.includes(term) || spec.includes(term))

  // Explicit coding skills or software career interest
  const codingTerms = [
    'python', 'java', 'javascript', 'c++', 'c/c++', 'coding', 'dsa', 'data structures',
    'sql', 'react', 'node', 'full stack', 'backend', 'frontend', 'developer', 'software engineer',
    'coder', 'embedded c', 'firmware'
  ]
  const hasCodingInterestOrSkill = allInterestsAndSkills.some(item =>
    codingTerms.some(term => item.includes(term))
  )

  // Coding Arena is true if tech domain OR explicitly relevant coding skill/career goal exists
  const codingArenaEligible = isTechDomain || hasCodingInterestOrSkill

  // 2. Medical Case Discussion & Clinical Learning
  const isMedical = [
    'medical', 'health', 'mbbs', 'bds', 'nursing', 'pharmacy', 'bams', 'bhms',
    'bpt', 'clinical', 'medicine', 'dentistry'
  ].some(term => field.includes(term) || degree.includes(term) || domain.includes(term) || spec.includes(term))

  // 3. Law Case Analysis & Moot Practice
  const isLaw = [
    'law', 'legal', 'll.b', 'llb', 'll.m', 'llm', 'moot', 'judiciary', 'advocate'
  ].some(term => field.includes(term) || degree.includes(term) || domain.includes(term) || spec.includes(term))

  // 4. Business Case Practice & Management Analytics
  const isManagement = [
    'management', 'commerce', 'bba', 'b.com', 'bcom', 'mba', 'm.com', 'mcom',
    'bms', 'business', 'finance', 'marketing', 'human resource', 'accounting'
  ].some(term => field.includes(term) || degree.includes(term) || domain.includes(term) || spec.includes(term))

  // 5. Core Engineering R&D / Design Labs (AutoCAD, MATLAB, VLSI, Embedded)
  const isCoreEngineering = [
    'mechanical', 'civil', 'electrical', 'eee', 'ece', 'electronics', 'aerospace',
    'mechatronics', 'automobile', 'chemical', 'biomedical', 'production', 'instrumentation'
  ].some(term => domain.includes(term) || spec.includes(term) || degree.includes(term) || field.includes(term))

  // 6. Engineering Domain Student Check (Tech or Core Engineering degrees / fields / domains)
  const isEngineering = isTechDomain || isCoreEngineering || [
    'engineering', 'b.e', 'b.tech', 'btech', 'be', 'm.e', 'm.tech', 'mtech', 'technology', 'polytechnic'
  ].some(term => field.includes(term) || degree.includes(term) || domain.includes(term))

  return {
    focusLearning: true, // Universal
    peerLearning: true,  // Universal
    studyPlanner: true,  // Universal
    skillGap: true,      // Universal
    performanceAnalytics: true, // Universal

    // Domain specific & Community
    isEngineering,
    hackathonTeammates: true, // Universal for all college students (SIH, TNSI, college fests)
    codingArena: codingArenaEligible,
    codingChallenges: codingArenaEligible,
    technicalSkillGap: isTechDomain || isCoreEngineering || codingArenaEligible,
    medicalCaseDiscussion: isMedical,
    clinicalPlanner: isMedical,
    lawCaseAnalysis: isLaw,
    mootArgumentPractice: isLaw,
    businessCasePractice: isManagement,
    managementAnalytics: isManagement,
    engineeringDesignLab: isCoreEngineering,
    gatePreparation: isCoreEngineering || isTechDomain,
    placementPrep: true // Relevant for upper years
  }
}

/**
 * Returns prioritized dashboard widgets based on academic context & year.
 *
 * @param {Object} profile - Student profile
 * @returns {Array} List of widget objects with id, title, priority, component
 */
export function getDashboardWidgetPriority(profile = {}) {
  const flags = getCollegeFeatureEligibility(profile)
  const isEngineering = flags.isEngineering
  const yearStr = norm(profile?.currentYear)
  const isFirstYear = yearStr.includes('1') || yearStr.includes('first')
  const isFinalYear = yearStr.includes('4') || yearStr.includes('final') || (yearStr.includes('3') && norm(profile?.degreeProgramme).includes('bca'))

  const widgets = [
    {
      id: 'focus-learning',
      title: 'Focus Learning Session',
      subtitle: 'Distraction-free active study session with tab monitoring',
      category: 'academic',
      priority: 100,
      badge: 'Active Study',
      to: '/college/academic/focus'
    },
    {
      id: 'study-planner',
      title: 'Today\'s Study Plan',
      subtitle: 'Targeted daily topics & upcoming exam schedules',
      category: 'academic',
      priority: 95,
      to: '/college/academic/planner'
    },
    {
      id: 'peer-learning',
      title: 'Peer Learning Network',
      subtitle: 'Connect with peers to Learn Together or exchange skills',
      category: 'community',
      priority: 90,
      badge: 'Skill Match',
      to: '/college/community/mentors'
    },
    {
      id: 'hackathon-teammates',
      title: 'Hackathon Teammate Finder',
      subtitle: 'Find complementary peers for SIH, Mini Projects & Tech Fests',
      category: 'community',
      priority: isEngineering ? 97 : 88,
      badge: 'Squad Finder',
      to: '/college/teammate-matchmaker'
    }
  ]

  if (flags.codingArena) {
    widgets.push({
      id: 'coding-arena',
      title: 'Coding Arena & 1v1 Challenges',
      subtitle: 'DSA practice, peer competitions, & domain problem solving',
      category: 'coding',
      priority: isFinalYear ? 98 : 92,
      badge: 'Live Competition',
      to: '/college/career/coding-arena'
    })
  }

  if (flags.medicalCaseDiscussion) {
    widgets.push({
      id: 'medical-case-discussion',
      title: 'Clinical Case Analysis & Discussions',
      subtitle: 'Diagnose clinical scenarios & discuss with medical peers',
      category: 'medical',
      priority: 96,
      badge: 'Clinical Care',
      to: '/college/community/doubts?tab=clinical'
    })
  }

  if (flags.lawCaseAnalysis) {
    widgets.push({
      id: 'law-case-analysis',
      title: 'Legal Case Reasoning & Moot Practice',
      subtitle: 'Analyze landmark cases, statutory interpretations & arguments',
      category: 'law',
      priority: 96,
      badge: 'Jurisprudence',
      to: '/college/study-tools/practice?subject=Law'
    })
  }

  if (flags.businessCasePractice) {
    widgets.push({
      id: 'business-case-practice',
      title: 'Business Case & Analytics Practice',
      subtitle: 'Solve real-world market problems & strategy frameworks',
      category: 'management',
      priority: 94,
      badge: 'Strategy',
      to: '/college/study-tools/practice?subject=Management'
    })
  }

  // Add Career / Skill Gap
  if (isFinalYear) {
    widgets.push({
      id: 'placement-prep',
      title: 'Placement Readiness & Mock Interviews',
      subtitle: 'Company prep, interview simulations & technical gap analysis',
      category: 'career',
      priority: 99,
      badge: 'Career Target',
      to: '/college/career/interview-prep'
    })
  } else {
    widgets.push({
      id: 'skill-gap',
      title: 'Domain Skill Gap Analysis',
      subtitle: 'Benchmark your current skills against target industry requirements',
      category: 'career',
      priority: 85,
      to: '/college/career/skill-gap'
    })
  }

  widgets.push({
    id: 'ai-advisor',
    title: 'Ask AI Academic Advisor',
    subtitle: 'Instant guidance on domain subjects, doubts & career pathing',
    category: 'ai',
    priority: 80,
    to: '/college/advisor/chat'
  })

  // Sort descending by priority
  return widgets.sort((a, b) => b.priority - a.priority)
}

/**
 * Computes Peer Match compatibility score (%) & category between two profiles.
 *
 * @param {Object} myProfile - Current user profile
 * @param {Object} peerProfile - Target peer profile
 * @returns {Object} { matchScore, category, categoryLabel, explanation, sharedTopics }
 */
export function calculatePeerCompatibility(myProfile = {}, peerProfile = {}) {
  let score = 50 // baseline match

  const myField = norm(myProfile?.field)
  const peerField = norm(peerProfile?.field)
  const myDomain = norm(myProfile?.domain || myProfile?.specialization)
  const peerDomain = norm(peerProfile?.domain || peerProfile?.specialization)
  const myYear = norm(myProfile?.currentYear)
  const peerYear = norm(peerProfile?.currentYear)

  const mySkills = (myProfile?.skills || []).map(s => norm(s))
  const peerSkills = (peerProfile?.skills || []).map(s => norm(s))
  const myStrengths = (myProfile?.strengths || []).map(s => norm(s))
  const peerStrengths = (peerProfile?.strengths || []).map(s => norm(s))
  const myNeeds = (myProfile?.onboardingBaseline?.areasToStrengthen || []).map(s => norm(s))
  const peerNeeds = (peerProfile?.onboardingBaseline?.areasToStrengthen || []).map(s => norm(s))

  // 1. Academic Similarity (up to +25)
  if (myField && peerField && myField === peerField) score += 15
  if (myDomain && peerDomain && (myDomain.includes(peerDomain) || peerDomain.includes(myDomain))) score += 10

  // 2. Year Similarity (up to +10)
  if (myYear && peerYear && myYear === peerYear) score += 10

  // 3. Complementarity & Skill Exchange Check
  const peerCanHelpMe = myNeeds.some(need => peerStrengths.includes(need) || peerSkills.includes(need))
  const iCanHelpPeer = peerNeeds.some(need => myStrengths.includes(need) || mySkills.includes(need))

  const sharedSkills = mySkills.filter(s => peerSkills.includes(s))

  let category = 'learnTogether'
  let categoryLabel = 'Learn Together'
  let explanation = `Same ${myDomain || 'academic'} domain • Both in ${myYear || 'college'}`

  if (peerCanHelpMe && iCanHelpPeer) {
    category = 'skillExchange'
    categoryLabel = 'Mutual Skill Exchange'
    score += 25
    explanation = `High Value Exchange: Perfect mutual match between your weak & strong topics`
  } else if (peerCanHelpMe) {
    category = 'askForHelp'
    categoryLabel = 'Can Help You'
    score += 20
    explanation = `Strong in topics you're currently strengthening`
  } else if (iCanHelpPeer) {
    category = 'youCanHelp'
    categoryLabel = 'You Can Help'
    score += 15
    explanation = `You have expertise in topics this peer is developing`
  } else if (sharedSkills.length > 0) {
    score += 15
    explanation = `Shared skills in ${sharedSkills.slice(0, 2).join(', ')}`
  }

  // Cap score between 65% and 99% for display realism
  const finalScore = Math.min(99, Math.max(65, Math.round(score)))

  return {
    matchScore: finalScore,
    category,
    categoryLabel,
    explanation,
    sharedTopics: sharedSkills
  }
}

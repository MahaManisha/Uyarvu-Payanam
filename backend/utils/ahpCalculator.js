/**
 * Analytic Hierarchy Process (AHP) Deterministic Calculator
 *
 * Implements standard AHP matrix normalization, priority weight vector calculation,
 * principal eigenvalue (λmax) estimation, Consistency Index (CI), and Consistency Ratio (CR).
 */

const RANDOM_INDEX = {
  1: 0.0,
  2: 0.0,
  3: 0.58,
  4: 0.90,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49
};

// Career domains dictionary grouped by Step 4 core domain branch & specializations
const CAREER_TAXONOMY = {
  cse: [
    { id: "ai_ml", name: "AI & Machine Learning", category: "AI & Data Science", icon: "FiCpu", description: "Build intelligent systems, neural networks, and predictive models." },
    { id: "data_science", name: "Data Science & Big Data", category: "AI & Data Science", icon: "FiActivity", description: "Extract actionable insights from massive datasets using analytics & statistics." },
    { id: "software_engineering", name: "Full Stack & Software Engineering", category: "Software Development", icon: "FiBriefcase", description: "Design scalable Web & Mobile applications and enterprise software architecture." },
    { id: "cyber_security", name: "Cyber Security & Ethical Hacking", category: "Security & Systems", icon: "FiShield", description: "Protect networks, applications, and infrastructure from cyber threats." },
    { id: "cloud_devops", name: "Cloud Computing & DevOps", category: "Infrastructure", icon: "FiGlobe", description: "Automate CI/CD pipelines and orchestrate cloud infrastructure on AWS/GCP/Azure." },
    { id: "data_engineering", name: "Data Engineering & Analytics", category: "AI & Data Science", icon: "FiZap", description: "Construct data pipelines, data warehouses, and ETL streaming infrastructure." },
    { id: "systems_iot", name: "Systems Programming & IoT", category: "Core Software", icon: "FiRadio", description: "Develop low-level C/C++ operating system drivers and IoT firmware." }
  ],
  it: [
    { id: "ai_ml", name: "AI & Machine Learning", category: "AI & Data Science", icon: "FiCpu", description: "Build intelligent systems, neural networks, and predictive models." },
    { id: "data_science", name: "Data Science & Big Data", category: "AI & Data Science", icon: "FiActivity", description: "Extract actionable insights from massive datasets using analytics & statistics." },
    { id: "software_engineering", name: "Full Stack & Software Engineering", category: "Software Development", icon: "FiBriefcase", description: "Design scalable Web & Mobile applications and enterprise software architecture." },
    { id: "cyber_security", name: "Cyber Security & Ethical Hacking", category: "Security & Systems", icon: "FiShield", description: "Protect networks, applications, and infrastructure from cyber threats." },
    { id: "cloud_devops", name: "Cloud Computing & DevOps", category: "Infrastructure", icon: "FiGlobe", description: "Automate CI/CD pipelines and orchestrate cloud infrastructure on AWS/GCP/Azure." },
    { id: "data_engineering", name: "Data Engineering & Analytics", category: "AI & Data Science", icon: "FiZap", description: "Construct data pipelines, data warehouses, and ETL streaming infrastructure." },
    { id: "systems_iot", name: "Systems Programming & IoT", category: "Core Software", icon: "FiRadio", description: "Develop low-level C/C++ operating system drivers and IoT firmware." }
  ],
  aids: [
    { id: "ai_ml", name: "AI & Machine Learning", category: "AI & Data Science", icon: "FiCpu", description: "Build intelligent systems, neural networks, and predictive models." },
    { id: "data_science", name: "Data Science & Big Data", category: "AI & Data Science", icon: "FiActivity", description: "Extract actionable insights from massive datasets using analytics & statistics." },
    { id: "software_engineering", name: "Full Stack & Software Engineering", category: "Software Development", icon: "FiBriefcase", description: "Design scalable Web & Mobile applications and enterprise software architecture." },
    { id: "cyber_security", name: "Cyber Security & Ethical Hacking", category: "Security & Systems", icon: "FiShield", description: "Protect networks, applications, and infrastructure from cyber threats." },
    { id: "cloud_devops", name: "Cloud Computing & DevOps", category: "Infrastructure", icon: "FiGlobe", description: "Automate CI/CD pipelines and orchestrate cloud infrastructure on AWS/GCP/Azure." },
    { id: "data_engineering", name: "Data Engineering & Analytics", category: "AI & Data Science", icon: "FiZap", description: "Construct data pipelines, data warehouses, and ETL streaming infrastructure." },
    { id: "systems_iot", name: "Systems Programming & IoT", category: "Core Software", icon: "FiRadio", description: "Develop low-level C/C++ operating system drivers and IoT firmware." }
  ],
  ece: [
    { id: "vlsi_chip_design", name: "VLSI & Chip Design", category: "Semiconductors & Chip Design", icon: "FiCpu", description: "Design integrated circuits, gate-level netlists, CMOS logic, and ASIC/FPGA semiconductor chips." },
    { id: "embedded_systems", name: "Embedded Systems", category: "Hardware & Firmware", icon: "FiRadio", description: "Program microcontrollers, bare-metal C, RTOS task schedulers, and embedded hardware interfaces." },
    { id: "iot", name: "IoT", category: "Internet of Things", icon: "FiGlobe", description: "Architect interconnected smart edge sensor nodes, MQTT telemetry brokers, and low-power IoT networks." },
    { id: "communication_telecom", name: "Communication / Telecom", category: "Telecommunications & Networks", icon: "FiRadio", description: "Engineer 5G/6G cellular links, OFDM modulation, base stations, and digital telecommunication systems." },
    { id: "rf_microwave", name: "RF & Microwave", category: "Electromagnetics & RF", icon: "FiRadio", description: "Design RF transmission lines, waveguides, impedance matching networks, Smith charts, and radar front-ends." },
    { id: "signal_processing", name: "Signal Processing", category: "Signals & Systems", icon: "FiActivity", description: "Formulate DSP filters (FIR/IIR), Fourier transforms, Nyquist sampling, and digital audio/sensor analysis." },
    { id: "image_processing_cv", name: "Image Processing / Computer Vision", category: "Computer Vision & AI", icon: "FiCpu", description: "Build spatial convolution kernels, OpenCV image analysis, object detection, and CNN vision models." },
    { id: "automation_control", name: "Automation & Control", category: "Control Systems & Instrumentation", icon: "FiZap", description: "Program industrial PLCs, closed-loop PID controllers, state-space models, and automation feedback loops." },
    { id: "robotics", name: "Robotics", category: "Robotics & Automation", icon: "FiZap", description: "Engineer robotic kinematics, Jacobian dynamics, ROS middleware, SLAM, and autonomous path planning." },
    { id: "hardware_pcb_design", name: "Hardware / PCB Design", category: "Hardware & Circuit Design", icon: "FiCpu", description: "Layout multi-layer PCBs, controlled impedance traces, DRC validation, decoupling, and high-speed signal integrity." },
    { id: "automotive_electronics", name: "Automotive Electronics", category: "Automotive Systems", icon: "FiBriefcase", description: "Develop vehicle ECUs, CAN/LIN automotive buses, ADAS active safety, and ISO 26262 functional safety." },
    { id: "power_electronics", name: "Power Electronics", category: "Power Systems & Energy", icon: "FiSun", description: "Engineer DC-DC converters (buck/boost/flyback), inverters, soft switching, and battery power systems." },
    { id: "medical_electronics", name: "Medical Electronics", category: "Biomedical & Healthcare", icon: "FiActivity", description: "Design ECG acquisition circuits, high CMRR instrumentation amplifiers, medical safety isolation, and bio-sensors." },
    { id: "satellite_aerospace_avionics", name: "Satellite / Aerospace / Avionics", category: "Aerospace & Avionics", icon: "FiGlobe", description: "Engineer satellite transponders, link margins, attitude control wheels, inertial navigation, and avionics." },
    { id: "semiconductor_testing", name: "Semiconductor Testing", category: "Testing & Quality Assurance", icon: "FiCheckCircle", description: "Formulate ATE test programs, scan chains, stuck-at fault models, ATPG, BIST, and silicon wafer yield testing." },
    { id: "aiml_ece", name: "AI / ML for ECE", category: "Edge AI & Embedded Intelligence", icon: "FiCpu", description: "Deploy quantized neural networks, Edge AI inference, confusion matrix analysis, and embedded machine learning." },
    { id: "software_it", name: "Software / IT", category: "Software Engineering & IT", icon: "FiBriefcase", description: "Build robust REST APIs, SQL database indexing, Docker containers, asynchronous event systems, and web apps." }
  ],
  eee: [
    { id: "power_systems", name: "Power Systems & Smart Grid Engineer", category: "Electrical Power", icon: "FiSun", description: "Design, monitor, and optimize high-voltage power transmission and smart grids." },
    { id: "renewable_energy", name: "Renewable & Clean Energy Tech", category: "Sustainability", icon: "FiSun", description: "Engineer solar, wind, and sustainable power generation systems." },
    { id: "ev_powertrain", name: "Electric Vehicle Powertrain & Battery Tech", category: "Automotive Tech", icon: "FiZap", description: "Develop battery management systems (BMS) and electric motor drives for EVs." },
    { id: "control_automation", name: "Industrial Automation & Control Systems", category: "Automation", icon: "FiCpu", description: "Program PLCs, SCADA systems, and industrial automation equipment." },
    { id: "power_electronics", name: "Power Electronics & Circuit Design", category: "Electronics", icon: "FiRadio", description: "Design DC-DC converters, inverters, and power management ICs." }
  ],
  mechanical: [
    { id: "cad_product_design", name: "CAD / CAM & Product Design Engineer", category: "Design & Manufacturing", icon: "FiBriefcase", description: "Design mechanical components using 3D CAD, SolidWorks, and rapid prototyping." },
    { id: "automotive_ev", name: "Automotive & EV System Design", category: "Automotive Engineering", icon: "FiZap", description: "Engineer vehicle chassis, thermal management, and electric vehicle dynamics." },
    { id: "robotics_mechatronics", name: "Robotics & Mechatronic Systems", category: "Automation", icon: "FiCpu", description: "Integrate mechanical structures with electronic controllers and actuators." },
    { id: "thermal_fluid", name: "Thermal & Fluid Dynamics Specialist", category: "Thermodynamics", icon: "FiSun", description: "Analyze heat transfer, HVAC systems, and Computational Fluid Dynamics (CFD)." },
    { id: "smart_manufacturing", name: "Industry 4.0 & Smart Manufacturing", category: "Manufacturing", icon: "FiGlobe", description: "Optimize automated manufacturing lines, CNC programming, and quality control." }
  ],
  civil: [
    { id: "structural_eng", name: "Structural & Earthquake Engineering", category: "Structures", icon: "FiHome", description: "Design earthquake-resistant buildings, bridges, and heavy infrastructure." },
    { id: "construction_mgmt", name: "Construction Project Management & BIM", category: "Management", icon: "FiBriefcase", description: "Manage large construction projects using Building Information Modeling (BIM)." },
    { id: "environmental_eng", name: "Environmental & Water Resources", category: "Environment", icon: "FiSun", description: "Engineer water treatment plants, waste management, and environmental sustainability." },
    { id: "transportation_eng", name: "Transportation & Highway Engineering", category: "Infrastructure", icon: "FiGlobe", description: "Plan highways, traffic networks, and urban transport infrastructure." },
    { id: "urban_planning", name: "Urban Planning & GIS Spatial Analysis", category: "Planning", icon: "FiActivity", description: "Analyze geospatial data for smart city master planning and GIS development." }
  ],
  chemical: [
    { id: "process_eng", name: "Process & Chemical Plant Engineer", category: "Chemical Processing", icon: "FiActivity", description: "Design chemical reactors, separation processes, and industrial plant operations." },
    { id: "bioprocess_tech", name: "Bioprocess & Pharmaceutical Tech", category: "Biotechnology", icon: "FiHeart", description: "Develop biopharmaceuticals, vaccine manufacturing, and bioprocess technology." },
    { id: "bioinformatics", name: "Bioinformatics & Computational Biology", category: "Bio-IT", icon: "FiCpu", description: "Analyze genomic sequences and biological data using computational algorithms." },
    { id: "materials_nano", name: "Materials Science & Nanotechnology", category: "Advanced Materials", icon: "FiFeather", description: "Synthesize novel nanomaterials, polymers, and advanced catalysts." }
  ],
  mechatronics: [
    { id: "robotics_automation", name: "Robotics Systems Integrator", category: "Robotics", icon: "FiCpu", description: "Design and program industrial robots, cobots, and automated assembly lines." },
    { id: "embedded_systems", name: "Embedded Hardware & Firmware", category: "Hardware", icon: "FiRadio", description: "Develop hardware interfaces, sensors, and firmware for mechatronic products." },
    { id: "autonomous_agv", name: "Autonomous Systems & AGVs", category: "Autonomous Vehicles", icon: "FiZap", description: "Develop navigation, obstacle avoidance, and sensor fusion for mobile robots." },
    { id: "control_sensors", name: "Control Systems & Sensor Fusion", category: "Controls", icon: "FiActivity", description: "Design feedback control loops and multi-sensor data fusion algorithms." }
  ]
};

// Default fallback career domains if branch is general or unmapped
const DEFAULT_CAREER_DOMAINS = [
  { id: "software_eng", name: "Software Engineering & Architecture", category: "Software", icon: "FiBriefcase", description: "Design scalable software applications and system architecture." },
  { id: "ai_data", name: "Artificial Intelligence & Data Science", category: "AI & Analytics", icon: "FiCpu", description: "Build intelligent machine learning models and data analytics." },
  { id: "cloud_cyber", name: "Cloud Computing & Cybersecurity", category: "Infrastructure", icon: "FiShield", description: "Secure digital infrastructure and manage cloud deployments." },
  { id: "management_tech", name: "Tech Management & Product Operations", category: "Management", icon: "FiGlobe", description: "Lead technical teams, product strategy, and agile operations." },
  { id: "r_and_d", name: "Research & Development Specialist", category: "Research", icon: "FiFeather", description: "Conduct innovative academic and industrial research projects." }
];

const BRANCH_ALIAS_MAP = {
  "computer science": "cse",
  "computer science & engineering": "cse",
  "computer science and engineering": "cse",
  "cse": "cse",
  "information technology": "it",
  "it": "it",
  "artificial intelligence": "aids",
  "artificial intelligence & data science": "aids",
  "artificial intelligence and data science": "aids",
  "ai & data science": "aids",
  "aids": "aids",
  "electronics & communication": "ece",
  "electronics & communication engineering": "ece",
  "electronics and communication engineering": "ece",
  "ece": "ece",
  "electrical & electronics": "eee",
  "electrical & electronics engineering": "eee",
  "electrical and electronics engineering": "eee",
  "eee": "eee",
  "mechanical engineering": "mechanical",
  "mechanical": "mechanical",
  "civil engineering": "civil",
  "civil": "civil",
  "chemical engineering": "chemical",
  "chemical": "chemical",
  "mechatronics engineering": "mechatronics",
  "mechatronics": "mechatronics"
};

function resolveBranchId(branchId = "cse") {
  if (!branchId) return "cse";
  const str = branchId.toLowerCase().trim();

  if (str.includes("cse") || str.includes("computer science")) return "cse";
  if (str.includes("ai & ds") || str.includes("artificial intelligence") || str.includes("aids")) return "aids";
  if (str.includes("it (") || str === "it" || str.includes("information technology")) return "it";
  if (str.includes("ece") || str.includes("electronics")) return "ece";
  if (str.includes("eee") || str.includes("electrical")) return "eee";
  if (str.includes("mechanical")) return "mechanical";
  if (str.includes("civil")) return "civil";
  if (str.includes("chemical") || str.includes("biotech")) return "chemical";
  if (str.includes("mechatronic") || str.includes("robotic")) return "mechatronics";

  return BRANCH_ALIAS_MAP[str] || "cse";
}

const SPEC_TO_DOMAIN_ID_MAP = {
  // CSE / IT / AIDS
  "software engineering": ["software_engineering", "fullstack_web"],
  "full stack": ["software_engineering", "fullstack_web"],
  "mobile development": ["software_engineering"],
  "artificial intelligence": ["ai_ml", "ai_scientist"],
  "machine learning": ["ai_ml", "ai_scientist"],
  "cyber security": ["cyber_security", "cyber_defense"],
  "ethical hacking": ["cyber_security"],
  "cybersecurity": ["cyber_security", "cyber_defense"],
  "data science": ["data_science", "business_analyst"],
  "big data": ["data_science", "data_engineer", "database_admin"],
  "cloud computing": ["cloud_devops", "cloud_architecture"],
  "devops": ["cloud_devops", "cloud_architecture"],
  "cloud systems": ["cloud_devops", "cloud_architecture"],
  "system programming": ["systems_iot"],
  "algorithms": ["systems_iot"],
  "data engineering": ["data_engineering", "data_engineer"],
  "database administration": ["database_admin"],
  "nlp": ["deep_learning"],
  "natural language": ["deep_learning"],
  "computer vision": ["deep_learning"],
  "generative ai": ["ai_scientist"],
  "llm": ["ai_scientist"],
  "business intelligence": ["business_analyst"],
  "predictive modeling": ["business_analyst"],

  // ECE / EEE
  "vlsi": ["vlsi_design"],
  "semiconductor": ["vlsi_design"],
  "embedded": ["embedded_iot", "firmware_dev", "embedded_systems"],
  "microcontrollers": ["embedded_iot", "firmware_dev"],
  "wireless": ["signal_processing"],
  "5g": ["signal_processing"],
  "signal processing": ["signal_processing"],
  "rf & microwave": ["signal_processing"],
  "power systems": ["power_systems"],
  "renewable": ["renewable_energy"],
  "solar": ["renewable_energy"],
  "electric vehicle": ["ev_powertrain", "automotive_ev"],
  "ev technology": ["ev_powertrain", "automotive_ev"],
  "control systems": ["control_automation", "control_sensors"],
  "power electronics": ["power_electronics"],

  // Mechanical / Civil / Chemical / Mechatronics
  "cad": ["cad_product_design"],
  "product design": ["cad_product_design"],
  "robotics": ["robotics_mechatronics", "robotics_automation"],
  "mechatronics": ["robotics_mechatronics"],
  "thermal": ["thermal_fluid"],
  "fluid": ["thermal_fluid"],
  "automotive": ["automotive_ev"],
  "manufacturing": ["smart_manufacturing"],
  "structural": ["structural_eng"],
  "urban planning": ["urban_planning"],
  "environmental": ["environmental_eng"],
  "transportation": ["transportation_eng"],
  "construction": ["construction_mgmt"],
  "process": ["process_eng"],
  "bioprocess": ["bioprocess_tech"],
  "genetic": ["bioprocess_tech"],
  "nanotechnology": ["materials_nano"],
  "pharmaceutical": ["bioprocess_tech"],
  "autonomous": ["autonomous_agv"],
  "drones": ["autonomous_agv"]
};

const { resolveCandidateDomains } = require("../config/domainMappingConfig");

/**
 * Returns candidate career domains strictly resolved from Step 4 specializations & branch
 */
function getCandidateDomainsForBranch(branchId = "cse", selectedSpecializations = []) {
  return resolveCandidateDomains(branchId, selectedSpecializations);
}

/**
 * Constructs an n x n pairwise comparison matrix A
 * @param {Array<String>} domainIds - Array of candidate domain IDs
 * @param {Array<Object>} comparisons - Array of { domainA, domainB, selectedDomain, intensity }
 */
function buildAhpMatrix(domainIds = [], comparisons = []) {
  const n = domainIds.length;
  if (n === 0) return [];

  // Initialize n x n matrix with 1s on diagonal
  const matrix = Array.from({ length: n }, () => Array(n).fill(1.0));

  const indexMap = new Map();
  domainIds.forEach((id, idx) => indexMap.set(id, idx));

  comparisons.forEach(comp => {
    const i = indexMap.get(comp.domainA);
    const j = indexMap.get(comp.domainB);

    if (i !== undefined && j !== undefined && i !== j) {
      let v = Number(comp.intensity) || 3;
      if (v < 1) v = 1;

      if (comp.selectedDomain === comp.domainA) {
        matrix[i][j] = v;
        matrix[j][i] = 1 / v;
      } else if (comp.selectedDomain === comp.domainB) {
        matrix[j][i] = v;
        matrix[i][j] = 1 / v;
      } else {
        matrix[i][j] = 1.0;
        matrix[j][i] = 1.0;
      }
    }
  });

  return matrix;
}

/**
 * Calculates normalized priority weights from an n x n matrix
 * 1. Column sums
 * 2. Matrix element / Column sum
 * 3. Average of normalized row elements
 * 4. Normalize weight sum to 1.0
 */
function calculatePriorityVector(matrix = []) {
  const n = matrix.length;
  if (n === 0) return [];

  // 1. Column sums
  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      colSums[j] += matrix[i][j];
    }
  }

  // 2 & 3. Normalize matrix and compute row averages
  const weights = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let rowSumNorm = 0;
    for (let j = 0; j < n; j++) {
      const normVal = colSums[j] > 0 ? matrix[i][j] / colSums[j] : 1 / n;
      rowSumNorm += normVal;
    }
    weights[i] = rowSumNorm / n;
  }

  // 4. Ensure sum(weights) = 1.0
  const totalW = weights.reduce((a, b) => a + b, 0) || 1.0;
  return weights.map(w => w / totalW);
}

/**
 * Calculates Consistency Index (CI), λmax, and Consistency Ratio (CR)
 */
function calculateConsistencyRatio(matrix = [], priorityWeights = []) {
  const n = matrix.length;
  if (n <= 2) {
    return {
      lambdaMax: n,
      consistencyIndex: 0.0,
      consistencyRatio: 0.0,
      consistencyStatus: "Acceptable",
      isConsistent: true
    };
  }

  // 1. Weighted Sum Vector W = A * w
  const weightedSum = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      weightedSum[i] += matrix[i][j] * priorityWeights[j];
    }
  }

  // 2. Consistency Vector c_i = W_i / w_i
  const consistencyVector = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    consistencyVector[i] = priorityWeights[i] > 0 ? weightedSum[i] / priorityWeights[i] : n;
  }

  // 3. λmax = mean(c_i)
  const lambdaMax = consistencyVector.reduce((a, b) => a + b, 0) / n;

  // 4. CI = (λmax - n) / (n - 1)
  const CI = (lambdaMax - n) / (n - 1);

  // 5. CR = CI / RI
  const RI = RANDOM_INDEX[n] || 1.49;
  const CR = RI > 0 ? CI / RI : 0.0;

  const isConsistent = CR <= 0.10;
  const consistencyStatus = isConsistent ? "Acceptable" : "Inconsistent";

  return {
    lambdaMax: Number(lambdaMax.toFixed(4)),
    consistencyIndex: Number(Math.max(0, CI).toFixed(4)),
    consistencyRatio: Number(Math.max(0, CR).toFixed(4)),
    consistencyStatus,
    isConsistent
  };
}

/**
 * Complete AHP Engine Calculation
 */
function computeAhpEngine({ candidateDomains = [], pairwiseComparisons = [] }) {
  const domainIds = candidateDomains.map(d => d.id);
  const matrix = buildAhpMatrix(domainIds, pairwiseComparisons);
  const weights = calculatePriorityVector(matrix);
  const consistency = calculateConsistencyRatio(matrix, weights);

  // Map priority weights back to domain details
  const priorityWeightsMap = {};
  const rankedDomains = candidateDomains.map((domain, idx) => {
    const weight = weights[idx] || 0;
    const scorePercent = Number((weight * 100).toFixed(1));
    priorityWeightsMap[domain.id] = Number(weight.toFixed(4));
    return {
      ...domain,
      weight: Number(weight.toFixed(4)),
      scorePercent
    };
  }).sort((a, b) => b.weight - a.weight);

  const topDomain = rankedDomains[0] || null;
  const secondDomain = rankedDomains[1] || null;
  const thirdDomain = rankedDomains[2] || null;

  const candidateDomainsForStep6 = [topDomain, secondDomain, thirdDomain].filter(Boolean);

  return {
    success: true,
    candidateDomains,
    pairwiseComparisons,
    ahpMatrix: matrix,
    priorityWeights: priorityWeightsMap,
    consistencyIndex: consistency.consistencyIndex,
    consistencyRatio: consistency.consistencyRatio,
    consistencyStatus: consistency.consistencyStatus,
    isConsistent: consistency.isConsistent,
    lambdaMax: consistency.lambdaMax,
    rankedDomains,
    topDomain,
    secondDomain,
    thirdDomain,
    candidateDomainsForStep6
  };
}

// ── Fuzzy Career Relevance Filter ────────────────────────────────────────────
// Maps keywords from student profile (careerInterests & skills) to domain IDs
const CAREER_INTEREST_TO_DOMAIN = {
  "software engineering": ["software_engineering"],
  "software": ["software_engineering", "full_stack"],
  "programming": ["software_engineering", "algorithms_systems", "full_stack", "ai_ml"],
  "web": ["full_stack"],
  "mobile": ["full_stack"],
  "ai": ["ai_ml"],
  "machine learning": ["ai_ml"],
  "artificial intelligence": ["ai_ml"],
  "data": ["data_science", "data_engineering"],
  "analytics": ["data_science"],
  "cyber": ["cyber_security"],
  "security": ["cyber_security"],
  "hacking": ["cyber_security"],
  "cloud": ["cloud_devops"],
  "devops": ["cloud_devops"],
  "algorithms": ["algorithms_systems"],
  "system programming": ["algorithms_systems"],
  "embedded": ["embedded_iot", "systems_iot"],
  "iot": ["embedded_iot"],
  "vlsi": ["vlsi_design"],
  "chip": ["vlsi_design"],
  "robotics": ["robotics_automation"],
  "automation": ["robotics_automation"],
  "electric vehicle": ["ev_powertrain"],
  "power": ["ev_powertrain"],
  "cad": ["cad_structural"],
  "structural": ["cad_structural"],
  "problem solving": ["ai_ml", "software_engineering", "data_science"],
  "python": ["ai_ml", "data_science", "software_engineering"],
  "java": ["software_engineering", "full_stack"],
  "react": ["full_stack"],
  "node": ["full_stack"],
  "sql": ["data_science"],
  "mathematics": ["ai_ml", "data_science", "algorithms_systems"],
  "statistics": ["data_science"],
  "networking": ["cyber_security", "cloud_devops"],
  "ui": ["full_stack"],
  "ux": ["full_stack"],
  "design": ["full_stack"],
};

/**
 * Scores each candidate domain against the student's career interests & skills
 * using fuzzy keyword matching. Reorders candidates by relevance while preserving
 * minimum coverage from branch defaults.
 *
 * @param {Array} candidateDomains - Base domain objects from getCandidateDomainsForBranch
 * @param {Array} careerInterests  - Student's careerInterests strings
 * @param {Array} skills           - Student's skills strings
 * @returns {Array} - Reordered and potentially filtered candidateDomains
 */
function filterCandidatesWithFuzzyRelevance(candidateDomains = [], careerInterests = [], skills = []) {
  // No context available — return base candidates unchanged
  if (careerInterests.length === 0 && skills.length === 0) {
    return candidateDomains;
  }

  const allContext = [...careerInterests, ...skills].map(s => s.toLowerCase());

  // Score each candidate domain
  const scored = candidateDomains.map(domain => {
    let relevanceScore = 0;
    const domainKey = domain.id || "";
    const domainName = (domain.name || "").toLowerCase();
    const domainCategory = (domain.category || "").toLowerCase();

    allContext.forEach(contextStr => {
      // Check keyword dictionary
      Object.entries(CAREER_INTEREST_TO_DOMAIN).forEach(([keyword, mappedDomains]) => {
        if (contextStr.includes(keyword) || keyword.includes(contextStr)) {
          if (mappedDomains.includes(domainKey)) {
            relevanceScore += 1.0;
          }
        }
      });
      // Direct domain name / category match
      if (domainName.includes(contextStr) || contextStr.includes(domainName.split(" ")[0])) {
        relevanceScore += 0.5;
      }
      if (domainCategory.includes(contextStr)) {
        relevanceScore += 0.3;
      }
    });

    return { domain, relevanceScore };
  });

  // Sort by relevance (highest first) but preserve all candidates
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Return top 5 (already capped from getCandidateDomainsForBranch) sorted by relevance
  return scored.map(s => s.domain);
}

module.exports = {
  CAREER_TAXONOMY,
  DEFAULT_CAREER_DOMAINS,
  getCandidateDomainsForBranch,
  buildAhpMatrix,
  calculatePriorityVector,
  calculateConsistencyRatio,
  computeAhpEngine,
  filterCandidatesWithFuzzyRelevance
};

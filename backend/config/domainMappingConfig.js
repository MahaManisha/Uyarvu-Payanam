/**
 * Centralized Domain Mapping & Taxonomy Configuration
 * Maps Step 4 specializations & core branches to normalized career domain IDs.
 */

const NORMALIZED_DOMAINS = {
  software_engineering: {
    id: "software_engineering",
    name: "Software Engineering & Architecture",
    category: "Software Engineering",
    icon: "FiBriefcase",
    description: "Architect scalable software applications, enterprise design patterns, and microservices."
  },
  ai_ml: {
    id: "ai_ml",
    name: "Artificial Intelligence & Machine Learning",
    category: "AI & Data Science",
    icon: "FiCpu",
    description: "Build intelligent neural networks, autonomous agents, and predictive machine learning models."
  },
  cyber_security: {
    id: "cyber_security",
    name: "Cyber Security & Ethical Hacking",
    category: "Security & Systems",
    icon: "FiShield",
    description: "Protect networks, cloud infrastructure, and software applications from cyber threats."
  },
  full_stack: {
    id: "full_stack",
    name: "Full Stack Web & Mobile Development",
    category: "Software Engineering",
    icon: "FiGlobe",
    description: "Architect scalable web applications, REST APIs, microservices, and mobile platforms."
  },
  data_science: {
    id: "data_science",
    name: "Data Science & Big Data Analytics",
    category: "AI & Data Science",
    icon: "FiActivity",
    description: "Extract actionable insights from massive datasets using statistics, pandas, and data mining."
  },
  cloud_devops: {
    id: "cloud_devops",
    name: "Cloud Computing & DevOps",
    category: "Infrastructure",
    icon: "FiGlobe",
    description: "Automate CI/CD pipelines, container orchestration, and cloud infrastructure on AWS/GCP/Azure."
  },
  algorithms_systems: {
    id: "algorithms_systems",
    name: "Algorithms & System Programming",
    category: "Core Computer Science",
    icon: "FiRadio",
    description: "Design high-performance algorithms, data structures, operating systems, and system drivers."
  },
  embedded_iot: {
    id: "embedded_iot",
    name: "Embedded Systems & IoT",
    category: "Hardware & Firmware",
    icon: "FiRadio",
    description: "Program microcontrollers, real-time operating systems (RTOS), and IoT sensor networks."
  },
  vlsi_design: {
    id: "vlsi_design",
    name: "VLSI & Chip Design",
    category: "Semiconductors",
    icon: "FiCpu",
    description: "Design integrated circuits, microprocessors, and FPGA semiconductor systems."
  },
  robotics_automation: {
    id: "robotics_automation",
    name: "Robotics & Automation Engineering",
    category: "Robotics",
    icon: "FiZap",
    description: "Integrate sensors, actuators, kinematics, and control systems for industrial robotics."
  },
  ev_powertrain: {
    id: "ev_powertrain",
    name: "Electric Vehicle & Power Systems",
    category: "Clean Tech & Power",
    icon: "FiSun",
    description: "Develop battery management systems, EV motor drives, and smart energy grids."
  },
  cad_structural: {
    id: "cad_structural",
    name: "CAD Modeling & Structural Engineering",
    category: "Core Engineering",
    icon: "FiHome",
    description: "Design 3D mechanical assemblies, thermal dynamics, and structural civil infrastructure."
  },

  // ── 17 B.E. ECE Domains ──
  vlsi_chip_design: {
    id: "vlsi_chip_design",
    name: "VLSI & Chip Design",
    category: "Semiconductors & Chip Design",
    icon: "FiCpu",
    description: "Design integrated circuits, gate-level netlists, CMOS logic, and ASIC/FPGA semiconductor chips."
  },
  embedded_systems: {
    id: "embedded_systems",
    name: "Embedded Systems",
    category: "Hardware & Firmware",
    icon: "FiRadio",
    description: "Program microcontrollers, bare-metal C, RTOS task schedulers, and embedded hardware interfaces."
  },
  iot: {
    id: "iot",
    name: "IoT",
    category: "Internet of Things",
    icon: "FiGlobe",
    description: "Architect interconnected smart edge sensor nodes, MQTT telemetry brokers, and low-power IoT networks."
  },
  communication_telecom: {
    id: "communication_telecom",
    name: "Communication / Telecom",
    category: "Telecommunications & Networks",
    icon: "FiRadio",
    description: "Engineer 5G/6G cellular links, OFDM modulation, base stations, and digital telecommunication systems."
  },
  rf_microwave: {
    id: "rf_microwave",
    name: "RF & Microwave",
    category: "Electromagnetics & RF",
    icon: "FiRadio",
    description: "Design RF transmission lines, waveguides, impedance matching networks, Smith charts, and radar front-ends."
  },
  signal_processing: {
    id: "signal_processing",
    name: "Signal Processing",
    category: "Signals & Systems",
    icon: "FiActivity",
    description: "Formulate DSP filters (FIR/IIR), Fourier transforms, Nyquist sampling, and digital audio/sensor analysis."
  },
  image_processing_cv: {
    id: "image_processing_cv",
    name: "Image Processing / Computer Vision",
    category: "Computer Vision & AI",
    icon: "FiCpu",
    description: "Build spatial convolution kernels, OpenCV image analysis, object detection, and CNN vision models."
  },
  automation_control: {
    id: "automation_control",
    name: "Automation & Control",
    category: "Control Systems & Instrumentation",
    icon: "FiZap",
    description: "Program industrial PLCs, closed-loop PID controllers, state-space models, and automation feedback loops."
  },
  robotics: {
    id: "robotics",
    name: "Robotics",
    category: "Robotics & Automation",
    icon: "FiZap",
    description: "Engineer robotic kinematics, Jacobian dynamics, ROS middleware, SLAM, and autonomous path planning."
  },
  hardware_pcb_design: {
    id: "hardware_pcb_design",
    name: "Hardware / PCB Design",
    category: "Hardware & Circuit Design",
    icon: "FiCpu",
    description: "Layout multi-layer PCBs, controlled impedance traces, DRC validation, decoupling, and high-speed signal integrity."
  },
  automotive_electronics: {
    id: "automotive_electronics",
    name: "Automotive Electronics",
    category: "Automotive Systems",
    icon: "FiBriefcase",
    description: "Develop vehicle ECUs, CAN/LIN automotive buses, ADAS active safety, and ISO 26262 functional safety."
  },
  power_electronics: {
    id: "power_electronics",
    name: "Power Electronics",
    category: "Power Systems & Energy",
    icon: "FiSun",
    description: "Engineer DC-DC converters (buck/boost/flyback), inverters, soft switching, and battery power systems."
  },
  medical_electronics: {
    id: "medical_electronics",
    name: "Medical Electronics",
    category: "Biomedical & Healthcare",
    icon: "FiActivity",
    description: "Design ECG acquisition circuits, high CMRR instrumentation amplifiers, medical safety isolation, and bio-sensors."
  },
  satellite_aerospace_avionics: {
    id: "satellite_aerospace_avionics",
    name: "Satellite / Aerospace / Avionics",
    category: "Aerospace & Avionics",
    icon: "FiGlobe",
    description: "Engineer satellite transponders, link margins, attitude control wheels, inertial navigation, and avionics."
  },
  semiconductor_testing: {
    id: "semiconductor_testing",
    name: "Semiconductor Testing",
    category: "Testing & Quality Assurance",
    icon: "FiCheckCircle",
    description: "Formulate ATE test programs, scan chains, stuck-at fault models, ATPG, BIST, and silicon wafer yield testing."
  },
  aiml_ece: {
    id: "aiml_ece",
    name: "AI / ML for ECE",
    category: "Edge AI & Embedded Intelligence",
    icon: "FiCpu",
    description: "Deploy quantized neural networks, Edge AI inference, confusion matrix analysis, and embedded machine learning."
  },
  software_it: {
    id: "software_it",
    name: "Software / IT",
    category: "Software Engineering & IT",
    icon: "FiBriefcase",
    description: "Build robust REST APIs, SQL database indexing, Docker containers, asynchronous event systems, and web apps."
  }
};

// Mapping from Step 4 specialization phrases to normalized domain IDs
const SPECIALIZATION_MAP = {
  // Software Engineering & Architecture
  "software engineering & architecture": "software_engineering",
  "software engineering": "software_engineering",
  "enterprise software": "software_engineering",
  "software architecture": "software_engineering",

  // AI / ML
  "artificial intelligence & machine learning": "ai_ml",
  "artificial intelligence": "ai_ml",
  "machine learning": "ai_ml",
  "ai & machine learning": "ai_ml",
  "ai & ml": "ai_ml",
  "deep learning": "ai_ml",
  "nlp": "ai_ml",
  "generative ai": "ai_ml",

  // Cyber Security
  "cyber security & ethical hacking": "cyber_security",
  "cyber security": "cyber_security",
  "ethical hacking": "cyber_security",
  "information security": "cyber_security",
  "network security": "cyber_security",

  // Algorithms & Systems
  "algorithms & system programming": "algorithms_systems",
  "algorithms & systems": "algorithms_systems",
  "algorithms": "algorithms_systems",
  "system programming": "algorithms_systems",

  // Full Stack
  "full stack web & mobile development": "full_stack",
  "full stack": "full_stack",
  "web development": "full_stack",
  "mobile development": "full_stack",

  // Data Science
  "data science & big data analytics": "data_science",
  "data science": "data_science",
  "big data": "data_science",
  "data analytics": "data_science",
  "data engineering": "data_science",

  // Cloud & DevOps
  "cloud computing & devops": "cloud_devops",
  "cloud computing": "cloud_devops",
  "devops": "cloud_devops",
  "cloud architecture": "cloud_devops",

  // ── 17 B.E. ECE Specialization & Domain Mappings ──
  "vlsi & chip design": "vlsi_chip_design",
  "vlsi & semiconductor chip design": "vlsi_chip_design",
  "vlsi design": "vlsi_chip_design",
  "vlsi": "vlsi_chip_design",
  "chip design": "vlsi_chip_design",
  "semiconductor chip design": "vlsi_chip_design",

  "embedded systems": "embedded_systems",
  "embedded systems & microcontrollers": "embedded_systems",
  "embedded systems & iot": "embedded_systems",
  "embedded": "embedded_systems",
  "microcontrollers": "embedded_systems",

  "iot": "iot",
  "iot & smart sensor systems": "iot",
  "smart sensor systems": "iot",
  "internet of things": "iot",

  "communication / telecom": "communication_telecom",
  "communication telecom": "communication_telecom",
  "telecom": "communication_telecom",
  "telecommunication": "communication_telecom",
  "wireless communication & 5g/6g networks": "communication_telecom",
  "wireless communication": "communication_telecom",

  "rf & microwave": "rf_microwave",
  "rf & microwave engineering": "rf_microwave",
  "rf microwave": "rf_microwave",
  "microwave": "rf_microwave",

  "signal processing": "signal_processing",
  "signal processing & image analysis": "signal_processing",
  "digital signal processing": "signal_processing",

  "image processing / computer vision": "image_processing_cv",
  "image processing": "image_processing_cv",
  "computer vision": "image_processing_cv",

  "automation & control": "automation_control",
  "automation control": "automation_control",
  "automation": "automation_control",
  "control systems": "automation_control",

  "robotics": "robotics",
  "robotics & automation": "robotics",
  "robotics engineering": "robotics",

  "hardware / pcb design": "hardware_pcb_design",
  "hardware pcb design": "hardware_pcb_design",
  "pcb design": "hardware_pcb_design",
  "hardware design": "hardware_pcb_design",

  "automotive electronics": "automotive_electronics",
  "automotive systems": "automotive_electronics",

  "power electronics": "power_electronics",
  "power electronics & drives": "power_electronics",

  "medical electronics": "medical_electronics",
  "biomedical electronics": "medical_electronics",

  "satellite / aerospace / avionics": "satellite_aerospace_avionics",
  "satellite aerospace avionics": "satellite_aerospace_avionics",
  "satellite": "satellite_aerospace_avionics",
  "aerospace": "satellite_aerospace_avionics",
  "avionics": "satellite_aerospace_avionics",

  "semiconductor testing": "semiconductor_testing",
  "chip testing": "semiconductor_testing",

  "ai / ml for ece": "aiml_ece",
  "ai ml for ece": "aiml_ece",
  "edge ai": "aiml_ece",

  "software / it": "software_it",
  "software it": "software_it",

  // Core Mechanical / Civil / Power
  "electric vehicle": "ev_powertrain",
  "power systems": "ev_powertrain",
  "cad": "cad_structural",
  "structural": "cad_structural"
};

// Fallback domain maps grouped by core branch if no specializations were selected
const BRANCH_DEFAULT_DOMAINS = {
  cse: ["software_engineering", "ai_ml", "cyber_security", "algorithms_systems", "data_science"],
  it: ["software_engineering", "ai_ml", "cyber_security", "algorithms_systems", "data_science"],
  aids: ["software_engineering", "ai_ml", "cyber_security", "algorithms_systems", "data_science"],
  ece: [
    "vlsi_chip_design",
    "embedded_systems",
    "iot",
    "communication_telecom",
    "rf_microwave",
    "signal_processing",
    "image_processing_cv",
    "automation_control",
    "robotics",
    "hardware_pcb_design",
    "automotive_electronics",
    "power_electronics",
    "medical_electronics",
    "satellite_aerospace_avionics",
    "semiconductor_testing",
    "aiml_ece",
    "software_it"
  ],
  eee: ["ev_powertrain", "power_electronics", "automation_control", "cloud_devops"],
  mechanical: ["cad_structural", "robotics", "ev_powertrain"],
  civil: ["cad_structural", "data_science", "cloud_devops"],
  chemical: ["data_science", "ai_ml", "cloud_devops"],
  mechatronics: ["robotics", "embedded_systems", "aiml_ece"]
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
  return "cse";
}

/**
 * Resolves candidate domain objects based strictly on Step 4 specializations & branch
 */
function resolveCandidateDomains(branchId = "cse", specializations = []) {
  const normBranch = resolveBranchId(branchId);
  const matchedDomainIds = new Set();

  if (Array.isArray(specializations) && specializations.length > 0) {
    specializations.forEach(spec => {
      const lower = spec.toLowerCase().trim();
      let matched = false;

      // Check exact / substring matches in SPECIALIZATION_MAP
      for (const [key, domainId] of Object.entries(SPECIALIZATION_MAP)) {
        if (lower === key || lower.includes(key) || key.includes(lower)) {
          matchedDomainIds.add(domainId);
          matched = true;
          break;
        }
      }
    });
  }

  let selectedIds = Array.from(matchedDomainIds);

  // If fewer than 2 candidate domains matched, supplement from branch defaults so AHP pairwise comparisons can be formed
  if (selectedIds.length < 2) {
    const branchDefaults = BRANCH_DEFAULT_DOMAINS[normBranch] || BRANCH_DEFAULT_DOMAINS["cse"];
    branchDefaults.forEach(id => {
      if (!selectedIds.includes(id) && selectedIds.length < 3) {
        selectedIds.push(id);
      }
    });
  }

  // Limit candidate domains to top 5 maximum for pairwise comparison clarity
  selectedIds = selectedIds.slice(0, 5);

  return selectedIds.map(id => NORMALIZED_DOMAINS[id] || {
    id,
    name: id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    category: "Specialized Domain",
    icon: "FiBriefcase",
    description: `Specialized pathway in ${id.replace(/_/g, " ")}.`
  });
}

module.exports = {
  NORMALIZED_DOMAINS,
  SPECIALIZATION_MAP,
  BRANCH_DEFAULT_DOMAINS,
  resolveCandidateDomains
};

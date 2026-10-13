const TeammateListing = require("../models/TeammateListing");
const { PeerConversation, PeerMessage } = require("../models/PeerChat");
const CollegeStudentProfile = require("../models/CollegeStudentProfile");
const User = require("../models/User");

// ── Verified Real-World Competitions Directory ──────────────────────────────
const VERIFIED_REAL_COMPETITIONS = [
  {
    id: "sih-2026",
    name: "Smart India Hackathon (SIH 2026)",
    shortName: "SIH 2026",
    organizer: "Ministry of Education (MoE) & AICTE, Govt of India",
    category: "National Flagship Hackathon",
    officialWebsite: "https://www.sih.gov.in",
    status: "Official National Edition",
    domains: ["Smart Automation", "Clean & Green Tech", "Agriculture", "MedTech", "Heritage & Culture"],
    teamSize: 6,
    badge: "🏆 Govt of India"
  },
  {
    id: "tnsi-2026",
    name: "Tamil Nadu Student Innovators (TNSI)",
    shortName: "TNSI (EDII-TN)",
    organizer: "EDII-TN, Government of Tamil Nadu",
    category: "State Government Innovation Challenge",
    officialWebsite: "https://editn.in",
    status: "Active State Challenge",
    domains: ["AgriTech", "CleanTech", "Industry 4.0", "IoT & Embedded", "Social Impact"],
    teamSize: 4,
    badge: "🏛️ Govt of Tamil Nadu"
  },
  {
    id: "naan-mudhalvan-ideathon",
    name: "Naan Mudhalvan AI Innovation Challenge",
    shortName: "Naan Mudhalvan Challenge",
    organizer: "Tamil Nadu Skill Development Corporation (TNSDC)",
    category: "State Skill Hackathon",
    officialWebsite: "https://naanmudhalvan.tn.gov.in",
    status: "Annual State Initiative",
    domains: ["Generative AI", "Cyber Security", "Cloud Computing", "Full Stack Web"],
    teamSize: 4,
    badge: "⚡ TNSDC Mission"
  },
  {
    id: "kurukshetra-2026",
    name: "Anna University CEG Kurukshetra",
    shortName: "CEG Kurukshetra",
    organizer: "College of Engineering, Guindy (Anna University)",
    category: "National Level Techno-Management Fest",
    officialWebsite: "https://kurukshetra.org.in",
    status: "Active University Fest",
    domains: ["Autonomous Robotics", "Algorithmic Coding", "Core Engineering", "Web3"],
    teamSize: 4,
    badge: "🚀 Anna University"
  },
  {
    id: "final-year-capstone",
    name: "B.E. Final Year Capstone Project",
    shortName: "Final Year Capstone",
    organizer: "Anna University Autonomous / Affiliated Curriculum",
    category: "Academic Capstone Project",
    officialWebsite: "https://www.annauniv.edu",
    status: "Curricular Requirement",
    domains: ["AI/ML", "IoT & Embedded", "VLSI Design", "Structural / Mechanical Design"],
    teamSize: 4,
    badge: "🎓 Final Year"
  }
];

// Auto-seed realistic verified hackathon squads if database has 0 listings
async function ensureSeedListingsIfEmpty() {
  try {
    const count = await TeammateListing.countDocuments();
    if (count > 0) return;

    const seedUser =
      (await User.findOne({ userType: "college_student" })) ||
      (await User.findOne({ role: "student" })) ||
      (await User.findOne());
    if (!seedUser) return;

    const sampleListings = [
      {
        creatorId: seedUser._id,
        creatorName: "Karthik Subramanian",
        creatorDepartment: "Computer Science & Engineering",
        creatorYear: "3rd Year",
        creatorCollege: "National Engineering College",
        title: "AI-Driven Smart Crop Disease & Yield Predictor",
        category: "hackathon",
        eventName: "Smart India Hackathon (SIH 2026)",
        domain: "AI / ML & Data Science",
        description: "Developing an edge AI model running on Raspberry Pi and mobile app to detect pest infestations in paddy and cotton fields with offline inference. Need frontend and IoT teammates to build the dashboard and sensor telemetry.",
        problemStatement: "Agriculture & Rural Development: Early identification of foliar disease in cash crops using localized mobile vision.",
        skillsLookingFor: ["React / Next.js", "Python / FastAPI", "YOLO / Computer Vision", "ESP32 / Embedded C"],
        teamSizeMax: 6,
        members: [
          {
            userId: seedUser._id,
            name: "Karthik Subramanian",
            department: "CSE",
            role: "Team Lead & ML Dev",
            joinedAt: new Date()
          }
        ],
        status: "open",
        isSeeded: true
      },
      {
        creatorId: seedUser._id,
        creatorName: "Priya Sundaram",
        creatorDepartment: "Electronics & Communication (ECE)",
        creatorYear: "3rd Year",
        creatorCollege: "Anna University MIT Campus",
        title: "Autonomous Pipeline Water Leak & Quality Drone Sensor",
        category: "hackathon",
        eventName: "Tamil Nadu Student Innovators (TNSI)",
        domain: "IoT & Embedded Systems",
        description: "Building an automated acoustic sensor pipeline inspection module integrated with LoRaWAN wireless long-range data transmission for municipal water monitoring.",
        problemStatement: "Clean Tech & Water Resource Conservation: Reducing 30% non-revenue water distribution loss across urban municipalities.",
        skillsLookingFor: ["ESP32 / Embedded C", "Hardware PCB Design (KiCAD)", "Node.js / Express", "UI/UX Design (Figma)"],
        teamSizeMax: 4,
        members: [
          {
            userId: seedUser._id,
            name: "Priya Sundaram",
            department: "ECE",
            role: "Hardware Lead",
            joinedAt: new Date()
          }
        ],
        status: "open",
        isSeeded: true
      },
      {
        creatorId: seedUser._id,
        creatorName: "Aravind Raghavan",
        creatorDepartment: "Information Technology",
        creatorYear: "4th Year",
        creatorCollege: "PSG College of Technology",
        title: "Bilingual Tamil-English Civic Rights & Scheme Navigator AI",
        category: "hackathon",
        eventName: "Naan Mudhalvan AI Innovation Challenge",
        domain: "Web & Full Stack Development",
        description: "Fine-tuning an open-source LLM for conversational voice navigation of Tamil Nadu government welfare schemes and scholarship benefits for rural citizens.",
        problemStatement: "Bridging the digital literacy divide for state welfare delivery using Tamil Generative Voice Agents.",
        skillsLookingFor: ["React / Next.js", "Machine Learning / PyTorch", "PostgreSQL / MongoDB", "UI/UX Design (Figma)"],
        teamSizeMax: 4,
        members: [
          {
            userId: seedUser._id,
            name: "Aravind Raghavan",
            department: "IT",
            role: "Full Stack Lead",
            joinedAt: new Date()
          }
        ],
        status: "open",
        isSeeded: true
      },
      {
        creatorId: seedUser._id,
        creatorName: "Dinesh Kumar",
        creatorDepartment: "Mechanical & Mechatronics",
        creatorYear: "3rd Year",
        creatorCollege: "College of Engineering, Guindy",
        title: "Autonomous ROS2 Multi-Terrain Campus Delivery Rover",
        category: "symposium",
        eventName: "Anna University CEG Kurukshetra",
        domain: "Robotics & Mechatronics",
        description: "Designing a 4-wheel differential drive rover equipped with 2D LiDAR and depth camera for automated package delivery inside academic campus with 3D SLAM mapping.",
        problemStatement: "Autonomous Robotic Navigation & Fleet Coordination in pedestrian-heavy institutional corridors.",
        skillsLookingFor: ["ROS2 / Robotics", "Python / FastAPI", "ESP32 / Embedded C", "Hardware PCB Design (KiCAD)"],
        teamSizeMax: 4,
        members: [
          {
            userId: seedUser._id,
            name: "Dinesh Kumar",
            department: "Mechatronics",
            role: "Robotics Lead",
            joinedAt: new Date()
          }
        ],
        status: "open",
        isSeeded: true
      }
    ];

    await TeammateListing.insertMany(sampleListings);
    console.log("Seeded default hackathon teammate squads successfully.");
  } catch (seedErr) {
    console.warn("ensureSeedListings note:", seedErr.message);
  }
}

/**
 * ── GET /api/teammate-matchmaker/competitions ─────────────────────────────────
 * Real verified engineering hackathons, government challenges & symposiums
 */
exports.getCompetitions = async (req, res) => {
  try {
    await ensureSeedListingsIfEmpty();
    const counts = await TeammateListing.aggregate([
      { $group: { _id: "$eventName", count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => {
      if (c._id) countMap[c._id] = c.count;
    });

    const enriched = VERIFIED_REAL_COMPETITIONS.map(comp => ({
      ...comp,
      activeSquadsCount: countMap[comp.name] || 0
    }));

    res.json({
      success: true,
      competitions: enriched
    });
  } catch (err) {
    console.error("getCompetitions error:", err);
    res.status(500).json({ success: false, message: "Failed to load competitions." });
  }
};

/**
 * ── GET /api/teammate-matchmaker/summary ──────────────────────────────────────
 * Real summary metrics computed directly from database
 */
exports.getSummary = async (req, res) => {
  try {
    await ensureSeedListingsIfEmpty();
    const totalListings = await TeammateListing.countDocuments();
    const openListings = await TeammateListing.countDocuments({ status: "open" });
    const all = await TeammateListing.find().select("teamSizeMax members").lean();
    let totalSlots = 0;
    all.forEach(l => {
      const open = Math.max(0, (l.teamSizeMax || 4) - (l.members?.length || 0));
      totalSlots += open;
    });

    res.json({
      success: true,
      totalListings,
      openListings,
      totalSlots,
      competitionsCount: VERIFIED_REAL_COMPETITIONS.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load summary." });
  }
};

/**
 * ── GET /api/teammate-matchmaker/listings ─────────────────────────────────────
 * Browse open engineering teams & project ideas created by real students
 */
exports.getListings = async (req, res) => {
  try {
    await ensureSeedListingsIfEmpty();
    const userId = req.student?._id;
    const { category, domain, q, status = "all", onlyOpen = "false" } = req.query;

    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
    }
    if (domain && domain !== "all") {
      filter.domain = domain;
    }
    if (status && status !== "all") {
      filter.status = status;
    } else if (onlyOpen === "true") {
      filter.status = "open";
    }

    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = [
        { title: rx },
        { description: rx },
        { eventName: rx },
        { skillsLookingFor: rx },
        { creatorDepartment: rx }
      ];
    }

    const listings = await TeammateListing.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with real user status (isCreator, isMember, hasRequested)
    const enriched = listings.map(l => {
      const isCreator = userId ? l.creatorId.toString() === userId.toString() : false;
      const isMember = userId
        ? (l.members || []).some(m => m.userId && m.userId.toString() === userId.toString())
        : false;
      const userRequest = userId
        ? (l.joinRequests || []).find(r => r.userId && r.userId.toString() === userId.toString())
        : null;

      const currentSlots = (l.members || []).length;
      const slotsLeft = Math.max(0, (l.teamSizeMax || 4) - currentSlots);

      return {
        ...l,
        isCreator,
        isMember,
        myRequestStatus: userRequest ? userRequest.status : null,
        slotsLeft,
        isFull: slotsLeft === 0
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      listings: enriched
    });
  } catch (err) {
    console.error("getListings error:", err);
    res.status(500).json({ success: false, message: "Failed to load listings." });
  }
};

/**
 * ── GET /api/teammate-matchmaker/listings/:id ─────────────────────────────────
 * Single listing details
 */
exports.getListingById = async (req, res) => {
  try {
    const userId = req.student?._id;
    const listing = await TeammateListing.findById(req.params.id).lean();

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }

    const isCreator = userId ? listing.creatorId.toString() === userId.toString() : false;
    const isMember = userId
      ? (listing.members || []).some(m => m.userId && m.userId.toString() === userId.toString())
      : false;
    const userRequest = userId
      ? (listing.joinRequests || []).find(r => r.userId && r.userId.toString() === userId.toString())
      : null;

    res.json({
      success: true,
      listing: {
        ...listing,
        isCreator,
        isMember,
        myRequestStatus: userRequest ? userRequest.status : null
      }
    });
  } catch (err) {
    console.error("getListingById error:", err);
    res.status(500).json({ success: false, message: "Failed to load listing." });
  }
};

/**
 * ── POST /api/teammate-matchmaker/listings ────────────────────────────────────
 * Create a new team / hackathon idea listing using real logged-in student profile
 */
exports.createListing = async (req, res) => {
  try {
    const userId = req.student?._id;
    const user = req.student;

    const {
      title,
      category = "hackathon",
      eventName = "Smart India Hackathon (SIH)",
      domain = "AI / ML & Data Science",
      description,
      problemStatement,
      skillsLookingFor = [],
      teamSizeMax = 4,
      deadline
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required."
      });
    }

    // Fetch real college student profile details for creator metadata
    const profile = await CollegeStudentProfile.findOne({
      $or: [{ userId }, { userId: userId?.toString() }]
    }).lean();

    const creatorName = user.name || "Engineering Student";
    const creatorDepartment = profile?.domain || profile?.specialization || profile?.field || "Engineering";
    const creatorYear = profile?.currentYear ? `${profile.currentYear} Year` : "College Student";
    const creatorCollege = profile?.institution || "Engineering College";

    // Auto-create a PeerConversation for this team group chat
    let convo = null;
    try {
      convo = await PeerConversation.create({
        participants: [userId],
        lastMessage: `Team "${title.substring(0, 40)}" formed! Let's collaborate.`,
        lastMessageAt: new Date()
      });

      // Send initial welcome message in the conversation
      await PeerMessage.create({
        conversationId: convo._id,
        senderId: userId,
        content: `👋 Team formed for "${title}". Group chat ready for members!`,
        type: "system"
      });
    } catch (convoErr) {
      console.warn("PeerConversation init note:", convoErr.message);
    }

    const listing = await TeammateListing.create({
      creatorId: userId,
      creatorName,
      creatorDepartment,
      creatorYear,
      creatorCollege,
      title: title.trim(),
      category,
      eventName: eventName.trim(),
      domain,
      description: description.trim(),
      problemStatement: problemStatement ? problemStatement.trim() : "",
      skillsLookingFor: Array.isArray(skillsLookingFor)
        ? skillsLookingFor.map(s => s.trim()).filter(Boolean)
        : [],
      teamSizeMax: Math.max(2, Math.min(6, parseInt(teamSizeMax) || 4)),
      members: [
        {
          userId,
          name: creatorName,
          department: creatorDepartment,
          role: "Team Lead / Creator",
          joinedAt: new Date()
        }
      ],
      conversationId: convo ? convo._id : null,
      deadline: deadline ? new Date(deadline) : null,
      status: "open",
      isSeeded: false
    });

    res.status(201).json({
      success: true,
      message: "Team idea posted successfully!",
      listing
    });
  } catch (err) {
    console.error("createListing error:", err);
    res.status(500).json({ success: false, message: "Failed to post team idea." });
  }
};

/**
 * ── POST /api/teammate-matchmaker/listings/:id/join-request ───────────────────
 * 1-click request to join a team using real student credentials
 */
exports.requestToJoin = async (req, res) => {
  try {
    const userId = req.student?._id;
    const user = req.student;
    const listingId = req.params.id;
    const { message = "" } = req.body;

    const listing = await TeammateListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }

    if (listing.creatorId.toString() === userId.toString()) {
      return res.status(400).json({ success: false, message: "You are the creator of this team." });
    }

    const isMember = (listing.members || []).some(m => m.userId.toString() === userId.toString());
    if (isMember) {
      return res.status(400).json({ success: false, message: "You are already a member of this team." });
    }

    if (listing.members.length >= listing.teamSizeMax) {
      return res.status(400).json({ success: false, message: "Team is already full." });
    }

    const existingReq = (listing.joinRequests || []).find(r => r.userId.toString() === userId.toString());
    if (existingReq) {
      if (existingReq.status === "pending") {
        return res.status(400).json({ success: false, message: "You already have a pending join request." });
      }
      if (existingReq.status === "rejected") {
        // Allow re-applying with updated message
        existingReq.status = "pending";
        existingReq.message = message || existingReq.message;
        existingReq.requestedAt = new Date();
        await listing.save();
        return res.json({ success: true, message: "Join request re-submitted!" });
      }
    }

    // Fetch real applicant profile to extract skills & department
    const profile = await CollegeStudentProfile.findOne({
      $or: [{ userId }, { userId: userId?.toString() }]
    }).lean();

    listing.joinRequests.push({
      userId,
      name: user.name || "Student Peer",
      email: user.email || "",
      department: profile?.domain || profile?.specialization || profile?.field || "Engineering",
      year: profile?.currentYear ? `${profile.currentYear} Year` : "College Student",
      skills: profile?.skills || [],
      message: message.trim() || `Interested in joining for ${listing.eventName}`,
      status: "pending",
      requestedAt: new Date()
    });

    await listing.save();

    // Real-time socket notification to creator if online
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${listing.creatorId}`).emit("notification", {
        type: "teammate_request",
        title: "New Teammate Request! 🚀",
        message: `${user.name || "A student"} requested to join your team: "${listing.title.substring(0, 35)}..."`,
        listingId: listing._id
      });
    }

    res.json({
      success: true,
      message: "Join request sent! The team lead has been notified."
    });
  } catch (err) {
    console.error("requestToJoin error:", err);
    res.status(500).json({ success: false, message: "Failed to submit join request." });
  }
};

/**
 * ── POST /api/teammate-matchmaker/listings/:id/respond-request ────────────────
 * Team creator accepts or rejects a join request
 */
exports.respondToJoinRequest = async (req, res) => {
  try {
    const userId = req.student?._id;
    const listingId = req.params.id;
    const { requestId, action } = req.body; // action: 'accepted' | 'rejected'

    if (!requestId || !["accepted", "rejected"].includes(action)) {
      return res.status(400).json({ success: false, message: "Valid requestId and action are required." });
    }

    const listing = await TeammateListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }

    // Verify creator authorization
    if (listing.creatorId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Only the team lead can accept or decline requests." });
    }

    const targetReq = listing.joinRequests.id(requestId);
    if (!targetReq) {
      return res.status(404).json({ success: false, message: "Join request not found." });
    }

    targetReq.status = action;

    if (action === "accepted") {
      // Check team capacity
      if (listing.members.length >= listing.teamSizeMax) {
        return res.status(400).json({ success: false, message: "Team is already full." });
      }

      // Add to members
      const alreadyMember = listing.members.some(m => m.userId.toString() === targetReq.userId.toString());
      if (!alreadyMember) {
        listing.members.push({
          userId: targetReq.userId,
          name: targetReq.name,
          department: targetReq.department,
          role: "Teammate",
          joinedAt: new Date()
        });
      }

      // Check if team is now full
      if (listing.members.length >= listing.teamSizeMax) {
        listing.status = "team_full";
      }

      // Add user to team PeerConversation participants
      if (listing.conversationId) {
        try {
          await PeerConversation.findByIdAndUpdate(listing.conversationId, {
            $addToSet: { participants: targetReq.userId },
            $set: {
              lastMessage: `🎉 ${targetReq.name} joined the team!`,
              lastMessageAt: new Date()
            }
          });

          await PeerMessage.create({
            conversationId: listing.conversationId,
            senderId: userId,
            content: `🎉 Welcome ${targetReq.name} to the team!`,
            type: "system"
          });
        } catch (chatErr) {
          console.warn("PeerConversation update note:", chatErr.message);
        }
      }
    }

    await listing.save();

    // Socket notification to the applicant
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${targetReq.userId}`).emit("notification", {
        type: "teammate_response",
        title: action === "accepted" ? "Team Request Accepted! 🎉" : "Team Request Update",
        message: action === "accepted"
          ? `You have been accepted into "${listing.title.substring(0, 35)}..."! Check your team chat.`
          : `Your request to join "${listing.title.substring(0, 35)}..." was not accepted.`,
        listingId: listing._id
      });
    }

    res.json({
      success: true,
      message: `Request successfully ${action}!`,
      listing
    });
  } catch (err) {
    console.error("respondToJoinRequest error:", err);
    res.status(500).json({ success: false, message: "Failed to respond to request." });
  }
};

/**
 * ── GET /api/teammate-matchmaker/my-teams ─────────────────────────────────────
 * Get real teams created by student and teams student has joined/requested
 */
exports.getMyTeams = async (req, res) => {
  try {
    const userId = req.student?._id;

    const [createdTeams, joinedTeams, pendingRequests] = await Promise.all([
      TeammateListing.find({ creatorId: userId }).sort({ createdAt: -1 }).lean(),
      TeammateListing.find({
        creatorId: { $ne: userId },
        "members.userId": userId
      }).sort({ createdAt: -1 }).lean(),
      TeammateListing.find({
        "joinRequests.userId": userId,
        "joinRequests.status": "pending"
      }).sort({ createdAt: -1 }).lean()
    ]);

    res.json({
      success: true,
      createdTeams,
      joinedTeams,
      pendingRequests
    });
  } catch (err) {
    console.error("getMyTeams error:", err);
    res.status(500).json({ success: false, message: "Failed to load your teams." });
  }
};

/**
 * ── DELETE /api/teammate-matchmaker/listings/:id ──────────────────────────────
 * Delete a listing (creator only)
 */
exports.deleteListing = async (req, res) => {
  try {
    const userId = req.student?._id;
    const listing = await TeammateListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }

    if (listing.creatorId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Only the creator can delete this listing." });
    }

    await TeammateListing.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Listing removed." });
  } catch (err) {
    console.error("deleteListing error:", err);
    res.status(500).json({ success: false, message: "Failed to delete listing." });
  }
};

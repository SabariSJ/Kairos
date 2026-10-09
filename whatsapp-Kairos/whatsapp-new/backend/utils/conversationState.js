const fs = require("fs");
const path = require("path");

// In-memory conversation state keyed by phone number
const conversationStore = new Map();

// Clean up duplicate message cache every 15 minutes (keep 30 mins)
const DEDUPLICATION_TTL_MS = 30 * 60 * 1000;
// Conversation session expiry: 45 minutes of inactivity
const CONVERSATION_TTL_MS = 45 * 60 * 1000;

// Path to persistent processed messages file
const PROCESSED_MESSAGES_FILE = path.join(__dirname, "..", "data", "processed_messages.json");
const SESSIONS_FILE = path.join(__dirname, "..", "data", "conversation_sessions.json");

// In-memory cache of processed Meta WhatsApp Message IDs
const processedMessages = new Map();

function initSessions() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
      if (typeof data === "object" && data !== null) {
        const now = Date.now();
        for (const [phone, sess] of Object.entries(data)) {
          if (sess && (now - (sess.lastUpdated || 0) < CONVERSATION_TTL_MS)) {
            conversationStore.set(phone, sess);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Sessions Storage] Error initializing store:", err.message);
  }
}
initSessions();

function saveSessionsToDisk() {
  try {
    const obj = {};
    const now = Date.now();
    for (const [phone, sess] of conversationStore.entries()) {
      if (now - (sess.lastUpdated || 0) < CONVERSATION_TTL_MS) {
        obj[phone] = sess;
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (err) {
    // Non-critical
  }
}

function initProcessedMessages() {
  try {
    const dir = path.dirname(PROCESSED_MESSAGES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(PROCESSED_MESSAGES_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROCESSED_MESSAGES_FILE, "utf8"));
      if (Array.isArray(data)) {
        const now = Date.now();
        for (const item of data) {
          if (item && item.id && item.time && (now - item.time < DEDUPLICATION_TTL_MS)) {
            processedMessages.set(item.id, item.time);
          }
        }
      }
    }
  } catch (err) {
    console.error("[Processed Messages] Error initializing store:", err.message);
  }
}
initProcessedMessages();

function saveProcessedMessagesToDisk() {
  try {
    const entries = [];
    const now = Date.now();
    for (const [id, time] of processedMessages.entries()) {
      if (now - time < DEDUPLICATION_TTL_MS) {
        entries.push({ id, time });
      }
    }
    // Keep last 1,000 entries max
    const trimmed = entries.slice(-1000);
    fs.writeFileSync(PROCESSED_MESSAGES_FILE, JSON.stringify(trimmed), "utf8");
  } catch (err) {
    // Non-critical
  }
}


// Path to persistent leads storage file
const LEADS_FILE_PATH = path.join(__dirname, "..", "data", "leads.json");

/**
 * Initialize leads file if it doesn't exist
 */
function ensureLeadsFile() {
  try {
    const dir = path.dirname(LEADS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LEADS_FILE_PATH)) {
      fs.writeFileSync(LEADS_FILE_PATH, JSON.stringify([], null, 2), "utf8");
    }
  } catch (err) {
    console.error("[Leads Storage] Error initializing leads file:", err.message);
  }
}
ensureLeadsFile();

/**
 * Check if a WhatsApp message ID has already been processed
 */
function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  const now = Date.now();

  for (const [id, time] of processedMessages.entries()) {
    if (now - time > DEDUPLICATION_TTL_MS) {
      processedMessages.delete(id);
    }
  }

  if (processedMessages.has(messageId)) {
    return true;
  }

  processedMessages.set(messageId, now);
  saveProcessedMessagesToDisk();
  return false;
}

/**
 * Get the current conversation state for a phone number
 */
function getConversationState(phone) {
  if (!phone) return null;
  const now = Date.now();

  if (conversationStore.has(phone)) {
    const session = conversationStore.get(phone);
    if (now - session.lastUpdated < CONVERSATION_TTL_MS) {
      return session;
    } else {
      conversationStore.delete(phone);
    }
  }

  const newSession = {
    step: "IDLE",
    collectedData: {
      agreed: false,
      lookingFor: null,
      profile: null,
      hours: null,
      workLocation: null,
      device: null,
      startDate: null,
      selectedOffer: "Mobile Money agent",
      applications: [],
      name: null
    },
    lastUpdated: now
  };
  conversationStore.set(phone, newSession);
  return newSession;
}

/**
 * Update conversation state for a phone number
 */
function updateConversationState(phone, updates = {}) {
  const current = getConversationState(phone);
  const updated = {
    ...current,
    ...updates,
    collectedData: {
      ...current.collectedData,
      ...(updates.collectedData || {})
    },
    lastUpdated: Date.now()
  };
  conversationStore.set(phone, updated);
  saveSessionsToDisk();
  return updated;
}

/**
 * Reset conversation state for a phone number back to IDLE
 */
function resetConversationState(phone) {
  const current = getConversationState(phone);
  const existingApplications = current?.collectedData?.applications || [];
  const newSession = {
    step: "IDLE",
    collectedData: {
      agreed: false,
      lookingFor: null,
      profile: null,
      hours: null,
      workLocation: null,
      device: null,
      startDate: null,
      selectedOffer: "Mobile Money agent",
      applications: existingApplications,
      name: null
    },
    lastUpdated: Date.now()
  };
  conversationStore.set(phone, newSession);
  saveSessionsToDisk();
  return newSession;
}

/**
 * Save collected lead / application for Kairos Lite
 */
function saveLead(leadData) {
  try {
    ensureLeadsFile();
    const existingRaw = fs.readFileSync(LEADS_FILE_PATH, "utf8");
    const leads = JSON.parse(existingRaw || "[]");

    const newLead = {
      id: "KAIROS_" + Date.now(),
      timestamp: new Date().toISOString(),
      phone: leadData.phone,
      name: leadData.name || "Candidate",
      lookingFor: leadData.lookingFor || "A job",
      profile: leadData.profile || "Candidate",
      hours: leadData.hours || "Flexible",
      workLocation: leadData.workLocation || "From home",
      device: leadData.device || "Smartphone",
      startDate: leadData.startDate || "Immediately",
      appliedOffer: leadData.appliedOffer || "Mobile Money agent",
      service: "Kairos Lite Free Matching",
      status: "APPLIED"
    };

    leads.push(newLead);
    fs.writeFileSync(LEADS_FILE_PATH, JSON.stringify(leads, null, 2), "utf8");
    console.log(`[Kairos Application Saved] Candidate: ${leadData.phone} | Offer: ${newLead.appliedOffer} | Profile: ${newLead.profile}`);
    return newLead;
  } catch (err) {
    console.error("[Leads Storage] Failed to save lead:", err.message);
    return null;
  }
}

/**
 * Get saved applications for a candidate
 */
function getCandidateApplications(phone) {
  try {
    ensureLeadsFile();
    const existingRaw = fs.readFileSync(LEADS_FILE_PATH, "utf8");
    const leads = JSON.parse(existingRaw || "[]");
    return leads.filter(l => l.phone === phone);
  } catch (err) {
    return [];
  }
}

module.exports = {
  isDuplicateMessage,
  getConversationState,
  updateConversationState,
  resetConversationState,
  saveLead,
  getCandidateApplications
};

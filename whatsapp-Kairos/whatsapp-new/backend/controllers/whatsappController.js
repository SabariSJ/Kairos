const whatsappService = require("../services/whatsappService");
const chatbotService = require("../services/chatbotService");
const { isDuplicateMessage } = require("../utils/conversationState");

/**
 * Handle Meta Webhook Verification (GET /webhook)
 * Meta calls this when you configure your Webhook URL in the Meta App Dashboard
 */
function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || "sproutks_webhook_verify_token_2026";

  console.log(`[Webhook Verification Request] Mode: ${mode} | Provided Token: ${token ? "***" : "missing"}`);

  if (mode && token) {
    if (mode === "subscribe" && token === expectedToken) {
      console.log("[Webhook Verification SUCCESS] Meta Webhook verified successfully!");
      return res.status(200).send(challenge);
    } else {
      console.warn("[Webhook Verification FAILED] Token mismatch! Expected verify token does not match incoming token.");
      return res.status(403).json({ error: "Verification token mismatch" });
    }
  }

  return res.status(400).json({ error: "Missing verification parameters" });
}

/**
 * Handle Incoming WhatsApp Messages & Events (POST /webhook)
 */
async function handleWebhook(req, res) {
  // CRITICAL: Always respond with 200 OK immediately to Meta to prevent timeouts and re-deliveries
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;

    // Validate Meta Webhook payload structure
    if (!body || body.object !== "whatsapp_business_account") {
      return;
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      return;
    }

    // Ignore all delivery status updates (sent, delivered, read receipts)
    if (value.statuses && (!value.messages || value.messages.length === 0)) {
      return;
    }

    // Check if messages array exists
    const messages = value.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return;
    }

    const message = messages[0];
    const messageId = message.id;
    const from = String(message.from || "").replace(/\D/g, ""); // Customer's phone number e.g. "919629531891"
    const messageType = message.type;
    const timestamp = Number(message.timestamp);

    // 1. STALE MESSAGE PROTECTION:
    // Drop messages older than 300 seconds (5 min). Prevents stale bursts while tolerating network/clock variations
    if (timestamp) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - timestamp;
      if (ageSec > 300) {
        console.log(`[Stale Message Dropped] Message ID: ${messageId} is ${ageSec}s old (> 300s). Skipping.`);
        return;
      }
    }

    // 2. SELF-MESSAGE PROTECTION:
    // Ignore messages from the bot's own number to prevent loops
    const botPhone = (process.env.WHATSAPP_PHONE_NUMBER || "").replace(/\D/g, "");
    if (botPhone && from === botPhone) {
      console.log(`[Self Message Dropped] Ignoring message sent from bot's own number: +${from}`);
      return;
    }

    // 3. REACTION / SYSTEM EVENT PROTECTION:
    // Ignore emoji reactions, delivery receipts, or system messages (do NOT send bot messages for reactions)
    if (messageType === "reaction" || messageType === "system" || messageType === "order" || messageType === "unsupported") {
      console.log(`[Non-Chat Message Dropped] Ignoring event type: ${messageType}`);
      return;
    }

    // 4. DUPLICATE PROTECTION: Meta may retry webhooks if connection took > 3s
    if (isDuplicateMessage(messageId)) {
      console.log(`[Duplicate Dropped] Message ID ${messageId} was already processed.`);
      return;
    }

    console.log(`[Webhook Message Received] ID: ${messageId} | From: +${from} | Type: ${messageType}`);

    // Mark customer message as read asynchronously without blocking response
    whatsappService.markAsRead(messageId).catch(() => {});

    let userText = "";
    let buttonId = null;

    if (messageType === "text") {
      userText = message.text?.body || "";
    } else if (messageType === "interactive") {
      const interactive = message.interactive;
      if (interactive?.type === "button_reply") {
        buttonId = interactive.button_reply?.id;
        userText = interactive.button_reply?.title;
        console.log(`[Interactive Button Clicked] ID: "${buttonId}" | Title: "${userText}"`);
      } else if (interactive?.type === "list_reply") {
        buttonId = interactive.list_reply?.id;
        userText = interactive.list_reply?.title;
        console.log(`[Interactive List Selected] ID: "${buttonId}" | Title: "${userText}"`);
      }
    } else {
      // Ignore media (stickers/audio/image) without triggering random welcome sequences
      console.log(`[Media/Ignored Message Type] Type: ${messageType}. No response triggered.`);
      return;
    }

    if (!userText && !buttonId) {
      return;
    }

    // Process through Kairos Lite Chatbot Engine
    const botReplies = await chatbotService.processMessage(from, userText, buttonId, messageId);

    if (botReplies && botReplies.length > 0) {
      // Send sequence of messages quickly
      await whatsappService.sendMessageSequence(from, botReplies);
    }
  } catch (error) {
    console.error("[Webhook Error] Unexpected error processing incoming event:", error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook
};

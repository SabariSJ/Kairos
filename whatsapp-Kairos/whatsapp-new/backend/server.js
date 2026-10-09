const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const webhookRoutes = require("./routes/webhook");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for parsing JSON webhook payloads from Meta
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static media files (WhatsApp video and audio lessons)
const mediaDir = path.join(__dirname, "public", "media");
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}
app.use("/media", (req, res, next) => {
  console.log(`[Media Request] Streaming: ${req.url} | Headers: ${req.headers["range"] || "full"} | Agent: ${req.headers["user-agent"] || "unknown"}`);
  next();
});
app.use("/media", express.static(mediaDir, {
  setHeaders: (res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Accept-Ranges", "bytes");
  }
}));
// Dynamic cache-busting media fallback
app.get("/media/:filename", (req, res) => {
  const filePath = path.join(mediaDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  const mainVideo = path.join(mediaDir, "sample_lesson.mp4");
  if (fs.existsSync(mainVideo)) {
    return res.sendFile(mainVideo);
  }
  res.status(404).json({ error: "Media not found" });
});

// WhatsApp Webhook routes
app.use("/webhook", webhookRoutes);

// Server health check & status endpoint
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Kairos Lite WhatsApp Cloud API Chatbot Backend",
    phoneRegistered: process.env.WHATSAPP_PHONE_NUMBER || "+919629531891",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "1393037967216637",
    graphApiVersion: process.env.GRAPH_API_VERSION || "v26.0",
    webhookConfigured: "/webhook",
    timestamp: new Date().toISOString()
  });
});

// View captured candidate leads
app.get("/leads", (req, res) => {
  try {
    const leadsPath = path.join(__dirname, "data", "leads.json");
    if (fs.existsSync(leadsPath)) {
      const data = fs.readFileSync(leadsPath, "utf8");
      return res.json({
        totalLeads: JSON.parse(data).length,
        leads: JSON.parse(data)
      });
    }
    return res.json({ totalLeads: 0, leads: [] });
  } catch (err) {
    return res.status(500).json({ error: "Failed to read leads store" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found. Use /webhook for Meta Webhooks." });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Internal Server Error]:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start the Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================================");
  console.log("🚀 Kairos Lite WhatsApp Chatbot Backend is LIVE");
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Webhook GET/POST endpoint: http://localhost:${PORT}/webhook`);
  console.log(`📋 Candidate leads endpoint: http://localhost:${PORT}/leads`);
  console.log(`📱 WhatsApp Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID || "1393037967216637"}`);
  console.log(`🌐 Graph API Version: ${process.env.GRAPH_API_VERSION || "v26.0"}`);
  console.log("==================================================");
});

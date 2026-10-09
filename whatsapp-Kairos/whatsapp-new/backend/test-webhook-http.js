require("dotenv").config();
const express = require("express");
const axios = require("axios");
const webhookRoutes = require("./routes/webhook");

async function testHttpEndpoints() {
  const app = express();
  app.use(express.json());
  app.use("/webhook", webhookRoutes);

  const server = app.listen(5099, async () => {
    console.log("Test HTTP Server running on port 5099...");

    try {
      // Test 1: GET /webhook Verification Success
      const getRes = await axios.get("http://localhost:5099/webhook", {
        params: {
          "hub.mode": "subscribe",
          "hub.verify_token": process.env.WHATSAPP_VERIFY_TOKEN || "sproutks_webhook_verify_token_2026",
          "hub.challenge": "1158201444"
        }
      });
      console.log("GET /webhook (Valid Token) Status:", getRes.status, "Challenge:", getRes.data);
      console.assert(getRes.data === 1158201444 || getRes.data === "1158201444", "Challenge failed");

      // Test 2: GET /webhook Verification Fail (Wrong Token)
      try {
        await axios.get("http://localhost:5099/webhook", {
          params: {
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "1158201444"
          }
        });
      } catch (err) {
        console.log("GET /webhook (Wrong Token) Status:", err.response?.status, "(Expected 403 Forbidden)");
        console.assert(err.response?.status === 403, "Expected 403");
      }

      // Test 3: POST /webhook Incoming Text ("Hi")
      const postTextPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1125512693348242",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "919629531891",
                    phone_number_id: "1393037967216637"
                  },
                  messages: [
                    {
                      from: "919629531891",
                      id: "wamid.test_text_" + Date.now(),
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "text",
                      text: { body: "Hi" }
                    }
                  ]
                },
                field: "messages"
              }
            ]
          }
        ]
      };

      const postTextRes = await axios.post("http://localhost:5099/webhook", postTextPayload);
      console.log("POST /webhook (Text 'Hi') Status:", postTextRes.status, postTextRes.data);
      console.assert(postTextRes.status === 200, "Text POST failed");

      // Test 4: POST /webhook Incoming Interactive Button Click ("I agree")
      const postButtonPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1125512693348242",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "919629531891",
                    phone_number_id: "1393037967216637"
                  },
                  messages: [
                    {
                      from: "919629531891",
                      id: "wamid.test_button_" + Date.now(),
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: {
                          id: "agree",
                          title: "I agree"
                        }
                      }
                    }
                  ]
                },
                field: "messages"
              }
            ]
          }
        ]
      };

      const postBtnRes = await axios.post("http://localhost:5099/webhook", postButtonPayload);
      console.log("POST /webhook (Interactive 'I agree') Status:", postBtnRes.status, postBtnRes.data);
      console.assert(postBtnRes.status === 200, "Interactive Button POST failed");

      console.log("\n✅ ALL HTTP WEBHOOK TESTS COMPLETED SUCCESSFULLY!");
    } catch (e) {
      console.error("HTTP Webhook test error:", e.message);
    } finally {
      server.close();
    }
  });
}

testHttpEndpoints();

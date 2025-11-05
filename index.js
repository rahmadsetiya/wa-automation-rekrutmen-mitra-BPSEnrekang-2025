import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";
import { loadKnowledgeBase, getAnswerFromKnowledgeBase } from "./utils/vector.js";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// ✅ 1. Load knowledge base dari file
(async () => {
  const text = fs.readFileSync("./data/knowledge.txt", "utf-8");
  const chunks = text.split(/\n\n+/);
  await loadKnowledgeBase(chunks);
})();

// ✅ 2. Webhook verification untuk Meta Dashboard
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ✅ 3. Endpoint untuk menerima pesan masuk dari WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const changes = req.body.entry?.[0]?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body;

    console.log(`📩 Pesan dari ${from}: ${text}`);

    // 🔹 4. Proses pertanyaan via RAG (OpenAI + knowledge base)
    const reply = await getAnswerFromKnowledgeBase(text);

    // 🔹 5. Kirim jawaban balik ke WhatsApp
    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// ✅ 6. Start server
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
});

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import fs from "fs";
import { loadKnowledgeBase, getAnswerFromKnowledgeBase } from "./utils/vector.js";

dotenv.config();

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.log("📱 Scan QR ini untuk login WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("✅ WhatsApp AI bot siap!");
  await loadKnowledgeBase();
});

/**
 * Logging helper untuk simpan ke file
 */
function logInteraction(user, question, answer) {
  const logEntry = `[${new Date().toLocaleString()}]\n👤 Dari: ${user}\n❓ Pertanyaan: ${question}\n💬 Jawaban: ${answer}\n───────────────────────────────\n`;
  console.log(logEntry);
  fs.appendFileSync("logs.txt", logEntry);
}

client.on("message", async (message) => {
  const sender = message.from;
  const text = (message.body || message.caption || "").trim().toLowerCase();
  if (!text) return;

  // Daftar kata kunci yang menandakan pertanyaan
  const kw = [
    "bertanya",
    "tanya",
    "nanya",
    "bagaimana",
    "apa",
    "siapa",
    "dimana",
    "kapan",
    "kenapa",
    "bagaimana",
    "kah",
    "gimana",
    "berapa",
    "bisakah",
    "bolehkah"
  ];

  // Daftar kata yang menandakan ucapan sopan atau bukan pertanyaan
  const nonQuestionPatterns = ["terima kasih", "makasih", "ok", "sip", "siap", "mantap", "👍", "🙏", "Terimakasih"];

  // Abaikan jika pesan mengandung kata non-pertanyaan
  if (nonQuestionPatterns.some((p) => text.includes(p))) return;

  // Proses hanya jika mengandung salah satu keyword bertanya
  if (kw.some((k) => text.includes(k) || text.includes("?"))) {
    const question = kw.reduce(
      (acc, k) => acc.replace(new RegExp(k, "gi"), ""),
      text
    ).trim();

    if (!question) {
      await message.reply("Gunakan format: `bertanya <pertanyaan>`");
      return;
    }

    await message.reply("⏳ Tunggu sebentar, sedang memproses pertanyaan kamu...");

    try {
      const answer = await getAnswerFromKnowledgeBase(question);
      await message.reply(answer);
      logInteraction(sender, question, answer);
    } catch (err) {
      console.error("❌ Error saat menjawab pesan:", err);
      await message.reply("Terjadi kesalahan. Mohon coba lagi nanti.");
    }
  }
});

client.initialize();

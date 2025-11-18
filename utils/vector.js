import fs from "fs";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RetrievalQAChain } from "langchain/chains";

let vectorStore = null;

/**
 * Muat knowledge base dari file teks lokal.
 */
export async function loadKnowledgeBase() {
  const path = "./data/knowledge.txt";

  if (!fs.existsSync(path)) {
    console.error("❌ File knowledge.txt tidak ditemukan di folder data/");
    process.exit(1);
  }

  const content = fs.readFileSync(path, "utf-8").trim();
  if (!content) {
    console.error("❌ File knowledge.txt kosong.");
    process.exit(1);
  }

  const docs = content.split(/\n{2,}/g).map((t) => t.trim());
  const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  vectorStore = await MemoryVectorStore.fromTexts(docs, docs.map(() => ({})), embeddings);

  console.log(`📚 Knowledge base dimuat (${docs.length} entri).`);
}

/**
 * Dapatkan jawaban dari knowledge base.
 * ADIMAS hanya menjawab jika relevan dengan konteks rekrutmen mitra BPS Enrekang.
 */
export async function getAnswerFromKnowledgeBase(question) {
  try {
    if (!vectorStore) await loadKnowledgeBase();

    // 🕒 Pastikan waktu sesuai zona Indonesia (WITA / WIB)
    const now = new Date();
    const today = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Makassar" // atau "Asia/Jakarta" tergantung lokasi kamu
    });
    console.log(`🕓 Sekarang (server time): ${now.toISOString()}`);
    console.log(`🕒 Sekarang (Indonesia time): ${today}`);

    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 🔍 Deteksi apakah pertanyaan relevan dengan topik rekrutmen mitra
    const lowerQ = question.toLowerCase();
    const relatedKeywords = [
      "mitra",
      "bps",
      "rekrut",
      "pendaftaran",
      "sobat",
      "akun",
      "registrasi",
      "tes",
      "seleksi",
      "administrasi",
      "kompetensi",
      "pengumuman",
      "pakta",
      "integritas",
      "dokumen",
      "berkas",
      "data diri",
      "petugas",
      "enrekang",
      "daftar",
      "mendaftar",
      "jadwal",
      "login",
      "cara",
      "rekruitmen"
    ];

    const isRelevant = relatedKeywords.some((kw) => lowerQ.includes(kw));

    if (!isRelevant) {
      // ❌ Pertanyaan umum di luar konteks
      console.log(`❌ [OUT OF CONTEXT] "${question}"`);
      return "Sistem ini hanya melayani pertanyaan seputar rekrutmen mitra BPS Kabupaten Enrekang tahun 2026. Untuk pertanyaan lain, silakan hubungi admin BPS Kabupaten Enrekang. 🙏";
    }

    // ✅ Pertanyaan relevan → lanjutkan dengan knowledge base
    const retriever = vectorStore.asRetriever({ k: 3 });
    const chain = RetrievalQAChain.fromLLM(llm, retriever, {
      promptTemplate: `
Anda adalah ADIMAS, asisten virtual resmi Badan Pusat Statistik (BPS) Kabupaten Enrekang.

📅 Saat ini adalah ${today} (zona waktu Indonesia bagian tengah - WITA).
Gunakan informasi waktu ini untuk menjawab pertanyaan yang berkaitan dengan tanggal, durasi, atau status pendaftaran/seleksi.

🎯 Tugas utama Anda:
- Jawab **hanya pertanyaan seputar rekrutmen mitra BPS Kabupaten Enrekang tahun 2026**.
- Semua jawaban berdasarkan knowledge base di bawah.
- Jika pengguna menanyakan waktu atau tanggal (misalnya "sudah dimulai belum", "berapa hari lagi", "kapan dimulai"), gunakan tanggal saat ini (${today}) untuk menghitung atau menilai statusnya.
- Jika pertanyaan tidak relevan dengan topik rekrutmen, jawab:
  "Pertanyaan tersebut bukan pertanyaan terkait rekrutmen mitra BPS Kabupaten Enrekang. 🙏"
- Jika topiknya masih relevan tapi tidak ditemukan di knowledge base, jawab:
  "Pertanyaan tersebut akan diteruskan kepada admin BPS Kabupaten Enrekang. Mohon tunggu balasan selanjutnya. 🙏"
- Tambahan informasi untuk kamu, sekarang sedang berlangsung tahapan tes kompetensi online bagi calon mitra yang lolos seleksi administrasi, dari tanggal 18 hingga 26 November 2025, jadi jawablah sesuai konteks ini jika relevan. jika ditanya caranya, jelaskan tahapan cara melakukan tes kompetensi online.

Gunakan bahasa sopan, profesional, dan ringkas.

---
📚 Knowledge Base:
{context}

❓ Pertanyaan pengguna:
{question}

💬 Jawaban ADIMAS:
  `,
    });

    const response = await chain.call({ query: question });
    let answer = response.text?.trim();
    const lower = (answer || "").toLowerCase();

    // 🔁 Jika model tetap tidak menemukan atau jawab tidak jelas
    if (
      !answer ||
      lower.includes("tidak tahu") ||
      lower.includes("tidak ditemukan") ||
      lower.includes("tidak ada informasi") ||
      lower.includes("maaf") ||
      lower.length < 20
    ) {
      answer =
        "Pertanyaan tersebut akan diteruskan kepada admin BPS Kabupaten Enrekang. Mohon tunggu balasan selanjutnya. 🙏";
    }

    return answer;
  } catch (err) {
    console.error("❌ Error saat memproses knowledge base:", err.message);
    return "Terjadi kesalahan saat mengakses knowledge base. Admin akan segera membalas pesan kamu.";
  }
}

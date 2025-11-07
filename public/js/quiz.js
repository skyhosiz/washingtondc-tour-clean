// routes/quiz.js
const express = require("express");
const crypto = require("crypto");
const QuizCache = require("../models/QuizCache");
const router = express.Router();

// ---- ENV (OPENAI_API_KEY ว่างได้ -> ใช้ fallback)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ---- rate limit เบา ๆ ต่อ IP
const buckets = new Map();
function rate(limit = 30, windowMs = 60_000) {
  return (req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] || req.ip || "ip").toString();
    const now = Date.now();
    const b = buckets.get(ip) || { c: 0, t: now };
    if (now - b.t > windowMs) { b.c = 0; b.t = now; }
    if (++b.c > limit) return res.status(429).json({ error: "Too many requests" });
    buckets.set(ip, b);
    next();
  };
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const makePrompt = ({ lang, summary }) => `
คุณคือผู้ช่วยสร้างแบบทดสอบภาษา ${lang} สำหรับเว็บท่องเที่ยว/พิพิธภัณฑ์
ให้สร้าง "ข้อสอบปรนัย 3 ข้อ" ตอบกลับเป็น JSON เท่านั้น:

{
 "questions":[
   {"stem":"...", "choices":["A","B","C","D"], "answerIndex":0, "explain":"..."},
   ...
 ]
}

กติกา:
- อิงเฉพาะข้อมูลในสรุป
- ตัวเลือกผิดต้อง plausibly wrong
- อธิบายเหตุผลคำตอบ 1–2 บรรทัด
สรุปเนื้อหา:
${summary}
`.trim();

async function callLLM({ summary, lang }) {
  if (!OPENAI_API_KEY) throw new Error("NO_AI");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.1-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: makePrompt({ lang, summary }) }],
    }),
  });
  if (!resp.ok) throw new Error(`LLM_${resp.status}`);
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.questions) || parsed.questions.length !== 3) {
    throw new Error("LLM_BAD_FORMAT");
  }
  return parsed;
}

// fallback: cloze 3 ข้อจากประโยคใน summary
function fallbackQuiz(summary, lang = "th") {
  const sents = summary
    .replace(/\s+/g, " ")
    .split(/[.!?。！？]\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const qs = [];
  for (let i = 0; i < 3 && i < sents.length; i++) {
    const sent = sents[i];
    const words = sent.split(/\s+/).filter((w) => w.length > 3);
    const target = words[Math.floor(words.length / 2)] || words[0] || "____";
    const stem = `เติมคำให้ถูกต้อง: ${sent.replace(target, "_____")}`;
    const choices = [target, "ข้อมูลคลาดเคลื่อน", "คำคล้ายแต่ผิดใจความ", "คำยาวคล้ายตา"];
    qs.push({ stem, choices, answerIndex: 0, explain: `คำตอบคือ “${target}” จากประโยคต้นฉบับ` });
  }
  while (qs.length < 3) {
    qs.push({
      stem: "เลือกคำตอบที่ตรงกับเนื้อหามากที่สุด",
      choices: ["ข้อมูลในสรุป", "ข้อมูลนอกเรื่อง", "ความคิดเห็น", "โฆษณา"],
      answerIndex: 0,
      explain: "เลือกเฉพาะข้อมูลที่อยู่ในสรุป",
    });
  }
  return { questions: qs.slice(0, 3) };
}

// POST /api/quiz  → {url, lang?, summary}
router.post("/quiz", rate(), express.json(), async (req, res) => {
  try {
    const { url, lang = "th", summary } = req.body || {};
    if (!url || !summary) return res.status(400).json({ error: "missing url/summary" });

    const key = sha(url + "|" + lang + "|" + sha(summary));
    const cached = await QuizCache.findOne({ key }).lean();
    if (cached) return res.json({ fromCache: true, url, lang, questions: cached.questions });

    let out;
    try {
      out = await callLLM({ summary, lang });
    } catch {
      out = fallbackQuiz(summary, lang);
    }

    await QuizCache.create({ key, url, lang, questions: out.questions });
    res.json({ fromCache: false, url, lang, questions: out.questions });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

// POST /api/quiz/submit  → {url, answers:[{qIndex,pick}], questions:[...]}
router.post("/quiz/submit", rate(60), express.json(), async (req, res) => {
  try {
    const { url, answers = [], questions = [] } = req.body || {};
    if (!url || !Array.isArray(answers)) return res.status(400).json({ error: "bad_request" });

    const total = answers.length;
    let score = 0;
    for (let i = 0; i < answers.length; i++) {
      const pick = answers[i]?.pick;
      const ansIdx = questions?.[i]?.answerIndex ?? -1;
      if (pick === ansIdx) score++;
    }
    res.json({ score, total });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

module.exports = router;

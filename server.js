require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();

// อยู่หลัง proxy (Render / Cloudflare ฯลฯ) → ให้ rate-limit อ่าน IP จาก X-Forwarded-For ได้ถูก
app.set("trust proxy", 1);

[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "VERIFY_EMAIL_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
  "SMITHSONIAN_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
].forEach((v) => {
  if (!process.env[v]) {
    console.error(`🚨 Missing ENV: ${v}`);
    process.exit(1);
  }
});

const {
  JWT_SECRET,
  RESET_PASSWORD_SECRET,
  VERIFY_EMAIL_SECRET,
  MONGO_URI,
  CLIENT_URL,
  BREVO_API_KEY,
  SENDER_EMAIL,
  SMITHSONIAN_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  GEMINI_API_KEY,
} = process.env;

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "dc-profiles",
    allowed_formats: ["jpg", "png", "jpeg"],
    public_id: (req) =>
      req.uid ? `${req.uid}_${Date.now()}` : `anon_${Date.now()}`,
  },
});

// จำกัดขนาดไฟล์โปรไฟล์ไม่ให้บ้าเลือด (3MB พอ)
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
});

// ---------- Mongo ----------
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    profileImg: String,
    emailVerified: { type: Boolean, default: false },
  })
);

// ---------- Helpers ----------
const signToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ status: "unauthorized" });
    const { uid } = jwt.verify(token, JWT_SECRET);
    req.uid = uid;
    next();
  } catch {
    return res.status(401).json({ status: "unauthorized" });
  }
}

async function sendMailBrevo({ to, subject, html }) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: "Washington D.C. Tour" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("Brevo send fail:", r.status, t);
    throw new Error(`Brevo send fail: ${r.status} ${t}`);
  }
}

// ---------- Basic security middlewares ----------
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false, // กัน CSP ไปชน inline script ที่มีอยู่
  })
);

const allowed = [CLIENT_URL, "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("CORS blocked by server policy"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// จำกัดขนาด body กันยิง payload ยักษ์ ๆ
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

app.use(express.static(path.join(__dirname, "public")));

// ---------- Custom Mongo sanitize (แทน express-mongo-sanitize) ----------
function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
      continue;
    }
    const value = obj[key];
    if (typeof value === "object") {
      sanitizeObject(value);
    }
  }
}

app.use((req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
});

// ---------- Rate limits ----------
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ AUTH ============

// REGISTER + send verify email
app.post("/api/auth/register", registerLimiter, async (req, res) => {
  try {
    const { username = "", email = "", password = "" } = req.body || {};

    if (!email || !password) {
      return res.json({
        status: "error",
        message: "กรุณากรอกอีเมลและรหัสผ่านให้ครบ",
      });
    }

    if (!emailRegex.test(email)) {
      return res.json({
        status: "error",
        message: "รูปแบบอีเมลไม่ถูกต้อง!",
      });
    }

    // เช็ค password ฝั่ง server ให้มีความยาวขั้นต่ำ
    if (password.length < 6) {
      return res.json({
        status: "error",
        message: "รหัสผ่านควรยาวอย่างน้อย 6 ตัวอักษร",
      });
    }

    if (await User.findOne({ email })) {
      return res.json({
        status: "error",
        message: "อีเมลนี้ถูกใช้สมัครแล้ว",
      });
    }

    const user = await User.create({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      emailVerified: false,
    });

    const token = jwt.sign({ uid: user._id }, VERIFY_EMAIL_SECRET, {
      expiresIn: "1d",
    });

    const verifyUrl = `${CLIENT_URL}/verify.html?token=${encodeURIComponent(
      token
    )}`;

    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>ยืนยันอีเมล | Washington D.C. Tour</h2>
        <p>สวัสดี ${user.username || ""}</p>
        <p>ขอบคุณที่สมัครใช้งาน Washington D.C. Tour</p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ:</p>
        <p>
          <a href="${verifyUrl}"
             style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">
            ยืนยันอีเมล
          </a>
        </p>
        <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${verifyUrl}</p>
      </div>
    `;

    await sendMailBrevo({
      to: email,
      subject: "ยืนยันอีเมล | Washington D.C. Tour",
      html,
    });

    return res.json({
      status: "success",
      message:
        "สมัครสำเร็จ! กรุณาเช็กอีเมลแล้วกดลิงก์ยืนยันก่อนเข้าสู่ระบบ",
    });
  } catch (e) {
    console.error("REGISTER error:", e.message);
    res.json({
      status: "error",
      message: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    });
  }
});

// VERIFY EMAIL (โดนเรียกจาก verify.html)
app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token = "" } = req.body || {};
    if (!token) {
      return res.json({
        status: "error",
        message: "ไม่พบ token สำหรับยืนยันอีเมล",
      });
    }

    const { uid } = jwt.verify(token, VERIFY_EMAIL_SECRET);
    const user = await User.findById(uid);
    if (!user) {
      return res.json({
        status: "error",
        message: "ไม่พบบัญชีที่ตรงกับลิงก์นี้",
      });
    }

    if (user.emailVerified) {
      return res.json({
        status: "success",
        message: "อีเมลนี้ได้รับการยืนยันแล้ว คุณสามารถเข้าสู่ระบบได้เลย",
      });
    }

    user.emailVerified = true;
    await user.save();

    return res.json({
      status: "success",
      message: "ยืนยันอีเมลสำเร็จแล้ว คุณสามารถเข้าสู่ระบบได้ทันที",
    });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err.message);
    return res.json({
      status: "error",
      message: "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ",
    });
  }
});

// LOGIN (บังคับต้อง verify ก่อน)
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};

    if (!emailRegex.test(email)) {
      return res.json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const u = await User.findOne({ email });

    if (!u) {
      return res.json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    // ถ้า emailVerified ไม่มี (user เก่า) หรือ false → ให้ถือว่ายังไม่ยืนยัน
    if (u.emailVerified !== true) {
      try {
        const token = jwt.sign({ uid: u._id }, VERIFY_EMAIL_SECRET, {
          expiresIn: "1d",
        });
        const verifyUrl = `${CLIENT_URL}/verify.html?token=${encodeURIComponent(
          token
        )}`;
        const html = `
          <div style="font-family:Arial,sans-serif">
            <h2>ยืนยันอีเมล | Washington D.C. Tour</h2>
            <p>ระบบตรวจพบว่าบัญชีของคุณยังไม่ได้ยืนยันอีเมล</p>
            <p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลก่อนเข้าสู่ระบบ:</p>
            <p>
              <a href="${verifyUrl}"
                 style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">
                ยืนยันอีเมล
              </a>
            </p>
            <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${verifyUrl}</p>
          </div>
        `;
        await sendMailBrevo({
          to: u.email,
          subject: "กรุณายืนยันอีเมลเพื่อเข้าสู่ระบบ | Washington D.C. Tour",
          html,
        });
      } catch (mailErr) {
        console.error("RESEND VERIFY ERROR:", mailErr.message);
      }

      return res.json({
        status: "error",
        code: "EMAIL_NOT_VERIFIED",
        message:
          "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ ระบบได้ส่งลิงก์ยืนยันไปยังอีเมลของคุณแล้ว",
      });
    }

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) {
      return res.json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    res.json({
      status: "success",
      token: signToken(u._id.toString()),
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        profileImg: u.profileImg,
      },
    });
  } catch (e) {
    console.error("LOGIN error:", e.message);
    res.json({
      status: "error",
      message: "เข้าสู่ระบบไม่สำเร็จ",
    });
  }
});

// FORGOT
app.post("/api/auth/forgot", forgotLimiter, async (req, res) => {
  try {
    const { email = "" } = req.body || {};
    if (!email) {
      return res.json({ status: "error", message: "กรุณากรอกอีเมล" });
    }

    if (!emailRegex.test(email)) {
      return res.json({
        status: "error",
        message: "รูปแบบอีเมลไม่ถูกต้อง",
      });
    }

    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "success" });

    const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
      expiresIn: "30m",
    });

    const resetUrl = `${CLIENT_URL}/reset.html?token=${encodeURIComponent(
      token
    )}`;
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>ตั้งรหัสผ่านใหม่ | Washington D.C. Tour</h2>
        <p>กดปุ่มด้านล่างเพื่อเปลี่ยนรหัสผ่านใหม่ (ลิงก์หมดอายุใน 30 นาที)</p>
        <p>
          <a href="${resetUrl}"
             style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">
            ตั้งรหัสผ่านใหม่
          </a>
        </p>
        <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${resetUrl}</p>
      </div>
    `;

    await sendMailBrevo({
      to: email,
      subject: "ตั้งรหัสผ่านใหม่ | Washington D.C. Tour",
      html,
    });

    res.json({ status: "success" });
  } catch (e) {
    console.error("FORGOT ERROR:", e.message);
    res.status(500).json({
      status: "error",
      message: "ส่งอีเมลไม่สำเร็จ",
    });
  }
});

// RESET
app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    if (!token || !password) {
      return res.json({
        status: "error",
        message: "ข้อมูลไม่ครบ",
      });
    }

    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user) {
      return res.json({
        status: "error",
        message: "ไม่พบผู้ใช้",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({
      status: "success",
      message: "รีเซ็ตรหัสผ่านสำเร็จ",
    });
  } catch (e) {
    console.error("RESET ERROR:", e.message);
    res.status(400).json({
      status: "error",
      message: "Token ไม่ถูกต้องหรือหมดอายุ",
    });
  }
});

// PROFILE (GET – ดึงข้อมูลล่าสุดให้ profile.html ใช้)
app.get("/api/auth/profile", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.uid).select(
      "username email profileImg"
    );
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบผู้ใช้",
      });
    }

    res.json({
      status: "success",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImg: user.profileImg,
      },
    });
  } catch (err) {
    console.error("GET PROFILE ERROR:", err.message);
    res.status(500).json({
      status: "error",
      message: "ดึงข้อมูลโปรไฟล์ล้มเหลว",
    });
  }
});

// PROFILE (PUT – อัปเดตชื่อ / รูป)
app.put(
  "/api/auth/profile",
  authRequired,
  upload.single("profileImg"),
  async (req, res) => {
    try {
      const user = await User.findById(req.uid);
      if (!user) {
        return res
          .status(404)
          .json({ status: "error", message: "ไม่พบผู้ใช้" });
      }

      if (req.body.username && req.body.username.trim()) {
        user.username = req.body.username.trim();
      }

      if (req.file && req.file.path) {
        user.profileImg = req.file.path;
      }

      await user.save();

      res.json({
        status: "success",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profileImg: user.profileImg,
        },
      });
    } catch (err) {
      console.error("PROFILE UPDATE ERROR:", err.message);
      res.status(500).json({
        status: "error",
        message: "อัปเดตโปรไฟล์ล้มเหลว",
      });
    }
  }
);

// Smithsonian explore
app.get("/api/explore", authRequired, async (req, res) => {
  try {
    const query = encodeURIComponent("Washington DC");
    const url = `https://api.si.edu/openaccess/api/v1.0/search?q=${query}&api_key=${SMITHSONIAN_API_KEY}`;
    const apiResponse = await fetch(url);
    const data = await apiResponse.json();
    res.json({ status: "success", data: data.response });
  } catch (err) {
    console.error("SMITHSONIAN API ERROR:", err.message);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch data",
    });
  }
});

// AI Assistant (Gemini)
app.post("/api/assistant", async (req, res) => {
  try {
    const { q } = req.body || {};
    if (!q || !q.trim()) {
      return res.json({ reply: "โปรดพิมพ์คำถามมาก่อนนะครับ 😊" });
    }

    async function callGemini(question, retry = 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `ตอบเป็นภาษาไทยแบบไกด์ทัวร์วอชิงตัน ดี.ซี. ที่เป็นมิตร ให้ข้อมูลจริง กระชับ และสุภาพ:\n${question}`,
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);
        const data = await response.json();

        if (response.ok) {
          return (
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "ขอโทษครับ ฉันยังไม่เข้าใจคำถามนี้"
          );
        }

        if (
          data?.error?.message?.includes("overloaded") ||
          data?.error?.status === "UNAVAILABLE"
        ) {
          if (retry < 2) {
            console.warn(
              `⚠️ Gemini overloaded, retrying... (${retry + 1})`
            );
            await new Promise((r) => setTimeout(r, 1500));
            return callGemini(question, retry + 1);
          }
        }

        console.error("❌ Gemini API Error:", data);
        throw new Error("Gemini API returned an error");
      } catch (err) {
        console.error("Gemini Fetch Error:", err.message);
        if (retry < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          return callGemini(question, retry + 1);
        }
        return "ระบบ Gemini กำลังหนาแน่น โปรดลองอีกครั้งภายหลัง 😅";
      }
    }

    const reply = await callGemini(q);
    res.json({ reply });
  } catch (err) {
    console.error("Gemini Route Error:", err.message);
    res.json({
      reply: "เกิดข้อผิดพลาดในการเชื่อมต่อ Gemini 😢 โปรดลองอีกครั้งภายหลัง",
    });
  }
});

// Smithsonian proxy
app.get("/api/proxy-smithsonian/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id
      .replace(/^edanmdm:/, "edanmdm-")
      .replace(/^edanmdm--/, "edanmdm-");
    const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Smithsonian fetch failed: ${response.status}`);
    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("Proxy Smithsonian Error:", err.message);
    res.status(500).json({
      error: "Failed to fetch Smithsonian data",
      detail: err.message,
    });
  }
});

// SPA routes
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "intro.html"))
);

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

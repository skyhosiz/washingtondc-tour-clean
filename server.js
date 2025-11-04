// server.js — WashingtonDC Auth + SPA Route (Hardened, backward-compatible)
require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Polyfill fetch for Node.js environments that do not have it natively (Node <18)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

/* =============================
   ✅ ENV CHECK
============================= */
[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
  "SMITHSONIAN_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].forEach((v) => {
  if (!process.env[v]) {
    console.error(`🚨 Missing ENV: ${v}`);
    process.exit(1);
  }
});

const {
  JWT_SECRET,
  RESET_PASSWORD_SECRET,
  MONGO_URI,
  CLIENT_URL,
  BREVO_API_KEY,
  SENDER_EMAIL,
  SMITHSONIAN_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  SESSION_MODE, // optional: "cookie" เพื่อใช้ httpOnly cookie แทน bearer
} = process.env;

const USE_COOKIE = SESSION_MODE === "cookie";

/* =============================
   ☁️ CLOUDINARY & MULTER
============================= */
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
      (req.uid ? `${req.uid}_${Date.now()}` : `anon_${Date.now()}`),
    transformation: [{ width: 1024, height: 1024, crop: "limit" }],
  },
});
const upload = multer({ storage });

/* =============================
   🧠 DB & SCHEMA
============================= */
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: 'tourismAccountDB',
    authMechanism: 'SCRAM-SHA-256',
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });


const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    profileImg: String,
  })
);

/* =============================
   🔰 HARDENING (ไม่งัดฟีเจอร์เดิม)
============================= */
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security headers ที่ไม่ทำลาย SPA
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // CSP เบื้องต้น (ถ้ามี CDN/สคริปต์เพิ่มให้เติม domain เอง)
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https: blob:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://api.brevo.com https://api.si.edu https://edan.si.edu",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  next();
});

// Body limit กัน payload bomb
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// CORS allowlist
const allowed = [CLIENT_URL, "http://localhost:3000"];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("CORS blocked by server policy"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Tiny rate-limit แบบไม่พึ่ง lib
const ipHits = new Map();
function rateLimit(windowMs = 60_000, max = 30) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const slot = ipHits.get(ip) || { count: 0, start: now };
    if (now - slot.start > windowMs) {
      slot.count = 0;
      slot.start = now;
    }
    slot.count++;
    ipHits.set(ip, slot);
    if (slot.count > max)
      return res
        .status(429)
        .json({ status: "error", message: "Too many requests" });
    next();
  };
}
const authLimiter = rateLimit(60_000, 20);
const forgotLimiter = rateLimit(60_000, 5);

/* =============================
   🔐 HELPERS
============================= */
const signToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

function readCookieToken(req) {
  if (!USE_COOKIE) return null;
  const cookie = req.headers.cookie || "";
  const m = cookie && cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    const token = bearer || readCookieToken(req);
    if (!token) return res.status(401).json({ status: "unauthorized" });
    const { uid } = jwt.verify(token, JWT_SECRET);
    req.uid = uid;
    next();
  } catch {
    return res.status(401).json({ status: "unauthorized" });
  }
}

// Brevo (Sendinblue)
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
    throw new Error(`Brevo send fail: ${r.status} ${t}`);
  }
}

/* =============================
   🗂 Static
============================= */
app.use(express.static(path.join(__dirname, "public")));

/* =============================
   👤 AUTH ROUTES
============================= */
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    let { username = "", email = "", password = "" } = req.body || {};
    email = String(email || "").toLowerCase().trim();
    if (!email || !password || password.length < 8)
      return res.json({ status: "error", message: "ข้อมูลไม่ครบ!" });
    if (await User.findOne({ email }))
      return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

    await User.create({
      username,
      email,
      password: await bcrypt.hash(password, 10),
    });
    res.json({ status: "success" });
  } catch (e) {
    console.error("REGISTER error:", e.message);
    res.json({ status: "error", message: "สมัครไม่สำเร็จ" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    let { email = "", password = "" } = req.body || {};
    email = String(email || "").toLowerCase().trim();

    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });
    if (!(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "รหัสผ่านผิด!" });

    const token = signToken(u._id.toString());
    if (USE_COOKIE) {
      // ส่ง httpOnly cookie (เปิดด้วย SESSION_MODE=cookie)
      res.setHeader(
        "Set-Cookie",
        `auth_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${
          7 * 24 * 60 * 60
        }`
      );
      return res.json({
        status: "success",
        user: {
          id: u._id,
          username: u.username,
          email: u.email,
          profileImg: u.profileImg,
        },
      });
    }

    res.json({
      status: "success",
      token,
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        profileImg: u.profileImg,
      },
    });
  } catch {
    res.json({ status: "error", message: "ล็อกอินล้มเหลว" });
  }
});

/* =============================
   🔁 FORGOT / RESET PASSWORD
============================= */
app.post("/api/auth/forgot", forgotLimiter, async (req, res) => {
  try {
    let { email = "" } = req.body || {};
    email = String(email || "").toLowerCase().trim();
    if (!email) return res.json({ status: "error", message: "กรอกอีเมล" });

    const u = await User.findOne({ email });
    // ตอบ success เสมอเพื่อไม่เปิดเผยว่ามี/ไม่มีอีเมล
    if (!u) return res.json({ status: "success" });

    const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
      expiresIn: "30m",
    });

    const resetUrl = `${CLIENT_URL}/reset.html?token=${encodeURIComponent(
      token
    )}`;
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>รีเซ็ตรหัสผ่าน — Washington D.C. Tour</h2>
        <p>กดปุ่มด้านล่างเพื่อเปลี่ยนรหัสผ่านใหม่ (หมดอายุใน 30 นาที)</p>
        <p><a href="${resetUrl}" style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">ตั้งรหัสผ่านใหม่</a></p>
        <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${resetUrl}</p>
      </div>`;

    await sendMailBrevo({
      to: email,
      subject: "ตั้งรหัสผ่านใหม่ | Washington D.C. Tour",
      html,
    });

    res.json({ status: "success" });
  } catch (e) {
    console.error("FORGOT ERROR:", e.message);
    res.status(500).json({ status: "error", message: "ส่งอีเมลไม่สำเร็จ" });
  }
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    if (!token || !password || password.length < 8)
      return res.json({ status: "error", message: "ข้อมูลไม่ครบ" });

    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user) return res.json({ status: "error", message: "ไม่พบผู้ใช้" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ status: "success", message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (e) {
    console.error("RESET ERROR:", e.message);
    res
      .status(400)
      .json({ status: "error", message: "Token ไม่ถูกต้อง/หมดอายุ" });
  }
});

/* =============================
   🧍 PROFILE UPDATE
============================= */
app.put(
  "/api/auth/profile",
  authRequired,
  upload.single("profileImg"),
  async (req, res) => {
    try {
      if (req.body.username && req.body.username.trim()) {
        const newUsername = req.body.username.trim();
        if (newUsername.length < 3)
          return res.status(400).json({ status: "error", message: "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร" });
        const existingUser = await User.findOne({ username: newUsername, _id: { $ne: User._id } });
        if (existingUser)
          return res.status(400).json({ status: "error", message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });
        User.username = newUsername;
      }

      if (req.body.username && req.body.username.trim())
        User.username = req.body.username.trim();

      if (req.file && req.file.path) User.profileImg = req.file.path;

      await User.save();

      res.json({
        status: "success",
        user: {
          id: User._id,
          username: User.username,
          email: User.email,
          profileImg: User.profileImg,
        },
      });
    } catch (err) {
      console.error("PROFILE UPDATE ERROR:", err.message);
      res.status(500).json({ status: "error", message: "อัปเดตโปรไฟล์ล้มเหลว" });
    }
  }
);

/* =============================
   🏛️ EXPLORE (Smithsonian Search)
============================= */
app.get("/api/explore", authRequired, async (req, res) => {
  try {
    const query = encodeURIComponent("Washington DC");
    const url = `https://api.si.edu/openaccess/api/v1.0/search?q=${query}&api_key=${SMITHSONIAN_API_KEY}`;
    const apiResponse = await fetch(url);
    const data = await apiResponse.json();
    res.json({ status: "success", data: data.response });
  } catch (err) {
    console.error("SMITHSONIAN API ERROR:", err.message);
    res.status(500).json({ status: "error", message: "Failed to fetch data" });
  }
});

/* =============================
   ✅ PROXY Smithsonian
============================= */
app.get("/api/proxy-smithsonian/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id
      .replace(/^edanmdm:/, "edanmdm-")
      .replace(/^edanmdm--/, "edanmdm-");
    const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Smithsonian fetch failed: ${response.status}`);

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    res.json(data);
  } catch (err) {
    console.error("Proxy Smithsonian Error:", err.message);
    res.status(500).json({ error: "Failed to fetch Smithsonian data", detail: err.message });
  }
});

/* =============================
   🌐 SPA STATIC ROUTE (ต้องไว้ท้ายสุด!)
============================= */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =============================
   🟢 START
============================= */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

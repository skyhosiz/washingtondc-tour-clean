// server.js — WashingtonDC Auth + SPA + Refresh Token (Express 5 + Secure)
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

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
  CLIENT_URL_2,
} = process.env;

/* =============================
   ☁️ CLOUDINARY
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
      req.uid ? `${req.uid}_${Date.now()}` : `anon_${Date.now()}`,
  },
});
const upload = multer({ storage });

/* =============================
   🧠 DB
============================= */
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
    emailVerified: { type: Boolean, default: false }, // เผื่อ Phase ถัดไป
  })
);

/* =============================
   🔐 TOKEN HELPERS
============================= */
// Access token อายุสั้น (แนะ ~15 นาที)
const signAccess = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "15m" });
// Refresh token อายุยาว (7 วัน) — เก็บใน httpOnly cookie
const signRefresh = (uid) =>
  jwt.sign({ uid, typ: "refresh" }, JWT_SECRET, { expiresIn: "7d" });

function setRefreshCookie(res, token) {
  res.cookie("rt", token, {
    httpOnly: true,
    secure: true, // Render = HTTPS
    sameSite: "lax",
    path: "/api/auth", // จำกัดเส้นทาง
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("rt", { path: "/api/auth" });
}

function authRequired(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ status: "unauthorized" });
    const { uid } = jwt.verify(token, JWT_SECRET);
    req.uid = uid;
    next();
  } catch {
    return res.status(401).json({ status: "unauthorized" });
  }
}

/* =============================
   🛡️ SECURITY & CORE MIDDLEWARE
============================= */
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(
  helmet.hsts({
    maxAge: 15552000,
    includeSubDomains: true,
    preload: true,
  })
);

// CORS — เสิร์ฟหน้าเว็บจากโดเมนเดียวกับ API จะชิลสุด
const allowed = [
  CLIENT_URL,
  CLIENT_URL_2,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked by policy"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // ให้ cookie refresh วิ่งได้ข้ามที่มาที่อนุญาต
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* =============================
   🧯 RATE LIMITS
============================= */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { status: "error", message: "Too many login attempts" },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { status: "error", message: "Too many register attempts" },
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", registerLimiter);

/* =============================
   👤 AUTH ROUTES
============================= */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username = "", email = "", password = "" } = req.body || {};
    if (!email || !password)
      return res.json({ status: "error", message: "ข้อมูลไม่ครบ!" });
    if (await User.findOne({ email }))
      return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

    await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
    });

    res.json({ status: "success" });
  } catch (e) {
    console.error("REGISTER error:", e.message);
    res.json({ status: "error", message: "สมัครไม่สำเร็จ" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const u = await User.findOne({ email: email.trim().toLowerCase() });
    if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });
    if (!(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "รหัสผ่านผิด!" });

    const at = signAccess(u._id.toString());
    const rt = signRefresh(u._id.toString());
    setRefreshCookie(res, rt);

    res.json({
      status: "success",
      token: at,
      user: {
        id: u._id,
        username: u.username,
        email: u.email,
        profileImg: u.profileImg,
      },
    });
  } catch (e) {
    console.error("LOGIN error:", e.message);
    res.json({ status: "error", message: "ล็อกอินล้มเหลว" });
  }
});

// 🔁 Refresh access token ด้วย refresh token (cookie)
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { rt } = req.cookies || {};
    if (!rt) return res.status(401).json({ status: "unauthorized" });
    const payload = jwt.verify(rt, JWT_SECRET);
    if (payload.typ !== "refresh")
      return res.status(401).json({ status: "unauthorized" });

    // ออก access token ใหม่ + โรเตท refresh token (ป้องกัน token reuse)
    const at = signAccess(payload.uid);
    const newRt = signRefresh(payload.uid);
    setRefreshCookie(res, newRt);

    res.json({ status: "success", token: at });
  } catch (e) {
    console.error("REFRESH error:", e.message);
    return res.status(401).json({ status: "unauthorized" });
  }
});

// 🚪 Logout — ล้าง refresh cookie
app.post("/api/auth/logout", (req, res) => {
  clearRefreshCookie(res);
  return res.json({ status: "success" });
});

// 👤 Profile (ต้องมี access token)
app.get("/api/auth/profile", authRequired, async (req, res) => {
  const u = await User.findById(req.uid).lean();
  if (!u) return res.status(404).json({ status: "error", message: "ไม่พบผู้ใช้" });
  res.json({
    status: "success",
    user: {
      id: u._id,
      username: u.username,
      email: u.email,
      profileImg: u.profileImg,
    },
  });
});

/* =============================
   🔁 FORGOT / RESET (ของเดิม)
============================= */
app.post("/api/auth/forgot", async (req, res) => {
  const { email = "" } = req.body || {};
  if (!email) return res.json({ status: "error", message: "กรอกอีเมล" });
  const u = await User.findOne({ email: email.trim().toLowerCase() });
  if (!u) return res.json({ status: "success" });

  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
    expiresIn: "30m",
  });

  const resetUrl = `${CLIENT_URL}/reset.html?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>รีเซ็ตรหัสผ่าน — Washington D.C. Tour</h2>
      <p>กดปุ่มด้านล่างเพื่อเปลี่ยนรหัสผ่านใหม่ (หมดอายุใน 30 นาที)</p>
      <p><a href="${resetUrl}" style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">ตั้งรหัสผ่านใหม่</a></p>
      <p>หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวาง:<br>${resetUrl}</p>
    </div>`;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: "Washington D.C. Tour" },
      to: [{ email }],
      subject: "ตั้งรหัสผ่านใหม่ | Washington D.C. Tour",
      htmlContent: html,
    }),
  });

  res.json({ status: "success" });
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user) return res.json({ status: "error", message: "ไม่พบผู้ใช้" });
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "Token หมดอายุ/ไม่ถูกต้อง" });
  }
});

/* =============================
   🏛️ EXPLORE (ต้อง login)
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
    const normalizedId = req.params.id.replace(/^edanmdm:/, "edanmdm-");
    const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Smithsonian fetch failed: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy Smithsonian Error:", err.message);
    res.status(500).json({ error: "Failed to fetch Smithsonian data" });
  }
});

/* =============================
   🌐 SPA STATIC (index.html)
============================= */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =============================
   🟢 START
============================= */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Running → PORT ${port}`));

// server.js — WashingtonDC Auth + SPA Route (Express 5 OK)
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");

const app = express();

/* =============================
   ENV CHECK
============================= */
[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
].forEach(v => {
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
} = process.env;

/* =============================
   MIDDLEWARE
============================= */
app.disable("x-powered-by");

const allowed = [CLIENT_URL, "http://localhost:3000"];
app.use(cors({
  origin: (origin, cb) =>
    !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("CORS blocked")),
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Public static
app.use(express.static(path.join(__dirname, "public")));

// ✅ Preflight (FIXED from "*" to /.*/ for Express 5+)
app.options(/.*/, cors());

/* =============================
   DB CONNECT
============================= */
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =============================
   USER
============================= */
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String,
});
const User = mongoose.model("User", userSchema);

/* =============================
   HELPERS
============================= */
const signToken = (uid) =>
  jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

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

/* =============================
   EMAIL RESET
============================= */
async function sendResetEmail(email, token) {
  const resetUrl = `${CLIENT_URL}/reset.html?token=${token}`;
  const payload = {
    sender: { email: SENDER_EMAIL, name: "Washington DC Travel" },
    to: [{ email }],
    subject: "🔐 รีเซ็ตรหัสผ่าน",
    htmlContent: `
      <h2>กู้คืนรหัสผ่าน</h2>
      <a href="${resetUrl}" style="background:#ff8a25;padding:10px 14px;border-radius:8px;color:white;text-decoration:none;display:inline-block;">
        รีเซ็ตรหัสผ่าน
      </a>
      <p style="margin-top:8px;">ลิงก์หมดอายุใน 30 นาที ⏳</p>
    `,
  };

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
    body: JSON.stringify(payload),
  });

  const out = await r.json().catch(() => ({}));
  if (!r.ok) console.error("Brevo send error:", out);
}

/* =============================
   AUTH ROUTES
============================= */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username = "", email = "", password = "" } = req.body || {};
    if (!email || !password)
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
    if (e.code === 11000)
      return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

    console.error("REGISTER error:", e.message);
    res.json({ status: "error", message: "สมัครไม่สำเร็จ" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });
    if (!(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "รหัสผ่านผิด!" });

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
  } catch {
    res.json({ status: "error", message: "ล็อกอินล้มเหลว" });
  }
});

app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email = "" } = req.body || {};
    const u = await User.findOne({ email });
    if (u) {
      const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, { expiresIn: "30m" });
      await sendResetEmail(email, token);
    }
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "ส่งอีเมลไม่สำเร็จ" });
  }
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token = "", password = "" } = req.body || {};
    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    await User.findByIdAndUpdate(uid, { password: await bcrypt.hash(password, 10) });
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "ลิงก์หมดอายุ/ไม่ถูกต้อง" });
  }
});

app.get("/api/auth/profile", authRequired, async (req, res) => {
  const u = await User.findById(req.uid).lean();
  if (!u) return res.status(401).json({ status: "unauthorized" });
  res.json({ status: "success", user: u });
});

/* =============================
   SPA STATIC ROUTE ✅
============================= */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =============================
   START ✅
============================= */
const port = process.env.PORT || 10000;
app.listen(port, () =>
  console.log(`🚀 Server Online → PORT ${port}`)
);
// server.js — WashingtonDC Auth + SPA Route (Express 5 OK)
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary"); // <-- 1. Require ต้องอยู่บนสุด

const app = express();

/* =============================
   ENV CHECK & VARIABLES
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
} = process.env;

/* =============================
   CLOUDINARY & MULTER SETUP (FIXED POSITION)
============================= */
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "dc-profiles",
    allowed_formats: ["jpg", "png", "jpeg"],
    public_id: (req, file) => `${req.uid}_${Date.now()}`,
  },
});

const upload = multer({ storage: storage }); // <-- 2. ตัวแปร 'upload' ถูกนิยามตรงนี้ก่อนถูกใช้

/* =============================
   DB CONNECT
============================= */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =============================
   USER SCHEMA
============================= */
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String,
});
const User = mongoose.model("User", userSchema);

/* =============================
   HELPERS & MIDDLEWARE (FIXED POSITION)
============================= */
const signToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ status: "unauthorized" });
    const { uid } = jwt.verify(token, JWT_SECRET);
    req.uid = uid;
    next(); // <--- 3. ฟังก์ชันนี้ถูกนิยามก่อนถูกใช้
  } catch {
    return res.status(401).json({ status: "unauthorized" });
  }
}

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
   MIDDLEWARE (App Setup)
============================= */
app.disable("x-powered-by");

const allowed = [CLIENT_URL, "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS blocked")),
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.options(/.*/, cors());

/* =============================
   AUTH ROUTES (Start of App Logic)
============================= */
app.post("/api/auth/register", async (req, res) => {
  /* ... */
});
app.post("/api/auth/login", async (req, res) => {
  /* ... */
});
app.post("/api/auth/forgot", async (req, res) => {
  /* ... */
});
app.post("/api/auth/reset", async (req, res) => {
  /* ... */
});
app.get("/api/auth/profile", authRequired, async (req, res) => {
  /* ... */
});

/* =============================
   UPDATE PROFILE ROUTE (Uses 'upload')
============================= */
app.put(
  "/api/auth/profile",
  authRequired,
  upload.single("profileImg"), // <-- 4. 'upload' ถูกเรียกใช้ตรงนี้ (แต่ถูกนิยามไปแล้วใน Group 2)
  async (req, res) => {
    // ... (โค้ด Profile Update เหมือนเดิม) ...
  }
);

/* =============================
   API EXPLORE ROUTE
============================= */
app.get("/api/explore", authRequired, async (req, res) => {
  // ... (โค้ด Smithsonian API เหมือนเดิม) ...
});

/* =============================
   SPA STATIC ROUTE & START
============================= */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;

app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

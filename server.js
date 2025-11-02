// ✅ Stable server.js — WashingtonDC Auth + Profile Upload
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const { z } = require("zod");

// ✅ Upload & Cloudinary
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

/* =========================
   Security & Core
========================= */
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

/* Static */
app.use(express.static(path.join(__dirname, "public")));

/* Rate limit (เบา ๆ ให้ production วิ่งได้) */
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

/* Health check */
app.get("/ping", (_req, res) => res.json({ ok: true }));

/* =========================
   MongoDB
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =========================
   User Model
========================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    profileImg: String,
  })
);

/* =========================
   JWT Helpers
========================= */
const signToken = (uid) =>
  jwt.sign({ uid }, process.env.JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.json({ status: "unauthorized" });
    req.uid = jwt.verify(token, process.env.JWT_SECRET).uid;
    next();
  } catch {
    return res.json({ status: "unauthorized" });
  }
}

/* =========================
   Validation Schemas
========================= */
const emailSchema = z.string().email("อีเมลไม่ถูกต้อง");
const pwSchema = z.string().min(6, "รหัสผ่าน >= 6 ตัว");

/* =========================
   Cloudinary
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: { folder: "profile_pics", resource_type: "image" },
  }),
});

/* =========================
   Email (Brevo)
========================= */
async function sendResetEmail(email, token) {
  const link = `${process.env.CLIENT_URL}/reset.html?token=${token}`;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: process.env.SENDER_EMAIL },
      to: [{ email }],
      subject: "🔐 Reset Password",
      htmlContent: `<a href="${link}">กดเพื่อรีเซ็ตรหัสผ่าน</a>`,
    }),
  });
}

/* =========================
   AUTH Routes
========================= */
// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const valid = z
    .object({ username: z.string(), email: emailSchema, password: pwSchema })
    .safeParse(req.body);

  if (!valid.success)
    return res.json({ status: "error", message: valid.error.issues[0].message });

  const { username, email, password } = valid.data;
  if (await User.findOne({ email }))
    return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

  await User.create({
    username,
    email,
    password: await bcrypt.hash(password, 10),
  });

  res.json({ status: "success" });
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const valid = z
    .object({ email: emailSchema, password: z.string() })
    .safeParse(req.body);

  if (!valid.success)
    return res.json({ status: "error", message: "ข้อมูลไม่ถูกต้อง" });

  const { email, password } = valid.data;
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(password, u.password)))
    return res.json({ status: "error", message: "ข้อมูลไม่ถูกต้อง" });

  res.json({
    status: "success",
    token: signToken(u._id),
    user: {
      id: u._id,
      username: u.username,
      email: u.email,
      profileImg: u.profileImg,
    },
  });
});

// FORGOT
app.post("/api/auth/forgot", async (req, res) => {
  const valid = emailSchema.safeParse(req.body.email);
  if (!valid.success) return res.json({ status: "success" });

  const u = await User.findOne({ email: valid.data });
  if (u) {
    const token = jwt.sign({ uid: u._id }, process.env.RESET_PASSWORD_SECRET, {
      expiresIn: "30m",
    });
    await sendResetEmail(u.email, token);
  }
  res.json({ status: "success" });
});

// RESET
app.post("/api/auth/reset", async (req, res) => {
  const valid = z
    .object({ token: z.string(), password: pwSchema })
    .safeParse(req.body);

  if (!valid.success)
    return res.json({ status: "error", message: valid.error.issues[0].message });

  try {
    const { uid } = jwt.verify(valid.data.token, process.env.RESET_PASSWORD_SECRET);
    const u = await User.findById(uid);
    u.password = await bcrypt.hash(valid.data.password, 10);
    await u.save();
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "ลิงก์หมดอายุ/ไม่ถูกต้อง" });
  }
});

// PROFILE (GET)
app.get("/api/auth/profile", authRequired, async (_req, res) => {
  const u = await User.findById(_req.uid).lean();
  res.json({ status: "success", user: u });
});

// PROFILE (UPDATE username + image)
app.put("/api/auth/profile", authRequired, upload.single("profileImg"), async (req, res) => {
  const update = {
    username: req.body.username || undefined,
    profileImg: req.file?.path,
  };
  const u = await User.findByIdAndUpdate(req.uid, update, { new: true });
  res.json({ status: "success", user: u });
});

/* =========================
   Default Page
========================= */
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

/* =========================
   Start
========================= */
app.listen(process.env.PORT || 10000, () =>
  console.log(`🚀 Server Online → ${process.env.CLIENT_URL}`)
);

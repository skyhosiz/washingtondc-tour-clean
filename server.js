// server.js — WashingtonDC Auth + SPA Route (Express 5 OK)

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors"); // ตรวจสอบว่า cors ถูก import แล้ว
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const app = express();

/* =============================
   ENV CHECK & VARIABLES
============================= */

[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "MONGO_URI",
  "CLIENT_URL", // ตรวจสอบว่ามีค่านี้
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
  CLIENT_URL, // ตรวจสอบว่ามีค่านี้
  BREVO_API_KEY,
  SENDER_EMAIL,
  SMITHSONIAN_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

/* =============================
   CLOUDINARY & MULTER SETUP
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
    public_id: (req, file) => {
      if (!req.uid) return `anon_${Date.now()}`;
      return `${req.uid}_${Date.now()}`;
    },
  },
});

const upload = multer({ storage: storage });

/* =============================
   DB CONNECT & USER SCHEMA
============================= */

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String,
});

const User = mongoose.model("User", userSchema);

/* =============================
   HELPERS & MIDDLEWARE
============================= */

const signToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ status: "unauthorized" });
    const { uid } = jwt.verify(token, JWT_SECRET);
    req.uid = uid;
    next(); // ✅ FIX: ต้องเรียก next() เสมอเมื่อตรวจสอบสำเร็จ
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

// อาร์เรย์ของ Origin ที่อนุญาต
const allowed = [CLIENT_URL, "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) => {
      // สำหรับคำขอที่ไม่มี Origin (เช่น จาก Postman หรือคำขอภายในเซิร์ฟเวอร์เอง) ให้ถือว่าอนุญาต
      if (!origin) {
        return cb(null, true);
      }
      // ตรวจสอบว่า Origin ที่ร้องขออยู่ในรายการที่อนุญาตหรือไม่
      if (allowed.includes(origin)) {
        return cb(null, true);
      }
      // ถ้าไม่อยู่ในรายการที่อนุญาต ให้ปฏิเสธ
      cb(new Error("CORS blocked by server policy"));
    },
    methods: ["GET", "POST", "PUT", "OPTIONS"], // ระบุ methods ที่อนุญาต รวมถึง OPTIONS
    allowedHeaders: ["Content-Type", "Authorization"], // ระบุ headers ที่อนุญาต
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ลบบรรทัดนี้ออก เนื่องจาก cors middleware ด้านบนจัดการ OPTIONS requests ไปแล้ว
// app.options(/.*/, cors());

/* =============================
   AUTH ROUTES (Start of App Logic)
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
      const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
        expiresIn: "30m",
      });
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
    await User.findByIdAndUpdate(uid, {
      password: await bcrypt.hash(password, 10),
    });
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
   UPDATE PROFILE ROUTE
============================= */

app.put(
  "/api/auth/profile",
  authRequired,
  upload.single("profileImg"),
  async (req, res) => {
    try {
      const { username } = req.body;
      const updateData = {};
      if (username && username.trim() !== "") {
        updateData.username = username.trim();
      }
      if (req.file) {
        updateData.profileImg = req.file.path;
      }
      if (Object.keys(updateData).length === 0) {
        const currentUser = await User.findById(req.uid).lean();
        return res.json({ status: "success", user: currentUser });
      }
      const updatedUser = await User.findByIdAndUpdate(
        req.uid,
        { $set: updateData },
        { new: true }
      ).lean();
      if (!updatedUser) {
        return res
          .status(404)
          .json({ status: "error", message: "User not found" });
      }
      res.json({
        status: "success",
        user: updatedUser,
      });
    } catch (e) {
      console.error("PROFILE UPDATE ERROR:", e);
      res
        .status(500)
        .json({ status: "error", message: "Server error during update" });
    }
  }
);

/* =============================
   API EXPLORE ROUTE
============================= */

app.get("/api/explore", authRequired, async (req, res) => {
  try {
    const query = encodeURIComponent("Washington DC");
    const url = `https://api.si.edu/openaccess/api/v1.0/search?q=${query}&api_key=${SMITHSONIAN_API_KEY}`;
    const apiResponse = await fetch(url);
    if (!apiResponse.ok) {
      throw new Error(`API call failed with status ${apiResponse.status}`);
    }
    const data = await apiResponse.json();
    res.json({ status: "success", data: data.response });
  } catch (err) {
    console.error("SMITHSONIAN API ERROR:", err.message);
    res.status(500).json({ status: "error", message: "Failed to fetch data" });
  }
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

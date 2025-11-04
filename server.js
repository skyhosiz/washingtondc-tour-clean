// server.js — WashingtonDC Auth + SPA Route (Express 5 OK)
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// ❌ อย่า require("node-fetch") — Node 18+ มี fetch เป็น global แล้ว
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* =============================
   ✅ ENV CHECK & VARIABLES
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
    public_id: (req) => (req.uid ? `${req.uid}_${Date.now()}` : `anon_${Date.now()}`),
  },
});
const upload = multer({ storage });

/* =============================
   🧠 DB & SCHEMA
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
  })
);

/* =============================
   🔐 HELPERS
============================= */
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

// Brevo (Sendinblue) — ส่งอีเมล
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
   ⚙️ GLOBAL MIDDLEWARE
============================= */
app.disable("x-powered-by");
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

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

/* =============================
   🔁 FORGOT / RESET PASSWORD
============================= */
app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email = "" } = req.body || {};
    if (!email) return res.json({ status: "error", message: "กรอกอีเมล" });

    const u = await User.findOne({ email });
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
    if (!token || !password)
      return res.json({ status: "error", message: "ข้อมูลไม่ครบ" });

    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user) return res.json({ status: "error", message: "ไม่พบผู้ใช้" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ status: "success", message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (e) {
    console.error("RESET ERROR:", e.message);
    res.status(400).json({ status: "error", message: "Token ไม่ถูกต้อง/หมดอายุ" });
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
      const user = await User.findById(req.uid);
      if (!user) return res.status(404).json({ status: "error", message: "ไม่พบผู้ใช้" });

      if (req.body.username && req.body.username.trim())
        user.username = req.body.username.trim();

      if (req.file && req.file.path) user.profileImg = req.file.path;

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
    const normalizedId = id.replace(/^edanmdm:/, "edanmdm-").replace(/^edanmdm--/, "edanmdm-");
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
✅ INTRO STATIC PAGE  <-- (เพิ่มเฉพาะตรงนี้)
============================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "intro.html"));
});

/* =============================
🌐 SPA STATIC ROUTE (ต้องไว้ท้ายสุด!)
============================= */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =============================
🟢 START SERVER
============================= */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

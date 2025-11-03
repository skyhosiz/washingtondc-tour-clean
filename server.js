// server.js — WashingtonDC Tour + Auth API (Express 5)
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const SibApiV3Sdk = require("sib-api-v3-sdk");

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
    public_id: (req, file) =>
      req.uid ? `${req.uid}_${Date.now()}` : `anon_${Date.now()}`,
  },
});
const upload = multer({ storage });

/* =============================
   🧠 DATABASE & SCHEMA
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
    res.status(401).json({ status: "unauthorized" });
  }
}

/* =============================
   ⚙️ MIDDLEWARE (CORS + STATIC)
============================= */
app.disable("x-powered-by");
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || [CLIENT_URL, "http://localhost:3000"].includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS blocked")),
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
    const { username, email, password } = req.body || {};
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
    const { email, password } = req.body || {};
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
   📧 FORGOT PASSWORD + RESET
============================= */
app.post("/api/auth/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: "error", message: "ไม่พบบัญชีนี้" });

    const token = jwt.sign({ uid: user._id }, RESET_PASSWORD_SECRET, {
      expiresIn: "30m",
    });
    const resetLink = `${CLIENT_URL}/reset.html?token=${token}`;

    // ✅ ส่งอีเมลผ่าน Brevo (Sendinblue)
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
      BREVO_API_KEY;

    await apiInstance.sendTransacEmail({
      sender: { email: SENDER_EMAIL, name: "WashingtonDC Portal" },
      to: [{ email }],
      subject: "รีเซ็ตรหัสผ่านของคุณ",
      htmlContent: `<p>คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน (ภายใน 30 นาที)</p>
      <a href="${resetLink}" style="color:#ff9800;">${resetLink}</a>`,
    });

    res.json({ status: "success", message: "ส่งอีเมลรีเซ็ตเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("FORGOT ERROR:", err.message);
    res.status(500).json({ status: "error", message: "ส่งอีเมลล้มเหลว" });
  }
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ status: "error", message: "ไม่พบผู้ใช้" });

    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ status: "success", message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.error("RESET ERROR:", err.message);
    res.status(500).json({ status: "error", message: "โทเคนหมดอายุหรือไม่ถูกต้อง" });
  }
});

/* =============================
   🧍‍♂️ PROFILE UPDATE
============================= */
app.put("/api/auth/profile", authRequired, upload.single("profileImg"), async (req, res) => {
  try {
    const user = await User.findById(req.uid);
    if (!user)
      return res.status(404).json({ status: "error", message: "ไม่พบผู้ใช้" });

    if (req.body.username?.trim()) user.username = req.body.username.trim();
    if (req.file?.path) user.profileImg = req.file.path;

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
});

/* =============================
   🏛️ PROXY Smithsonian
============================= */
app.get("/api/proxy-smithsonian/:id", async (req, res) => {
  try {
    const normalizedId = req.params.id.replace(/^edanmdm:/, "edanmdm-");
    const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Smithsonian fetch failed: ${response.status}`);
    res.json(await response.json());
  } catch (err) {
    console.error("Proxy Smithsonian Error:", err.message);
    res.status(500).json({ error: "Fetch Smithsonian failed" });
  }
});

/* =============================
   🌐 SPA STATIC ROUTE
============================= */
app.get(/.*/, (req, res, next) =>
  req.path.startsWith("/api")
    ? next()
    : res.sendFile(path.join(__dirname, "public", "index.html"))
);

/* =============================
   🟢 START SERVER
============================= */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

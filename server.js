// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");                 // Brevo API (CJS)
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const xss = require("xss-clean");
const morgan = require("morgan");
const { z } = require("zod");

// ⬇️ Upload & Cloudinary
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

/* =========================
   ✅ ENV CHECK
========================= */
[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
  // ⬇️ เพิ่มสำหรับอัปโหลดรูป
  "CLOUD_NAME",
  "CLOUD_API_KEY",
  "CLOUD_API_SECRET",
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
  CLOUD_NAME,
  CLOUD_API_KEY,
  CLOUD_API_SECRET,
} = process.env;

/* =========================
   ✅ CORE MIDDLEWARE (SECURITY STACK)
========================= */
app.disable("x-powered-by");
app.set("trust proxy", 1); // Render/Proxy ให้ rate-limit แม่น

// CORS — allow prod + localhost dev
const allowed = [CLIENT_URL, "http://localhost:3000", "http://127.0.0.1:3000"];
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("Blocked by CORS")),
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

// Global limiter + slowdown
app.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  slowDown({
    windowMs: 10 * 60 * 1000,
    delayAfter: 40,
    delayMs: 500,
  })
);

/* =========================
   ✅ DB CONNECT
========================= */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* =========================
   ✅ USER MODEL
========================= */
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String,
  // resetTokenHash: String, resetTokenExp: Date  // (เผื่ออัปเกรดแบบ one-time link)
});
const User = mongoose.model("User", userSchema);

/* =========================
   ✅ HELPERS
========================= */
const signToken = (uid) =>
  jwt.sign({ uid, aud: "washingtondc", iss: "api.wdc" }, JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.json({ status: "unauthorized" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.uid = decoded.uid;
    next();
  } catch {
    return res.json({ status: "unauthorized" });
  }
}

// Zod validation helper
function validate(schema, key = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      return res.json({ status: "error", message: result.error.issues[0].message });
    }
    req[key] = result.data;
    next();
  };
}

const emailSchema = z.string().email("อีเมลไม่ถูกต้อง");
const pwSchema = z
  .string()
  .min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร")
  .max(64)
  .regex(/[A-Z]/, "ต้องมีตัวใหญ่ A-Z")
  .regex(/[a-z]/, "ต้องมีตัวเล็ก a-z")
  .regex(/[0-9]/, "ต้องมีตัวเลข")
  .regex(/[^A-Za-z0-9]/, "ต้องมีอักขระพิเศษ");

/* =========================
   ✅ Cloudinary + Multer
========================= */
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: CLOUD_API_KEY,
  api_secret: CLOUD_API_SECRET,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile_pics",
    resource_type: "image",
    format: async (_req, file) => (file.mimetype === "image/png" ? "png" : "jpg"),
    transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face", quality: "auto" }],
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* =========================
   ✅ EMAIL SENDER — Brevo API
========================= */
async function sendResetEmail(email, token) {
  const resetUrl = `${CLIENT_URL}/reset.html?token=${token}`;
  const payload = {
    sender: { email: SENDER_EMAIL, name: "Washington DC Travel" },
    to: [{ email }],
    subject: "🔐 รีเซ็ตรหัสผ่าน",
    htmlContent: `
      <h2>กู้คืนรหัสผ่าน</h2>
      <p>คลิกปุ่มเพื่อเปลี่ยนรหัสผ่านใหม่</p>
      <a href="${resetUrl}" style="background:#ff8a25;padding:10px 14px;border-radius:8px;color:#fff;text-decoration:none;display:inline-block;">
        รีเซ็ตรหัสผ่าน
      </a>
      <p style="margin-top:12px;">ลิงก์หมดอายุใน 30 นาที ⏳</p>
    `,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
    body: JSON.stringify(payload),
  });
  const out = await res.json();
  if (!res.ok) {
    console.error("Brevo error:", out);
    throw new Error("Email send failed");
  }
  return out;
}

/* =========================
   ✅ ROUTE-LEVEL PROTECTION
========================= */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const forgotLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

/* =========================
   ✅ AUTH ROUTES
========================= */
// REGISTER
app.post(
  "/api/auth/register",
  validate(
    z.object({
      username: z.string().min(1, "กรอกชื่อผู้ใช้"),
      email: emailSchema,
      password: pwSchema,
    })
  ),
  async (req, res) => {
    const { username, email, password } = req.body;
    if (await User.findOne({ email }))
      return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

    await User.create({
      username,
      email,
      password: await bcrypt.hash(password, 10),
    });

    res.json({ status: "success" });
  }
);

// LOGIN
app.post(
  "/api/auth/login",
  loginLimiter,
  validate(z.object({ email: emailSchema, password: z.string().min(1) })),
  async (req, res) => {
    const { email, password } = req.body;
    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });
    if (!(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "รหัสผ่านผิด!" });

    res.json({
      status: "success",
      token: signToken(u._id.toString()),
      user: { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg },
    });
  }
);

// FORGOT
app.post(
  "/api/auth/forgot",
  forgotLimiter,
  validate(z.object({ email: emailSchema })),
  async (req, res) => {
    const { email } = req.body;
    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "success" }); // ไม่บอกว่าอีเมลมี/ไม่มี

    const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, { expiresIn: "30m" });
    try {
      await sendResetEmail(email, token);
      res.json({ status: "success" });
    } catch {
      res.json({ status: "error", message: "ส่งอีเมลไม่สำเร็จ" });
    }
  }
);

// RESET
app.post(
  "/api/auth/reset",
  validate(z.object({ token: z.string().min(10), password: pwSchema })),
  async (req, res) => {
    const { token, password } = req.body;

    try {
      const decoded = jwt.verify(token, RESET_PASSWORD_SECRET);
      const user = await User.findById(decoded.uid);
      if (!user) return res.json({ status: "error", message: "ไม่พบบัญชี" });

      // กันใช้รหัสเดิมซ้ำ
      const isSame = await bcrypt.compare(password, user.password);
      if (isSame) return res.json({ status: "error", message: "ห้ามใช้รหัสผ่านเดิม" });

      user.password = await bcrypt.hash(password, 10);
      await user.save();

      res.json({ status: "success" });
    } catch {
      res.json({ status: "error", message: "ลิงก์หมดอายุ/ไม่ถูกต้อง" });
    }
  }
);

/* =========================
   ✅ PROFILE ROUTES (Protected)
========================= */
// GET my profile (ใช้ localStorage ก็ได้ แต่ทำให้ครบฝั่ง server)
app.get("/api/auth/profile", authRequired, async (req, res) => {
  const u = await User.findById(req.uid).lean();
  if (!u) return res.json({ status: "unauthorized" });
  const user = { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg };
  res.json({ status: "success", user });
});

// PUT update username + image (multipart/form-data: profileImg)
app.put("/api/auth/profile", authRequired, upload.single("profileImg"), async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.username === "string" && req.body.username.trim()) {
      update.username = req.body.username.trim();
    }
    if (req.file?.path) update.profileImg = req.file.path;

    const u = await User.findByIdAndUpdate(req.uid, update, { new: true });
    const user = { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg };
    res.json({ status: "success", user });
  } catch (e) {
    console.error("Profile Update Error:", e.message);
    res.json({ status: "error", message: "อัปเดตล้มเหลว" });
  }
});

/* =========================
   ✅ DEFAULT ROUTE (Static)
========================= */
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

/* =========================
   ✅ START
========================= */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Online → http://localhost:${port}`));

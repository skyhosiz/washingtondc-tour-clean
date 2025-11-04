// server.js — WashingtonDC Auth + SPA Route (Express 5 + Security Hardening)
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
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ✅ ENV CHECK */
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

/* ✅ CLOUDINARY */
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

/* ✅ MongoDB */
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

/* ✅ Auth Helper */
const signToken = (uid) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

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

/* ✅ Security Middleware */
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

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "data:", "blob:", "*.cloudinary.com", "https:"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "connect-src": [
        "'self'",
        CLIENT_URL,
        CLIENT_URL_2 || "",
        "https://api.brevo.com",
        "https://api.si.edu",
        "https://edan.si.edu",
      ],
    },
  })
);

/* ✅ CORS */
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
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* ✅ Rate-limit เฉพาะ Login */
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { status: "error", message: "Too many attempts" },
  })
);

/* ✅ Auth Routes (REGISTER / LOGIN / FORGOT / RESET / PROFILE) */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
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
  } catch {
    res.json({ status: "error", message: "สมัครไม่สำเร็จ" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });
    if (!(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "รหัสผ่านผิด!" });

    res.json({
      status: "success",
      token: signToken(u._id),
      user: u,
    });
  } catch {
    res.json({ status: "error", message: "ล็อกอินล้มเหลว" });
  }
});

app.post("/api/auth/forgot", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ status: "error", message: "กรอกอีเมล" });
  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "success" });

  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
    expiresIn: "30m",
  });

  const resetUrl = `${CLIENT_URL}/reset.html?token=${encodeURIComponent(token)}`;
  const html = `
    <h2>รีเซ็ตรหัสผ่าน</h2>
    <a href="${resetUrl}">กดเพื่อตั้งรหัสใหม่</a>`;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL },
      to: [{ email }],
      subject: "Reset Password",
      htmlContent: html,
    }),
  });

  res.json({ status: "success" });
});

app.post("/api/auth/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "Token หมดอายุ" });
  }
});

app.put(
  "/api/auth/profile",
  authRequired,
  upload.single("profileImg"),
  async (req, res) => {
    const user = await User.findById(req.uid);
    if (!user) return res.json({ status: "error" });

    if (req.body.username) user.username = req.body.username.trim();
    if (req.file?.path) user.profileImg = req.file.path;

    await user.save();
    res.json({ status: "success", user });
  }
);

/* ✅ Smithsonian API */
app.get("/api/explore", authRequired, async (req, res) => {
  const url = `https://api.si.edu/openaccess/api/v1.0/search?q=Washington DC&api_key=${SMITHSONIAN_API_KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  res.json({ status: "success", data: data.response });
});

/* ✅ Proxy Smithsonian */
app.get("/api/proxy-smithsonian/:id", async (req, res) => {
  const normalizedId = req.params.id.replace(/^edanmdm:/, "edanmdm-");
  const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;
  const r = await fetch(url);
  const data = await r.json();
  res.json(data);
});

/* ✅ Serve SPA (index.html) */
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

/* ✅ Start */
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Server Running → PORT ${port}`));

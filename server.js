// server.js
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
const slowDown = require("express-slow-down");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const morgan = require("morgan");
const { z } = require("zod");

// Upload & Cloudinary
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const app = express();

/* ✅ ENV CHECK */
[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
  "CLOUD_NAME",
  "CLOUD_API_KEY",
  "CLOUD_API_SECRET",
].forEach((v) => {
  if (!process.env[v]) {
    console.error(`❌ Missing ENV: ${v}`);
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

/* ✅ SECURITY MIDDLEWARE */
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(mongoSanitize());
app.use(hpp());
app.use(helmet());

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

const allowed = [CLIENT_URL, "http://localhost:3000"];
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("CORS Blocked")),
    methods: ["GET", "POST", "PUT"],
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 100 }));
app.use(
  slowDown({
    windowMs: 10 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500,
  })
);

/* ✅ DB CONNECT */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* ✅ USER MODEL */
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String,
});
const User = mongoose.model("User", userSchema);

/* ✅ JWT */
const signToken = (uid) =>
  jwt.sign({ uid, iss: "api.wdc" }, JWT_SECRET, { expiresIn: "7d" });

function authRequired(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.json({ status: "unauthorized" });
    req.uid = jwt.verify(token, JWT_SECRET).uid;
    next();
  } catch {
    res.json({ status: "unauthorized" });
  }
}

/* ✅ VALIDATION */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return res.json({ status: "error", message: result.error.issues[0].message });
    req.body = result.data;
    next();
  };
}

const emailSchema = z.string().email("อีเมลไม่ถูกต้อง");
const pwSchema = z
  .string()
  .min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร")
  .regex(/[A-Z]/, "ต้องมีตัวใหญ่ A-Z")
  .regex(/[a-z]/, "ต้องมีตัวเล็ก a-z")
  .regex(/[0-9]/, "ต้องมีตัวเลข")
  .regex(/[^A-Za-z0-9]/, "ต้องมีอักขระพิเศษ");

/* ✅ CLOUDINARY */
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: CLOUD_API_KEY,
  api_secret: CLOUD_API_SECRET,
});

const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "profile_pics",
      resource_type: "image",
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "auto", quality: "auto" },
      ],
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ✅ RESET EMAIL */
async function sendResetEmail(email, token) {
  const resetUrl = `${CLIENT_URL}/reset.html?token=${token}`;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL },
      to: [{ email }],
      subject: "รีเซ็ตรหัสผ่าน 🔐",
      htmlContent: `<a href="${resetUrl}">รีเซ็ตรหัสผ่าน</a>`,
    }),
  });
}

/* ✅ AUTH ROUTES */

// REGISTER
app.post(
  "/api/auth/register",
  validate(z.object({ username: z.string(), email: emailSchema, password: pwSchema })),
  async (req, res) => {
    const { username, email, password } = req.body;
    if (await User.findOne({ email }))
      return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });
    await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.json({ status: "success" });
  }
);

// LOGIN
app.post(
  "/api/auth/login",
  validate(z.object({ email: emailSchema, password: z.string() })),
  async (req, res) => {
    const { email, password } = req.body;
    const u = await User.findOne({ email });
    if (!u || !(await bcrypt.compare(password, u.password)))
      return res.json({ status: "error", message: "ข้อมูลไม่ถูกต้อง" });
    res.json({
      status: "success",
      token: signToken(u._id),
      user: { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg },
    });
  }
);

// FORGOT
app.post("/api/auth/forgot", validate(z.object({ email: emailSchema })), async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u) return res.json({ status: "success" });
  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, { expiresIn: "30m" });
  await sendResetEmail(u.email, token);
  res.json({ status: "success" });
});

// RESET
app.post(
  "/api/auth/reset",
  validate(z.object({ token: z.string(), password: pwSchema })),
  async (req, res) => {
    try {
      const { uid } = jwt.verify(req.body.token, RESET_PASSWORD_SECRET);
      const u = await User.findById(uid);
      u.password = await bcrypt.hash(req.body.password, 10);
      await u.save();
      res.json({ status: "success" });
    } catch {
      res.json({ status: "error", message: "ลิงก์ไม่ถูกต้อง/หมดอายุ" });
    }
  }
);

// PROFILE
app.get("/api/auth/profile", authRequired, async (req, res) => {
  const u = await User.findById(req.uid).lean();
  res.json({
    status: "success",
    user: { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg },
  });
});

app.put("/api/auth/profile", authRequired, upload.single("profileImg"), async (req, res) => {
  const u = await User.findByIdAndUpdate(
    req.uid,
    {
      username: req.body.username || undefined,
      profileImg: req.file?.path,
    },
    { new: true }
  );
  res.json({
    status: "success",
    user: { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg },
  });
});

/* ✅ FRONTEND */
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

/* ✅ START */
app.listen(process.env.PORT || 10000, () =>
  console.log("🚀 Server Online " + process.env.CLIENT_URL)
);

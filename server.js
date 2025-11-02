require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/************************************
 ✅ ENV CHECK
*************************************/
const requiredEnv = [
  "JWT_SECRET", "RESET_PASSWORD_SECRET", "MONGO_URI", "CLIENT_URL",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SENDER_EMAIL"
];

requiredEnv.forEach(v => {
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
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SENDER_EMAIL
} = process.env;

/************************************
 ✅ MIDDLEWARE
*************************************/
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/************************************
 ✅ DATABASE CONNECT
*************************************/
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/************************************
 ✅ USER DATABASE MODEL
*************************************/
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String
});
const User = mongoose.model("User", userSchema);

/************************************
 ✅ AUTH HELPER
*************************************/
const signToken = uid =>
  jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.json({ status: "unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.uid;
    next();
  } catch {
    return res.json({ status: "unauthorized" });
  }
}

/************************************
 ✅ CLOUDINARY UPLOAD
*************************************/
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "profile_pics" }
});
const upload = multer({ storage });

/************************************
 ✅ SMTP / EMAIL
*************************************/
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

/************************************
 ✅ REGISTER
*************************************/
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!email || !password)
    return res.json({ status: "error", message: "ข้อมูลไม่ครบ!" });

  if (await User.findOne({ email }))
    return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

  await User.create({
    username,
    email,
    password: await bcrypt.hash(password, 10)
  });

  res.json({ status: "success" });
});

/************************************
 ✅ LOGIN
*************************************/
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });

  if (!await bcrypt.compare(password, u.password))
    return res.json({ status: "error", message: "รหัสผ่านผิด!" });

  res.json({
    status: "success",
    token: signToken(u._id.toString()),
    user: {
      id: u._id,
      username: u.username,
      email: u.email,
      profileImg: u.profileImg
    }
  });
});

/************************************
 ✅ FORGOT PASSWORD EMAIL
*************************************/
app.post("/api/auth/forgot", async (req, res) => {
  const { email } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "success" }); // ไม่ให้เดาอีเมล

  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
    expiresIn: "30m"
  });

  const resetUrl = `${CLIENT_URL}/reset.html?token=${token}`;

  try {
    await transporter.sendMail({
      from: SENDER_EMAIL,
      to: email,
      subject: "🔐 Reset Password",
      html: `
      <p>📌 กดเพื่อเปลี่ยนรหัสผ่าน:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>หมดอายุใน 30 นาที ⏳</p>`
    });
    res.json({ status: "success" });
  } catch (err) {
    console.error("Email Error:", err.message);
    res.json({ status: "error", message: "ส่งอีเมลไม่สำเร็จ" });
  }
});

/************************************
 ✅ RESET PASSWORD
*************************************/
app.post("/api/auth/reset", async (req, res) => {
  const { token, password } = req.body;

  try {
    const decoded = jwt.verify(token, RESET_PASSWORD_SECRET);
    await User.findByIdAndUpdate(decoded.uid, {
      password: await bcrypt.hash(password, 10)
    });
    res.json({ status: "success" });
  } catch {
    res.json({ status: "error", message: "ลิงก์หมดอายุ/ไม่ถูกต้อง" });
  }
});

/************************************
 ✅ SERVER ROUTE DEFAULT
*************************************/
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`🚀 Server Online → http://localhost:${port}`)
);

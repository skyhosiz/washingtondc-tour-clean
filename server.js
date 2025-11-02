require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// ✅ Cloudinary + Upload
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

// ✅ ENV VARIABLES
const JWT_SECRET = process.env.JWT_SECRET;
const RESET_PASSWORD_SECRET = process.env.RESET_PASSWORD_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL;

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ CONNECT DB
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB ERROR:", err));

// ✅ USER SCHEMA
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: { type: String, default: "" }
});
const User = mongoose.model("User", userSchema);

// ✅ JWT AUTH
function signToken(uid) {
  return jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });
}
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

// ✅ CONFIG CLOUDINARY
cloudinary.config({
  cloud_name: "dh6iplser",
  api_key: "283864438922345",
  api_secret: "R5tAc7p3bh_0NeZjVGeQkP8q0z0"
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile_pics",
    allowed_formats: ["jpeg", "jpg", "png"]
  },
});
const upload = multer({ storage });

// ✅ SMTP TRANSPORT (Brevo)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// =======================
// ✅ REGISTER
// =======================
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!email || !password)
    return res.json({ status: "error", message: "ข้อมูลไม่ครบ!" });

  const exists = await User.findOne({ email });
  if (exists)
    return res.json({ status: "error", message: "อีเมลนี้ถูกใช้แล้ว!" });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hash });

  res.json({ status: "success" });
});

// =======================
// ✅ LOGIN
// =======================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "error", message: "บัญชีผิด!" });

  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return res.json({ status: "error", message: "รหัสผ่านผิด!" });

  const token = signToken(u._id.toString());

  res.json({
    status: "success",
    token,
    user: {
      id: u._id,
      username: u.username,
      email: u.email,
      profileImg: u.profileImg,
    },
  });
});

// =======================
// ✅ GET PROFILE
// =======================
app.get("/profile", auth, async (req, res) => {
  const u = await User.findById(req.userId).select("username email profileImg");
  res.json({ status: "success", user: u });
});

// =======================
// ✅ UPDATE PROFILE
// =======================
app.post("/updateProfile", auth, async (req, res) => {
  const update = {};
  if (req.body.username) update.username = req.body.username;
  if (req.body.email) update.email = req.body.email;
  if (req.body.password)
    update.password = await bcrypt.hash(req.body.password, 10);

  await User.findByIdAndUpdate(req.userId, update);
  res.json({ status: "success", message: "✅ บันทึกข้อมูลเรียบร้อย!" });
});

// =======================
// ✅ UPLOAD PROFILE PIC
// =======================
app.post("/uploadProfilePic", auth, upload.single("image"), async (req, res) => {
  try {
    const url = req.file?.path;
    if (!url)
      return res.json({ status: "error", message: "ไม่มีรูปถูกอัปโหลด" });

    await User.findByIdAndUpdate(req.userId, { profileImg: url });
    res.json({ status: "success", profileImg: url });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
});

// =======================
// ✅ FORGOT PASSWORD (Email)
// =======================
app.post("/forgot", async (req, res) => {
  const { email } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "success" }); // ✅ ป้องกันเดา email

  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
    expiresIn: "30m",
  });

  const link = `${CLIENT_URL}/reset.html?token=${token}`;

  await transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: "🔐 Reset Password",
    html: `<p>กดลิงก์เพื่อรีเซ็ตรหัสผ่าน:</p>
           <a href="${link}">${link}</a>
           <p>ลิงก์หมดอายุใน 30 นาที</p>`,
  });

  res.json({ status: "success", message: "ส่งอีเมลแล้ว!" });
});

// =======================
// ✅ RESET PASSWORD
// =======================
app.post("/reset", async (req, res) => {
  const { token, password } = req.body;
  try {
    const decoded = jwt.verify(token, RESET_PASSWORD_SECRET);
    const hash = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(decoded.uid, { password: hash });

    res.json({ status: "success", message: "🚀 รีเซ็ตรหัสผ่านสำเร็จ!" });
  } catch (err) {
    return res.json({ status: "error", message: "ลิงก์หมดอายุ/ไม่ถูกต้อง" });
  }
});

// ✅ DEFAULT PAGE = LOGIN
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ✅ START SERVER
const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`🚀 Server Running → http://localhost:${port}`)
);

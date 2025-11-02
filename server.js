require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch"); // ✅ CommonJS OK

const app = express();

/************************************
 ✅ ENV CHECK
*************************************/
[
  "JWT_SECRET", "RESET_PASSWORD_SECRET", "MONGO_URI",
  "CLIENT_URL", "BREVO_API_KEY", "SENDER_EMAIL"
].forEach(v => {
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
  SENDER_EMAIL
} = process.env;

/************************************
 ✅ MIDDLEWARE
*************************************/
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/************************************
 ✅ DB CONNECT
*************************************/
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/************************************
 ✅ USER MODEL
*************************************/
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profileImg: String
});
const User = mongoose.model("User", userSchema);

const signToken = uid =>
  jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });

/************************************
 ✅ EMAIL SENDER — Brevo API
*************************************/
async function sendResetEmail(email, token) {
  const resetUrl = `${CLIENT_URL}/reset.html?token=${token}`;

  const payload = {
    sender: { email: SENDER_EMAIL, name: "Washington DC Travel" },
    to: [{ email }],
    subject: "🔐 รีเซ็ตรหัสผ่าน",
    htmlContent: `
      <h2>กู้คืนรหัสผ่าน</h2>
      <p>คลิกเพื่อเปลี่ยนรหัสผ่านใหม่</p>
      <a href="${resetUrl}" style="background:#ff8a25;padding:10px;border-radius:8px;color:white;text-decoration:none">
        รีเซ็ตรหัสผ่าน
      </a>
      <p>ลิงก์หมดอายุใน 30 นาที ⏳</p>
    `
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  return await res.json();
}

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
    user: { id: u._id, username: u.username, email: u.email, profileImg: u.profileImg }
  });
});

/************************************
 ✅ FORGOT PASSWORD
*************************************/
app.post("/api/auth/forgot", async (req, res) => {
  const { email } = req.body;

  const u = await User.findOne({ email });
  if (!u) return res.json({ status: "success" }); // กันเดาอีเมล

  const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, { expiresIn: "30m" });

  await sendResetEmail(email, token);

  res.json({ status: "success" });
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
 ✅ DEFAULT ROUTE
*************************************/
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

const port = process.env.PORT || 10000;
app.listen(port, () =>
  console.log(`🚀 Server Online → http://localhost:${port}`)
);

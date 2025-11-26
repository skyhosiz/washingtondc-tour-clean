require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const rateLimit = require("express-rate-limit");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();

[
  "JWT_SECRET",
  "RESET_PASSWORD_SECRET",
  "VERIFY_EMAIL_SECRET",
  "MONGO_URI",
  "CLIENT_URL",
  "BREVO_API_KEY",
  "SENDER_EMAIL",
  "SMITHSONIAN_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GEMINI_API_KEY",
].forEach((v) => {
  if (!process.env[v]) {
    console.error(`[ENV ERROR] Missing ENV: ${v}`);
    process.exit(1);
  }
});

const {
  JWT_SECRET,
  RESET_PASSWORD_SECRET,
  VERIFY_EMAIL_SECRET,
  MONGO_URI,
  CLIENT_URL,
  BREVO_API_KEY,
  SENDER_EMAIL,
  SMITHSONIAN_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  GEMINI_API_KEY,
} = process.env;

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

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

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Error:", err.message);
    process.exit(1);
  });

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    profileImg: String,
    emailVerified: { type: Boolean, default: false },
  })
);

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

async function verifyCaptcha(token, ip) {
  if (!token) return false;
  if (!process.env.RECAPTCHA_SECRET) {
    console.error("reCAPTCHA secret missing");
    return false;
  }
  try {
    const params = new URLSearchParams();
    params.append("secret", process.env.RECAPTCHA_SECRET);
    params.append("response", token);
    if (ip) params.append("remoteip", ip);

    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await resp.json();
    return !!data?.success;
  } catch (err) {
    console.error("reCAPTCHA verify error:", err.message);
    return false;
  }
}

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
    console.error("Brevo send fail:", r.status, t);
    throw new Error(`Brevo send fail: ${r.status} ${t}`);
  }
}

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

// REGISTER + SEND VERIFY EMAIL
app.post("/api/auth/register", registerLimiter, async (req, res) => {
  try {
    const { username = "", email = "", password = "", captchaToken = "" } = req.body || {};
    if (!email || !password)
      return res.json({
        status: "error",
        message: "กรุณากรอกอีเมลและรหัสผ่าน",
      });

    if (!emailRegex.test(email))
      return res.json({ status: "error", message: "รูปแบบอีเมลไม่ถูกต้อง!" });

    const captchaOk = await verifyCaptcha(captchaToken, req.ip);
    if (!captchaOk)
      return res.json({ status: "error", message: "reCAPTCHA verification failed" });

    if (await User.findOne({ email }))
      return res.json({
        status: "error",
        message: "อีเมลนี้ถูกใช้ลงทะเบียนแล้ว",
      });

    const user = await User.create({
      username,
      email,
      password: await bcrypt.hash(password, 10),
    });

    // ส่งเมลยืนยันอีเมล
    try {
      const verifyToken = jwt.sign({ uid: user._id }, VERIFY_EMAIL_SECRET, {
        expiresIn: "1d",
      });

      const verifyUrl = `${CLIENT_URL}/verify.html?token=${encodeURIComponent(verifyToken)}`;

      const html = `
        <div style="font-family:Arial,sans-serif">
          <h2>ยืนยันอีเมลของคุณ | Washington D.C. Tour</h2>
          <p>ขอบคุณที่สมัครสมาชิก กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
          <p><a href="${verifyUrl}" style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">คลิกเพื่อยืนยันอีเมล</a></p>
          <p>หากกดปุ่มไม่ได้ ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์:<br>${verifyUrl}</p>
        </div>`;

      await sendMailBrevo({
        to: email,
        subject: "ยืนยันอีเมล | Washington D.C. Tour",
        html,
      });
    } catch (mailErr) {
      console.error("VERIFY EMAIL SEND ERROR:", mailErr.message);
      // ไม่ throw ต่อ เพื่อไม่ให้ registration ล่มเพราะส่งเมลไม่ได้
    }

    res.json({ status: "success" });
  } catch (e) {
    console.error("REGISTER error:", e.message);
    res.json({
      status: "error",
      message: "เกิดข้อผิดพลาดในระบบลงทะเบียน",
    });
  }
});

// LOGIN (บล็อกเฉพาะ emailVerified === false)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email = "", password = "" } = req.body || {};
    const u = await User.findOne({ email });
    if (!u)
      return res.json({
        status: "error",
        message: "ไม่พบบัญชีผู้ใช้",
      });

    if (!(await bcrypt.compare(password, u.password)))
      return res.json({
        status: "error",
        message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });

    // ถ้า field มีค่า false = ยังไม่ยืนยันอีเมล
    if (u.emailVerified === false) {
      return res.json({
        status: "error",
        message: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
      });
    }

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
    res.json({
      status: "error",
      message: "เกิดข้อผิดพลาดในระบบเข้าสู่ระบบ",
    });
  }
});

// VERIFY EMAIL (ใช้ token จากลิงก์ในเมล)
app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const { token = "" } = req.body || {};
    if (!token) {
      return res.json({
        status: "error",
        message: "Token ไม่ถูกต้อง",
      });
    }

    const { uid } = jwt.verify(token, VERIFY_EMAIL_SECRET);
    const user = await User.findById(uid);
    if (!user) {
      return res.json({
        status: "error",
        message: "ไม่พบบัญชีผู้ใช้",
      });
    }

    if (user.emailVerified) {
      return res.json({
        status: "success",
        message: "อีเมลนี้ได้รับการยืนยันแล้ว",
      });
    }

    user.emailVerified = true;
    await user.save();

    res.json({
      status: "success",
      message: "ยืนยันอีเมลเรียบร้อยแล้ว",
    });
  } catch (e) {
    console.error("VERIFY EMAIL ERROR:", e.message);
    res.status(400).json({
      status: "error",
      message: "Token ไม่ถูกต้องหรือหมดอายุ",
    });
  }
});

app.post("/api/auth/forgot", forgotLimiter, async (req, res) => {
  try {
    const { email = "", captchaToken = "" } = req.body || {};
    if (!email)
      return res.json({
        status: "error",
        message: "กรุณากรอกอีเมล",
      });

    if (!emailRegex.test(email))
      return res.json({
        status: "error",
        message: "รูปแบบอีเมลไม่ถูกต้อง",
      });

    const captchaOk = await verifyCaptcha(captchaToken, req.ip);
    if (!captchaOk)
      return res.json({
        status: "error",
        message: "reCAPTCHA verification failed",
      });

    const u = await User.findOne({ email });
    if (!u) return res.json({ status: "success" });

    const token = jwt.sign({ uid: u._id }, RESET_PASSWORD_SECRET, {
      expiresIn: "30m",
    });

    const resetUrl = `${CLIENT_URL}/reset.html?token=${encodeURIComponent(token)}`;
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>รีเซ็ตรหัสผ่าน | Washington D.C. Tour</h2>
        <p>คุณได้รับอีเมลนี้เพราะมีการร้องขอให้รีเซ็ตรหัสผ่าน หากไม่ใช่คุณ กรุณาเพิกเฉยอีเมลนี้ได้เลย ลิงก์นี้จะหมดอายุภายใน 30 นาที</p>
        <p><a href="${resetUrl}" style="background:#ff952e;color:#000;padding:12px 18px;border-radius:8px;text-decoration:none;">คลิกที่นี่เพื่อรีเซ็ตรหัสผ่าน</a></p>
        <p>หากกดปุ่มไม่ได้ ให้คัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์:<br>${resetUrl}</p>
      </div>`;

    await sendMailBrevo({
      to: email,
      subject: "รีเซ็ตรหัสผ่าน | Washington D.C. Tour",
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
      return res.json({
        status: "error",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });

    const { uid } = jwt.verify(token, RESET_PASSWORD_SECRET);
    const user = await User.findById(uid);
    if (!user)
      return res.json({
        status: "error",
        message: "ไม่พบบัญชีผู้ใช้",
      });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({
      status: "success",
      message: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว",
    });
  } catch (e) {
    console.error("RESET ERROR:", e.message);
    res.status(400).json({
      status: "error",
      message: "Token ไม่ถูกต้องหรือหมดอายุ",
    });
  }
});

app.put("/api/auth/profile", authRequired, upload.single("profileImg"), async (req, res) => {
  try {
    const user = await User.findById(req.uid);
    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "ไม่พบบัญชีผู้ใช้" });

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
    res
      .status(500)
      .json({ status: "error", message: "ไม่สามารถอัปเดตโปรไฟล์ได้" });
  }
});

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

// AI Assistant (Gemini Only - Stable + Retry + Timeout)
app.post("/api/assistant", async (req, res) => {
  try {
    const { q } = req.body || {};
    if (!q || !q.trim()) {
      return res.json({
        reply: "กรุณาพิมพ์คำถามก่อนนะ",
      });
    }

    async function callGemini(question, retry = 0) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        "คุณเป็นผู้ช่วยตอบคำถามทั่วไปสำหรับเว็บไซต์ Washington D.C. Tour ตอบสั้น กระชับ และสุภาพ เป็นภาษาไทย หากเป็นคำถามนอกเหนือจากการท่องเที่ยวก็ช่วยตอบในเชิงให้ความรู้ได้:\n" +
                        question,
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);
        const data = await response.json();

        if (response.ok) {
          return (
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "ไม่สามารถอ่านคำตอบจาก Gemini ได้"
          );
        }

        if (
          data?.error?.message?.includes("overloaded") ||
          data?.error?.status === "UNAVAILABLE"
        ) {
          if (retry < 2) {
            console.warn(`Gemini overloaded, retrying... (${retry + 1})`);
            await new Promise((r) => setTimeout(r, 1500));
            return callGemini(question, retry + 1);
          }
        }

        console.error("Gemini API Error:", data);
        throw new Error("Gemini API returned an error");
      } catch (err) {
        console.error("Gemini Fetch Error:", err.message);
        if (retry < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          return callGemini(question, retry + 1);
        }
        return "ตอนนี้ระบบ Gemini มีปัญหา กรุณาลองใหม่ภายหลัง";
      }
    }

    const reply = await callGemini(q);
    res.json({ reply });
  } catch (err) {
    console.error("Gemini Route Error:", err.message);
    res.json({
      reply: "เกิดข้อผิดพลาดในระบบผู้ช่วย (Gemini)",
    });
  }
});

app.get("/api/proxy-smithsonian/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedId = id.replace(/^edanmdm:/, "edanmdm-").replace(/^edanmdm--/, "edanmdm-");
    const url = `https://edan.si.edu/openaccess/api/v1.0/content/${normalizedId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Smithsonian fetch failed: ${response.status}`);
    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("Proxy Smithsonian Error:", err.message);
    res.status(500).json({ error: "Failed to fetch Smithsonian data", detail: err.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "intro.html"))
);
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Server Online on PORT ${port}`));

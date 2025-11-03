
require("dotenv").config();

const express = require("express");

const multer = require("multer"); 

const path = require("path");

const mongoose = require("mongoose");

const cors = require("cors");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const fetch = require("node-fetch");



const cloudinary = require("cloudinary").v2;

const { CloudinaryStorage } = require("multer-storage-cloudinary");


const app = express();



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

    public_id: (req, file) => `${req.uid}_${Date.now()}`, 
  },
});

const upload = multer({ storage: storage }); 


app.disable("x-powered-by");

const allowed = [CLIENT_URL, "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS blocked")),

    methods: ["GET", "POST", "PUT", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.options(/.*/, cors());



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


app.post("/api/auth/register", async (req, res) => {
});

app.post("/api/auth/login", async (req, res) => {
});

app.post("/api/auth/forgot", async (req, res) => {
});

app.post("/api/auth/reset", async (req, res) => {
});

app.get("/api/auth/profile", authRequired, async (req, res) => {
});



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


app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  res.sendFile(path.join(__dirname, "public", "index.html"));
});


const port = process.env.PORT || 10000;

app.listen(port, () => console.log(`🚀 Server Online → PORT ${port}`));

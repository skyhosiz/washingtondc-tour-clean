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

// ... (ส่วน ENV CHECK และ CONFIG เหมือนเดิม) ...

// ... (ส่วน DB CONNECT, USER, signToken, sendResetEmail เหมือนเดิม) ...

/* =============================

   HELPERS (FIXED)

============================= */

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";

    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

    if (!token) return res.status(401).json({ status: "unauthorized" });

    const { uid } = jwt.verify(token, JWT_SECRET);

    req.uid = uid;

    next(); // ✅ FIX: ต้องเรียก next() เพื่อให้ Express เข้าใจว่า Middleware เสร็จแล้ว
  } catch {
    return res.status(401).json({ status: "unauthorized" });
  }
}

// ... (ส่วน AUTH ROUTES อื่นๆ เหมือนเดิม) ...

/* =============================

   UPDATE PROFILE ROUTE (FIXED)

============================= */

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

      // ✅ FIX: ไม่ต้องเช็ก req.file.path ว่ามีไหม

      // เพราะถ้าไม่มีการอัปโหลดไฟล์, req.file จะเป็น undefined และ updateData.profileImg จะไม่ถูกเซ็ต (ถูกต้อง)

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

// ... (ส่วน API explore และ SPA STATIC ROUTE เหมือนเดิม) ...

// ... (ส่วน app.listen เหมือนเดิม) ...

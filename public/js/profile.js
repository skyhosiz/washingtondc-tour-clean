// profile.js — ใช้กับ server.js ปัจจุบัน (/api/auth/profile)
document.addEventListener("DOMContentLoaded", init);

const API_BASE = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://washingtondc-tour-clean.onrender.com";

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}

function protectPage() {
  const token = localStorage.getItem("token");
  if (!token) {
    location.href = "login.html";
    return false;
  }
  return true;
}

async function fetchProfile() {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    headers: { Authorization: "Bearer " + token },
  });
  const data = await res.json().catch(() => null);

  // ถ้า token ไม่ผ่าน → เด้งออก
  if (!data || data.status !== "success") {
    logout();
    return null;
  }

  // เก็บ user ใหม่ให้สดเสมอ
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user;
}

function renderProfile(u) {
  // หน้า profile.html ของเรามี <h2 id="profileName">, <div id="profileEmail">, <img id="profileImg">
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const imgEl = document.getElementById("profileImg");

  if (nameEl) nameEl.textContent = u.username || "-";
  if (emailEl) emailEl.textContent = u.email || "-";
  if (imgEl) imgEl.src = u.profileImg || "pic/default.png";
}

async function init() {
  if (!protectPage()) return;

  // ลองใช้ user ใน localStorage ก่อนเพื่อให้ UI โผล่ไว
  const cached = JSON.parse(localStorage.getItem("user") || "null");
  if (cached) renderProfile(cached);

  // แล้วค่อยดึงสดจาก server (กันข้อมูลเก่า/เปลี่ยนรูปไม่อัปเดต)
  const fresh = await fetchProfile();
  if (fresh) renderProfile(fresh);

  // bind ปุ่ม logout เผื่อมีใน navbar
  const navLogout = document.querySelector(".btn-logout");
  if (navLogout) navLogout.addEventListener("click", logout);
}

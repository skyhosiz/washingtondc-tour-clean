console.log("Auth Guard Loaded ✅");

// 🌐 Global Base API URL (ใช้ทุกไฟล์รวม login.js)
const API_BASE = 
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

// ✅ หน้าที่ไม่ต้อง login
const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

function saveAuth(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout(force = false) {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (!force) alert("🔐 กรุณาเข้าสู่ระบบใหม่");
  location.replace("login.html");
}

function getPageName() {
  return (location.pathname.split("/").pop() || "index.html")
    .replace(".html", "")
    .toLowerCase();
}

// ✅ ใช้ profile check token exp ถูกหรือเปล่า
async function verifyToken() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    return data.status === "success";
  } catch {
    return false;
  }
}

// ✅ Block หน้า Protected ถ้าไม่มี Auth
document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();
  const token = localStorage.getItem("token");
  const isAuthed = token ? await verifyToken() : false;

  console.log(`Page: ${page} | Auth: ${isAuthed ? "✅" : "NO"}`);

  if (PUBLIC_PAGES.has(page)) {
    if (isAuthed) return location.replace("index.html");
    return;
  }

  // ✅ Protected page
  if (!isAuthed) return logout(true);
});

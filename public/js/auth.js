// public/js/auth.js — Phase1 Stable 🔒

console.log("Auth Guard Loaded ✅");

const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

// ✅ Save Access Token + User
function saveAuth(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user || null));
}

function getPageName() {
  let name = location.pathname.split("/").pop();
  if (!name || name === "/") name = "index.html";
  return name.replace(".html", "").toLowerCase();
}

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

// ✅ Logout แข็งแรงขึ้น
function logout(forceMsg = "") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (forceMsg) alert(forceMsg);
  location.replace("login.html");
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();
  const token = localStorage.getItem("token");

  console.log("Page:", page, "| Token:", token ? "YES" : "NO");

  if (PUBLIC_PAGES.has(page)) {
    if (token && (await verifyToken())) {
      return location.replace("index.html");
    }
    return;
  }

  // ✅ Protected Pages
  if (!token || !(await verifyToken())) {
    return logout("🔐 Session expired, please login again");
  }
});

// ✅ Export Helper
window.authApi = { saveAuth, logout };

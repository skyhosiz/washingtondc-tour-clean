// public/js/auth.js — Phase1 Stable + API Wrapper ✅

console.log("%cAuth Guard Loaded ✅", "color: #00e676; font-weight: bold");

const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

// ✅ หน้าสาธารณะที่ไม่ต้อง Login
const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

// ✅ Token Management
function getAccessToken() {
  return localStorage.getItem("token");
}
function setAccessToken(token) {
  if (token) localStorage.setItem("token", token);
}
function saveAuth(data) {
  setAccessToken(data.token);
  localStorage.setItem("user", JSON.stringify(data.user || null));
}

// ✅ Logout สมบูรณ์ที่สุด
function logout(forceMsg = "") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (forceMsg) alert(forceMsg);
  location.href = "login.html";
}

// ✅ Helper: Get PageName
function getPageName() {
  let name = location.pathname.split("/").pop();
  if (!name) name = "index.html";
  return name.replace(".html", "").toLowerCase();
}

// ✅ API Fetch Wrapper — Inject Authorization header
async function apiFetch(url, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

// ✅ Verify Token
async function verifyToken() {
  const res = await apiFetch(`${API_BASE}/api/auth/profile`);
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return data?.status === "success";
}

// ✅ First Check on Load
document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();
  const token = getAccessToken();

  console.log("Page:", page, "| Token:", token ? "YES" : "NO");

  if (PUBLIC_PAGES.has(page)) {
    if (token && (await verifyToken())) {
      return location.replace("index.html");
    }
    return;
  }

  if (!token || !(await verifyToken())) {
    logout("🔐 Session expired, please login again");
  }
});

// ✅ Helper Export
window.authApi = {
  apiFetch,
  saveAuth,
  logout,
  getAccessToken,
};

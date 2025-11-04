// public/js/auth.js — Guard + Auto Refresh + Fetch Wrapper

console.log("Auth Guard Loaded ✅");

const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

function saveAuth(data) {
  localStorage.setItem("token", data.token); // access token เท่านั้น
  localStorage.setItem("user", JSON.stringify(data.user || null));
}

function getAccessToken() {
  return localStorage.getItem("token") || "";
}

function setAccessToken(t) {
  if (t) localStorage.setItem("token", t);
}

async function refreshAccessToken() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include", // สำคัญมาก เพื่อส่ง cookie rt
    });
    const data = await res.json().catch(() => null);
    if (data?.status === "success" && data?.token) {
      setAccessToken(data.token);
      return true;
    }
  } catch {}
  return false;
}

// fetch wrapper — ถ้า 401 ลอง refresh แล้วรีเทรนหนึ่งครั้ง
async function apiFetch(url, options = {}, retry = true) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // ให้ cookie refresh วิ่งได้
  });

  if (res.status !== 401) return res;

  if (retry && (await refreshAccessToken())) {
    const token2 = getAccessToken();
    const headers2 = new Headers(options.headers || {});
    if (token2) headers2.set("Authorization", `Bearer ${token2}`);
    return fetch(url, { ...options, headers: headers2, credentials: "include" });
  }

  // refresh fail -> ล้างของและดีดไป login
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (!PUBLIC_PAGES.has(getPageName())) location.replace("login.html");
  return res;
}

function logout(forceMsg = "") {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    if (forceMsg) alert(forceMsg);
    location.href = "login.html";
  });
}

function getPageName() {
  let name = location.pathname.split("/").pop();
  if (!name || name === "/") name = "index.html";
  return name.replace(".html", "").toLowerCase();
}

async function verifyToken() {
  const res = await apiFetch(`${API_BASE}/api/auth/profile`);
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return data?.status === "success";
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();
  const hasToken = !!getAccessToken();

  console.log("Page:", page, "| Token:", hasToken ? "YES" : "NO");

  if (PUBLIC_PAGES.has(page)) {
    if (hasToken && (await verifyToken())) {
      return location.replace("index.html");
    }
    return; // public OK
  }

  // Protected
  if (!hasToken && !(await refreshAccessToken())) {
    return location.replace("login.html");
  }
  if (!(await verifyToken())) {
    return logout("🔐 Session expired, please login again");
  }
});

// ===== Helpers for pages =====
window.authApi = { apiFetch, saveAuth, logout, getAccessToken };

console.log("Auth Guard Loaded ✅");

const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

function saveAuth(data) {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout(force = false) {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (!force) alert("🔐 Session expired, please re-login");
  location.href = "login.html";
}

function getPageName() {
  let name = location.pathname.split("/").pop() || "index.html";
  return name.replace(".html", "").toLowerCase();
}

async function verifyToken() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) return false;
    return true;
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const page = getPageName();
  const token = localStorage.getItem("token");

  console.log("Page:", page, "| Auth:", token ? "YES" : "NO");

  if (PUBLIC_PAGES.has(page)) {
    if (token && (await verifyToken())) {
      // ถ้ามี token แต่เปิดหน้า login ให้เด้งไปหน้า home
      return location.replace("index.html");
    }
    return; // public OK
  }

  // ✅ Protected pages
  if (!token || !(await verifyToken())) return logout(true);
});

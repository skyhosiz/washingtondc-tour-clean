const PUBLIC_PAGES = new Set([
  "login",
  "register",
  "forgot",
  "reset",
]);

function saveAuth(data) {
  if (!data?.token || !data?.user) return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.replace("login.html");
}

function getPageName() {
  let name = location.pathname.split("/").pop() || "index.html";
  return name.replace(".html", "").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();
  const token = localStorage.getItem("token");

  console.log("🔍 Page =", page, "| Token =", token ? "✅ YES" : "❌ NO");

  // ถ้าล็อกอินอยู่แล้ว → ไม่ให้เข้า Public Pages
  if (token && PUBLIC_PAGES.has(page)) {
    return location.replace("index.html");
  }

  // ถ้าไม่ล็อกอิน → บังคับให้เข้า Public Pages เท่านั้น
  if (!token && !PUBLIC_PAGES.has(page)) {
    return location.replace("login.html");
  }
});

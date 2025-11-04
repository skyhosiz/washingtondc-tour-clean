// ✅ หน้า Public ทั้งหมด รวม intro เป็นหน้าแรก
const PUBLIC_PAGES = new Set([
  "intro",
  "login",
  "register",
  "forgot",
  "reset",
]);

function saveAuth(data) {
  if (!data.token || !data.user) return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.replace("login.html");
}

function getPageName() {
  let name = location.pathname.split("/").pop();
  
  // ✅ ถ้าเปิดเว็บครั้งแรก "/" ให้ถือว่าเป็น intro
  if (!name || name === "/" || name === "index.html") {
    name = "intro.html";
  }

  return name.replace(".html", "").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();
  const token = localStorage.getItem("token");

  console.log("Page:", page, "| Token:", token ? "✅ YES" : "❌ NO");

  // ✅ ล็อกอินอยู่ แต่ดันเข้าหน้า login/register/reset/forgot → เด้งไป index.html
  if (token && PUBLIC_PAGES.has(page) && page !== "intro") {
    return location.replace("index.html");
  }

  // ✅ ยังไม่ login แต่เข้า private page → เด้งไป login.html
  if (!token && !PUBLIC_PAGES.has(page)) {
    return location.replace("login.html");
  }

  // ✅ หากมี token แล้วและอยู่หน้า intro → อนุญาตให้ดูได้ (Portfolio Landing)
});

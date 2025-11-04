// ✅ หน้า Public (เข้าดูได้แม้ไม่ Login)
const PUBLIC_PAGES = new Set([
  "intro",
  "login",
  "register",
  "forgot",
  "reset"
]);

function getPageName() {
  let page = location.pathname.split("/").pop();
  
  if (!page || page === "/") page = "intro.html"; // ✅ หน้าแรก = intro
  
  return page.replace(".html", "").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();
  const token = localStorage.getItem("token");

  console.log("PAGE:", page, "| TOKEN:", token ? "✅" : "❌");

  // ✅ ยังไม่ Login → ห้ามเข้า Private pages
  if (!token && !PUBLIC_PAGES.has(page)) {
    return location.replace("login.html");
  }

  // ✅ Login แล้ว แต่จะเข้า login/register/reset/forgot → ส่งกลับ index
  if (token && ["login", "register", "forgot", "reset"].includes(page)) {
    return location.replace("index.html");
  }

  // ✅ Login แล้วและอยู่ intro ให้ผู้ใช้เลือกว่าจะเข้าเว็บหรือเกม
});

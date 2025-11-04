// ✅ หน้า Public เข้าได้โดยไม่ต้อง login
const PUBLIC_PAGES = new Set([
  "intro",
  "login",
  "register",
  "forgot",
  "reset"
]);

function getPageName() {
  let name = location.pathname.split("/").pop();

  // ✅ ถ้าเปิดเว็บแบบตรง link root → intro
  if (!name || name === "/") {
    name = "intro.html";
  }

  return name.replace(".html", "").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();
  const token = localStorage.getItem("token");
  console.log("PAGE:", page, "| TOKEN:", token ? "YES" : "NO");

  // ✅ ไม่มี Token → ห้ามเข้าหน้า Private ทั้งหมด → ส่งไป login
  if (!token && !PUBLIC_PAGES.has(page)) {
    return location.replace("login.html");
  }

  // ✅ มี Token → ไม่ให้กลับไป login/register/forgot/reset
  if (token && ["login", "register", "forgot", "reset"].includes(page)) {
    return location.replace("index.html");
  }

  // ✅ ถ้าอยู่ intro จะอยู่นิ่ง ๆ ไม่เด้งไปไหน
});

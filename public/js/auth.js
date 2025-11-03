const PUBLIC_PAGES = new Set([
  "login.html",

  "register.html",

  "forgot.html",

  "reset.html",
]);

// ฟังก์ชันนี้จะถูกเรียกใช้จาก login.html และ register.html

function saveAuth(data) {
  if (!data || !data.token || !data.user) return;

  localStorage.setItem("token", data.token);

  localStorage.setItem("user", JSON.stringify(data.user));
}

// ฟังก์ชันนี้จะถูกเรียกใช้จาก nav.js (ปุ่ม Logout)

function logout() {
  console.log("Logout Initiated");

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  location.replace("login.html");
}

function getPageName() {
  const url = new URL(location.href);

  let name = url.pathname.split("/").pop();

  if (!name) name = "index.html";

  return name;
}

document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();

  const token = localStorage.getItem("token") || null;

  console.log("Page:", page, "| Token:", token ? "YES" : "NO");

  // 1. ถ้าอยู่หน้า Login และมี Token (ล็อกอินอยู่) -> เด้งไป Home

  if (page === "login.html" && token) {
    return location.replace("index.html");
  }

  // 2. ถ้าเป็นหน้า Public (ที่ไม่ใช่ Login) -> หยุดทำงาน

  if (PUBLIC_PAGES.has(page)) return;

  // 3. ถ้าเป็นหน้า Private และไม่มี Token -> เด้งไป Login

  if (!token) {
    return location.replace("login.html");
  }
});

// 🌎 Universal Navbar — Works on all platforms (Local, Render, Netlify, etc.)
(function () {
  // ✅ ป้องกันโหลดซ้ำ
  if (window.__NAV_LOADED__) return;
  window.__NAV_LOADED__ = true;

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const current = location.pathname.split("/").pop() || "index.html";

  // ✅ ไม่แสดงในบางหน้า (login / register / forgot / reset)
  const HIDE_ON = new Set(["login.html", "register.html", "forgot.html", "reset.html"]);
  if (HIDE_ON.has(current)) return;

  // ✅ สร้าง nav
  const nav = document.createElement("nav");
  nav.style.cssText = `
    width:100%;
    position:fixed;
    top:0; left:0;
    z-index:9999;
    background:#000;
    padding:14px 25px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-family:'Kanit',sans-serif;
    border-bottom:3px solid #9c542a;
  `;

  // ✅ ลิงก์หลัก
  const links = [
    { name: "HOME", url: "index.html" },
    { name: "EXPLORE", url: "explore.html" },
    { name: "PROFILE", url: "profile.html" },
  ];

  let left = `
    <div style="display:flex;align-items:center;gap:26px;flex-wrap:wrap;">
      <a href="index.html" 
         style="font-weight:900;font-size:20px;color:#ff9650;text-decoration:none;">
         D.C. TOUR
      </a>`;

  links.forEach(l => {
    const active = l.url === current;
    left += `
      <a href="${l.url}"
        style="text-decoration:none;
        font-size:14px;font-weight:800;
        color:${active ? "#ff9650" : "#fff"};
        transition:.2s;">
        ${l.name}
      </a>`;
  });
  left += `</div>`;

  // ✅ ส่วนขวา (user info / logout)
  let right = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">`;

  if (token) {
    right += `
      <span style="color:#ffd394;font-size:14px;font-weight:700;">
        ${user.username || user.email || "User"}
      </span>
      <button id="logoutBtn"
        style="background:#e63946;border:none;color:#fff;
        padding:6px 18px;border-radius:20px;font-weight:800;
        cursor:pointer;font-size:13px;transition:0.2s;">
        LOGOUT
      </button>`;
  } else {
    right += `
      <a href="login.html" 
        style="background:#ff9650;color:#111;padding:6px 16px;
        border-radius:20px;font-weight:800;text-decoration:none;
        font-size:13px;transition:.2s;">
        LOGIN
      </a>`;
  }

  right += `</div>`;

  // ✅ แสดงผลรวม
  nav.innerHTML = left + right;
  document.body.prepend(nav);

  // ✅ ปุ่ม logout
  if (token) {
    document.getElementById("logoutBtn").onclick = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "login.html";
    };
  }

  // ✅ รองรับมือถือ (ซ่อน/โชว์ navbar เมื่อ scroll)
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const now = window.scrollY;
    nav.style.transform = now > lastY ? "translateY(-100%)" : "translateY(0)";
    nav.style.transition = "transform 0.3s ease";
    lastY = now;
  });
})();

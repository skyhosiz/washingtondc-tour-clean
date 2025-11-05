// ✅ ORIGINAL CLEAN NAVBAR (เหมือนรูปเดิม 100%)
(function () {

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const current = location.pathname.split("/").pop() || "index.html";

  // ❌ หน้า login / register / forgot / reset ไม่ต้องมี navbar
  const HIDE_ON = new Set(["login.html", "register.html", "forgot.html", "reset.html"]);
  if (HIDE_ON.has(current)) return;

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

  const links = [
    {name: "HOME", url: "index.html"},
    {name: "EXPLORE", url: "explore.html"},
    {name: "PROFILE", url: "profile.html"},
  ];

  let left = `
    <div style="display:flex;align-items:center;gap:26px;">
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

  let right = `<div style="display:flex;align-items:center;gap:12px;">`;

  if (token) {
    right += `
      <span style="color:#ffd394;font-size:14px;font-weight:700;">
        ${user.username || user.email || "user"}
      </span>
      <button id="logoutBtn"
        style="background:#e63946;border:none;color:#fff;
        padding:6px 18px;border-radius:20px;font-weight:800;
        cursor:pointer;font-size:13px;transition:0.2s;">
        LOGOUT
      </button>`;
  }

  right += `</div>`;

  nav.innerHTML = left + right;
  document.body.prepend(nav);

  if (token) {
    document.getElementById("logoutBtn").onclick = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "login.html";
    };
  }

})();

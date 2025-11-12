// 🌎 Universal Navbar — FlukeTON Edition (Responsive + Works Everywhere)
(function () {
  if (window.__NAV_LOADED__) return;
  window.__NAV_LOADED__ = true;

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const current = location.pathname.split("/").pop() || "index.html";
  const HIDE_ON = new Set(["login.html", "register.html", "forgot.html", "reset.html"]);
  if (HIDE_ON.has(current)) return;

  // ✅ Navbar container
  const nav = document.createElement("nav");
  nav.style.cssText = `
    width:100%;
    position:fixed;
    top:0; left:0;
    z-index:9999;
    background:#000;
    padding:12px 25px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-family:'Kanit',sans-serif;
    border-bottom:3px solid #9c542a;
    transition:transform .3s ease;
  `;

  // ✅ Links
  const links = [
    { name: "HOME", url: "index.html" },
    { name: "EXPLORE", url: "explore.html" },
    { name: "PROFILE", url: "profile.html" },
  ];

  let left = `
    <div id="nav-left" style="display:flex;align-items:center;gap:26px;flex-wrap:wrap;">
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

  // ✅ User info / Auth
  let right = `<div id="nav-right" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">`;
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

  // ✅ Hamburger for mobile
  const burger = document.createElement("div");
  burger.innerHTML = `
    <div style="width:26px;height:3px;background:#fff;margin:4px 0;border-radius:2px;"></div>
    <div style="width:26px;height:3px;background:#fff;margin:4px 0;border-radius:2px;"></div>
    <div style="width:26px;height:3px;background:#fff;margin:4px 0;border-radius:2px;"></div>`;
  burger.style.cssText = `
    display:none;cursor:pointer;
  `;

  // ✅ Combine
  nav.innerHTML = left + right;
  nav.appendChild(burger);
  document.body.prepend(nav);

  // ✅ Mobile style
  const media = window.matchMedia("(max-width: 768px)");
  function handleMobile(e) {
    const leftDiv = document.getElementById("nav-left");
    if (e.matches) {
      burger.style.display = "block";
      leftDiv.style.display = "none";
      burger.onclick = () => {
        const open = leftDiv.style.display === "flex";
        leftDiv.style.display = open ? "none" : "flex";
        leftDiv.style.flexDirection = "column";
        leftDiv.style.background = "#000";
        leftDiv.style.position = "absolute";
        leftDiv.style.top = "60px";
        leftDiv.style.left = "0";
        leftDiv.style.width = "100%";
        leftDiv.style.padding = "15px 0";
        leftDiv.style.textAlign = "center";
      };
    } else {
      burger.style.display = "none";
      leftDiv.style.display = "flex";
    }
  }
  handleMobile(media);
  media.addEventListener("change", handleMobile);

  // ✅ Logout
  if (token) {
    document.getElementById("logoutBtn").onclick = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "login.html";
    };
  }

  // ✅ Smooth hide on scroll
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const now = window.scrollY;
    nav.style.transform = now > lastY ? "translateY(-100%)" : "translateY(0)";
    lastY = now;
  });
})();

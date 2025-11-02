(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  const publicPages = ["login.html", "register.html", "forgot.html", "reset.html"];
  if (publicPages.includes(current)) return;

  const nav = document.createElement("nav");
  nav.style.cssText = `
    width: 100%;
    position: sticky;
    top: 0;
    z-index: 999;
    background: #141414;
    padding: 14px 40px;
    display: flex;
    align-items: center;
    gap: 25px;
    font-family: 'Kanit', sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,.45);
  `;

  const links = [
    { name: "Home", url: "index.html" },
    { name: "Museum", url: "museum.html" },
    { name: "Landmark", url: "landmark.html" },
    { name: "Capitol", url: "capital.html" },
    { name: "Hotel", url: "hotel.html" },
    { name: "Food", url: "food.html" },
    { name: "History", url: "story.html" },
    { name: "Reference", url: "refer.html" }
  ];

  // Logo
  let html = `<div style="font-weight:800;font-size:20px;color:#ff9650;">D.C. TOUR</div>`;

  // Menu
  links.forEach(l => {
      html += `<a href="${l.url}" style="text-decoration:none;color:#fff;font-size:15px;">${l.name}</a>`;
  });

  // ✅ ปุ่ม Logout เฉพาะ index / profile
  if (["index.html", "profile.html"].includes(current)) {
    html += `<button id="logoutBtn" style="margin-left:auto;background:#e63946;border:none;color:#fff;padding:8px 16px;border-radius:12px;cursor:pointer;">Logout</button>`;
  }

  nav.innerHTML = html;
  document.body.prepend(nav);

  const btn = document.getElementById("logoutBtn");
  if (btn) btn.onclick = logout;
})();

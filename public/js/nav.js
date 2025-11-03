
(function () {


  const token = localStorage.getItem("token");

  if (!token) {

    return; // หยุดทำงานทันที

  }


  const nav = document.createElement("nav");

  nav.style.cssText = `

    width: 100%;

    position: sticky;

    top: 0;

    z-index: 999;

    background: rgba(0,0,0,0.75);

    padding: 14px 25px;

    display: flex;

    justify-content: space-between;

    align-items: center;

    font-family: 'Kanit', sans-serif;

    backdrop-filter: blur(8px);

    box-shadow: 0 2px 10px rgba(0,0,0,.45);

  `;


  const user = JSON.parse(localStorage.getItem("user") || "null");

  const username = user ? (user.username || "Profile") : "Guest";



  function getPageName() {

    const url = new URL(location.href);

    let name = url.pathname.split("/").pop();

    if (!name) name = "index.html";

    return name;

  }

  const current = getPageName();

  

  const links = [

    { name: "HOME", url: "index.html" },

    { name: "EXPLORE", url: "explore.html" },

    { name: "PROFILE", url: "profile.html" }

  ];


  let leftHtml = `<div style="display:flex; align-items:center; gap:25px;">`;

  leftHtml += `<div style="font-weight:800;font-size:20px;color:#ff9650;">D.C. TOUR</div>`;

  links.forEach(l => {

    const isActive = (l.url === current) || (current === "edit-profile.html" && l.url === "profile.html");

    const style = isActive

      ? "text-decoration:none;color:#ff9650;font-weight:600;font-size:15px;"

      : "text-decoration:none;color:#fff;font-size:15px;";

    leftHtml += `<a href="${l.url}" style="${style}">${l.name}</a>`;

  });

  leftHtml += `</div>`;


  let rightHtml = `<div style="display:flex; align-items:center; gap:15px;">`;

  rightHtml += `<span style="font-size:15px; color: #ffb55b;">${username}</span>`;

  rightHtml += `<button id="logoutBtn" style="background:#e63946;border:none;color:#fff;padding:8px 16px;border-radius:12px;cursor:pointer;font-weight:600;">LOGOUT</button>`;

  rightHtml += `</div>`;


  nav.innerHTML = leftHtml + rightHtml;


  const logoutButton = nav.querySelector("#logoutBtn");

  if (logoutButton) {

    logoutButton.onclick = logout; 

  }

  document.addEventListener("DOMContentLoaded", () => {

    document.body.prepend(nav);

  });



})();
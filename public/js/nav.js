// ✅ nav.js — UNIVERSAL Navigation Bar

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.createElement("nav");
  nav.className = "nav-bar";

  nav.innerHTML = `
    <div class="nav-left">
      <a class="logo" href="index.html">D.C. TOUR</a>
    </div>

    <div class="nav-mid">
      <a href="index.html">HOME</a>
      <a href="food.html">EXPLORE</a>
      <a href="profile.html">PROFILE</a>
    </div>

    <div class="nav-right">
      <button class="logout-btn" id="logoutBtn">LOGOUT</button>
    </div>
  `;

  document.body.prepend(nav);

  const token = localStorage.getItem("token");
  if (!token) {
    document.querySelector(".nav-right").style.display = "none";
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      location.href = "login.html";
    });
  }
});

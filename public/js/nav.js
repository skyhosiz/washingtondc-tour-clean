(function () {
  const token = localStorage.getItem("token");
  if (!token) return;

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const username = user?.username || "User";

  const pages = [
    { name: "HOME", url: "index.html" },
    { name: "EXPLORE", url: "explore.html" },
    { name: "PROFILE", url: "profile.html" }
  ];

  function getPageName() {
    const name = location.pathname.split("/").pop() || "index.html";
    return name.toLowerCase();
  }

  const current = getPageName();

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.createElement("nav");
    nav.className = "top-nav";

    const left = document.createElement("div");
    left.className = "nav-left";

    const logo = document.createElement("div");
    logo.className = "nav-logo";
    logo.textContent = "D.C. TOUR";
    left.appendChild(logo);

    pages.forEach(p => {
      const a = document.createElement("a");
      a.href = p.url;
      a.textContent = p.name;
      a.className = (p.url === current) ? "active" : "";
      left.appendChild(a);
    });

    const right = document.createElement("div");
    right.className = "nav-right";

    const nameSpan = document.createElement("span");
    nameSpan.className = "nav-user";
    nameSpan.textContent = username;

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "logout-btn";
    logoutBtn.textContent = "LOGOUT";
    logoutBtn.addEventListener("click", () => logout());

    right.appendChild(nameSpan);
    right.appendChild(logoutBtn);

    nav.appendChild(left);
    nav.appendChild(right);

    document.body.prepend(nav);
  });
})();

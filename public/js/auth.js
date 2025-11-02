
const PUBLIC_PAGES = new Set([
  "login.html",
  "register.html",
  "forgot.html",
  "reset.html"
]);

function saveAuth(data) {
  if (!data || !data.token || !data.user) return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function logout() {
  console.log("🚪 Logout");
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

  console.log("🔍 Page:", page, "| Token:", token ? "YES" : "NO");

  if (page === "login.html" && token) {
    return location.replace("index.html");
  }

  if (PUBLIC_PAGES.has(page)) return;

  if (!token) {
    return location.replace("login.html");
  }

});

if (!window.__AUTH_LOADED__) {
  window.__AUTH_LOADED__ = true;

  const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

  const API_BASE =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://washingtondc-tour-clean-1.onrender.com";

  function saveAuth(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.replace("login.html");
  }

  async function register(email, password) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data.status === "success") {
      saveAuth(data);
      return true;
    }
    alert(data?.message || "สมัครไม่สำเร็จ");
    return false;
  }

  function getPageName() {
    let n = location.pathname.split("/").pop();
    if (!n || n === "/") n = "index.html";
    return n.replace(".html", "").toLowerCase();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const p = getPageName();
    const t = localStorage.getItem("token");
    if (window.DISABLE_NAV_AUTH) return;
    if (t && PUBLIC_PAGES.has(p)) return location.replace("index.html");
    if (!t && !PUBLIC_PAGES.has(p)) return location.replace("login.html");
  });
}

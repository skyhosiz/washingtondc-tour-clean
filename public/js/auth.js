const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);

function saveAuth(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.replace("login.html");
}

function getPageName() {
    let name = location.pathname.split("/").pop();
    if (!name || name === "/") name = "intro.html";
    return name.replace(".html", "").toLowerCase();
}

document.addEventListener("DOMContentLoaded", () => {
    const page = getPageName();
    const token = localStorage.getItem("token");

    console.log("Page:", page, "| Token:", token ? "YES" : "NO");

    if (token) {
        if (PUBLIC_PAGES.has(page)) {
            return location.replace("index.html");
        }
    } else {
        if (!PUBLIC_PAGES.has(page)) {
            return location.replace("login.html");
        }
    }
});

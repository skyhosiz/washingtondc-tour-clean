// ✅ หน้าที่ไม่ต้อง Login ก็เข้าได้
const allowPages = [
    "login.html",
    "register.html",
    "forgot.html",
    "reset.html"
];

// ✅ บันทึก Token, User
function saveAuth(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
}

// ✅ Logout
function logout() {
    console.log("🚪 Logout");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "login.html";
}

// ✅ ตรวจสิทธิ์หน้าปัจจุบัน
document.addEventListener("DOMContentLoaded", () => {
    const currentPage = location.pathname.split("/").pop();
    const token = localStorage.getItem("token");

    console.log("🔍 Page:", currentPage, "| Token:", token);

    if (!allowPages.includes(currentPage) && !token)
        return location.href = "login.html";

    if (currentPage === "login.html" && token)
        return location.href = "index.html";
});

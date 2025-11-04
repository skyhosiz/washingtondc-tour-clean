document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    return window.location.href = "login.html";
  }

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const imgEl = document.getElementById("profileImg");

  nameEl.textContent = user.username || "Anonymous User";
  emailEl.textContent = user.email || "Unknown";

  if (user.imageUrl) {
    imgEl.src = user.imageUrl;
  }
});

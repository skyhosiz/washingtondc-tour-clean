console.log("Profile Script Loaded ✅");

const API_BASE = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://washingtondc-tour-clean-1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  showCachedIfAny();
  fetchProfile();
});

function showCachedIfAny() {
  const cached = JSON.parse(localStorage.getItem("user") || "null");
  if (cached) showProfile(cached);
}

async function fetchProfile() {
  const card = document.getElementById("profileCard");
  card.style.opacity = ".4";

  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: { Authorization: "Bearer " + token },
    });

    const data = await res.json().catch(() => null);

    if (data?.status === "success" && data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      showProfile(data.user);
    }
  } catch (err) {
    console.error("Fetch profile failed:", err);
  } finally {
    card.style.opacity = "1";
  }
}

function showProfile(u) {
  document.getElementById("profileName").textContent = u.username || "-";
  document.getElementById("profileEmail").textContent = u.email || "-";
  document.getElementById("usernameTop").textContent = u.username || "User";

  const img = document.getElementById("profileImg");
  img.src = u.profileImg || "pic/default.png";
  img.onerror = () => img.src = "pic/default.png";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  location.href = "login.html";
}

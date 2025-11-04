const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://washingtondc-tour-clean-1.onrender.com";

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) return alert("⚠️ กรุณากรอกข้อมูลให้ครบ!");

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.status === "success") {
      saveAuth(data);
      return (location.href = "index.html");
    }

    alert(data.message || "❌ อีเมลหรือรหัสผ่านผิด!");
  } catch {
    alert("📡 ระบบมีปัญหา ลองใหม่อีกครั้ง");
  }
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  login();
});

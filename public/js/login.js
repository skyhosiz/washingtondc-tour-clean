// public/js/login.js — Secure Login ✅

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password)
      return alert("⚠️ กรุณากรอกข้อมูลให้ครบ!");

    try {
      const res = await authApi.apiFetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.status === "success") {
        authApi.saveAuth(data);
        return (location.href = "index.html");
      }

      alert(data.message || "❌ อีเมลหรือรหัสผ่านผิด!");
    } catch (err) {
      alert("📡 ระบบขัดข้อง กรุณาลองใหม่");
    }
  });
});

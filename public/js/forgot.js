document.addEventListener("DOMContentLoaded", () => {
  // ไม่ให้หลง token เก่า
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  const API_BASE =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://washingtondc-tour-clean-1.onrender.com";

  const emailInput = document.getElementById("email");
  const btn = document.getElementById("sendBtn");

  btn.addEventListener("click", sendReset);

  function isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  async function sendReset() {
    const email = emailInput.value.trim();
    if (!email) return alert("⚠️ กรุณากรอกอีเมล");
    if (!isEmail(email)) return alert("⚠️ รูปแบบอีเมลไม่ถูกต้อง");

    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = "กำลังส่ง...";

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (data?.status === "success") {
        alert("✅ ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว! ตรวจสอบกล่องจดหมาย ✉️");
        setTimeout(() => location.href = "login.html", 1200);
      } else {
        alert(data?.message || "❌ ไม่สามารถส่งอีเมลได้");
      }
    } catch {
      alert("🚨 ระบบมีปัญหา กรุณาลองใหม่");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
});

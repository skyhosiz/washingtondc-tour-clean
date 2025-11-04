// public/js/register.js — Secure Register 🔐

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("regForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector("button");
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "กำลังสมัคร...";

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !email || !password) {
      alert("⚠️ กรุณากรอกข้อมูลให้ครบ!");
      return resetBtn();
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert("📧 อีเมลไม่ถูกต้อง!");
      return resetBtn();
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "success") {
        gtag?.("event", "sign_up", { method: "Email" });
        alert("✅ สมัครสำเร็จ!");
        location.href = "login.html";
      } else {
        alert(data.message || "❌ สมัครไม่สำเร็จ");
      }

    } catch {
      alert("🚨 เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง");
    } finally {
      resetBtn();
    }

    function resetBtn() {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
});

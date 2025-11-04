document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("regForm");
  const btn = form.querySelector("button");

  const API_BASE =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://washingtondc-tour-clean-1.onrender.com";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !email || !password)
      return alert("⚠️ กรอกข้อมูลให้ครบ");

    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = "กำลังสมัคร...";

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (data?.token) {
        // 👉 Save Login
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        alert("✅ สมัครสมาชิกสำเร็จ!");
        location.href = "index.html";
      } else {
        alert(data?.message || "สมัครสมาชิกไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("🚨 เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });
});

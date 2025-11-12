// 🚀 D.C. Assistant — Floating Chatbot (Shadow DOM + Smooth + Auto Clear)
(() => {
  if (window.__DC_AI__) return;
  window.__DC_AI__ = true;

  const COLOR = {
    brand: "#6f4cff",
    brandHover: "#8a66ff",
    accent: "#ff9650",
    bg: "#120f25",
    card: "#1a1533",
    text: "#eae9ff",
    me: "#6f4cff",
    bot: "#221a44",
    border: "rgba(255,255,255,.08)",
  };

  // 🟣 Floating container
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    right: "22px",
    bottom: "calc(max(22px, env(safe-area-inset-bottom, 0px) + 22px))",
    zIndex: "2147483647",
  });
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // 🎨 CSS (modern, smooth, safe)
  const css = `
    * { box-sizing: border-box; font-family: 'Kanit', system-ui, sans-serif; }
    .fab {
      position: fixed; right: 0; bottom: 0;
      width: 58px; height: 58px; border-radius: 50%;
      background: ${COLOR.brand}; color: #fff; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 14px 34px rgba(0,0,0,.45);
      transition: transform .25s cubic-bezier(.22,1,.36,1), background .25s;
      user-select: none;
    }
    .fab:hover { transform: scale(1.1) rotate(4deg); background: ${COLOR.brandHover}; }
    .box {
      position: fixed; right: 0; bottom: 70px;
      width: min(360px, calc(100vw - 44px));
      background: ${COLOR.bg}; color: ${COLOR.text};
      border: 1px solid ${COLOR.border};
      border-radius: 16px; box-shadow: 0 22px 60px rgba(0,0,0,.55);
      display: none; flex-direction: column; overflow: hidden;
      opacity: 0; transform: translateY(10px); transition: all .25s ease;
    }
    .box.show { display: flex; opacity: 1; transform: translateY(0); }
    .hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: ${COLOR.card}; font-weight: 700;
    }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: ${COLOR.accent}; box-shadow: 0 0 10px ${COLOR.accent}; }
    .body { padding: 10px 12px; overflow-y: auto; max-height: 50vh; scroll-behavior: smooth; }
    .msg { margin: 8px 0; display: flex; }
    .msg .b {
      padding: 9px 12px; border-radius: 14px; max-width: 78%; word-break: break-word;
      line-height: 1.5; animation: fadeIn .2s ease;
    }
    .me { justify-content: flex-end; }
    .me .b { background: ${COLOR.me}; color: #fff; }
    .bot .b { background: ${COLOR.bot}; border: 1px solid ${COLOR.border}; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    .input {
      display: flex; gap: 6px; padding: 10px;
      background: ${COLOR.card}; border-top: 1px solid ${COLOR.border};
    }
    .input input {
      flex: 1; background: #140f2c; border: 1px solid ${COLOR.border};
      color: ${COLOR.text}; border-radius: 10px; padding: 9px 10px;
      outline: none; transition: border .2s;
    }
    .input input:focus { border-color: ${COLOR.accent}; }
    .input button {
      background: ${COLOR.accent}; border: none; color: #111; font-weight: 800;
      border-radius: 10px; padding: 9px 12px; cursor: pointer;
      transition: transform .2s ease, opacity .2s ease;
    }
    .input button:hover { transform: scale(1.05); opacity: .9; }
    .close { cursor: pointer; opacity: .6; transition: opacity .2s ease; }
    .close:hover { opacity: 1; }
  `;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  // 🧩 Layout
  const fab = Object.assign(document.createElement("div"), { className: "fab", textContent: "AI" });
  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = `
    <div class="hd">
      <span style="display:flex;align-items:center;gap:8px">
        <span class="dot"></span> D.C. Assistant
      </span>
      <span class="close">✕</span>
    </div>
    <div class="body"></div>
    <div class="input">
      <input type="text" placeholder="พิมพ์คำถาม...">
      <button>ส่ง</button>
    </div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

  // 💬 ระบบข้อความ
  const addMsg = (text, who = "bot") => {
    const wrap = document.createElement("div");
    wrap.className = `msg ${who}`;
    const b = document.createElement("div");
    b.className = "b";
    b.textContent = text;
    wrap.appendChild(b);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  };

  // 🌟 เคลียร์แชตเก่าทุกครั้งที่เปิด
  const clearChat = () => {
    body.innerHTML = "";
    addMsg("สวัสดีครับ! 👋 ฉันคือ D.C. Assistant ✨ ถามได้เลย เช่น ‘พิพิธภัณฑ์ไหนดี’ หรือ ‘ของกินดังใน D.C.’");
  };

  // 🎛 เปิด/ปิดกล่อง
  fab.onclick = () => {
    const isShown = box.classList.contains("show");
    if (isShown) box.classList.remove("show");
    else {
      clearChat(); // ลบแชตเก่าทันทีทุกครั้งที่เปิด
      box.classList.add("show");
      input.focus();
    }
  };
  closeBtn.onclick = () => box.classList.remove("show");

  // ⚙️ ติดต่อ backend (เชื่อมกับ server.js)
  async function askAI(q) {
    try {
      const res = await fetch(window.location.origin + "/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      return data.reply || "ขอโทษครับ ฉันยังไม่เข้าใจคำถามนี้";
    } catch (err) {
      console.error("AI fetch error:", err);
      return "เกิดข้อผิดพลาดในการเชื่อมต่อ AI 😢";
    }
  }

  // 🕒 ป้องกัน spam
  let lastSend = 0;
  const canSend = () => Date.now() - lastSend > 600;

  // 🚀 ส่งข้อความ
  async function send() {
    const q = input.value.trim();
    if (!q || !canSend()) return;
    lastSend = Date.now();
    addMsg(q, "me");
    input.value = "";
    const reply = await askAI(q);
    addMsg(reply, "bot");
  }

  sendBtn.onclick = send;
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());
})();

// 🚀 D.C. Assistant — Floating Chatbot (Shadow DOM + Rate-Limit Safe + Persistent History)
(() => {
  if (window.__DC_AI__) return;
  window.__DC_AI__ = true;

  // ✅ ประวัติจะเก็บได้สูงสุด 50 ข้อความ
  const STORAGE_KEY = "dc_ai_history_v1";
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const saveHistory = () =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-50)));

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

  // ✅ Floating container
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    right: "22px",
    bottom: "calc(max(22px, env(safe-area-inset-bottom, 0px) + 22px))",
    zIndex: "2147483647",
  });
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // ✅ CSS (ขนาดพอดีมือถือ + เดสก์ท็อป)
  const css = `
    * { box-sizing: border-box; font-family: 'Kanit', system-ui, sans-serif; }
    .fab {
      position: fixed; right: 0; bottom: 0;
      width: 58px; height: 58px; border-radius: 50%;
      background: ${COLOR.brand}; color: #fff; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 14px 34px rgba(0,0,0,.45);
      transition: transform .2s, background .2s; user-select: none;
    }
    .fab:hover { transform: translateY(-2px) scale(1.05); background: ${COLOR.brandHover}; }
    .box {
      position: fixed; right: 0; bottom: 70px;
      width: min(360px, calc(100vw - 44px));
      background: ${COLOR.bg}; color: ${COLOR.text};
      border: 1px solid ${COLOR.border};
      border-radius: 16px;
      box-shadow: 0 22px 60px rgba(0,0,0,.55);
      display: none; flex-direction: column; overflow: hidden;
    }
    .hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: ${COLOR.card}; font-weight: 700;
    }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: ${COLOR.accent}; box-shadow: 0 0 10px ${COLOR.accent}; }
    .body { padding: 10px 12px; overflow: auto; max-height: 50vh; }
    .msg { margin: 8px 0; display: flex; }
    .msg .b { padding: 8px 10px; border-radius: 12px; max-width: 80%; word-break: break-word; }
    .me { justify-content: flex-end; }
    .me .b { background: ${COLOR.me}; color: #fff; }
    .bot .b { background: ${COLOR.bot}; border: 1px solid ${COLOR.border}; }
    .input { display: flex; gap: 6px; padding: 10px; background: ${COLOR.card}; border-top: 1px solid ${COLOR.border}; }
    .input input {
      flex: 1; background: #140f2c; border: 1px solid ${COLOR.border};
      color: ${COLOR.text}; border-radius: 10px; padding: 9px 10px; outline: none;
    }
    .input button {
      background: ${COLOR.accent}; border: none; color: #111; font-weight: 800;
      border-radius: 10px; padding: 9px 12px; cursor: pointer;
    }
    .close { cursor: pointer; opacity: .6; }
    .close:hover { opacity: 1; }
  `;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  // ✅ Layout HTML
  const fab = Object.assign(document.createElement("div"), { className: "fab", textContent: "AI" });
  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = `
    <div class="hd"><span style="display:flex;align-items:center;gap:8px"><span class="dot"></span> D.C. Assistant</span><span class="close">✕</span></div>
    <div class="body"></div>
    <div class="input"><input type="text" placeholder="พิมพ์คำถาม..."><button>ส่ง</button></div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

  // ✅ UI toggle
  fab.onclick = () => (box.style.display = box.style.display === "none" ? "flex" : "none");
  closeBtn.onclick = () => (box.style.display = "none");

  // ✅ Message system
  const addMsg = (text, who = "bot") => {
    const wrap = document.createElement("div");
    wrap.className = `msg ${who}`;
    const b = document.createElement("div");
    b.className = "b";
    b.textContent = text;
    wrap.appendChild(b);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    history.push({ who, text });
    saveHistory();
  };

  // ✅ Restore chat history
  if (history.length)
    history.forEach((m) => addMsg(m.text, m.who));
  else
    addMsg("สวัสดีครับ! ฉันคือ D.C. Assistant ✨ ถามได้เลย เช่น 'พิพิธภัณฑ์ไหนดี' หรือ 'ของกินดังใน D.C.'");

  // ✅ เชื่อมต่อ API จริง (สอดคล้องกับ server.js)
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

  let lastSend = 0;
  const canSend = () => Date.now() - lastSend > 600; // กัน spam เพิ่มขึ้นเล็กน้อย

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

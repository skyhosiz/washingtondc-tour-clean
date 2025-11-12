// 🚀 D.C. Assistant — Shadow DOM + Draggable FAB + Themed (Dev Mode clears chat)
(() => {
  if (window.__DC_AI__) return; window.__DC_AI__ = true;
  localStorage.removeItem("dc_ai_history_v1");

  const COLOR = {
    brand:"#6f4cff", brandHover:"#8a66ff",
    accent:"#ff9650",
    bg:"#120f25", card:"#1a1533", text:"#eae9ff",
    me:"#6f4cff", bot:"#221a44", border:"rgba(255,255,255,.08)"
  };
  const LINKS = {
    home:"index.html", explore:"explore.html", museum:"museum.html",
    landmark:"landmark.html", food:"food.html", capital:"capital.html",
    story:"story.html", hotel:"hotel.html", profile:"profile.html", refer:"refer.html"
  };

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.right = "22px";
  host.style.bottom = "calc(max(22px, env(safe-area-inset-bottom, 0px) + 22px))";
  host.style.zIndex = "2147483647";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  const css = `
  :host { all: initial; }
  * { box-sizing:border-box; font-family:'Kanit',system-ui,Segoe UI,Roboto,sans-serif; }
  .fab{position:fixed;right:0;bottom:0;width:58px;height:58px;border-radius:50%;
    background:${COLOR.brand};color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;
    cursor:pointer;box-shadow:0 14px 34px rgba(0,0,0,.45);transition:transform .2s,background .2s;user-select:none;}
  .fab:hover{transform:translateY(-2px) scale(1.05);background:${COLOR.brandHover};}
  .box{position:fixed;right:0;bottom:70px;width:min(360px,calc(100vw - 44px));
    background:${COLOR.bg};color:${COLOR.text};border:1px solid ${COLOR.border};border-radius:16px;
    box-shadow:0 22px 60px rgba(0,0,0,.55);display:none;flex-direction:column;overflow:hidden;}
  .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;background:${COLOR.card};font-weight:700;}
  .dot{width:8px;height:8px;border-radius:999px;background:${COLOR.accent};box-shadow:0 0 10px ${COLOR.accent}}
  .body{padding:10px 12px;overflow:auto;max-height:50vh;}
  .msg{margin:8px 0;display:flex;}
  .msg .b{padding:8px 10px;border-radius:12px;max-width:80%;}
  .me{justify-content:flex-end}.me .b{background:${COLOR.me};color:#fff}
  .bot .b{background:${COLOR.bot};color:${COLOR.text};border:1px solid ${COLOR.border}}
  .input{display:flex;gap:6px;padding:10px;background:${COLOR.card};border-top:1px solid ${COLOR.border}}
  .input input{flex:1;background:#140f2c;border:1px solid ${COLOR.border};color:${COLOR.text};
    border-radius:10px;padding:9px 10px;outline:none;}
  .input button{background:${COLOR.accent};border:none;color:#111;font-weight:800;border-radius:10px;padding:9px 12px;cursor:pointer;}
  `;
  const style = document.createElement("style"); style.textContent = css; root.appendChild(style);

  const fab = document.createElement("div"); fab.className = "fab"; fab.textContent = "AI";
  const box = document.createElement("div"); box.className = "box";
  box.innerHTML = `
    <div class="hd"><span class="dot"></span><span>D.C. Assistant</span><span class="close">✕</span></div>
    <div class="body"></div>
    <div class="input">
      <input type="text" placeholder="พิมพ์คำถาม...">
      <button type="button">ส่ง</button>
    </div>`;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");

  const save = (h) => localStorage.setItem("dc_ai_history_v1", JSON.stringify(h.slice(-50)));
  const load = () => JSON.parse(localStorage.getItem("dc_ai_history_v1") || "[]");
  const history = load();
  const scrollBottom = () => (body.scrollTop = body.scrollHeight);

  const showTyping = () => {
    const w = document.createElement("div"); w.className = "msg bot";
    w.innerHTML = `<div class="b"><span class="typing"><i></i><i></i><i></i></span></div>`;
    body.appendChild(w); scrollBottom(); return w;
  };
  const addMsg = (html, who = "bot") => {
    const wrap = document.createElement("div"); wrap.className = `msg ${who}`;
    const b = document.createElement("div"); b.className = "b"; wrap.appendChild(b);
    body.appendChild(wrap);
    let i = 0; const type = () => { b.innerHTML = html.slice(0, ++i); if (i < html.length) requestAnimationFrame(type); };
    type(); scrollBottom(); history.push({ who, html }); save(history);
  };

  const answer = (q) => `ยังไม่เข้าใจคำถามนี้ ลองเช่น <b>เวลาเปิดพิพิธภัณฑ์</b> หรือ <b>ของกินใน D.C.</b> ดูสิ!`;

  let lastSend = 0;
  const canSend = () => Date.now() - lastSend > 500;

  // ===== เชื่อมต่อ backend AI =====
  window.DCAI = {
    ask: async (q) => {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        });
        const data = await res.json();
        return data.reply || "ขอโทษครับ ฉันยังไม่เข้าใจคำถามนี้";
      } catch (err) {
        console.error("AI fetch error:", err);
        return "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ 😢";
      }
    },
  };

  // ✅ ฟังก์ชันส่งข้อความเดียวที่ใช้จริง
  const send = async () => {
    const q = input.value.trim();
    if (!q) return;
    if (!canSend()) return;
    lastSend = Date.now();
    addMsg(q.replace(/</g, "&lt;").replace(/>/g, "&gt;"), "me");
    input.value = "";

    const typing = showTyping();
    await new Promise((r) => setTimeout(r, 180));
    typing.remove();

    let reply = answer(q);
    if (/ยังไม่เข้าใจ/.test(reply)) reply = await window.DCAI.ask(q);
    addMsg(reply, "bot");
    input.focus();
  };

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());

  if (!history.length) addMsg("สวัสดี! ฉันคือไกด์ทัวร์วอชิงตัน D.C. ถามเรื่องเวลาเปิด เส้นทาง หรือของกินได้เลย ✨");
  else history.forEach((m) => addMsg(m.html, m.who));
})();

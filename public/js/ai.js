// 🚀 D.C. Assistant — Shadow DOM + Draggable FAB + Themed (Dev Mode clears chat)
(() => {
  if (window.__DC_AI__) return; window.__DC_AI__ = true;

  // ลบตอนขึ้นจริง
  localStorage.removeItem("dc_ai_history_v1");

  // ====== Theme & Links ======
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

  // ====== Host + Shadow Root (กันชน CSS หน้าเว็บ) ======
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.right = "22px";
  // พ้นขอบ/ปลอดภัยกับ safe-area (มือถือที่มี notch)
  host.style.bottom = "calc(max(22px, env(safe-area-inset-bottom, 0px) + 22px))";
  host.style.zIndex = "2147483647";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // โหลดตำแหน่งที่ลากไว้ (ถ้ามี)
  try {
    const pos = JSON.parse(localStorage.getItem("dc_ai_fab_pos") || "null");
    if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
      host.style.right = "auto";
      host.style.left  = Math.max(6, pos.x) + "px";
      host.style.bottom = "auto";
      host.style.top   = Math.max(6, pos.y) + "px";
    }
  } catch {}

  // ====== Styles (scoped) ======
  const css = `
  :host { all: initial; }
  * { box-sizing:border-box; font-family:'Kanit',system-ui,Segoe UI,Roboto,sans-serif; }
  .fab{
    position:fixed; right:0; bottom:0; width:58px; height:58px; border-radius:50%;
    background:${COLOR.brand}; color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center;
    cursor:pointer; box-shadow:0 14px 34px rgba(0,0,0,.45);
    transition:transform .2s, background .2s; user-select:none;
    touch-action:none; /* ช่วยลากบนจอสัมผัส */
  }
  .fab:hover{ transform:translateY(-2px) scale(1.05); background:${COLOR.brandHover}; }
  .box{
    position:fixed; right:0; bottom:70px; width:min(360px, calc(100vw - 44px));
    background:${COLOR.bg}; color:${COLOR.text}; border:1px solid ${COLOR.border};
    border-radius:16px; box-shadow:0 22px 60px rgba(0,0,0,.55);
    display:none; flex-direction:column; overflow:hidden;
    transform-origin:bottom right; animation:pop .22s ease-out;
  }
  @keyframes pop{from{opacity:0; transform:scale(.96)} to{opacity:1; transform:scale(1)}}
  .hd{display:flex; align-items:center; gap:8px; padding:10px 12px; background:${COLOR.card}; border-bottom:1px solid ${COLOR.border}; font-weight:700}
  .dot{width:8px; height:8px; border-radius:999px; background:${COLOR.accent}; box-shadow:0 0 10px ${COLOR.accent}}
  .close{margin-left:auto; opacity:.85; cursor:pointer}
  .body{padding:10px 12px; overflow:auto; max-height:50vh}
  .msg{margin:8px 0; display:flex}
  .msg .b{padding:8px 10px; border-radius:12px; max-width:80%}
  .me{justify-content:flex-end} .me .b{background:${COLOR.me}; color:#fff}
  .bot .b{background:${COLOR.bot}; color:${COLOR.text}; border:1px solid ${COLOR.border}}
  .typing{display:inline-flex; gap:6px; align-items:center}
  .typing i{width:6px;height:6px;border-radius:50%;background:#bfbaff;animation:blink 1s infinite}
  .typing i:nth-child(2){animation-delay:.2s} .typing i:nth-child(3){animation-delay:.4s}
  @keyframes blink{0%,100%{opacity:.2} 50%{opacity:1}}
  .input{display:flex; gap:6px; padding:10px; background:${COLOR.card}; border-top:1px solid ${COLOR.border}}
  .input input{
    flex:1; background:#140f2c; border:1px solid ${COLOR.border}; color:${COLOR.text};
    border-radius:10px; padding:9px 10px; outline:none;
  }
  .input button{background:${COLOR.accent}; border:none; color:#111; font-weight:800; border-radius:10px; padding:9px 12px; cursor:pointer}
  a{ color:#9fb6ff; text-decoration:none } a:hover{text-decoration:underline}
  @media (max-width:520px){ .box{ width:min(92vw,360px); } }
  `;
  const style = document.createElement("style"); style.textContent = css; root.appendChild(style);

  // ====== DOM ======
  const fab = document.createElement("div"); fab.className = "fab"; fab.textContent = "AI";
  const box = document.createElement("div"); box.className = "box";
  box.innerHTML = `
    <div class="hd"><span class="dot"></span><span>D.C. Assistant</span><span class="close">✕</span></div>
    <div class="body"></div>
    <div class="input">
      <input type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="พิมพ์คำถาม...">
      <button type="button">ส่ง</button>
    </div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

  // ====== History ======
  const KEY = "dc_ai_history_v1";
  const save = (h) => localStorage.setItem(KEY, JSON.stringify(h.slice(-50)));
  const load = () => JSON.parse(localStorage.getItem(KEY) || "[]");
  const history = load();
  const scrollBottom = () => body.scrollTop = body.scrollHeight;

  const showTyping = () => {
    const w = document.createElement("div"); w.className = "msg bot";
    w.innerHTML = `<div class="b"><span class="typing"><i></i><i></i><i></i></span></div>`;
    body.appendChild(w); scrollBottom(); return w;
  };
  const addMsg = (html, who="bot") => {
    const wrap = document.createElement("div"); wrap.className = `msg ${who}`;
    const b = document.createElement("div"); b.className = "b"; wrap.appendChild(b);
    body.appendChild(wrap); scrollBottom();
    let i=0; const type=()=>{ b.innerHTML = html.slice(0, ++i); if(i<html.length) requestAnimationFrame(type); else scrollBottom(); };
    type();
    history.push({ who, html }); save(history);
  };

  // ====== Intents ======
  const A = (s)=>s;
  const FAQ = [
    { k:[/เวลา|เปิด|ปิด|hour|เปิดกี่โมง|เวลาทำการ/i], a:A(`พิพิธภัณฑ์ Smithsonian ส่วนใหญ่เปิด <b>10:00–17:30</b> น. ดูเพิ่มที่ <a href="${LINKS.museum}">Museum</a>`) },
    { k:[/เริ่ม|ไปยังไง|เส้นทาง|map|route|เที่ยว|เริ่มทัวร์/i], a:A(`เริ่มจาก <a href="${LINKS.explore}">Explore</a> แล้วเลือกหมวดที่สนใจ`) },
    { k:[/อาหาร|กิน|food|burger|half.?smoke|ของกิน/i], a:A(`ของดี D.C. คือ <b>Half-Smoke</b> รายการร้านอยู่ที่ <a href="${LINKS.food}">Food</a>`) },
    { k:[/landmark|อนุสรณ์|lincoln|monument|capitol|รัฐสภา/i], a:A(`แลนด์มาร์กสำคัญที่ <a href="${LINKS.landmark}">Landmark</a> และ <a href="${LINKS.capital}">US Capitol Grounds</a>`) },
    { k:[/story|ประวัติ|history/i], a:A(`เรื่องราว/ไทม์ไลน์ดูที่ <a href="${LINKS.story}">History & Story</a>`) },
    { k:[/พัก|ที่พัก|โรงแรม|hotel/i], a:A(`แนะนำโซนเดินทางสะดวก ดูที่ <a href="${LINKS.hotel}">Hotel</a>`) },
    { k:[/สมัคร|register|sign.?up|login|ล็อกอิน|โปรไฟล์|profile/i], a:A(`จัดการบัญชีที่ <a href="${LINKS.profile}">Profile</a>`) },
    { k:[/ที่มา|อ้างอิง|reference|credit|แหล่งข้อมูล/i], a:A(`รวมแหล่งอ้างอิงที่ <a href="${LINKS.refer}">Reference Source</a>`) },
  ];
  const KEY2LINK = [
    { keys:["museum","พิพิธภัณฑ์","smithsonian"], link:LINKS.museum },
    { keys:["landmark","lincoln","อนุสรณ์","monument","capitol"], link:LINKS.landmark },
    { keys:["food","กิน","burger","half","ร้าน"], link:LINKS.food },
    { keys:["story","history","ประวัติ"], link:LINKS.story },
    { keys:["hotel","โรงแรม","พัก"], link:LINKS.hotel },
    { keys:["explore","เที่ยว","ทัวร์"], link:LINKS.explore },
  ];
  const guessLink = (q) => {
    const qq=q.toLowerCase(); for(const g of KEY2LINK){ if(g.keys.some(k=>qq.includes(k))) return g.link; } return null;
  };
  const answer = (q) => {
    for(const f of FAQ) if(f.k.some(rx=>rx.test(q))) return f.a;
    const g = guessLink(q); if(g) return `น่าจะกำลังมองหา <a href="${g}">หน้านี้</a> ใช่ไหม?`;
    if (/home|หน้าแรก|index/i.test(q)) return `กลับหน้าแรกที่ <a href="${LINKS.home}">Home</a>`;
    if (/profile|โปรไฟล์/i.test(q)) return `จัดการบัญชีที่ <a href="${LINKS.profile}">Profile</a>`;
    return `ยังไม่เข้าใจ ลองเช่น <b>เวลาเปิดพิพิธภัณฑ์</b> / <b>ของกินแนะนำ</b> หรือกดไป <a href="${LINKS.explore}">Explore</a>`;
  };

  // ====== ส่งข้อความ ======
  let lastSend = 0;
  const canSend = () => Date.now() - lastSend > 500;
  const send = () => {
    const q = input.value.trim(); if (!q) return; if (!canSend()) return; lastSend = Date.now();
    addMsg(q.replace(/</g,"&lt;").replace(/>/g,"&gt;"), "me"); input.value = "";
    const t = showTyping(); setTimeout(()=>{ t.remove(); addMsg(answer(q),"bot"); }, 200);
    input.focus();
  };
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e)=> e.key==="Enter" && send());

  const openBox = () => { box.style.display = "flex"; setTimeout(()=>input.focus(),0); };
  const closeBox = () => { box.style.display = "none"; };
  fab.addEventListener("click", ()=> box.style.display==="flex" ? closeBox() : openBox());
  box.querySelector(".close").addEventListener("click", closeBox);

  // ====== Drag-to-move FAB + remember position ======
  (() => {
    let dragging = false, sx=0, sy=0, ox=0, oy=0;
    const start = (x,y) => {
      dragging = true;
      const r = host.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = x; sy = y;
      fab.style.transition = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", stop);
      document.addEventListener("touchmove", onTouchMove, { passive:false });
      document.addEventListener("touchend", stop);
    };
    const onMove = (e) => move(e.clientX, e.clientY);
    const onTouchMove = (e) => { e.preventDefault(); const t=e.touches[0]; move(t.clientX, t.clientY); };
    const move = (x,y) => {
      if(!dragging) return;
      const nx = ox + (x - sx), ny = oy + (y - sy);
      const vw = window.innerWidth, vh = window.innerHeight;
      const clampedX = Math.min(vw - 64, Math.max(6, nx));
      const clampedY = Math.min(vh - 64, Math.max(6, ny));
      host.style.left = clampedX + "px";
      host.style.top  = clampedY + "px";
      host.style.right = "auto"; host.style.bottom = "auto";
    };
    const stop = () => {
      if(!dragging) return;
      dragging = false; fab.style.transition = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", stop);
      const r = host.getBoundingClientRect();
      localStorage.setItem("dc_ai_fab_pos", JSON.stringify({ x:r.left, y:r.top }));
    };
    fab.addEventListener("mousedown", (e)=> start(e.clientX, e.clientY));
    fab.addEventListener("touchstart", (e)=> {
      const t = e.touches[0]; start(t.clientX, t.clientY);
    }, { passive:true });
  })();

  // ====== Greeting / Restore ======
  const hist = history;
  if (!hist.length) addMsg("สวัสดี! ฉันคือไกด์ทัวร์วอชิงตัน D.C. ถามเรื่องเวลาเปิด เส้นทาง ของกิน หรือกดไปหน้า Explore ได้เลย ✨");
  else hist.forEach(m => addMsg(m.html, m.who));
})();

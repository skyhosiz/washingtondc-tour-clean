// 🌎 D.C. Assistant v4 PRO — Smart Links + Rich Info + Mobile Perfect
(() => {
  if (window.__DC_AI__) return;
  window.__DC_AI__ = true;

  const COLOR = {
    brand: "#ff9650",
    brandHover: "#ffaa6a",
    accent: "#6f4cff",
    bg: "#120f25",
    card: "#1a1533",
    text: "#eae9ff",
    me: "#6f4cff",
    bot: "#221a44",
    border: "rgba(255,255,255,.08)"
  };

  // === Root ===
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    right: "16px",
    bottom: "calc(max(16px, env(safe-area-inset-bottom, 0px) + 16px))",
    zIndex: "2147483647"
  });
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // === Styles ===
  const css = `
  html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;font-size:16px;}
  *{box-sizing:border-box;font-family:'Kanit',system-ui,sans-serif;}
  .fab{
    width:54px;height:54px;border-radius:50%;
    background:${COLOR.brand};color:#fff;font-size:26px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.45);
    transition:all .25s ease;user-select:none;
  }
  .fab:hover{transform:scale(1.08);background:${COLOR.brandHover};}
  .box{
    position:fixed;right:10px;bottom:70px;
    width:clamp(280px, 85vw, 360px);
    background:${COLOR.bg};color:${COLOR.text};
    border:1px solid ${COLOR.border};
    border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.55);
    display:none;flex-direction:column;overflow:hidden;
    opacity:0;transform:translateY(8px);transition:all .25s ease;
  }
  .box.show{display:flex;opacity:1;transform:translateY(0);}
  .hd{display:flex;align-items:center;justify-content:space-between;
    padding:8px 12px;background:${COLOR.card};font-weight:700;font-size:14px;}
  .dot{width:7px;height:7px;border-radius:999px;
    background:${COLOR.accent};box-shadow:0 0 10px ${COLOR.accent};}
  .suggest{display:flex;flex-wrap:wrap;gap:5px;padding:6px 10px;background:${COLOR.card};}
  .suggest button{background:${COLOR.accent};color:#111;border:none;border-radius:8px;
    padding:4px 8px;font-weight:600;cursor:pointer;font-size:12px;transition:transform .15s;}
  .suggest button:hover{transform:scale(1.05);}
  .body{padding:8px 10px;overflow-y:auto;max-height:48vh;
    scroll-behavior:smooth;font-size:13px;}
  .msg{margin:6px 0;display:flex;}
  .msg .b{padding:7px 10px;border-radius:12px;max-width:80%;
    word-break:break-word;line-height:1.45;animation:fadeIn .2s ease;}
  .me{justify-content:flex-end;}
  .me .b{background:${COLOR.me};color:#fff;}
  .bot .b{background:${COLOR.bot};border:1px solid ${COLOR.border};}
  @keyframes fadeIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
  .input{display:flex;gap:5px;padding:8px;background:${COLOR.card};
    border-top:1px solid ${COLOR.border};}
  .input input{flex:1;background:#140f2c;border:1px solid ${COLOR.border};
    color:${COLOR.text};border-radius:8px;padding:8px 9px;font-size:13px;outline:none;}
  .input input:focus{border-color:${COLOR.accent};}
  .input button{background:${COLOR.accent};border:none;color:#111;font-weight:800;
    border-radius:8px;padding:8px 10px;font-size:13px;cursor:pointer;transition:transform .2s,opacity .2s;}
  .input button:hover{transform:scale(1.05);opacity:.9;}
  .link{color:#ffb366;text-decoration:underline;cursor:pointer;}
  @media (max-width:480px){
    .fab{width:50px;height:50px;font-size:22px;}
    .box{right:8px;bottom:65px;width:90vw;max-width:340px;}
    .body{max-height:45vh;}
  }
  `;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  // === Elements ===
  const fab = Object.assign(document.createElement("div"), {
    className: "fab",
    innerHTML: "❓",
    title: "คำถามพบบ่อย"
  });

  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = `
    <div class="hd">
      <span style="display:flex;align-items:center;gap:6px">
        <span class="dot"></span> D.C. Assistant
      </span>
      <span class="close" style="cursor:pointer;opacity:.6;">✕</span>
    </div>
    <div class="suggest"></div>
    <div class="body"></div>
    <div class="input">
      <input type="text" placeholder="พิมพ์คำถาม เช่น 'พิพิธภัณฑ์ไหนดี'">
      <button>ส่ง</button>
    </div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const suggBox = box.querySelector(".suggest");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

  const addMsg = (text, who = "bot", html = false) => {
    const wrap = document.createElement("div");
    wrap.className = `msg ${who}`;
    const b = document.createElement("div");
    b.className = "b";
    if (html) b.innerHTML = text;
    else b.textContent = text;
    wrap.appendChild(b);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  };

  // === Suggest Buttons ===
  const SUGGESTS = [
    "📍 ที่เที่ยวใน D.C.",
    "🏛️ พิพิธภัณฑ์ที่น่าสนใจ",
    "🍴 ของกินดังใน D.C.",
    "🕰️ ประวัติเมือง",
    "🚇 การเดินทาง",
    "💵 ข้อมูลเศรษฐกิจ",
    "👥 ประชากรและรายได้",
    "🎓 มหาวิทยาลัยใน D.C.",
    "🎆 เทศกาลสำคัญ",
    "🇹🇭 จากไทยไป D.C.",
    "💬 วิธีใช้เว็บไซต์"
  ];
  SUGGESTS.forEach(txt => {
    const b = document.createElement("button");
    b.textContent = txt;
    b.onclick = () => {
      addMsg(txt, "me");
      askAI(txt).then(r => addMsg(r, "bot", true));
    };
    suggBox.appendChild(b);
  });

  const clearChat = () => {
    body.innerHTML = "";
    addMsg("สวัสดีครับ 👋 ผมคือ D.C. Assistant ✨ ถามได้เลย เช่น ‘ของกินดังใน D.C.’ หรือคลิกคำถามพบบ่อยด้านบนเลยครับ");
  };

  fab.onclick = () => {
    const show = box.classList.contains("show");
    if (show) box.classList.remove("show");
    else {
      clearChat();
      box.classList.add("show");
      input.focus();
    }
  };
  closeBtn.onclick = () => box.classList.remove("show");

  // === Knowledge Base (with links) ===
  async function askAI(q) {
    const t = q.toLowerCase();
    if (t.includes("พิพิธภัณฑ์"))
      return `พิพิธภัณฑ์สมิธโซเนียนกว่า 10 แห่ง เข้าฟรีทุกแห่ง เช่น Air & Space, Natural History, American History 🏛️ <br><span class="link" onclick="location.href='museum.html'">👉 ไปยังหน้าพิพิธภัณฑ์</span>`;
    if (t.includes("ของกิน") || t.includes("อาหาร"))
      return `Half-Smoke 🌭, Crab Cake 🦀, Chili Dog, Cupcake 🍰 เป็นของเด็ดใน D.C.<br><span class="link" onclick="location.href='food.html'">👉 ไปยังหน้าอาหาร</span>`;
    if (t.includes("เที่ยว") || t.includes("สถานที่"))
      return `แนะนำ White House, Lincoln Memorial, National Mall, Capitol Hill 🇺🇸<br><span class="link" onclick="location.href='explore.html'">👉 ไปยังหน้า Explore</span>`;
    if (t.includes("ประวัติ"))
      return `ดี.ซี. ก่อตั้งปี 1790 เพื่อเป็นเมืองหลวงของสหรัฐฯ ตั้งชื่อตาม George Washington 🕰️<br><span class="link" onclick="location.href='story.html'">👉 ไปยังหน้า History</span>`;
    if (t.includes("เศรษฐกิจ"))
      return "รายได้ครัวเรือนเฉลี่ย ~$106,000 ต่อปี 💵, มูลค่าบ้านเฉลี่ย ~$724,600, รายได้ต่อหัว ~$78,000";
    if (t.includes("ประชากร") || t.includes("รายได้"))
      return "มีประชากร ~672,000 คน อายุเฉลี่ย ~35 ปี รายได้ต่อครัวเรือน ~$106,287 (2023)";
    if (t.includes("เดินทาง") || t.includes("ขนส่ง") || t.includes("metro"))
      return "ใช้ Metro, Bus Circulator หรือจักรยาน Capital Bikeshare 🚇 สะดวกทั่วเมือง";
    if (t.includes("เทศกาล"))
      return "เทศกาลซากุระ 🌸 เดือนเมษายน และวันชาติ 4 ก.ค. 🎆 เป็นช่วงคึกคักที่สุดของปี";
    if (t.includes("มหาวิทยาลัย"))
      return "มี Georgetown University, George Washington University, และ American University 🎓";
    if (t.includes("ไทย") || t.includes("อเมริกา"))
      return "จากไทยไป D.C. ✈️: ใช้เที่ยวบินตรงหรือแวะเปลี่ยน เช่น ไทย→ญี่ปุ่น→Dulles (IAD). ต้องมีวีซ่า B1/B2, ใช้เวลาบินเฉลี่ย ~18–20 ชม.";
    if (t.includes("วัฒนธรรม"))
      return "D.C. เป็นศูนย์รวมวัฒนธรรมจากทั่วโลก มีดนตรี Jazz, Go-Go และอาหารนานาชาติ 🎷";
    if (t.includes("ปลอดภัย"))
      return "โดยทั่วไปปลอดภัย แต่ควรหลีกเลี่ยงย่านเปลี่ยวตอนกลางคืน 🔒";
    if (t.includes("วิธีใช้") || t.includes("เว็บ") || t.includes("ไปหน้า"))
      return "คลิกเมนูด้านบนเพื่อไปยังหน้า Explore, Food, Museum, History หรือ Story 🗺️";
    if (t.includes("สวัสดี"))
      return "สวัสดีครับ 🙌 ยินดีช่วยเหลือทุกเรื่องเกี่ยวกับ D.C.";
    if (t.includes("ขอบคุณ"))
      return "ยินดีครับ 😊 ขอให้เที่ยว D.C. สนุกนะครับ!";
    return "ยังไม่มีข้อมูลหมวดนี้ครับ ลองถามเรื่อง พิพิธภัณฑ์ อาหาร การเดินทาง หรือวิธีใช้เว็บไซต์ดูสิ 😄";
  }

  let lastSend = 0;
  const canSend = () => Date.now() - lastSend > 600;
  async function send() {
    const q = input.value.trim();
    if (!q || !canSend()) return;
    lastSend = Date.now();
    addMsg(q, "me");
    input.value = "";
    const reply = await askAI(q);
    addMsg(reply, "bot", true);
  }
  sendBtn.onclick = send;
  input.addEventListener("keydown", e => e.key === "Enter" && send());
})();

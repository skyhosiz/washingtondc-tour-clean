// 🌎 D.C. Assistant Ultimate v3 — Full Data + Smooth + Safe
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

  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    right: "16px",
    bottom: "calc(max(16px, env(safe-area-inset-bottom, 0px) + 16px))",
    zIndex: "2147483647"
  });
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  const css = `
    *{box-sizing:border-box;font-family:'Kanit',system-ui,sans-serif;}
    .fab{width:56px;height:56px;border-radius:50%;
      background:${COLOR.brand};color:#fff;font-size:26px;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.45);
      transition:all .25s ease;user-select:none;}
    .fab:hover{transform:scale(1.08);background:${COLOR.brandHover};}
    .fab::after{content:"คำถามพบบ่อย";position:absolute;bottom:62px;right:0;
      background:rgba(0,0,0,.7);color:#fff;font-size:11px;
      padding:4px 8px;border-radius:5px;opacity:0;transition:opacity .2s;}
    .fab:hover::after{opacity:1;}
    .box{position:fixed;right:0;bottom:70px;
      width:min(340px,calc(100vw - 28px));background:${COLOR.bg};
      color:${COLOR.text};border:1px solid ${COLOR.border};
      border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.55);
      display:none;flex-direction:column;overflow:hidden;
      opacity:0;transform:translateY(10px);transition:all .25s ease;}
    .box.show{display:flex;opacity:1;transform:translateY(0);}
    .hd{display:flex;align-items:center;justify-content:space-between;
      padding:8px 12px;background:${COLOR.card};font-weight:700;font-size:14px;}
    .dot{width:7px;height:7px;border-radius:999px;
      background:${COLOR.accent};box-shadow:0 0 10px ${COLOR.accent};}
    .suggest{display:flex;flex-wrap:wrap;gap:5px;
      padding:6px 10px;background:${COLOR.card};}
    .suggest button{background:${COLOR.accent};color:#111;border:none;
      border-radius:10px;padding:4px 8px;font-weight:600;cursor:pointer;
      font-size:12px;transition:transform .15s;}
    .suggest button:hover{transform:scale(1.05);}
    .body{padding:8px 10px;overflow-y:auto;max-height:50vh;
      scroll-behavior:smooth;font-size:13px;}
    .msg{margin:6px 0;display:flex;}
    .msg .b{padding:7px 10px;border-radius:12px;max-width:80%;
      word-break:break-word;line-height:1.45;animation:fadeIn .2s ease;}
    .me{justify-content:flex-end;}
    .me .b{background:${COLOR.me};color:#fff;}
    .bot .b{background:${COLOR.bot};border:1px solid ${COLOR.border};}
    @keyframes fadeIn{from{opacity:0;transform:translateY(5px);}
                      to{opacity:1;transform:translateY(0);}}
    .input{display:flex;gap:5px;padding:8px;background:${COLOR.card};
      border-top:1px solid ${COLOR.border};}
    .input input{flex:1;background:#140f2c;border:1px solid ${COLOR.border};
      color:${COLOR.text};border-radius:8px;padding:8px 9px;font-size:13px;outline:none;}
    .input input:focus{border-color:${COLOR.accent};}
    .input button{background:${COLOR.accent};border:none;color:#111;
      font-weight:800;border-radius:8px;padding:8px 10px;font-size:13px;
      cursor:pointer;transition:transform .2s,opacity .2s;}
    .input button:hover{transform:scale(1.05);opacity:.9;}
    .close{cursor:pointer;opacity:.6;transition:opacity .2s;}
    .close:hover{opacity:1;}
  `;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

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
      <span class="close">✕</span>
    </div>
    <div class="suggest"></div>
    <div class="body"></div>
    <div class="input">
      <input type="text" placeholder="พิมพ์คำถาม... เช่น 'พิพิธภัณฑ์ไหนดี'">
      <button>ส่ง</button>
    </div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const suggBox = box.querySelector(".suggest");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

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
  SUGGESTS.forEach((txt) => {
    const b = document.createElement("button");
    b.textContent = txt;
    b.onclick = () => {
      addMsg(txt, "me");
      askAI(txt).then((r) => addMsg(r, "bot"));
    };
    suggBox.appendChild(b);
  });

  const clearChat = () => {
    body.innerHTML = "";
    addMsg("สวัสดีครับ 👋 ผมคือ D.C. Assistant ✨ ถามได้เลย เช่น ‘ของกินดังใน D.C.’ หรือ ‘จากไทยไปอเมริกายังไง’");
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

  async function askAI(q) {
    const t = q.toLowerCase();
    if (t.includes("พิพิธภัณฑ์")) return "พิพิธภัณฑ์สมิธโซเนียนกว่า 10 แห่ง เข้าฟรี เช่น Air & Space, Natural History, American History 🏛️";
    if (t.includes("ของกิน") || t.includes("อาหาร")) return "Half-Smoke 🌭, Crab Cake 🦀, Chili Dog, Cupcake 🍰 เป็นของดังใน D.C.";
    if (t.includes("เที่ยว") || t.includes("สถานที่")) return "แนะนำ White House, Lincoln Memorial, National Mall, Capitol Hill 🇺🇸";
    if (t.includes("ประวัติ")) return "ดี.ซี. ก่อตั้งปี 1790 เพื่อเป็นเมืองหลวงของสหรัฐฯ ตั้งชื่อตาม George Washington 🕰️";
    if (t.includes("เศรษฐกิจ")) return "รายได้ครัวเรือนเฉลี่ย ~$106,000 ต่อปี 💵, มูลค่าบ้านเฉลี่ย ~$724,600, รายได้ต่อหัว ~$78,000";
    if (t.includes("ประชากร") || t.includes("รายได้")) return "มีประชากร ~672,000 คน อายุเฉลี่ย ~35 ปี รายได้ต่อครัวเรือน ~$106,287 (2023)";
    if (t.includes("เดินทาง") || t.includes("ขนส่ง") || t.includes("metro")) return "ใช้ Metro, Bus Circulator, หรือจักรยาน Capital Bikeshare 🚇 สะดวกทั่วเมือง";
    if (t.includes("เทศกาล")) return "เทศกาลซากุระ 🌸 เดือนเมษายน และวันชาติ 4 ก.ค. 🎆 เป็นช่วงคึกคักที่สุดของปี";
    if (t.includes("มหาวิทยาลัย")) return "มี Georgetown University, George Washington University, American University 🎓";
    if (t.includes("ไทย") || t.includes("อเมริกา")) return "จากไทยไป D.C. ✈️: ใช้เที่ยวบินต่อเดียวหรือแวะเปลี่ยน เช่น ไทย->ญี่ปุ่น->Dulles (IAD). ต้องมีวีซ่า B1/B2, ใช้เวลาบินเฉลี่ย ~18-20 ชม.";
    if (t.includes("วัฒนธรรม")) return "วอชิงตัน ดี.ซี. รวมผู้คนจากทั่วโลก มีดนตรี Jazz, Go-Go และอาหารหลากวัฒนธรรม 🎷";
    if (t.includes("ปลอดภัย")) return "โดยรวมปลอดภัย แต่หลีกเลี่ยงย่านเปลี่ยวตอนกลางคืน 🔒";
    if (t.includes("วิธีใช้") || t.includes("เว็บ") || t.includes("ไปหน้า")) return "คลิกเมนูด้านบนเพื่อไป Explore, Food, Museum, History หรือ Story 🗺️";
    if (t.includes("ขอบคุณ")) return "ยินดีครับ 😊 ขอให้เที่ยว D.C. สนุกนะครับ!";
    if (t.includes("สวัสดี")) return "สวัสดีครับ 🙌 ยินดีช่วยเหลือทุกเรื่องเกี่ยวกับ D.C.";
    return "ยังไม่มีข้อมูลหมวดนี้ครับ ลองถามเรื่อง พิพิธภัณฑ์ อาหาร เศรษฐกิจ หรือ การเดินทาง จากไทย ไป D.C. ดูสิ 😄";
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
    addMsg(reply, "bot");
  }

  sendBtn.onclick = send;
  input.addEventListener("keydown", (e) => e.key === "Enter" && send());
})();

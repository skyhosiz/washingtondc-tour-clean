// 🌎 D.C. Assistant Supreme — Offline FAQ Chatbot (Smart UI + All Topics)
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
    border: "rgba(255,255,255,.08)",
  };

  // 🔹 Floating base
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    right: "22px",
    bottom: "calc(max(22px, env(safe-area-inset-bottom, 0px) + 22px))",
    zIndex: "2147483647",
  });
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  // 🔹 Styles
  const css = `
    * { box-sizing: border-box; font-family: 'Kanit', system-ui, sans-serif; }
    .fab {
      position: fixed; right: 0; bottom: 0;
      width: 58px; height: 58px; border-radius: 50%;
      background: ${COLOR.brand}; color: #fff; font-size: 28px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 14px 34px rgba(0,0,0,.45);
      transition: all .25s cubic-bezier(.22,1,.36,1);
      user-select: none;
    }
    .fab:hover { transform: scale(1.1) rotate(6deg); background: ${COLOR.brandHover}; }
    .fab::after {
      content: "คำถามพบบ่อย";
      position: absolute;
      bottom: 65px; right: 0;
      background: rgba(0,0,0,0.7);
      color: white; font-size: 12px; padding: 5px 10px;
      border-radius: 6px; opacity: 0; pointer-events: none;
      transition: opacity .2s ease;
      white-space: nowrap;
    }
    .fab:hover::after { opacity: 1; }
    .box {
      position: fixed; right: 0; bottom: 70px;
      width: min(380px, calc(100vw - 44px));
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
    .suggest { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; background: ${COLOR.card}; }
    .suggest button {
      background: ${COLOR.accent}; color: #111; border: none; border-radius: 10px;
      padding: 5px 10px; font-weight: 600; cursor: pointer; font-size: 13px;
      transition: transform .15s;
    }
    .suggest button:hover { transform: scale(1.05); }
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

  // 🟠 UI Structure
  const fab = Object.assign(document.createElement("div"), {
    className: "fab",
    innerHTML: "❓",
    title: "คำถามพบบ่อย",
  });

  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = `
    <div class="hd">
      <span style="display:flex;align-items:center;gap:8px">
        <span class="dot"></span> D.C. Assistant
      </span>
      <span class="close">✕</span>
    </div>
    <div class="suggest"></div>
    <div class="body"></div>
    <div class="input">
      <input type="text" placeholder="พิมพ์คำถาม... เช่น 'ของกินใน D.C.'">
      <button>ส่ง</button>
    </div>
  `;
  root.append(fab, box);

  const body = box.querySelector(".body");
  const suggBox = box.querySelector(".suggest");
  const input = box.querySelector("input");
  const sendBtn = box.querySelector("button");
  const closeBtn = box.querySelector(".close");

  // 💬 Message
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

  // ✨ Suggest Buttons
  const SUGGESTS = [
    "📍 ที่เที่ยวใน D.C.",
    "🏛️ พิพิธภัณฑ์ที่น่าสนใจ",
    "🍴 ของกินดังใน D.C.",
    "🕰️ ประวัติเมือง",
    "🚇 การเดินทาง",
    "🎓 มหาวิทยาลัยใน D.C.",
    "🎆 เทศกาลสำคัญ",
    "💬 วิธีใช้เว็บไซต์",
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
    addMsg("สวัสดีครับ! 👋 ผมคือ D.C. Assistant ✨ ถามได้เลย เช่น ‘พิพิธภัณฑ์ไหนดี’ หรือคลิกคำถามพบบ่อยด้านบนเลยครับ");
  };

  fab.onclick = () => {
    const isShown = box.classList.contains("show");
    if (isShown) box.classList.remove("show");
    else {
      clearChat();
      box.classList.add("show");
      input.focus();
    }
  };
  closeBtn.onclick = () => box.classList.remove("show");

  // 🧠 Local Q&A Knowledge Base
  async function askAI(q) {
    const t = q.toLowerCase();
    if (t.includes("พิพิธภัณฑ์")) return "พิพิธภัณฑ์สมิธโซเนียนมีมากกว่า 10 แห่ง เข้าฟรีทุกแห่ง เช่น Air & Space, Natural History, American History 🏛️";
    if (t.includes("ของกิน") || t.includes("อาหาร")) return "Half-Smoke, Crab Cake, Chili Dog, Cupcake 🍰 — ของเด็ดที่ต้องลองใน D.C.";
    if (t.includes("เที่ยว") || t.includes("สถานที่")) return "แนะนำ: ทำเนียบขาว, อนุสาวรีย์ลินคอล์น, National Mall, Capitol Hill 🇺🇸";
    if (t.includes("ประวัติ")) return "วอชิงตัน ดี.ซี. ก่อตั้งปี 1790 เพื่อเป็นเมืองหลวงของสหรัฐฯ ชื่อมาจากประธานาธิบดีจอร์จ วอชิงตัน 🕰️";
    if (t.includes("อากาศ")) return "ฤดูใบไม้ผลิ (มี.ค.–พ.ค.) คือช่วงดีที่สุด 🌸 หน้าร้อนร้อนชื้น หน้าหนาวมีหิมะบางปี ❄️";
    if (t.includes("ขนส่ง") || t.includes("เดินทาง") || t.includes("metro")) return "ใช้ Metro, Bus Circulator หรือจักรยาน Capital Bikeshare สะดวกมาก 🚇";
    if (t.includes("มหาวิทยาลัย")) return "ที่นี่มี Georgetown, George Washington University, และ American University 🎓";
    if (t.includes("เทศกาล")) return "เทศกาลซากุระเดือนเมษายน 🌸 และ Independence Day (4 ก.ค.) เป็นงานใหญ่ประจำปี!";
    if (t.includes("วัฒนธรรม")) return "D.C. รวมวัฒนธรรมจากทั่วโลก มีดนตรี Jazz, Go-Go และอาหารนานาชาติ 🎷";
    if (t.includes("กฎหมาย") || t.includes("ปลอดภัย")) return "โดยทั่วไปปลอดภัย แต่ควรหลีกเลี่ยงย่านเปลี่ยวตอนกลางคืน 🔒";
    if (t.includes("วิธีใช้") || t.includes("เว็บ") || t.includes("ไปหน้า")) return "คลิกเมนูด้านบนเพื่อไปหน้า Explore, Food, Museum, History, หรือ Story 🗺️";
    if (t.includes("สวัสดี")) return "สวัสดีครับ! 🙌 ยินดีต้อนรับสู่ D.C. Assistant ถามได้ทุกอย่างเกี่ยวกับวอชิงตัน ดี.ซี.";
    if (t.includes("ขอบคุณ")) return "ยินดีครับ 😊 ขอให้เที่ยววอชิงตัน ดี.ซี. สนุกนะครับ!";
    return "คำถามนี้ยังไม่มีในหมวดพบบ่อยครับ ลองถามเรื่องพิพิธภัณฑ์ อาหาร การเดินทาง หรือวิธีใช้เว็บไซต์ดูสิครับ 😄";
  }

  // 🚀 Sending
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

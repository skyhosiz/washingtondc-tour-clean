(() => {
  if (window.__DC_ASSISTANT__) return;
  window.__DC_ASSISTANT__ = true;

  const COLOR = {
    brand: "#ff9650",
    accent: "#6f4cff",
    bg: "#120f25",
    card: "#1a1533",
    text: "#eae9ff",
    border: "rgba(255,255,255,.08)"
  };

  if (!localStorage.getItem("dc_tutorial_done")) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.85);
      color:white;z-index:999999;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;
      font-family:'Kanit',sans-serif;padding:30px;
    `;
    overlay.innerHTML = `
      <h1 style="color:${COLOR.brand};font-size:28px;">👋 ยินดีต้อนรับสู่ Washington D.C. Tour</h1>
      <p style="max-width:480px;margin:20px 0 25px;">
        เว็บไซต์นี้มีผู้ช่วยอัจฉริยะที่จะพาคุณสำรวจเมืองหลวงแห่งสหรัฐฯ —
        <br>คลิกปุ่ม <b style="color:${COLOR.brand};">📍 มุมขวาล่าง</b> เพื่อดูข้อมูลแนะนำทั้งหมด!
      </p>
      <button id="startTutorial" style="
        background:${COLOR.accent};border:none;padding:10px 24px;
        border-radius:8px;color:#111;font-weight:700;font-size:15px;cursor:pointer;
      ">เข้าใจแล้ว เริ่มเลย!</button>
    `;
    document.body.appendChild(overlay);
    document.getElementById("startTutorial").onclick = () => {
      overlay.remove();
      localStorage.setItem("dc_tutorial_done", "1");
    };
  }

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
  .fab{
    width:56px;height:56px;border-radius:50%;
    background:${COLOR.brand};color:#fff;font-size:26px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45);
    transition:all .25s ease;
  }
  .fab:hover{transform:scale(1.08);}
  .box{
    position:fixed;right:10px;bottom:70px;
    width:clamp(280px,90vw,360px);
    background:${COLOR.bg};color:${COLOR.text};
    border:1px solid ${COLOR.border};
    border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.55);
    display:none;flex-direction:column;overflow:hidden;
    opacity:0;transform:translateY(8px);transition:all .25s ease;
  }
  .box.show{display:flex;opacity:1;transform:translateY(0);}
  .hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;background:${COLOR.card};font-weight:700;font-size:15px;}
  .dot{width:7px;height:7px;border-radius:999px;
    background:${COLOR.accent};box-shadow:0 0 10px ${COLOR.accent};}
  .body{padding:10px;overflow-y:auto;max-height:60vh;font-size:14px;line-height:1.5;}
  .link-card{
    background:${COLOR.card};border:1px solid ${COLOR.border};
    border-radius:10px;padding:10px;margin:6px 0;transition:.25s;
  }
  .link-card:hover{background:#1f1844;transform:scale(1.03);}
  .link-card a{text-decoration:none;color:${COLOR.text};display:block;}
  .link-card strong{color:${COLOR.brand};font-size:15px;}
  @media(max-width:480px){
    .fab{width:50px;height:50px;font-size:22px;}
    .body{max-height:55vh;}
  }`;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  const fab = Object.assign(document.createElement("div"), {
    className: "fab",
    innerHTML: "📍",
    title: "คำแนะนำ D.C."
  });

  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = `
    <div class="hd">
      <span style="display:flex;align-items:center;gap:6px;">
        <span class="dot"></span> D.C. Guide Assistant
      </span>
      <span class="close" style="cursor:pointer;opacity:.7;">✕</span>
    </div>
    <div class="body"></div>
  `;
  root.append(fab, box);
  const body = box.querySelector(".body");
  const closeBtn = box.querySelector(".close");

  const LINKS = [
    {
      title: "🏛️ พิพิธภัณฑ์ที่ควรไป",
      desc: "พิพิธภัณฑ์ในเครือ Smithsonian ฟรีทุกแห่ง เช่น Air & Space, Natural History, American History",
      inSite: "museum.html",
      outSite: "https://www.si.edu/museums"
    },
    {
      title: "🍴 ของกินดังใน D.C.",
      desc: "Half-Smoke จาก Ben’s Chili Bowl 🌭, ไก่ทอด Maketto 🍗, Cupcake Georgetown Bakery 🍰",
      inSite: "food.html",
      outSite: "https://washington.org/visit-dc/must-try-dishes-washington-dc"
    },
    {
      title: "📍 สถานที่ท่องเที่ยวแนะนำ",
      desc: "แลนด์มาร์กหลัก : White House, Lincoln Memorial, National Mall และ Capitol Hill",
      inSite: "explore.html",
      outSite: "https://washington.org/things-to-do-in-washington-dc"
    },
    {
      title: "🕰️ ประวัติเมืองหลวงสหรัฐฯ",
      desc: "ก่อตั้งปี 1790 ตั้งชื่อตาม George Washington เป็นศูนย์กลางรัฐบาลสหรัฐฯ",
      inSite: "story.html",
      outSite: "https://en.wikipedia.org/wiki/Washington,_D.C."
    },
    {
      title: "🚇 การเดินทางในเมือง",
      desc: "Metro, DC Circulator และจักรยาน Capital Bikeshare เดินทางสะดวกทั่วเมือง",
      outSite: "https://www.wmata.com/schedules/maps/"
    },
    {
      title: "🎆 เทศกาลซากุระแห่งชาติ",
      desc: "ช่วง มีนาคม-เมษายน รอบ Tidal Basin 🌸 พร้อมกิจกรรมริมแม่น้ำ Potomac",
      outSite: "https://nationalcherryblossomfestival.org/"
    },
    {
      title: "🎓 มหาวิทยาลัยใน D.C.",
      desc: "รวมสถาบันดัง เช่น Georgetown U., George Washington U., American U., Howard U.",
      outSite: "https://collegesimply.com/colleges/district-of-columbia/"
    },
    {
      title: "🇹🇭 จากไทยไป D.C.",
      desc: "แนะนำเส้นทางบิน ไทย → ญี่ปุ่น → Dulles (IAD) หรือ ต่อเครื่องยุโรป รวม 18–20 ชม.",
      outSite: "https://www.rome2rio.com/s/Thailand/Washington-DC"
    },
    {
      title: "🏢 สถานทูตไทยใน D.C.",
      desc: "ติดต่อราชการ ขอวีซ่า ทำหนังสือเดินทาง ข้อมูลล่าสุดจาก เว็บไซต์ทางการ",
      outSite: "https://washingtondc.thaiembassy.org/en"
    },
    {
      title: "🗺️ แผนที่เมือง D.C. (Google Maps)",
      desc: "ดูแผนที่ สถานที่ และเส้นทางทั้งหมดใน D.C.",
      outSite: "https://www.google.com/maps/place/Washington,+DC/"
    }
  ];

  LINKS.forEach(item => {
    const card = document.createElement("div");
    card.className = "link-card";
    let html = `<a href="${item.outSite}" target="_blank" rel="noopener">
      <strong>${item.title}</strong><br>${item.desc || ""}
    </a>`;
    if (item.inSite)
      html += `<div style="margin-top:5px;"><a href="${item.inSite}" style="color:#ffb366;text-decoration:underline;">🌐 เปิดหน้าภายในเว็บไซต์</a></div>`;
    card.innerHTML = html;
    body.appendChild(card);
  });

  fab.onclick = () => box.classList.toggle("show");
  closeBtn.onclick = () => box.classList.remove("show");
})();

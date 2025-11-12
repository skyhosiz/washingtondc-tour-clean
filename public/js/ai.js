// 🌎 D.C. Assistant v5 — Guide Mode (No Input, Smart Links + Real Sources)
(() => {
  if (window.__DC_GUIDE__) return;
  window.__DC_GUIDE__ = true;

  const COLOR = {
    brand: "#ff9650",
    accent: "#6f4cff",
    bg: "#120f25",
    card: "#1a1533",
    text: "#eae9ff",
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
  *{box-sizing:border-box;font-family:'Kanit',system-ui,sans-serif;}
  .fab{
    width:56px;height:56px;border-radius:50%;
    background:${COLOR.brand};color:#fff;font-size:26px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45);
    transition:all .25s ease;
  }
  .fab:hover{transform:scale(1.1);}
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
    border-radius:10px;padding:10px;margin:6px 0;transition:.2s;
  }
  .link-card:hover{background:#1f1844;transform:scale(1.02);}
  .link-card a{
    text-decoration:none;color:${COLOR.text};display:block;
  }
  .link-card strong{color:${COLOR.brand};font-size:15px;}
  @media(max-width:480px){
    .fab{width:50px;height:50px;font-size:22px;}
    .body{max-height:55vh;}
  }
  `;
  root.appendChild(Object.assign(document.createElement("style"), { textContent: css }));

  // === Elements ===
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

  // === Guide Data ===
  const LINKS = [
    {
      title: "🏛️ พิพิธภัณฑ์ที่ควรไป",
      desc: "รวมพิพิธภัณฑ์ฟรีในเครือ Smithsonian เช่น Air & Space, Natural History, American History",
      inSite: "museum.html",
      outSite: "https://www.si.edu/museums"
    },
    {
      title: "🍴 ของกินดังใน D.C.",
      desc: "เมนูท้องถิ่น: Half-Smoke, Crab Cake, Chili Dog และ Cupcake สุดดังจาก Georgetown",
      inSite: "food.html",
      outSite: "https://washington.org/visit-dc/best-foods-washington-dc"
    },
    {
      title: "📍 สถานที่ท่องเที่ยวแนะนำ",
      desc: "แลนด์มาร์กหลัก: White House, Lincoln Memorial, National Mall, Capitol Hill",
      inSite: "explore.html",
      outSite: "https://washington.org/things-to-do"
    },
    {
      title: "🕰️ ประวัติเมืองหลวงสหรัฐฯ",
      desc: "วอชิงตัน ดี.ซี. ก่อตั้งปี 1790 ตั้งชื่อตาม George Washington เป็นศูนย์กลางรัฐบาลสหรัฐฯ",
      inSite: "story.html",
      outSite: "https://en.wikipedia.org/wiki/Washington,_D.C."
    },
    {
      title: "🚇 การเดินทางในเมือง",
      desc: "เดินทางสะดวกด้วย Metro, DC Circulator Bus และจักรยาน Capital Bikeshare",
      inSite: "explore.html",
      outSite: "https://wmata.com/schedules/maps/"
    },
    {
      title: "🎆 เทศกาลและกิจกรรมประจำปี",
      desc: "เทศกาลซากุระแห่งชาติ (Cherry Blossom Festival) เดือนมีนาคม–เมษายน คือช่วงคึกคักที่สุด",
      inSite: "explore.html",
      outSite: "https://nationalcherryblossomfestival.org/"
    },
    {
      title: "🎓 มหาวิทยาลัยใน D.C.",
      desc: "Georgetown University, George Washington University, American University",
      outSite: "https://www.universities.com/district-of-columbia/"
    },
    {
      title: "🇹🇭 จากไทยไป D.C.",
      desc: "บินตรงหรือแวะต่อได้ เช่น ไทย→ญี่ปุ่น→Dulles (IAD). ใช้เวลาเฉลี่ย ~18–20 ชม.",
      outSite: "https://www.bangkokairline.org/flights-to-washington-dc"
    },
    {
      title: "🏢 สถานทูตไทย ณ กรุงวอชิงตัน ดี.ซี.",
      desc: "ติดต่อวีซ่า/เอกสารได้ที่สถานทูตไทยใน D.C.",
      outSite: "https://thaiembdc.org/"
    },
    {
      title: "🗺️ แผนที่เมือง D.C. (Google Maps)",
      desc: "สำรวจสถานที่จริงผ่าน Google Maps",
      outSite: "https://www.google.com/maps/place/Washington,+DC/"
    }
  ];

  // === Render cards ===
  LINKS.forEach(item => {
    const card = document.createElement("div");
    card.className = "link-card";
    let inner = `<a href="${item.outSite}" target="_blank">
      <strong>${item.title}</strong><br>${item.desc || ""}
    </a>`;
    if (item.inSite)
      inner += `<div style="margin-top:5px;"><a href="${item.inSite}" style="color:#ffb366;text-decoration:underline;">🌐 เปิดหน้าภายในเว็บไซต์</a></div>`;
    card.innerHTML = inner;
    body.appendChild(card);
  });

  // === Events ===
  fab.onclick = () => {
    const show = box.classList.contains("show");
    if (show) box.classList.remove("show");
    else box.classList.add("show");
  };
  closeBtn.onclick = () => box.classList.remove("show");
})();

// Section animation
const observer = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".section").forEach(sec => observer.observe(sec));

// Popup Data Text
const deepInfo = {
  "Birth of Washington D.C.": {
    img: "pic/His/HIS.png",
    text: `
      <p>วอชิงตัน ดี.ซี. ก่อตั้งขึ้นในปี <b>ค.ศ. 1790</b> ...</p>
      <p>พื้นที่ตั้งอยู่ริมแม่น้ำโปโตแมก...</p>
      <p>เมืองนี้เป็นสัญลักษณ์...</p>`
  },
  "The Original District Map": {
    img: "pic/His/map.png",
    text: `
      <p>แผนผังเมืองปี <b>ค.ศ.1791</b>...</p>
      <p>โครงสร้างกริด...</p>
      <p>ผังนี้ยังเป็นรากฐาน...</p>`
  },
  // ✅ เบาไฟล์ / ตัดข้อความซ้ำ
};

// Popup Logic
const popup = document.getElementById("popup");
const popupImg = document.getElementById("popup-img");
const popupTitle = document.getElementById("popup-title");
const popupText = document.getElementById("popup-text");
const closeBtn = document.querySelector(".popup .close");

document.querySelectorAll(".section").forEach(sec => {
  sec.addEventListener("click", () => {
    const title = sec.querySelector(".title").textContent.trim();
    const info = deepInfo[title] || {
      img: "pic/His/default.png",
      text: "<p>ยังไม่มีข้อมูลเพิ่มเติม</p>",
    };

    popupImg.src = info.img;
    popupTitle.textContent = title;
    popupText.innerHTML = info.text;
    popup.classList.add("show");
  });
});

// Close popup
closeBtn.addEventListener("click", () => popup.classList.remove("show"));
popup.addEventListener("click", e => {
  if (e.target === popup) popup.classList.remove("show");
});

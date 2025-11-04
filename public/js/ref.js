document.addEventListener("DOMContentLoaded", async () => {

  // ✅ ตรวจ token ก่อนแสดงหน้า
  if (!await verifyToken()) return logout();

  const cards = document.querySelectorAll(".ref-card");

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.25 });

  cards.forEach(c => obs.observe(c));
});

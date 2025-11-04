function openMuseum() {
  gtag("event", "open_museum_official_site", {
    event_category: "User Click",
    label: "Smithsonian Museum Official"
  });

  window.open("https://www.si.edu/", "_blank");
}

// ✅ Scroll reveal animation
const reveals = document.querySelectorAll(".reveal");
function revealElements() {
  const windowHeight = window.innerHeight;
  reveals.forEach(el => {
    const elementTop = el.getBoundingClientRect().top;
    if (elementTop < windowHeight - 120) {
      el.classList.add("show");
    }
  });
}
window.addEventListener("scroll", revealElements);
revealElements();

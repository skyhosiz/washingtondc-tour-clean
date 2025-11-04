function goHome() {
  location.href = "index.html";
}

function openBooking() {
  gtag("event", "view_booking", {
    event_category: "User Click",
    label: "Booking.com"
  });
  window.open("https://www.booking.com/city/us/washington.html", "_blank");
}

// ✅ Scroll reveal animation
const reveals = document.querySelectorAll(".reveal");
function revealElements() {
  const windowHeight = window.innerHeight;
  reveals.forEach(el => {
    const elementTop = el.getBoundingClientRect().top;
    if (elementTop < windowHeight - 120) el.classList.add("show");
  });
}
window.addEventListener("scroll", revealElements);
revealElements();

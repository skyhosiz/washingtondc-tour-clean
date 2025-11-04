document.addEventListener("DOMContentLoaded", () => {
  const info = document.querySelector(".info");

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      info.classList.add("show");
      observer.disconnect();
    }
  }, { threshold: 0.3 });

  observer.observe(info);
});

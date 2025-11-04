document.querySelector(".btn.web").addEventListener("click", () => {
  const token = localStorage.getItem("token");
  if (token) {
    window.location.href = "devhub.html";
  } else {
    window.location.href = "login.html";
  }
});

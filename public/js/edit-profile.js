const API_BASE = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://washingtondc-tour-clean-1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  showCachedUser();
  loadUserFromServer();
});

function showCachedUser(){
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user) return;

  profileImg.src = user.profileImg || "pic/default.png";
  nameInput.placeholder = user.username || "ชื่อผู้ใช้";
  usernameTop.textContent = user.username || "User";
}

async function loadUserFromServer(){
  try{
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      headers:{ Authorization:"Bearer "+localStorage.getItem("token") }
    });
    const data = await res.json();
    if(data.status==="success"){
      localStorage.setItem("user", JSON.stringify(data.user));
      showCachedUser();
    }
  }catch(err){
    console.warn("Profile load failed:", err);
  }
}

imgUpload.addEventListener("change", () => {
  const file = imgUpload.files[0];
  if(file) profileImg.src = URL.createObjectURL(file);
});

async function saveEdit(){
  const fd = new FormData();
  if(nameInput.value.trim()) fd.append("username", nameInput.value.trim());
  if(imgUpload.files[0]) fd.append("profileImg", imgUpload.files[0]);

  try{
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method:"PUT",
      headers:{ Authorization:"Bearer "+localStorage.getItem("token") },
      body:fd
    });
    const data = await res.json();

    if(data.status==="success"){
      localStorage.setItem("user", JSON.stringify(data.user));
      alert("✅ บันทึกสำเร็จ!");
      location.href="profile.html";
    }else{
      alert("❌ บันทึกไม่สำเร็จ");
    }
  }catch(err){
    alert("⚠️ Network Error");
  }
}

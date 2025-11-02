document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile(){
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));

    if(!token || !user){
        return location.href = "login.html";
    }

    document.getElementById("profileName").value = user.name || "";
    document.getElementById("profileEmail").value = user.email || "";
    document.getElementById("profileAvatar").textContent = user.name?.charAt(0) || "U";
}

async function saveProfile(){
    const name = document.getElementById("profileName").value.trim();
    if(name.length < 2){
        return showDev("กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร");
    }

    const user = JSON.parse(localStorage.getItem("user"));

    const res = await fetch("/api/user/update", {
        method: "PUT",
        headers:{
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify({ name })
    });

    const data = await res.json();

    if(data.success){
        user.name = name;
        localStorage.setItem("user", JSON.stringify(user));
        showDev("✅ อัปเดตข้อมูลสำเร็จ!");
        loadProfile();
    } else {
        showDev("❌ บันทึกล้มเหลว โปรดลองอีกครั้ง");
    }
}

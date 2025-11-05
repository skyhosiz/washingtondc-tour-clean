// ✅ ป้องกันประกาศซ้ำเมื่อ auth.js ถูกโหลดหลายครั้ง
if (!window.__AUTH_LOADED__) {
window.__AUTH_LOADED__ = true;

const PUBLIC_PAGES = new Set(["login", "register", "forgot", "reset"]);
const API_BASE = location.hostname === "localhost"
? "http://localhost:3000"
: "https://washingtondc-tour-clean-1.onrender.com";

// ✅ Email Pattern & Password Strength
const EMAIL_RGX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASS_RGX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// ✅ Cooldown Anti-Spam
let cooldown = false;
function startCooldown(btn,sec=3){
cooldown=true;
btn.disabled=true;
setTimeout(()=>{cooldown=false;btn.disabled=false},sec*1000);
}

function saveAuth(data){
localStorage.setItem("token",data.token);
localStorage.setItem("user",JSON.stringify(data.user));
}

// ✅ ฟังก์ชันสมัคร + Validate + Cooldown
async function register(email,password,btn){
if (cooldown) return alert("⏳ กรุณารอสักครู่");

// ❌ Check Format
if(!EMAIL_RGX.test(email)) return alert("📧 อีเมลไม่ถูกต้องครับ");
if(!PASS_RGX.test(password))
return alert("🔐 ต้อง ≥8 ตัว + ตัวใหญ่ + ตัวเลข");

startCooldown(btn);

btn.textContent="กำลังสมัคร...";

const res = await fetch(`${API_BASE}/api/auth/register`,{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({email,password}),
});

const data = await res.json().catch(()=>null);

// ✅ Require Email Verified Before Login
if(res.ok && data.status==="success"){
alert("✅ สมัครสำเร็จ!\nโปรดยืนยันอีเมลก่อนเข้าสู่ระบบ");
btn.textContent="สมัครสมาชิก";
return true;
}

alert(data?.message || "❌ สมัครไม่สำเร็จ!");
btn.textContent="สมัครสมาชิก";
return false;
}

function logout(){
localStorage.removeItem("token");
localStorage.removeItem("user");
location.replace("login.html");
}

function getPageName(){
let n=location.pathname.split("/").pop();
if(!n||n==="/")n="index.html";
return n.replace(".html","").toLowerCase();
}

document.addEventListener("DOMContentLoaded",()=>{
const page=getPageName();
const stored = localStorage.getItem("user");
const token=localStorage.getItem("token");

// ✅ บล็อกคนยังไม่ Verify Email
if(stored){
try{
const u=JSON.parse(stored);
if(!u.isVerified){
if(page!=="verify"&&page!=="login"){
alert("📩 โปรดยืนยันอีเมลก่อนใช้งาน");
return location.replace("login.html");
}}}catch(e){}
}

if(window.DISABLE_NAV_AUTH)return;
if(token&&PUBLIC_PAGES.has(page))return location.replace("index.html");
if(!token&&!PUBLIC_PAGES.has(page))return location.replace("login.html");
});
}

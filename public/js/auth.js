// auth.js — stable & defensive

// ✅ หน้า public เข้าได้เสมอ (ไม่ต้องมี token)
const PUBLIC_PAGES = new Set(["intro", "login", "register", "forgot", "reset"]);

// ---------- Utils: เกราะกันงง ----------
const Redirect = (() => {
  let jumped = false; // กัน redirect ซ้ำซ้อนในเฟรมเดียว
  return (target) => {
    if (jumped) return;
    jumped = true;

    // ถ้าอยู่ที่หน้าเดียวกับเป้าหมายอยู่แล้ว ไม่ต้องกระดิก
    const now = (location.pathname.split("/").pop() || "").toLowerCase();
    const nowBase = now.replace(/\.html?$/,"") || "intro";
    if (nowBase === target) return;

    // หน้าที่ควร replace (ไม่อยากเลอะ history)
    const hardReplace = (name) =>
      location.replace(name.endsWith(".html") ? name : name + ".html");

    if (target === "login") return hardReplace("login.html");
    if (target === "intro") return hardReplace("intro.html");
    // หน้า private อื่น ๆ (เก็บ history เพื่อกด back ได้)
    location.assign(target + ".html");
  };
})();

// ตรวจว่า localStorage ใช้งานได้ (กัน quota/โหมด private แปลก ๆ)
function safeStorage() {
  try {
    const k = "__chk__" + Date.now();
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

// JWT แบบคร่าว ๆ: โครง 3 ส่วน และลองอ่าน exp ถ้ามี (กัน token หมดอายุค้าง)
function parseJwtExp(token) {
  try {
    if (typeof token !== "string" || token.split(".").length !== 3) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}
function isJwtValid(token) {
  if (!token || typeof token !== "string") return false;
  const exp = parseJwtExp(token);
  if (!exp) return true; // ไม่มี exp ก็ปล่อยผ่าน (ฝั่งเซิร์ฟเวอร์ตรวจจริง)
  const now = Math.floor(Date.now() / 1000);
  return exp > now;
}

// อ่านชื่อหน้าให้เป๊ะ: รองรับ /, index.html, ชื่อไฟล์, ตัวพิมพ์ ฯลฯ
function getPageName() {
  let name = location.pathname.split("/").pop() || "";
  if (!name || name === "/" || name.toLowerCase() === "index.html") name = "intro.html";
  return name.replace(/\.html?$/i, "").toLowerCase();
}

// ---------- API ที่ถูกเรียกจากหน้าต่าง ๆ ----------
function saveAuth(data) {
  const store = safeStorage();
  if (!store || !data || !data.token || !data.user) return;

  // ถ้า token หมดอายุแล้ว ไม่เซฟ (กัน state หลอก)
  if (!isJwtValid(data.token)) return;

  try {
    store.setItem("token", data.token);
    store.setItem("user", JSON.stringify(data.user));
  } catch { /* เงียบ ๆ */ }
}

function logout() {
  const store = safeStorage();
  if (store) {
    try {
      store.removeItem("token");
      store.removeItem("user");
    } catch { /* เงียบ ๆ */ }
  }
  Redirect("login");
}

// ---------- Gatekeeper ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = getPageName();               // e.g. "intro", "login", "profile"
  const store = safeStorage();
  const token = store ? store.getItem("token") : null;
  const authed = isJwtValid(token);

  // ล็อกช่วยดีบักเล็กน้อย (ถ้าไม่อยากเห็นลบได้)
  console.log(`[Gate] page=${page} | token=${authed ? "YES" : "NO"}`);

  if (authed) {
    // ล็อกอินแล้ว: ถ้าอยู่หน้า public (รวม intro) → อยู่ intro ไปก่อน
    if (PUBLIC_PAGES.has(page)) return Redirect("intro");
    // หน้า private อื่น ๆ → ปล่อยผ่าน
    return;
  }

  // ไม่ได้ล็อกอิน: ถ้าไม่ใช่หน้า public → เด้งไป login
  if (!PUBLIC_PAGES.has(page)) return Redirect("login");
});

// ---------- export ฟังก์ชันที่หน้าอื่นเรียกใช้ ----------
window.saveAuth = saveAuth;
window.logout = logout;

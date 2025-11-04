// ✅ เลื่อนลงไปเมนู
function scrollToMenu(){
  document.getElementById("menuHere").scrollIntoView({ behavior:"smooth" });
}

// ✅ Fade-in cards Animation
const cards=document.querySelectorAll(".cards a");
const obs=new IntersectionObserver((ent)=>{
  ent.forEach(e=>{
    if(e.isIntersecting){
      e.target.style.opacity=1;
      e.target.style.transform="translateY(0)";
    }
  });
},{threshold:.18});
cards.forEach(c=>obs.observe(c));

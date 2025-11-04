document.addEventListener("DOMContentLoaded", () => {

  const sections = [...document.querySelectorAll('.section')];
  const dotsWrap = document.getElementById('dots');

  sections.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot';
    d.onclick = () => sections[i].scrollIntoView({behavior:'smooth'});
    dotsWrap.appendChild(d);
  });

  const dots = [...document.querySelectorAll('.dot')];

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('visible');
        const index = sections.indexOf(e.target);
        dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));
      }
    });
  },{threshold:0.4});

  sections.forEach(s => io.observe(s));


  /* Parallax */
  const smooth = () => {
    sections.forEach(s => {
      const img = s.querySelector('.media img');
      if(!img) return;
      const depth = .25;
      const rect = s.getBoundingClientRect();
      img.style.transform = `translateY(${rect.top*depth}px) scale(1.1)`;
    });
    requestAnimationFrame(smooth);
  };
  requestAnimationFrame(smooth);

});

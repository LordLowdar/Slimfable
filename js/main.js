/* ============ SLIM.S1K ============ */
gsap.registerPlugin(ScrollTrigger);

/* ---------- Loader ---------- */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  setTimeout(() => loader.classList.add('done'), 500);
});

/* ---------- Nav ---------- */
const nav = document.getElementById('nav');
const navLinks = document.getElementById('navLinks');
const hamburger = document.getElementById('hamburger');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  })
);

/* ---------- Hero: intro ---------- */
gsap.from('.hero-badge', { y: 24, opacity: 0, duration: 0.9, delay: 0.7, ease: 'power3.out' });
gsap.from('.hero-title .ht-line', {
  y: 60,
  opacity: 0,
  duration: 1,
  delay: 0.85,
  stagger: 0.15,
  ease: 'power4.out',
});
gsap.from('.hero-sub', { y: 24, opacity: 0, duration: 0.9, delay: 1.25, ease: 'power3.out' });
gsap.from('.hero-ctas', { y: 24, opacity: 0, duration: 0.9, delay: 1.4, ease: 'power3.out' });
gsap.from('.hero-rider', { y: 80, opacity: 0, duration: 1.4, delay: 0.4, ease: 'power3.out' });

/* ---------- Floating sparks in the hero ---------- */
const heroPin = document.getElementById('heroPin');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('div');
  const sz = Math.random() * 4 + 2;
  s.className = 'spark';
  s.style.cssText =
    `width:${sz}px;height:${sz}px;` +
    `left:${Math.random() * 100}%;top:${30 + Math.random() * 70}%;` +
    `background:${Math.random() > 0.55 ? '#e22424' : 'rgba(255,255,255,0.6)'};` +
    `opacity:${Math.random() * 0.5 + 0.1};`;
  heroPin.appendChild(s);
  gsap.to(s, {
    y: -(Math.random() * 90 + 30),
    x: (Math.random() - 0.5) * 60,
    opacity: Math.random() * 0.2,
    duration: Math.random() * 5 + 3,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    delay: Math.random() * 4,
  });
}

/* ---------- Scroll reveals ---------- */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = `${(i % 6) * 0.08}s`;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

/* ---------- Instagram gallery ----------
   Loads assets/instagram.json (built by `npm run fetch:ig`). On success it
   replaces the fallback local images with Slim's latest posts. On any failure
   the hand-picked local gallery stays exactly as-is. */
(async function loadInstagram() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  // size rhythm so the IG grid keeps the same varied look as the fallback
  const sizes = ['tall', '', '', 'wide', '', 'tall', '', '', '', 'wide', '', ''];
  try {
    const res = await fetch('assets/instagram.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const { items } = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    grid.innerHTML = '';
    items.forEach((post, i) => {
      const a = document.createElement('a');
      a.className = `g-item reveal ${sizes[i % sizes.length]}`.trim();
      a.href = post.permalink || 'https://www.instagram.com/slim.s1k';
      a.target = '_blank';
      a.rel = 'noopener';
      const img = document.createElement('img');
      img.src = post.src;
      img.alt = post.caption || 'Instagram post by Slim.s1k';
      img.loading = 'lazy';
      a.appendChild(img);
      if (post.type === 'VIDEO') a.classList.add('is-video');
      grid.appendChild(a);
      observer.observe(a);
    });
  } catch (e) {
    /* keep the fallback gallery */
  }
})();

/* ---------- Stat counters ---------- */
document.querySelectorAll('.stat-num').forEach((el) => {
  const target = +el.dataset.count;
  const suffix = el.dataset.suffix || '';
  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = Math.round(counter.v) + suffix;
        },
      });
    },
  });
});

/* ---------- Machine bike parallax ---------- */
gsap.to('#machineBike', {
  y: -40,
  ease: 'none',
  scrollTrigger: {
    trigger: '#machine',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,
  },
});

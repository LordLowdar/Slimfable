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

/* ---------- Live stats + latest vlogs ----------
   assets/stats.json is refreshed daily by scripts/fetch-stats.mjs (GitHub
   Action). It overrides the baked-in stat numbers and swaps the vlog cards
   for the latest uploads. On any failure the hand-written fallbacks stay. */

/* 13789011 → {count: 13, suffix: "M+"}; 3260 → {count: 3.2, suffix: "K+"}.
   Floors instead of rounding so the "+" never overstates. */
function counterParts(n) {
  if (n >= 1e6) {
    const v = Math.floor(n / 1e5) / 10;
    return v < 10 ? { count: v, decimals: 1, suffix: 'M+' } : { count: Math.floor(v), decimals: 0, suffix: 'M+' };
  }
  if (n >= 1e3) {
    const v = Math.floor(n / 100) / 10;
    return v < 100 ? { count: v, decimals: 1, suffix: 'K+' } : { count: Math.floor(v), decimals: 0, suffix: 'K+' };
  }
  return { count: n, decimals: 0, suffix: '' };
}

function fmtViews(n) {
  const p = counterParts(n);
  return p.count.toFixed(p.decimals) + p.suffix.replace('+', '');
}

function applyStats(stats) {
  if (!stats) return;
  const values = {
    'yt-subscribers': stats.ytSubscribers,
    'ig-followers': stats.igFollowers,
    'yt-views': stats.ytViews,
    'yt-videos': stats.ytVideos,
    'yt-years': stats.ytJoined
      ? Math.floor((Date.now() - new Date(stats.ytJoined)) / (365.25 * 864e5))
      : null,
  };
  document.querySelectorAll('.stat-num[data-stat]').forEach((el) => {
    const raw = values[el.dataset.stat];
    if (!raw || raw < 0) return; // keep the baked-in fallback
    const p = el.dataset.stat === 'yt-years'
      ? { count: raw, decimals: 0, suffix: '+' }
      : counterParts(raw);
    el.dataset.count = p.count;
    el.dataset.decimals = p.decimals;
    el.dataset.suffix = p.suffix;
  });
}

function vlogCard(v, isFeatured) {
  const a = document.createElement('a');
  a.className = isFeatured ? 'vlog-card featured reveal' : 'vlog-card reveal';
  a.href = v.url;
  a.target = '_blank';
  a.rel = 'noopener';

  const thumb = document.createElement('div');
  thumb.className = 'vlog-thumb';
  const img = document.createElement('img');
  img.src = v.thumb;
  img.alt = v.title;
  img.loading = 'lazy';
  thumb.appendChild(img);
  thumb.insertAdjacentHTML(
    'beforeend',
    '<div class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></div>'
  );
  const dur = document.createElement('span');
  dur.className = 'vlog-dur';
  dur.textContent = isFeatured ? v.duration || 'WATCH' : 'SHORT';
  thumb.appendChild(dur);

  const meta = document.createElement('div');
  meta.className = 'vlog-meta';
  const ep = document.createElement('span');
  ep.className = 'vlog-ep';
  const date = v.published
    ? new Date(v.published)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        .toUpperCase()
    : '';
  ep.textContent = isFeatured ? 'FEATURED · FULL VIDEO' : date;
  const h3 = document.createElement('h3');
  h3.textContent = v.title;
  const p = document.createElement('p');
  p.textContent = v.views ? `${fmtViews(v.views)} views on YouTube.` : 'Watch on YouTube.';
  meta.append(ep, h3, p);

  a.append(thumb, meta);
  return a;
}

function renderVlogs(data) {
  const grid = document.getElementById('vlogGrid');
  if (!grid || !data.featured || !Array.isArray(data.shorts) || data.shorts.length === 0) return;
  grid.innerHTML = '';
  grid.appendChild(vlogCard(data.featured, true));
  data.shorts.forEach((s) => grid.appendChild(vlogCard(s, false)));
  grid.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  ScrollTrigger.refresh();
}

/* ---------- Stat counters ---------- */
function initStatCounters() {
  document.querySelectorAll('.stat-num').forEach((el) => {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const decimals = +el.dataset.decimals || 0;
    const run = () => {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = counter.v.toFixed(decimals) + suffix;
        },
      });
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: run,
    });
    // Counters are created after the stats fetch resolves; if the page is
    // already scrolled past the trigger by then (scroll restoration, deep
    // link), onEnter never fires — run immediately instead.
    if (st.isActive || st.progress > 0) {
      st.kill();
      run();
    }
  });
}

(async function loadStats() {
  try {
    const res = await fetch('assets/stats.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    applyStats(data.stats);
    renderVlogs(data);
  } catch (e) {
    /* keep the baked-in numbers and cards */
  }
  initStatCounters();
})();

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

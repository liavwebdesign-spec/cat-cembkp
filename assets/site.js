/* CAT sketches: shared behaviour (header, video, reveal, scrub, form). No dependencies. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('js');

  /* Header: solid after the hero starts scrolling, hides on scroll down, returns on scroll up */
  const header = document.querySelector('[data-header]');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    if (header) {
      header.classList.toggle('is-solid', y > 24);
      const goingDown = y > lastY && y > 320;
      header.classList.toggle('is-hidden', goingDown && !header.classList.contains('menu-open'));
      document.body.classList.toggle('hdr-gone', header.classList.contains('is-hidden'));
    }
    lastY = y;
  };
  /* Floating WhatsApp: shows after the hero (which has its own button) and steps aside at the footer, which lists WhatsApp too */
  const fab = document.querySelector('.wa');
  const onFab = () => fab && fab.classList.toggle('is-shown', scrollY > innerHeight * 0.7 && scrollY + innerHeight < document.documentElement.scrollHeight - 120);
  addEventListener('scroll', () => { onScroll(); onFab(); }, { passive: true });
  onScroll(); onFab();

  /* Mobile menu */
  const burger = document.querySelector('[data-burger]');
  if (burger && header) {
    burger.addEventListener('click', () => {
      const open = header.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    header.querySelectorAll('[data-menu] a').forEach(a => a.addEventListener('click', () => {
      header.classList.remove('menu-open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  }

  /* Videos: pick 720p on small screens, load when near the viewport, keep a visible pause control */
  const small = matchMedia('(max-width: 767px)').matches;
  const videos = [...document.querySelectorAll('video[data-src]')];
  const load = v => {
    if (v.dataset.loaded) return;
    v.dataset.loaded = '1';
    const src = v.dataset.src.replace('{q}', small ? '720' : '1080');
    v.src = src;
    v.muted = true;
    v.play().catch(() => {});
  };
  const vio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { load(v); if (!v.dataset.userPaused) v.play().catch(() => {}); }
      else if (v.dataset.loaded) v.pause();
    });
  }, { rootMargin: '200px' });
  videos.forEach(v => vio.observe(v));
  document.querySelectorAll('[data-video-toggle]').forEach(btn => {
    const v = document.getElementById(btn.getAttribute('aria-controls'));
    if (!v) return;
    btn.addEventListener('click', () => {
      if (v.paused) { v.dataset.userPaused = ''; delete v.dataset.userPaused; load(v); v.play(); btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', 'Pause background video'); }
      else { v.pause(); v.dataset.userPaused = '1'; btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Play background video'); }
    });
  });

  /* Reveal: one choreography for the whole page; direct position check so a hidden tab never leaves content invisible */
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  const inView = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 0.92 && r.bottom > 0; };
  if (reduce) reveals.forEach(el => el.classList.add('in'));
  else {
    const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => inView(el) ? el.classList.add('in') : rio.observe(el));
    setTimeout(() => reveals.forEach(el => inView(el) && el.classList.add('in')), 1200);
  }

  /* Scrub: sections with [data-scrub] get --p from 0 to 1 while they travel through the viewport */
  const scrubs = [...document.querySelectorAll('[data-scrub]')];
  const scrub = () => {
    scrubs.forEach(s => {
      const r = s.getBoundingClientRect();
      const span = r.height - innerHeight;
      let p = span > 0 ? -r.top / span : 1 - (r.top / innerHeight);
      p = Math.min(1, Math.max(0, p));
      if (reduce) p = 1;
      s.style.setProperty('--p', p.toFixed(4));
      s.dispatchEvent(new CustomEvent('scrub', { detail: p }));
    });
  };
  if (scrubs.length) { addEventListener('scroll', () => requestAnimationFrame(scrub), { passive: true }); addEventListener('resize', scrub); scrub(); }

  /* Running timecode (viewfinder) */
  document.querySelectorAll('[data-timecode]').forEach(el => {
    if (reduce) return;
    let f = 0; const start = 1 * 3600 * 24 + 12 * 60 * 24 + 44 * 24;
    const pad = n => String(n).padStart(2, '0');
    setInterval(() => {
      f++; const t = start + f; const ff = t % 24, s = Math.floor(t / 24);
      el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
    }, 1000 / 24);
  });

  /* Catalog preview: the hovered/focused row feeds the spec panel */
  document.querySelectorAll('[data-catalog]').forEach(cat => {
    const panel = cat.querySelector('[data-panel]');
    if (!panel) return;
    const set = row => {
      cat.querySelectorAll('[data-row]').forEach(r => r.classList.toggle('is-active', r === row));
      ['cat', 'model', 'value', 'unit', 'label', 'note'].forEach(k => {
        const t = panel.querySelector(`[data-p-${k}]`); if (t && row.dataset[k] !== undefined) t.textContent = row.dataset[k];
      });
      const ph = panel.querySelector('[data-p-href]'); if (ph && row.dataset.href) ph.href = row.dataset.href;
      const pp = panel.querySelector('[data-p-pdf]'); if (pp && row.dataset.pdf) pp.href = row.dataset.pdf;
      panel.classList.remove('flash'); void panel.offsetWidth; panel.classList.add('flash');
    };
    cat.querySelectorAll('[data-row]').forEach(r => { r.addEventListener('mouseenter', () => set(r)); r.addEventListener('focusin', () => set(r)); });
  });

  /* Catalog page: category chips filter the groups; #category in the URL opens that category */
  const filter = document.querySelector('[data-filter]');
  if (filter) {
    const chips = [...filter.querySelectorAll('[data-f]')];
    const groups = [...document.querySelectorAll('[data-group]')];
    const apply = (f, scroll) => {
      chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.f === f)));
      groups.forEach(g => { g.hidden = f !== 'all' && g.dataset.group !== f; });
      groups.forEach(g => g.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('in')));
      const on = chips.find(c => c.dataset.f === f);
      if (on) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
      if (scroll) {
        const top = filter.getBoundingClientRect().top + scrollY - (header ? header.offsetHeight : 0);
        if (scrollY > top + 4 || scroll === 'force') scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    chips.forEach(c => c.addEventListener('click', () => {
      apply(c.dataset.f, true);
      history.replaceState(null, '', c.dataset.f === 'all' ? location.pathname : '#' + c.dataset.f);
    }));
    const fromHash = () => { const h = location.hash.slice(1); if (chips.some(c => c.dataset.f === h)) apply(h, 'force'); };
    addEventListener('hashchange', fromHash);
    if (location.hash) requestAnimationFrame(fromHash);
  }

  /* Product gallery: thumbnails swap the main image */
  document.querySelectorAll('[data-gallery]').forEach(g => {
    const stage = g.querySelector('[data-stage]'), main = g.querySelector('[data-stage-img]'), n = g.querySelector('[data-stage-n]');
    const thumbs = [...g.querySelectorAll('[data-thumb]')];
    thumbs.forEach((t, i) => t.addEventListener('click', () => {
      main.src = t.dataset.src;
      stage.classList.toggle('plate', t.dataset.plate === '1');
      main.classList.remove('swap'); void main.offsetWidth; main.classList.add('swap');
      thumbs.forEach(x => x.setAttribute('aria-current', String(x === t)));
      if (n) n.textContent = i + 1;
    }));
  });

  /* Long product descriptions open in place */
  document.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', () => {
    const t = document.getElementById(b.getAttribute('aria-controls'));
    t.classList.add('open'); b.setAttribute('aria-expanded', 'true'); b.hidden = true;
  }));

  /* Language switch (sketch: shows the state, the Greek copy arrives after translation) */
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-lang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const note = document.querySelector('[data-lang-note]');
    if (note) { note.hidden = b.dataset.lang === 'en'; }
  }));

  /* Contact form: sketch only, shows the success state */
  document.querySelectorAll('form[data-form]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [...f.querySelectorAll('[required]')].filter(i => !i.value.trim());
    f.querySelectorAll('.field').forEach(x => x.classList.remove('has-error'));
    if (bad.length) { bad.forEach(i => i.closest('.field')?.classList.add('has-error')); bad[0].focus(); return; }
    f.classList.add('is-sent');
    const ok = f.querySelector('[data-sent]'); if (ok) { ok.hidden = false; ok.focus(); }
  }));
})();

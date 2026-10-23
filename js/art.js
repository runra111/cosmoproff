/* Product art: every product picture on the site is drawn here as SVG, so the demo needs no photo files.
   Art.product(p) -> <svg> of the bottle/jar/tube; Art.icon(name) -> 24px stroke icon; Art.tint(p) -> card background. */
(function(){
  let uid = 0;                                       // gradient ids must be unique per drawn copy

  function mix(hex, k){                              // k > 0 mixes towards white, k < 0 towards black
    const n = parseInt(hex.slice(1), 16), t = k < 0 ? 0 : 255, a = Math.abs(k);
    return '#' + [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(v + (t - v)*a).toString(16).padStart(2, '0')).join('');
  }
  const isLight = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16)*299 + (n >> 8 & 255)*587 + (n & 255)*114)/1000 > 150; };
  const INK = '#24121c';

  const ridges = (x, y, w, h, n) => Array.from({length:n}, (_, i) =>
    `<rect x="${(x + (i + .5)*w/n - .5).toFixed(1)}" y="${y}" width="1" height="${h}" fill="#000" opacity=".09"/>`).join('');
  const gloss = (x, y, h, w = 6, op = .35) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="#fff" opacity="${op}"/>`;

  /* paper label: brand mark, a thin rule in the cap colour, product line and volume */
  function label(x, y, w, h, p, o = {}){
    const fs = Math.min(o.fs || 8.5, w/(p.mark.length*.8)), cx = x + w/2, ink = o.ink || INK;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 3}" fill="${o.bg || '#fff'}" opacity="${o.op ?? .93}"/>`
      + `<text x="${cx}" y="${(y + h*.36).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="800" letter-spacing=".5" fill="${ink}">${p.mark}</text>`
      + `<rect x="${(x + w*.32).toFixed(1)}" y="${(y + h*.47).toFixed(1)}" width="${(w*.36).toFixed(1)}" height="1.2" fill="${o.accent || p.c2}"/>`
      + `<text x="${cx}" y="${(y + h*.66).toFixed(1)}" text-anchor="middle" font-size="${Math.min(5, w/13).toFixed(1)}" font-weight="700" letter-spacing=".4" fill="${ink}" opacity=".72">${p.short}</text>`
      + `<text x="${cx}" y="${(y + h*.86).toFixed(1)}" text-anchor="middle" font-size="4.2" font-weight="600" fill="${ink}" opacity=".5">${p.volEn}</text>`;
  }

  const SHAPES = {
    dropper: (p, g) => `
      <rect x="89" y="20" width="22" height="54" rx="11" fill="${mix(p.c2, -.18)}"/>
      ${gloss(93, 27, 34, 4, .25)}
      <rect x="80" y="64" width="40" height="36" rx="5" fill="url(#k${g})"/>
      ${ridges(82, 68, 36, 28, 6)}
      <rect x="86" y="98" width="28" height="10" fill="${mix(p.c, -.14)}"/>
      <rect x="66" y="106" width="68" height="110" rx="16" fill="url(#b${g})"/>
      ${label(72, 134, 56, 60, p)}
      ${gloss(70, 114, 92)}`,
    pump: (p, g) => `
      <rect x="83" y="42" width="34" height="14" rx="4" fill="url(#k${g})"/>
      <rect x="111" y="45" width="31" height="7" rx="3.5" fill="${mix(p.c2, -.1)}"/>
      <rect x="95" y="54" width="10" height="20" fill="${mix(p.c2, -.22)}"/>
      <rect x="83" y="72" width="34" height="22" rx="4" fill="url(#k${g})"/>
      ${ridges(85, 75, 30, 16, 6)}
      <rect x="62" y="90" width="76" height="126" rx="18" fill="url(#b${g})"/>
      ${label(69, 122, 62, 64, p)}
      ${gloss(67, 100, 104)}`,
    tube: (p, g) => {
      const ink = isLight(p.c) ? INK : '#fff', fs = Math.min(11, 74/(p.mark.length*.8));
      return `
      <rect x="57" y="24" width="86" height="14" rx="2" fill="${mix(p.c, -.12)}"/>
      <rect x="57" y="28" width="86" height="1" fill="#000" opacity=".1"/><rect x="57" y="32" width="86" height="1" fill="#000" opacity=".1"/>
      <path d="M60 36H140C140 92 132 150 120 188H80C68 150 60 92 60 36Z" fill="url(#b${g})"/>
      <text x="100" y="96" text-anchor="middle" font-size="${fs.toFixed(1)}" font-weight="800" letter-spacing=".6" fill="${ink}">${p.mark}</text>
      <rect x="84" y="104" width="32" height="1.4" fill="${p.c2}"/>
      <text x="100" y="118" text-anchor="middle" font-size="5.4" font-weight="700" letter-spacing=".4" fill="${ink}" opacity=".75">${p.short}</text>
      <text x="100" y="130" text-anchor="middle" font-size="4.6" font-weight="600" fill="${ink}" opacity=".5">${p.volEn}</text>
      <path d="M70 46C70 92 75 140 84 176" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".35"/>
      <rect x="80" y="186" width="40" height="6" fill="${mix(p.c, -.2)}"/>
      <rect x="76" y="190" width="48" height="27" rx="6" fill="url(#k${g})"/>`;
    },
    jar: (p, g) => `
      <rect x="38" y="104" width="124" height="40" rx="9" fill="url(#k${g})"/>
      ${ridges(42, 108, 116, 32, 24)}
      <rect x="44" y="107" width="112" height="4" rx="2" fill="#fff" opacity=".3"/>
      <rect x="42" y="140" width="116" height="76" rx="16" fill="url(#b${g})"/>
      ${label(42, 152, 116, 48, p, {rx:0, fs:11})}
      ${gloss(50, 146, 64, 7, .3)}`,
    spray: (p, g) => `
      <rect x="86" y="38" width="28" height="28" rx="7" fill="url(#k${g})"/>
      <circle cx="108" cy="49" r="2.6" fill="${mix(p.c2, -.5)}"/>
      <rect x="84" y="64" width="32" height="18" rx="3" fill="${mix(p.c2, -.15)}"/>
      ${ridges(86, 67, 28, 12, 5)}
      <rect x="72" y="80" width="56" height="136" rx="24" fill="url(#b${g})"/>
      ${label(77, 120, 46, 60, p)}
      ${gloss(77, 92, 110)}`,
    bottle: (p, g) => `
      <rect x="80" y="32" width="40" height="42" rx="6" fill="url(#k${g})"/>
      ${ridges(82, 36, 36, 34, 7)}
      <rect x="86" y="72" width="28" height="8" fill="${mix(p.c, -.16)}"/>
      <rect x="64" y="78" width="72" height="138" rx="12" fill="url(#b${g})"/>
      ${label(70, 116, 60, 68, p)}
      ${gloss(69, 88, 118)}`,
    set: (p, g) => `
      <rect x="40" y="112" width="120" height="104" rx="6" fill="url(#b${g})"/>
      <rect x="34" y="96" width="132" height="26" rx="5" fill="${mix(p.c, -.07)}"/>
      <rect x="93" y="96" width="14" height="120" fill="url(#k${g})"/>
      <path d="M100 98C84 68 58 76 73 97Z" fill="${p.c2}"/>
      <path d="M100 98C116 68 142 76 127 97Z" fill="${mix(p.c2, -.12)}"/>
      <circle cx="100" cy="96" r="7" fill="${mix(p.c2, -.22)}"/>
      ${label(48, 146, 38, 36, p, {fs:6})}
      ${gloss(118, 124, 84, 6, .2)}`,
    card: (p, g) => `
      <g transform="rotate(10 100 130)"><rect x="36" y="78" width="132" height="86" rx="10" fill="${mix(p.c2, .2)}"/></g>
      <g transform="rotate(-8 100 130)">
        <rect x="30" y="88" width="140" height="90" rx="11" fill="url(#b${g})"/>
        <circle cx="160" cy="96" r="44" fill="#fff" opacity=".12"/>
        <text x="44" y="112" font-size="10" font-weight="800" letter-spacing="1.6" fill="#fff">COSMOPROFF</text>
        <rect x="44" y="122" width="20" height="15" rx="3" fill="#ffd9a0"/>
        <text x="44" y="164" font-size="15" font-weight="800" fill="#fff">GIFT CARD</text>
      </g>`
  };

  function product(p, o = {}){
    const g = ++uid, wide = p.shape === 'jar' || p.shape === 'set' || p.shape === 'card';
    const a11y = o.deco ? 'aria-hidden="true"' : `role="img" aria-label="${p.brandName} ${p.name}"`;
    return `<svg class="art" viewBox="0 0 200 240" ${a11y} font-family="Manrope, system-ui, sans-serif" focusable="false">
      <defs>
        <linearGradient id="b${g}" x1="0" x2="1"><stop offset="0" stop-color="${mix(p.c, .3)}"/><stop offset=".5" stop-color="${p.c}"/><stop offset="1" stop-color="${mix(p.c, -.16)}"/></linearGradient>
        <linearGradient id="k${g}" x1="0" x2="1"><stop offset="0" stop-color="${mix(p.c2, .25)}"/><stop offset=".5" stop-color="${p.c2}"/><stop offset="1" stop-color="${mix(p.c2, -.28)}"/></linearGradient>
      </defs>
      <ellipse cx="100" cy="222" rx="${wide ? 70 : 48}" ry="7" fill="#3a0f24" opacity=".1"/>
      ${(SHAPES[p.shape] || SHAPES.bottle)(p, g)}
    </svg>`;
  }

  const tint = p => mix(isLight(p.c) ? p.c : mix(p.c, .5), .72);

  const ICONS = {
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    heart:'<path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6"/>',
    bag:'<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    menu:'<path d="M3 6h18M3 12h18M3 18h12"/>',
    close:'<path d="M5 5l14 14M19 5 5 19"/>',
    left:'<path d="m15 5-7 7 7 7"/>',
    right:'<path d="m9 5 7 7-7 7"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    drop:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sparkle:'<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15c.3 2 .9 2.7 2.5 3-1.6.3-2.2 1-2.5 3-.3-2-.9-2.7-2.5-3 1.6-.3 2.2-1 2.5-3z"/>',
    percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    gift:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3.5 8 4.2C5.8 4.8 7 8 12 8zm0 0s1.5-4.5 4-3.8C18.2 4.8 17 8 12 8z"/>',
    crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/>',
    leaf:'<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
    truck:'<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    shield:'<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    chat:'<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 10h8M8 13h5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    minus:'<path d="M5 12h14"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    pin:'<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    check:'<path d="m5 12 5 5 9-10"/>',
    flask:'<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    home:'<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>',
    grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    blob:'<path d="M12 3c4 0 8 3 8 8 0 5-3.5 10-8.5 10S4 17.5 4 12.5 7.5 3 12 3z"/><path d="M9 10.5c.8-1.3 2-2 3.5-2"/>',
    insta:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
    telegram:'<path d="M21 4 3 11l6 2 2 6 3-4 5 4 2-15z"/><path d="m9 13 8-6"/>',
    whatsapp:'<path d="M4 20l1.3-4A8 8 0 1 1 8 18.8L4 20z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  window.Art = {product, icon, tint, mix};
})();

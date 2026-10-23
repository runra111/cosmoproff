/* Cosmoproff demo store: catalogue, cart, favourites, search, quiz, stories and overlays.
   No backend — cart, favourites, city, orders and the demo "account" live in localStorage. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const {PRODUCTS, BRANDS, CATS, SKIN, NEED, STORIES, ARTICLES, CITIES, PROMOS, FREE_SHIP, SHIP} = window.CP;
  const ic = (n, cls) => Art.icon(n, cls);
  const byId = id => PRODUCTS.find(p => p.id === +id);
  const num = n => Math.round(n).toLocaleString('ru-RU');
  const money = n => num(n) + ' ₸';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plural = (n, f) => num(n) + ' ' + f[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

  /* ---------- state (localStorage, every access guarded: private windows can throw) ---------- */
  const store = {
    get(k, d){ try{ const v = localStorage.getItem('cp:' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem('cp:' + k, JSON.stringify(v)); }catch(e){} }
  };
  const state = {
    cart: store.get('cart', []).filter(i => byId(i.id)),
    fav: store.get('fav', []).filter(id => byId(id)),
    city: store.get('city', 'Алматы'),
    user: store.get('user', null),
    promo: store.get('promo', ''),
    seen: store.get('seen', []),
    orders: store.get('orders', [])
  };
  if(!PROMOS[state.promo]) state.promo = '';

  const priceOf = (p, v) => p.prices[Math.max(0, p.vols.indexOf(v))];
  const oldOf = (p, v) => p.old ? Math.round(priceOf(p, v)*p.old/p.price/10)*10 : 0;
  const pct = p => p.old ? Math.round((1 - p.price/p.old)*100) : 0;
  const volLabel = (p, v) => p.unit === '₸' ? money(v) : v + ' ' + p.unit;
  const tint = p => Art.tint(p);
  const cityOf = () => CITIES.find(c => c.name === state.city) || CITIES[0];

  /* ---------- shared bits of markup ---------- */
  function paintIcons(root = document){ $$('[data-ic]', root).forEach(el => { el.outerHTML = ic(el.dataset.ic); }); }

  function badges(p){
    return (p.old ? `<b class="badge badge--sale">−${pct(p)}%</b>` : '')
      + (p.tags.includes('hit') ? '<b class="badge badge--hit">HIT</b>' : '')
      + (p.tags.includes('new') ? '<b class="badge badge--new">NEW</b>' : '')
      + (p.cat === 'pro' ? '<b class="badge badge--pro">PRO</b>' : '');
  }
  const favBtn = (p, cls = 'ibtn card__fav') => { const on = state.fav.includes(p.id);
    return `<button class="${cls}${on ? ' is-on' : ''}" type="button" data-fav="${p.id}" aria-pressed="${on}" aria-label="В избранное">${ic('heart')}</button>`; };
  const rate = p => `<div class="rate">${ic('star')}${p.r.toFixed(1)}<span>(${p.n})</span></div>`;

  function card(p, i = 0){
    const vols = p.vols.length > 1 ? `<div class="card__vols">${p.vols.map(v => `<span>${p.unit === '₸' ? v/1000 + 'K' : v}</span>`).join('')}</div>` : '';
    return `<article class="card" data-id="${p.id}" style="--i:${i}" tabindex="0" aria-label="${esc(p.brandName + ' ' + p.name + ', ' + money(p.price))}">
      <div class="card__pic" style="--tint:${tint(p)}">
        <div class="card__badges">${badges(p)}</div>
        ${favBtn(p)}
        <div class="card__art">${Art.product(p, {deco:true})}</div>
        <button class="card__add" type="button" data-add="${p.id}" aria-label="Добавить в корзину">${ic('bag')}</button>
      </div>
      ${vols}
      <p class="card__type">${p.type}</p>
      <h3 class="card__name"><b>${p.brandName}</b> ${p.name}</h3>
      ${rate(p)}
      <p class="card__price${p.old ? ' is-sale' : ''}"><b>${p.vols.length > 1 ? 'от ' : ''}${money(p.price)}</b>${p.old ? `<s>${money(p.old)}</s>` : ''}</p>
    </article>`;
  }

  /* 1–3 floating product pictures; the first one is the big central piece */
  const artGroup = ids => ids.map((id, i) => `<div class="hart hart--${'abc'[i]}">${Art.product(byId(id), {deco:true})}</div>`).join('');

  function blank(icon, title, text, extra = ''){
    return `<div class="blank"><span class="blank__ic">${ic(icon)}</span><b>${title}</b><p>${text}</p>${extra}</div>`;
  }

  /* ---------- toasts ---------- */
  function toast(html, o = {}){
    const box = $('#toasts'), t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span class="toast__ic">${ic(o.icon || 'check')}</span><span>${html}</span>`;
    const kill = () => { t.classList.add('is-out'); setTimeout(() => t.remove(), 300); };
    if(o.action){
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.action[0];
      b.addEventListener('click', () => { o.action[1](); kill(); }); t.appendChild(b);
    }
    box.appendChild(t);
    while(box.children.length > 3) box.firstChild.remove();
    setTimeout(kill, o.ms || 3200);
  }
  function bump(el){ if(!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  /* ---------- overlay stack: drawers, modal, search, stories ---------- */
  const layers = [];
  const isOpen = el => layers.includes(el);
  function openLayer(el){
    if(isOpen(el)) return;
    el._from = document.activeElement;
    if(!layers.length) document.documentElement.style.setProperty('--sbw', innerWidth - document.documentElement.clientWidth + 'px');
    el.hidden = false; el.style.zIndex = 100 + layers.length*2;
    void el.offsetWidth; el.classList.add('is-open');
    layers.push(el); document.documentElement.classList.add('is-locked');
    setTimeout(() => { const f = $('[data-focus]', el) || $('.drawer__head [data-close], .modal__x, .story__top [data-close]', el); f && f.focus({preventScroll:true}); }, 60);
  }
  function closeLayer(el = layers[layers.length - 1]){
    if(!el || !isOpen(el)) return;
    el.classList.remove('is-open'); layers.splice(layers.indexOf(el), 1);
    setTimeout(() => { if(!el.classList.contains('is-open')) el.hidden = true; }, 420);
    if(!layers.length) document.documentElement.classList.remove('is-locked');
    if(el === storyEl) stopStory();
    if(el._from && document.contains(el._from)) el._from.focus({preventScroll:true});
  }
  const closeAll = () => { while(layers.length) closeLayer(); };

  const modalEl = $('#modal'), modalIn = $('#modalIn');
  function modal(html, size = 'md'){
    modalEl.dataset.size = size; modalIn.innerHTML = html;
    $('.modal__box', modalEl).scrollTop = 0;
    openLayer(modalEl);
    return modalIn;
  }

  /* ---------- counters & header ---------- */
  function updateCounts(){
    const n = state.cart.reduce((s, i) => s + i.q, 0), f = state.fav.length;
    $$('[data-count=cart]').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
    $$('[data-count=fav]').forEach(b => { b.textContent = f; b.hidden = !f; });
  }
  function updateCity(){ $$('[data-city]').forEach(el => el.textContent = state.city); }
  function updateUser(){
    const u = state.user;
    $$('[data-user]').forEach(b => b.classList.toggle('is-on', !!u));
    $('#clubBtn').textContent = u ? 'Мой профиль' : 'Вступить в клуб';
    $('#clubNum').textContent = '•••• •••• ' + (u ? u.phone.replace(/\D/g, '').slice(-4) : '2026');
    $('#clubBal').textContent = u ? plural(u.bonus, ['бонус', 'бонуса', 'бонусов']) : '2 000 приветственных бонусов';
  }

  const hdr = $('#hdr');
  const onScroll = () => hdr.classList.toggle('is-stuck', scrollY > 40);
  addEventListener('scroll', onScroll, {passive:true}); onScroll();

  /* ---------- favourites ---------- */
  function toggleFav(id){
    id = +id; const p = byId(id), on = !state.fav.includes(id);
    state.fav = on ? [id, ...state.fav] : state.fav.filter(x => x !== id);
    store.set('fav', state.fav);
    $$(`[data-fav="${id}"]`).forEach(b => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.classList.remove('pop'); void b.offsetWidth; on && b.classList.add('pop'); });
    updateCounts();
    if(isOpen($('#fav'))) renderFav();
    if(on) toast(`<b>${p.brandName}</b> — в избранном`, {icon:'heart', action:['Открыть', () => openers.fav()]});
  }
  function renderFav(){
    const list = state.fav.map(byId);
    $('#favN').textContent = list.length || '';
    $('#favBody').innerHTML = list.length
      ? `<div class="mini-grid">${list.map(card).join('')}</div>`
      : blank('heart', 'Здесь пока пусто', 'Нажимайте на сердечко у товара — он сохранится здесь, даже если закрыть сайт.', '<a class="btn btn--pink" href="#hits" data-close>Смотреть хиты</a>');
  }

  /* ---------- cart ---------- */
  function addToCart(id, v, q = 1){
    const p = byId(id); v = v ?? p.vols[0];
    const it = state.cart.find(x => x.id === p.id && x.v === v);
    if(it) it.q = Math.min(99, it.q + q); else state.cart.unshift({id:p.id, v, q});
    saveCart();
    bump($('#cartBtn')); bump($('[data-tab=cart]'));
    toast(`<b>${p.brandName}</b> ${p.name} — в корзине`, {icon:'bag', action:['Корзина', () => openers.cart()]});
  }
  function saveCart(){ store.set('cart', state.cart); updateCounts(); if(isOpen($('#cart'))) renderCart(); }

  function totals(pickup){
    const promo = PROMOS[state.promo];
    let sub = 0, full = 0, base = 0, count = 0;
    state.cart.forEach(it => {
      const p = byId(it.id), pr = priceOf(p, it.v);
      sub += pr*it.q; full += (oldOf(p, it.v) || pr)*it.q; count += it.q;
      if(promo && !promo.skip.includes(p.cat)) base += pr*it.q;
    });
    const disc = promo ? Math.round(base*promo.pct/100) : 0;
    const ship = pickup || !count || sub - disc >= FREE_SHIP ? 0 : SHIP;
    return {sub, full, save:full - sub, disc, ship, total:sub - disc + ship, count, bonus:Math.round((sub - disc)*.05)};
  }
  const sumHTML = t => `<div class="sum">
      <div><span>Товары, ${t.count} шт.</span><span>${money(t.full)}</span></div>
      ${t.save ? `<div class="is-disc"><span>Скидка</span><span>−${money(t.save)}</span></div>` : ''}
      ${t.disc ? `<div class="is-disc"><span>Промокод ${state.promo}</span><span>−${money(t.disc)}</span></div>` : ''}
      <div><span>Доставка</span><span>${t.ship ? money(t.ship) : 'бесплатно'}</span></div>
      <div class="sum__total"><span>Итого</span><span>${money(t.total)}</span></div>
    </div>`;

  let promoMsg = '';
  function renderCart(){
    const body = $('#cartBody'), foot = $('#cartFoot'), t = totals();
    $('#cartN').textContent = t.count || '';
    if(!state.cart.length){
      body.innerHTML = blank('bag', 'В корзине пока пусто', 'Загляните в хиты — там самые любимые средства покупателей.', '<a class="btn btn--pink" href="#hits" data-close>Смотреть хиты</a>');
      foot.hidden = true; return;
    }
    foot.hidden = false;
    const got = t.sub - t.disc, left = FREE_SHIP - got;
    body.innerHTML = `<div class="ship">${left > 0 ? `До бесплатной доставки осталось <b>${money(left)}</b>` : `<b>Доставка бесплатно</b> — сумма заказа больше ${money(FREE_SHIP)}`}
        <div class="ship__bar"><i style="width:${Math.min(100, got/FREE_SHIP*100).toFixed(1)}%"></i></div></div>`
      + state.cart.map((it, k) => {
        const p = byId(it.id), pr = priceOf(p, it.v), old = oldOf(p, it.v);
        return `<div class="line" data-k="${k}">
          <div class="line__pic" style="--tint:${tint(p)}" data-product="${p.id}">${Art.product(p, {deco:true})}</div>
          <div>
            <p class="line__name" data-product="${p.id}"><b>${p.brandName}</b> ${p.name}</p>
            <p class="line__meta">${p.type} · ${volLabel(p, it.v)}</p>
            <div class="qty"><button type="button" data-qty="-1" aria-label="Меньше">${ic('minus')}</button><span>${it.q}</span><button type="button" data-qty="1" aria-label="Больше">${ic('plus')}</button></div>
          </div>
          <div class="line__r">
            <span class="line__price">${money(pr*it.q)}</span>${old ? `<span class="line__old">${money(old*it.q)}</span>` : ''}
            <button class="ibtn line__del" type="button" data-del aria-label="Удалить">${ic('trash')}</button>
          </div>
        </div>`;
      }).join('');
    foot.innerHTML = `
      <form class="promo" id="promoForm"><input name="code" placeholder="Промокод" value="${state.promo}" aria-label="Промокод" autocomplete="off"><button type="submit">${state.promo ? 'Сменить' : 'Применить'}</button></form>
      ${promoMsg || (state.promo ? `<p class="promo__msg is-ok">${PROMOS[state.promo].note}</p>` : '<p class="promo__msg tiny">Попробуйте PINK20 или COSMO10</p>')}
      ${sumHTML(t)}
      <p class="tiny">+ ${plural(t.bonus, ['бонус', 'бонуса', 'бонусов'])} на карту Cosmoproff Club</p>
      <button class="btn btn--pink btn--wide" type="button" data-checkout>Оформить заказ</button>`;
    promoMsg = '';
  }
  $('#cart').addEventListener('click', e => {
    const line = e.target.closest('.line'), k = line && +line.dataset.k;
    if(e.target.closest('[data-qty]')){
      const it = state.cart[k]; it.q += +e.target.closest('[data-qty]').dataset.qty;
      if(it.q < 1) state.cart.splice(k, 1); else it.q = Math.min(99, it.q);
      saveCart();
    }else if(e.target.closest('[data-del]')){
      const [it] = state.cart.splice(k, 1); saveCart();
      toast('Товар удалён', {icon:'trash', action:['Вернуть', () => { state.cart.splice(k, 0, it); saveCart(); }]});
    }else if(e.target.closest('[data-checkout]')) openCheckout();
  });
  $('#cart').addEventListener('submit', e => {
    if(e.target.id !== 'promoForm') return;
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if(!code){ state.promo = ''; }
    else if(PROMOS[code]){ state.promo = code; promoMsg = `<p class="promo__msg is-ok">Промокод применён: ${PROMOS[code].note}</p>`; }
    else promoMsg = '<p class="promo__msg is-err">Такого промокода нет — попробуйте PINK20</p>';
    store.set('promo', state.promo); renderCart();
  });

  /* ---------- checkout ---------- */
  function openCheckout(){
    if(!state.cart.length) return;
    const t = totals();
    modal(`<div class="modal__in">
      <p class="eyebrow">Оформление заказа</p>
      <h3 class="mtitle" id="modalTitle">почти готово</h3>
      <p class="muted">${plural(t.count, ['товар', 'товара', 'товаров'])} · доставка: ${state.city}, ${cityOf().eta}</p>
      <form class="form" id="orderForm" novalidate>
        <label class="field"><span>Имя и фамилия</span><input name="name" required autocomplete="name" data-focus></label>
        <label class="field"><span>Телефон</span><input name="phone" required inputmode="tel" autocomplete="tel" data-phone placeholder="+7 (___) ___-__-__" value="${state.user ? state.user.phone : ''}"></label>
        <fieldset class="seg"><legend>Способ получения</legend>
          <label><input type="radio" name="how" value="courier" checked><span>Курьер</span></label>
          <label><input type="radio" name="how" value="pickup"><span>Самовывоз — бесплатно</span></label>
        </fieldset>
        <label class="field" data-addr><span>Адрес (${state.city})</span><input name="addr" required autocomplete="street-address" placeholder="Улица, дом, квартира"></label>
        <fieldset class="seg"><legend>Оплата</legend>
          <label><input type="radio" name="pay" value="card" checked><span>Картой онлайн</span></label>
          <label><input type="radio" name="pay" value="kaspi"><span>Kaspi QR</span></label>
          <label><input type="radio" name="pay" value="cash"><span>При получении</span></label>
        </fieldset>
        <div id="orderSum">${sumHTML(t)}</div>
        <button class="btn btn--pink btn--wide" type="submit" id="orderBtn">Подтвердить · ${money(t.total)}</button>
        <p class="tiny">Демо-версия: заказ никуда не отправляется, оплата не списывается.</p>
      </form></div>`);
  }
  function placeOrder(f){
    const pickup = f.how.value === 'pickup';
    const bad = [f.elements.name, f.phone, pickup ? null : f.addr].filter(Boolean).filter(i => i === f.phone ? i.value.replace(/\D/g, '').length !== 11 : !i.value.trim());
    $$('.field', f).forEach(x => x.classList.toggle('is-bad', bad.includes($('input', x))));
    if(bad.length){ bad[0].focus(); toast('Проверьте выделенные поля', {icon:'close'}); return; }
    const t = totals(pickup), no = 'CP-' + String(Date.now() % 1000000).padStart(6, '0');
    state.orders.unshift({no, total:t.total, n:t.count, date:new Date().toLocaleDateString('ru-RU')});
    store.set('orders', state.orders.slice(0, 10));
    if(state.user){ state.user.bonus += t.bonus; store.set('user', state.user); updateUser(); }
    state.cart = []; state.promo = ''; store.set('promo', ''); saveCart();
    closeLayer($('#cart'));
    modalIn.innerHTML = `<div class="modal__in done">
      <span class="done__ic">${ic('check')}</span>
      <h3 class="mtitle" id="modalTitle">заказ оформлен!</h3>
      <span class="order-no">${no}</span>
      <p class="muted">${pickup ? 'Заберите заказ в бутике Cosmoproff — мы пришлём SMS, когда он будет готов.' : `Курьер привезёт заказ: ${state.city}, ${cityOf().eta}.`} Менеджер позвонит для подтверждения в течение 15 минут.</p>
      <p class="tiny">Это демо: заказ сохранён только в вашем браузере.</p>
      <button class="btn btn--pink" type="button" data-close>Продолжить покупки</button></div>`;
  }
  modalIn.addEventListener('change', e => {
    if(e.target.name !== 'how') return;
    const f = e.target.form, pickup = f.how.value === 'pickup', t = totals(pickup);
    $('[data-addr]', f).hidden = pickup;
    $('#orderSum').innerHTML = sumHTML(t);
    $('#orderBtn').textContent = 'Подтвердить · ' + money(t.total);
  });

  /* ---------- product view ---------- */
  const pm = {p:null, v:0, q:1};
  function openProduct(id){
    const p = byId(id); if(!p) return;
    Object.assign(pm, {p, v:p.vols[0], q:1});
    const rel = PRODUCTS.filter(x => x.id !== p.id && !x.hidden && (x.cat === p.cat || x.b === p.b)).sort((a, b) => b.n - a.n).slice(0, 4);
    const city = cityOf();
    modal(`<div class="pm">
      <div class="pm__pic" style="--tint:${tint(p)}"><div class="card__badges">${badges(p)}</div>${Art.product(p)}</div>
      <div class="pm__info">
        <p class="card__type">${p.type}</p>
        <h3 class="pm__name" id="modalTitle"><b>${p.brandName}</b>${p.name}</h3>
        <div class="rate">${ic('star')}${p.r.toFixed(1)}<span>· ${plural(p.n, ['отзыв', 'отзыва', 'отзывов'])}</span></div>
        <div class="pm__vols" role="radiogroup" aria-label="${p.unit === '₸' ? 'Номинал' : 'Объём'}"></div>
        <div class="pm__price"></div>
        <div class="pm__buy">
          <div class="qty qty--lg"><button type="button" data-pq="-1" aria-label="Меньше">${ic('minus')}</button><span id="pmQ">1</span><button type="button" data-pq="1" aria-label="Больше">${ic('plus')}</button></div>
          <button class="btn btn--pink" type="button" data-pm-add>В корзину</button>
          ${favBtn(p, 'ibtn ibtn--round')}
        </div>
        <p class="pm__note">${ic('truck')}<span><b>${city.name}</b> · доставка ${city.eta}. Бесплатно от ${money(FREE_SHIP)}</span></p>
        <div class="tabs">
          <div class="tabs__head" role="tablist">
            <button class="is-on" type="button" role="tab" data-tab="desc">Описание</button>
            <button type="button" role="tab" data-tab="use">Применение</button>
            <button type="button" role="tab" data-tab="inci">Состав</button>
          </div>
          <div class="tabs__body" id="pmTab" role="tabpanel"></div>
        </div>
      </div>
      ${rel.length ? `<div class="pm__rel"><h4>с этим покупают</h4><div class="rel">${rel.map(card).join('')}</div></div>` : ''}
    </div>`, 'lg');
    renderPM(); showTab('desc');
  }
  function renderPM(){
    const {p, v, q} = pm, pr = priceOf(p, v), old = oldOf(p, v);
    $('.pm__vols', modalIn).innerHTML = p.vols.map(x => `<button class="vol${x === v ? ' is-on' : ''}" type="button" role="radio" aria-checked="${x === v}" data-vol="${x}">${volLabel(p, x)}</button>`).join('');
    const price = $('.pm__price', modalIn);
    price.classList.toggle('is-sale', !!old);
    price.innerHTML = `<b>${money(pr*q)}</b>${old ? `<s>${money(old*q)}</s><span class="disc">−${pct(p)}%</span>` : ''}`;
    $('#pmQ').textContent = q;
  }
  function showTab(k){
    const p = pm.p;
    $$('.tabs__head button', modalIn).forEach(b => { b.classList.toggle('is-on', b.dataset.tab === k); b.setAttribute('aria-selected', b.dataset.tab === k); });
    const tab = $('#pmTab');
    tab.innerHTML = k === 'desc'
      ? `<p>${p.desc}</p>${p.skin.length && p.cat === 'face' ? `<div class="suits">${p.skin.map(s => `<span>${SKIN[s]}</span>`).join('')}</div>` : ''}`
      : `<p>${k === 'use' ? p.use : p.inci}</p>`;
    tab.style.animation = 'none'; void tab.offsetWidth; tab.style.animation = '';
  }
  modalIn.addEventListener('click', e => {
    const t = e.target;
    if(t.closest('[data-vol]')){ pm.v = +t.closest('[data-vol]').dataset.vol; renderPM(); }
    else if(t.closest('[data-pq]')){ pm.q = Math.max(1, Math.min(99, pm.q + +t.closest('[data-pq]').dataset.pq)); renderPM(); }
    else if(t.closest('[data-pm-add]')) addToCart(pm.p.id, pm.v, pm.q);
    else if(t.closest('.tabs__head [data-tab]')) showTab(t.closest('[data-tab]').dataset.tab);
  });

  /* ---------- auth (demo: any SMS code works) ---------- */
  function openLogin(){
    if(state.user) return openProfile();
    modal(`<div class="modal__in">
      <span class="login__badge">${ic('crown')}</span>
      <p class="eyebrow">Cosmoproff Club</p>
      <h3 class="mtitle" id="modalTitle">вход или регистрация</h3>
      <p class="muted">Введите номер телефона — пришлём код. Новым участникам сразу начислим 2 000 бонусов.</p>
      <form class="form" id="loginForm" novalidate>
        <label class="field"><span>Телефон</span><input name="phone" required inputmode="tel" autocomplete="tel" data-phone data-focus placeholder="+7 (___) ___-__-__"></label>
        <button class="btn btn--pink btn--wide" type="submit">Получить код</button>
        <p class="tiny">Демо: SMS не отправляется, подойдёт любой код из 4 цифр.</p>
      </form></div>`);
  }
  function askCode(phone){
    modalIn.innerHTML = `<div class="modal__in">
      <span class="login__badge">${ic('chat')}</span>
      <h3 class="mtitle" id="modalTitle">код из SMS</h3>
      <p class="muted">Отправили на ${phone}</p>
      <form class="form" id="codeForm" novalidate data-phone-no="${phone}">
        <div class="codebox">${'<input inputmode="numeric" maxlength="1" aria-label="Цифра кода" autocomplete="one-time-code">'.repeat(4)}</div>
        <button class="btn btn--pink btn--wide" type="submit">Войти</button>
        <button class="linkbtn" type="button" data-open="login">Изменить номер</button>
      </form></div>`;
    $('.codebox input', modalIn).focus();
  }
  function signIn(phone){
    state.user = {phone, bonus:2000, since:new Date().toLocaleDateString('ru-RU')};
    store.set('user', state.user); updateUser();
    modalIn.innerHTML = `<div class="modal__in done">
      <span class="done__ic">${ic('crown')}</span>
      <h3 class="mtitle" id="modalTitle">добро пожаловать в клуб!</h3>
      <p class="muted">На вашу карту начислено <b>2 000 бонусов</b>. Ими можно оплатить до 30% заказа.</p>
      <button class="btn btn--pink" type="button" data-close>За покупками</button></div>`;
  }
  function openProfile(){
    const u = state.user, spent = state.orders.reduce((s, o) => s + o.total, 0), goal = 150000;
    modal(`<div class="modal__in profile">
      <p class="eyebrow">Личный кабинет</p>
      <h3 class="mtitle" id="modalTitle">ваш Cosmoproff Club</h3>
      <div class="pcard"><span class="pcard__logo">COSMOPROFF</span><span class="pcard__lvl">PINK</span><span class="pcard__chip"></span>
        <span class="pcard__num">•••• •••• ${u.phone.replace(/\D/g, '').slice(-4)}</span><span class="pcard__bal">${plural(u.bonus, ['бонус', 'бонуса', 'бонусов'])}</span></div>
      <p class="tiny">До уровня Rose (10% бонусами): ${money(Math.max(0, goal - spent))}</p>
      <div class="progress"><i style="width:${Math.min(100, spent/goal*100)}%"></i></div>
      <h4 class="article__sub">мои заказы</h4>
      ${state.orders.length ? `<ul class="orders">${state.orders.map(o => `<li><span><b>${o.no}</b> · ${o.date}</span><span>${money(o.total)}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin-bottom:20px">Заказов пока нет.</p>'}
      <button class="btn btn--line btn--wide" type="button" data-logout>Выйти</button>
    </div>`);
  }
  modalIn.addEventListener('submit', e => {
    const f = e.target; e.preventDefault();
    if(f.id === 'orderForm') return placeOrder(f);
    if(f.id === 'loginForm'){
      const ok = f.phone.value.replace(/\D/g, '').length === 11;
      f.phone.closest('.field').classList.toggle('is-bad', !ok);
      return ok ? askCode(f.phone.value) : f.phone.focus();
    }
    if(f.id === 'codeForm'){
      const code = $$('.codebox input', f).map(i => i.value).join('');
      return code.length === 4 ? signIn(f.dataset.phoneNo) : toast('Введите 4 цифры кода', {icon:'chat'});
    }
  });
  modalIn.addEventListener('input', e => {                       // code boxes: one digit each, jump forward
    const i = e.target; if(!i.closest('.codebox')) return;
    i.value = i.value.replace(/\D/g, '').slice(-1);
    if(i.value && i.nextElementSibling) i.nextElementSibling.focus();
    else if(i.value && $$('.codebox input', modalIn).every(x => x.value)) i.form.requestSubmit();
  });
  modalIn.addEventListener('keydown', e => {
    const i = e.target; if(i.closest('.codebox') && e.key === 'Backspace' && !i.value && i.previousElementSibling) i.previousElementSibling.focus();
  });
  modalIn.addEventListener('click', e => {
    if(!e.target.closest('[data-logout]')) return;
    state.user = null; store.set('user', null); updateUser(); closeLayer(modalEl); toast('Вы вышли из аккаунта', {icon:'user'});
  });

  /* ---------- city ---------- */
  function openCity(){
    modal(`<div class="modal__in">
      <p class="eyebrow">Доставка</p>
      <h3 class="mtitle" id="modalTitle">ваш город</h3>
      <p class="muted">Покажем сроки и способы доставки.</p>
      <div class="cities">${CITIES.map(c => `<button class="city${c.name === state.city ? ' is-on' : ''}" type="button" data-city-pick="${c.name}"><b>${c.name}</b><small>доставка ${c.eta}</small></button>`).join('')}</div>
    </div>`);
  }
  modalIn.addEventListener('click', e => {
    const b = e.target.closest('[data-city-pick]'); if(!b) return;
    state.city = b.dataset.cityPick; store.set('city', state.city); updateCity();
    closeLayer(modalEl); toast(`Город доставки: <b>${state.city}</b>, ${cityOf().eta}`, {icon:'pin'});
  });

  /* ---------- footer info pages ---------- */
  const INFO = {
    delivery:['доставка и оплата', `<p>По Алматы курьер привезёт заказ на следующий день, в другие города Казахстана — за 1–4 дня. Доставка бесплатна от ${money(FREE_SHIP)}, иначе — ${money(SHIP)}.</p><p>Самовывоз из бутика — бесплатно, в день заказа.</p><h4>Оплата</h4><p>Картой онлайн, через Kaspi QR или при получении. Бонусами Cosmoproff Club можно оплатить до 30% заказа.</p>`],
    returns:['возврат', '<p>Невскрытые товары в оригинальной упаковке можно вернуть в течение 14 дней. Если средство не подошло или пришло с браком — напишите нам, и мы заменим его или вернём деньги.</p><p>Деньги возвращаются на карту в течение 3–10 рабочих дней.</p>'],
    about:['о нас', '<p>Cosmoproff — магазин профессиональной уходовой косметики. Мы отбираем средства, с которыми работают косметологи, и делаем их доступными для домашнего ухода.</p><p>Для мастеров и салонов у нас есть оптовая программа, кабинетные объёмы и обучение. Это демо-версия сайта: бренды, товары и цены условные.</p>']
  };
  const openInfo = k => modal(`<div class="modal__in info"><p class="eyebrow">Cosmoproff</p><h3 class="mtitle" id="modalTitle">${INFO[k][0]}</h3>${INFO[k][1]}</div>`);

  /* ---------- journal ---------- */
  function openArticle(id){
    const a = ARTICLES.find(x => x.id === id);
    modal(`<article>
      <div class="article__pic" style="--g1:${a.bg[0]};--g2:${a.bg[1]}">${artGroup(a.art)}</div>
      <div class="modal__in">
        <p class="post__meta">${a.tag} <span>· ${a.time} чтения</span></p>
        <h3 class="mtitle" id="modalTitle">${a.title}</h3>
        ${a.body.map(t => `<p class="article__p">${t}</p>`).join('')}
        <h4 class="article__sub">средства из статьи</h4>
        <div class="rel">${a.ids.map(id => card(byId(id))).join('')}</div>
      </div></article>`, 'lg');
  }
  $('#journalGrid').innerHTML = ARTICLES.map(a => `<button class="post" type="button" data-article="${a.id}" data-in>
      <span class="post__pic" style="--g1:${a.bg[0]};--g2:${a.bg[1]}">${artGroup(a.art)}</span>
      <span class="post__meta">${a.tag} <span>· ${a.time}</span></span>
      <span class="post__title">${a.title}</span>
    </button>`).join('');

  /* ---------- search ---------- */
  const catName = id => (CATS.find(c => c.id === id) || {name:''}).name;
  const STOP = new Set(['для', 'и', 'с', 'в', 'на', 'от', 'по', 'без', 'со']);
  const stem = w => w.length > 6 ? w.slice(0, -2) : w.length > 3 ? w.slice(0, -1) : w;   // crude Russian endings
  const terms = q => q.toLowerCase().trim().split(/\s+/).filter(w => w && !STOP.has(w)).map(stem);
  function searchFor(q){
    const words = terms(q);
    if(!words.length) return [];
    return PRODUCTS.filter(p => { const hay = [p.brandName, p.name, p.type, p.inci, catName(p.cat)].join(' ').toLowerCase(); return words.every(w => hay.includes(w)); })
      .sort((a, b) => b.n - a.n);
  }
  const hl = (s, q) => { const w = terms(q).filter(x => x.length > 1); return w.length ? s.replace(new RegExp('(' + w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi'), '<mark>$1</mark>') : s; };
  const resItem = (p, q = '') => `<button class="res__item" type="button" data-product="${p.id}">
      <span class="res__pic" style="--tint:${tint(p)}">${Art.product(p, {deco:true})}</span>
      <span class="res__txt"><small>${hl(p.type, q)}</small><b>${hl(p.brandName, q)}</b> ${hl(p.name, q)}</span>
      <span class="res__price">${money(p.price)}</span></button>`;
  function renderSearch(){
    const q = $('#q').value, body = $('#searchBody');
    if(!q.trim()){
      body.innerHTML = `<p class="search__h">Часто ищут</p>
        <div class="search__tags">${['сыворотка', 'SPF', 'ретинол', 'церамиды', 'для волос', 'крем для рук', 'набор', 'пилинг'].map(t => `<button class="chip" type="button" data-q="${t}">${t}</button>`).join('')}</div>
        <p class="search__h">Популярное</p><div class="res">${PRODUCTS.filter(p => p.tags.includes('hit')).slice(0, 6).map(p => resItem(p)).join('')}</div>`;
      return;
    }
    const list = searchFor(q);
    body.innerHTML = list.length
      ? `<p class="search__h">${plural(list.length, ['товар', 'товара', 'товаров'])}</p><div class="res">${list.map(p => resItem(p, q)).join('')}</div>`
      : blank('search', 'Ничего не нашли', `По запросу «${esc(q)}» товаров нет. Попробуйте «крем», «сыворотка» или название бренда.`);
  }
  $('#q').addEventListener('input', renderSearch);
  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); const r = $('#searchBody .res__item'); r && r.focus(); });
  $('#searchBody').addEventListener('click', e => { const t = e.target.closest('[data-q]'); if(t){ $('#q').value = t.dataset.q; renderSearch(); $('#q').focus(); } });

  /* ---------- menu drawer ---------- */
  const visible = PRODUCTS.filter(p => !p.hidden);
  $('#menuList').innerHTML = CATS.map(c => `<a href="#catalog" data-filter="${c.id}" data-close><span class="menu__ic">${ic(c.ic)}</span>${c.name}<small>${visible.filter(p => p.cat === c.id).length}</small></a>`).join('')
    + `<a href="#catalog" data-filter="sale" data-close><span class="menu__ic">${ic('percent')}</span>Скидки<small>${visible.filter(p => p.old).length}</small></a>`
    + '<p class="menu__sep">Cosmoproff</p>'
    + `<a href="#quiz" data-close><span class="menu__ic">${ic('drop')}</span>Подбор ухода</a>`
    + `<a href="#brands" data-close><span class="menu__ic">${ic('star')}</span>Бренды</a>`
    + `<a href="#club" data-close><span class="menu__ic">${ic('crown')}</span>Cosmoproff Club</a>`
    + `<a href="#pro" data-close><span class="menu__ic">${ic('flask')}</span>Для косметологов</a>`
    + `<button type="button" data-product="29"><span class="menu__ic">${ic('gift')}</span>Подарочные карты</button>`
    + `<a href="#journal" data-close><span class="menu__ic">${ic('leaf')}</span>Журнал</a>`;

  /* ---------- shelves ---------- */
  $$('[data-shelf]').forEach(tr => {
    const k = tr.dataset.shelf;
    tr.innerHTML = visible.filter(p => p.tags.includes(k)).map(card).join('');
  });
  $$('.shelf').forEach(sh => {
    const tr = $('.shelf__track', sh), prev = $('[data-shelf-prev]', sh), next = $('[data-shelf-next]', sh);
    if(!tr || !prev) return;
    const step = () => tr.clientWidth*.92;
    prev.addEventListener('click', () => tr.scrollBy({left:-step()}));
    next.addEventListener('click', () => tr.scrollBy({left:step()}));
    const upd = () => { prev.disabled = tr.scrollLeft < 4; next.disabled = tr.scrollLeft + tr.clientWidth > tr.scrollWidth - 4; };
    tr.addEventListener('scroll', upd, {passive:true}); addEventListener('resize', upd); requestAnimationFrame(upd);
  });

  /* ---------- catalogue grid ---------- */
  const cat = {f:'all', brand:'all', sort:'pop', shown:12};
  const FILTERS = [{id:'all', name:'Все'}, ...CATS, {id:'sale', name:'Скидки'}, {id:'new', name:'Новинки'}, {id:'hit', name:'Хиты'}];
  const match = (p, f) => f === 'all' || (f === 'sale' ? !!p.old : f === 'new' || f === 'hit' ? p.tags.includes(f) : p.cat === f);
  const SORT = {pop:(a, b) => b.n - a.n, rate:(a, b) => b.r - a.r || b.n - a.n, cheap:(a, b) => a.price - b.price, dear:(a, b) => b.price - a.price, sale:(a, b) => pct(b) - pct(a) || b.n - a.n};
  function renderChips(){
    $('#chips').innerHTML = FILTERS.map(f => `<button class="chip${cat.f === f.id ? ' is-on' : ''}" type="button" role="tab" aria-selected="${cat.f === f.id}" data-chip="${f.id}">${f.name}<sup>${visible.filter(p => match(p, f.id)).length}</sup></button>`).join('');
  }
  function renderGrid(){
    const list = visible.filter(p => match(p, cat.f) && (cat.brand === 'all' || p.b === cat.brand)).sort(SORT[cat.sort]);
    $('#catCount').textContent = plural(list.length, ['товар', 'товара', 'товаров']) + (cat.brand !== 'all' ? ' · ' + BRANDS[cat.brand].name : '');
    $('#grid').innerHTML = list.length
      ? list.slice(0, cat.shown).map(card).join('')
      : `<div class="empty">${blank('search', 'Ничего не нашли', 'В этой категории у выбранного бренда пока нет товаров.', '<button class="btn btn--line" type="button" data-reset>Сбросить фильтры</button>')}</div>`;
    $('#moreBtn').hidden = list.length <= cat.shown;
  }
  function setFilter(f, brand = cat.brand){
    Object.assign(cat, {f, brand, shown:12});
    $('#brandSel').value = brand;
    renderChips(); renderGrid();
    const on = $('#chips .is-on'); on && on.scrollIntoView({block:'nearest', inline:'center', behavior:reduce ? 'auto' : 'smooth'});
  }
  $('#brandSel').insertAdjacentHTML('beforeend', Object.entries(BRANDS).map(([k, b]) => `<option value="${k}">${b.name}</option>`).join(''));
  $('#brandSel').addEventListener('change', e => setFilter(cat.f, e.target.value));
  $('#sortSel').addEventListener('change', e => { cat.sort = e.target.value; cat.shown = 12; renderGrid(); });
  $('#moreBtn').addEventListener('click', () => {
    const from = cat.shown; cat.shown += 8; renderGrid();
    $$('#grid .card').slice(from).forEach((c, i) => c.style.setProperty('--i', i));
    $$('#grid .card').slice(0, from).forEach(c => c.style.animation = 'none');
  });
  $('#grid').addEventListener('click', e => { if(e.target.closest('[data-reset]')) setFilter('all', 'all'); });
  renderChips(); renderGrid();

  /* ---------- brands marquee ---------- */
  const brandWords = Object.entries(BRANDS).map(([k, b]) => `<button class="brand-w" type="button" data-filter="all" data-brand="${k}">${b.name}</button>`);
  const half = Math.ceil(brandWords.length/2), rowA = brandWords.slice(0, half).join(''), rowB = brandWords.slice(half).join('');
  $('#brandsA').innerHTML = rowA + rowA + rowA + rowA;            // repeated so the -50% loop never shows a gap
  $('#brandsB').innerHTML = rowB + rowB + rowB + rowB;
  $$('.marquee__in').forEach(m => $$('.brand-w', m).forEach((b, i) => { if(i >= m.children.length/4) b.tabIndex = -1; }));

  /* ---------- stories ---------- */
  const storyEl = $('#story'), storyBox = $('#storyBox');
  let sIdx = 0;
  function renderStoryButtons(){
    $('#stories').innerHTML = STORIES.map((s, i) => `<li><button class="sbtn${state.seen.includes(s.id) ? ' is-seen' : ''}" type="button" data-story="${i}">
      <span class="sbtn__ring"><span class="sbtn__in" style="--g1:${s.bg[0]};--g2:${s.bg[1]}">${ic(s.ic)}</span></span>${s.title}</button></li>`).join('');
  }
  function openStory(i){ sIdx = i; openLayer(storyEl); showStory(); }
  function showStory(){
    const s = STORIES[sIdx];
    if(!state.seen.includes(s.id)){ state.seen.push(s.id); store.set('seen', state.seen); }
    storyBox.style.setProperty('--g1', s.bg[0]); storyBox.style.setProperty('--g2', s.bg[1]);
    storyBox.innerHTML = `
      <div class="story__bars">${STORIES.map((x, n) => `<i class="${n < sIdx ? 'is-done' : n === sIdx ? 'is-now' : ''}"><b></b></i>`).join('')}</div>
      <div class="story__top"><span class="story__av">CP</span><span><b>cosmoproff</b><small>${s.title}</small></span>
        <button class="ibtn" type="button" data-close aria-label="Закрыть">${ic('close')}</button></div>
      <div class="story__art">${artGroup(s.art)}</div>
      <div class="story__copy"><h3>${s.head}</h3><p>${s.text}</p><button class="btn btn--white" type="button" data-story-act="${s.act}">${s.cta}</button></div>
      <button class="story__tap story__tap--l" type="button" data-story-go="-1" aria-label="Назад"></button>
      <button class="story__tap story__tap--r" type="button" data-story-go="1" aria-label="Дальше"></button>`;
    const bar = $('.story__bars .is-now b', storyBox);
    if(!reduce) bar.addEventListener('animationend', () => { if(isOpen(storyEl)) goStory(1); });
  }
  function goStory(d){
    const k = sIdx + d;
    if(k >= STORIES.length) return closeLayer(storyEl);
    sIdx = Math.max(0, k); showStory();
  }
  function stopStory(){ storyEl.classList.remove('is-paused'); renderStoryButtons(); }
  storyEl.addEventListener('click', e => {
    const go = e.target.closest('[data-story-go]'); if(go) return goStory(+go.dataset.storyGo);
    const act = e.target.closest('[data-story-act]'); if(!act) return;
    const [kind, val] = act.dataset.storyAct.split(':');
    closeLayer(storyEl);
    if(kind === 'filter'){ setFilter(val, 'all'); scrollToId('catalog'); }
    else if(kind === 'product') openProduct(+val);
    else scrollToId(val);
  });
  storyBox.addEventListener('pointerdown', e => { if(!e.target.closest('.btn, .story__top')) storyEl.classList.add('is-paused'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => storyBox.addEventListener(t, () => storyEl.classList.remove('is-paused')));
  renderStoryButtons();

  /* ---------- routine quiz ---------- */
  const Q = [
    {key:'skin', q:'Какой у вас тип кожи?', opts:[
      ['dry', 'Сухая', 'стянутость, шелушения', 'drop'], ['oily', 'Жирная', 'блеск, расширенные поры', 'sun'],
      ['combo', 'Комбинированная', 'жирная Т-зона, сухие щёки', 'blob'], ['normal', 'Нормальная', 'почти не доставляет хлопот', 'check'],
      ['sens', 'Чувствительная', 'краснеет, реагирует на новое', 'heart']]},
    {key:'need', q:'Что хочется улучшить в первую очередь?', opts:[
      ['hydra', 'Увлажнение', 'сухость и тусклость', 'drop'], ['acne', 'Акне и поры', 'высыпания, чёрные точки', 'shield'],
      ['age', 'Морщины', 'упругость и чёткий овал', 'sparkle'], ['tone', 'Пигментация', 'ровный тон и сияние', 'sun'],
      ['red', 'Покраснения', 'успокоить и укрепить барьер', 'leaf']]},
    {key:'time', q:'Сколько времени готовы уделять уходу?', opts:[
      ['quick', '2–3 минуты', '3 шага: очищение, крем, SPF', 'clock'], ['full', '10 минут', '5 шагов: полный ритуал', 'flask']]}
  ];
  const STEP_NAME = {cleanse:'Очищение', tone:'Тонизирование', serum:'Сыворотка', cream:'Крем', spf:'Защита SPF'};
  const quiz = {step:0};
  const best = st => PRODUCTS.filter(p => p.step === st)
    .map(p => ({p, s:(p.skin.includes(quiz.skin) ? 4 : 0) + (p.need.includes(quiz.need) ? 3 : 0) + p.r}))
    .sort((a, b) => b.s - a.s)[0].p;
  function renderQuiz(){
    $$('#quizSteps li').forEach((li, i) => li.classList.toggle('is-on', i <= quiz.step));
    const main = $('#quizMain');
    if(quiz.step < Q.length){
      const s = Q[quiz.step];
      main.innerHTML = `<div class="pane"><p class="pane__q">${s.q}</p>
        <div class="opts">${s.opts.map(([v, t, sub, i]) => `<button class="opt${quiz[s.key] === v ? ' is-on' : ''}" type="button" data-quiz="${v}"><span class="opt__ic">${ic(i)}</span><span>${t}<small>${sub}</small></span></button>`).join('')}</div>
        ${quiz.step ? `<button class="pane__back" type="button" data-quiz-back>${ic('left')}Назад</button>` : ''}</div>`;
      return;
    }
    const plan = quiz.time === 'quick' ? ['cleanse', 'cream', 'spf'] : ['cleanse', 'tone', 'serum', 'cream', 'spf'];
    const picks = plan.map(best), sum = picks.reduce((s, p) => s + p.price, 0);
    quiz.picks = picks;
    main.innerHTML = `<div class="pane">
      <p class="pane__q">Ваш ритуал: ${SKIN[quiz.skin].toLowerCase()} кожа · ${NEED[quiz.need].toLowerCase()}</p>
      <div class="ritual">${picks.map((p, i) => `<button class="ritual__item" type="button" data-product="${p.id}">
        <span class="ritual__n">0${i + 1}</span><span class="ritual__pic" style="--tint:${tint(p)}">${Art.product(p, {deco:true})}</span>
        <span class="ritual__txt"><small>${STEP_NAME[plan[i]]}</small><b>${p.brandName}</b> ${p.name}</span><span class="ritual__price">${money(p.price)}</span></button>`).join('')}</div>
      <div class="quiz__actions">
        <button class="btn btn--pink" type="button" data-quiz-all>Добавить всё · ${money(sum)}</button>
        <button class="btn btn--line" type="button" data-quiz-again>Пройти заново</button>
      </div>
      <p class="tiny" style="margin-top:12px">С промокодом COSMO10 весь ритуал — ещё на 10% дешевле.</p></div>`;
  }
  $('#quizMain').addEventListener('click', e => {
    const t = e.target;
    if(t.closest('[data-quiz]')){ quiz[Q[quiz.step].key] = t.closest('[data-quiz]').dataset.quiz; quiz.step++; renderQuiz(); }
    else if(t.closest('[data-quiz-back]')){ quiz.step--; renderQuiz(); }
    else if(t.closest('[data-quiz-again]')){ quiz.step = 0; renderQuiz(); }
    else if(t.closest('[data-quiz-all]')){
      quiz.picks.forEach(p => { const it = state.cart.find(x => x.id === p.id && x.v === p.vols[0]); it ? it.q++ : state.cart.push({id:p.id, v:p.vols[0], q:1}); });
      saveCart(); bump($('#cartBtn')); bump($('[data-tab=cart]'));
      toast(`Ритуал из ${quiz.picks.length} средств — в корзине`, {icon:'bag', action:['Корзина', () => openers.cart()]});
    }
  });
  renderQuiz();

  /* ---------- hero slider (advances when the active dot finishes filling) ---------- */
  (function hero(){
    const root = $('.hero'), slides = $$('.slide', root), dots = $('#heroDots'), DUR = 6500;
    let i = 0;
    root.style.setProperty('--dur', DUR + 'ms');
    dots.innerHTML = slides.map((s, k) => `<button type="button" aria-label="Слайд ${k + 1}"><span><i></i></span></button>`).join('');
    const btns = $$('button', dots);
    function go(k){
      i = (k + slides.length) % slides.length;
      slides.forEach((s, n) => { s.classList.toggle('is-active', n === i); s.inert = n !== i; s.setAttribute('aria-hidden', n !== i); });
      btns.forEach((b, n) => { b.classList.remove('is-active'); b.setAttribute('aria-current', n === i); if(n === i){ void b.offsetWidth; b.classList.add('is-active'); } });
      root.classList.toggle('is-light', slides[i].classList.contains('is-dark'));
    }
    btns.forEach((b, n) => {
      b.addEventListener('click', () => go(n));
      $('i', b).addEventListener('animationend', () => { if(n === i && !reduce) go(i + 1); });
    });
    $('#heroPrev').addEventListener('click', () => go(i - 1));
    $('#heroNext').addEventListener('click', () => go(i + 1));
    root.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') root.classList.add('is-paused'); });
    root.addEventListener('pointerleave', () => root.classList.remove('is-paused'));
    root.addEventListener('focusin', e => { if(e.target.matches(':focus-visible')) root.classList.add('is-paused'); });
    root.addEventListener('focusout', () => root.classList.remove('is-paused'));
    let x0 = null;
    root.addEventListener('pointerdown', e => { x0 = e.clientX; });
    root.addEventListener('pointerup', e => { if(x0 == null) return; const dx = e.clientX - x0; x0 = null; if(Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1)); });
    root.addEventListener('dragstart', e => e.preventDefault());
    go(0);
  })();

  /* ---------- misc: art, club card tilt, counters, forms ---------- */
  $$('[data-art]').forEach(el => el.insertAdjacentHTML('beforeend', artGroup(el.dataset.art.split(','))));

  $$('.pcard[data-tilt]').forEach(c => {
    const host = c.parentElement;
    host.addEventListener('pointermove', e => {
      if(e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height;
      c.style.transform = `rotateY(${((x - .5)*18).toFixed(2)}deg) rotateX(${((.5 - y)*14).toFixed(2)}deg)`;
      c.style.setProperty('--mx', (x*100).toFixed(1) + '%'); c.style.setProperty('--my', (y*100).toFixed(1) + '%');
    });
    host.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });

  $('#proCity').innerHTML = CITIES.map(c => `<option${c.name === state.city ? ' selected' : ''}>${c.name}</option>`).join('');
  $('#proForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, bad = [];
    if(!f.elements.name.value.trim()) bad.push(f.elements.name);
    if(f.phone.value.replace(/\D/g, '').length !== 11) bad.push(f.phone);
    $$('.field', f).forEach(x => x.classList.toggle('is-bad', bad.includes($('input', x))));
    if(bad.length){ bad[0].focus(); return; }
    toast(`Спасибо, ${esc(f.elements.name.value.trim())}! Менеджер свяжется с вами в течение рабочего дня.`, {icon:'check', ms:4500});
    f.reset(); $('#proCity').value = state.city;
  });
  $('#subForm').addEventListener('submit', e => {
    e.preventDefault();
    const m = e.target.email;
    if(!/^\S+@\S+\.\S+$/.test(m.value)){ m.focus(); toast('Введите корректный e-mail', {icon:'mail'}); return; }
    toast('Вы подписаны! Промокод <b>COSMO10</b> — ваш', {icon:'mail', action:['Копировать', () => copy('COSMO10')]});
    e.target.reset();
  });

  /* phone mask: +7 (XXX) XXX-XX-XX; the field starts with "+7 (" so typed digits are the local number */
  const isPhone = el => el.matches && el.matches('[data-phone]');
  document.addEventListener('focusin', e => { if(isPhone(e.target) && !e.target.value) e.target.value = '+7 ('; });
  document.addEventListener('focusout', e => { if(isPhone(e.target) && e.target.value.replace(/\D/g, '').length < 2) e.target.value = ''; });
  document.addEventListener('input', e => {
    const el = e.target; if(!isPhone(el)) return;
    let p = el.value.replace(/\D/g, '');
    if(el.value.startsWith('+7')) p = p.slice(1);                     // drop the mask's own 7
    else if(p.length === 11 && /^[78]/.test(p)) p = p.slice(1);       // pasted 8 700… or 7 700…
    if(p.length > 10 && /^[78]/.test(p)) p = p.slice(1);              // pasted +7 700… after the mask
    p = p.slice(0, 10);
    let s = p.length || el.value.startsWith('+7') ? '+7' : '';
    if(p.length) s += ' (' + p.slice(0, 3);
    if(p.length > 3) s += ') ' + p.slice(3, 6);
    if(p.length > 6) s += '-' + p.slice(6, 8);
    if(p.length > 8) s += '-' + p.slice(8, 10);
    el.value = s;
    el.closest('.field') && el.closest('.field').classList.remove('is-bad');
  });

  async function copy(text, el){
    try{ await navigator.clipboard.writeText(text); }
    catch(err){ const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(_){} ta.remove(); }
    if(el){ el.classList.add('is-copied'); setTimeout(() => el.classList.remove('is-copied'), 1800); }
    toast(`Промокод <b>${text}</b> скопирован — введите его в корзине`, {icon:'check'});
  }

  function scrollToId(id){
    const el = document.getElementById(id); if(!el) return;
    el.scrollIntoView({behavior:reduce ? 'auto' : 'smooth', block:'start'});
  }

  /* ---------- global click / key handling ---------- */
  const openers = {
    menu: () => openLayer($('#menu')),
    cart: () => { renderCart(); openLayer($('#cart')); },
    fav: () => { renderFav(); openLayer($('#fav')); },
    search: () => { renderSearch(); openLayer($('#search')); setTimeout(() => $('#q').focus(), 80); },
    login: openLogin,
    city: openCity,
    top: () => { closeAll(); scrollTo({top:0, behavior:reduce ? 'auto' : 'smooth'}); }
  };

  document.addEventListener('click', e => {
    const t = e.target; let el;
    if(t.closest('[data-demo]')){ e.preventDefault(); toast('Ссылки на соцсети появятся в рабочей версии сайта', {icon:'chat'}); return; }
    if((el = t.closest('[data-close]'))){ const L = el.closest('.layer'); if(L) closeLayer(L); if(el.tagName !== 'A') return; }
    if((el = t.closest('[data-open]'))){ e.preventDefault(); openers[el.dataset.open](); return; }
    if((el = t.closest('[data-fav]'))){ e.preventDefault(); toggleFav(el.dataset.fav); return; }
    if((el = t.closest('[data-add]'))){ e.preventDefault(); addToCart(+el.dataset.add); return; }
    if((el = t.closest('[data-copy]'))){ copy(el.dataset.copy, el); return; }
    if((el = t.closest('[data-filter]'))){
      setFilter(el.dataset.filter, el.dataset.brand || 'all');
      if(el.tagName !== 'A'){ closeAll(); scrollToId('catalog'); }
      return;
    }
    if((el = t.closest('[data-chip]'))){ setFilter(el.dataset.chip); return; }
    if((el = t.closest('[data-story]'))){ openStory(+el.dataset.story); return; }
    if((el = t.closest('[data-article]'))){ openArticle(+el.dataset.article); return; }
    if((el = t.closest('[data-info]'))){ openInfo(el.dataset.info); return; }
    if((el = t.closest('[data-product]'))){ if(!t.closest('#modal')){ closeLayer($('#search')); closeLayer($('#menu')); } openProduct(+el.dataset.product); return; }
    if((el = t.closest('.card'))){ openProduct(+el.dataset.id); return; }
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && layers.length){ closeLayer(); return; }
    if(isOpen(storyEl) && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')){ goStory(e.key === 'ArrowRight' ? 1 : -1); return; }
    if((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')){ e.preventDefault(); openProduct(+e.target.dataset.id); }
    if(e.key === '/' && !layers.length && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); openers.search(); }
  });

  /* ---------- reveal on scroll + number count-up ---------- */
  function countUp(el){
    const to = +el.dataset.countTo, t0 = performance.now(), D = 1400;
    const tick = now => { const k = Math.min(1, (now - t0)/D); el.textContent = num(to*(1 - Math.pow(1 - k, 3))) + (k === 1 && to >= 100 ? '+' : ''); if(k < 1) requestAnimationFrame(tick); };
    reduce ? (el.textContent = num(to) + (to >= 100 ? '+' : '')) : requestAnimationFrame(tick);
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => {
    if(!en.isIntersecting) return;
    en.target.classList.add('is-in');
    $$('[data-count-to]', en.target).forEach(countUp);
    io.unobserve(en.target);
  }), {rootMargin:'0px 0px -8% 0px'}) : null;
  $$('[data-in]').forEach(el => io ? io.observe(el) : el.classList.add('is-in'));

  /* ---------- start ---------- */
  paintIcons();
  updateCounts(); updateCity(); updateUser();
  const t0 = performance.now(), hideLoader = () => $('#loader').classList.add('is-done');
  addEventListener('load', () => setTimeout(hideLoader, Math.max(0, 1150 - (performance.now() - t0))));
  setTimeout(hideLoader, 3500);                                   // never block the page on slow fonts
})();

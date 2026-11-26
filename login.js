/* Pet Pals - "Who's playing?" login screen.
   Each player on this computer gets their own save (pets, coins, level). Players can have an optional
   4-digit PIN so brothers and sisters don't play on each other's pets. Everything stays on this computer.
   The game itself (game.js) is only loaded after someone logs in. */
(function () {
  const params = new URLSearchParams(location.search);
  const testLogin = params.get('sandbox') === 'login';   // ?sandbox=login tries the login screen with separate test players
  const NS = testLogin ? 'petpals-sandbox-' : 'petpals-';
  const ACCOUNTS_KEY = NS + 'accounts';
  const SESSION_KEY = NS + 'current';
  const OLD_SAVE = 'petpals-save-v2';              // the save from before there were accounts
  const PICS = ['sprout', 'puff', 'bubbl', 'cinder', 'flurr', 'gummy', 'petal', 'chirpy', 'bony', 'frosty', 'luna', 'clover'];

  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A PIN is only a little lock for kids, not real security: keep a scrambled copy instead of the digits.
  const pinHash = pin => { let h = 7; for (const ch of 'petpals:' + pin) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(36); };
  const petImg = id => `assets/pets/${id}.png?v=3`;

  function loadGame(account) {
    if (account) {
      window.PETPALS_SAVE_KEY = account.key;
      window.PETPALS_PLAYER = { name: account.name, avatar: account.avatar };
      window.PETPALS_ACCOUNT = { id: account.id, key: account.key };
      window.PETPALS_NS = NS;
      try { sessionStorage.setItem(SESSION_KEY, account.id); } catch (e) { /* ignore */ }
    }
    const old = document.getElementById('login');
    if (old) old.remove();
    const s = document.createElement('script');
    s.src = window.PETPALS_GAME_SRC;
    // Friends, gifts and trading load once the game is ready.
    s.onload = () => { if (window.PETPALS_ACCOUNT) { const f = document.createElement('script'); f.src = window.PETPALS_SOCIAL_SRC; f.onload = () => window.render && render(); document.body.appendChild(f); } };
    document.body.appendChild(s);
  }

  // Sandbox (for testing) skips the login and uses its own save.
  if (params.has('sandbox') && !testLogin) { loadGame(null); return; }

  // Online mode (cloud saves, online friends and trading): see online/online.js.
  // ?online tries it before it is switched on for everyone; ?local forces the old on-this-device players.
  if (window.PPO && !params.has('sandbox') && !params.has('local') && (window.PETPALS_ONLINE.enabled || params.has('online'))) { window.PPO.start(); return; }

  let accounts = read(ACCOUNTS_KEY, []);
  // First time with accounts: turn the existing save into the first player, so nothing is lost.
  if (!accounts.length && !testLogin) {
    const old = read(OLD_SAVE, null);
    if (old) {
      const pet = (old.pets || []).find(p => p.id === old.activeId) || (old.pets || [])[0];
      accounts = [{ id: 'p1', key: OLD_SAVE, name: (old.profile && old.profile.name) || 'Player 1',
        avatar: (old.profile && old.profile.avatar) || (pet && pet.species) || 'sprout', pin: null, created: Date.now() }];
      write(ACCOUNTS_KEY, accounts);
    }
  }

  // Already logged in this browser tab (e.g. after pressing F5): go straight in.
  let current = null;
  try { current = sessionStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
  const already = accounts.find(a => a.id === current);
  if (already) { loadGame(already); return; }

  // What each player's card shows: their name, picture and level from their own save.
  const info = a => {
    const s = read(a.key, null);
    const pet = s && ((s.pets || []).find(p => p.id === s.activeId) || (s.pets || [])[0]);
    return {
      name: (s && s.profile && s.profile.name) || a.name,
      avatar: (s && s.profile && s.profile.avatar) || (pet && pet.species) || a.avatar,
      level: (s && s.level) || 1,
      pets: s ? (s.pets || []).length : 0,
    };
  };

  const root = document.createElement('div');
  root.id = 'login';
  document.body.appendChild(root);

  function showPick() {
    root.innerHTML = `<div class="login-card">
      <div class="login-logo">✦ Pet Pals ✦</div>
      <h2 class="login-q">Who's playing?</h2>
      <div class="login-players">
        ${accounts.map(a => { const i = info(a); return `
          <button class="login-player" data-id="${a.id}" type="button">
            <span class="lp-pic"><img src="${petImg(i.avatar)}" alt=""></span>
            <b>${esc(i.name)}</b>
            <small>Lv ${i.level} · ${i.pets} pet${i.pets === 1 ? '' : 's'}${a.pin ? ' · 🔒' : ''}</small>
          </button>`; }).join('')}
        <button class="login-player new" id="newPlayer" type="button">
          <span class="lp-pic">➕</span><b>New player</b><small>Start your own pets</small>
        </button>
      </div>
      <p class="login-note">Your progress saves by itself on this computer. 💾</p>
    </div>`;
    root.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
      const a = accounts.find(x => x.id === b.dataset.id);
      if (a.pin) showPin(a); else loadGame(a);
    });
    root.querySelector('#newPlayer').onclick = showNew;
  }

  function pinPad(title, sub, onDone, back) {
    let pin = '';
    root.innerHTML = `<div class="login-card">
      <h2 class="login-q">${title}</h2><p class="login-note">${sub}</p>
      <div class="pin-dots" id="dots">${'<i></i>'.repeat(4)}</div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div>
      <button class="btn ghost small" id="back" type="button">← Back</button>
    </div>`;
    const dots = () => root.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
    root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') pin = pin.slice(0, -1);
      else if (k === '✓') { if (pin.length === 4) onDone(pin, () => { pin = ''; dots(); }); return; }
      else if (pin.length < 4) pin += k;
      dots();
      if (pin.length === 4) setTimeout(() => onDone(pin, () => { pin = ''; dots(); }), 150);
    });
    root.querySelector('#back').onclick = back;
  }

  function showPin(a) {
    pinPad(`Hi ${esc(info(a).name)}!`, 'Type your secret PIN', (pin, reset) => {
      if (pinHash(pin) === a.pin) loadGame(a);
      else { root.querySelector('#dots').classList.add('wrong'); setTimeout(() => { root.querySelector('#dots').classList.remove('wrong'); reset(); }, 450); }
    }, showPick);
  }

  function showNew() {
    let pic = PICS[0];
    root.innerHTML = `<div class="login-card">
      <h2 class="login-q">New player</h2>
      <label class="login-label">Your name</label>
      <input id="npName" maxlength="16" placeholder="Type your name" autocomplete="off">
      <label class="login-label">Pick a picture</label>
      <div class="login-pics">${PICS.map(id => `<button type="button" class="lpic ${id === pic ? 'on' : ''}" data-pic="${id}"><img src="${petImg(id)}" alt=""></button>`).join('')}</div>
      <label class="login-check"><input type="checkbox" id="npPin"> Add a secret 4-number PIN</label>
      <div class="login-row"><button class="btn ghost small" id="back" type="button">← Back</button><button class="btn" id="npGo" type="button">Let's play! 🐾</button></div>
    </div>`;
    const name = root.querySelector('#npName');
    name.focus();
    root.querySelectorAll('[data-pic]').forEach(b => b.onclick = () => {
      pic = b.dataset.pic;
      root.querySelectorAll('[data-pic]').forEach(x => x.classList.toggle('on', x === b));
    });
    root.querySelector('#back').onclick = () => accounts.length ? showPick() : showNew();
    const go = () => {
      const n = name.value.trim().slice(0, 16);
      if (!n) { name.classList.add('wrong'); name.focus(); setTimeout(() => name.classList.remove('wrong'), 450); return; }
      const id = 'p' + Date.now().toString(36);
      const acc = { id, key: NS + 'save-' + id, name: n, avatar: pic, pin: null, created: Date.now() };
      const finish = () => { accounts.push(acc); write(ACCOUNTS_KEY, accounts); loadGame(acc); };
      if (root.querySelector('#npPin').checked) {
        pinPad('Make a PIN', 'Pick 4 numbers you will remember', first =>
          pinPad('Type it again', 'Just to be sure!', (again, reset) => {
            if (again === first) { acc.pin = pinHash(first); finish(); }
            else { root.querySelector('#dots').classList.add('wrong'); setTimeout(() => { root.querySelector('#dots').classList.remove('wrong'); reset(); }, 450); }
          }, showNew), showNew);
      } else finish();
    };
    root.querySelector('#npGo').onclick = go;
    name.onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  if (accounts.length) showPick(); else showNew();
})();

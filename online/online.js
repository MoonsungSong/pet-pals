/* Pet Pals online: login with the club code, cloud saves that follow you between iPad and computer,
   and the calls used by the online Friends page (online/social-online.js).
   The database only lets the game call the pp_* functions in online/setup.sql. */
(function () {
  const cfg = window.PETPALS_ONLINE;
  if (!cfg || !cfg.url || !cfg.key) return;
  const SESSION = 'petpals-online-session';
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PICS = ['sprout', 'puff', 'bubbl', 'cinder', 'flurr', 'gummy', 'petal', 'chirpy', 'bony', 'frosty', 'luna', 'clover'];
  const petImg = id => `assets/pets/${id}.png?v=3`;
  const MSG = {
    bad_club_code: "That club code isn't right. Ask your friend for the secret code!",
    bad_nickname: 'Pick a name with 2 to 16 letters.',
    bad_pin: 'Your PIN must be 4 to 8 numbers.',
    nickname_taken: 'Someone already has that name. Try another one!',
    wrong_login: "Hmm, that name or PIN isn't right.",
    locked: 'Too many tries! Wait 5 minutes and try again.',
    not_logged_in: 'Please log in again.',
    no_such_code: 'No player has that friend code. Check the letters!',
    own_code: "That's your own friend code! 😄",
    not_friends: 'You can only do that with friends.',
    too_fast: 'Slow down a little! Wait a few seconds before chatting again. 🐢',
    empty: 'Type a message first!',
    room_gone: 'That trade room is closed now.',
    put_pet_first: 'Put a pet in first, then press Accept!',
    side_full: 'You can put in up to 4 pets.',
    not_joined: 'Wait for your friend to say yes to the trade first!',
    wait_a_bit: 'The pets just changed. Look carefully, then try again in 3 seconds! 👀',
    both_accept_first: 'You both need to press Accept first!',
    too_many_rooms: 'You already have 3 trade rooms open. Finish or close one first!',
    pet_too_big: "That pet can't be traded right now.",
    too_many_offers: 'You already have 5 trades waiting. Wait for answers first!',
    too_many_requests: 'You have lots of friend requests waiting already.',
    too_many_gifts: "You've sent lots of gifts already. Wait until they're opened!",
    offer_gone: 'That trade is not there anymore.',
    mail_gone: 'That was already opened.',
    network: "Can't reach the internet. Check the Wi-Fi and try again.",
  };

  async function rpc(fn, args) {
    let r;
    try {
      r = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}),
        keepalive: fn === 'pp_save' && JSON.stringify(args).length < 60000,
      });
    } catch (e) { throw Object.assign(new Error('network'), { code: 'network' }); }
    const t = await r.text();
    let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const code = (j && j.message) || `http_${r.status}`;
      throw Object.assign(new Error(code), { code });
    }
    if (j && j.error) throw Object.assign(new Error(j.error), { code: j.error });
    return j;
  }
  const say = e => MSG[e.code] || MSG[e.message] || `Oops! Something went wrong (${e.code || e.message}).`;

  let session = read(SESSION, null);           // { token, id, nickname, friend_code, version }
  const cacheKey = id => 'petpals-online-save-' + id;
  const metaKey = id => 'petpals-online-meta-' + id;   // { version, dirty }

  function startGame() {
    window.PETPALS_SAVE_KEY = cacheKey(session.id);
    window.PETPALS_PLAYER = { name: session.nickname, avatar: session.avatar };
    window.PETPALS_ACCOUNT = null;                   // (local friends are off in online mode)
    window.PETPALS_ONLINE_ON = true;
    const old = document.getElementById('login'); if (old) old.remove();
    const s = document.createElement('script');
    s.src = window.PETPALS_GAME_SRC;
    s.onload = () => {
      hookSaving();
      const f = document.createElement('script');
      f.src = window.PETPALS_SOCIAL_ONLINE_SRC;
      f.onload = () => {
        if (window.render) render();
        if (window.PPO_social) window.PPO_social.start();
        if (window.PETPALS_CHAT_SRC) {                 // friends chat + live trade rooms
          const c = document.createElement('script');
          c.src = window.PETPALS_CHAT_SRC;
          document.body.appendChild(c);
        }
      };
      document.body.appendChild(f);
    };
    document.body.appendChild(s);
  }

  // Bring the server's save onto this device (unless this device has newer, unsent changes).
  function takeServer(r) {
    const meta = read(metaKey(r.id), null);
    const local = read(cacheKey(r.id), null);
    if (meta && meta.dirty && local && meta.version === r.version) return;          // keep my unsent changes
    if (r.save && Object.keys(r.save).length) write(cacheKey(r.id), r.save);
    write(metaKey(r.id), { version: r.version, dirty: false });
  }

  function loggedIn(r) {
    session = { token: r.token || session.token, id: r.id, nickname: r.nickname, friend_code: r.friend_code,
      avatar: (r.save && r.save.profile && r.save.profile.avatar) || null };
    write(SESSION, session);
    takeServer(r);
    startGame();
  }

  // ---------- cloud saving ----------
  let syncTimer = 0, syncing = false;
  function hookSaving() {
    const localSave = window.save;
    window.save = function () {
      localSave();
      const m = read(metaKey(session.id), { version: 0 }); m.dirty = true; write(metaKey(session.id), m);
      clearTimeout(syncTimer); syncTimer = setTimeout(sync, 2500);
    };
    setInterval(() => { const m = read(metaKey(session.id), {}); if (m.dirty) sync(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) sync(); });
    addEventListener('pagehide', () => sync());
  }
  async function sync() {
    if (syncing || !session) return;
    const m = read(metaKey(session.id), { version: 0 });
    if (!m.dirty) return;
    syncing = true;
    try {
      const st = read(cacheKey(session.id), null);
      const r = await rpc('pp_save', { p_token: session.token, p_save: st, p_base_version: m.version });
      if (r.conflict) {
        // Another device saved a newer game: switch to that one.
        write(cacheKey(session.id), r.save); write(metaKey(session.id), { version: r.version, dirty: false });
        if (window.toast) toast('☁️ Your game was updated from another device!');
        setTimeout(() => location.reload(), 1200);
      } else {
        write(metaKey(session.id), { version: r.version, dirty: false });
        setCloud(true);
      }
    } catch (e) {
      setCloud(false);
      if (e.code === 'not_logged_in') { logout(true); }
    } finally { syncing = false; }
  }
  function setCloud(ok) {
    const b = document.getElementById('profileBtn');
    if (b) b.classList.toggle('offline', !ok);
  }

  function logout(expired) {
    const s = session;
    if (s) {
      sync().finally(() => {
        if (!expired) rpc('pp_logout', { p_token: s.token }).catch(() => {});
        localStorage.removeItem(SESSION);
        location.href = location.pathname;
      });
    } else location.href = location.pathname;
  }

  // ---------- login screens ----------
  const root = () => {
    let r = document.getElementById('login');
    if (!r) { r = document.createElement('div'); r.id = 'login'; document.body.appendChild(r); }
    return r;
  };
  const card = inner => { root().innerHTML = `<div class="login-card"><div class="login-logo">✦ Pet Pals ✦</div>${inner}</div>`; return root(); };

  function showHome(msg) {
    const el = card(`<h2 class="login-q">Welcome!</h2>
      ${msg ? `<p class="code-err">${esc(msg)}</p>` : ''}
      <button class="btn" id="goLogin" type="button">🔑 Log in</button>
      <button class="btn blue" id="goJoin" type="button">✨ New player</button>
      <p class="login-note">☁️ Your pets are saved online, so you can play on the iPad or the computer.</p>`);
    el.querySelector('#goLogin').onclick = () => showLogin();
    el.querySelector('#goJoin').onclick = () => showJoin();
  }

  function showLogin(err) {
    const el = card(`<h2 class="login-q">Log in</h2>
      <label class="login-label">Your name</label><input id="lgName" class="login-in" maxlength="16" autocomplete="username" value="${esc((read('petpals-online-last', '')))}">
      <label class="login-label">Your secret PIN</label><input id="lgPin" class="login-in" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password">
      <p class="code-err" id="err">${err ? esc(err) : ''}</p>
      <div class="login-row"><button class="btn ghost small" id="back" type="button">← Back</button><button class="btn" id="go" type="button">Let's play! 🐾</button></div>`);
    const name = el.querySelector('#lgName'), pin = el.querySelector('#lgPin');
    (name.value ? pin : name).focus();
    const go = async () => {
      el.querySelector('#go').disabled = true;
      try {
        const r = await rpc('pp_login', { p_nickname: name.value, p_pin: pin.value });
        write('petpals-online-last', r.nickname);
        loggedIn(r);
      } catch (e) { el.querySelector('#err').textContent = say(e); el.querySelector('#go').disabled = false; pin.value = ''; pin.focus(); }
    };
    el.querySelector('#go').onclick = go;
    pin.onkeydown = e => { if (e.key === 'Enter') go(); };
    el.querySelector('#back').onclick = () => showHome();
  }

  // Local players on this device (from before going online) whose pets can be brought along.
  function localPlayers() {
    const list = [];
    for (const a of read('petpals-accounts', [])) {
      const s = read(a.key, null);
      if (s && (s.pets || []).length) list.push({ key: a.key, name: (s.profile && s.profile.name) || a.name, level: s.level || 1, pets: s.pets.length });
    }
    if (!list.length) { const s = read('petpals-save-v2', null); if (s && (s.pets || []).length) list.push({ key: 'petpals-save-v2', name: (s.profile && s.profile.name) || 'My game', level: s.level || 1, pets: s.pets.length }); }
    return list;
  }

  function showJoin(err) {
    let pic = PICS[0];
    const locals = localPlayers();
    const el = card(`<h2 class="login-q">New player</h2>
      <label class="login-label">Secret club code 🔐</label><input id="jClub" class="login-in" maxlength="40" autocomplete="off" placeholder="Ask your friend">
      <label class="login-label">Your name (a nickname is best)</label><input id="jName" class="login-in" maxlength="16" autocomplete="off">
      <label class="login-label">Make a secret PIN (4 to 8 numbers)</label><input id="jPin" class="login-in" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">
      <input id="jPin2" class="login-in" type="password" inputmode="numeric" maxlength="8" placeholder="Type the PIN again" autocomplete="new-password">
      <label class="login-label">Pick a picture</label>
      <div class="login-pics">${PICS.map(id => `<button type="button" class="lpic ${id === pic ? 'on' : ''}" data-pic="${id}"><img src="${petImg(id)}" alt=""></button>`).join('')}</div>
      ${locals.length ? `<label class="login-label">Bring your pets from this device?</label>
        <select id="jBring" class="login-in"><option value="">No, start fresh with a new egg</option>
          ${locals.map(l => `<option value="${esc(l.key)}">Yes: ${esc(l.name)} (Lv ${l.level}, ${l.pets} pets)</option>`).join('')}</select>` : ''}
      <p class="code-err" id="err">${err ? esc(err) : ''}</p>
      <div class="login-row"><button class="btn ghost small" id="back" type="button">← Back</button><button class="btn" id="go" type="button">Join! 🎉</button></div>`);
    el.querySelectorAll('[data-pic]').forEach(b => b.onclick = () => { pic = b.dataset.pic; el.querySelectorAll('[data-pic]').forEach(x => x.classList.toggle('on', x === b)); });
    el.querySelector('#jClub').focus();
    el.querySelector('#back').onclick = () => showHome();
    el.querySelector('#go').onclick = async () => {
      const $ = s => el.querySelector(s);
      const errEl = $('#err');
      if ($('#jPin').value !== $('#jPin2').value) { errEl.textContent = "The two PINs don't match."; return; }
      let save = {};
      const bring = $('#jBring') && $('#jBring').value;
      if (bring) save = read(bring, {}) || {};
      save.profile = Object.assign({}, save.profile || {}, { name: $('#jName').value.trim(), avatar: (save.profile && save.profile.avatar) || pic });
      $('#go').disabled = true;
      try {
        const r = await rpc('pp_register', { p_club: $('#jClub').value.trim(), p_nickname: $('#jName').value, p_pin: $('#jPin').value, p_save: save });
        write('petpals-online-last', r.nickname);
        loggedIn(r);
      } catch (e) { errEl.textContent = say(e); $('#go').disabled = false; }
    };
  }

  async function start() {
    if (session && session.token) {
      card('<p class="login-note">☁️ Loading your pets...</p>');
      try {
        const r = await rpc('pp_load', { p_token: session.token });
        loggedIn(Object.assign(r, { token: session.token }));
      } catch (e) {
        if (e.code === 'network' && read(cacheKey(session.id), null)) {
          // No internet: play with the copy on this device; it uploads when the internet is back.
          startGame();
          setTimeout(() => window.toast && toast('📴 No internet. Playing offline, will save online later.'), 1500);
        } else { localStorage.removeItem(SESSION); session = null; showHome(e.code === 'network' ? MSG.network : 'Please log in again.'); }
      }
    } else showHome();
  }

  window.PPO = { rpc, say, start, logout, get session() { return session; }, sync };
})();

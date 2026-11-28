/* Pet Pals online Friends page: friend codes, friend requests, visiting, gifts and friends-only trading.
   Pets in a trade offer are held safely by the server until the friend answers (or you take the offer back). */
(function () {
  const P = window.PPO;
  if (!P) return;
  let social = null, loading = false;
  const tok = () => P.session.token;

  // Put a pet that arrived (from a trade or coming back home) into my game.
  function addPet(pet) {
    if (!pet || !SPECIES[pet.species]) return null;
    const p = Object.assign({ hunger: 80, thirst: 80, happiness: 90, energy: 90, stage: 0, pxp: 0 }, pet,
      { id: state.nextId++, sleeping: false });
    state.pets.push(p);
    if (!state.dex.includes(p.species)) state.dex.push(p.species);
    if (!state.activeId) state.activeId = p.id;
    return p;
  }
  function takePet(id) {
    const i = state.pets.findIndex(p => p.id === id);
    if (i < 0) return null;
    const [p] = state.pets.splice(i, 1);
    if (state.activeId === id) state.activeId = state.pets.length ? state.pets[0].id : null;
    if (state.profile && state.profile.fav === id) state.profile.fav = null;
    return p;
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      social = await P.rpc('pp_social', { p_token: tok() });
      await autoDeliveries();
    } catch (e) { if (e.code === 'not_logged_in') P.logout(true); }
    finally { loading = false; }
    if (window.updateHUD) updateHUD();
    if (currentTab === 'profile') window.renderFriends();
  }

  // Pets coming home or arriving from a trade are added straight away, with a little message.
  async function autoDeliveries() {
    const del = (social.mail || []).filter(m => m.kind === 'delivery');
    for (const m of del) {
      try {
        const r = await P.rpc('pp_claim', { p_token: tok(), p_mail: m.id });
        const pet = addPet(r.payload.pet);
        save();
        if (pet) {
          const why = r.payload.why === 'room_closed' ? `The trade room was closed, so <b>${esc(pet.name)}</b> came back home. 🏡`
            : r.payload.why === 'declined' ?`${esc(m.from ? m.from.nickname : 'Your friend')} said no to the trade, so <b>${esc(pet.name)}</b> came back home. 🏡`
            : `🎉 Trade done! <b>${esc(pet.name)}</b> the ${SPECIES[pet.species].name} from ${esc(m.from ? m.from.nickname : 'your friend')} is your pet now!`;
          openModal(`<h2>${r.payload.why === 'declined' || r.payload.why === 'room_closed' ?'🏡 Welcome home!' : '🎉 New pet!'}</h2><img src="${SPECIES[pet.species].img}" alt="" style="width:140px;height:140px;object-fit:contain"><p>${why}</p><button class="btn" data-close>Yay! 💖</button>`);
        }
      } catch (e) { /* already claimed on another device */ }
    }
    social.mail = (social.mail || []).filter(m => m.kind !== 'delivery');
  }

  window.friendsInbox = () => social ? (social.requests_in.length + social.mail.length) : 0;

  const petTile = (p, attr = '') => `<button class="av-pick" type="button" ${attr}><img src="${SPECIES[p.species] ? SPECIES[p.species].img : ''}" alt=""><small>${esc(p.name)}</small><small class="muted">${STAGES[p.stage] || ''}</small></button>`;
  const pic = c => `<span class="lp-pic small"><img src="${SPECIES[c.avatar] ? SPECIES[c.avatar].img : SPECIES.sprout.img}" alt=""></span>`;

  window.renderFriends = function () {
    const box = document.getElementById('friendsBox');
    if (!box) return;
    if (!social) { box.innerHTML = '<p class="muted">☁️ Loading friends...</p>'; refresh(); return; }
    const s = social;
    const mail = s.mail.filter(m => m.kind !== 'delivery');
    const inbox = [
      ...s.requests_in.map(r => `<div class="mail"><span class="mi">👋</span><div class="mt"><b>${esc(r.from.nickname)}</b> wants to be friends!</div>
          <button class="btn small green" data-acc="${r.id}">Yes!</button><button class="btn small ghost" data-rej="${r.id}">No</button></div>`),
      ...mail.map(m => m.kind === 'gift'
        ? `<div class="mail"><span class="mi">🎁</span><div class="mt"><b>${esc(m.from ? m.from.nickname : 'A friend')}</b> sent you a gift!</div><button class="btn small" data-open="${m.id}">Open</button></div>`
        : `<div class="mail"><span class="mi">🔁</span><div class="mt"><b>${esc(m.from ? m.from.nickname : 'A friend')}</b> wants to trade:<br>
            <span class="trade-line"><img src="${SPECIES[m.payload.give.species].img}" alt=""> ${esc(m.payload.give.name)} for your
            <img src="${SPECIES[m.payload.want.species] ? SPECIES[m.payload.want.species].img : ''}" alt=""> ${esc(m.payload.want.name)}</span></div>
            <button class="btn small green" data-yes="${m.id}">Trade!</button><button class="btn small ghost" data-no="${m.id}">No</button></div>`),
    ];
    box.innerHTML = `
      <div class="friend-code-box">Your friend code: <b class="fcode">${esc(s.me.friend_code)}</b>
        <small class="muted">Tell it to a friend so they can add you.</small></div>
      <div class="add-friend"><input id="fcIn" class="login-in" maxlength="8" placeholder="Friend's code" autocapitalize="characters" autocomplete="off"><button class="btn small" id="fcGo" type="button">➕ Add</button></div>
      <p class="code-err" id="fcErr"></p>
      <h3 class="psub">📬 Mailbox ${inbox.length ? `<span class="mail-count">${inbox.length}</span>` : ''} <button class="btn small ghost" id="refreshSocial" type="button" title="Check for new mail">🔄</button></h3>
      ${inbox.length ? inbox.join('') : '<p class="muted">No new mail.</p>'}
      ${s.offers_out.length ? `<h3 class="psub">⏳ Trades waiting for an answer</h3>${s.offers_out.map(o => `<div class="mail"><span class="mi">⏳</span><div class="mt">
          <span class="trade-line"><img src="${SPECIES[o.payload.give.species].img}" alt=""> ${esc(o.payload.give.name)} for ${esc(o.to.nickname)}'s
          <img src="${SPECIES[o.payload.want.species] ? SPECIES[o.payload.want.species].img : ''}" alt=""> ${esc(o.payload.want.name)}</span></div>
          <button class="btn small ghost" data-cancel="${o.id}">Take back</button></div>`).join('')}` : ''}
      <h3 class="psub">👫 Friends <span class="muted">${s.friends.length}</span></h3>
      ${s.friends.length ? `<div class="friend-list">${s.friends.map(f => `
        <div class="friend">${pic(f)}
          <div class="ft"><b>${esc(f.nickname)}</b><small class="muted">Lv ${f.level} · ${f.pets} pets</small></div>
          <button class="btn small ghost" data-visit="${f.id}" title="Visit">👀</button>
          <button class="btn small ghost" data-gift="${f.id}" title="Send a gift">🎁</button>
          <button class="btn small ghost" data-trade="${f.id}" title="Trade pets">🔁</button>
        </div>`).join('')}</div>` : '<p class="muted">No friends yet. Ask a friend for their friend code and add them above!</p>'}
      ${s.requests_out.length ? `<p class="muted">Waiting for: ${s.requests_out.map(r => esc(r.to.nickname)).join(', ')}</p>` : ''}`;

    const again = () => { social = null; refresh(); };
    const act = async (fn, args, ok) => { try { const r = await P.rpc(fn, Object.assign({ p_token: tok() }, args)); if (ok) ok(r); } catch (e) { toast(P.say(e)); } again(); };
    $('#refreshSocial').onclick = again;
    $('#fcGo').onclick = async () => {
      const code = $('#fcIn').value.trim();
      if (!code) return;
      try {
        const r = await P.rpc('pp_add_friend', { p_token: tok(), p_code: code });
        toast(r.status === 'friends' ? '🎉 You are friends now!' : r.status === 'already_friends' ? 'You are already friends!' : `👋 Friend request sent to ${r.to.nickname}!`);
        again();
      } catch (e) { $('#fcErr').textContent = P.say(e); }
    };
    box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => act('pp_answer_friend', { p_request: b.dataset.acc, p_accept: true }, () => toast('🎉 New friend!')));
    box.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => act('pp_answer_friend', { p_request: b.dataset.rej, p_accept: false }));
    box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => act('pp_claim', { p_mail: b.dataset.open }, r => {
      const g = r.payload; let what = '';
      if (g.coins) { state.coins += g.coins; what = `🪙 ${g.coins} coins`; }
      if (g.item) {
        const list = g.item.kind === 'food' ? FOODS : DRINKS, it = list.find(x => x.id === g.item.id);
        if (it) { state.inv[g.item.kind][it.id] = (state.inv[g.item.kind][it.id] || 0) + Math.min(5, g.item.n || 1); what = `${it.icon} ${it.name} x${g.item.n || 1}`; }
      }
      save(); updateHUD();
      openModal(`<h2>🎁 A gift!</h2><p><b>${esc(r.from ? r.from.nickname : 'A friend')}</b> sent you</p><p class="gift-big">${what}</p><button class="btn" data-close>Yay! 💖</button>`);
    }));
    box.querySelectorAll('[data-no]').forEach(b => b.onclick = () => act('pp_answer_trade', { p_mail: b.dataset.no, p_accept: false }, () => toast('Trade declined.')));
    box.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => acceptTrade(mail.find(m => m.id === b.dataset.yes)));
    box.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => act('pp_cancel_trade', { p_mail: b.dataset.cancel }, r => {
      const pet = addPet(r.pet); save(); if (pet) toast(`🏡 ${pet.name} came back home.`);
    }));
    box.querySelectorAll('[data-visit]').forEach(b => b.onclick = () => visit(b.dataset.visit));
    box.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => gift(s.friends.find(f => f.id === b.dataset.gift)));
    box.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => trade(s.friends.find(f => f.id === b.dataset.trade)));
  };

  async function acceptTrade(m) {
    const mine = state.pets.find(p => p.id === m.payload.want.id && p.species === m.payload.want.species);
    if (!mine) { toast(`You don't have ${m.payload.want.name} anymore, so you can't do this trade.`); return; }
    const pet = takePet(mine.id);
    save();
    try {
      const r = await P.rpc('pp_answer_trade', { p_token: tok(), p_mail: m.id, p_accept: true, p_my_pet: pet });
      const got = addPet(r.pet); save();
      openModal(`<h2>🎉 Trade done!</h2><img src="${SPECIES[got.species].img}" alt="" style="width:140px;height:140px;object-fit:contain">
        <p><b>${esc(got.name)}</b> the ${SPECIES[got.species].name} is your pet now!<br>${esc(pet.name)} went to live with ${esc(m.from ? m.from.nickname : 'your friend')}.</p>
        <button class="btn" data-close>Yay! 💖</button>`);
    } catch (e) { addPet(pet); save(); toast(P.say(e)); }
    social = null; refresh(); render();
  }

  async function visit(id) {
    try {
      const r = await P.rpc('pp_friend_pets', { p_token: tok(), p_friend: id });
      openModal(`<h2>${esc(r.card.nickname)}'s pets</h2><p class="muted">Level ${r.card.level} · ${r.pets.length} pets · Pet Book ${r.dex}/${Object.keys(SPECIES).length}</p>
        <div class="avatar-grid">${r.pets.filter(p => SPECIES[p.species]).map(p => petTile(p)).join('') || '<p>No pets yet!</p>'}</div>
        <button class="btn ghost small" data-close>Close</button>`);
    } catch (e) { toast(P.say(e)); }
  }

  function gift(f) {
    const items = [...FOODS.map(x => ['food', x]), ...DRINKS.map(x => ['drink', x])].filter(([k, x]) => state.inv[k][x.id] > 0);
    openModal(`<h2>🎁 Gift for ${esc(f.nickname)}</h2>
      <div class="gift-coins">${[10, 25, 50].map(c => `<button class="btn small" data-c="${c}" ${state.coins < c ? 'disabled' : ''}>🪙 ${c}</button>`).join('')}</div>
      ${items.length ? `<p class="muted">or a treat from your bag:</p><div class="avatar-grid">${items.map(([k, x]) => `<button class="av-pick" data-k="${k}" data-i="${x.id}"><span style="font-size:2rem">${x.icon}</span><small>${x.name} (${state.inv[k][x.id]})</small></button>`).join('')}</div>` : ''}
      <button class="btn ghost small" data-close>Close</button>`, box => {
      const send = async (g, undo) => {
        closeModal(); save();
        try { await P.rpc('pp_send_gift', { p_token: tok(), p_friend: f.id, p_gift: g }); toast(`🎁 Gift sent to ${f.nickname}!`); }
        catch (e) { undo(); save(); toast(P.say(e)); }
        render();
      };
      box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        const c = +b.dataset.c; if (state.coins < c) return;
        state.coins -= c; send({ coins: c }, () => { state.coins += c; });
      });
      box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k, i = b.dataset.i; if (!(state.inv[k][i] > 0)) return;
        state.inv[k][i]--; send({ item: { kind: k, id: i, n: 1 } }, () => { state.inv[k][i]++; });
      });
    });
  }

  async function trade(f) {
    if (window.PPO_chat && window.PPO_chat.ready()) return window.PPO_chat.tradeWith(f.id);   // live trade window (when chat is set up)
    if (state.pets.length < 2) { toast('Keep at least one pet at home! Hatch another egg before trading.'); return; }
    let theirs;
    try { theirs = (await P.rpc('pp_friend_pets', { p_token: tok(), p_friend: f.id })).pets.filter(p => SPECIES[p.species]); }
    catch (e) { toast(P.say(e)); return; }
    if (!theirs.length) { toast(`${f.nickname} has no pets to trade yet.`); return; }
    openModal(`<h2>🔁 Trade with ${esc(f.nickname)}</h2><p class="muted">1. Which of your pets will you give?</p>
      <div class="avatar-grid">${state.pets.map(p => petTile(p, `data-mine="${p.id}"`)).join('')}</div>
      <button class="btn ghost small" data-close>Cancel</button>`, box => {
      box.querySelectorAll('[data-mine]').forEach(b => b.onclick = () => {
        const mine = state.pets.find(p => p.id === +b.dataset.mine);
        closeModal();
        setTimeout(() => openModal(`<h2>🔁 Trade with ${esc(f.nickname)}</h2><p class="muted">2. Which of ${esc(f.nickname)}'s pets would you like?</p>
          <div class="avatar-grid">${theirs.map(p => petTile(p, `data-theirs="${p.id}"`)).join('')}</div>
          <button class="btn ghost small" data-close>Cancel</button>`, box2 => {
          box2.querySelectorAll('[data-theirs]').forEach(b2 => b2.onclick = async () => {
            const want = theirs.find(p => String(p.id) === b2.dataset.theirs);
            closeModal();
            const give = takePet(mine.id);          // held safely by the server until they answer
            save();
            try {
              await P.rpc('pp_offer_trade', { p_token: tok(), p_friend: f.id, p_give: give, p_want: { id: want.id, name: want.name, species: want.species } });
              toast(`🔁 Trade offer sent! ${give.name} waits safely until ${f.nickname} answers.`);
            } catch (e) { addPet(give); toast(P.say(e)); }
            save(); social = null; refresh(); render();
          });
        }), 50);
      });
    });
  }

  window.PPO_social = {
    addPet, takePet,
    refresh() { social = null; return refresh(); },
    friends: () => social ? social.friends : null,
    start() {
      refresh();
      setInterval(refresh, 45000);                   // check the mailbox now and then
    },
  };
})();

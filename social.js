/* Pet Pals - Friends (for players on this computer).
   Players can send friend requests, look at a friend's pets, send gifts (coins, snacks, drinks)
   and offer pet trades. Requests, gifts and trade offers wait in the other player's mailbox
   until they log in and open their profile. Shared data lives in localStorage under SOCIAL_KEY. */
(function () {
  const me = window.PETPALS_ACCOUNT;
  if (!me) return;                                   // sandbox / no login: no friends
  const NS = window.PETPALS_NS || 'petpals-';
  const SOCIAL_KEY = NS + 'social';
  const ACCOUNTS_KEY = NS + 'accounts';

  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const social = () => Object.assign({ friends: [], requests: [], mail: [] }, read(SOCIAL_KEY, {}));
  const accounts = () => read(ACCOUNTS_KEY, []);
  const acc = id => accounts().find(a => a.id === id);
  const saveOf = a => read(a.key, null);
  const isFriend = (s, id) => s.friends.some(f => f.includes(me.id) && f.includes(id));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Name, picture and level of another player, read from their own save.
  function card(a) {
    const s = saveOf(a);
    const pet = s && ((s.pets || []).find(p => p.id === s.activeId) || (s.pets || [])[0]);
    const av = (s && s.profile && s.profile.avatar) || (pet && pet.species) || a.avatar;
    return { id: a.id, name: (s && s.profile && s.profile.name) || a.name, avatar: SPECIES[av] ? av : 'sprout', level: (s && s.level) || 1, pets: (s && s.pets) || [], save: s };
  }
  const myMail = () => { const s = social(); return { req: s.requests.filter(r => r.to === me.id), mail: s.mail.filter(m => m.to === me.id) }; };
  window.friendsInbox = () => { const m = myMail(); return m.req.length + m.mail.length; };

  // Puts a pet into a save (gives it a fresh id there and adds it to that player's Pet Book).
  function addPetTo(st, pet) {
    const p = Object.assign({}, pet, { id: st.nextId++, sleeping: false });
    st.pets.push(p);
    if (!st.dex.includes(p.species)) st.dex.push(p.species);
    if (!st.activeId) st.activeId = p.id;
    return p;
  }
  function removePetFrom(st, petId) {
    const i = st.pets.findIndex(p => p.id === petId);
    if (i < 0) return null;
    const [p] = st.pets.splice(i, 1);
    if (st.activeId === petId) st.activeId = st.pets.length ? st.pets[0].id : null;
    if (st.profile && st.profile.fav === petId) st.profile.fav = null;
    return p;
  }

  const petTile = (p, attr = '') => `<button class="av-pick" type="button" ${attr}><img src="${SPECIES[p.species].img}" alt=""><small>${esc(p.name)}</small><small class="muted">${STAGES[p.stage]} · ${p.species && SPECIES[p.species].rarity}</small></button>`;

  window.renderFriends = function () {
    const box = document.getElementById('friendsBox');
    if (!box) return;
    const s = social();
    const others = accounts().filter(a => a.id !== me.id).map(card);
    const friends = others.filter(o => isFriend(s, o.id));
    const strangers = others.filter(o => !isFriend(s, o.id));
    const { req, mail } = myMail();
    const sentTo = new Set(s.requests.filter(r => r.from === me.id).map(r => r.to));
    const name = id => { const a = acc(id); return a ? card(a).name : 'Someone'; };

    const inbox = [
      ...req.map(r => `<div class="mail"><span class="mi">👋</span><div class="mt"><b>${esc(name(r.from))}</b> wants to be friends!</div>
          <button class="btn small green" data-acc-req="${r.id}">Yes!</button><button class="btn small ghost" data-no-req="${r.id}">No</button></div>`),
      ...mail.map(m => m.type === 'gift'
        ? `<div class="mail"><span class="mi">🎁</span><div class="mt"><b>${esc(name(m.from))}</b> sent you a gift!</div><button class="btn small" data-open="${m.id}">Open</button></div>`
        : `<div class="mail"><span class="mi">🔁</span><div class="mt"><b>${esc(name(m.from))}</b> wants to trade:<br>
            <span class="trade-line"><img src="${SPECIES[m.give.species].img}" alt=""> ${esc(m.give.name)} for your <img src="${SPECIES[(state.pets.find(p => p.id === m.want) || { species: 'sprout' }).species].img}" alt=""> ${esc((state.pets.find(p => p.id === m.want) || { name: '?' }).name)}</span></div>
            <button class="btn small green" data-yes-trade="${m.id}">Trade!</button><button class="btn small ghost" data-no-trade="${m.id}">No</button></div>`),
    ];

    box.innerHTML = `
      <h3 class="psub">📬 Mailbox ${inbox.length ? `<span class="mail-count">${inbox.length}</span>` : ''}</h3>
      ${inbox.length ? inbox.join('') : '<p class="muted">No new mail.</p>'}
      <h3 class="psub">👫 Friends <span class="muted">${friends.length}</span></h3>
      ${friends.length ? `<div class="friend-list">${friends.map(f => `
        <div class="friend">
          <span class="lp-pic small"><img src="${SPECIES[f.avatar].img}" alt=""></span>
          <div class="ft"><b>${esc(f.name)}</b><small class="muted">Lv ${f.level} · ${f.pets.length} pets</small></div>
          <button class="btn small ghost" data-visit="${f.id}" title="Visit">👀</button>
          <button class="btn small ghost" data-gift="${f.id}" title="Send a gift">🎁</button>
          <button class="btn small ghost" data-trade="${f.id}" title="Trade pets">🔁</button>
        </div>`).join('')}</div>` : '<p class="muted">No friends yet. Add a player below!</p>'}
      ${strangers.length ? `<h3 class="psub">➕ Add friends</h3><div class="friend-list">${strangers.map(f => `
        <div class="friend">
          <span class="lp-pic small"><img src="${SPECIES[f.avatar].img}" alt=""></span>
          <div class="ft"><b>${esc(f.name)}</b><small class="muted">Lv ${f.level}</small></div>
          ${sentTo.has(f.id) ? '<span class="muted">Asked ✓</span>' : `<button class="btn small" data-add="${f.id}">Add</button>`}
        </div>`).join('')}</div>`
        : !others.length ? '<p class="muted">Only you play on this computer. When someone else makes a player on the login screen, you can be friends!</p>' : ''}`;

    const reload = () => { save(); render(); };
    box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const s = social();
      // If they already asked me, adding them just makes us friends.
      const theirs = s.requests.find(r => r.from === b.dataset.add && r.to === me.id);
      if (theirs) { s.requests = s.requests.filter(r => r !== theirs); s.friends.push([me.id, b.dataset.add]); toast('🎉 You are friends now!'); }
      else { s.requests.push({ id: uid(), from: me.id, to: b.dataset.add }); toast('👋 Friend request sent!'); }
      write(SOCIAL_KEY, s); reload();
    });
    box.querySelectorAll('[data-acc-req]').forEach(b => b.onclick = () => {
      const s = social(); const r = s.requests.find(x => x.id === b.dataset.accReq);
      s.requests = s.requests.filter(x => x !== r);
      if (r && !isFriend(s, r.from)) s.friends.push([r.from, me.id]);
      write(SOCIAL_KEY, s); toast('🎉 New friend!'); reload();
    });
    box.querySelectorAll('[data-no-req]').forEach(b => b.onclick = () => {
      const s = social(); s.requests = s.requests.filter(x => x.id !== b.dataset.noReq); write(SOCIAL_KEY, s); reload();
    });
    box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      const s = social(); const m = s.mail.find(x => x.id === b.dataset.open);
      if (!m) return;
      s.mail = s.mail.filter(x => x !== m); write(SOCIAL_KEY, s);
      let what = '';
      if (m.coins) { state.coins += m.coins; what = `🪙 ${m.coins} coins`; }
      if (m.item) {
        state.inv[m.item.kind][m.item.id] = (state.inv[m.item.kind][m.item.id] || 0) + m.item.n;
        const it = (m.item.kind === 'food' ? FOODS : DRINKS).find(x => x.id === m.item.id);
        what = `${it ? it.icon + ' ' + it.name : 'a treat'} x${m.item.n}`;
      }
      openModal(`<h2>🎁 A gift!</h2><p><b>${esc(name(m.from))}</b> sent you</p><p class="gift-big">${what}</p><button class="btn" data-close>Yay! 💖</button>`);
      reload();
    });
    box.querySelectorAll('[data-no-trade]').forEach(b => b.onclick = () => {
      const s = social(); s.mail = s.mail.filter(x => x.id !== b.dataset.noTrade); write(SOCIAL_KEY, s); toast('Trade declined.'); reload();
    });
    box.querySelectorAll('[data-yes-trade]').forEach(b => b.onclick = () => acceptTrade(b.dataset.yesTrade));
    box.querySelectorAll('[data-visit]').forEach(b => b.onclick = () => visit(b.dataset.visit));
    box.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => gift(b.dataset.gift));
    box.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => trade(b.dataset.trade));
  };

  function visit(id) {
    const f = card(acc(id));
    openModal(`<h2>${esc(f.name)}'s pets</h2><p class="muted">Level ${f.level} · ${f.pets.length} pets · Pet Book ${(f.save && f.save.dex || []).length}/${Object.keys(SPECIES).length}</p>
      <div class="avatar-grid">${f.pets.map(p => petTile(p)).join('') || '<p>No pets yet!</p>'}</div>
      <button class="btn ghost small" data-close>Close</button>`);
  }

  function gift(id) {
    const f = card(acc(id));
    const items = [...FOODS.map(x => ['food', x]), ...DRINKS.map(x => ['drink', x])].filter(([k, x]) => state.inv[k][x.id] > 0);
    openModal(`<h2>🎁 Gift for ${esc(f.name)}</h2>
      <div class="gift-coins">${[10, 25, 50].map(c => `<button class="btn small" data-c="${c}" ${state.coins < c ? 'disabled' : ''}>🪙 ${c}</button>`).join('')}</div>
      ${items.length ? `<p class="muted">or a treat from your bag:</p><div class="avatar-grid">${items.map(([k, x]) => `<button class="av-pick" data-k="${k}" data-i="${x.id}"><span style="font-size:2rem">${x.icon}</span><small>${x.name} (${state.inv[k][x.id]})</small></button>`).join('')}</div>` : ''}
      <button class="btn ghost small" data-close>Close</button>`, box => {
      const send = m => { const s = social(); s.mail.push(Object.assign({ id: uid(), type: 'gift', from: me.id, to: id }, m)); write(SOCIAL_KEY, s); save(); closeModal(); toast(`🎁 Gift sent to ${f.name}!`); render(); };
      box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = +b.dataset.c; if (state.coins < c) return; state.coins -= c; send({ coins: c }); });
      box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k, i = b.dataset.i;
        if (!(state.inv[k][i] > 0)) return;
        state.inv[k][i]--; send({ item: { kind: k, id: i, n: 1 } });
      });
    });
  }

  function trade(id) {
    const f = card(acc(id));
    if (!state.pets.length || !f.pets.length) { toast('You both need a pet to trade!'); return; }
    const pickMine = () => openModal(`<h2>🔁 Trade with ${esc(f.name)}</h2><p class="muted">1. Which of your pets will you give?</p>
      <div class="avatar-grid">${state.pets.map(p => petTile(p, `data-mine="${p.id}"`)).join('')}</div>
      <button class="btn ghost small" data-close>Cancel</button>`, box => {
      box.querySelectorAll('[data-mine]').forEach(b => b.onclick = () => { const mine = state.pets.find(p => p.id === +b.dataset.mine); closeModal(); setTimeout(() => pickTheirs(mine), 50); });
    });
    const pickTheirs = mine => openModal(`<h2>🔁 Trade with ${esc(f.name)}</h2><p class="muted">2. Which of ${esc(f.name)}'s pets would you like?</p>
      <div class="avatar-grid">${f.pets.map(p => petTile(p, `data-theirs="${p.id}"`)).join('')}</div>
      <button class="btn ghost small" data-close>Cancel</button>`, box => {
      box.querySelectorAll('[data-theirs]').forEach(b => b.onclick = () => {
        const want = +b.dataset.theirs;
        const s = social();
        s.mail.push({ id: uid(), type: 'trade', from: me.id, to: id, give: { id: mine.id, name: mine.name, species: mine.species }, want });
        write(SOCIAL_KEY, s); closeModal();
        toast(`🔁 Trade offer sent to ${f.name}! They'll see it in their mailbox.`);
      });
    });
    pickMine();
  }

  function acceptTrade(mailId) {
    const s = social(); const m = s.mail.find(x => x.id === mailId);
    if (!m) return;
    s.mail = s.mail.filter(x => x !== m); write(SOCIAL_KEY, s);
    const other = acc(m.from); const theirSave = other && saveOf(other);
    const theirPet = theirSave && theirSave.pets.find(p => p.id === m.give.id);
    const myPet = state.pets.find(p => p.id === m.want);
    if (!theirPet || !myPet) { toast('That trade can\'t happen anymore: one of the pets has moved.'); save(); render(); return; }
    // Swap: their pet comes to me, my pet goes to them.
    removePetFrom(theirSave, theirPet.id);
    addPetTo(theirSave, myPet);
    write(other.key, theirSave);
    removePetFrom(state, myPet.id);
    const got = addPetTo(state, theirPet);
    save();
    openModal(`<h2>🎉 Trade done!</h2><img src="${SPECIES[got.species].img}" alt="" style="width:140px;height:140px;object-fit:contain">
      <p><b>${esc(got.name)}</b> the ${SPECIES[got.species].name} is your pet now!<br>${esc(myPet.name)} went to live with ${esc(card(other).name)}.</p>
      <button class="btn" data-close>Yay! 💖</button>`);
    render();
  }
})();

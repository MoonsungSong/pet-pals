/* Pet Pals online: friends-only chat + live trade rooms that friends can watch.
   Pets put into a trade room are held safely by the server until the trade is done or the room closes. */
(function () {
  const P = window.PPO, S = window.PPO_social;
  if (!P || !S || document.getElementById('chatBtn')) return;
  const tok = () => P.session.token;
  const CHEERS = ['😀', '😂', '😍', '👍', '🎉', '🐾', '💖', '😮', '🙏', '🔥'];
  let msgs = [], rooms = [], lastId = 0, seenId = 0, isOpen = false, roomId = null, room = null, polling = false;
  let doneShown = {}, asked = {};

  // 💬 button in the top bar, with a dot when friends wrote something new.
  const btn = document.createElement('button');
  btn.id = 'chatBtn'; btn.type = 'button'; btn.className = 'chat-btn';
  btn.setAttribute('aria-label', 'Friends chat');
  btn.innerHTML = '💬<i class="chat-dot"></i>';
  btn.hidden = true;                                   // shown once the server says chat is set up
  document.getElementById('coins').before(btn);

  const panel = document.createElement('div');
  panel.id = 'chatPanel'; panel.className = 'chat-panel'; panel.hidden = true;
  panel.innerHTML = `
    <div class="chat-head"><b>💬 Friends Chat</b><button type="button" class="chat-x" id="chatClose" aria-label="Close chat">✕</button></div>
    <div id="chatTop"></div>
    <div class="chat-msgs" id="chatMsgs"></div>
    <div class="chat-cheers">${CHEERS.map(c => `<button type="button" data-cheer="${c}">${c}</button>`).join('')}</div>
    <form class="chat-form" id="chatForm" autocomplete="off">
      <input id="chatIn" maxlength="120" placeholder="Say something nice to your friends…" enterkeyhint="send">
      <button class="btn small" type="submit">Send</button>
    </form>
    <p class="chat-rule">Only your friends can see this chat. Be kind! 💖 Never share your PIN, address or phone number.</p>`;
  document.getElementById('screen').parentElement.appendChild(panel);
  const $c = sel => panel.querySelector(sel);

  btn.onclick = () => (isOpen ? close() : openChat());
  $c('#chatClose').onclick = close;
  $c('#chatForm').onsubmit = e => { e.preventDefault(); send($c('#chatIn').value); };
  panel.querySelectorAll('[data-cheer]').forEach(b => b.onclick = () => send(b.dataset.cheer));

  function openChat(tradeId) {
    isOpen = true; panel.hidden = false; btn.classList.add('active');
    if (tradeId) roomId = tradeId;
    drawTop(); drawMsgs(true);
    poll();
  }
  function close() {
    isOpen = false; panel.hidden = true; btn.classList.remove('active');
    roomId = null; room = null;
  }

  async function send(text) {
    text = (text || '').trim();
    if (!text) return;
    $c('#chatIn').value = '';
    try { await P.rpc('pp_say', { p_token: tok(), p_text: text }); }
    catch (e) { toast(P.say(e)); $c('#chatIn').value = text; }
    poll();
  }

  // Ask the server for new messages (and the trade room I'm watching).
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const r = await P.rpc('pp_chat', { p_token: tok(), p_after: lastId });
      btn.hidden = false;
      rooms = r.rooms || [];
      if (r.msgs && r.msgs.length) {
        msgs = msgs.concat(r.msgs).slice(-120);
        lastId = msgs[msgs.length - 1].id;
        if (!seenId) seenId = lastId;                 // the first load doesn't count as new
        if (isOpen) drawMsgs();
      }
      if (isOpen && roomId) {
        try { room = await P.rpc('pp_trade_view', { p_token: tok(), p_trade: roomId }); }
        catch (e) { room = null; roomId = null; toast(P.say(e)); }
        if (room && room.status !== 'open' && room.me !== 'watch' && !doneShown[room.id]) {
          doneShown[room.id] = true;
          S.refresh();                                 // pick up my new pets (or pets coming home) straight away
        }
      }
      // A friend sent me a trade request: pop it up (once).
      const req = rooms.find(x => x.me === 'b' && !x.joined && !asked[x.id]);
      if (req && !document.querySelector('#modal:not(.hidden)')) {
        asked[req.id] = true;
        openModal(`<h2>🔁 Trade request!</h2>${pic(req.a)}<p><b>${esc(req.a.nickname)}</b> wants to trade with you!</p>
          <button class="btn green" id="reqYes">Let's trade!</button> <button class="btn ghost" id="reqNo">No thanks</button>`, box => {
          box.querySelector('#reqYes').onclick = async () => {
            closeModal();
            try { room = await P.rpc('pp_trade_answer', { p_token: tok(), p_trade: req.id, p_yes: true }); roomId = req.id; openChat(req.id); }
            catch (e) { toast(P.say(e)); }
          };
          box.querySelector('#reqNo').onclick = async () => {
            closeModal();
            try { await P.rpc('pp_trade_answer', { p_token: tok(), p_trade: req.id, p_yes: false }); } catch (e) { /* already gone */ }
            S.refresh();
          };
        });
      }
      if (isOpen) { seenId = lastId; drawTop(); }
    } catch (e) { if (e.code === 'not_logged_in') P.logout(true); }
    finally { polling = false; }
    btn.classList.toggle('has-new', !isOpen && msgs.some(m => m.id > seenId && !m.mine));
  }
  // Every 2.5 seconds while the chat is open; every 15 seconds when it's closed (to light up the 💬 dot).
  let tick = 0;
  setInterval(() => { tick++; if (isOpen || (tick % 6 === 0 && document.visibilityState === 'visible')) poll(); }, 2500);

  const pic = c => `<img class="chat-av" src="${c && SPECIES[c.avatar] ? SPECIES[c.avatar].img : SPECIES.sprout.img}" alt="">`;
  const petPic = p => p && SPECIES[p.species] ? `<img src="${SPECIES[p.species].img}" alt="">` : '';
  const time = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function drawMsgs(jump) {
    const box = $c('#chatMsgs');
    const atBottom = jump || box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = msgs.length ? msgs.map(m => {
      const who = esc(m.from ? m.from.nickname : 'Someone');
      if (m.kind === 'trade') {
        const live = rooms.some(r => r.id === m.trade_id);
        const text = m.body === 'done' ? `🎉 <b>${who}</b>'s trade is done!` : `🔁 <b>${who}</b> opened a live trade with <b>${esc(m.body)}</b>!`;
        return `<div class="chat-event">${text} ${live ? `<button type="button" class="btn small" data-watch="${m.trade_id}">👀 Watch</button>` : ''}<small>${time(m.created_at)}</small></div>`;
      }
      return `<div class="chat-msg ${m.mine ? 'mine' : ''}">${m.mine ? '' : pic(m.from)}<div class="chat-bubble">${m.mine ? '' : `<b>${who}</b>`}<span>${esc(m.body)}</span><small>${time(m.created_at)}</small></div></div>`;
    }).join('') : '<p class="muted chat-empty">No messages yet. Say hi to your friends! 👋</p>';
    box.querySelectorAll('[data-watch]').forEach(b => b.onclick = () => { roomId = b.dataset.watch; room = null; drawTop(); poll(); });
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  // The top of the chat: the trade room I'm in/watching, or the list of live trades.
  function drawTop() {
    const top = $c('#chatTop');
    if (roomId) { top.innerHTML = room ? roomHTML(room) : '<div class="troom"><p class="muted">Opening the trade room…</p></div>'; if (room) wireRoom(top, room); return; }
    top.innerHTML = `<div class="chat-rooms">
      ${rooms.map(r => `<button type="button" class="room-pill" data-room="${r.id}">${r.joined ? '🔴 LIVE' : '⏳'} ${esc(r.a.nickname)} ⇄ ${esc(r.b.nickname)} <b>${r.me === 'watch' ? '👀 Watch' : '➡️ Go'}</b></button>`).join('')}
      <button type="button" class="btn small" id="newTrade">🔁 Send a trade request</button></div>`;
    top.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { roomId = b.dataset.room; room = null; drawTop(); poll(); });
    $c('#newTrade').onclick = pickFriend;
  }

  // One side of the trade window: 4 slots. On my side, tap a pet to take it out, or tap ➕ to add one.
  function side(r, k) {
    const card = r[k], pets = r[k + '_pets'] || [], mine = r.me === k, open = r.status === 'open';
    const ok = r[k + '_ok'], conf = r[k + '_conf'];
    const slots = [0, 1, 2, 3].map(i => {
      const p = pets[i];
      if (p) return `<button type="button" class="tslot full" ${mine && open ? `data-rm="${i}" title="Take out"` : 'disabled'}>${petPic(p)}<small>${esc(p.name)}</small>${mine && open ? '<i class="tslot-x">✕</i>' : ''}</button>`;
      return `<button type="button" class="tslot" ${mine && open && i === pets.length ? 'data-add="1" title="Add a pet"' : 'disabled'}>${mine && open && i === pets.length ? '➕' : ''}</button>`;
    }).join('');
    return `<div class="tside ${ok ? 'ok' : ''} ${conf ? 'conf' : ''} ${mine ? 'mine' : ''}">
      <div class="tname">${pic(card)} ${esc(card.nickname)}${mine ? ' <small>(you)</small>' : ''}</div>
      <div class="tslots">${slots}</div>
      <div class="tready">${conf ? '🔒 Confirmed!' : ok ? '✅ Accepted' : '⏳ Choosing…'}</div>
    </div>`;
  }
  function roomHTML(r) {
    const mine = r.me !== 'watch', open = r.status === 'open';
    const both = r.a_ok && r.b_ok;
    const head = r.status === 'done' ? '🎉 TRADE DONE! 🎉' : r.status === 'cancelled' ? '🚪 This trade was closed.'
      : !r.joined ? `⏳ Waiting for ${esc(r.b.nickname)} to say yes…` : mine ? (both ? '🔒 Step 2: Confirm!' : '🔁 Step 1: Add pets, then Accept') : '🔴 LIVE · 👀 You are watching';
    let btns = '';
    if (mine && open && r.joined) {
      const myOk = r[r.me + '_ok'], myConf = r[r.me + '_conf'];
      btns = both
        ? `<button type="button" class="btn ${myConf ? 'ghost' : 'green'}" id="tConf" ${myConf ? 'disabled' : ''}>${myConf ? `⏳ Waiting for ${esc(r[r.me === 'a' ? 'b' : 'a'].nickname)}…` : '🔒 Confirm trade'}</button>
           <button type="button" class="btn small ghost" id="tOk">✋ Wait!</button>`
        : `<button type="button" class="btn ${myOk ? 'ghost' : 'green'}" id="tOk" ${!myOk && r.wait > 0 ? 'disabled' : ''}>${myOk ? '✋ Un-accept' : r.wait > 0 ? `⏳ ${Math.ceil(r.wait)}…` : '✅ Accept'}</button>`;
    }
    return `<div class="troom ${r.status}">
      <div class="troom-head"><button type="button" class="btn small ghost" id="roomBack">⬅️</button><b>${head}</b></div>
      <div class="tsides">${side(r, 'a')}<div class="tswap">⇄</div>${side(r, 'b')}</div>
      ${mine && open ? `<div class="troom-btns">${btns}<button type="button" class="btn small ghost" id="tClose">🚪 ${r.joined ? 'Close' : 'Cancel request'}</button></div>
        <p class="muted tnote">${both ? 'Look carefully! When you <b>both</b> confirm, the pets swap.' : 'Put in up to 4 pets each. When someone changes a pet, everyone has to accept again.'}</p>`
        : open ? '<p class="muted tnote">Cheer them on in the chat below! 📣</p>' : ''}
    </div>`;
  }
  function wireRoom(top, r) {
    top.querySelector('#roomBack').onclick = () => { roomId = null; room = null; drawTop(); };
    const call = async (fn, args) => {
      try { const x = await P.rpc(fn, Object.assign({ p_token: tok(), p_trade: r.id }, args || {})); room = x.room || x; }
      catch (e) { toast(P.say(e)); }
      drawTop(); poll();
    };
    top.querySelectorAll('[data-add]').forEach(b => b.onclick = () => choosePet(r));
    top.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => takeOut(r, +b.dataset.rm));
    const ok = top.querySelector('#tOk'), conf = top.querySelector('#tConf'), cl = top.querySelector('#tClose');
    if (ok) ok.onclick = () => call('pp_trade_ok', { p_ok: (r.a_ok && r.b_ok) ? false : !r[r.me + '_ok'] });
    if (conf) conf.onclick = () => call('pp_trade_confirm');
    if (cl) cl.onclick = () => openModal(`<h2>Close the trade?</h2><p>Any pets in the trade go back home.</p>
      <button class="btn" id="clYes">Yes, close it</button> <button class="btn ghost" data-close>No</button>`, box => {
      box.querySelector('#clYes').onclick = async () => {
        closeModal();
        try { room = await P.rpc('pp_trade_cancel', { p_token: tok(), p_trade: r.id }); } catch (e) { toast(P.say(e)); }
        doneShown[r.id] = true; S.refresh(); drawTop();
      };
    });
  }

  function choosePet(r) {
    if (state.pets.length < 2) { toast('Keep at least one pet at home! Hatch another egg to trade more.'); return; }
    openModal(`<h2>Add a pet to the trade</h2>
      <div class="avatar-grid">${state.pets.map(p => `<button class="av-pick" type="button" data-pp="${p.id}"><img src="${SPECIES[p.species].img}" alt=""><small>${esc(p.name)}</small><small class="muted">${STAGES[p.stage]}</small></button>`).join('')}</div>
      <button class="btn ghost small" data-close>Cancel</button>`, box => {
      box.querySelectorAll('[data-pp]').forEach(b => b.onclick = async () => {
        closeModal();
        // The server takes the pet out of my saved game and holds it in the trade (no copies!).
        try { room = (await P.serverOp('pp_trade_add', { p_trade: r.id, p_pet_id: +b.dataset.pp })).room; }
        catch (e) { toast(P.say(e)); }
        drawTop();
      });
    });
  }
  async function takeOut(r, i) {
    try {
      const x = await P.serverOp('pp_trade_remove', { p_trade: r.id, p_index: i });   // the server puts it back in my game
      if (x.back) toast(`🏡 ${x.back.name} came back home.`);
      room = x.room;
    } catch (e) { toast(P.say(e)); }
    drawTop();
  }

  async function tradeWith(friendId) {
    try { room = await P.rpc('pp_trade_open', { p_token: tok(), p_friend: friendId }); roomId = room.id; }
    catch (e) { toast(P.say(e)); return; }
    if (room.me === 'a' && !room.joined) toast('🔁 Trade request sent! Waiting for your friend to say yes.');
    openChat(roomId);
  }
  async function pickFriend() {
    let friends = S.friends();
    if (!friends) { await S.refresh(); friends = S.friends() || []; }
    if (!friends.length) { toast('Add a friend first! Go to your profile and type their friend code.'); return; }
    openModal(`<h2>🔁 Trade with who?</h2><div class="friend-list">${friends.map(f => `<button type="button" class="friend pick" data-f="${f.id}">${pic(f)}<div class="ft"><b>${esc(f.nickname)}</b><small class="muted">Lv ${f.level} · ${f.pets} pets</small></div></button>`).join('')}</div>
      <button class="btn ghost small" data-close>Cancel</button>`, box => {
      box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { closeModal(); tradeWith(b.dataset.f); });
    });
  }

  window.PPO_chat = { open: openChat, tradeWith, ready: () => !btn.hidden };
  poll();
})();

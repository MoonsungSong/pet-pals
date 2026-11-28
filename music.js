// Pet Pals music: an original tune played live by the browser (no sound files).
// PetMusic.play('home' | 'job' | 'sleep'), PetMusic.stop()
(function () {
  let ctx, master, timer, mode = null, step = 0, nextT = 0;
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  // 8 bars x 8 eighth-notes. 0 = rest.
  const MEL = [
    72,76,79,84,0,79,76,79,  81,0,84,0,81,79,76,0,
    77,81,84,0,86,0,84,81,   83,0,79,0,74,0,79,83,
    84,0,79,76,84,0,88,0,    86,84,81,0,76,79,81,0,
    77,0,81,0,79,77,76,74,   79,0,83,0,86,0,0,0];
  const CHORDS = [[48,60,64,67],[45,60,64,69],[41,60,65,69],[43,62,67,71],
                  [48,60,64,67],[45,60,64,69],[50,62,65,69],[43,62,67,71]];
  // Sleepy lullaby: slow, soft, no drums.
  const LUL = [
    76,0,0,0,79,0,0,0,   77,0,0,0,81,0,0,0,
    76,0,74,0,72,0,0,0,  74,0,0,0,79,0,0,0,
    72,0,76,0,81,0,0,0,  77,0,76,0,74,0,0,0,
    74,0,0,0,71,0,0,0,   72,0,0,0,0,0,0,0];
  const LUL_CHORDS = [[48,60,64,67],[41,60,65,69],[48,60,64,67],[43,62,67,71],
                      [45,60,64,69],[41,60,65,69],[43,62,67,71],[48,60,64,67]];
  const TEMPO = { home: 116, job: 144, sleep: 66 };
  const UP = 2; // play it in D: a little brighter

  function tone(t, freq, type, vol, len, partial) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
    if (partial) tone(t, freq * partial, 'sine', vol * 0.18, len * 0.35);
  }
  const musicBox = (t, m) => tone(t, f(m + UP), 'sine', 0.3, 0.7, 4);
  const marimba = (t, m) => tone(t, f(m + UP), 'sine', 0.15, 0.22, 3.9);
  const bass = (t, m) => tone(t, f(m + UP), 'triangle', 0.38, 0.22);
  function shaker(t) {
    const n = ctx.createBufferSource(), b = ctx.createBuffer(1, 2205, 44100), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    n.buffer = b; n.connect(hp); hp.connect(g); g.connect(master); n.start(t);
  }

  function schedule() {
    const eighth = 30 / TEMPO[mode];
    while (nextT < ctx.currentTime + 0.15) {
      if (mode === 'sleep') {
        const ch = LUL_CHORDS[Math.floor(step / 8) % 8], e = step % 8, m = LUL[step % 64];
        if (m) tone(nextT, f(m + UP), 'sine', 0.2, 2.2, 4);
        if (e === 0) tone(nextT, f(ch[0] + UP), 'sine', 0.22, 3);
        if (e % 2 === 0 && e) tone(nextT, f(ch[e / 2] + UP), 'sine', 0.07, 1.4);
        nextT += eighth; step++; continue;
      }
      const bar = Math.floor(step / 8) % 8, e = step % 8, ch = CHORDS[bar], m = MEL[step % 64];
      if (m) musicBox(nextT, m);
      // bouncy "oom-pah": low note, chord, high note, chord
      if (e === 0) bass(nextT, ch[0]);
      if (e === 4) bass(nextT, ch[0] + 7);
      if (e === 7) bass(nextT, ch[0] + 12);
      if (e === 2 || e === 6) ch.slice(1).forEach((c, i) => marimba(nextT + i * 0.015, c));
      if (e === 2 || e === 6 || mode === 'job') shaker(nextT);
      if (mode === 'job' && (e === 3 || e === 7)) marimba(nextT, ch[3] + 12);
      nextT += eighth; step++;
    }
  }

  window.PetMusic = {
    play(m) {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
      }
      ctx.resume();
      if (mode === m) return;
      mode = m; step = 0; nextT = ctx.currentTime + 0.05;
      clearInterval(timer); timer = setInterval(schedule, 25); schedule();
    },
    stop() { clearInterval(timer); mode = null; },
    get playing() { return mode; }
  };
})();

// 🔊 button in the top bar. Music starts on the first tap (browsers need a tap first).
// Home tune normally, faster job tune while a job or minigame is running, lullaby while your pet sleeps.
(function () {
  const coins = document.getElementById('coins');
  if (!coins) return;
  let on = true;
  try { on = localStorage.getItem('petpals-music') !== 'off'; } catch (e) {}
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'chat-btn music-btn';
  const draw = () => { btn.textContent = on ? '🔊' : '🔇'; btn.setAttribute('aria-label', on ? 'Music on. Tap to turn off' : 'Music off. Tap to turn on'); };
  draw();
  coins.parentNode.insertBefore(btn, coins);
  let tapped = false;
  const want = () => { try { if (typeof activeGame !== 'undefined' && activeGame) return 'job'; const p = typeof activePet === 'function' && activePet(); return p && p.sleeping ? 'sleep' : 'home'; } catch (e) { return 'home'; } };
  const update = () => { if (!tapped) return; if (on) { if (PetMusic.playing !== want()) PetMusic.play(want()); } else if (PetMusic.playing) PetMusic.stop(); };
  btn.onclick = () => { on = !on; try { localStorage.setItem('petpals-music', on ? 'on' : 'off'); } catch (e) {} draw(); tapped = true; update(); };
  document.addEventListener('pointerdown', () => { if (!tapped) { tapped = true; update(); } }, true);
  setInterval(update, 400);
  document.addEventListener('visibilitychange', () => { if (document.hidden) PetMusic.stop(); else update(); });
})();

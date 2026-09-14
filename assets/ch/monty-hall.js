/* Chapter 17: The three doors. Monty Hall by hand and by the thousand, the hundred-door version, and the guessing host. */
(function(){
'use strict';
const { $, $$, wait, earn, seg, fmtNum } = WM;

/* PURE:BEGIN
   No DOM, no WM in here. scripts can slice this block out and unit-test it with node. */
const ri = n => Math.floor(Math.random() * n);
/* Which of the two doors the reader did not pick does the host open?
   A knowing host opens a goat (choosing at random if both are goats). A guessing host opens either door at random. */
function hostOpens(pick, prize, knows){
  const others = [0, 1, 2].filter(d => d !== pick);
  if (knows){ const goats = others.filter(d => d !== prize); return goats[ri(goats.length)]; }
  return others[ri(others.length)];
}
/* One three-door round: 'win', 'lose', or 'spoiled' (the host opened the bicycle, so the reader never got the choice). */
function playRound(knows, strategy){
  const prize = ri(3), pick = ri(3);
  const open = hostOpens(pick, prize, knows);
  if (open === prize) return 'spoiled';
  const final = strategy === 'stay' ? pick : 3 - pick - open;
  return final === prize ? 'win' : 'lose';
}
/* n doors, knowing host opens every goat door except one. Returns the one other door the host leaves closed. */
function hostLeaves(n, pick, prize){
  if (pick !== prize) return prize;
  let d = ri(n - 1); if (d >= pick) d++;
  return d;
}
function playBig(n, strategy){
  const prize = ri(n), pick = ri(n);
  const other = hostLeaves(n, pick, prize);
  return (strategy === 'stay' ? pick : other) === prize ? 'win' : 'lose';
}
/* PURE:END */

const chapter = { guessRounds: 0, quizRight: false, quizMissed: false };
const pct = (w, n) => n ? Math.round(1000 * w / n) / 10 : 0;
const newTally = () => ({ stay: { w: 0, n: 0 }, sw: { w: 0, n: 0 }, spoiled: 0 });

/* ---------- pictures: a door, a goat, a bicycle (SVG, theme colors) ---------- */
function goatSVG(){
  return `<g fill="var(--ink-soft)" stroke="var(--ink-soft)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="45" cy="101" rx="24" ry="14" stroke="none"/>
    <rect x="27" y="109" width="6" height="24" rx="2" stroke="none"/><rect x="37" y="111" width="6" height="22" rx="2" stroke="none"/>
    <rect x="50" y="111" width="6" height="22" rx="2" stroke="none"/><rect x="60" y="109" width="6" height="24" rx="2" stroke="none"/>
    <polygon points="22,96 11,89 16,101" stroke="none"/>
    <path d="M60,92 Q66,72 76,74 Q87,76 87,87 L87,93 Q87,101 79,101 L69,101 Z" stroke="none"/>
    <path d="M70,75 q-4,-9 2,-15" fill="none"/><path d="M78,74 q1,-10 8,-13" fill="none"/>
    <path d="M65,81 l-9,-3" fill="none" stroke-width="4"/>
    <polygon points="83,100 81,110 88,103" stroke="none"/>
    <circle cx="80" cy="83" r="2.2" fill="var(--paper)" stroke="none"/></g>`;
}
function bikeSVG(){
  return `<g fill="none" stroke="var(--win)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="30" cy="112" r="15"/><circle cx="72" cy="112" r="15"/>
    <polyline points="30,112 45,84 64,84 72,112"/><polyline points="30,112 53,112 45,84"/><line x1="53" y1="112" x2="64" y2="84"/>
    <line x1="38" y1="80" x2="50" y2="80" stroke-width="5"/><line x1="60" y1="78" x2="73" y2="82"/>
    <circle cx="53" cy="112" r="3" fill="var(--win)"/></g>`;
}
function doorSVG(num, state){
  const frame = `<rect x="4" y="4" width="92" height="142" rx="8" fill="var(--surface-2)" stroke="var(--line)" stroke-width="4"/>`;
  if (state === 'closed'){
    return `<svg viewBox="0 0 100 150" role="img" aria-label="Door ${num}, closed">${frame}
      <rect x="16" y="16" width="68" height="118" rx="4" fill="var(--surface)" stroke="var(--line)" stroke-width="3"/>
      <rect x="23" y="70" width="46" height="54" rx="3" fill="none" stroke="var(--line)" stroke-width="2"/>
      <circle cx="77" cy="80" r="4.5" fill="var(--math)" stroke="var(--line)" stroke-width="2"/>
      <text x="50" y="52" text-anchor="middle" font-size="30" font-weight="700" fill="var(--ink)">${num}</text></svg>`;
  }
  const inside = state === 'prize' ? bikeSVG() : goatSVG();
  return `<svg viewBox="0 0 100 150" role="img" aria-label="Door ${num}, open: ${state === 'prize' ? 'the bicycle' : 'a goat'}">${frame}
    <rect x="12" y="12" width="76" height="126" rx="4" fill="var(--paper)" stroke="var(--line)" stroke-width="3"/>
    ${inside}
    <polygon points="12,12 26,22 26,142 12,138" fill="var(--surface)" stroke="var(--line)" stroke-width="3" stroke-linejoin="round"/>
    <text x="58" y="34" text-anchor="middle" font-size="18" font-weight="700" fill="var(--ink-soft)">${num}</text></svg>`;
}
const miniGoat = `<svg viewBox="8 66 84 72" aria-hidden="true">${goatSVG()}</svg>`;
const miniBike = `<svg viewBox="8 66 84 72" aria-hidden="true">${bikeSVG()}</svg>`;

/* ---------- tallies (shared by all three boards) ---------- */
function tallyHTML(t, showSpoiled){
  const row = (lab, x) => `<div class="mh-trow"><div class="mh-th"><span class="mh-lab">${lab}</span><span class="mh-num">${x.n ? `${fmtNum(x.w)} of ${fmtNum(x.n)} won, ${pct(x.w, x.n)}%` : 'no rounds yet'}</span></div><div class="bar you"><i style="width:${x.n ? 100 * x.w / x.n : 0}%"></i></div></div>`;
  let h = row('Stayed', t.stay) + row('Switched', t.sw);
  if (showSpoiled){
    const all = t.stay.n + t.sw.n + t.spoiled;
    h += `<div class="mh-trow spoiled"><div class="mh-th"><span class="mh-lab">Spoiled</span><span class="mh-num">${all ? `${fmtNum(t.spoiled)} of ${fmtNum(all)} rounds, ${pct(t.spoiled, all)}%: Robo opened the bicycle by accident` : 'no rounds yet'}</span></div><div class="bar"><i style="width:${all ? 100 * t.spoiled / all : 0}%"></i></div></div>`;
  }
  return h;
}
/* Play N rounds fast, in animated chunks. play(strategy) returns 'win' | 'lose' | 'spoiled'.
   s must carry { id, running, t }; the caller bumps s.id and handles the resting state. */
async function runAuto(s, strategy, play, N, onStep){
  const id = s.id, chunks = 25, per = N / chunks, t = strategy === 'stay' ? s.t.stay : s.t.sw;
  let w = 0, n = 0, sp = 0;
  for (let c = 0; c < chunks; c++){
    for (let i = 0; i < per; i++){
      const r = play(strategy);
      if (r === 'spoiled'){ sp++; s.t.spoiled++; } else { n++; t.n++; if (r === 'win'){ w++; t.w++; } }
    }
    onStep((c + 1) * per);
    await wait(30);
    if (id !== s.id) return null;
  }
  return { w, n, sp };
}

/* ================= the three-door simulator (two instances) ================= */
function makeSim(rootId, cfg){
  const R = $('#' + rootId);
  const q = r => R.querySelector(`[data-r="${r}"]`);
  const s = { mode: cfg.mode, phase: 'pick', pick: -1, prize: -1, open: -1, final: -1, id: 0, busy: false, running: false, t: newTally(), log: [], pred: null, round: 0 };
  const knows = () => s.mode === 'knows';
  const other = () => 3 - s.pick - s.open;
  const status = html => { q('status').innerHTML = html; };
  const showSpoiled = () => !knows() || s.t.spoiled > 0;
  const canAuto = () => !s.running && !s.busy && (!cfg.predict || s.pred !== null);

  function renderDoors(){
    const host = q('doors'); host.innerHTML = '';
    for (let d = 0; d < 3; d++){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mh-door';
      const done = s.phase === 'done' || s.phase === 'spoiled';
      let state = 'closed';
      if (done || d === s.open) state = d === s.prize ? 'prize' : 'goat';
      let tag = '';
      if (d === s.pick){ b.classList.add('picked'); tag = 'your pick'; }
      if (d === s.open){ b.classList.add('robo'); tag = s.phase === 'spoiled' ? 'Robo opened: oops' : 'Robo opened'; }
      if (s.phase === 'done' && d === s.final && d !== s.pick){ tag = 'you switched here'; }
      if (s.phase === 'done' && d === s.final && d === s.prize){ b.classList.add('won'); }
      b.innerHTML = doorSVG(d + 1, state) + `<span class="mh-tag">${tag}</span>`;
      b.setAttribute('aria-label', `Door ${d + 1}`);
      b.disabled = s.busy || s.running || s.phase === 'choose';
      b.addEventListener('click', () => pickDoor(d));
      host.appendChild(b);
    }
  }
  function render(){
    renderDoors();
    const choosing = s.phase === 'choose' && !s.running;
    q('stay').disabled = !choosing; q('switch').disabled = !choosing;
    q('new').disabled = s.running;
    q('auto-stay').disabled = !canAuto(); q('auto-switch').disabled = !canAuto();
    q('reset').disabled = s.running;
    q('tally').innerHTML = tallyHTML(s.t, showSpoiled());
    q('log').innerHTML = s.log.slice(-4).join('<br>');
  }
  function newRound(){
    s.id++; s.busy = false; s.running = false;
    s.phase = 'pick'; s.pick = s.prize = s.open = s.final = -1;
    render();
    status('Pick a door.');
  }
  async function pickDoor(d){
    if (s.busy || s.running) return;
    if (s.phase === 'choose') return;
    if (s.phase !== 'pick') newRound();
    s.round++;
    s.pick = d; s.prize = ri(3); s.phase = 'robo'; s.busy = true; render();
    status(`You picked door ${d + 1}. Robo is ${knows() ? 'opening a goat door' : 'opening one of the other doors at random'}...`);
    const id = s.id;
    await wait(700);
    if (id !== s.id) return;
    s.open = hostOpens(s.pick, s.prize, knows());
    s.busy = false;
    if (s.open === s.prize){
      s.phase = 'spoiled'; s.t.spoiled++; chapter.guessRounds++;
      s.log.push(`Round ${s.round}: picked ${s.pick + 1}, Robo opened ${s.open + 1} by accident: the bicycle. Spoiled.`);
      render();
      status(`<span class="robo">Robo opened door ${s.open + 1}: the bicycle.</span> Robo did not know either. This round is spoiled. Pick a door to play again.`);
      return;
    }
    s.phase = 'choose'; render();
    status(`Robo opened door ${s.open + 1}: a goat. Stay with door ${s.pick + 1}, or switch to door ${other() + 1}?`);
  }
  function choose(strategy){
    if (s.phase !== 'choose' || s.running) return;
    s.final = strategy === 'stay' ? s.pick : other();
    const win = s.final === s.prize;
    const t = strategy === 'stay' ? s.t.stay : s.t.sw; t.n++; if (win) t.w++;
    if (!knows()) chapter.guessRounds++;
    s.phase = 'done'; render();
    const verb = strategy === 'stay' ? `stayed with door ${s.pick + 1}` : `switched to door ${s.final + 1}`;
    s.log.push(`Round ${s.round}: picked ${s.pick + 1}, Robo opened ${s.open + 1}, ${verb}: ${win ? 'bicycle' : 'goat'}.`);
    status(win ? `<span class="win-c">You ${verb}. The bicycle!</span> Pick a door to play again.`
               : `You ${verb}. A goat. The bicycle was behind door ${s.prize + 1}. Pick a door to play again.`);
    checkStars();
  }
  async function auto(strategy){
    if (!canAuto()) return;
    s.id++; s.running = true; s.busy = false;
    s.phase = 'pick'; s.pick = s.prize = s.open = s.final = -1; render();
    const k = knows(), word = strategy === 'stay' ? 'staying' : 'switching';
    const res = await runAuto(s, strategy, st => playRound(k, st), 1000, done => {
      if (!k) chapter.guessRounds += 1000 / 25;
      q('tally').innerHTML = tallyHTML(s.t, showSpoiled());
      status(`Robo is playing ${word} rounds... ${fmtNum(done)}`);
    });
    if (!res) return;
    s.running = false; s.round += 1000; render();
    if (k) status(`1000 rounds of ${word}: <b>${fmtNum(res.w)}</b> wins, ${pct(res.w, res.n)}%.`);
    else status(`1000 rounds of ${word} against a guessing Robo: ${fmtNum(res.sp)} spoiled. Of the ${fmtNum(res.n)} that survived, ${word} won <b>${fmtNum(res.w)}</b>, ${pct(res.w, res.n)}%.`);
    s.log.push(`Auto: 1000 rounds of ${word}${k ? '' : ' (Robo guessing)'}: ${res.w} of ${res.n} won${res.sp ? `, ${res.sp} spoiled` : ''}.`);
    checkStars();
  }
  function checkStars(){
    if (cfg.predict && s.pred !== null && knows() && s.t.sw.n >= 1000){
      if (s.pred === '2/3'){
        q('pmsg').innerHTML = `<b class="win-c">You predicted 2/3, and the tally agrees.</b>`;
        earn('mh-predict');
      } else {
        q('pmsg').innerHTML = `You predicted ${s.pred}. The tally says about 2/3. No star this time, but you are in good company: nearly everyone predicts 1/2 the first time.`;
      }
    }
    if (chapter.guessRounds >= 1000 && chapter.quizRight) earn('mh-host');
  }
  function resetTallies(){
    if (s.running) return;
    s.t = newTally(); s.log = []; s.round = 0; newRound();
    status('Tallies cleared. Pick a door.');
  }
  seg(q('mode'), v => {
    s.mode = v; resetTallies();
    status(v === 'knows' ? 'Robo knows where the bicycle is again. Tallies cleared. Pick a door.' : 'Robo is guessing now. Tallies cleared. Pick a door.');
  });
  q('new').addEventListener('click', newRound);
  q('reset').addEventListener('click', resetTallies);
  q('stay').addEventListener('click', () => choose('stay'));
  q('switch').addEventListener('click', () => choose('switch'));
  q('auto-stay').addEventListener('click', () => auto('stay'));
  q('auto-switch').addEventListener('click', () => auto('switch'));
  if (cfg.predict){
    const buttons = $$('[data-p]', q('predict'));
    buttons.forEach(b => b.addEventListener('click', () => {
      if (s.pred !== null) return;
      s.pred = b.dataset.p;
      buttons.forEach(x => { x.disabled = true; x.classList.toggle('chosen', x === b); });
      q('pmsg').innerHTML = `Prediction noted: <b>${s.pred}</b>. Now press "Switch, 1000 rounds" and see.`;
      render();
    }));
  }
  newRound();
  return { s, checkStars };
}

const sim1 = makeSim('mh-sim', { mode: 'knows', predict: true });
const sim2 = makeSim('mh-sim2', { mode: 'guesses', predict: false });

/* ================= the quiz on the guessing-host board ================= */
(function quiz(){
  const R = $('#mh-sim2');
  const q = r => R.querySelector(`[data-r="${r}"]`);
  const options = [
    { ok: true, text: "Robo's guess spoils half of the rounds where your first pick was wrong, and those are exactly the rounds where switching would have won.",
      why: 'Right. The knowing Robo keeps all 200 wrong-first-pick games; the guessing Robo throws away about 100 of them. The 100 right-first-pick games survive either way, so the survivors split 100 to 100.' },
    { ok: false, text: 'A goat is a goat. Once you see one, the two closed doors are equally likely, whichever Robo is hosting.',
      why: "That is the fifty-fifty instinct, and the first board already showed it wrong: a knowing Robo's goat leaves 2/3 on the other door. A goat means different things depending on how it came to be shown." },
    { ok: false, text: 'When Robo guesses, your first pick is right more often, so staying gets better.',
      why: 'Your first pick happens before Robo does anything, so it is right 1 time in 3 whichever Robo is hosting. Look instead at which rounds get thrown away.' }
  ];
  for (let i = options.length - 1; i > 0; i--){ const j = ri(i + 1); [options[i], options[j]] = [options[j], options[i]]; }
  const host = q('opts');
  let answered = false;
  options.forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = o.text;
    b.addEventListener('click', () => {
      if (answered) return;
      if (o.ok){
        answered = true; b.classList.add('right'); $$('button', host).forEach(x => { x.disabled = true; });
        chapter.quizRight = !chapter.quizMissed;
        if (chapter.quizMissed) q('qmsg').innerHTML = o.why + ' (No star for this one: it was not your first answer.)';
        else if (chapter.guessRounds >= 1000){ q('qmsg').innerHTML = o.why; earn('mh-host'); }
        else q('qmsg').innerHTML = o.why + ' Now run at least 1000 rounds with a guessing Robo (an auto button on this board) and the star is yours.';
      } else {
        chapter.quizMissed = true; b.classList.add('wrong'); b.disabled = true;
        q('qmsg').innerHTML = `<span class="you">Not that one.</span> ${o.why}`;
      }
    });
    host.appendChild(b);
  });
})();

/* ================= a hundred doors ================= */
(function bigBoard(){
  const R = $('#mh-big');
  const q = r => R.querySelector(`[data-r="${r}"]`);
  const s = { n: 100, phase: 'pick', pick: -1, prize: -1, other: -1, opened: new Set(), final: -1, id: 0, busy: false, running: false, t: newTally(), round: 0 };
  const status = html => { q('status').innerHTML = html; };
  function readN(){
    const inp = q('n'); s.n = Math.min(100, Math.max(3, Math.round(+inp.value) || 100)); inp.value = s.n;
  }
  function renderGrid(){
    const host = q('grid'); host.innerHTML = '';
    const cols = Math.min(10, s.n);
    host.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    host.style.maxWidth = `${Math.min(480, cols * 48)}px`;
    const done = s.phase === 'done';
    for (let d = 0; d < s.n; d++){
      const b = document.createElement('button'); b.type = 'button';
      const isOpen = s.opened.has(d) || done;
      if (isOpen){ b.classList.add('open'); if (d === s.prize){ b.classList.add('prize'); b.innerHTML = miniBike; } else b.innerHTML = miniGoat; }
      else b.textContent = String(d + 1);
      if (d === s.pick) b.classList.add('picked');
      if (d === s.other && s.phase !== 'pick' && s.phase !== 'robo') b.classList.add('left');
      if (done && d === s.final && d === s.prize) b.classList.add('won');
      b.setAttribute('aria-label', `Door ${d + 1}${isOpen ? (d === s.prize ? ', the bicycle' : ', a goat') : ''}`);
      b.disabled = s.busy || s.running || s.phase === 'choose';
      b.addEventListener('click', () => pickDoor(d));
      host.appendChild(b);
    }
  }
  function render(){
    renderGrid();
    const choosing = s.phase === 'choose' && !s.running;
    q('stay').disabled = !choosing; q('switch').disabled = !choosing;
    q('auto-stay').disabled = s.running || s.busy; q('auto-switch').disabled = s.running || s.busy;
    q('new').disabled = s.running; q('reset').disabled = s.running; q('n').disabled = s.running;
    q('tally').innerHTML = tallyHTML(s.t, false);
  }
  function newRound(){
    s.id++; s.busy = false; s.running = false;
    s.phase = 'pick'; s.pick = s.prize = s.other = s.final = -1; s.opened = new Set();
    render();
    status(`Pick one of the ${s.n} doors.`);
  }
  async function pickDoor(d){
    if (s.busy || s.running || s.phase === 'choose') return;
    if (s.phase !== 'pick') newRound();
    s.round++;
    s.pick = d; s.prize = ri(s.n); s.other = hostLeaves(s.n, s.pick, s.prize);
    s.phase = 'robo'; s.busy = true; render();
    const toOpen = []; for (let x = 0; x < s.n; x++) if (x !== s.pick && x !== s.other) toOpen.push(x);
    for (let i = toOpen.length - 1; i > 0; i--){ const j = ri(i + 1); [toOpen[i], toOpen[j]] = [toOpen[j], toOpen[i]]; }
    status(`You picked door ${d + 1}. Robo is opening ${toOpen.length} goat door${toOpen.length === 1 ? '' : 's'}...`);
    const id = s.id;
    await wait(650);
    if (id !== s.id) return;
    const waves = Math.min(12, toOpen.length), per = Math.ceil(toOpen.length / waves);
    for (let w = 0; w < toOpen.length; w += per){
      toOpen.slice(w, w + per).forEach(x => s.opened.add(x));
      renderGrid();
      await wait(45);
      if (id !== s.id) return;
    }
    s.busy = false; s.phase = 'choose'; render();
    status(`Robo opened ${toOpen.length} goat doors and left door ${s.other + 1} closed. Stay with door ${s.pick + 1}, or switch to door ${s.other + 1}?`);
  }
  function choose(strategy){
    if (s.phase !== 'choose' || s.running) return;
    s.final = strategy === 'stay' ? s.pick : s.other;
    const win = s.final === s.prize;
    const t = strategy === 'stay' ? s.t.stay : s.t.sw; t.n++; if (win) t.w++;
    s.phase = 'done'; render();
    const verb = strategy === 'stay' ? `stayed with door ${s.pick + 1}` : `switched to door ${s.other + 1}`;
    status(win ? `<span class="win-c">You ${verb}. The bicycle!</span> Pick a door to play again.`
               : `You ${verb}. A goat. The bicycle was behind door ${s.prize + 1}. Pick a door to play again.`);
  }
  async function auto(strategy){
    if (s.running || s.busy) return;
    s.id++; s.running = true; s.phase = 'pick'; s.pick = s.prize = s.other = s.final = -1; s.opened = new Set(); render();
    const n = s.n, word = strategy === 'stay' ? 'staying' : 'switching';
    const res = await runAuto(s, strategy, st => playBig(n, st), 1000, done => {
      q('tally').innerHTML = tallyHTML(s.t, false);
      status(`Robo is playing ${word} rounds with ${n} doors... ${fmtNum(done)}`);
    });
    if (!res) return;
    s.running = false; s.round += 1000; render();
    status(`1000 rounds of ${word} with ${n} doors: <b>${fmtNum(res.w)}</b> wins, ${pct(res.w, res.n)}%. The formula says ${strategy === 'stay' ? `1/${n}` : `${n - 1}/${n}`} = ${(100 * (strategy === 'stay' ? 1 : n - 1) / n).toFixed(1)}%.`);
  }
  function resetTallies(){ if (s.running) return; s.t = newTally(); s.round = 0; newRound(); status('Tallies cleared. Pick a door.'); }
  q('n').addEventListener('change', () => {
    if (s.running) return;
    const before = s.n; readN();
    if (s.n === before) return;
    resetTallies(); status(`${s.n} doors now. Tallies cleared. Pick a door.`);
  });
  q('new').addEventListener('click', newRound);
  q('reset').addEventListener('click', resetTallies);
  q('stay').addEventListener('click', () => choose('stay'));
  q('switch').addEventListener('click', () => choose('switch'));
  q('auto-stay').addEventListener('click', () => auto('stay'));
  q('auto-switch').addEventListener('click', () => auto('switch'));
  readN(); newRound();
})();

void sim1; void sim2;
})();

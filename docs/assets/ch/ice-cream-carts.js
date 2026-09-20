/* Chapter: Where to put the ice cream cart (Hotelling's beach: two carts, an uneven crowd, three carts that never settle,
   and the same board wearing a politics skin). One board factory drives all four boards on the page. */
(function(){
'use strict';
const { $, $$, wait, earn, seg, slider, clamp, turn, reveal, cue } = WM;

/* @pure-start
   Everything between the pure markers is DOM-free. The node test (scratch) evaluates this block on its own. */
const LEN = 100;                                 // the beach runs from 0 to 100 meters; carts park on whole meters
const N_CUST = 100;                              // customers on the beach

/* Customer positions, sorted. skew 0: one customer per meter, standing at 0.5, 1.5, ... 99.5.
   skew > 0 piles the crowd toward the right end, skew < 0 toward the left (slider range -10..10).
   With a nonzero skew no customer stands on a whole or half meter, so nobody is ever exactly halfway between two carts. */
function crowd(skew){
  const s = Math.abs(skew), out = [];
  for (let k = 0; k < N_CUST; k++){
    const u = (k + 0.5) / N_CUST;
    if (s === 0){ out.push(k + 0.5); continue; }
    const v = LEN * Math.pow(u, 1 / (1 + 0.3 * s));
    let p = Math.floor(v * 10) / 10 + 0.05;
    if (skew < 0) p = LEN - p;
    out.push(p);
  }
  return out.sort((a, b) => a - b);
}

/* Who gets whom. Every customer walks to the nearest cart; a tie is split evenly among the tied carts.
   Returns { counts: one number per cart, who: for each customer, the list of carts it is split between }. */
function assign(carts, customers){
  const n = carts.length, counts = new Array(n).fill(0), who = [];
  for (const p of customers){
    let best = Infinity, tied = [];
    for (let i = 0; i < n; i++){
      const d = Math.abs(p - carts[i]);
      if (d < best - 1e-9){ best = d; tied = [i]; } else if (Math.abs(d - best) <= 1e-9) tied.push(i);
    }
    for (const i of tied) counts[i] += 1 / tied.length;
    who.push(tied);
  }
  return { counts, who };
}
const counts = (carts, customers) => assign(carts, customers).counts;

/* Longest and average walk to the nearest cart. */
function walks(carts, customers){
  let longest = 0, total = 0;
  for (const p of customers){
    let d = Infinity;
    for (const c of carts) d = Math.min(d, Math.abs(p - c));
    longest = Math.max(longest, d); total += d;
  }
  return { longest, average: total / customers.length };
}

/* Cart i's best response: the whole-meter spot that wins it the most customers given where the others stand.
   Ties go to the spot nearest its current one, so a cart that cannot gain stays put (a tie is no reason to move, Chapter 3). */
function bestResponse(i, carts, customers){
  const cur = carts[i], trial = carts.slice();
  let pos = cur, count = -1;
  for (let x = 0; x <= LEN; x++){
    trial[i] = x;
    const c = counts(trial, customers)[i];
    if (c > count + 1e-9 || (Math.abs(c - count) <= 1e-9 && Math.abs(x - cur) < Math.abs(pos - cur))){ count = c; pos = x; }
  }
  return { pos, count };
}

/* The median of a list: the middle number after sorting, or halfway between the two middle numbers. */
function median(list){
  const s = list.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;

/* Best-response dynamics without animation: carts take turns (order 1, 2, ..., 0) moving to their best response.
   Stops when a whole round passes with nobody moving (settled) or after maxMoves. */
function playOut(carts, customers, maxMoves){
  const pos = carts.slice(), n = pos.length, moves = [];
  let idle = 0, turn = 0;
  while (idle < n && moves.length < maxMoves){
    const i = (turn + 1) % n, br = bestResponse(i, pos, customers);
    if (br.pos !== pos[i]){ moves.push({ cart: i, from: pos[i], to: br.pos, count: br.count }); pos[i] = br.pos; idle = 0; } else idle++;
    turn++;
  }
  return { pos, moves, settled: idle >= n };
}
/* @pure-end */

const fmt = v => Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
const MAX_MOVES = 400;

/* Labels for the two skins. The math never looks at these. */
const WORDS = {
  ice:  { thing: 'customers', one: 'customer', names: ['You', 'Robo', 'Robo 2'], tiles: ['Your customers', "Robo's customers", "Robo 2's customers"],
          axis: ['0 m', '50 m', '100 m'], place: 'Your cart', unit: ' m', crowd: 'Crowd piles up on the right', move: 'Robo moves',
          medianLab: 'Median customer', meanLab: 'Average customer', walk: true },
  vote: { thing: 'votes', one: 'vote', names: ['A (you)', 'B (Robo)', 'C'], tiles: ['Votes for A', 'Votes for B', 'Votes for C'],
          axis: ['Left', 'Middle', 'Right'], place: 'Candidate A', unit: '', crowd: 'Voters lean', move: 'B moves',
          medianLab: 'Median voter', meanLab: 'Average voter', walk: false },
};

/* The four boards on the page. */
const BOARDS = {
  'ic-b1': { carts: 2, you: 70, robo: 20, buttons: ['robo', 'turns', 'reset'], star: 'middle', cue: true },
  'ic-b2': { carts: 2, you: 30, robo: 20, crowd: true, skew: 6, buttons: ['robo', 'turns', 'hint', 'reset'], star: 'median',
             note: '<b>Hint</b> counts the crowd on each side of your cart. The slider and the arrow keys move it one meter at a time.' },
  'ic-b3': { carts: 3, p3: 80, you: 50, robo: 20, threeToggle: true, buttons: ['turns', 'stop', 'reset'], quiz: true, star: 'three' },
  'ic-b4': { carts: 2, you: 30, robo: 70, skin: 'vote', skinToggle: true, crowd: true, lean: true, skew: 0, buttons: ['robo', 'turns', 'reset'], showMedian: true },
};

function makeBoard(id, o){
  const host = $('#' + id); if (!host) return;
  const opening = $('.turn .turn-text', host.closest('.board')).innerHTML;   // the strip's first line, written in the chapter HTML; Reset puts it back
  const b = { n: o.carts, skin: o.skin || 'ice', pos: [o.you, o.robo, o.p3 == null ? 80 : o.p3], skew: o.skew || 0, cust: [], busy: false, run: 0, moves: 0, threeMoves: 0 };
  b.cust = crowd(b.skew);
  const W = () => WORDS[b.skin];
  const active = () => b.pos.slice(0, b.n);
  const has = k => o.buttons.includes(k);
  const btn = (k, cls, label) => `<button class="btn ${cls}" type="button" data-k="${k}">${label}</button>`;

  const crowdSlider = o.crowd ? `<div class="slider"><label class="lab" for="${id}-crowd"><span class="ic-lab-crowd"></span><span class="v" data-for="${id}-crowd"></span></label><input type="range" id="${id}-crowd" min="${o.lean ? -10 : 0}" max="10" value="${b.skew}"></div>` : '';
  host.innerHTML = `
    <div class="controls">
      ${o.threeToggle ? `<div class="seg ic-seg-n"><button type="button" ${b.n === 2 ? 'class="on"' : ''} data-v="2">Two carts</button><button type="button" ${b.n === 3 ? 'class="on"' : ''} data-v="3">Three carts</button></div>` : ''}
      ${o.skinToggle ? `<div class="seg ic-seg-skin"><button type="button" ${b.skin === 'ice' ? 'class="on"' : ''} data-v="ice">Ice cream</button><button type="button" ${b.skin === 'vote' ? 'class="on"' : ''} data-v="vote">Politics</button></div>` : ''}
      ${has('robo') ? btn('robo', 'btn-robo', W().move) : ''}
      ${has('turns') ? btn('turns', 'btn-math', 'Take turns') : ''}
      ${has('stop') ? btn('stop', 'btn-sm', 'Stop') : ''}
      ${has('hint') ? btn('hint', 'btn-math btn-sm', 'Hint') : ''}
      ${has('reset') ? btn('reset', 'btn-sm', 'Reset') : ''}
      ${crowdSlider}
    </div>
    <div class="ic-scene" data-skin="${b.skin}" data-carts="${b.n}">
      <div class="ic-carts">
        <button type="button" class="ic-cart ic-c0"><span class="nm"></span><span class="n"></span></button>
        <span class="ic-cart ic-c1"><span class="nm"></span><span class="n"></span></span>
        <span class="ic-cart ic-c2"><span class="nm"></span><span class="n"></span></span>
      </div>
      <div class="ic-beach">
        <div class="ic-strip"><i class="ic-ghost"><span></span></i></div>
        <div class="ic-water"></div>
      </div>
      <div class="ic-axis"></div>
    </div>
    <div class="slider ic-you-slider"><label class="lab" for="${id}-you"><span class="ic-lab-you"></span><span class="v" data-for="${id}-you"></span></label><input type="range" id="${id}-you" min="0" max="${LEN}" value="${b.pos[0]}"></div>
    <div class="stats ic-stats"></div>
    <p class="note ic-note"></p>
    ${o.quiz ? `<div class="ic-quiz"><span class="q">When the three carts are packed together, which one gets squeezed and has to hop?</span>
      <button class="btn btn-sm" type="button" data-a="left">The one on the left</button>
      <button class="btn btn-sm" type="button" data-a="mid">The one in the middle</button>
      <button class="btn btn-sm" type="button" data-a="right">The one on the right</button></div>` : ''}`;

  const scene = $('.ic-scene', host), strip = $('.ic-strip', host), axis = $('.ic-axis', host);
  const cartEls = [$('.ic-c0', host), $('.ic-c1', host), $('.ic-c2', host)];
  const youIn = $('#' + id + '-you'), youOut = $(`[data-for="${id}-you"]`), crowdIn = o.crowd ? $('#' + id + '-crowd') : null;
  const noteEl = $('.ic-note', host), statsEl = $('.ic-stats', host), ghost = $('.ic-ghost', host);
  const button = k => $(`[data-k="${k}"]`, host);
  /* The strip under the board head is the narrator (CHAPTER_SPEC.md, "Game UX contract"). Its opening line is written
     in the chapter HTML; say() replaces it as soon as the reader or a cart does something. */
  const say = (who, html, tag) => turn(host, who, html, tag);
  const note = html => { noteEl.innerHTML = html; };
  /* what to press next, given the board */
  const next = () => o.star === 'median' ? 'Press <b>Take turns</b> when you think you are on the median.'
    : has('robo') && b.n === 2 ? `Press <b>${W().move}</b> for one best reply, or <b>Take turns</b> to let both keep hopping.`
    : 'Press <b>Take turns</b>.';
  const sayState = lead => say('you', `${lead ? lead + ' ' : ''}${splitText()} ${next()}`);
  const crowdLabel = () => o.lean && b.skin === 'ice' ? 'Crowd leans' : W().crowd;   // the two-way slider needs a two-way name
  const crowdName = () => `<b>${crowdLabel()}</b> slider`;
  const openingLine = () => o.skinToggle
    ? `Drag the ${crowdName()} left or right. Then press <b>Take turns</b> and watch where the two ${b.skin === 'ice' ? 'carts' : 'candidates'} land.`
    : opening;

  /* customers: one dot each, staggered onto four rows so a pile looks like a crowd */
  const dots = [];
  for (let k = 0; k < N_CUST; k++){
    const d = document.createElement('span'); d.className = 'ic-dot'; d.style.bottom = (4 + (k % 4) * 8) + 'px';
    strip.appendChild(d); dots.push(d);
  }
  function placeDots(){ dots.forEach((d, k) => { d.style.left = b.cust[k] + '%'; }); }

  /* axis: a tick every 10 meters, labels at the ends and the middle */
  function buildAxis(){
    const w = W(); let h = '';
    for (let m = 0; m <= LEN; m += 10) h += `<i class="ic-tick" style="left:${m}%"></i>`;
    h += `<span style="left:0">${w.axis[0]}</span><span style="left:50%">${w.axis[1]}</span><span style="left:100%">${w.axis[2]}</span>`;
    axis.innerHTML = h;
  }

  /* stat tiles */
  const TILES = [['c0'], ['c1'], ['c2'], ['walk', 'Longest walk'], ['avg', 'Average walk'], ['moves', 'Moves']];
  if (o.showMedian) TILES.push(['med'], ['mean']);
  const tile = {};
  for (const [k, lab] of TILES){
    const d = document.createElement('div'); d.className = 'stat';
    d.innerHTML = `<span class="k">${lab || ''}</span><span class="v">0</span>`;
    statsEl.appendChild(d); tile[k] = d;
  }

  function relabel(){
    const w = W();
    $('.ic-lab-you', host).textContent = w.place;
    if (crowdIn) $('.ic-lab-crowd', host).textContent = crowdLabel();
    if (button('robo')) button('robo').textContent = w.move;
    for (let i = 0; i < 3; i++) $('.k', tile['c' + i]).textContent = w.tiles[i];
    if (tile.med){ $('.k', tile.med).textContent = w.medianLab; $('.k', tile.mean).textContent = w.meanLab; }
    buildAxis();
  }

  function render(){
    const carts = active(), w = W(), A = assign(carts, b.cust), wk = walks(carts, b.cust);
    dots.forEach((d, k) => { const who = A.who[k]; d.className = 'ic-dot ' + (who.length === 1 ? 'c' + who[0] : 't' + who.join('')); });
    const rect = strip.getBoundingClientRect();
    const cw = Math.max.apply(null, cartEls.map(e => e.offsetWidth || 54));
    const thr = rect.width ? 100 * (cw + 6) / rect.width : 9;
    const lv = [];
    for (let i = 0; i < 3; i++){
      const el = cartEls[i];
      if (i >= b.n){ el.hidden = true; continue; }
      el.hidden = false;
      const used = new Set();
      for (let j = 0; j < i; j++) if (Math.abs(carts[j] - carts[i]) < thr) used.add(lv[j]);
      let l = 0; while (used.has(l)) l++; lv[i] = l;
      el.style.left = carts[i] + '%'; el.style.bottom = (l * 28) + 'px';
      $('.nm', el).textContent = w.names[i]; $('.n', el).textContent = carts[i];
    }
    cartEls[0].setAttribute('aria-label', `${w.place} at ${carts[0]}. Use the arrow keys to move it.`);
    youIn.value = carts[0]; youOut.textContent = carts[0] + w.unit;
    for (let i = 0; i < 3; i++){ tile['c' + i].hidden = i >= b.n; $('.v', tile['c' + i]).textContent = fmt(A.counts[i] || 0); }
    tile.walk.hidden = tile.avg.hidden = !w.walk;
    $('.v', tile.walk).textContent = fmt(wk.longest) + ' m'; $('.v', tile.avg).textContent = fmt(wk.average) + ' m';
    tile.moves.hidden = !has('turns'); $('.v', tile.moves).textContent = b.moves;
    if (tile.med){ $('.v', tile.med).textContent = fmt(median(b.cust)); $('.v', tile.mean).textContent = fmt(mean(b.cust)); }
    updateButtons();
  }
  function updateButtons(){
    if (button('robo')) button('robo').disabled = b.busy;
    if (button('turns')) button('turns').disabled = b.busy;
    if (button('stop')) button('stop').disabled = !b.busy;
  }

  /* text helpers */
  const CLS = ['you', 'robo', 'ic-p3c'];
  const splitText = () => {
    const w = W(), c = counts(active(), b.cust);
    return active().map((p, i) => `<b class="${CLS[i]}">${w.names[i]}</b> at ${p} ${i === 0 && b.skin === 'ice' ? 'get' : 'gets'} ${fmt(c[i])}${i === 0 ? ' ' + w.thing : ''}.`).join(' ');
  };
  const middle = i => { const c = active(); return c.length === 3 && c.every((p, j) => j === i || (p !== c[i])) && c[i] > Math.min.apply(null, c) && c[i] < Math.max.apply(null, c); };

  /* stopping a run: anything the reader does with the board while carts are moving cancels the run */
  function stopRun(){ b.run++; if (b.busy){ b.busy = false; updateButtons(); } }

  function setYou(x, clicked){
    x = clamp(Math.round(x), 0, LEN);
    if (x === b.pos[0] && !clicked) return;
    stopRun(); b.pos[0] = x; render(); sayState();
  }

  /* dragging: on your cart, or anywhere on the sand */
  let dragging = null;
  const posFromEvent = e => { const r = strip.getBoundingClientRect(); return r.width ? (e.clientX - r.left) / r.width * LEN : b.pos[0]; };
  for (const el of [cartEls[0], strip]){
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = el; cartEls[0].classList.add('drag');
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      if (el === strip) setYou(posFromEvent(e), true); else stopRun();
      ghost.classList.remove('on');
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => { if (dragging === el) setYou(posFromEvent(e)); });
    const end = () => { if (dragging === el){ dragging = null; cartEls[0].classList.remove('drag'); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  /* a ghost marker follows the mouse over the sand, so it is plain that a click parks the cart there */
  strip.addEventListener('pointermove', e => {
    if (dragging || e.pointerType !== 'mouse'){ ghost.classList.remove('on'); return; }
    const x = clamp(Math.round(posFromEvent(e)), 0, LEN);
    ghost.style.left = x + '%'; $('span', ghost).textContent = `park at ${x}`; ghost.classList.add('on');
  });
  strip.addEventListener('pointerleave', () => ghost.classList.remove('on'));
  cartEls[0].addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'){ setYou(b.pos[0] - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight'){ setYou(b.pos[0] + 1); e.preventDefault(); }
  });
  slider(youIn, v => v + W().unit, v => setYou(v));
  if (crowdIn){
    slider(crowdIn, v => v === 0 ? 'even' : (o.lean ? (v < 0 ? 'left ' : 'right ') + Math.abs(v) : 'level ' + v), v => {
      if (v === b.skew) return;
      stopRun(); b.skew = v; b.cust = crowd(v); placeDots(); b.moves = 0; render();
      sayState(v === 0 ? `The ${b.skin === 'ice' ? 'crowd is' : 'voters are'} spread evenly.` : `The ${b.skin === 'ice' ? 'crowd piles up' : 'voters lean'} to the ${v < 0 ? 'left' : 'right'}.`);
    });
  }

  /* Robo moves: one best response, then stop */
  async function roboMoves(){
    if (b.busy || b.n !== 2) return;
    b.busy = true; const runId = ++b.run; updateButtons();
    const w = W(), had = counts(active(), b.cust)[1];
    say('robo', `${w.names[1]} is looking for the spot that wins it the most ${w.thing}...`, w.names[1]);
    await wait(500); if (runId !== b.run) return;
    const br = bestResponse(1, active(), b.cust);
    const from = b.pos[1];
    b.pos[1] = br.pos; b.busy = false; render();
    const mine = counts(active(), b.cust)[0];
    const what = br.pos === from
      ? `<b class="robo">${w.names[1]}</b> stays at ${from}. Nowhere on the ${b.skin === 'ice' ? 'beach' : 'line'} gets it more than the ${fmt(had)} ${w.thing} it already has.`
      : `<b class="robo">${w.names[1]}</b>'s best reply to <b class="you">${w.names[0]}</b> at ${b.pos[0]} is ${br.pos}: it takes ${fmt(br.count)} ${w.thing} (it had ${fmt(had)}). ${w.names[0]} ${b.skin === 'ice' ? 'keep' : 'keeps'} ${fmt(mine)}.`;
    if (o.star === 'middle' && Math.abs(b.pos[0] - 50) <= 1 && br.count <= 50.5 + 1e-9){
      say('win', `${what} ${b.pos[0] === 50
        ? 'Robo\'s best move is to park right next to you and take half. Nothing on the beach beats that. You found the middle.'
        : 'Robo squeezes half a customer by standing at 50. Exactly 50 is the one spot where it cannot even do that, but this is the middle.'} Now press <b>Take turns</b> from anywhere and watch both carts end up here.`, 'Unbeatable');
      earn('ic-middle');
    } else if (br.count > mine + 1e-9) say('lose', `${what} Park somewhere else and press <b>${w.move}</b> again.`, `${w.names[1]} is ahead`);
    else say('win', `${what} ${w.names[1]} could not get ahead of you. Press <b>Take turns</b> to see whether this spot holds.`, 'Level');
  }

  /* Take turns: best-response dynamics, animated */
  async function takeTurns(){
    if (b.busy) return;
    b.busy = true; const runId = ++b.run; b.moves = 0; updateButtons();
    const w = W(), n = b.n;
    let calledIt = false;
    if (o.star === 'median'){
      const m = median(b.cust);
      if (Math.abs(b.skew) >= 2 && Math.abs(b.pos[0] - m) <= 2){ calledIt = true; note('You parked on the median before anyone moved. Watch the carts come to you.'); earn('ic-median'); }
      else if (Math.abs(b.skew) >= 2) note('Watch where they settle. Then reset, park there yourself, and press Take turns again.');
      else note('The crowd is even, so the median is 50. Slide the crowd control first for the uneven beach.');
    }
    let idle = 0, turn = 0;
    while (true){
      const i = (turn + 1) % n; turn++;
      const br = bestResponse(i, active(), b.cust);
      if (br.pos !== b.pos[i]){
        const from = b.pos[i], had = counts(active(), b.cust)[i], wasMiddle = middle(i);
        b.pos[i] = br.pos; b.moves++; if (n === 3) b.threeMoves++; idle = 0; render();
        const who = `<b class="${['you', 'robo', 'ic-p3c'][i]}">${w.names[i]}</b>`;
        if (wasMiddle) say('robo', `${who} was squeezed in the middle at ${from} with ${fmt(had)} ${w.thing}, and hops to ${br.pos} for ${fmt(br.count)}.`, `Move ${b.moves}`);
        else say('robo', `${who} ${from} → ${br.pos}, now ${fmt(br.count)} ${w.thing} (had ${fmt(had)}).`, `Move ${b.moves}`);
        if (o.quiz && n === 3 && b.threeMoves === 30) note('That is 30 moves with three carts. You can answer the question under the beach whenever you like.');
      } else idle++;
      if (idle >= n){
        const where = active().map((p, i) => `${w.names[i]} at ${p}`).join(', ');
        let s = `Settled after ${b.moves} move${b.moves === 1 ? '' : 's'}: ${where}. Nobody can gain a single ${w.one} by moving.`;
        if (o.showMedian && Math.abs(b.pos[0] - median(b.cust)) <= 1) s += ` That is the median ${b.skin === 'ice' ? 'customer' : 'voter'}.`;
        if (o.star === 'median') s += calledIt ? ' You called the median before anyone moved.'
          : Math.abs(b.skew) >= 2 ? ' Press <b>Reset</b>, park your cart where they settled, and press <b>Take turns</b> again.'
          : ' The crowd is even, so that is 50. Drag the crowd slider to make the beach uneven, then try again.';
        else s += o.crowd ? ` Drag the ${crowdName()} and run it again.` : ' Park somewhere else and press <b>Take turns</b> again.';
        say('win', s, 'Settled'); break;
      }
      if (b.moves >= MAX_MOVES){
        say('math', `${b.moves} moves and still no rest. Whichever cart is in the middle gets squeezed and hops out, and the squeeze passes to the next cart. This never settles. ${o.quiz ? 'Now answer the question under the beach.' : 'Press <b>Reset</b>.'}`, 'No rest');
        if (o.quiz) reveal($('.ic-quiz', host));
        break;
      }
      await wait(b.moves <= 3 ? 520 : (n === 3 ? 260 : 170));
      if (runId !== b.run) return;
    }
    b.busy = false; render();
  }

  /* buttons */
  if (button('robo')) button('robo').addEventListener('click', roboMoves);
  if (button('turns')) button('turns').addEventListener('click', takeTurns);
  if (button('stop')) button('stop').addEventListener('click', () => {
    if (!b.busy) return;
    stopRun();
    const quizNow = o.quiz && b.threeMoves >= 30;
    const more = o.quiz && b.n === 3 ? ` The question under the beach needs 30 moves, and you have ${b.threeMoves}.` : '';
    say('math', `Stopped after ${b.moves} moves. ${b.n === 3 ? 'It was never going to settle.' : ''} ${quizNow ? 'Now answer the question under the beach.' : 'Press <b>Take turns</b> to set them going again.' + more}`, 'Stopped');
    if (quizNow) reveal($('.ic-quiz', host));
  });
  if (button('hint')) button('hint').addEventListener('click', () => {
    const w = W(), x = b.pos[0], left = b.cust.filter(p => p < x).length, right = b.cust.filter(p => p > x).length;
    say('math', `Left of <b class="you">${w.names[0]}</b> at ${x}: ${left} ${w.thing}. Right: ${right}. The median has 50 on each side. Move your cart toward the bigger side.`, 'Hint');
  });
  if (button('reset')) button('reset').addEventListener('click', () => {
    stopRun(); b.pos = [o.you, o.robo, o.p3 == null ? 80 : o.p3]; b.moves = 0; render(); say('you', openingLine()); note(o.note || '');
  });
  const segN = $('.ic-seg-n', host);
  if (segN) seg(segN, v => { stopRun(); b.n = +v; scene.dataset.carts = v; b.moves = 0; render(); sayState(b.n === 3 ? 'Three carts.' : 'Two carts: Robo 2 has gone home.'); });
  const segSkin = $('.ic-seg-skin', host);
  if (segSkin) seg(segSkin, v => { stopRun(); b.skin = v; scene.dataset.skin = v; relabel(); render(); sayState(v === 'ice' ? 'Same board, ice cream labels.' : 'Same board, election labels.'); });

  /* the three-cart quiz */
  const quiz = $('.ic-quiz', host);
  if (quiz){
    $$('button[data-a]', quiz).forEach(q => q.addEventListener('click', () => {
      if (b.busy) stopRun();
      if (q.dataset.a !== 'mid'){ say('you', 'Watch the counts while they run. The outside carts keep everyone beyond them; the middle one gets only the sliver in between. Answer again.', 'Not quite'); return; }
      if (b.threeMoves < 30){ say('you', `Right. Now press <b>Take turns</b> with three carts and let them run for at least 30 moves (you have ${b.threeMoves}), then answer again.`, 'Almost'); return; }
      say('win', 'The middle cart gets only what lies between the two halfway points, so it hops outside, and then a different cart is in the middle.', 'Right');
      earn('ic-three');
    }));
  }

  window.addEventListener('resize', () => { if (!b.busy) render(); });
  relabel(); placeDots(); render(); note(o.note || '');
  if (o.cue) cue(cartEls[0]);   // the chapter's first game: pulse the cart until the reader touches the board
}

for (const id of Object.keys(BOARDS)) makeBoard(id, BOARDS[id]);
})();

/* Chapter: Nim and binary (multi-pile Nim against Robo, a base-2 toy, a nim-sum tool, a find-the-move drill). */
(function(){
'use strict';

/* ---------- pure game logic (no DOM; unit-tested under node) ----------
   nimSum(piles) is the XOR of all pile sizes. isLosing(piles, misere) is true when the player to move
   cannot force a win. Normal play: nim-sum 0. Misère: same while some pile has 2 or more stones;
   once every pile is 0 or 1, the player to move loses exactly when the number of single stones is odd. */
const PLACES = [8, 4, 2, 1];
const nimSum = piles => piles.reduce((a, b) => a ^ b, 0);
const bits = n => PLACES.map(p => (n & p) ? 1 : 0);
const bin = n => bits(n).join('');
function isLosing(piles, misere){
  if (!misere || piles.some(p => p >= 2)) return nimSum(piles) === 0;
  return piles.filter(p => p === 1).length % 2 === 1;
}
function legalMoves(piles){
  const out = [];
  piles.forEach((p, i) => { for (let s = p - 1; s >= 0; s--) out.push({ i, s }); });
  return out;
}
function after(piles, m){ const q = piles.slice(); q[m.i] = m.s; return q; }
function winningMoves(piles, misere){ return legalMoves(piles).filter(m => isLosing(after(piles, m), misere)); }
/* The recipe from the proof: leftmost 1 of the nim-sum, a pile with a 1 there, new size = pile XOR nim-sum. */
function recipeMove(piles){
  const s = nimSum(piles); if (!s) return null;
  const hb = 1 << (31 - Math.clz32(s));
  for (let i = 0; i < piles.length; i++) if (piles[i] & hb) return { i, s: piles[i] ^ s };
  return null;
}
function parsePiles(str, fallback){
  const p = String(str).split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1).map(n => Math.min(15, n)).slice(0, 4);
  return p.length >= 2 ? p : fallback.slice();
}
const total = piles => piles.reduce((a, b) => a + b, 0);

if (typeof window === 'undefined'){
  module.exports = { PLACES, nimSum, bits, bin, isLosing, legalMoves, after, winningMoves, recipeMove, parsePiles, total };
  return;
}

/* ================= DOM from here on ================= */
const { $, $$, rand, pick, wait, earn, seg } = WM;
const LET = ['A', 'B', 'C', 'D'];
const bitsHTML = n => '<span class="nb-bits">' + bits(n).map(b => `<i class="${b ? 'on' : ''}">${b}</i>`).join('') + '</span>';
const list = piles => piles.join(', ');
const xorList = piles => piles.join(' ⊕ ');

/* Draw piles as columns of stones. start[i] is the original size (ghost stones stay), piles[i] the current size.
   opts: live (clickable), onClick(i, leave), onHover(i, leave) / onLeave(), who[i][j] ('you'|'robo'|null), sel {i, s}, bits. */
function renderPiles(host, start, piles, opts){
  host.innerHTML = '';
  start.forEach((n0, i) => {
    const wrap = document.createElement('div'); wrap.className = 'nb-pile';
    const col = document.createElement('div'); col.className = 'nb-col' + (opts.live ? ' live' : '');
    for (let j = 0; j < n0; j++){
      const gone = j >= piles[i];
      const s = document.createElement(gone || !opts.live ? 'span' : 'button');
      s.className = 'stone'; s.textContent = j + 1;
      if (gone){
        s.classList.add('gone');
        const w = opts.who && opts.who[i] && opts.who[i][j]; if (w) s.classList.add(w);
      } else if (opts.live){
        s.type = 'button';
        s.title = `Take ${piles[i] - j} from pile ${LET[i]}, leaving ${j}`;
        s.setAttribute('aria-label', s.title);
        s.addEventListener('click', () => opts.onClick(i, j));
        if (opts.onHover){
          s.addEventListener('mouseenter', () => opts.onHover(i, j));
          s.addEventListener('focus', () => opts.onHover(i, j));
          s.addEventListener('mouseleave', () => opts.onLeave());
          s.addEventListener('blur', () => opts.onLeave());
        }
      }
      if (opts.sel && opts.sel.i === i && j >= opts.sel.s && !gone) s.classList.add('sel');
      col.appendChild(s);
    }
    wrap.appendChild(col);
    const lab = document.createElement('div'); lab.className = 'nb-plab';
    lab.innerHTML = `<b>${piles[i]}</b><span>pile ${LET[i]}</span>`;
    wrap.appendChild(lab);
    if (opts.bits){ const b = document.createElement('div'); b.innerHTML = bitsHTML(piles[i]); wrap.appendChild(b.firstChild); }
    host.appendChild(wrap);
  });
}

/* ================= the game ================= */
const g = { id: 0, start: [3, 4, 5], piles: [3, 4, 5], who: [], turn: 'you', over: false, busy: false, first: 'you', misere: false, log: [], goofUsed: false };
const goofOn = () => $('#nb-goof').checked;
const secretOn = () => $('#nb-secret').checked;
const status = html => { $('#nb-status').innerHTML = html; };
const yourTurn = () => !g.over && !g.busy && g.turn === 'you';

function whoLabel(piles, misere, mover){
  const L = isLosing(piles, misere);
  const tag = L ? '<b class="you">L</b>' : '<b class="win-c">W</b>';
  const s = nimSum(piles);
  if (!misere || piles.some(p => p >= 2)) return `${s === 0 ? 'Zero' : 'Not zero'}, so ${tag} for the player to move (${mover}).`;
  return `Only single stones are left, so count them: ${piles.filter(p => p === 1).length}. Last stone loses, so ${tag} for the player to move (${mover}).`;
}
function secretLine(previewPiles, previewText){
  const host = $('#nb-secretline');
  host.hidden = !secretOn();
  if (host.hidden) return;
  const mover = g.over ? 'nobody' : g.turn === 'you' ? 'you' : 'Robo';
  let h = `<span>Nim-sum: ${bitsHTML(nimSum(g.piles))} = <b>${nimSum(g.piles)}</b>.</span> <span>${whoLabel(g.piles, g.misere, mover)}</span>`;
  if (previewPiles) h += `<span class="nb-preview">${previewText} leaves ${list(previewPiles)}: nim-sum ${nimSum(previewPiles)}.</span>`;
  host.innerHTML = h;
}
function render(){
  renderPiles($('#nb-piles'), g.start, g.piles, {
    live: yourTurn(), onClick: youTake, who: g.who, bits: secretOn(),
    onHover: (i, j) => { if (secretOn()) secretLine(after(g.piles, { i, s: j }), `Taking ${g.piles[i] - j} from pile ${LET[i]}`); },
    onLeave: () => { if (secretOn()) secretLine(); },
  });
  secretLine();
  $('#nb-hint').disabled = !yourTurn();
  $('#nb-rules').textContent = `Take any number of stones from one pile. Last stone ${g.misere ? 'loses' : 'wins'}.`;
  $('#nb-log').innerHTML = g.log.slice(-4).join('<br>');
}
function applyMove(m, who){
  const took = g.piles[m.i] - m.s;
  for (let j = m.s; j < g.piles[m.i]; j++) g.who[m.i][j] = who;
  g.piles[m.i] = m.s;
  g.log.push(`${who === 'you' ? 'You' : 'Robo'} took ${took} from pile ${LET[m.i]}. Piles: ${list(g.piles)}.`);
  return took;
}
function newGame(){
  g.start = parsePiles($('#nb-piles-in').value, [3, 4, 5]); $('#nb-piles-in').value = list(g.start);
  g.piles = g.start.slice(); g.who = g.start.map(n => new Array(n).fill(null));
  g.over = false; g.busy = false; g.log = []; g.turn = g.first; g.goofUsed = goofOn(); g.id++;
  render();
  if (g.turn === 'you') status('Your turn. Click a stone to take it and every stone above it.');
  else { status('Robo goes first...'); roboMove(); }
}
function finish(lastTaker){
  g.over = true; g.busy = false; g.goofUsed = g.goofUsed || goofOn(); render();
  const youWon = g.misere ? lastTaker !== 'you' : lastTaker === 'you';
  if (youWon){
    status(`<span class="win-c">${g.misere ? 'Robo had to take the last stone. You win!' : 'You took the last stone. You win!'}</span>`);
    const fair = !g.goofUsed && g.start.length >= 3 && total(g.start) >= 8;
    if (fair) earn('nb-win');
    else if (g.goofUsed) status($('#nb-status').innerHTML + ' <span class="note">(No star while Robo goofs. Turn it off and try again.)</span>');
  } else {
    status(`<span class="robo">${g.misere ? 'You had to take the last stone.' : 'Robo took the last stone.'}</span> Try the hint, or show the secret.`);
  }
}
async function roboMove(){
  g.turn = 'robo'; g.busy = true; g.goofUsed = g.goofUsed || goofOn(); render();
  const id = g.id;
  await wait(750);
  if (id !== g.id || g.over || total(g.piles) === 0) return;   // a New game started (or the game ended) while Robo was thinking
  const wins = winningMoves(g.piles, g.misere);
  const goof = goofOn() && Math.random() < 0.5;
  const m = (wins.length && !goof) ? pick(wins) : pick(legalMoves(g.piles));
  const took = applyMove(m, 'robo');
  if (total(g.piles) === 0) return finish('robo');
  g.turn = 'you'; g.busy = false; render();
  status(`Robo took ${took} from pile ${LET[m.i]}. Your turn.` + (wins.length ? '' : ' <span class="note">(Robo had no winning move. You are on track.)</span>'));
}
function youTake(i, leave){
  if (!yourTurn() || leave >= g.piles[i] || leave < 0) return;
  applyMove({ i, s: leave }, 'you');
  if (total(g.piles) === 0) return finish('you');
  status('Robo is thinking...'); roboMove();
}
$('#nb-hint').addEventListener('click', () => {
  if (!yourTurn()) return;
  const m = g.misere ? (winningMoves(g.piles, true)[0] || null) : recipeMove(g.piles);
  if (m){
    const q = after(g.piles, m);
    status(`Hint: take <b>${g.piles[m.i] - m.s}</b> from pile <b>${LET[m.i]}</b>, leaving ${list(q)}.` +
      (g.misere ? ' That is a losing position for Robo in the last-stone-loses game.' : ` Its nim-sum is ${xorList(q)} = 0.`));
  } else {
    status(`No winning move here. ${g.misere ? 'This is a losing position for the player to move, and that is you.' : 'The nim-sum is already 0, so you are standing on an L.'} Take something small and hope Robo goofs.`);
  }
});
$('#nb-secret').addEventListener('change', render);
$('#nb-new').addEventListener('click', newGame);
$('#nb-piles-in').addEventListener('change', newGame);
seg($('#nb-first'), v => { g.first = v; newGame(); });
seg($('#nb-rule'), v => { g.misere = v === 'misere'; newGame(); });
newGame();

/* ================= base 2 toy ================= */
const bn = { n: 13 };
function binTable(){
  let h = '<tr><th>number</th><th>8 4 2 1</th><th>number</th><th>8 4 2 1</th></tr>';
  for (let r = 0; r < 8; r++){
    h += `<tr><td id="nb-bt-${r}">${r}</td><td id="nb-bb-${r}">${bin(r)}</td><td id="nb-bt-${r + 8}">${r + 8}</td><td id="nb-bb-${r + 8}">${bin(r + 8)}</td></tr>`;
  }
  $('#nb-bin-table').innerHTML = h;
}
function binRender(){
  const host = $('#nb-places'); host.innerHTML = '';
  const on = [];
  PLACES.forEach(p => {
    const b = document.createElement('button'); b.type = 'button';
    const lit = (bn.n & p) !== 0; if (lit) on.push(p);
    b.className = lit ? 'on' : '';
    b.innerHTML = `<span class="p">${p}</span><span class="d">${lit ? 1 : 0}</span>`;
    b.title = (lit ? 'Switch off ' : 'Switch on ') + p;
    b.addEventListener('click', () => { bn.n ^= p; binRender(); });
    host.appendChild(b);
  });
  $('#nb-bin-n').value = bn.n;
  $('#nb-bin-msg').innerHTML = on.length
    ? `<code>${bn.n}</code> = ${on.join(' + ')}, so in binary it is <code>${bin(bn.n)}</code>.`
    : `<code>0</code> has nothing switched on: <code>0000</code>.`;
  for (let k = 0; k < 16; k++){
    $(`#nb-bt-${k}`).classList.toggle('hl', k === bn.n);
    $(`#nb-bb-${k}`).classList.toggle('hl', k === bn.n);
  }
}
$('#nb-bin-n').addEventListener('input', () => {
  const v = parseInt($('#nb-bin-n').value, 10);
  if (Number.isInteger(v)){ bn.n = Math.min(15, Math.max(0, v)); binRender(); }
});
binTable(); binRender();

/* ================= nim-sum column tool ================= */
const xo = { piles: [3, 4, 5], marks: [null, null, null, null], streak: 0, done: false, solved: new Set() };
const xoKey = piles => piles.slice().sort((a, b) => a - b).join(',');
function xoRender(result){
  let h = '<tr><th></th>' + PLACES.map(p => `<th>${p}s</th>`).join('') + '</tr>';
  xo.piles.forEach(p => {
    h += `<tr><th class="rh">${p}</th>` + bits(p).map(b => `<td class="${b ? 'on' : ''}">${b}</td>`).join('') + '</tr>';
  });
  h += '<tr class="line"><td colspan="5"></td></tr>';
  h += '<tr class="res"><th class="rh">nim-sum</th>' + PLACES.map((p, c) => {
    const m = xo.marks[c];
    const cls = result ? (result[c] ? 'ok' : 'bad') : '';
    return `<td><button type="button" class="${cls}" data-c="${c}" aria-label="${p}s column of the nim-sum">${m === null ? '?' : m}</button></td>`;
  }).join('') + '</tr>';
  $('#nb-xor-table').innerHTML = h;
  $$('#nb-xor-table tr.res button').forEach(b => b.addEventListener('click', () => {
    if (xo.done) return;
    const c = +b.dataset.c;
    xo.marks[c] = xo.marks[c] === null ? 1 : xo.marks[c] === 1 ? 0 : 1;
    xoRender();
  }));
  $('#nb-xor-streak').textContent = `Streak: ${xo.streak}`;
}
function xoLoad(piles){
  xo.piles = piles; xo.marks = [null, null, null, null]; xo.done = false;
  $('#nb-xor-in').value = list(piles);
  xoRender();
  $('#nb-xor-msg').textContent = 'Click the four answer boxes, then check.';
}
function xoRandom(){
  const k = pick([2, 3, 3, 3, 4]);
  let p;
  do { p = Array.from({ length: k }, () => rand(15) + 1); } while (xoKey(p) === xoKey(xo.piles));
  xoLoad(p);
}
$('#nb-xor-check').addEventListener('click', () => {
  if (xo.done) return;
  if (xo.marks.some(m => m === null)){ $('#nb-xor-msg').textContent = 'Fill in all four columns first. A column with no 1s at all is 0.'; return; }
  const want = bits(nimSum(xo.piles));
  const result = want.map((b, c) => b === xo.marks[c]);
  xoRender(result);
  if (result.every(Boolean)){
    xo.done = true;
    const s = nimSum(xo.piles);
    const fresh = !xo.solved.has(xoKey(xo.piles));
    if (fresh){ xo.solved.add(xoKey(xo.piles)); xo.streak++; }
    xoRender();
    $('#nb-xor-msg').innerHTML = `<span class="win-c">Correct.</span> ${xorList(xo.piles)} = <code>${bin(s)}</code> = <b>${s}</b>. ` +
      (s === 0 ? 'Zero: <b class="you">L</b> for the player to move.' : 'Not zero: <b class="win-c">W</b> for the player to move.') +
      (fresh ? ' Press New piles for another.' : ' (You had already solved these piles, so the streak stays put.)');
    if (xo.streak >= 5) earn('nb-xor');
  } else {
    xo.streak = 0;
    const c = result.indexOf(false);
    const ones = xo.piles.filter(p => p & PLACES[c]).length;
    $('#nb-xor-msg').innerHTML = `<span class="you">Not yet.</span> Look at the ${PLACES[c]}s column: it has ${ones} one${ones === 1 ? '' : 's'}, ${ones % 2 ? 'an odd number, so it should be 1' : 'an even number, so it should be 0'}. Fix the red boxes and check again.`;
    $('#nb-xor-streak').textContent = 'Streak: 0';
  }
});
$('#nb-xor-clear').addEventListener('click', () => xoLoad(xo.piles.slice()));
$('#nb-xor-rand').addEventListener('click', xoRandom);
$('#nb-xor-in').addEventListener('change', () => xoLoad(parsePiles($('#nb-xor-in').value, xo.piles)));
xoLoad([3, 4, 5]);

/* ================= find the winning move ================= */
const fm = { piles: [3, 4, 5], sel: null, streak: 0, done: false };
const fmMsg = html => { $('#nb-fm-msg').innerHTML = html; };
function fmRender(){
  renderPiles($('#nb-fm-piles'), fm.piles, fm.piles, {
    live: !fm.done, sel: fm.sel, bits: $('#nb-fm-bits').checked,
    onClick: (i, j) => {
      fm.sel = { i, s: j }; fmRender();
      fmMsg(`Take <b>${fm.piles[i] - j}</b> from pile <b>${LET[i]}</b>, leaving ${list(after(fm.piles, fm.sel))}? Click another stone to change your mind, or check it.`);
    },
  });
  $('#nb-fm-streak').textContent = `Streak: ${fm.streak} of 3`;
  $('#nb-fm-check').disabled = fm.done || !fm.sel;
}
function fmNew(){
  let p;
  do {
    const k = pick([2, 3, 3, 3, 4]);
    p = Array.from({ length: k }, () => rand(15) + 1);
  } while (nimSum(p) === 0 || xoKey(p) === xoKey(fm.piles));
  fm.piles = p; fm.sel = null; fm.done = false;
  fmRender();
  fmMsg(`Piles ${list(p)}. The nim-sum is not 0, so a winning move exists. Click a stone to choose it.`);
}
$('#nb-fm-check').addEventListener('click', () => {
  if (fm.done || !fm.sel) return;
  const q = after(fm.piles, fm.sel);
  fm.done = true;
  if (nimSum(q) === 0){
    fm.streak++;
    fmMsg(`<span class="win-c">Yes.</span> ${xorList(q)} = 0. Robo would be stuck on an L. Press Next position.`);
    fmRender();
    if (fm.streak >= 3) earn('nb-move');
  } else {
    fm.streak = 0;
    const r = recipeMove(fm.piles);
    fmMsg(`<span class="you">Not that one.</span> ${xorList(q)} = ${nimSum(q)}, not 0. One move that works: take ${fm.piles[r.i] - r.s} from pile ${LET[r.i]}, leaving ${list(after(fm.piles, r))}. Press Next position.`);
    fmRender();
  }
});
$('#nb-fm-next').addEventListener('click', fmNew);
$('#nb-fm-bits').addEventListener('change', fmRender);
fm.piles = [1, 1]; fmNew();
})();

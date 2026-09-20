/* Chapter 7: Seeing the whole tree. Tic-tac-toe with node counting, pruning, a shallow Robo, and tree puzzles. */
(function(){
'use strict';
const { $, $$, pick, wait, earn, seg, fmtNum, turn, reveal, cue } = WM;

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b){
  for (const L of LINES) if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return { who: b[L[0]], line: L };
  return b.every(x => x) ? { who: 'draw' } : null;
}
const other = p => (p === 'X' ? 'O' : 'X');
/* value from O's perspective (+1 O wins), full minimax with a node counter */
const cnt = { full: 0, pruned: 0 };
function minimax(b, player){
  cnt.full++;
  const w = winner(b); if (w) return w.who === 'O' ? 1 : w.who === 'X' ? -1 : 0;
  let best = player === 'O' ? -2 : 2;
  for (let i = 0; i < 9; i++){ if (b[i]) continue; b[i] = player; const v = minimax(b, other(player)); b[i] = ''; best = player === 'O' ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
function alphabeta(b, player, alpha, beta){
  cnt.pruned++;
  const w = winner(b); if (w) return w.who === 'O' ? 1 : w.who === 'X' ? -1 : 0;
  if (player === 'O'){
    let best = -2;
    for (let i = 0; i < 9; i++){ if (b[i]) continue; b[i] = player; best = Math.max(best, alphabeta(b, 'X', alpha, beta)); b[i] = ''; alpha = Math.max(alpha, best); if (beta <= alpha) break; }
    return best;
  }
  let best = 2;
  for (let i = 0; i < 9; i++){ if (b[i]) continue; b[i] = player; best = Math.min(best, alphabeta(b, 'O', alpha, beta)); b[i] = ''; beta = Math.min(beta, best); if (beta <= alpha) break; }
  return best;
}
function shallow(b, player, depth){ // depth-limited: sees only `depth` plies, then calls it a draw
  const w = winner(b); if (w) return w.who === 'O' ? 1 : w.who === 'X' ? -1 : 0;
  if (depth === 0) return 0;
  let best = player === 'O' ? -2 : 2;
  for (let i = 0; i < 9; i++){ if (b[i]) continue; b[i] = player; const v = shallow(b, other(player), depth - 1); b[i] = ''; best = player === 'O' ? Math.max(best, v) : Math.min(best, v); }
  return best;
}

/* ================= the game ================= */
const g = { b: Array(9).fill(''), over: false, busy: false, first: 'you', brain: 'perfect', id: 0 };
function render(win){
  const host = $('#gt-ttt');
  if (!host.children.length) for (let i = 0; i < 9; i++){ const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('aria-label', 'square ' + (i + 1)); btn.addEventListener('click', () => you(i)); host.appendChild(btn); }
  $$('button', host).forEach((btn, i) => { btn.textContent = g.b[i]; btn.className = g.b[i]; btn.disabled = g.over || g.busy || !!g.b[i]; if (win && win.line && win.line.includes(i)) btn.classList.add('line'); });
  host.classList.toggle('wait', g.busy && !g.over);
}
const TTT = '#gt-ttt';
const SQUARE = ['the top left corner', 'the top middle', 'the top right corner', 'the middle left', 'the center', 'the middle right', 'the bottom left corner', 'the bottom middle', 'the bottom right corner'];
const AGAIN = 'Press New game to play again.';
function end(win){
  g.over = true; g.busy = false; render(win);
  if (win.who === 'draw'){
    if (g.brain === 'perfect'){ turn(TTT, 'win', `The board is full and nobody has three in a row. Against Perfect Robo that is the best anyone can do. ${AGAIN}`, 'A draw'); earn('gt-draw'); }
    else turn(TTT, 'math', `The board is full and nobody has three in a row. Shallow Robo can be beaten, though: set a trap that takes three moves to spring. ${AGAIN}`, 'A draw');
  }
  else if (win.who === 'X'){ turn(TTT, 'win', `Three in a row.${g.brain === 'shallow' ? ' Shallow Robo never saw it coming.' : ' That should be impossible.'} ${AGAIN}`); if (g.brain === 'shallow') earn('gt-shallow'); else earn('gt-draw'); }
  else turn(TTT, 'lose', `Robo made three in a row. Robo saw that coming. Press New game and try again.`);
}
async function robo(){
  g.busy = true; render(); turn(TTT, 'robo', g.brain === 'perfect' ? 'Robo is looking at every future...' : 'Robo is peeking two moves ahead...');
  const id = g.id;
  await wait(450);
  if (id !== g.id) return;
  cnt.full = 0; cnt.pruned = 0;
  let bestS = -2, moves = [];
  for (let i = 0; i < 9; i++){
    if (g.b[i]) continue;
    g.b[i] = 'O';
    const v = g.brain === 'perfect' ? minimax(g.b, 'X') : shallow(g.b, 'X', 1);
    if (g.brain === 'perfect') alphabeta(g.b, 'X', -2, 2);
    g.b[i] = '';
    if (v > bestS){ bestS = v; moves = [i]; } else if (v === bestS) moves.push(i);
  }
  const m = pick(moves); g.b[m] = 'O';
  if (g.brain === 'perfect'){
    $('#gt-thought').innerHTML = `Robo looked at <b>${fmtNum(cnt.full)}</b> possible futures before that move. With pruning it would have needed only <b>${fmtNum(cnt.pruned)}</b>.` + (bestS === 1 ? ' Robo has found a forced win.' : bestS === 0 ? ' The best Robo can force is a draw.' : '');
  } else $('#gt-thought').innerHTML = 'Shallow Robo checked its move and your reply, nothing deeper.';
  const w = winner(g.b); if (w) return end(w);
  g.busy = false; render(); turn(TTT, 'you', `<span class="robo">Robo took ${SQUARE[m]}.</span> Click any empty square to place your <b class="you">X</b>.`);
}
function you(i){ if (g.over || g.busy || g.b[i]) return; g.b[i] = 'X'; const w = winner(g.b); if (w) return end(w); robo(); }
function newGame(){ g.id++; g.b = Array(9).fill(''); g.over = false; g.busy = false; $('#gt-thought').textContent = 'Robo has not moved yet.'; render(); if (g.first === 'robo') robo(); else turn(TTT, 'you', 'Click any empty square to place your <b class="you">X</b>.'); }
$('#gt-new').addEventListener('click', newGame);
seg($('#gt-first'), v => { g.first = v; newGame(); });
seg($('#gt-brain'), v => { g.brain = v; newGame(); });
newGame();
cue($('#gt-ttt'));

/* ================= tree puzzles ================= */
function evalX(b, player){ // value from X's perspective
  const w = winner(b); if (w) return w.who === 'X' ? 1 : w.who === 'O' ? -1 : 0;
  let best = player === 'X' ? -2 : 2;
  for (let i = 0; i < 9; i++){ if (b[i]) continue; b[i] = player; const v = evalX(b, other(player)); b[i] = ''; best = player === 'X' ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
function combos(n, k, start){ start = start || 0; if (k === 0) return [[]]; const out = []; for (let i = start; i <= n - k; i++) for (const rest of combos(n, k - 1, i + 1)) out.push([i].concat(rest)); return out; }
const POOL = { now: [], only: [], later: [] };
(function enumerate(){
  const idx = [0,1,2,3,4,5,6,7,8];
  for (const xs of combos(9, 3)){
    const rest = idx.filter(i => !xs.includes(i));
    for (const osel of combos(6, 3)){
      const os = osel.map(j => rest[j]);
      const b = Array(9).fill(''); xs.forEach(i => { b[i] = 'X'; }); os.forEach(i => { b[i] = 'O'; });
      if (winner(b)) continue;
      const empties = idx.filter(i => !b[i]);
      const vals = empties.map(i => { const nb = b.slice(); nb[i] = 'X'; return { i, v: evalX(nb, 'O'), now: !!winner(nb) }; });
      const best = Math.max.apply(null, vals.map(x => x.v));
      if (vals.some(x => x.now)) POOL.now.push(b);
      else if (best === 1) POOL.later.push(b);
      else if (best === 0 && vals.filter(x => x.v === 0).length === 1) POOL.only.push(b);
    }
  }
})();
const pz = { b: null, kind: '', picked: null, solved: 0, answered: false, shown: false, verdict: null, order: ['now', 'only', 'later'], k: 0 };
const PUZ = '#gt-mini';
function puzzleNew(){
  const kind = pz.order[pz.k % 3]; pz.k++;
  const pool = POOL[kind].length ? POOL[kind] : POOL.now;
  pz.b = pick(pool).slice(); pz.kind = kind; pz.picked = null; pz.answered = false; pz.verdict = null;
  $('#gt-puz-rules').textContent = kind === 'now' ? 'X to move. One square wins on the spot.' : kind === 'only' ? 'X to move. Two squares lose. One does not.' : 'X to move. No square wins right away, but one wins for sure.';
  turn(PUZ, 'you', `It is <b class="you">X</b>'s move. Click the empty square you think is best.`); $('#gt-tree').innerHTML = ''; $('#gt-tree-wrap').hidden = true; $('#gt-tree-note').hidden = false; pz.shown = false;
  miniRender();
}
function puzVerdict(){
  const next = pz.shown ? 'Follow the yellow path down the tree, then press New puzzle.' : 'Press Show the tree to see why, or New puzzle for the next one.';
  turn(PUZ, pz.verdict.ok ? 'win' : 'you', `${pz.verdict.text} ${next}`, pz.verdict.ok ? 'Right' : 'Not the best');
}
function miniRender(){
  const host = $('#gt-mini'); host.innerHTML = '';
  pz.b.forEach((v, i) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = v; btn.className = v + (pz.picked === i ? ' pick' : '');
    btn.disabled = !!v || pz.answered;
    btn.addEventListener('click', () => {
      pz.picked = i; pz.answered = true; miniRender();
      const empties = pz.b.map((x, j) => x ? -1 : j).filter(j => j >= 0);
      const vals = empties.map(j => { const nb = pz.b.slice(); nb[j] = 'X'; return evalX(nb, 'O'); });
      const best = Math.max.apply(null, vals); const mine = vals[empties.indexOf(i)];
      const name = v => v === 1 ? 'X wins' : v === 0 ? 'a draw' : 'O wins';
      pz.verdict = mine === best ? { ok: true, text: `That square leads to ${name(mine)} with best play.` } : { ok: false, text: `That square leads to ${name(mine)}; the best square leads to ${name(best)}.` };
      if (mine === best){ pz.solved++; $('#gt-solved').textContent = pz.solved; if (pz.solved >= 3) earn('gt-tree'); }
      puzVerdict();
    });
    host.appendChild(btn);
  });
}
function buildTree(b, player){
  const node = { b: b.slice(), player, value: evalX(b.slice(), player), children: [], leaves: 1 };
  if (winner(b)) return node;
  for (let i = 0; i < 9; i++){ if (b[i]) continue; const nb = b.slice(); nb[i] = player; const child = buildTree(nb, other(player)); node.children.push({ move: i, node: child }); }
  node.leaves = node.children.reduce((a, c) => a + c.node.leaves, 0) || 1;
  return node;
}
function miniSvg(x, y, b, size, highlight){
  const c = size / 3; let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="${highlight ? 'var(--math-soft)' : 'var(--surface)'}" stroke="currentColor" stroke-width="2"/>`;
  s += `<path d="M${x + c} ${y}v${size}M${x + 2 * c} ${y}v${size}M${x} ${y + c}h${size}M${x} ${y + 2 * c}h${size}" stroke="currentColor" stroke-width="1.5"/>`;
  b.forEach((v, i) => {
    if (!v) return; const cx = x + (i % 3) * c + c / 2, cy = y + Math.floor(i / 3) * c + c / 2, r = c * 0.28;
    if (v === 'X') s += `<path d="M${cx - r} ${cy - r}l${2 * r} ${2 * r}M${cx + r} ${cy - r}l${-2 * r} ${2 * r}" stroke="var(--you)" stroke-width="3" stroke-linecap="round"/>`;
    else s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--robo)" stroke-width="3"/>`;
  });
  return s;
}
$('#gt-show').addEventListener('click', () => {
  const tree = buildTree(pz.b, 'X');
  const SIZE = 54, GAPX = 66, LEVEL = 100;
  const GUTTER = 104;   // room for the "X picks max" labels, so they never sit under a position
  const width = Math.max(420, tree.leaves * GAPX + GUTTER + 20);
  let s = ''; let cursor = GUTTER;
  const val = v => (v === 1 ? '+1' : v === 0 ? '0' : '−1');
  const col = v => (v === 1 ? 'var(--you)' : v === 0 ? 'var(--ink-soft)' : 'var(--robo)');
  function place(node, depth, onBest){
    let x;
    if (!node.children.length){ x = cursor; cursor += GAPX; }
    else {
      const bestVal = node.value;
      const xs = node.children.map(ch => place(ch.node, depth + 1, onBest && ch.node.value === bestVal));
      x = (xs[0] + xs[xs.length - 1]) / 2;
      node.children.forEach((ch, k) => { s += `<line x1="${x + SIZE / 2}" y1="${depth * LEVEL + 20 + SIZE}" x2="${xs[k] + SIZE / 2}" y2="${(depth + 1) * LEVEL + 20}" stroke="${onBest && ch.node.value === bestVal ? 'var(--math)' : 'currentColor'}" stroke-width="${onBest && ch.node.value === bestVal ? 3 : 1.5}" opacity="${onBest && ch.node.value === bestVal ? 1 : .5}"/>`; });
    }
    node.x = x;
    s += miniSvg(x, depth * LEVEL + 20, node.b, SIZE, onBest);
    s += `<text x="${x + SIZE / 2}" y="${depth * LEVEL + 20 + SIZE + 16}" text-anchor="middle" fill="${col(node.value)}">${val(node.value)}</text>`;
    return x;
  }
  place(tree, 0, true);
  const depthMax = 3; const height = (depthMax + 1) * LEVEL + 10;
  s += `<text class="lbl" x="4" y="${20 + SIZE / 2}">X picks max</text><text class="lbl" x="4" y="${LEVEL + 20 + SIZE / 2}">O picks min</text><text class="lbl" x="4" y="${2 * LEVEL + 20 + SIZE / 2}">X picks max</text>`;
  const svg = $('#gt-tree'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.style.maxWidth = width + 'px'; svg.innerHTML = s; $('#gt-tree-wrap').hidden = false; $('#gt-tree-note').hidden = true;
  pz.shown = true;
  if (!pz.answered) turn(PUZ, 'math', 'The yellow path is the best line of play. Values: +1 X wins, 0 draw, −1 O wins. Now click the best square.', 'The tree');
  else puzVerdict();
  reveal($('#gt-tree-wrap'));
});
$('#gt-next').addEventListener('click', puzzleNew);
puzzleNew();

/* ================= symmetry drawing ================= */
(function(){
  const mini = (x, y, xs) => miniSvg(x, y, (function(){ const b = Array(9).fill(''); xs.forEach(i => { b[i] = 'X'; }); return b; })(), 90, false);
  $('#gt-sym').innerHTML =
    `<g fill="none" stroke="currentColor" stroke-width="2.5"><path d="M260 100L85 130M260 100L260 130M260 100L435 130"/></g>` +
    mini(215, 10, []) + mini(40, 130, [0]) + mini(215, 130, [1]) + mini(390, 130, [4]) +
    `<text x="85" y="240" text-anchor="middle">corner <tspan class="sub">4 of these</tspan></text>` +
    `<text x="260" y="240" text-anchor="middle">edge <tspan class="sub">4 of these</tspan></text>` +
    `<text x="435" y="240" text-anchor="middle">center <tspan class="sub">just 1</tspan></text>`;
})();
})();

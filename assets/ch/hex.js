/* Chapter: Hex (the game, the no-draw theorem, strategy stealing, Monte Carlo Robo). */
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, seg, fmtNum } = WM;

/* @core-start
   Pure game logic. No DOM in here: the unit tests slice this block out and run it in node. */
const EMPTY = 0, RED = 1, BLUE = 2;
const DIRS = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]];
const nbCache = {};
/* Neighbor table for an n by n rhombus: entry i*6+k is the k-th neighbor of cell i, or -1 off the board. */
function neighborTable(n){
  if (nbCache[n]) return nbCache[n];
  const t = new Int16Array(n * n * 6);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
    const i = r * n + c;
    for (let k = 0; k < 6; k++){
      const rr = r + DIRS[k][0], cc = c + DIRS[k][1];
      t[i * 6 + k] = (rr >= 0 && rr < n && cc >= 0 && cc < n) ? rr * n + cc : -1;
    }
  }
  nbCache[n] = t; return t;
}
/* Reusable scratch space for breadth-first searches (generation stamps avoid clearing arrays). */
function makeScratch(n){ return { seen: new Int32Array(n * n), gen: 0, q: new Int16Array(n * n), parent: new Int16Array(n * n) }; }
/* Does colour col connect its two edges? Red: top row to bottom row. Blue: left column to right column. */
function spans(cells, n, col, s){
  const nb = neighborTable(n), N = n * n, seen = s.seen, q = s.q, gen = ++s.gen;
  let h = 0, t = 0;
  for (let k = 0; k < n; k++){
    const i = col === RED ? k : k * n;
    if (cells[i] === col){ seen[i] = gen; q[t++] = i; }
  }
  while (h < t){
    const i = q[h++];
    if (col === RED ? i >= N - n : i % n === n - 1) return true;
    for (let k = 0; k < 6; k++){
      const j = nb[i * 6 + k];
      if (j >= 0 && seen[j] !== gen && cells[j] === col){ seen[j] = gen; q[t++] = j; }
    }
  }
  return false;
}
/* One shortest winning chain for col (list of cell indices from edge to edge), or null. */
function chainOf(cells, n, col, s){
  const nb = neighborTable(n), N = n * n, seen = s.seen, q = s.q, par = s.parent, gen = ++s.gen;
  let h = 0, t = 0;
  for (let k = 0; k < n; k++){
    const i = col === RED ? k : k * n;
    if (cells[i] === col){ seen[i] = gen; par[i] = -1; q[t++] = i; }
  }
  while (h < t){
    const i = q[h++];
    if (col === RED ? i >= N - n : i % n === n - 1){
      const path = []; for (let x = i; x >= 0; x = par[x]) path.push(x);
      return path.reverse();
    }
    for (let k = 0; k < 6; k++){
      const j = nb[i * 6 + k];
      if (j >= 0 && seen[j] !== gen && cells[j] === col){ seen[j] = gen; par[j] = i; q[t++] = j; }
    }
  }
  return null;
}
function winnerOf(cells, n, s){ return spans(cells, n, RED, s) ? RED : spans(cells, n, BLUE, s) ? BLUE : EMPTY; }
function emptiesOf(cells){ const e = []; for (let i = 0; i < cells.length; i++) if (cells[i] === EMPTY) e.push(i); return e; }
/* Fill every empty cell at random, alternating colours starting with toMove. A full Hex board always has exactly one winner. */
function randomFill(cells, n, toMove){
  const e = emptiesOf(cells);
  for (let i = e.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; const t = e[i]; e[i] = e[j]; e[j] = t; }
  for (let i = 0; i < e.length; i++) cells[e[i]] = (i & 1) === 0 ? toMove : 3 - toMove;
  return cells;
}
/* Monte Carlo: put player's stone on cell i, then finish the game at random N times. Returns how many of those finishes player won. */
function evalMove(cells, n, player, i, N, s){
  const work = Uint8Array.from(cells); work[i] = player;
  const e = emptiesOf(work), k = e.length, other = 3 - player;
  let wins = 0;
  for (let p = 0; p < N; p++){
    for (let a = k - 1; a > 0; a--){ const b = (Math.random() * (a + 1)) | 0; const t = e[a]; e[a] = e[b]; e[b] = t; }
    for (let a = 0; a < k; a++) work[e[a]] = (a & 1) === 0 ? other : player;   // the other player moves next
    const redWins = spans(work, n, RED, s);
    if ((player === RED) === redWins) wins++;
  }
  return wins;
}
/* A bridge: two stones of one colour that are not neighbours but share exactly two neighbours, both empty.
   Whoever owns the stones can always join them: if the opponent takes one shared cell, take the other. */
function commonEmptyNeighbors(cells, n, i, j){
  const nb = neighborTable(n), out = [];
  for (let a = 0; a < 6; a++){
    const x = nb[i * 6 + a]; if (x < 0) continue;
    for (let b = 0; b < 6; b++) if (nb[j * 6 + b] === x){ out.push(x); break; }
  }
  return out;
}
function adjacent(n, i, j){ const nb = neighborTable(n); for (let k = 0; k < 6; k++) if (nb[i * 6 + k] === j) return true; return false; }
function bridgePartners(cells, n, i){
  const col = cells[i], out = [];
  for (let j = 0; j < cells.length; j++){
    if (j === i || cells[j] !== col || adjacent(n, i, j)) continue;
    const com = commonEmptyNeighbors(cells, n, i, j);
    if (com.length === 2 && cells[com[0]] === EMPTY && cells[com[1]] === EMPTY) out.push({ stone: j, gap: com });
  }
  return out;
}
/* Exact solver for small positions (the paper puzzles). Returns true when toMove can force a win.
   Full search with a memo, plus two exact shortcuts: take an immediate win, and if the opponent
   threatens to win next move, the only candidate is to block (two threats means it is lost). */
function posKey(cells, toMove){ let k = toMove; for (let i = 0; i < cells.length; i++) k = k * 3 + cells[i]; return k; }
function wouldWin(cells, n, col, i, s){ cells[i] = col; const w = spans(cells, n, col, s); cells[i] = EMPTY; return w; }
function canWin(cells, n, toMove, s, memo){
  const key = posKey(cells, toMove);
  const hit = memo.get(key); if (hit !== undefined) return hit;
  const other = 3 - toMove, e = emptiesOf(cells);
  let res = false, forced = -1, threats = 0;
  for (const i of e) if (wouldWin(cells, n, toMove, i, s)){ res = true; break; }
  if (!res){
    for (const i of e) if (wouldWin(cells, n, other, i, s)){ threats++; forced = i; if (threats > 1) break; }
    if (threats <= 1){
      const cand = threats === 1 ? [forced] : e;
      for (const i of cand){
        cells[i] = toMove;
        res = !canWin(cells, n, other, s, memo);
        cells[i] = EMPTY;
        if (res) break;
      }
    }
  }
  memo.set(key, res); return res;
}
function winningMoves(cells, n, toMove, s, memo){
  const out = [];
  for (let i = 0; i < cells.length; i++){
    if (cells[i] !== EMPTY) continue;
    cells[i] = toMove;
    if (spans(cells, n, toMove, s) || !canWin(cells, n, 3 - toMove, s, memo)) out.push(i);
    cells[i] = EMPTY;
  }
  return out;
}
/* Does the set sel (cell indices) form one connected chain of a single colour from that colour's edge to its other edge? */
function isTracedChain(cells, n, sel){
  if (!sel.length) return false;
  const col = cells[sel[0]]; if (col === EMPTY) return false;
  for (const i of sel) if (cells[i] !== col) return false;
  const inSel = new Uint8Array(n * n); for (const i of sel) inSel[i] = 1;
  const sub = new Uint8Array(n * n); for (const i of sel) sub[i] = col;
  if (!spans(sub, n, col, makeScratch(n))) return false;
  const nb = neighborTable(n), seen = new Uint8Array(n * n), q = [sel[0]]; seen[sel[0]] = 1; let cnt = 1;
  while (q.length){ const i = q.pop(); for (let k = 0; k < 6; k++){ const j = nb[i * 6 + k]; if (j >= 0 && inSel[j] && !seen[j]){ seen[j] = 1; cnt++; q.push(j); } } }
  return cnt === sel.length;
}
const cellName = (n, i) => String.fromCharCode(97 + (i % n)) + (Math.floor(i / n) + 1);
function cellIndex(n, name){ const c = name.charCodeAt(0) - 97, r = parseInt(name.slice(1), 10) - 1; return r * n + c; }
/* @core-end */

/* ================= SVG board view ================= */
const R = 30, W = Math.sqrt(3) * R;
function geo(n, labels){
  const x0 = labels ? 40 : 18, y0 = labels ? 36 : 18;
  const cx = (r, c) => x0 + W / 2 + (c + r / 2) * W, cy = r => y0 + R + r * 1.5 * R;
  const verts = (r, c) => { const x = cx(r, c), y = cy(r); return [[x, y - R], [x + W / 2, y - R / 2], [x + W / 2, y + R / 2], [x, y + R], [x - W / 2, y + R / 2], [x - W / 2, y - R / 2]]; };
  return { n, x0, y0, cx, cy, verts, width: x0 + (n + (n - 1) / 2) * W + 18, height: y0 + (n - 1) * 1.5 * R + 2 * R + 18 };
}
const P = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
function svgEl(tag, attrs){ const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
/* Build a board inside host. Returns a view with update({cells, chain, hint, last, sel, live}). */
function makeView(host, n, opts){
  opts = opts || {};
  const g = geo(n, opts.labels !== false);
  host.innerHTML = '';
  const svg = svgEl('svg', { viewBox: `0 0 ${g.width.toFixed(0)} ${g.height.toFixed(0)}`, class: 'hx-svg' + (opts.small ? ' small' : ''), role: 'img' });
  svg.setAttribute('aria-label', `${n} by ${n} Hex board`);
  // coloured edges, drawn under the cells so half the band shows outside the rhombus
  const top = [], bottom = [], left = [], right = [];
  for (let c = 0; c < n; c++){ const v = g.verts(0, c); top.push(v[5], v[0], v[1]); const b = g.verts(n - 1, c); bottom.push(b[4], b[3], b[2]); }
  for (let r = 0; r < n; r++){ const v = g.verts(r, 0); left.push(v[5], v[4], v[3]); const w = g.verts(r, n - 1); right.push(w[0], w[1], w[2]); }
  svg.appendChild(svgEl('polyline', { class: 'band band-robo', points: P(left) }));
  svg.appendChild(svgEl('polyline', { class: 'band band-robo', points: P(right) }));
  svg.appendChild(svgEl('polyline', { class: 'band band-you', points: P(top) }));
  svg.appendChild(svgEl('polyline', { class: 'band band-you', points: P(bottom) }));
  const cellsG = svgEl('g', {}); svg.appendChild(cellsG);
  const polys = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
    const i = r * n + c;
    const p = svgEl('polygon', { class: 'cell e', points: P(g.verts(r, c)), 'data-i': i });
    p.appendChild(svgEl('title', {})).textContent = cellName(n, i);
    cellsG.appendChild(p); polys.push(p);
  }
  if (opts.labels !== false){
    for (let c = 0; c < n; c++){ const t = svgEl('text', { x: g.cx(0, c).toFixed(1), y: (g.y0 - 18).toFixed(1), 'text-anchor': 'middle' }); t.textContent = String.fromCharCode(97 + c); svg.appendChild(t); }
    for (let r = 0; r < n; r++){ const t = svgEl('text', { x: (g.cx(r, 0) - W / 2 - 22).toFixed(1), y: (g.cy(r) + 4).toFixed(1), 'text-anchor': 'middle' }); t.textContent = r + 1; svg.appendChild(t); }
  }
  const marks = svgEl('g', { class: 'marks' }); svg.appendChild(marks);
  host.appendChild(svg);
  const view = { svg, n, g, polys };
  view.update = st => {
    const cells = st.cells;
    const hint = st.hint == null ? -1 : st.hint, sel = st.sel || [];
    for (let i = 0; i < polys.length; i++){
      const v = cells[i];
      polys[i].setAttribute('class', 'cell ' + (v === RED ? 'r' : v === BLUE ? 'b' : 'e') + (i === hint ? ' hint' : '') + (sel.indexOf(i) >= 0 ? ' sel' : '') + (st.dim && st.chain && st.chain.indexOf(i) < 0 && v !== EMPTY ? ' dim' : ''));
    }
    svg.classList.toggle('live', !!st.live);
    marks.innerHTML = '';
    if (st.chain && st.chain.length){
      const pts = st.chain.map(i => [g.cx(Math.floor(i / n), i % n), g.cy(Math.floor(i / n))]);
      marks.appendChild(svgEl('polyline', { class: 'chain-under', points: P(pts) }));
      marks.appendChild(svgEl('polyline', { class: 'chain', points: P(pts) }));
    }
    if (st.last != null && st.last >= 0){
      marks.appendChild(svgEl('circle', { class: 'last', cx: g.cx(Math.floor(st.last / n), st.last % n).toFixed(1), cy: g.cy(Math.floor(st.last / n)).toFixed(1), r: 5 }));
    }
  };
  view.onCell = fn => svg.addEventListener('click', ev => { const p = ev.target.closest && ev.target.closest('polygon[data-i]'); if (p) fn(+p.dataset.i); });
  return view;
}

/* ================= board 1: play Robo ================= */
const game = { n: 6, cells: null, turn: RED, first: RED, over: false, busy: false, playouts: 200, hint: -1, last: -1, hintUsed: false, bridged: false, s: null, log: [], lastThink: null };
let view1 = null;
const st1 = html => { $('#hx-status').innerHTML = html; };
function renderGame(chain){
  view1.update({ cells: game.cells, chain: chain || null, hint: game.hint, last: game.last, live: !game.over && !game.busy && game.turn === RED });
  $('#hx-hint').disabled = game.over || game.busy || game.turn !== RED;
  $('#hx-log').innerHTML = game.log.slice(-3).join('<br>');
}
function newGame(){
  game.cells = new Uint8Array(game.n * game.n); game.s = makeScratch(game.n);
  game.turn = game.first; game.over = false; game.busy = false; game.hint = -1; game.last = -1; game.hintUsed = false; game.bridged = false; game.log = [];
  view1 = makeView($('#hx-board'), game.n);
  view1.onCell(youPlay);
  renderGame();
  $('#hx-rules').textContent = `${game.n} by ${game.n}. Red joins top to bottom. Blue joins left to right. No draws.`;
  if (game.turn === RED) st1('Your turn. Click any empty cell.');
  else { st1('Robo goes first...'); roboMove(); }
}
/* Run the Monte Carlo evaluation for player on the current position, yielding to the browser now and then. */
async function think(cells, n, player, N){
  const t0 = performance.now(); let lastYield = t0;
  const s = makeScratch(n), results = [];
  for (const i of emptiesOf(cells)){
    results.push({ idx: i, wins: evalMove(cells, n, player, i, N, s) });
    if (performance.now() - lastYield > 12){ await wait(0); lastYield = performance.now(); }
  }
  results.sort((a, b) => b.wins - a.wins || a.idx - b.idx);
  const best = results.filter(r => r.wins === results[0].wins);
  return { results, choice: pick(best).idx, playouts: results.length * N, N, ms: performance.now() - t0, player, cells: Uint8Array.from(cells) };
}
function finish(winner){
  game.over = true; game.busy = false; game.hint = -1;
  const chain = chainOf(game.cells, game.n, winner, game.s);
  renderGame(chain);
  if (winner === RED){
    const fair = game.n >= 6 && !game.hintUsed;
    st1(`<span class="win-c">You connected top to bottom. You win!</span>` + (fair ? '' : game.hintUsed ? ' <span class="note">(A win with hints does not earn the star. Play one without.)</span>' : ' <span class="note">(The star needs a 6 by 6 board or bigger.)</span>'));
    game.log.push('You win.');
    if (fair){ earn('hx-win'); if (game.bridged) earn('hx-bridge'); }
  } else {
    st1(`<span class="robo">Robo connected left to right.</span> Look at where its chain crossed yours, then try again.`);
    game.log.push('Robo wins.');
  }
  $('#hx-log').innerHTML = game.log.slice(-3).join('<br>');
}
async function roboMove(){
  game.turn = BLUE; game.busy = true; game.hint = -1; renderGame();
  const N = game.playouts, empties = emptiesOf(game.cells).length;
  st1(`Robo is imagining ${fmtNum(empties * N)} finished games...`);
  await wait(500);
  const th = await think(game.cells, game.n, BLUE, N);
  if (game.over || game.turn !== BLUE) return;   // a new game started while Robo was thinking
  game.lastThink = th;
  game.cells[th.choice] = BLUE; game.last = th.choice;
  const name = cellName(game.n, th.choice), top = th.results[0];
  game.log.push(`Robo: ${name} (won ${top.wins} of ${N} imagined games).`);
  showThink(th);
  $('#hx-imagined').textContent = fmtNum(th.playouts); $('#hx-pick').textContent = name;
  $('#hx-rate').textContent = Math.round(100 * top.wins / N) + '%'; $('#hx-ms').textContent = Math.round(th.ms) + ' ms';
  if (spans(game.cells, game.n, BLUE, game.s)) return finish(BLUE);
  game.turn = RED; game.busy = false; renderGame();
  st1(`Robo played <b class="robo">${name}</b> after imagining ${fmtNum(th.playouts)} finished games. Your turn.`);
}
function youPlay(i){
  if (game.over || game.busy || game.turn !== RED || game.cells[i] !== EMPTY) return;
  const bridges = bridgePartners(game.cells, game.n, i).length;   // computed before the stone lands? no: partners need the colour
  game.cells[i] = RED; game.last = i; game.hint = -1;
  const made = bridgePartners(game.cells, game.n, i);
  if (made.length){ game.bridged = true; game.log.push(`You: ${cellName(game.n, i)}. That makes a bridge with ${made.map(b => cellName(game.n, b.stone)).join(' and ')}.`); }
  else game.log.push(`You: ${cellName(game.n, i)}.`);
  void bridges;
  if (spans(game.cells, game.n, RED, game.s)) return finish(RED);
  if (emptiesOf(game.cells).length === 0) return finish(winnerOf(game.cells, game.n, game.s));
  roboMove();
}
$('#hx-hint').addEventListener('click', async () => {
  if (game.over || game.busy || game.turn !== RED) return;
  game.busy = true; game.hintUsed = true; renderGame();
  st1('Imagining games for you...');
  const th = await think(game.cells, game.n, RED, game.playouts);
  if (game.over || game.turn !== RED) return;
  game.busy = false; game.hint = th.choice; renderGame();
  const top = th.results[0];
  st1(`Hint: <b class="you">${cellName(game.n, th.choice)}</b> won ${top.wins} of ${game.playouts} random finishes, the best of ${th.results.length} cells. (Hints switch off the star for this game.)`);
});
$('#hx-new').addEventListener('click', newGame);
seg($('#hx-first'), v => { game.first = v === 'you' ? RED : BLUE; newGame(); });
seg($('#hx-size'), v => { game.n = +v; newGame(); });
seg($('#hx-strength'), v => { game.playouts = +v; });

/* ================= inside Robo's head (the live table) ================= */
function showThink(th){
  const n = Math.sqrt(th.cells.length);
  const rows = th.results.slice(0, 5).map(r => `<tr class="${r.idx === th.choice ? 'hl' : ''}"><td>${cellName(n, r.idx)}</td><td>${r.wins}</td><td>${th.N}</td><td>${(100 * r.wins / th.N).toFixed(1)}%</td></tr>`).join('');
  $('#hx-table').innerHTML = `<tr><th>Cell</th><th>Wins</th><th>Playouts</th><th>Win rate</th></tr>${rows}`;
  const worst = th.results[th.results.length - 1];
  $('#hx-table-note').innerHTML = `${th.results.length} empty cells, ${th.N} random finishes each, ${fmtNum(th.playouts)} games in ${Math.round(th.ms)} ms. Robo played <b class="robo">${cellName(n, th.choice)}</b>. The worst cell was ${cellName(n, worst.idx)} with ${worst.wins} wins.`;
  $('#hx-again').disabled = false;
}
$('#hx-again').addEventListener('click', async () => {
  const prev = game.lastThink; if (!prev) return;
  $('#hx-again').disabled = true;
  const th = await think(prev.cells, Math.sqrt(prev.cells.length), prev.player, prev.N);
  const before = prev.results[0], after = th.results[0];
  showThink(th);
  const n = Math.sqrt(th.cells.length);
  $('#hx-table-note').innerHTML += ` <b>Same position, new random games:</b> last time the top cell was ${cellName(n, before.idx)} with ${before.wins} wins, now it is ${cellName(n, after.idx)} with ${after.wins}. That wobble is the sampling error.`;
  game.lastThink = Object.assign({}, prev, { results: th.results, choice: th.choice, ms: th.ms });
});

/* ================= board 2: fill the board ================= */
const fill = { n: 6, cells: null, mode: 'trace', sel: [], revealed: false, traced: 0, s: null, counted: false };
let view2 = null;
const st2 = html => { $('#hx-fill-status').innerHTML = html; };
function renderFill(chain){
  view2.update({ cells: fill.cells, chain: chain || null, sel: fill.sel, live: true });
  $('#hx-traced').textContent = `Chains traced: ${fill.traced} of 3`;
}
function fillRandom(){
  fill.cells = new Uint8Array(fill.n * fill.n); randomFill(fill.cells, fill.n, RED);
  fill.mode = 'trace'; fill.sel = []; fill.revealed = false; fill.counted = false;
  renderFill();
  st2('A random full board. Somebody won. Click every cell of one winning chain, edge to edge, to trace it.');
}
function fillClear(){
  fill.cells = new Uint8Array(fill.n * fill.n); fill.mode = 'paint'; fill.sel = []; fill.revealed = false; fill.counted = false;
  renderFill();
  st2(`Empty board. Click a cell to paint it red, again for blue, again to clear. Try to fill all ${fill.n * fill.n} cells with no winner.`);
}
function fillShow(){
  const w = winnerOf(fill.cells, fill.n, fill.s);
  if (!w){ st2('No winner yet: the board is not full. Finish painting it.'); return; }
  fill.revealed = true; fill.sel = [];
  renderFill(chainOf(fill.cells, fill.n, w, fill.s));
  st2(`${w === RED ? '<b class="you">Red</b> connects top to bottom' : '<b class="robo">Blue</b> connects left to right'}. Follow the green line.`);
}
function fillClick(i){
  if (fill.mode === 'paint'){
    fill.cells[i] = (fill.cells[i] + 1) % 3;
    const left = emptiesOf(fill.cells).length;
    if (left){ renderFill(); st2(`${left} cell${left > 1 ? 's' : ''} still empty. No winner is possible until the board is full.`); return; }
    const w = winnerOf(fill.cells, fill.n, fill.s);
    renderFill(chainOf(fill.cells, fill.n, w, fill.s));
    st2(`Full board, and ${w === RED ? '<b class="you">red</b> connects top to bottom' : '<b class="robo">blue</b> connects left to right'}. Change any cell and check again: there is always a winner.`);
    return;
  }
  if (fill.revealed) return;
  const k = fill.sel.indexOf(i);
  if (k >= 0) fill.sel.splice(k, 1); else fill.sel.push(i);
  if (isTracedChain(fill.cells, fill.n, fill.sel)){
    const col = fill.cells[fill.sel[0]];
    if (!fill.counted){ fill.counted = true; fill.traced++; }
    fill.revealed = true;
    renderFill(chainOf(fill.cells, fill.n, col, fill.s));
    st2(`<span class="win-c">That is a winning chain.</span> ${col === RED ? 'Red' : 'Blue'} owns this board.` + (fill.traced < 3 ? ' Fill again for a new one.' : ''));
    if (fill.traced >= 3) earn('hx-chain');
    return;
  }
  renderFill();
  const colours = new Set(fill.sel.map(x => fill.cells[x]));
  if (colours.size > 1) st2(`${fill.sel.length} cells selected, but they are not all one colour. A chain is one colour only.`);
  else st2(`${fill.sel.length} cell${fill.sel.length === 1 ? '' : 's'} selected. Keep going until the chain touches both of its edges with no gaps.`);
}
function fillNew(){ fill.s = makeScratch(fill.n); view2 = makeView($('#hx-fill-board'), fill.n); view2.onCell(fillClick); fillRandom(); }
$('#hx-fill-random').addEventListener('click', fillRandom);
$('#hx-fill-clear').addEventListener('click', fillClear);
$('#hx-fill-show').addEventListener('click', fillShow);
seg($('#hx-fill-size'), v => { fill.n = +v; fillNew(); });

/* ================= paper puzzles: tiny boards checked by an exact solver ================= */
function parsePos(n, str){
  const cells = new Uint8Array(n * n);
  (str || '').split(/[;\s]+/).filter(Boolean).forEach(tok => { const col = tok[0] === 'r' ? RED : BLUE; tok.slice(2).split(',').forEach(nm => { cells[cellIndex(n, nm)] = col; }); });
  return cells;
}
$$('.hx-mini').forEach(host => {
  const n = +host.dataset.n, base = parsePos(n, host.dataset.pos), msg = $('#' + host.id + '-msg');
  const s = makeScratch(n), memo = new Map();
  const view = makeView(host, n, { small: true });
  let probe = -1, wins = null;
  const draw = chain => view.update({ cells: probe >= 0 ? (() => { const c = Uint8Array.from(base); c[probe] = RED; return c; })() : base, last: probe, chain: chain || null, live: true });
  draw();
  view.onCell(i => {
    if (base[i] !== EMPTY) return;
    if (!wins) wins = winningMoves(base, n, RED, s, memo);
    probe = i;
    const c = Uint8Array.from(base); c[i] = RED;
    if (spans(c, n, RED, s)){ draw(chainOf(c, n, RED, s)); msg.innerHTML = `<span class="win-c">${cellName(n, i)} connects top to bottom right away.</span>`; return; }
    if (wins.indexOf(i) >= 0){
      draw();
      const threats = winningMoves(c, n, RED, s, memo).length;
      msg.innerHTML = `<span class="win-c">${cellName(n, i)} wins.</span> Whatever blue does now, red has an answer that keeps a winning position` + (threats > 1 ? `: red has ${threats} winning replies in reserve` : '') + `. ${wins.length === 1 ? 'It is the only winning move.' : `(${wins.length} first moves win here: ${wins.map(x => cellName(n, x)).join(', ')}.)`}`;
    } else {
      const reply = winningMoves(c, n, BLUE, s, memo);
      draw();
      msg.innerHTML = `<span class="robo">Not ${cellName(n, i)}.</span> Blue answers <b class="robo">${cellName(n, reply[0])}</b> and can force a win from there. ${wins.length === 1 ? 'There is exactly one winning move.' : `There are ${wins.length} winning moves.`}`;
    }
  });
});

/* ================= boot ================= */
newGame();
fillNew();
})();

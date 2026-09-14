/* Chapter: Traffic (Braess's paradox). Four boards: the two-route map, the bridge, the planner, Pigou's two roads. */
(function(){
'use strict';
const { $, $$, wait, earn, seg, fmtNum } = WM;

/* @pure-start
   Everything between the pure markers is DOM-free. The node test (scratch) evaluates this block on its own. */
const SLOPE = 100;   // a narrow road carrying f cars takes f / SLOPE minutes
const FIXED = 45;    // a wide highway takes FIXED minutes whatever the traffic
const ROUTES = ['a', 'b', 'c'];   // a = S-A-E (top), b = S-B-E (bottom), c = S-A-B-E (over the bridge)
const NAMES = { a: 'top route', b: 'bottom route', c: 'bridge route' };
const PATHS = { a: 'S→A→E', b: 'S→B→E', c: 'S→A→B→E' };
const cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function usedRoutes(bridge){ return bridge ? ROUTES : ['a', 'b']; }
function edgeFlows(f){ return { SA: f.a + f.c, AE: f.a, SB: f.b, BE: f.b + f.c, AB: f.c }; }
function edgeTimes(f){ const e = edgeFlows(f); return { SA: e.SA / SLOPE, AE: FIXED, SB: FIXED, BE: e.BE / SLOPE, AB: 0 }; }
function routeTimes(f){ const t = edgeTimes(f); return { a: t.SA + t.AE, b: t.SB + t.BE, c: t.SA + t.AB + t.BE }; }
function carCount(f){ return f.a + f.b + f.c; }
function totalTime(f){ const t = routeTimes(f); return f.a * t.a + f.b * t.b + f.c * t.c; }
function avgTime(f){ const n = carCount(f); return n ? totalTime(f) / n : 0; }

/* One driver on route r asks: if I alone moved to route s, how long would my trip be? */
function timeIfMoved(f, r, s){ const g = Object.assign({}, f); g[r] -= 1; g[s] += 1; return routeTimes(g)[s]; }
/* The best switch for a driver on r: the route that saves the most time, or null if no switch saves anything. */
function bestMove(f, r, bridge){
  let best = null, bestT = routeTimes(f)[r] - 1e-9;
  for (const s of usedRoutes(bridge)){
    if (s === r) continue;
    const ts = timeIfMoved(f, r, s);
    if (ts < bestT){ bestT = ts; best = s; }
  }
  return best;
}
/* Nash equilibrium with the drivers as the players: nobody on any route can cut their own time by switching. */
function isEquilibrium(f, bridge){ return usedRoutes(bridge).every(r => f[r] === 0 || bestMove(f, r, bridge) === null); }

/* The equilibrium, worked out by hand (the node test checks it against isEquilibrium and against the dynamics).
   Without the bridge: an even split. With it: everyone on the bridge route while N <= FIXED * SLOPE (4,500 cars);
   above that the two old routes fill up until every route takes 2 * FIXED minutes; above 2 * FIXED * SLOPE the bridge is unused. */
function equilibrium(N, bridge){
  const K = FIXED * SLOPE;
  if (bridge && N <= K) return { a: 0, b: 0, c: N };
  if (bridge && N < 2 * K){ const a = N - K; return { a, b: a, c: 2 * K - N }; }
  const a = Math.floor(N / 2);
  return { a, b: N - a, c: 0 };
}
/* The planner's best plan (smallest total time) when the bridge is available.
   By the map's top-bottom mirror symmetry the best plan has a = b; with x cars over the bridge the total is
   (N + x)^2 / (2 SLOPE) + FIXED (N - x), a parabola whose bottom is at x = FIXED * SLOPE - N, clamped to 0..N. */
function optimum(N){
  const x = cl(FIXED * SLOPE - N, 0, N);
  const a = Math.floor((N - x) / 2);
  return { a, b: N - x - a, c: x };
}
function priceOfAnarchy(N){ return avgTime(equilibrium(N, true)) / avgTime(optimum(N)); }

/* How fast the gap between routes r and s closes per car that moves from r to s: a hundredth of a minute for every
   narrow road that is on one of the two routes but not the other (a car leaving r unclogs r's own narrow roads,
   a car joining s clogs s's). Top to bottom shares no narrow road, so 2 / SLOPE; top to bridge share S-A, so 1 / SLOPE. */
const EDGE_OF = { a: ['SA', 'AE'], b: ['SB', 'BE'], c: ['SA', 'AB', 'BE'] };
const NARROW = ['SA', 'BE'];
function closeRate(r, s){ return NARROW.filter(e => EDGE_OF[r].includes(e) !== EDGE_OF[s].includes(e)).length / SLOPE; }

/* Best-response dynamics, one round. Routes take turns: the drivers on a route look at the best switch open to them
   and some of them take it: a third of the number that would close the gap while the gap is big (so the reader can
   watch it shrink), and the whole number once the gap is under 0.3 minutes (so the tail does not crawl one car at a time).
   Handling the routes one at a time, with fresh times after each move, keeps the crowd from overshooting. */
function stepDynamics(f, bridge){
  const cur = Object.assign({}, f); const moves = [];
  for (const r of usedRoutes(bridge)){
    if (cur[r] === 0) continue;
    const s = bestMove(cur, r, bridge); if (!s) continue;
    const t = routeTimes(cur); const gap = t[r] - t[s];
    const exact = gap / closeRate(r, s);
    const k = cl(Math.round(gap > 0.3 ? exact / 3 : exact), 1, cur[r]);
    cur[r] -= k; cur[s] += k; moves.push({ from: r, to: s, k });
  }
  return { flows: cur, moves, settled: moves.length === 0 };
}
/* With whole cars there can be a few equilibria a car or two apart (at 6,000 cars, 1,501 / 1,501 / 2,998 is settled:
   the drivers on the 89.99-minute routes would get 89.99 on the bridge route too, so nobody moves). Drivers who gain
   nothing either way are free to move, so the last round lets them: among the equilibria within three cars of the
   settled state, take the one whose routes in use are most nearly equal (fewest cars moved breaks ties). */
function spread(f, bridge){
  const t = routeTimes(f), used = usedRoutes(bridge).filter(r => f[r] > 0).map(r => t[r]);
  return used.length ? Math.max.apply(null, used) - Math.min.apply(null, used) : 0;
}
function tidy(f, bridge){
  if (!isEquilibrium(f, bridge)) return f;
  let best = f, bestKey = [spread(f, bridge), 0];
  const cs = bridge ? [-3, -2, -1, 0, 1, 2, 3] : [0];
  for (let da = -3; da <= 3; da++) for (let db = -3; db <= 3; db++) for (const dc of cs){
    if (da + db + dc !== 0) continue;
    const g = { a: f.a + da, b: f.b + db, c: f.c + dc };
    if (g.a < 0 || g.b < 0 || g.c < 0 || !isEquilibrium(g, bridge)) continue;
    const key = [spread(g, bridge), (Math.abs(da) + Math.abs(db) + Math.abs(dc)) / 2];
    if (key[0] < bestKey[0] - 1e-9 || (Math.abs(key[0] - bestKey[0]) < 1e-9 && key[1] < bestKey[1])){ best = g; bestKey = key; }
  }
  return best;
}
function settle(f, bridge, maxSteps){
  let cur = f, steps = 0;
  while (steps < (maxSteps || 300)){ const s = stepDynamics(cur, bridge); if (s.settled) break; cur = s.flows; steps++; }
  const t = tidy(cur, bridge);
  if (t !== cur) steps++;
  return { flows: t, steps };
}

/* Pigou's two roads. Road 1 always takes 1 hour. Road 2 takes k * x hours when a fraction x of the cars use it. */
function pigou(x, k){ return { r1: 1, r2: k * x, avg: (1 - x) + k * x * x }; }
function pigouEquilibrium(k){ return k <= 1 ? 1 : 1 / k; }         // fraction on road 2 when drivers choose for themselves
function pigouOptimum(k){ return cl(1 / (2 * k), 0, 1); }            // the bottom of the parabola (1 - x) + k x^2
/* @pure-end */

/* ---------- formatting ---------- */
function fmtMin(x){
  const r = Math.round(x * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
}
const mins = x => `${fmtMin(x)} min`;

/* ---------- the map ---------- */
const NODE = { S: [52, 160], A: [320, 54], B: [320, 266], E: [588, 160] };
const EDGES = [
  { id: 'SA', from: 'S', to: 'A', kind: 'narrow', f: 'cars ÷ 100 min', side: -1 },
  { id: 'AE', from: 'A', to: 'E', kind: 'wide', f: 'always 45 min', side: -1 },
  { id: 'SB', from: 'S', to: 'B', kind: 'wide', f: 'always 45 min', side: 1 },
  { id: 'BE', from: 'B', to: 'E', kind: 'narrow', f: 'cars ÷ 100 min', side: 1 },
  { id: 'AB', from: 'A', to: 'B', kind: 'bridge', f: 'the bridge', side: 1 }
];
const MINE_EDGE = { a: 'AE', b: 'SB', c: 'AB' };
const MAX_DOTS = 20;
function drawMap(svg, o){
  const e = edgeFlows(o.flows), t = edgeTimes(o.flows);
  let roads = '', cars = '', labels = '';
  for (const ed of EDGES){
    const isBridge = ed.id === 'AB';
    const closed = isBridge && !o.bridge;
    if (closed && !o.ghost) continue;
    const [x1, y1] = NODE[ed.from], [x2, y2] = NODE[ed.to];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), px = -dy / len, py = dx / len;
    roads += `<line class="tr-road tr-${ed.kind}${closed ? ' tr-closed' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    if (!closed && o.N > 0){
      const n = Math.round(MAX_DOTS * e[ed.id] / o.N);
      for (let i = 0; i < n; i++){
        const u = (i + 0.5) / n, off = i % 2 ? 3.5 : -3.5;
        cars += `<circle class="tr-car" cx="${(x1 + dx * u + px * off).toFixed(1)}" cy="${(y1 + dy * u + py * off).toFixed(1)}" r="4"/>`;
      }
    }
    const mx = x1 + dx / 2, my = y1 + dy / 2;
    if (isBridge){
      labels += closed
        ? `<text class="tr-lab-f" x="${mx + 16}" y="${my}">bridge closed</text>`
        : `<text class="tr-lab-t" x="${mx + 16}" y="${my - 9}">0 min</text><text class="tr-lab-f" x="${mx + 16}" y="${my + 11}">${ed.f}</text>`;
    } else {
      const d = ed.kind === 'wide' ? 30 : 26;
      const lx = (mx + px * d * ed.side).toFixed(1), ly = my + py * d * ed.side;
      const fy = ly + (ed.side < 0 ? -19 : 19);
      labels += `<text class="tr-lab-t" text-anchor="middle" x="${lx}" y="${ly.toFixed(1)}">${mins(t[ed.id])}</text>` +
                `<text class="tr-lab-f" text-anchor="middle" x="${lx}" y="${fy.toFixed(1)}">${ed.f}</text>`;
    }
  }
  let nodes = '';
  for (const k of Object.keys(NODE)){
    const [x, y] = NODE[k];
    nodes += `<circle class="tr-node" cx="${x}" cy="${y}" r="20"/><text class="tr-node-t" x="${x}" y="${y}">${k}</text>`;
  }
  nodes += `<text class="tr-cap" x="${NODE.S[0]}" y="${NODE.S[1] + 36}">start</text><text class="tr-cap" x="${NODE.E[0]}" y="${NODE.E[1] + 36}">end</text>`;
  let you = '';
  if (o.mine && (o.bridge || o.mine !== 'c')){
    const ed = EDGES.find(x => x.id === MINE_EDGE[o.mine]);
    const [x1, y1] = NODE[ed.from], [x2, y2] = NODE[ed.to];
    you = `<circle class="tr-you" cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" r="6.5"><title>your car</title></circle>`;
  }
  svg.innerHTML = roads + cars + nodes + labels + you;
}

/* ---------- a board with sliders over the network (boards 1 to 3 share this) ---------- */
function makeBoard(id, opts){
  const q = s => $(`#${id}-${s}`);
  const bd = {
    N: 4000, flows: { a: 0, b: 0, c: 0 }, bridge: !!opts.bridge, mine: opts.mine ? 'a' : null,
    runId: 0, running: false, settledRun: false, roboSolved: new Set(), peeked: false, log: [],
    shown: opts.sliders, opts
  };
  const sliders = {}, readouts = {};
  for (const r of bd.shown){ sliders[r] = q('s' + r); readouts[r] = $(`[data-for="${id}-s${r}"]`); }

  function defaults(){
    if (opts.planner){ bd.flows = { a: bd.N / 2, b: bd.N / 2, c: 0 }; return; }
    if (opts.startSplit){ bd.flows = { a: Math.round(bd.N * opts.startSplit), b: 0, c: 0 }; bd.flows.b = bd.N - bd.flows.a; return; }
    bd.flows = { a: bd.N / 2, b: bd.N / 2, c: 0 };
  }
  function cancelRun(){ bd.runId++; bd.running = false; bd.settledRun = false; }
  function fixMine(){
    if (!bd.mine) return;
    if (!bd.bridge && bd.mine === 'c') bd.mine = 'a';
    if (bd.flows[bd.mine] === 0){
      const routes = usedRoutes(bd.bridge).filter(r => bd.flows[r] > 0);
      if (routes.length) bd.mine = routes.reduce((p, r) => bd.flows[r] > bd.flows[p] ? r : p);
    }
    const sg = q('mine');
    if (sg) $$('button', sg).forEach(b => { b.classList.toggle('on', b.dataset.v === bd.mine); b.hidden = b.dataset.v === 'c' && !bd.bridge; });
  }
  /* Move route r to v cars; the difference comes from (or goes to) the other routes in proportion to their sizes. */
  function setFlow(r, v){
    v = cl(Math.round(v) || 0, 0, bd.N);
    const others = usedRoutes(bd.bridge).filter(s => s !== r);
    const delta = v - bd.flows[r];
    bd.flows[r] = v;
    if (others.length === 1){ bd.flows[others[0]] = bd.N - v; return; }
    const [o1, o2] = others, f1 = bd.flows[o1], f2 = bd.flows[o2], sum = f1 + f2;
    let d1 = sum > 0 ? Math.round(-delta * f1 / sum) : Math.round(-delta / 2);
    d1 = cl(d1, -f1, bd.N);
    bd.flows[o1] = f1 + d1;
    bd.flows[o2] = bd.N - v - bd.flows[o1];
    if (bd.flows[o2] < 0){ bd.flows[o1] += bd.flows[o2]; bd.flows[o2] = 0; }
    if (bd.flows[o1] < 0){ bd.flows[o2] += bd.flows[o1]; bd.flows[o1] = 0; }
    void f2;
  }

  function statusText(){
    const f = bd.flows, t = routeTimes(f), routes = usedRoutes(bd.bridge);
    const used = routes.filter(r => f[r] > 0);
    if (isEquilibrium(f, bd.bridge)){
      const same = used.every(r => Math.abs(t[r] - t[used[0]]) < 1e-9);
      return `<span class="win-c">Nobody wants to switch.</span> ${same ? `Every route in use takes ${mins(t[used[0]])}.` : 'No driver can save time by moving.'}`;
    }
    let worst = used[0]; for (const r of used) if (t[r] > t[worst]) worst = r;
    const s = bestMove(f, worst, bd.bridge);
    const who = NAMES[worst].replace(' route', '');
    return `The ${NAMES[worst]} takes ${mins(t[worst])}; the ${NAMES[s]} takes ${mins(t[s])}. <span class="robo">${who[0].toUpperCase() + who.slice(1)} drivers want to switch.</span>`;
  }
  function mineText(){
    if (!bd.mine) return '';
    const f = bd.flows, t = routeTimes(f);
    const s = bestMove(f, bd.mine, bd.bridge);
    let h = `<b class="you">Your car</b> is on the ${NAMES[bd.mine]} (${PATHS[bd.mine]}): <b>${mins(t[bd.mine])}</b>. `;
    if (s) h += `If you alone switched to the ${NAMES[s]} you would take <b>${mins(timeIfMoved(f, bd.mine, s))}</b>. You want to switch.`;
    else {
      const alts = usedRoutes(bd.bridge).filter(r => r !== bd.mine).map(r => `${mins(timeIfMoved(f, bd.mine, r))} on the ${NAMES[r]}`);
      h += `Switching would give you ${alts.join(' or ')} (your own car adds a hundredth of a minute wherever it goes). No reason to move.`;
    }
    return h;
  }

  function render(){
    const f = bd.flows, t = routeTimes(f);
    for (const r of bd.shown){
      const sl = sliders[r]; if (!sl) continue;
      sl.max = bd.N; sl.value = f[r]; if (readouts[r]) readouts[r].textContent = fmtNum(f[r]);
      const wrap = sl.closest('.slider'); if (wrap) wrap.hidden = r === 'c' && !bd.bridge;
    }
    const num = q('num'); if (num){ num.value = f.a; num.max = bd.N; }
    const nIn = q('n'); if (nIn) nIn.value = bd.N;
    fixMine();
    drawMap(q('map'), { flows: f, N: bd.N, bridge: bd.bridge, ghost: !!opts.toggle, mine: bd.mine });
    const tile = (k, v) => { const el = q(k); if (el) el.textContent = v; };
    tile('ta', mins(t.a)); tile('tb', mins(t.b)); tile('tc', bd.bridge ? mins(t.c) : 'closed');
    tile('avg', mins(avgTime(f))); tile('tot', fmtNum(Math.round(totalTime(f))) + ' car-min');
    if (bd.mine) tile('tm', mins(t[bd.mine]));
    const tcTile = q('tc'); if (tcTile) tcTile.closest('.stat').hidden = !bd.bridge;
    if (!bd.running){
      const st = q('status'); if (st && !opts.planner) st.innerHTML = statusText();
      const mt = q('mine-txt'); if (mt) mt.innerHTML = mineText();
    }
    const run = q('run'); if (run) run.disabled = bd.running || isEquilibrium(f, bd.bridge);
    const chk = q('check'); if (chk) chk.disabled = bd.running;
    const lg = q('log'); if (lg) lg.innerHTML = bd.log.slice(-4).join('<br>');
    const qb = q('q'); if (qb) qb.hidden = !(bd.settledRun && bd.bridge);
    if (opts.planner) plannerStatus();
  }

  /* ---- planner ---- */
  function plannerStatus(){
    const f = bd.flows, avg = avgTime(f), best = optimum(bd.N), bestAvg = avgTime(best);
    const gap = avg - bestAvg;
    const st = q('status');
    if (gap < 1e-9) st.innerHTML = `<span class="win-c">That is the best plan there is.</span> Average ${fmtMin(avg)} min, total ${fmtNum(totalTime(f))} car-minutes.`;
    else if (gap < 0.0625 + 1e-9) st.innerHTML = `<span class="win-c">Within a hair of the best plan.</span> Average ${fmtMin(avg)} min; the best possible is ${bestAvg} min.`;
    else if (isEquilibrium(f, true)) st.innerHTML = `Average ${fmtMin(avg)} min. This is the selfish equilibrium, ${fmtMin(gap)} min per car worse than the best plan.`;
    else st.innerHTML = `Average ${fmtMin(avg)} min, which is ${fmtMin(gap)} min per car above the best plan.`;
    const bt = q('best'); if (bt) bt.textContent = `${bestAvg} min`;
  }
  function plannerCheck(){
    if (!opts.planner || bd.peeked) return;
    const avg = avgTime(bd.flows), bestAvg = avgTime(optimum(bd.N));
    if (avg <= bestAvg + 0.0625 + 1e-9) earn('tr-planner');
  }

  /* ---- the drivers choose ---- */
  async function run(){
    if (bd.running || isEquilibrium(bd.flows, bd.bridge)) return;
    bd.running = true; bd.settledRun = false; bd.roboSolved.add(bd.N);
    const id = ++bd.runId;
    bd.log = []; let step = 0;
    q('status').innerHTML = 'The drivers look at the times and start switching...';
    render();
    while (step < 300){
      const s = stepDynamics(bd.flows, bd.bridge);
      if (s.settled) break;
      step++; bd.flows = s.flows;
      bd.log.push(`Round ${step}: ` + s.moves.map(m => `${fmtNum(m.k)} left the ${NAMES[m.from]} for the ${NAMES[m.to]}`).join(', ') + '.');
      render();
      const moved = s.moves.reduce((n, m) => n + m.k, 0);
      await wait(step <= 2 ? 800 : moved >= 20 ? 450 : 200);
      if (id !== bd.runId) return;   // the reader changed something mid-run
    }
    const tidied = tidy(bd.flows, bd.bridge);
    if (tidied !== bd.flows){
      step++; bd.flows = tidied;
      bd.log.push(`Round ${step}: the last couple of drivers, who gain nothing either way, shuffle until every route is exactly equal.`);
    }
    bd.running = false; bd.settledRun = true;
    render();
    const t = routeTimes(bd.flows), used = usedRoutes(bd.bridge).filter(r => bd.flows[r] > 0);
    let h = `<span class="win-c">Settled after ${step} round${step === 1 ? '' : 's'}.</span> ` +
      (used.length === 1 ? `Everyone is on the ${NAMES[used[0]]}: ${mins(t[used[0]])} each.` : `Every route in use takes ${mins(t[used[0]])}.`) + ' Nobody wants to switch.';
    if (opts.check && !WM.has('tr-split')) h += ' <span class="note">(The star is for finding the split yourself: change the number of cars and try.)</span>';
    q('status').innerHTML = h;
  }

  /* ---- wiring ---- */
  for (const r of bd.shown){
    const sl = sliders[r]; if (!sl) continue;
    sl.addEventListener('input', () => { cancelRun(); setFlow(r, +sl.value); bd.log = []; render(); plannerCheck(); });
  }
  const num = q('num');
  if (num) num.addEventListener('change', () => { cancelRun(); setFlow('a', +num.value); bd.log = []; render(); });
  const nIn = q('n');
  if (nIn) nIn.addEventListener('change', () => {
    cancelRun(); bd.N = cl(Math.round((+nIn.value || 4000) / 100) * 100, 1000, 10000); defaults(); bd.log = []; render();
  });
  const sg = q('mine');
  if (sg) seg(sg, v => { if (bd.flows[v] > 0 || bd.running){ bd.mine = v; render(); } else { fixMine(); q('mine-txt').innerHTML = `Nobody is on the ${NAMES[v]} right now. Move the slider first.`; } });
  const tg = q('bridge');
  if (tg) seg(tg, v => {
    cancelRun(); bd.log = [];
    const open = v === 'open';
    if (!open && bd.flows.c > 0){ const half = Math.floor(bd.flows.c / 2); bd.flows.a += bd.flows.c - half; bd.flows.b += half; bd.flows.c = 0; }
    bd.bridge = open; render();
    if (open && !opts.planner) q('status').innerHTML = statusText() + ` <span class="note">The bridge route ${PATHS.c} is open.</span>`;
  });
  const run_ = q('run'); if (run_) run_.addEventListener('click', run);
  const reset = q('reset');
  if (reset) reset.addEventListener('click', () => { cancelRun(); bd.N = 4000; bd.log = []; if (tg){ bd.bridge = false; $$('button', tg).forEach(b => b.classList.toggle('on', b.dataset.v === 'closed')); } defaults(); bd.peeked = false; render(); });
  const chk = q('check');
  if (chk) chk.addEventListener('click', () => {
    if (bd.running) return;
    const f = bd.flows, t = routeTimes(f);
    if (isEquilibrium(f, bd.bridge)){
      let h = `<span class="win-c">Yes. Nobody wants to switch.</span> ${fmtNum(f.a)} on top, ${fmtNum(f.b)} on the bottom, ${mins(t.a)} each. A Nash equilibrium with ${fmtNum(bd.N)} players.`;
      if (bd.roboSolved.has(bd.N)) h += ' <span class="note">(You watched the drivers find this one. Change the number of cars and find the new split yourself for the star.)</span>';
      else earn('tr-split');
      q('status').innerHTML = h;
    } else {
      const slow = t.a > t.b ? 'a' : 'b';
      q('status').innerHTML = `Not yet. The ${NAMES[slow]} takes ${mins(t[slow])} and the other ${mins(t[slow === 'a' ? 'b' : 'a'])}, so a ${NAMES[slow].replace(' route', '')} driver would switch. Which way should the slider move?`;
    }
  });
  const hint = q('hint');
  if (hint) hint.addEventListener('click', () => {
    if (opts.planner){
      bd.hints = (bd.hints || 0) + 1;
      const msgs = [
        'Ignoring the bridge gives 65 minutes. Is the bridge really useless to a planner, or only dangerous when drivers choose for themselves?',
        'A car on the bridge route uses no highway at all. What if only a few hundred cars took it, and the rest split evenly?',
        'The best plan puts 500 cars over the bridge and 1,750 on each old route. The Math corner shows why 500.'
      ];
      if (bd.hints >= 3) bd.peeked = true;
      q('status').innerHTML = `<span class="math-c">Hint:</span> ${msgs[Math.min(bd.hints, 3) - 1]}`;
    } else {
      const t = routeTimes(bd.flows);
      q('status').innerHTML = `<span class="math-c">Hint:</span> a driver switches when the other route is faster. So the split is settled only when both routes take the <b>same</b> time. Right now the top takes ${mins(t.a)} and the bottom ${mins(t.b)}.`;
    }
  });
  $$('[data-preset]', $(`#${id}`)).forEach(b => b.addEventListener('click', () => {
    cancelRun(); bd.log = [];
    const p = b.dataset.preset;
    if (p === 'best'){ bd.peeked = true; bd.flows = optimum(bd.N); }
    else if (p === 'even') bd.flows = { a: bd.N / 2, b: bd.N / 2, c: 0 };
    else if (p === 'bridge') bd.flows = { a: 0, b: 0, c: bd.N };
    render();
  }));
  const qb = q('q');
  if (qb) $$('button[data-ans]', qb).forEach(b => b.addEventListener('click', () => {
    if (!bd.settledRun || !bd.bridge) return;
    const withB = avgTime(bd.flows), without = avgTime(equilibrium(bd.N, false));
    const hurts = without > withB + 1e-9;           // closing the bridge would make trips longer
    const ans = b.dataset.ans, msg = q('qmsg');
    if ((ans === 'yes') === hurts){
      if (!hurts){
        msg.innerHTML = `<span class="win-c">Right.</span> With the bridge closed the drivers settle at ${fmtNum(equilibrium(bd.N, false).a)} and ${fmtNum(equilibrium(bd.N, false).b)}, and every trip goes from ${mins(withB)} to ${mins(without)}. ${without < withB - 1e-9 ? 'Closing a road helped every single driver. That is Braess\'s paradox.' : 'Nobody is worse off either way; with more cars the bridge starts to hurt.'}`;
        earn('tr-paradox');
      } else msg.innerHTML = `<span class="win-c">Right.</span> With ${fmtNum(bd.N)} cars the bridge really does help: ${mins(withB)} with it, ${mins(without)} without. The paradox needs more than 3,000 cars on this map.`;
    } else {
      msg.innerHTML = hurts
        ? `Look again. With only ${fmtNum(bd.N)} cars the bridge route is genuinely fast: ${mins(withB)} now, and closing it would push everyone back to ${mins(without)}.`
        : `Look again. Without the bridge the drivers settle at ${mins(without)} for everybody, and right now everybody takes ${mins(withB)}. Who would be worse off?`;
    }
  }));

  defaults(); render();
  return bd;
}

/* ================= board 1: two routes ================= */
makeBoard('tr-b1', { sliders: ['a'], mine: true, check: true, startSplit: 0.75 });

/* ================= board 2: the bridge ================= */
makeBoard('tr-b2', { sliders: ['a', 'b', 'c'], mine: true, toggle: true });

/* ================= board 3: the planner ================= */
makeBoard('tr-b3', { sliders: ['a', 'b', 'c'], bridge: true, planner: true });

/* ================= board 4: Pigou's two roads ================= */
(function(){
  const st = { x: 100, k: 1 };
  const sl = $('#tr-pg-x'), out = $('[data-for="tr-pg-x"]');
  function render(){
    const x = st.x / 100, p = pigou(x, st.k);
    $('#tr-pg-r1').textContent = '60 min';
    $('#tr-pg-r2').textContent = `${fmtMin(p.r2 * 60)} min`;
    $('#tr-pg-avg').textContent = `${fmtMin(p.avg * 60)} min`;
    const xe = pigouEquilibrium(st.k), xo = pigouOptimum(st.k);
    const eqAvg = pigou(xe, st.k).avg, optAvg = pigou(xo, st.k).avg;
    $('#tr-pg-best').textContent = `${fmtMin(optAvg * 60)} min`;
    let h;
    if (Math.abs(x - xe) < 1e-9) h = `<span class="robo">This is the selfish equilibrium.</span> ${xe === 1 ? 'Everyone is on road 2 and nobody can do better by moving to road 1.' : 'Both roads take an hour, so nobody wants to switch.'}`;
    else if (Math.abs(x - xo) < 1e-9) h = `<span class="win-c">This is the planner\'s best.</span> Average ${fmtMin(optAvg * 60)} min, but the drivers on road 1 want to switch.`;
    else if (p.r2 < p.r1 - 1e-9) h = `Road 2 is faster, so road 1 drivers want to switch to it.`;
    else h = `Road 2 is slower than road 1, so road 2 drivers want to switch back.`;
    $('#tr-pg-status').innerHTML = h;
    const num = v => Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
    const poaNum = eqAvg / optAvg;
    const nice = Math.abs(poaNum - 4 / 3) < 1e-9 ? '4/3 ≈ 1.33' : Math.abs(poaNum - 8 / 7) < 1e-9 ? '8/7 ≈ 1.14' : num(poaNum);
    $('#tr-pg-sum').innerHTML = `Selfish equilibrium: <b class="robo">${Math.round(xe * 100)}%</b> on road 2, ${fmtMin(eqAvg * 60)} min for everyone. Planner\'s best: <b class="win-c">${Math.round(xo * 100)}%</b> on road 2, average ${fmtMin(optAvg * 60)} min. Price of anarchy: <b class="math-c">${fmtMin(eqAvg * 60)} ÷ ${fmtMin(optAvg * 60)} = ${nice}</b>.`;
    sl.value = st.x; out.textContent = st.x + '%';
  }
  sl.addEventListener('input', () => { st.x = cl(Math.round(+sl.value) || 0, 0, 100); render(); });
  seg($('#tr-pg-k'), v => { st.k = +v; render(); });
  $$('#tr-pg-jump button').forEach(b => b.addEventListener('click', () => { st.x = Math.round(100 * (b.dataset.to === 'eq' ? pigouEquilibrium(st.k) : pigouOptimum(st.k))); render(); }));
  render();
})();
})();

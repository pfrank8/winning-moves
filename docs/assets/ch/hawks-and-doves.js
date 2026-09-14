/* Chapter: Hawks and doves (Hawk-Dove payoff grid, payoff-versus-p chart, replicator simulation, lizard rock-paper-scissors). */
(function(){
'use strict';
const { $, $$, earn, slider, grid, fmtN, fmtS, clamp } = WM;

/* @pure-start
   Everything between the pure markers is DOM-free. The node test (scratch) evaluates this block on its own. */
const N = 300;                                  // animals in the hawk-dove simulation
const LIZ_SHIFT = 4;                            // rock-paper-scissors: win +1, lose -1, tie 0, plus this so every score is positive
const LIZ_MUT = 0.005;                          // 1 newborn in 200 gets a random color, so no color ever goes extinct

/* Average payoff of a hawk and of a dove when a fraction p of the population are hawks. */
function EH(p, V, C){ return p * (V - C) / 2 + (1 - p) * V; }
function ED(p, V, C){ return (1 - p) * V / 2; }
/* The predicted equilibrium fraction of hawks: V/C, capped at 1 (hawks take over when C <= V). */
function pStar(V, C){ return Math.min(1, V / C); }

/* Exact (no luck) discrete replicator update on the hawk fraction.
   p_next = p * F_H / (p * F_H + (1 - p) * F_D) where F = E + C/2.
   Shifting both averages by C/2 makes every score at least V/2 > 0 (a hawk's worst average is (V - C)/2 at p = 1)
   and does not change the sign of E_H - E_D, so the fixed point stays at p = V/C and p moves toward it from
   both sides (E_H - E_D = (V - pC)/2 is positive below V/C and negative above). Verified numerically in the node test. */
function replicate(p, V, C){
  const s = C / 2;
  const fh = EH(p, V, C) + s, fd = ED(p, V, C) + s;
  const tot = p * fh + (1 - p) * fd;
  return tot > 0 ? p * fh / tot : p;
}

/* One generation with luck: nH hawks and N - nH doves are shuffled, paired off, and each pair plays once.
   The next generation gets hawks in proportion to the hawks' total shifted score (see the rounding note below).
   Returns the pairs (for drawing), the fight count, the raw averages, and the next hawk count. */
function playGeneration(nH, V, C, rng){
  rng = rng || Math.random;
  const s = C / 2;
  const animals = new Array(N);
  for (let i = 0; i < N; i++) animals[i] = i < nH ? 1 : 0;
  for (let i = N - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); const t = animals[i]; animals[i] = animals[j]; animals[j] = t; }
  const pairs = [];
  let TH = 0, TD = 0, sumH = 0, sumD = 0, fights = 0;
  for (let k = 0; k < N; k += 2){
    const a = animals[k], b = animals[k + 1];
    let pa, pb;
    if (a && b){ pa = pb = (V - C) / 2; fights++; }          // two hawks fight: expected value of the fight for each
    else if (a && !b){ pa = V; pb = 0; }
    else if (!a && b){ pa = 0; pb = V; }
    else { pa = pb = V / 2; }
    if (a){ TH += pa + s; sumH += pa; } else { TD += pa + s; sumD += pa; }
    if (b){ TH += pb + s; sumH += pb; } else { TD += pb + s; sumD += pb; }
    pairs.push([a, b]);
  }
  const nD = N - nH;
  /* The hawks' share of the next 300 is N * TH / (TH + TD), usually not a whole number. The fractional animal is
     decided by a coin flip (stochastic rounding) rather than Math.round: plain rounding erases any pull smaller than
     half an animal, and near a small equilibrium (V = 2, C = 40 means 15 hawks) that dead zone let pairing luck
     random-walk the hawks to extinction. With the coin flip the expected next count equals the exact replicator step. */
  let next = nH;
  if (TH + TD > 0){ const x = N * TH / (TH + TD); const f = Math.floor(x); next = f + (rng() < x - f ? 1 : 0); }
  return { pairs, fights, hawkAvg: nH ? sumH / nH : NaN, doveAvg: nD ? sumD / nD : NaN, next: clamp(next, 0, N) };
}

/* Read a prediction typed as "50%", "50", "0.5", ".5" or "1/2". Returns a percent (0..100) or null. */
function parsePrediction(str){
  let t = String(str || '').trim().replace(/%/g, '').replace(/\s+/g, '');
  if (!t) return null;
  let v;
  if (t.includes('/')){
    const parts = t.split('/'); if (parts.length !== 2) return null;
    const a = Number(parts[0]), b = Number(parts[1]);
    if (!isFinite(a) || !isFinite(b) || b === 0) return null;
    v = 100 * a / b;
  } else {
    v = Number(t); if (!isFinite(v)) return null;
    if (v <= 1) v = 100 * v;                       // 0.5 means 50 percent; 1 means 100 percent
  }
  if (v < 0 || v > 100) return null;
  return v;
}

/* Lizards. x = [orange, blue, yellow]. Orange beats blue, blue beats yellow, yellow beats orange.
   Score of a color = LIZ_SHIFT + (share of the color it beats) - (share of the color that beats it).
   The game is zero-sum so the population average is exactly LIZ_SHIFT. Discrete replicator plus a little mutation:
   without the mutation the discrete-time cycle spirals outward until one color rounds to zero and is lost forever.
   With it the fractions settle onto a steady cycle (period about 50 generations, peaks near 73 percent). */
function lizardStep(x){
  const [o, b, y] = x;
  const fo = LIZ_SHIFT + b - y, fb = LIZ_SHIFT + y - o, fy = LIZ_SHIFT + o - b;
  const avg = o * fo + b * fb + y * fy;
  const n = [o * fo / avg, b * fb / avg, y * fy / avg];
  return n.map(v => (1 - LIZ_MUT) * v + LIZ_MUT / 3);
}
/* @pure-end */

/* ---------- shared state, theme colors, canvas helpers ---------- */
const state = { V: 10, C: 20 };
function css(name, el){ return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim(); }
function theme(el){
  return { you: css('--you'), robo: css('--robo'), math: css('--math'), ink: css('--ink'), soft: css('--ink-soft'), line: css('--line'),
    surface: css('--surface'), surface2: css('--surface-2'), gridc: css('--grid'), youSoft: css('--you-soft'), roboSoft: css('--robo-soft'),
    orange: css('--hd-orange', el || document.body) || '#E4731A', mono: css('--f-mono') || 'monospace', display: css('--f-display') || 'sans-serif' };
}
function ctx2d(canvas){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const W = +canvas.getAttribute('width'), H = +canvas.getAttribute('height');
  if (canvas.width !== W * dpr || canvas.height !== H * dpr){ canvas.width = W * dpr; canvas.height = H * dpr; }
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  return { c, W, H };
}
/* A chart frame with axes. Returns pixel mappers. */
function frame(c, W, H, o, t){
  const box = { l: 58, r: W - 16, t: 18, b: H - 40 };
  const x = v => box.l + (v - o.xmin) / (o.xmax - o.xmin) * (box.r - box.l);
  const y = v => box.b - (v - o.ymin) / (o.ymax - o.ymin) * (box.b - box.t);
  c.fillStyle = t.surface; c.fillRect(0, 0, W, H);
  c.font = `600 13px ${t.mono}`; c.fillStyle = t.soft; c.strokeStyle = t.gridc; c.lineWidth = 1;
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const v of o.yticks){ const py = Math.round(y(v)) + .5; c.beginPath(); c.moveTo(box.l, py); c.lineTo(box.r, py); c.stroke(); c.fillText(o.yfmt(v), box.l - 8, py); }
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (const v of o.xticks){ const px = Math.round(x(v)) + .5; c.beginPath(); c.moveTo(px, box.t); c.lineTo(px, box.b); c.stroke(); c.fillText(o.xfmt(v), px, box.b + 6); }
  c.strokeStyle = t.line; c.lineWidth = 2; c.beginPath(); c.moveTo(box.l, box.t); c.lineTo(box.l, box.b); c.lineTo(box.r, box.b); c.stroke();
  c.font = `600 14px ${t.display}`; c.fillStyle = t.ink; c.textAlign = 'center'; c.fillText(o.xlab, (box.l + box.r) / 2, box.b + 22);
  c.save(); c.translate(14, (box.t + box.b) / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; c.fillText(o.ylab, 0, 0); c.restore();
  return { x, y, box };
}
function polyline(c, pts, color, width, dash){
  if (pts.length < 2) return;
  c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; if (dash) c.setLineDash(dash);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.restore();
}
function label(c, text, px, py, color, t, align){
  c.font = `600 13px ${t.mono}`; c.textAlign = align || 'left'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 10, h = 20;
  let lx = align === 'right' ? px - w : align === 'center' ? px - w / 2 : px;
  lx = Math.max(2, lx);
  c.fillStyle = t.surface; c.globalAlpha = .9; c.fillRect(lx, py - h / 2, w, h); c.globalAlpha = 1;
  c.fillStyle = color; c.fillText(text, align === 'right' ? px - 5 : align === 'center' ? px : px + 5, py);
}
const pct = v => Math.round(100 * v) + '%';
const num = v => (Math.abs(v - Math.round(v)) < 1e-9 ? fmtN(Math.round(v)) : fmtN(Math.round(v * 100) / 100));
const SPEED_MS = [null, 500, 200, 80, 30, 0];
const SPEED_NAME = [null, 'slow', 'walk', 'normal', 'fast', 'zoom'];

/* ================= board 1: the payoff grid ================= */
function payMatrix(V, C){ const hh = (V - C) / 2; return [[[hh, hh], [V, 0]], [[0, V], [V / 2, V / 2]]]; }
function drawGrid(){
  const { V, C } = state; const pay = payMatrix(V, C);
  $('#hd-grid').innerHTML = grid({ rows: ['Hawk', 'Dove'], cols: ['Hawk', 'Dove'], pay, rowName: 'row', colName: 'column' });
  const hh = $('#hd-grid td[data-r="0"][data-c="0"]');
  if (hh && pay[0][0][0] < 0) hh.classList.add('no');
  const fight = pay[0][0][0];
  let msg = `Hawk meets Hawk: <code>(${V} − ${C})/2 = ${num(fight)}</code> each. `;
  if (fight < 0) msg += `<span class="you">Fighting is expensive.</span> Two hawks both do worse than two doves (${num(V / 2)} each).`;
  else if (fight === 0) msg += `A fight is worth exactly nothing, and beating a dove is worth ${V}. Hawks will not shrink.`;
  else msg += `<span class="you">Fighting pays.</span> Even a fight beats what a dove gets against a hawk (0). Hawks will take over.`;
  $('#hd-grid-status').innerHTML = msg;
}

/* ================= board 2: payoff versus p ================= */
let p2 = 0.3;
function drawLines(){
  const { V, C } = state; const cv = $('#hd-lines'); const { c, W, H } = ctx2d(cv); const t = theme(cv);
  const lo = Math.min(0, (V - C) / 2), hi = V;
  const pad = (hi - lo) * 0.12;
  const step = hi - lo > 30 ? 10 : 5;
  const yticks = []; for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) yticks.push(v);
  const f = frame(c, W, H, { xmin: 0, xmax: 1, ymin: lo - pad, ymax: hi + pad, xticks: [0, .25, .5, .75, 1], yticks, xfmt: pct, yfmt: num, xlab: 'fraction of hawks p', ylab: 'average payoff' }, t);
  if (lo < 0){ polyline(c, [[f.x(0), f.y(0)], [f.x(1), f.y(0)]], t.soft, 1.5, [4, 4]); }
  const ps = pStar(V, C);
  if (ps < 1){
    c.fillStyle = t.youSoft; c.globalAlpha = .45; c.fillRect(f.x(0), f.box.t, f.x(ps) - f.x(0), f.box.b - f.box.t);
    c.fillStyle = t.roboSoft; c.fillRect(f.x(ps), f.box.t, f.x(1) - f.x(ps), f.box.b - f.box.t); c.globalAlpha = 1;
    polyline(c, [[f.x(ps), f.box.t], [f.x(ps), f.box.b]], t.math, 2, [6, 5]);
  } else {
    c.fillStyle = t.youSoft; c.globalAlpha = .45; c.fillRect(f.x(0), f.box.t, f.x(1) - f.x(0), f.box.b - f.box.t); c.globalAlpha = 1;
  }
  polyline(c, [[f.x(0), f.y(EH(0, V, C))], [f.x(1), f.y(EH(1, V, C))]], t.you, 4);
  polyline(c, [[f.x(0), f.y(ED(0, V, C))], [f.x(1), f.y(ED(1, V, C))]], t.robo, 4);
  c.fillStyle = t.you; c.font = `700 16px ${t.display}`; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText('hawk', f.x(0) + 6, f.y(EH(0, V, C)) - 6);
  c.fillStyle = t.robo; c.textBaseline = 'top'; c.fillText('dove', f.x(0) + 6, f.y(ED(0, V, C)) + 6);
  /* the reader's p */
  const px = f.x(p2); polyline(c, [[px, f.box.t], [px, f.box.b]], t.ink, 1.5);
  for (const [val, col] of [[EH(p2, V, C), t.you], [ED(p2, V, C), t.robo]]){
    c.beginPath(); c.arc(px, f.y(val), 7, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = t.surface; c.lineWidth = 2; c.stroke();
  }
  if (ps < 1){
    const cy = f.y(EH(ps, V, C));
    c.beginPath(); c.arc(f.x(ps), cy, 8, 0, Math.PI * 2); c.fillStyle = t.math; c.fill(); c.strokeStyle = t.ink; c.lineWidth = 2; c.stroke();
    label(c, `p* = ${V}/${C} = ${pct(ps)}`, f.x(ps), f.box.b - 12, t.ink, t, ps > .6 ? 'right' : 'left');
  } else {
    label(c, `V/C = ${num(V / C)} ≥ 1: hawks win everywhere`, f.x(1) - 4, f.box.t + 12, t.ink, t, 'right');
  }
  const eh = EH(p2, V, C), ed = ED(p2, V, C);
  $('#hd-eh').textContent = num(eh); $('#hd-ed').textContent = num(ed);
  $('#hd-pstar').textContent = ps < 1 ? `${V}/${C} = ${pct(ps)}` : `${num(V / C)}, so 100%`;
  let s;
  if (Math.abs(eh - ed) < 1e-9) s = `At p = ${pct(p2)} a hawk and a dove earn the same, ${num(eh)}. Nothing changes. This is the equilibrium.`;
  else if (eh > ed) s = `At p = ${pct(p2)} hawks earn ${num(eh)} and doves earn ${num(ed)}. <span class="you">Hawks are spreading</span>, so p goes up.`;
  else s = `At p = ${pct(p2)} hawks earn ${num(eh)} and doves earn ${num(ed)}. <span class="robo">Doves are spreading</span>, so p goes down.`;
  $('#hd-lines-status').innerHTML = s;
}

/* ================= board 3: the simulation ================= */
const sim = { p: 0.9, nH: 270, gen: 0, hist: [], pairs: null, fights: 0, hawkAvg: NaN, doveAvg: NaN, running: false, timer: null, exact: false, lock: null, start: 0.9 };
const MAX_GEN = 5000;
function simReset(){
  simPause();
  sim.exact = $('#hd-exact').checked;
  sim.start = clamp(+$('#hd-start').value, 0, 100) / 100;
  sim.p = sim.start; sim.nH = Math.round(sim.p * N); if (!sim.exact) sim.p = sim.nH / N;
  sim.gen = 0; sim.hist = [sim.p]; sim.lock = null; sim.fights = 0; sim.hawkAvg = NaN; sim.doveAvg = NaN;
  sim.pairs = playGeneration(sim.nH, state.V, state.C).pairs;   // a first random pairing, just for the picture
  simDraw();
  const pred = parsePrediction($('#hd-pred').value);
  $('#hd-sim-status').innerHTML = pred === null
    ? `Type your prediction for the final hawk fraction, then press Run. (Hint if you need it.)`
    : `Prediction ready: <b>${Math.round(pred)}%</b>. Press Run and see if the animals agree.`;
}
function simStep(){
  if (sim.gen >= MAX_GEN){ simPause(); $('#hd-sim-status').innerHTML = `That is ${MAX_GEN} generations. Press Reset to start again.`; return; }
  if (sim.gen === 0){
    const pred = parsePrediction($('#hd-pred').value);
    sim.lock = { pred, V: state.V, C: state.C };
  }
  const { V, C } = state;
  const g = playGeneration(sim.nH, V, C);
  sim.pairs = g.pairs; sim.fights = g.fights; sim.hawkAvg = g.hawkAvg; sim.doveAvg = g.doveAvg;
  if (sim.exact){ sim.p = replicate(sim.p, V, C); sim.nH = Math.round(sim.p * N); }
  else { sim.nH = g.next; sim.p = sim.nH / N; }
  sim.gen++; sim.hist.push(sim.p);
  simDraw(); simStatus();
}
function simStatus(){
  const { V, C } = state; const ps = pStar(V, C); const L = sim.lock;
  const predTxt = L && L.pred !== null ? `Your prediction: <b>${Math.round(L.pred)}%</b>. ` : `No prediction was typed before this run, so no star this time. `;
  let s = predTxt;
  const took = sim.nH >= N;
  if (V < C){
    s += `Equation says <b>${pct(ps)}</b>. Now: <b>${pct(sim.p)}</b> hawks.`;
    if (sim.gen >= 30 && L && L.pred !== null && Math.abs(L.pred - 100 * ps) <= 5){ s += ` <span class="win-c">Within 5 points. Nice.</span>`; earn('hd-predict'); }
    else if (sim.gen >= 30 && L && L.pred !== null) s += ` Your guess was ${Math.round(L.pred)}%. Reset, divide V by C, and try again.`;
  } else {
    s += `V ≥ C, so hawks should take over. Now: <b>${pct(sim.p)}</b> hawks.`;
    if (took || sim.p >= 0.97){
      s += ` <span class="you">Hawks have taken over.</span>`;
      if (sim.gen >= 30 && L && L.pred !== null && L.pred >= 95) earn('hd-allhawk');
    }
  }
  if (sim.nH === 0) s += ` <span class="robo">Hawks are extinct.</span> Nobody is left to fight, and with no hawks there is nothing to pull them back. Reset to try again.`;
  $('#hd-sim-status').innerHTML = s;
}
function simDraw(){
  /* the animals */
  const pv = $('#hd-pop'); { const { c, W, H } = ctx2d(pv); const t = theme(pv);
    c.fillStyle = t.surface; c.fillRect(0, 0, W, H);
    const pairs = sim.pairs || [];
    const cols = 15, cw = 40, rh = 24, x0 = 20, y0 = 8;
    /* draw pairs so that the picture matches the counts: hawks drawn = round(p * N) */
    const shownH = Math.round(sim.p * N);
    let drawn = pairs.map(pr => pr.slice());
    { // repaint the shuffled pairing with exactly shownH hawks, keeping the pair layout (exact mode keeps p as a float)
      const flat = []; drawn.forEach(pr => { flat.push(pr[0], pr[1]); });
      let have = flat.reduce((a, b) => a + b, 0);
      for (let i = 0; i < flat.length && have !== shownH; i++){
        if (have < shownH && !flat[i]){ flat[i] = 1; have++; } else if (have > shownH && flat[i]){ flat[i] = 0; have--; }
      }
      drawn = []; for (let i = 0; i < flat.length; i += 2) drawn.push([flat[i], flat[i + 1]]);
    }
    drawn.forEach((pr, k) => {
      const row = Math.floor(k / cols), col = k % cols;
      const x = x0 + col * cw, y = y0 + row * rh;
      const [a, b] = pr;
      c.fillStyle = a && b ? t.youSoft : (!a && !b) ? t.roboSoft : t.surface2;
      c.beginPath(); c.roundRect(x, y, 36, 20, 10); c.fill();
      for (const [dx, kind] of [[10, a], [26, b]]){
        c.beginPath(); c.arc(x + dx, y + 10, 6.5, 0, Math.PI * 2); c.fillStyle = kind ? t.you : t.robo; c.fill();
      }
    });
  }
  /* the chart */
  const cv = $('#hd-hist'); { const { c, W, H } = ctx2d(cv); const t = theme(cv);
    const xmax = Math.max(60, Math.ceil(sim.gen / 60) * 60);
    const xt = []; const xs = xmax <= 120 ? 20 : xmax <= 600 ? 100 : xmax <= 1500 ? 250 : 1000; for (let v = 0; v <= xmax; v += xs) xt.push(v);
    const f = frame(c, W, H, { xmin: 0, xmax, ymin: 0, ymax: 1, xticks: xt, yticks: [0, .25, .5, .75, 1], xfmt: v => String(v), yfmt: pct, xlab: 'generation', ylab: 'hawks' }, t);
    const { V, C } = state; const ps = pStar(V, C);
    if (sim.gen > 0){
      polyline(c, [[f.x(0), f.y(ps)], [f.x(xmax), f.y(ps)]], t.math, 2.5, [8, 6]);
      label(c, ps < 1 ? `predicted p* = V/C = ${pct(ps)}` : 'predicted: hawks take over (V ≥ C)', f.x(xmax) - 4, f.y(ps) + (ps > .85 ? 12 : -12), t.ink, t, 'right');
      if (sim.lock && sim.lock.pred !== null){
        const gp = sim.lock.pred / 100;
        polyline(c, [[f.x(0), f.y(gp)], [f.x(xmax), f.y(gp)]], t.soft, 1.5, [2, 4]);
        if (Math.abs(gp - ps) > .04) label(c, `your guess ${Math.round(sim.lock.pred)}%`, f.x(0) + 4, f.y(gp) + (gp > ps ? -11 : 11), t.soft, t, 'left');
      }
    }
    const pts = sim.hist.map((v, i) => [f.x(i), f.y(v)]);
    if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]);
    polyline(c, pts, t.you, 3);
    const last = pts[pts.length - 1]; c.beginPath(); c.arc(last[0], last[1], 5, 0, Math.PI * 2); c.fillStyle = t.you; c.fill();
    if (sim.gen === 0) label(c, 'type a prediction, then Run', f.x(xmax / 2), f.box.t + 12, t.soft, t, 'center');
  }
  $('#hd-gen').textContent = String(sim.gen);
  $('#hd-nh').textContent = `${Math.round(sim.p * N)} (${pct(sim.p)})`;
  $('#hd-nd').textContent = `${N - Math.round(sim.p * N)} (${pct(1 - sim.p)})`;
  $('#hd-fights').textContent = sim.gen ? String(sim.fights) : '0';
  $('#hd-havg').textContent = sim.gen && !isNaN(sim.hawkAvg) ? num(sim.hawkAvg) : (sim.gen ? 'none' : '0');
  $('#hd-davg').textContent = sim.gen && !isNaN(sim.doveAvg) ? num(sim.doveAvg) : (sim.gen ? 'none' : '0');
}
function simLoop(){
  if (!sim.running) return;
  simStep();
  if (!sim.running) return;
  const ms = SPEED_MS[clamp(+$('#hd-speed').value, 1, 5)];
  sim.timer = ms === 0 ? requestAnimationFrame(simLoop) : setTimeout(simLoop, ms);
}
function simRun(){ if (sim.running) return; sim.running = true; $('#hd-run').textContent = 'Pause'; simLoop(); }
function simPause(){ sim.running = false; clearTimeout(sim.timer); cancelAnimationFrame(sim.timer); $('#hd-run').textContent = sim.gen ? 'Continue' : 'Run'; }
$('#hd-run').addEventListener('click', () => sim.running ? simPause() : simRun());
$('#hd-step').addEventListener('click', () => { simPause(); simStep(); });
$('#hd-reset').addEventListener('click', simReset);
$('#hd-exact').addEventListener('change', simReset);
$('#hd-hint').addEventListener('click', () => {
  $('#hd-sim-status').innerHTML = `Hint: hawks stop spreading at the p where a hawk and a dove earn the same, and that is <b>p = V/C</b>. Divide the prize by the cost, then type it in. If V is bigger than C, the answer is 100%.`;
});
$('#hd-pred').addEventListener('input', () => { if (sim.gen === 0){ const pr = parsePrediction($('#hd-pred').value); $('#hd-sim-status').innerHTML = pr === null ? ($('#hd-pred').value.trim() ? 'I cannot read that. Try 50%, 0.5, or 1/2.' : 'Type your prediction, then press Run.') : `Prediction ready: <b>${Math.round(pr)}%</b>. Press Run and see if the animals agree.`; } });
$('#hd-pred').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); if (sim.gen === 0) simRun(); } });

/* ================= board 4: the lizards ================= */
const liz = { x: [0.5, 0.3, 0.2], gen: 0, hist: [], running: false, timer: null };
const LIZ_MAX = 5000;
function lizReset(){ lizPause(); liz.x = [0.5, 0.3, 0.2]; liz.gen = 0; liz.hist = [liz.x.slice()]; lizDraw(); $('#hd-lstatus').innerHTML = 'Press Run and watch which color is winning.'; }
function lizStep(){
  if (liz.gen >= LIZ_MAX){ lizPause(); $('#hd-lstatus').innerHTML = `That is ${LIZ_MAX} generations. Reset to go again.`; return; }
  liz.x = lizardStep(liz.x); liz.gen++; liz.hist.push(liz.x.slice()); lizDraw();
  const names = ['orange', 'blue', 'yellow'], beats = ['blue', 'yellow', 'orange'], beatenBy = ['yellow', 'orange', 'blue'];
  const top = liz.x.indexOf(Math.max.apply(null, liz.x));
  let s = `Generation ${liz.gen}: <b>${names[top]}</b> is the most common, which is good news for <b>${beatenBy[top]}</b> (it beats ${names[top]}) and bad news for <b>${beats[top]}</b>.`;
  if (liz.gen >= 200){ s += ` <span class="win-c">Two hundred generations and still going around.</span>`; earn('hd-cycle'); }
  $('#hd-lstatus').innerHTML = s;
}
function lizDraw(){
  const cv = $('#hd-lchart'); const { c, W, H } = ctx2d(cv); const t = theme(cv);
  const xmax = Math.max(100, Math.ceil(liz.gen / 100) * 100);
  const xt = []; const xs = xmax <= 200 ? 25 : xmax <= 600 ? 100 : xmax <= 1500 ? 250 : 1000; for (let v = 0; v <= xmax; v += xs) xt.push(v);
  const f = frame(c, W, H, { xmin: 0, xmax, ymin: 0, ymax: 1, xticks: xt, yticks: [0, .25, .5, .75, 1], xfmt: v => String(v), yfmt: pct, xlab: 'generation', ylab: 'share of males' }, t);
  polyline(c, [[f.x(0), f.y(1 / 3)], [f.x(xmax), f.y(1 / 3)]], t.soft, 1, [3, 5]);
  const cols = [t.orange, t.robo, t.math];
  for (let k = 0; k < 3; k++){
    const pts = liz.hist.map((v, i) => [f.x(i), f.y(v[k])]);
    if (pts.length === 1) pts.push([pts[0][0] + .01, pts[0][1]]);
    polyline(c, pts, cols[k], 3);
    const last = pts[pts.length - 1]; c.beginPath(); c.arc(last[0], last[1], 5, 0, Math.PI * 2); c.fillStyle = cols[k]; c.fill();
  }
  $('#hd-lgen').textContent = String(liz.gen);
  $('#hd-lo').textContent = pct(liz.x[0]); $('#hd-lb').textContent = pct(liz.x[1]); $('#hd-ly').textContent = pct(liz.x[2]);
}
function lizLoop(){
  if (!liz.running) return;
  lizStep();
  if (!liz.running) return;
  const ms = SPEED_MS[clamp(+$('#hd-lspeed').value, 1, 5)];
  liz.timer = ms === 0 ? requestAnimationFrame(lizLoop) : setTimeout(lizLoop, ms);
}
function lizRun(){ if (liz.running) return; liz.running = true; $('#hd-lrun').textContent = 'Pause'; lizLoop(); }
function lizPause(){ liz.running = false; clearTimeout(liz.timer); cancelAnimationFrame(liz.timer); $('#hd-lrun').textContent = liz.gen ? 'Continue' : 'Run'; }
$('#hd-lrun').addEventListener('click', () => liz.running ? lizPause() : lizRun());
$('#hd-lstep').addEventListener('click', () => { lizPause(); lizStep(); });
$('#hd-lreset').addEventListener('click', lizReset);
function drawRps(){
  const O = '<span class="hd-orange">Orange</span>', B = '<span class="hd-blue">Blue</span>', Y = '<span class="hd-yellow">Yellow</span>';
  const pay = [[[0, 0], [1, -1], [-1, 1]], [[-1, 1], [0, 0], [1, -1]], [[1, -1], [-1, 1], [0, 0]]];
  $('#hd-rps').innerHTML = grid({ rows: [O, B, Y], cols: [O, B, Y], pay, signed: true, rowName: 'me', colName: 'the other' });
  $$('#hd-rps td').forEach(td => { const r = +td.dataset.r, cc = +td.dataset.c; const v = pay[r][cc][0]; td.classList.add(v > 0 ? 'win' : v < 0 ? 'lose' : 'tie'); });
}

/* ================= wiring: V and C are shared by three boards ================= */
const vIds = ['hd-v1', 'hd-v2', 'hd-v3'], cIds = ['hd-c1', 'hd-c2', 'hd-c3'];
const upds = {};
function onVC(){ drawGrid(); drawLines(); simReset(); }
function setV(v){ if (v === state.V) return; state.V = v; vIds.forEach(id => { $('#' + id).value = v; upds[id](); }); onVC(); }
function setC(v){ if (v === state.C) return; state.C = v; cIds.forEach(id => { $('#' + id).value = v; upds[id](); }); onVC(); }
vIds.forEach(id => { upds[id] = slider($('#' + id), v => String(v), v => setV(clamp(v, 2, 20))); });
cIds.forEach(id => { upds[id] = slider($('#' + id), v => String(v), v => setC(clamp(v, 2, 40))); });
slider($('#hd-p2'), v => v + '%', v => { p2 = clamp(v, 0, 100) / 100; drawLines(); });
slider($('#hd-start'), v => v + '%', () => simReset());
slider($('#hd-speed'), v => SPEED_NAME[clamp(v, 1, 5)]);
slider($('#hd-lspeed'), v => SPEED_NAME[clamp(v, 1, 5)]);
drawGrid(); drawLines(); simReset(); drawRps(); lizReset();
/* redraw when the color scheme flips, so canvases pick up the new theme */
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawLines(); simDraw(); lizDraw(); }); } catch (e) {}
})();

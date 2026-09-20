/* Chapter: I cut, you choose (cut and choose, the moving knife, the envy detector). */
(function(){
'use strict';
const { $, $$, rand, wait, earn, seg, slider, clamp, turn, reveal, cue } = WM;

const NAMES = ['You', 'Robo', 'Robo 2'];
const CLS = ['you', 'robo', 'fd-r2'];
const COL = ['var(--you)', 'var(--robo)', 'var(--p3)'];
const pc = (v, d) => (100 * v).toFixed(d || 0) + '%';
const THIRD = 1 / 3;

/* ---------- cake drawing (literal colors: it is a picture of a cake) ---------- */
const G = { x0: 10, x1: 410, top: 50, bot: 132, frost: 14 };
const X = c => G.x0 + (G.x1 - G.x0) * c / 100;
const FLAV = [
  { name: 'chocolate', body: '#6B3A1E', frost: '#8C5A3B', ink: '#FFF3E6' },
  { name: 'vanilla', body: '#F4E3AE', frost: '#FBF2D6', ink: '#5A3A16' },
  { name: 'strawberry', body: '#F08CA6', frost: '#F8BFCF', ink: '#5A1A2E' }
];
const PLAIN = { name: '', body: '#F1D48C', frost: '#F4A3B8', ink: '#5A3A16' };
const plate = () => `<rect x="${G.x0 - 8}" y="${G.bot - 2}" width="${G.x1 - G.x0 + 16}" height="10" rx="5" fill="#C9CFDA"/>`;
function slab(a, b, f, label){
  const x = X(a), w = X(b) - x;
  let s = `<rect x="${x}" y="${G.top - G.frost}" width="${w}" height="${G.frost}" fill="${f.frost}"/>`
        + `<rect x="${x}" y="${G.top}" width="${w}" height="${G.bot - G.top}" fill="${f.body}"/>`;
  if (label) s += `<text x="${x + w / 2}" y="${(G.top + G.bot) / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${f.ink}">${label}</text>`;
  return s;
}
function knife(c, thin){
  const x = X(c);
  if (thin) return `<line x1="${x}" y1="${G.top - G.frost - 4}" x2="${x}" y2="${G.bot + 2}" style="stroke:var(--ink)" stroke-width="2" stroke-dasharray="4 4"/>`;
  return `<rect x="${x - 5}" y="${G.top - G.frost - 28}" width="10" height="16" rx="3" style="fill:var(--ink)"/>`
       + `<line x1="${x}" y1="${G.top - G.frost - 12}" x2="${x}" y2="${G.bot + 6}" style="stroke:var(--ink)" stroke-width="3" stroke-dasharray="6 4"/>`;
}
function owned(a, b, who, text){
  const x = X(a), w = X(b) - x;
  let s = `<rect x="${x + 2}" y="${G.top - G.frost + 2}" width="${Math.max(0, w - 4)}" height="${G.bot - G.top + G.frost - 4}" fill="none" style="stroke:${COL[who]}" stroke-width="4" rx="4"/>`;
  if (w > 34) s += `<text x="${x + w / 2}" y="${G.top - G.frost - 8}" text-anchor="middle" font-size="14" font-weight="700" style="fill:${COL[who]}">${text}</text>`;
  return s;
}
function under(c, text, anchor){
  return `<text x="${X(c)}" y="${G.bot + 26}" text-anchor="${anchor || 'middle'}" font-size="13" style="fill:var(--ink-soft)">${text}</text>`;
}

/* ================= 1. cut and choose ================= */
const cc = { mode: 'plain', cut: 50, pYou: 75, pRobo: 50, id: 0, hinted: false, pick: null };
const valLeft = (p, c) => c <= 50 ? p * c / 50 : p + (1 - p) * (c - 50) / 50;   // value of [0, c] when the chocolate half holds p of the value
const safeCut = p => p >= 0.5 ? 25 / p : 50 + 50 * (0.5 - p) / (1 - p);        // where [0, c] is worth exactly 1/2
const pOf = who => cc.mode === 'plain' ? 0.5 : (who === 0 ? cc.pYou : cc.pRobo) / 100;
const CC_HELP = 'Drag the knife to where you want to cut, then press <b>Cut</b>.';
const CC_AGAIN = 'Drag the knife and cut again.';
/* The strip narrates the knife as it moves: what the two pieces are worth to the reader right now. */
function ccWhere(){
  const c = cc.cut, yl = valLeft(pOf(0), c);
  return cc.mode === 'plain'
    ? `Knife at ${c}: the left piece is <b class="you">${c}%</b> of the cake, the right piece <b class="you">${100 - c}%</b>. Press <b>Cut</b>, or keep dragging.`
    : `Knife at ${c}: to you the left piece is worth <b class="you">${pc(yl, 1)}</b>, the right piece <b class="you">${pc(1 - yl, 1)}</b>. Press <b>Cut</b>, or keep dragging.`;
}

function ccDraw(){
  const c = cc.cut; let s = plate();
  if (cc.mode === 'plain') s += slab(0, 100, PLAIN, '');
  else s += slab(0, 50, FLAV[0], 'chocolate') + slab(50, 100, FLAV[1], 'vanilla');
  s += knife(c);
  if (cc.pick !== null){
    const roboLeft = cc.pick === 'left';
    s += owned(0, c, roboLeft ? 1 : 0, roboLeft ? 'Robo' : 'You') + owned(c, 100, roboLeft ? 0 : 1, roboLeft ? 'You' : 'Robo');
  }
  s += under(0, `left piece: ${c}% of the length`, 'start') + under(100, `right piece: ${100 - c}%`, 'end');   // pinned to the ends so a cut near an edge never clips a label
  $('#cc-cake').innerHTML = s;
}
function ccTable(){
  const c = cc.cut;
  const youSide = cc.pick === null ? -1 : (cc.pick === 'left' ? 1 : 0);
  const roboSide = cc.pick === null ? -1 : (cc.pick === 'left' ? 0 : 1);
  let h = `<tr><th>Worth to...</th><th>Left piece</th><th>Right piece</th></tr>`;
  [0, 1].forEach(who => {
    const l = valLeft(pOf(who), c), vals = [l, 1 - l];
    h += `<tr><td class="${CLS[who]}"><b>${NAMES[who]}</b></td>`;
    [0, 1].forEach(side => {
      const cls = (who === 0 && side === youSide) ? 'fd-you' : (who === 1 && side === roboSide) ? 'fd-robo' : '';
      h += `<td class="${cls}">${pc(vals[side], 1)}</td>`;
    });
    h += '</tr>';
  });
  $('#cc-table').innerHTML = h;
}
function ccRender(){ ccDraw(); ccTable(); }
function ccReset(msg){ cc.id++; cc.pick = null; $('#cc-go').disabled = false; ccRender(); turn('#cc-cake', 'you', msg || ccWhere()); }

async function ccCut(){
  cc.id++; const id = cc.id; cc.pick = null; ccRender();
  $('#cc-go').disabled = true;
  turn('#cc-cake', 'robo', 'Robo is looking at the two pieces...');
  await wait(700);
  if (id !== cc.id) return;                       // the knife moved, or the cake changed, while Robo was looking
  $('#cc-go').disabled = false;
  const c = cc.cut, rl = valLeft(pOf(1), c), rr = 1 - rl;
  cc.pick = rl >= rr ? 'left' : 'right';
  const other = cc.pick === 'left' ? 'right' : 'left';
  const yl = valLeft(pOf(0), c), yours = cc.pick === 'left' ? 1 - yl : yl, robos = Math.max(rl, rr);
  ccRender();
  let msg, who, tag;
  if (cc.mode === 'plain'){
    who = yours >= 0.5 ? 'win' : 'lose'; tag = yours >= 0.5 ? 'Half each' : 'Robo got more';
    msg = rl === rr
      ? `The two pieces tie, so Robo takes the left. You get <b class="you">${pc(yours)}</b> of the cake, and there was nothing Robo could do about it.`
      : `Robo takes the bigger piece, the ${cc.pick} (${pc(robos)}). You get the ${other}: <b class="you">${pc(yours)}</b>.`;
    if (c === 50 && !cc.hinted) earn('fd-half');
    else if (c === 50) msg += ' <span class="note">(Move the slider to 50 yourself, without the hint, to earn the star.)</span>';
  } else {
    msg = `Robo takes the <b>${cc.pick}</b> piece, worth ${pc(robos, 1)} to Robo${rl === rr ? ' (a tie, so Robo takes the left)' : ''}. `
        + `You get the ${other}: <b class="you">${pc(yours, 1)}</b> of the cake by your taste. By your two measures that adds up to ${pc(yours + robos, 1)} of one cake.`;
    who = yours >= 0.6 - 1e-9 ? 'win' : yours >= 0.5 - 1e-9 ? 'math' : 'lose';
    tag = who === 'win' ? 'A big slice' : who === 'math' ? 'A fair half' : 'Less than half';
    if (cc.pYou !== cc.pRobo && yours >= 0.6 - 1e-9) earn('fd-taste');
  }
  turn('#cc-cake', who, `${msg} ${CC_AGAIN}`, tag);
}

const tasteText = v => {
  const r = v / (100 - v), f = x => String(Math.round(x * 10) / 10);
  const rel = v === 50 ? 'equal to vanilla' : v > 50 ? `chocolate is ${f(r)}× vanilla` : `vanilla is ${f(1 / r)}× chocolate`;
  return `${v}% of the cake (${rel})`;
};
const ccUpd = slider($('#cc-cut'), v => `${v}% from the left`, v => { cc.cut = clamp(Math.round(v), 5, 95); cc.hinted = false; ccReset(); });
slider($('#cc-you'), tasteText, v => { cc.pYou = clamp(Math.round(v), 10, 90); ccReset(); });
slider($('#cc-robo'), tasteText, v => { cc.pRobo = clamp(Math.round(v), 10, 90); ccReset(); });
/* The taste sliders are always on the board: disabled for the plain cake, and their label says what unlocks them. */
function ccTastes(){
  const plain = cc.mode === 'plain';
  $('#cc-tastes').classList.toggle('off', plain);
  $('#cc-you').disabled = plain; $('#cc-robo').disabled = plain;
  $('#cc-tastes-lab').innerHTML = plain ? 'Tastes: switch to <b>Chocolate and vanilla</b> to set these.' : 'Tastes: drag to change what chocolate is worth to each of you.';
}
seg($('#cc-mode'), v => {
  cc.mode = v; cc.hinted = false; ccTastes();
  ccReset(v === 'plain' ? 'Plain cake: every bite is worth the same. Drag the knife, then press <b>Cut</b>.' : 'Chocolate on the left, vanilla on the right. Find the cut where both pieces are worth the same <b>to you</b>, then press <b>Cut</b>.');
});
$('#cc-go').addEventListener('click', ccCut);
$('#cc-hint').addEventListener('click', () => {
  const exact = safeCut(pOf(0)), c = clamp(Math.round(exact), 5, 95);
  $('#cc-cut').value = c; ccUpd(); cc.hinted = true;
  const where = Math.abs(exact - c) < 0.05 ? `${c}%` : `${exact.toFixed(1)}% (the slider stops at ${c})`;
  turn('#cc-cake', 'math', `Both pieces are worth the same to you at ${where}. Cut there and you get half by your own taste, whichever piece Robo takes. Press <b>Cut</b>.`, 'Safe cut');
});
/* "You cut": the knife on the cake is draggable. The slider above it stays for the keyboard and for fine steps. */
(function dragKnife(){
  const cake = $('#cc-cake'); let dragging = false;
  const move = e => {
    const r = cake.getBoundingClientRect(); if (!r.width) return;
    const vx = (e.clientX - r.left) / r.width * 420;
    const c = clamp(Math.round(100 * (vx - G.x0) / (G.x1 - G.x0)), 5, 95);
    if (c !== cc.cut){ $('#cc-cut').value = String(c); ccUpd(); }
  };
  cake.addEventListener('pointerdown', e => { dragging = true; try { cake.setPointerCapture(e.pointerId); } catch (err) {} move(e); });
  cake.addEventListener('pointermove', e => { if (dragging) move(e); });
  ['pointerup', 'pointercancel'].forEach(t => cake.addEventListener(t, () => { dragging = false; }));
})();
ccTastes();
ccReset(CC_HELP);
cue($('#cc-cake'));

/* ================= 2. the moving knife (Dubins and Spanier) ================= */
const SPEEDS = { slow: 2, normal: 4, fast: 10 };   // percent of the cake per second
const mk = { w: [], stopX: [], x: 0, phase: 'ready', speed: SPEEDS.normal, raf: 0, last: 0, id: 0, taken: [], cutAt: null, log: [], first: -1 };

function valUpTo(w, x){     // value of [0, x] to a player with flavor weights w (thirds: chocolate, vanilla, strawberry)
  let v = 0;
  for (let k = 0; k < 3; k++){ const a = 100 * k / 3, b = 100 * (k + 1) / 3; v += w[k] * clamp((x - a) / (b - a), 0, 1); }
  return v;
}
const valBetween = (w, a, b) => valUpTo(w, b) - valUpTo(w, a);
function posOfValue(w, target){   // smallest x with valUpTo(w, x) = target
  let cum = 0;
  for (let k = 0; k < 3; k++){
    const a = 100 * k / 3, b = 100 * (k + 1) / 3;
    if (cum + w[k] >= target - 1e-12) return clamp(a + (b - a) * (target - cum) / w[k], 0, 100);
    cum += w[k];
  }
  return 100;
}
function randWeights(){ const a = 2 + rand(15), b = 2 + rand(17 - a); return [a, b, 20 - a - b].map(x => x / 20); }
const sameW = (u, v) => u.every((x, i) => x === v[i]);
const firstRobot = () => mk.stopX[1] <= mk.stopX[2] ? { who: 1, x: mk.stopX[1] } : { who: 2, x: mk.stopX[2] };
const MK_AGAIN = 'Press <b>New cake</b> to play again.';
const mkTurn = (who, html, tag) => turn('#mk-cake', who, html, tag);
const mkLog = line => { mk.log.push(line); $('#mk-log').innerHTML = mk.log.map((l, i) => `<div>${i + 1}. ${l}</div>`).join(''); };

function mkDraw(){
  let s = plate();
  for (let k = 0; k < 3; k++) s += slab(100 * k / 3, 100 * (k + 1) / 3, FLAV[k], FLAV[k].name);
  if (mk.phase !== 'done'){
    s += `<rect x="${G.x0}" y="${G.top - G.frost}" width="${X(mk.x) - G.x0}" height="${G.bot - G.top + G.frost}" style="fill:var(--math)" opacity=".35"/>`;
  }
  if ($('#mk-mark').checked){
    const m = X(mk.stopX[0]);
    s += `<polygon points="${m - 7},${G.bot + 4} ${m + 7},${G.bot + 4} ${m},${G.bot - 6}" style="fill:var(--you)"/>`
       + under(mk.stopX[0], 'your third', 'middle');
  }
  for (const t of mk.taken) s += owned(t.a, t.b, t.who, NAMES[t.who]);
  if (mk.cutAt !== null) s += knife(mk.cutAt, true);
  if (mk.phase !== 'done') s += knife(mk.x);
  else if (mk.taken.length) s += knife(mk.taken[0].b, true);
  if (!$('#mk-mark').checked) s += under(0, '0%', 'start') + under(100, '100%', 'end');
  $('#mk-cake').innerHTML = s;
}
function mkButtons(){
  const p = mk.phase;
  $('#mk-start').disabled = !(p === 'ready' || p === 'paused');
  $('#mk-start').textContent = p === 'paused' ? 'Resume' : 'Start the knife';
  $('#mk-pause').disabled = p !== 'sweeping';
  $('#mk-stop').disabled = !(p === 'sweeping' || p === 'paused');
}
function mkRender(){
  mkDraw(); mkButtons();
  $('#mk-x').textContent = mk.x.toFixed(1) + '%';
  $('#mk-v').textContent = pc(valUpTo(mk.w[0], mk.x), 1);
}
function mkWeightsLine(){
  $('#mk-weights').innerHTML = '<span>Your taste:</span>' + FLAV.map((f, k) => `<span><i style="background:${f.body}"></i>${f.name} ${Math.round(100 * mk.w[0][k])}%</span>`).join('')
    + '<span class="note" style="margin-top:0">The robots\' weights are secret until the end.</span>';
}
function mkNew(){
  cancelAnimationFrame(mk.raf); mk.id++;
  do { mk.w = [randWeights(), randWeights(), randWeights()]; }
  while (sameW(mk.w[0], mk.w[1]) || sameW(mk.w[1], mk.w[2]) || sameW(mk.w[0], mk.w[2]));
  mk.stopX = mk.w.map(w => posOfValue(w, THIRD));
  mk.x = 0; mk.phase = 'ready'; mk.taken = []; mk.cutAt = null; mk.log = []; mk.first = -1;
  $('#mk-log').innerHTML = ''; $('#mk-table').hidden = true; $('#mk-table').innerHTML = '';
  mkWeightsLine(); mkRender();
  mkTurn('you', 'Press <b>Start the knife</b>. Press <b>Stop!</b> when the red number reads 33.3%. Not before.');
}
function mkTick(ts){
  if (mk.phase !== 'sweeping') return;
  const dt = clamp((ts - mk.last) / 1000, 0, 0.1); mk.last = ts;
  const nx = mk.x + mk.speed * dt, r = firstRobot();
  if (nx >= r.x){ mk.x = r.x; mkTake(r.who); return; }
  mk.x = Math.min(100, nx); mkRender();
  if (mk.x >= 100){ mk.x = 100; mkTake(0); return; }   // cannot happen (a robot stops first), kept for safety
  mk.raf = requestAnimationFrame(mkTick);
}
function mkStart(){
  if (mk.phase !== 'ready' && mk.phase !== 'paused') return;
  mk.phase = 'sweeping'; mk.last = performance.now(); mkRender();
  mkTurn('you', 'Watch the red number next to the button. Press <b>Stop!</b> when it reads 33.3%.', 'Knife moving');
  mk.raf = requestAnimationFrame(mkTick);
}
function mkPause(){
  if (mk.phase !== 'sweeping') return;
  cancelAnimationFrame(mk.raf); mk.phase = 'paused'; mkRender();
  mkTurn('you', 'Press <b>Resume</b>, or press <b>Stop!</b> to shout right here.', 'Paused');
}
function mkTake(who){
  cancelAnimationFrame(mk.raf);
  mk.phase = 'taken'; mk.first = who;
  mk.taken = [{ who, a: 0, b: mk.x }];
  const v = valUpTo(mk.w[who], mk.x);
  if (who === 0){
    mkLog(`You shout Stop at ${mk.x.toFixed(1)}%. The left piece is worth ${pc(v, 1)} to you. You take it.`);
    mkTurn('robo', (v < THIRD - 0.001 ? `You shouted early: that piece is worth ${pc(v, 1)} to you, less than a third.` : `You take the left piece: ${pc(v, 1)} of the cake by your taste.`) + ' Now the robots split the rest with cut and choose...', 'You shouted');
  } else {
    mkLog(`${NAMES[who]} shouts Stop at ${mk.x.toFixed(1)}%: the left piece is exactly one third to ${NAMES[who]}. ${NAMES[who]} takes it.`);
    const vy = valUpTo(mk.w[0], mk.x);
    mkTurn('robo', `${NAMES[who]} shouted first. To you that piece was worth only ${pc(vy, 1)}, so what is left is worth ${pc(1 - vy, 1)} to you. Now ${NAMES[who === 1 ? 2 : 1]} cuts the rest and you choose...`, `${NAMES[who]} shouted`);
  }
  mkRender();
  mkFinish(who);
}
async function mkFinish(first){
  const id = mk.id, x = mk.x;
  const rest = [0, 1, 2].filter(i => i !== first);
  const cutter = rest[0] === 0 ? rest[1] : rest[0];      // a robot always cuts; you (if still in) always choose
  const chooser = rest.find(i => i !== cutter);
  await wait(900);
  if (id !== mk.id) return;
  const wc = mk.w[cutter], vx = valUpTo(wc, x);
  const y = posOfValue(wc, vx + (1 - vx) / 2);
  mk.cutAt = y;
  mkLog(`${NAMES[cutter]} cuts the rest at ${y.toFixed(1)}%, into two pieces worth the same to ${NAMES[cutter]}.`);
  mkRender();
  await wait(900);
  if (id !== mk.id) return;
  const wch = mk.w[chooser], l = valBetween(wch, x, y), r = valBetween(wch, y, 100);
  const chooserLeft = l >= r;
  mk.taken.push({ who: chooser, a: chooserLeft ? x : y, b: chooserLeft ? y : 100 });
  mk.taken.push({ who: cutter, a: chooserLeft ? y : x, b: chooserLeft ? 100 : y });
  mk.phase = 'done';
  mkLog(`${chooser === 0 ? 'You choose' : NAMES[chooser] + ' chooses'} the ${chooserLeft ? 'left' : 'right'} part (worth ${pc(Math.max(l, r), 1)} to ${chooser === 0 ? 'you' : NAMES[chooser]}). ${NAMES[cutter]} gets the other.`);
  mkRender();
  const share = [0, 0, 0];
  for (const t of mk.taken) share[t.who] = valBetween(mk.w[t.who], t.a, t.b);
  let h = '<tr><th>Player</th><th>Took</th><th>Worth to them</th><th>At least 1/3?</th><th>Their weights (choc / van / straw)</th></tr>';
  for (const t of mk.taken.slice().sort((p, q) => p.who - q.who)){
    const ok = share[t.who] >= THIRD - 0.001;
    h += `<tr><td class="${CLS[t.who]}"><b>${NAMES[t.who]}</b></td><td>${t.a.toFixed(1)}% to ${t.b.toFixed(1)}%</td><td>${pc(share[t.who], 1)}</td>`
       + `<td class="${ok ? 'yes' : 'no'}">${ok ? 'yes' : 'no'}</td><td>${mk.w[t.who].map(v => Math.round(100 * v) + '%').join(' / ')}</td></tr>`;
  }
  $('#mk-table').innerHTML = h; $('#mk-table').hidden = false;
  const you = share[0];
  if (first === 0){
    const accurate = you >= THIRD - 0.001 && you <= THIRD + 0.02;
    if (accurate){ mkTurn('win', `Exactly a third, and you kept it. Everyone got at least a third by their own measure: the division is proportional. ${MK_AGAIN}`, 'A perfect third'); earn('fd-knife'); }
    else if (you < THIRD - 0.001) mkTurn('lose', `You shouted early and took ${pc(you, 1)}. Wait for the red number to reach 33.3% next time. ${MK_AGAIN}`, 'Too early');
    else mkTurn('math', `You took ${pc(you, 1)}, a bit past a third. Fine for you, but a robot could have shouted first. Try stopping closer to 33.3%. ${MK_AGAIN}`, 'A bit late');
  } else {
    if (you >= THIRD - 0.001) mkTurn('math', `${NAMES[first]} took the first piece and you still got <b class="you">${pc(you, 1)}</b>. Nobody shouted early, so everyone has at least a third. ${MK_AGAIN}`, 'All shared out');
    else mkTurn('lose', `You ended with <b class="you">${pc(you, 1)}</b>, less than a third. That happens only if a piece was taken that you valued at more than a third: check the table. ${MK_AGAIN}`, 'All shared out');
  }
  reveal($('#mk-table'));
}
$('#mk-start').addEventListener('click', mkStart);
$('#mk-pause').addEventListener('click', mkPause);
$('#mk-stop').addEventListener('click', () => { if (mk.phase === 'sweeping' || mk.phase === 'paused') mkTake(0); });
$('#mk-new').addEventListener('click', mkNew);
$('#mk-mark').addEventListener('change', mkDraw);
seg($('#mk-speed'), v => { mk.speed = SPEEDS[v] || SPEEDS.normal; });
mkNew();

/* ================= 3. the envy detector ================= */
const ev = { v: [], truth: 3, streak: 0, answered: false };
const LETTERS = ['A', 'B', 'C'];
function evRow(envious){   // {d, o1, o2}: own piece d >= 34 (proportional), others sum to 100 - d
  if (envious){
    const d = 34 + rand(12);                       // 34..45, so a bigger piece can exist
    const big = d + 1 + rand(100 - 2 * d - 1);     // d+1 .. 99-d
    return { d, o1: big, o2: 100 - d - big };
  }
  const d = 34 + rand(27);                         // 34..60
  const lo = Math.max(1, 100 - 2 * d), hi = Math.min(d, 99 - d);
  const o1 = lo + rand(hi - lo + 1);
  return { d, o1, o2: 100 - d - o1 };
}
function whoEnvies(v){
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (j !== i && v[i][j] > v[i][i]) return i;
  return 3;
}
function evNew(){
  const target = Math.random() < 0.3 ? 3 : rand(3);
  ev.v = [0, 1, 2].map(i => {
    const r = evRow(i === target), row = [0, 0, 0], others = [0, 1, 2].filter(j => j !== i);
    if (rand(2)) others.reverse();
    row[i] = r.d; row[others[0]] = r.o1; row[others[1]] = r.o2;
    return row;
  });
  ev.truth = whoEnvies(ev.v); ev.answered = false;
  evRender(null);
  turn('#ev-table', 'you', 'Look for a row with a bigger number outside its yellow frame. Then click who is envious, or <b>Nobody</b>.');
  $('#ev-next').disabled = true;
  $$('[data-ev]').forEach(b => { b.disabled = false; });
}
function evRender(envied){
  let h = `<tr><th>Worth to...</th>` + LETTERS.map((L, j) => `<th>Piece ${L} (${j === 0 ? 'yours' : NAMES[j] + "'s"})</th>`).join('') + '</tr>';
  for (let i = 0; i < 3; i++){
    h += `<tr><td class="${CLS[i]}"><b>${NAMES[i]}</b></td>`;
    for (let j = 0; j < 3; j++){
      const cls = (i === j ? 'fd-own' : '') + (envied && envied[0] === i && envied[1] === j ? ' fd-envied' : '');
      h += `<td class="${cls}">${ev.v[i][j]}</td>`;
    }
    h += '</tr>';
  }
  $('#ev-table').innerHTML = h;
}
function evAnswer(guess){
  if (ev.answered) return;
  ev.answered = true;
  const t = ev.truth, ok = guess === t;
  let envied = null, why;
  if (t === 3) why = 'Nobody would swap: in every row, the biggest number is the player\'s own piece.';
  else {
    const row = ev.v[t]; let j = 0; row.forEach((x, k) => { if (k !== t && x > row[j]) j = k; });
    if (j === t) j = row.indexOf(Math.max.apply(null, row.filter((x, k) => k !== t)));
    envied = [t, j];
    why = `${NAMES[t]} ${t === 0 ? 'value your own' : 'values its own'} piece ${LETTERS[t]} at ${row[t]}, but ${j === 0 ? 'your' : NAMES[j] + "'s"} piece ${LETTERS[j]} at ${row[j]}. ${NAMES[t]} would swap. Proportional, but not envy-free.`;
  }
  evRender(envied);
  if (ok){
    ev.streak++;
    turn('#ev-table', 'win', `${why} ${ev.streak === 1 ? 'One right.' : `${ev.streak} in a row.`} Press <b>Next division</b>.`, 'Right');
    if (ev.streak >= 3) earn('fd-envy');
  } else {
    ev.streak = 0;
    turn('#ev-table', 'lose', `${why} The streak starts again. Press <b>Next division</b>.`, 'Not quite');
  }
  $('#ev-streak').textContent = `Streak: ${Math.min(ev.streak, 3)} of 3`;
  $('#ev-next').disabled = false;
  $$('[data-ev]').forEach(b => { b.disabled = true; });
}
$$('[data-ev]').forEach(b => b.addEventListener('click', () => evAnswer(+b.dataset.ev)));
$('#ev-next').addEventListener('click', evNew);
evNew();
})();

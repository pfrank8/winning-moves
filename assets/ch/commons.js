/* Chapter: The pond that everyone owns (a shared pond that regrows, and the public goods game). */
(function(){
'use strict';
const { $, $$, wait, earn, seg, slider, clamp } = WM;

/* ---------- model (pure) ---------- */
const R = 0.5, K = 100, F0 = 60, SEASONS = 20;
const MULT = 1.6, PLAYERS = 4, ROUNDS = 10, COINS = 10;
function growth(F){ return R * F * (1 - F / K); }
/* One season. req[i] is what fisher i asks for. If the pond cannot cover the total, everyone gets a proportional share. */
function season(F, req){
  const T = req.reduce((a, b) => a + b, 0);
  const caught = T <= F ? req.slice() : req.map(c => (T > 0 ? c * F / T : 0));
  let left = F - caught.reduce((a, b) => a + b, 0);
  if (left < 1e-9) left = 0;
  return { caught, left, next: left + growth(left) };
}
/* Everyone takes c every season: the pond path and the total per fisher. */
function everyone(c, seasons){
  let F = F0; const path = [F]; let total = 0; let empty = 0;
  for (let s = 1; s <= seasons; s++){
    const o = season(F, [c, c, c, c]);
    total += o.caught[0]; F = o.next; path.push(F);
    if (!empty && F < 0.5) empty = s;
  }
  return { path, total, F, empty };
}
/* ---------- end model ---------- */

function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function theme(){
  return { you: css('--you'), robo: css('--robo'), math: css('--math'), win: css('--win'), ink: css('--ink'), soft: css('--ink-soft'),
    line: css('--line'), surface: css('--surface'), surface2: css('--surface-2'), gridc: css('--grid'), p4: css('--p4'), p4s: css('--p4-soft'),
    mono: css('--f-mono') || 'monospace', display: css('--f-display') || 'sans-serif' };
}
function ctx2d(canvas){
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const W = +canvas.getAttribute('width'), H = +canvas.getAttribute('height');
  if (canvas.width !== W * dpr || canvas.height !== H * dpr){ canvas.width = W * dpr; canvas.height = H * dpr; }
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  return { c, W, H };
}
function roundRect(c, x, y, w, h, r){
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const fmt = x => (Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1));
const NAMES = ['You', 'Robo 1', 'Robo 2', 'Robo 3'];
const TYPE_NAME = { greedy: 'Greedy', careful: 'Careful', copycat: 'Copycat' };

/* A pond-size chart: path[s] = fish before season s + 1 (path[0] = start). bars[s] = total catch in season s + 1. */
function drawChart(cv, path, bars, opts){
  const { c, W, H } = ctx2d(cv); const t = theme();
  const box = { l: 42, r: W - 14, t: 18, b: H - 30 };
  const x = s => box.l + s / SEASONS * (box.r - box.l);
  const y = v => box.b - v / 100 * (box.b - box.t);
  c.fillStyle = t.surface2; c.fillRect(box.l, box.t, box.r - box.l, box.b - box.t);
  c.strokeStyle = t.gridc; c.lineWidth = 1;
  for (const v of [25, 50, 75, 100]){ c.beginPath(); c.moveTo(box.l, y(v)); c.lineTo(box.r, y(v)); c.stroke(); }
  c.fillStyle = t.soft; c.font = `600 11px ${t.mono}`; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const v of [0, 50, 100]) c.fillText(String(v), box.l - 6, y(v));
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (const s of [0, 5, 10, 15, 20]) c.fillText(String(s), x(s), box.b + 5);
  c.font = `500 11px ${t.display}`; c.fillText('season', (box.l + box.r) / 2, box.b + 17);
  if (bars){
    c.globalAlpha = 0.28; c.fillStyle = t.soft;
    bars.forEach((b, i) => { const x0 = x(i), x1 = x(i + 1); c.fillRect(x0 + 1, y(b), Math.max(1, x1 - x0 - 2), box.b - y(b)); });
    c.globalAlpha = 1;
  }
  c.setLineDash([6, 5]); c.lineWidth = 2;
  c.strokeStyle = t.math; c.beginPath(); c.moveTo(box.l, y(50)); c.lineTo(box.r, y(50)); c.stroke();
  if (opts && opts.goal){ c.strokeStyle = t.win; c.beginPath(); c.moveTo(box.l, y(40)); c.lineTo(box.r, y(40)); c.stroke(); }
  c.setLineDash([]);
  c.strokeStyle = t.p4; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
  path.forEach((v, i) => { if (i) c.lineTo(x(i), y(v)); else c.moveTo(x(i), y(v)); });
  c.stroke();
  const last = path.length - 1;
  c.fillStyle = t.p4; c.beginPath(); c.arc(x(last), y(path[last]), 5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = t.line; c.lineWidth = 2; c.strokeRect(box.l, box.t, box.r - box.l, box.b - box.t);
}

/* ================= the pond ================= */
const pond = { F: F0, s: 0, caught: [0, 0, 0, 0], fines: [0, 0, 0, 0], lastYou: 3, path: [F0], bars: [], type: 'careful',
  quota: false, q: 3, fine: 5, busy: false, over: false, id: 0, log: [], this: [0, 0, 0, 0] };
function robotKind(i){ return pond.type === 'mixed' ? ['greedy', 'careful', 'copycat'][i - 1] : pond.type; }
function robotWant(i){
  const k = robotKind(i);
  return k === 'greedy' ? 10 : k === 'careful' ? 3 : pond.lastYou;
}
/* A robot breaks the quota only when the extra fish are worth more than the fine. */
function robotAsk(i){
  const w = robotWant(i);
  if (!pond.quota || w <= pond.q) return { ask: w, cheats: false };
  return (w - pond.q > pond.fine) ? { ask: w, cheats: true } : { ask: pond.q, cheats: false };
}
const net = i => pond.caught[i] - pond.fines[i];

function drawPond(){
  const cv = $('#cm-pond'); const { c, W, H } = ctx2d(cv); const t = theme();
  roundRect(c, 6, 6, W - 12, H - 12, 30); c.fillStyle = t.p4s; c.fill(); c.lineWidth = 3; c.strokeStyle = t.p4; c.stroke();
  const n = clamp(Math.round(pond.F), 0, 100);
  const cols = 10, rows = 10, padX = 28, top = 40, bottom = 18;
  const cw = (W - 2 * padX) / cols, rh = (H - top - bottom) / rows;
  for (let i = 0; i < n; i++){
    const col = i % cols, row = Math.floor(i / cols);
    const dir = row % 2 ? -1 : 1;
    const fx = padX + cw * (col + 0.5), fy = top + rh * (row + 0.5);
    c.fillStyle = t.p4;
    c.beginPath(); c.ellipse(fx, fy, 9, 4.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(fx - 7 * dir, fy); c.lineTo(fx - 13 * dir, fy - 5); c.lineTo(fx - 13 * dir, fy + 5); c.closePath(); c.fill();
    c.fillStyle = t.p4s; c.beginPath(); c.arc(fx + 4.5 * dir, fy - 1, 1.3, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = t.ink; c.font = `700 16px ${t.display}`; c.textBaseline = 'middle';
  c.textAlign = 'left'; c.fillText(`${fmt(pond.F)} fish`, 22, 24);
  c.textAlign = 'right'; c.fillText(`Season ${pond.s} of ${SEASONS}`, W - 22, 24);
  if (n === 0){ c.textAlign = 'center'; c.fillStyle = t.soft; c.font = `600 18px ${t.display}`; c.fillText('The pond is empty.', W / 2, H / 2 + 8); }
}
function renderPond(){
  drawPond();
  drawChart($('#cm-chart'), pond.path, pond.bars, { goal: true });
  const host = $('#cm-stats'); host.innerHTML = '';
  for (let i = 0; i < 4; i++){
    const d = document.createElement('div'); d.className = 'stat ' + (i ? 'cm-robo' : 'cm-you');
    const kind = i ? ` · ${TYPE_NAME[robotKind(i)]}` : '';
    const fined = pond.fines[i] ? ` · fined ${fmt(pond.fines[i])}` : '';
    d.innerHTML = `<span class="k">${NAMES[i]}${kind}</span><span class="v">${fmt(net(i))}</span><span class="s">${pond.s ? `this season: ${fmt(pond.this[i])}` : 'total catch'}${fined}</span>`;
    host.appendChild(d);
  }
  const dead = pond.over || pond.busy;
  $('#cm-next').disabled = dead; $('#cm-run').disabled = dead; $('#cm-hint').disabled = dead;
  $('#cm-q-wrap').classList.toggle('off', !pond.quota); $('#cm-fine-wrap').classList.toggle('off', !pond.quota);
  $('#cm-log').innerHTML = pond.log.slice(-4).join('<br>');
}
const pstatus = html => { $('#cm-status').innerHTML = html; };

function pondReset(){
  pond.id++; pond.F = F0; pond.s = 0; pond.caught = [0, 0, 0, 0]; pond.fines = [0, 0, 0, 0]; pond.this = [0, 0, 0, 0];
  pond.lastYou = +$('#cm-catch').value; pond.path = [F0]; pond.bars = []; pond.busy = false; pond.over = false; pond.log = [];
  renderPond();
  pstatus(`Season 0 of ${SEASONS}. The pond has ${F0} fish. Choose your catch and press Next season.`);
}
function playSeason(){
  const you = clamp(Math.round(+$('#cm-catch').value) || 0, 0, 10);
  const asks = [{ ask: you }, robotAsk(1), robotAsk(2), robotAsk(3)];
  const before = pond.F;
  const o = season(pond.F, asks.map(a => a.ask));
  const parts = [];
  for (let i = 0; i < 4; i++){
    pond.caught[i] += o.caught[i]; pond.this[i] = o.caught[i];
    let p = `${NAMES[i]} ${fmt(o.caught[i])}`;
    /* the fine is for what you actually landed over the quota, not for what you asked for */
    if (pond.quota && o.caught[i] > pond.q + 1e-9){ pond.fines[i] += pond.fine; p += ` (over the quota, fined ${pond.fine})`; }
    parts.push(p);
  }
  pond.lastYou = you; pond.F = o.next; pond.s++; pond.path.push(pond.F); pond.bars.push(o.caught.reduce((a, b) => a + b, 0));
  pond.log.push(`Season ${pond.s}: ${parts.join(', ')}. Pond ${fmt(before)} → ${fmt(o.left)} left → ${fmt(pond.F)} after regrowing.`);
  return o;
}
function pondFinish(){
  pond.over = true; pond.busy = false; renderPond();
  const alive = pond.F >= 40, mine = net(0);
  const tamed = pond.type === 'greedy' && pond.quota && alive && mine >= 40;
  let s = `Twenty seasons are done. The pond has <b>${fmt(pond.F)}</b> fish and you caught <b class="you">${fmt(mine)}</b>. `;
  if (alive && mine >= 70){
    s += `<span class="win-c">Pond alive, and 70 or more for you. That is the sustainable way to be a little greedy.</span>`;
    earn('cm-alive');
  } else if (tamed){
    s += `<span class="win-c">Three Greedy robots, tamed by a rule.</span> The fine made obeying the quota their best move.`;
  } else if (alive){
    s += `The pond is fine, but you caught less than 70. The pond can spare about 12.5 a season in total. How much of that is going to the robots?`;
  } else if (pond.F < 0.5){
    s += `<span class="you">The pond is empty.</span> Every fisher's best move added up to nobody catching anything.`;
  } else {
    s += `<span class="you">The pond is below 40.</span> Too much was taken, too often. Try a smaller catch, or a quota.`;
  }
  if (tamed) earn('cm-rules');
  pstatus(s);
}
async function nextSeason(){
  if (pond.over || pond.busy) return;
  pond.busy = true; renderPond();
  const id = pond.id;
  pstatus('The robots are choosing...');
  await wait(450);
  if (id !== pond.id) return;
  const o = playSeason();
  pond.busy = false;
  if (pond.s >= SEASONS) return pondFinish();
  renderPond();
  const total = o.caught.reduce((a, b) => a + b, 0);
  let s = `Season ${pond.s}: ${fmt(total)} fish caught in total, ${fmt(o.left)} left, the pond regrew to ${fmt(pond.F)}.`;
  if (pond.F < 0.5) s = `Season ${pond.s}: <span class="you">the pond is empty.</span> Nothing will grow back. Press Run 20 seasons to see the rest, or Reset.`;
  pstatus(s);
}
async function runAll(){
  if (pond.over || pond.busy) return;
  pond.busy = true; renderPond();
  const id = pond.id;
  pstatus(`Running with your catch at ${$('#cm-catch').value} every season...`);
  while (pond.s < SEASONS){
    await wait(140);
    if (id !== pond.id) return;
    playSeason(); renderPond();
  }
  pondFinish();
}
$('#cm-next').addEventListener('click', nextSeason);
$('#cm-run').addEventListener('click', runAll);
$('#cm-reset').addEventListener('click', pondReset);
$('#cm-hint').addEventListener('click', () => {
  if (pond.over || pond.busy) return;
  const rt = [1, 2, 3].map(robotAsk).reduce((a, b) => a + b.ask, 0);
  const g = growth(pond.F - rt - (+$('#cm-catch').value));
  const room = Math.max(0, 12.5 - rt);
  pstatus(`Hint: the robots will take ${fmt(rt)} this season, and the pond never grows more than 12.5. ` +
    (room > 0 ? `About ${fmt(room)} a season for you keeps it level; take more now and you must take less later.`
              : `That is already more than the pond can regrow. Only a quota can save this pond.`) +
    ` With your slider where it is, ${fmt(Math.max(0, g))} fish would grow back.`);
});
seg($('#cm-type'), v => { pond.type = v; pondReset(); });
$('#cm-quota').addEventListener('change', e => { pond.quota = e.target.checked; renderPond(); });
slider($('#cm-catch'), v => String(v));
slider($('#cm-q'), v => String(v), v => { pond.q = clamp(v, 1, 10); });
slider($('#cm-fine'), v => `${v} fish`, v => { pond.fine = clamp(v, 0, 10); });
pondReset();

/* ================= what if everyone did that ================= */
const CALC = []; for (let c = 0; c <= 10; c++) CALC[c] = everyone(c, SEASONS);
function calcRender(c){
  c = clamp(c, 0, 10);
  const o = CALC[c];
  drawChart($('#cm-calc-chart'), o.path, null, {});
  const best = Math.max.apply(null, CALC.map(z => z.total));
  let h = '<tr><th>Each takes</th><th>Total each</th><th>Pond after 20</th><th></th></tr>';
  for (let k = 0; k <= 10; k++){
    const z = CALC[k];
    h += `<tr class="${k === c ? 'hl' : ''}"><td>${k}</td><td>${fmt(z.total)}</td><td>${z.empty ? `empty by season ${z.empty}` : fmt(z.F)}</td>` +
         `<td><div class="bar ${z.empty ? 'you' : 'win'}"><i style="width:${(100 * z.total / best).toFixed(0)}%"></i></div></td></tr>`;
  }
  $('#cm-calc-table').innerHTML = h;
  let s = `Everyone takes ${c}: ${4 * c} fish a season. `;
  if (c === 0) s += 'Nobody fishes, the pond fills up to 100, and nobody eats.';
  else if (o.empty) s += `The pond cannot grow ${4 * c} a season, so it shrinks and is <span class="you">empty by season ${o.empty}</span>. Each fisher ends with only ${fmt(o.total)} fish.`;
  else s += `The pond keeps up. Each fisher gets ${fmt(o.total)} fish in 20 seasons and the pond ends at ${fmt(o.F)}.`;
  if (c === 3) s += ' <span class="win-c">This is the sweet spot.</span>';
  $('#cm-calc-status').innerHTML = s;
}
slider($('#cm-calc'), v => String(v), calcRender);

/* ================= the public goods game ================= */
const pg = { round: 0, totals: [0, 0, 0, 0], type: 'cond', punish: false, over: false, busy: false, id: 0, last: null, scared: [0, 0, 0, 0],
  punished: [false, false, false, false], log: [], rows: [], games: 0 };
let quizOK = false;
function pgKind(i){ return pg.type === 'mixed' ? ['giver', 'free', 'cond'][i - 1] : pg.type; }
function othersAvg(i){
  if (!pg.last) return null;
  let s = 0; for (let j = 0; j < 4; j++) if (j !== i) s += pg.last[j];
  return s / 3;
}
function robotGive(i){
  const k = pgKind(i);
  if (k === 'giver') return 10;
  const avg = othersAvg(i);
  if (k === 'free'){
    if (pg.scared[i] > 0){ pg.scared[i]--; return avg === null ? 5 : Math.round(avg); }
    return 0;
  }
  return avg === null ? 5 : Math.round(avg);   // conditional
}
function pgRender(){
  const host = $('#cm-pstats'); host.innerHTML = '';
  const KIND = { giver: 'Giver', free: 'Free rider', cond: 'Conditional' };
  for (let i = 0; i < 4; i++){
    const d = document.createElement('div'); d.className = 'stat ' + (i ? 'cm-robo' : 'cm-you');
    d.innerHTML = `<span class="k">${NAMES[i]}${i ? ' · ' + KIND[pgKind(i)] : ''}</span><span class="v">${fmt(pg.totals[i])}</span><span class="s">${pg.round ? 'coins so far' : 'coins'}</span>`;
    host.appendChild(d);
  }
  let h = '<tr><th>Round</th><th>You</th><th>Robo 1</th><th>Robo 2</th><th>Robo 3</th><th>Pot × 1.6</th><th>Each gets</th></tr>';
  pg.rows.forEach((r, i) => {
    h += `<tr class="${i === pg.rows.length - 1 ? 'hl' : ''}"><td>${r.round}</td><td class="you">${r.c[0]}</td><td class="robo">${r.c[1]}</td><td class="robo">${r.c[2]}</td><td class="robo">${r.c[3]}</td><td>${fmt(r.pot)}</td><td>${fmt(r.each)}</td></tr>`;
  });
  if (!pg.rows.length) h += '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft)">No rounds yet.</td></tr>';
  $('#cm-ptable').innerHTML = h;
  $('#cm-put').disabled = pg.over || pg.busy;
  const pr = $('#cm-punish'); pr.hidden = !(pg.punish && pg.round > 0 && !pg.over && !pg.busy);
  $$('button', pr).forEach(b => { b.disabled = pg.punished[+b.dataset.p]; });
  $('#cm-plog').innerHTML = pg.log.slice(-5).join('<br>');
}
const pgStatus = html => { $('#cm-pstatus').innerHTML = html; };
function pgReset(){
  pg.id++; pg.round = 0; pg.totals = [0, 0, 0, 0]; pg.over = false; pg.busy = false; pg.last = null; pg.scared = [0, 0, 0, 0];
  pg.punished = [false, false, false, false]; pg.log = []; pg.rows = [];
  pgRender();
  pgStatus(`Round 0 of ${ROUNDS}. Everyone has 10 coins. Choose your contribution and press Put in.`);
}
function pgFinish(){
  pg.over = true; pg.busy = false; pg.games++; pgRender();
  const order = [0, 1, 2, 3].sort((a, b) => pg.totals[b] - pg.totals[a]);
  const top = order[0];
  let s = `Ten rounds are done. You have <b class="you">${fmt(pg.totals[0])}</b> coins. `;
  s += top === 0 ? `Nobody has more than you.` : `<b class="robo">${NAMES[top]}</b> has the most, with ${fmt(pg.totals[top])}.`;
  s += ` If all four had put in everything every round, everyone would have 160.`;
  if (quizOK){ earn('cm-free'); }
  else s += ` Answer the question at the top of the board to finish the star.`;
  pgStatus(s);
}
async function putIn(){
  if (pg.over || pg.busy) return;
  pg.busy = true; pgRender();
  const id = pg.id;
  const you = clamp(Math.round(+$('#cm-give').value) || 0, 0, 10);
  pgStatus('The robots are deciding in secret...');
  await wait(500);
  if (id !== pg.id) return;
  const c = [you, robotGive(1), robotGive(2), robotGive(3)];
  const pot = c.reduce((a, b) => a + b, 0) * MULT;
  const each = pot / PLAYERS;
  const income = c.map(x => COINS - x + each);
  pg.round++; pg.last = c; pg.punished = [false, false, false, false];
  pg.rows.push({ round: pg.round, c, pot, each });
  for (let i = 0; i < 4; i++) pg.totals[i] += income[i];
  pg.log.push(`Round ${pg.round}: contributions ${c.join(', ')}. Pot ${c.reduce((a, b) => a + b, 0)} × 1.6 = ${fmt(pot)}, so ${fmt(each)} each.`);
  let s = `Round ${pg.round}: you put in ${you} and got ${fmt(each)} back from the pot, so this round paid you ${fmt(income[0])}.`;
  if (pg.punish){
    const avg = c.reduce((a, b) => a + b, 0) / 4;
    const lines = [];
    for (let j = 1; j <= 3; j++){
      if (pgKind(j) === 'free' || c[j] < avg) continue;
      for (let i = 0; i < 4; i++){
        if (i === j || c[i] > avg - 3) continue;
        pg.totals[j] -= 1; pg.totals[i] -= 3; if (i) pg.scared[i] = 3;
        lines.push(`${NAMES[j]} paid 1 to take 3 from ${i ? NAMES[i] : 'you'}`);
      }
    }
    if (lines.length){ pg.log.push(lines.join('; ') + '.'); s += ` ${lines.join('. ')}.`; }
    if (pg.round < ROUNDS) s += ' You may punish a robot now, or put in again.';
  }
  pg.busy = false;
  if (pg.round >= ROUNDS) return pgFinish();
  pgRender(); pgStatus(s);
}
$('#cm-put').addEventListener('click', putIn);
$('#cm-pnew').addEventListener('click', pgReset);
$$('#cm-punish button').forEach(b => b.addEventListener('click', () => {
  const i = +b.dataset.p;
  if (!pg.punish || pg.over || pg.busy || !pg.round || pg.punished[i]) return;
  pg.punished[i] = true; pg.totals[0] -= 1; pg.totals[i] -= 3; pg.scared[i] = 3;
  pg.log.push(`You paid 1 to take 3 from ${NAMES[i]}.`);
  pgRender();
  pgStatus(`You paid 1 coin and ${NAMES[i]} lost 3. ${pgKind(i) === 'free' ? 'A punished free rider matches the others for three rounds.' : pgKind(i) === 'giver' ? 'It gave 10, so that was spite, not justice.' : 'It will keep matching the group average.'}`);
}));
seg($('#cm-ptype'), v => { pg.type = v; pgReset(); });
$('#cm-punish-on').addEventListener('change', e => { pg.punish = e.target.checked; pgReset(); });
slider($('#cm-give'), v => `${v} coin${v === 1 ? '' : 's'}`);
$$('#cm-quiz button').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.q;
  const msg = $('#cm-quiz-msg');
  if (v === '0.4'){
    quizOK = true; $('#cm-quiz').classList.add('done');
    msg.innerHTML = `<span class="win-c">Right.</span> 1 coin becomes 1.6, split four ways: 0.4 for you, 1.2 for the other three. You lose 0.6 by contributing. Now play 10 rounds.`;
    if (pg.games > 0) earn('cm-free');
  } else if (v === '1.6'){
    msg.innerHTML = 'The pot grows to 1.6, but it is split among four players. What is your quarter?';
  } else if (v === '1'){
    msg.innerHTML = 'If it came back whole, contributing would cost you nothing. Do the multiplying and the splitting.';
  } else {
    msg.innerHTML = '6.4 is what the pot would be if everyone put in one coin. Only a quarter of it is yours.';
  }
}));
pgReset();
calcRender(3);

/* ================= presets from the "Rules that work" section ================= */
$('#cm-preset-quota').addEventListener('click', () => {
  const b = $$('#cm-type button').find(x => x.dataset.v === 'greedy'); if (b) b.click();
  const q = $('#cm-quota'); if (!q.checked){ q.checked = true; q.dispatchEvent(new Event('change', { bubbles: true })); }
  $('#cm-q').value = 3; $('#cm-q').dispatchEvent(new Event('input', { bubbles: true }));
  $('#cm-catch').value = 3; $('#cm-catch').dispatchEvent(new Event('input', { bubbles: true }));
  pstatus(`Three Greedy robots, quota 3. Set the fine, then run 20 seasons. A Greedy robot wants 7 extra fish: what is the smallest fine that stops it?`);
  $('#cm-type').closest('.board').scrollIntoView({ behavior: WM.reduced ? 'auto' : 'smooth', block: 'start' });
});
$('#cm-preset-punish').addEventListener('click', () => {
  const b = $$('#cm-ptype button').find(x => x.dataset.v === 'mixed'); if (b) b.click();
  const p = $('#cm-punish-on'); if (!p.checked){ p.checked = true; p.dispatchEvent(new Event('change', { bubbles: true })); }
  pgStatus(`Mixed robots with punishment on. Play 10 rounds and watch Robo 2, the free rider, get brought into line.`);
  $('#cm-ptype').closest('.board').scrollIntoView({ behavior: WM.reduced ? 'auto' : 'smooth', block: 'start' });
});

/* redraw when the color scheme flips, so canvases pick up the new theme */
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderPond(); calcRender(+$('#cm-calc').value); }); } catch (e) {}
})();

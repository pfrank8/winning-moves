/* Chapter 4: Being unpredictable. Matching Pennies, expected value, the probability square, and the indifference solver. */
(function(){
'use strict';
const { $, $$, rand, earn, seg, slider, frac, payCell } = WM;

/* ================= Matching Pennies ================= */
const mp = { n: 0, score: 0, rh: 0, mode: 'fair', wins10: 0, strip: [] };
function roboCoin(){ const q = mp.mode === 'fair' ? 0.5 : 0.7; return Math.random() < q ? 'H' : 'T'; }
function mpRender(){
  $('#ms-n').textContent = mp.n; $('#ms-score').textContent = (mp.score > 0 ? '+' : '') + mp.score; $('#ms-rh').textContent = mp.rh;
  $('#ms-strip').innerHTML = mp.strip.slice(-30).map(x => `<span class="${x.w ? 'w' : 'l'}" title="you ${x.y}, Robo ${x.r}">${x.y}</span>`).join('');
}
$$('[data-coin]').forEach(b => b.addEventListener('click', () => {
  const y = b.dataset.coin, r = roboCoin(); const w = y !== r;
  mp.n++; mp.score += w ? 1 : -1; if (r === 'H') mp.rh++; mp.strip.push({ y, r, w });
  $('#ms-status').innerHTML = `You: <span class="you">${y === 'H' ? 'Heads' : 'Tails'}</span>. Robo: <span class="robo">${r === 'H' ? 'Heads' : 'Tails'}</span>. ${w ? 'Different: you win a point.' : 'Same: Robo wins a point.'}`;
  if (mp.mode === 'biased'){
    const last10 = mp.strip.slice(-10);
    if (last10.length === 10 && last10.filter(x => x.w).length >= 7) earn('ms-exploit');
  }
  mpRender();
}));
function mpReset(){ mp.n = 0; mp.score = 0; mp.rh = 0; mp.strip = []; mpRender(); $('#ms-status').textContent = 'Pick a side.'; }
$('#ms-reset').addEventListener('click', mpReset);
seg($('#ms-robo'), v => {
  mp.mode = v; mpReset();
  $('#ms-note').textContent = v === 'fair' ? 'A fair coin has no pattern to find.' : 'This Robo likes one side. Watch how often it plays Heads, then be different. Win 7 of any 10 in a row for a star.';
});
mpRender();

/* ================= expected value + square ================= */
function pennyUpdate(){
  const P = +$('#ms-p').value, Q = +$('#ms-q').value; const p = P / 100, q = Q / 100;
  const hh = p * q, tt = (1 - p) * (1 - q), same = hh + tt, diff = 1 - same, ev = diff - same;
  const pc = x => Math.round(x * 100);
  $('#ms-ev').innerHTML =
    `Both Heads: ${pc(hh)}% &nbsp; Both Tails: ${pc(tt)}%<br>` +
    `Same (Robo wins): <span class="robo">${pc(same)}%</span> &nbsp; Different (you win): <span class="you">${pc(diff)}%</span><br>` +
    `Your expected value per round: <b class="${ev > 0.001 ? 'win-c' : ev < -0.001 ? 'you' : ''}">${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(2)}</b><br>` +
    `<span class="note">= ${pc(diff)}% × (+1) + ${pc(same)}% × (−1). Over 100 rounds, expect about ${Math.round(ev * 100) >= 0 ? '+' : '−'}${Math.abs(Math.round(ev * 100))}.</span>`;
  const S = 200, ox = 44, oy = 16, x = ox + p * S, y = oy + q * S;
  const lab = (cx, cy, w, h, txt) => (w * h > 900 ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle">${txt}</text>` : '');
  $('#ms-psq').innerHTML =
    `<rect x="${ox}" y="${oy}" width="${p * S}" height="${q * S}" fill="var(--robo-soft)" stroke="var(--line)" stroke-width="2"/>` +
    `<rect x="${x}" y="${oy}" width="${(1 - p) * S}" height="${q * S}" fill="var(--you-soft)" stroke="var(--line)" stroke-width="2"/>` +
    `<rect x="${ox}" y="${y}" width="${p * S}" height="${(1 - q) * S}" fill="var(--you-soft)" stroke="var(--line)" stroke-width="2"/>` +
    `<rect x="${x}" y="${y}" width="${(1 - p) * S}" height="${(1 - q) * S}" fill="var(--robo-soft)" stroke="var(--line)" stroke-width="2"/>` +
    `<rect x="${ox}" y="${oy}" width="${S}" height="${S}" fill="none" stroke="var(--line)" stroke-width="3"/>` +
    lab(ox + p * S / 2, oy + q * S / 2, p * S, q * S, `HH ${pc(hh)}%`) +
    lab(x + (1 - p) * S / 2, oy + q * S / 2, (1 - p) * S, q * S, `TH ${pc((1 - p) * q)}%`) +
    lab(ox + p * S / 2, y + (1 - q) * S / 2, p * S, (1 - q) * S, `HT ${pc(p * (1 - q))}%`) +
    lab(x + (1 - p) * S / 2, y + (1 - q) * S / 2, (1 - p) * S, (1 - q) * S, `TT ${pc(tt)}%`) +
    `<text class="ax" x="${ox + S / 2}" y="${oy + S + 22}" text-anchor="middle" fill="var(--you)">you: Heads ←→ Tails</text>` +
    `<text class="ax" transform="translate(${ox - 14} ${oy + S / 2}) rotate(-90)" text-anchor="middle" fill="var(--robo)">Robo: Tails ←→ Heads</text>`;
}
slider($('#ms-p'), v => `${v}% (${frac(v)})`, pennyUpdate);
slider($('#ms-q'), v => `${v}% (${frac(v)})`, pennyUpdate);
$('#ms-flip').addEventListener('click', () => {
  const p = +$('#ms-p').value / 100, q = +$('#ms-q').value / 100;
  let score = 0, wins = 0;
  for (let i = 0; i < 100; i++){ const y = Math.random() < p, r = Math.random() < q; if (y === r) score--; else { score++; wins++; } }
  $('#ms-flip-result').innerHTML = `100 real flips: won ${wins}, lost ${100 - wins}. Score <b>${score >= 0 ? '+' : '−'}${Math.abs(score)}</b>.`;
  if (p === 0.5) earn('ms-safe');
});
pennyUpdate();

/* ================= penalty kick solver ================= */
const CLASSIC = [[50, 90], [80, 60]]; // rows: kick Left, kick Right; cols: dive Left, dive Right; goal chance %
const kick = { g: CLASSIC.map(r => r.slice()), fresh: false };
function optimalP(g){ // p on row 0 making the column player indifferent
  const a = g[0][0], b = g[0][1], c = g[1][0], d = g[1][1];
  const den = (a - c) - (b - d); if (den === 0) return null;
  const p = (d - c) / den; return (p >= 0 && p <= 1) ? p : null;
}
function optimalQ(g){ // q on column 0 making the row player indifferent
  const a = g[0][0], b = g[0][1], c = g[1][0], d = g[1][1];
  const den = (a - b) - (c - d); if (den === 0) return null;
  const q = (d - b) / den; return (q >= 0 && q <= 1) ? q : null;
}
function kickRender(){
  const g = kick.g;
  let h = '<tr><th class="corner">you ↓ &nbsp; robo →</th><th class="ch">Dives Left</th><th class="ch">Dives Right</th></tr>';
  ['Kick Left', 'Kick Right'].forEach((r, i) => {
    h += `<tr><th class="rh">${r}</th>`;
    for (let j = 0; j < 2; j++) h += `<td><input type="number" data-i="${i}" data-j="${j}" value="${g[i][j]}" min="0" max="100"><span class="sep">%</span></td>`;
    h += '</tr>';
  });
  $('#ms-kick').innerHTML = h;
  $$('#ms-kick input').forEach(inp => inp.addEventListener('input', () => { kick.g[+inp.dataset.i][+inp.dataset.j] = Math.max(0, Math.min(100, +inp.value || 0)); kick.fresh = false; chart(); }));
  chart();
}
function chart(){
  const g = kick.g; const p = +$('#ms-kp').value / 100;
  const L = x => g[0][0] * x + g[1][0] * (1 - x); // Robo dives Left
  const R = x => g[0][1] * x + g[1][1] * (1 - x); // Robo dives Right
  const ox = 46, oy = 14, cw = 440, ch = 190;
  const X = x => ox + x * cw, Y = v => oy + ch - (v / 100) * ch;
  let s = `<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>`;
  for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${ox}" x2="${ox + cw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${ox - 6}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`;
  s += `<line x1="${X(0)}" y1="${Y(L(0))}" x2="${X(1)}" y2="${Y(L(1))}" stroke="var(--robo)" stroke-width="4"/>`;
  s += `<line x1="${X(0)}" y1="${Y(R(0))}" x2="${X(1)}" y2="${Y(R(1))}" stroke="var(--robo)" stroke-width="4" stroke-dasharray="10 6"/>`;
  s += `<line x1="${X(p)}" y1="${oy}" x2="${X(p)}" y2="${oy + ch}" stroke="var(--you)" stroke-width="3"/>`;
  s += `<circle cx="${X(p)}" cy="${Y(L(p))}" r="6" fill="var(--robo)"/><circle cx="${X(p)}" cy="${Y(R(p))}" r="6" fill="var(--paper)" stroke="var(--robo)" stroke-width="3"/>`;
  s += `<text x="${ox + 8}" y="${oy + ch + 22}" fill="var(--you)">kick Left 0% of the time</text><text x="${ox + cw}" y="${oy + ch + 22}" text-anchor="end" fill="var(--you)">100%</text>`;
  s += `<line x1="${ox + 110}" x2="${ox + 140}" y1="${oy + ch + 42}" y2="${oy + ch + 42}" stroke="var(--robo)" stroke-width="4"/><text x="${ox + 146}" y="${oy + ch + 46}" fill="var(--robo)">Robo dives Left</text>`;
  s += `<line x1="${ox + 270}" x2="${ox + 300}" y1="${oy + ch + 42}" y2="${oy + ch + 42}" stroke="var(--robo)" stroke-width="4" stroke-dasharray="8 5"/><text x="${ox + 306}" y="${oy + ch + 46}" fill="var(--robo)">Robo dives Right</text>`;
  $('#ms-chart').innerHTML = s;
  const lo = Math.min(L(p), R(p)), worst = lo.toFixed(0);
  $('[data-for="ms-kp"]').textContent = `${Math.round(p * 100)}%`;
  $('#ms-lock-msg').innerHTML = `At these odds Robo's best dive holds you to <b>${worst}%</b>. ${Math.abs(L(p) - R(p)) < 0.5 ? 'The lines cross here: Robo does not care.' : L(p) < R(p) ? 'Robo would dive Left.' : 'Robo would dive Right.'}`;
}
slider($('#ms-kp'), v => `${v}%`, chart);
$('#ms-lock').addEventListener('click', () => {
  const p = +$('#ms-kp').value / 100, best = optimalP(kick.g);
  if (best === null){ $('#ms-lock-msg').innerHTML = 'These numbers have no crossing inside the chart: one kick is simply better. No mixing needed.'; return; }
  const off = Math.abs(p - best) * 100;
  if (off <= 3){
    $('#ms-lock-msg').innerHTML = `<b class="win-c">Locked in.</b> The exact answer is ${Math.round(best * 100)}%, and you are within ${off.toFixed(1)} points.`;
    if (kick.fresh) earn('ms-solve'); else $('#ms-lock-msg').innerHTML += ' Press "New numbers" and solve a fresh game for the star.';
  } else $('#ms-lock-msg').innerHTML = `<b class="you">Off by ${off.toFixed(0)} points.</b> Slide until the two lines meet.`;
});
$('#ms-new').addEventListener('click', () => {
  // generate a game with an interior mixed solution
  let g;
  do { const a = 30 + rand(40), d = 30 + rand(40); g = [[a, 70 + rand(28)], [70 + rand(28), d]]; } while (optimalP(g) === null || optimalQ(g) === null || optimalP(g) < 0.1 || optimalP(g) > 0.9);
  kick.g = g; kick.fresh = true; $('#ms-kp').value = 50; kickRender();
  $('#ms-kicks-msg').textContent = 'Fresh numbers. Find the crossing, lock it in.';
});
$('#ms-classic').addEventListener('click', () => { kick.g = CLASSIC.map(r => r.slice()); kick.fresh = false; $('#ms-kp').value = 50; kickRender(); });
$('#ms-kicks').addEventListener('click', () => {
  const g = kick.g, p = +$('#ms-kp').value / 100; const q = optimalQ(g); const qq = q === null ? 0.5 : q;
  let goals = 0;
  for (let i = 0; i < 20; i++){ const left = Math.random() < p, dl = Math.random() < qq; const chance = g[left ? 0 : 1][dl ? 0 : 1] / 100; if (Math.random() < chance) goals++; }
  const v = optimalP(g) === null ? null : (g[0][0] * optimalP(g) + g[1][0] * (1 - optimalP(g)));
  $('#ms-kicks-msg').innerHTML = `Scored <b>${goals}</b> of 20 (${goals * 5}%).${v === null ? '' : ` The value of this game is ${v.toFixed(0)}%, so expect about ${Math.round(v / 5)} goals in 20.`}`;
});
kickRender();
})();

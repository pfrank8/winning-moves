/* Chapter: Every game is secretly Nim (mex, Grundy values, sums of games, Kayles). */
(function(){
'use strict';
const { $, $$, pick, wait, earn, seg, clamp } = WM;

/* pure:start  (this block is unit-tested in node; keep it free of DOM code) */
function parseTakes(str){
  const t = Array.from(new Set(String(str).split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 40))).sort((a, b) => a - b);
  return t.length ? t : [1, 2, 3];
}
function parseSet(str){                       // array of whole numbers (order and repeats kept), or null if something is not a whole number
  const parts = String(str).replace(/[{}\[\]()]/g, ' ').split(/[,;\s]+/).filter(Boolean);
  const out = [];
  for (const p of parts){ if (!/^\d{1,3}$/.test(p)) return null; out.push(+p); }
  return out;
}
function mex(values){ const s = new Set(values); let i = 0; while (s.has(i)) i++; return i; }
function grundy(N, takes){                    // G[n] for the subtraction game with these takes, n = 0..N
  const G = new Array(N + 1);
  for (let n = 0; n <= N; n++) G[n] = mex(takes.filter(m => m <= n).map(m => G[n - m]));
  return G;
}
function period(G){                           // smallest p with G[n] = G[n + p] across the whole array, only if it shows at least twice
  for (let p = 1; 2 * p <= G.length; p++){
    let ok = true;
    for (let n = 0; n + p < G.length; n++) if (G[n] !== G[n + p]){ ok = false; break; }
    if (ok) return p;
  }
  return 0;
}
function legal(game){ return game.takes.filter(m => m <= game.n); }
function nimSum(games){ return games.reduce((x, g) => x ^ g.G[g.n], 0); }
function sumWinningMove(games){               // {i, m, target} or null when the nim-sum is already 0
  const total = nimSum(games);
  if (!total) return null;
  for (let i = 0; i < games.length; i++){
    const g = games[i], target = g.G[g.n] ^ total;
    if (target >= g.G[g.n]) continue;         // a value can be lowered only to something smaller than itself
    for (const m of g.takes) if (m <= g.n && g.G[g.n - m] === target) return { i, m, target };
  }
  return null;                                // unreachable: some pile carries the top bit of the total, and the mex rule puts every smaller value one move away
}
/* Kayles. K[n] is the Grundy value of a single row of n pins; a board is an array of booleans (pin standing?). */
function kaylesValues(N){
  const K = [0];
  for (let n = 1; n <= N; n++){
    const seen = [];
    for (let i = 0; i < n; i++){
      seen.push(K[i] ^ K[n - 1 - i]);                    // knock down pin i: rows of i and n-1-i remain
      if (i + 1 < n) seen.push(K[i] ^ K[n - 2 - i]);     // knock down pins i and i+1: rows of i and n-2-i remain
    }
    K[n] = mex(seen);
  }
  return K;
}
function rowsOf(up){
  const rows = []; let run = 0;
  for (const u of up){ if (u) run++; else if (run){ rows.push(run); run = 0; } }
  if (run) rows.push(run);
  return rows;
}
function kaylesTotal(up, K){ return rowsOf(up).reduce((x, r) => x ^ K[r], 0); }
function kaylesMoves(up){
  const moves = [];
  for (let i = 0; i < up.length; i++){
    if (!up[i]) continue;
    moves.push([i]);
    if (up[i + 1]) moves.push([i, i + 1]);
  }
  return moves;
}
function kaylesAfter(up, move){ const next = up.slice(); for (const i of move) next[i] = false; return next; }
function kaylesWinningMove(up, K){
  for (const mv of kaylesMoves(up)) if (kaylesTotal(kaylesAfter(up, mv), K) === 0) return mv;
  return null;
}
/* pure:end */

const listOr = arr => arr.length === 1 ? String(arr[0]) : arr.length === 2 ? `${arr[0]} or ${arr[1]}` : `${arr.slice(0, -1).join(', ')}, or ${arr[arr.length - 1]}`;
const bin = (x, w) => x.toString(2).padStart(w, '0');

/* ================= the mex calculator ================= */
const mexIn = $('#gr-mex-in');
function renderMex(){
  const vals = parseSet(mexIn.value);
  const line = $('#gr-mex-line'), ans = $('#gr-mex-ans');
  line.innerHTML = '';
  if (vals === null){ ans.innerHTML = '<span class="you">Whole numbers only, separated by commas.</span>'; return; }
  const m = mex(vals), set = new Set(vals);
  const biggest = vals.length ? Math.max.apply(null, vals) : 0;
  const top = Math.max(12, m + 1, Math.min(biggest + 1, 40));
  for (let i = 0; i <= top; i++){
    const c = document.createElement('span');
    c.className = 'gr-lc ' + (i === m ? 'mex' : set.has(i) ? 'in' : 'out');
    c.textContent = i; line.appendChild(c);
  }
  const uniq = Array.from(set).sort((a, b) => a - b);
  if (!uniq.length) ans.innerHTML = 'The set is empty. 0 is not in it, so <b>mex = 0</b>.';
  else ans.innerHTML = `In the set: ${uniq.join(', ')}. The smallest whole number missing is ${m}, so <b>mex = ${m}</b>.`;
}
mexIn.addEventListener('input', renderMex);
renderMex();

/* ================= five mex problems ================= */
const MEXQ = [
  { show: '{0, 1, 2}', ans: 3 },
  { show: '{1, 2, 3}', ans: 0 },
  { show: '{0, 1, 3, 4}', ans: 2 },
  { show: '{3, 0, 2, 0, 1, 5}', ans: 4 },
  { show: '{ }', ans: 0, note: 'the empty set' },
];
const mq = $('#gr-mq');
MEXQ.forEach((q, i) => {
  const row = document.createElement('div'); row.className = 'gr-mq-row';
  row.innerHTML = `<span class="q">mex ${q.show} =</span><input type="text" inputmode="numeric" maxlength="3" aria-label="mex of ${q.show}">` +
    `<span class="fb"></span>` + (q.note ? `<span class="note" style="margin:0">(${q.note})</span>` : '');
  mq.appendChild(row);
  $('input', row).addEventListener('keydown', e => { if (e.key === 'Enter') checkMex(); });
  $('input', row).addEventListener('input', () => { row.classList.remove('ok', 'bad'); $('.fb', row).textContent = ''; });
});
function checkMex(){
  let right = 0, blank = 0;
  $$('.gr-mq-row').forEach((row, i) => {
    const v = $('input', row).value.trim();
    row.classList.remove('ok', 'bad');
    if (v === ''){ blank++; $('.fb', row).textContent = 'blank'; return; }
    const ok = /^\d+$/.test(v) && +v === MEXQ[i].ans;
    row.classList.add(ok ? 'ok' : 'bad'); $('.fb', row).textContent = ok ? 'right' : 'not yet';
    if (ok) right++;
  });
  const msg = $('#gr-mq-msg');
  if (right === MEXQ.length){ msg.innerHTML = '<span class="win-c">All five right.</span> You are ready for the Grundy rule.'; earn('gr-mex'); }
  else if (blank) msg.textContent = `${right} right so far, ${blank} still blank.`;
  else msg.textContent = `${right} of 5. Look again at the red ones: what is the smallest number that is not there?`;
}
$('#gr-mq-check').addEventListener('click', checkMex);

/* ================= the Grundy labeler ================= */
const lab = { N: 15, takes: [1, 2, 3], vals: [], busy: false };
const MAXV = 20;
function labSettings(){
  lab.N = clamp(Math.round(+$('#gr-lab-n').value || 15), 6, 30); $('#gr-lab-n').value = lab.N;
  lab.takes = parseTakes($('#gr-lab-takes').value); $('#gr-lab-takes').value = lab.takes.join(', ');
}
function labRender(result){
  const host = $('#gr-lab-cells'); host.innerHTML = '';
  for (let n = 0; n <= lab.N; n++){
    const v = lab.vals[n];
    const cell = document.createElement('div'); cell.className = 'gr-cell';
    if (v === 0) cell.classList.add('zero');
    if (result && v !== null && v !== undefined) cell.classList.add(result[n] ? 'ok' : 'bad');
    cell.innerHTML = `<span class="n">${n}</span><input type="text" inputmode="numeric" maxlength="2" aria-label="Grundy value of ${n}" value="${v === null || v === undefined ? '' : v}">` +
      `<span class="pm"><button type="button" data-d="-1" aria-label="minus one">−</button><button type="button" data-d="1" aria-label="plus one">+</button></span>`;
    const input = $('input', cell);
    input.disabled = lab.busy;
    input.addEventListener('input', () => {
      const t = input.value.trim();
      lab.vals[n] = /^\d{1,2}$/.test(t) ? +t : null;
      cell.classList.remove('ok', 'bad'); cell.classList.toggle('zero', lab.vals[n] === 0);
    });
    $$('button', cell).forEach(b => {
      b.disabled = lab.busy;
      b.addEventListener('click', () => {
        if (lab.busy) return;
        const cur = lab.vals[n], d = +b.dataset.d;
        let next = cur === null || cur === undefined ? (d > 0 ? 0 : null) : clamp(cur + d, 0, MAXV);
        lab.vals[n] = next; input.value = next === null ? '' : next;
        cell.classList.remove('ok', 'bad'); cell.classList.toggle('zero', next === 0);
      });
    });
    host.appendChild(cell);
  }
}
function labReset(){ labSettings(); lab.vals = new Array(lab.N + 1).fill(null); labRender(); $('#gr-lab-explain').textContent = 'Fill in every cell, then check.'; }
function labExplain(n, G, takes){
  if (n === 0) return '0: no moves. The set of reachable values is empty, and the mex of nothing is 0. G(0) = 0.';
  const moves = takes.filter(m => m <= n);
  if (!moves.length) return `${n}: no take fits (every allowed take is bigger than ${n}). Empty set, so G(${n}) = 0.`;
  const to = moves.map(m => n - m), vals = to.map(x => G[x]);
  return `${n}: you can move to ${to.join(', ')}, worth ${vals.join(', ')}. mex{${vals.join(', ')}} = ${G[n]}.`;
}
$('#gr-lab-check').addEventListener('click', () => {
  if (lab.busy) return;
  labSettings();
  const G = grundy(lab.N, lab.takes);
  const result = []; let blanks = 0, wrong = 0;
  for (let n = 0; n <= lab.N; n++){
    const v = lab.vals[n];
    if (v === null || v === undefined){ blanks++; result[n] = false; continue; }
    result[n] = v === G[n]; if (!result[n]) wrong++;
  }
  labRender(result);
  const out = $('#gr-lab-explain');
  if (blanks) out.innerHTML = `${blanks} cell${blanks > 1 ? 's are' : ' is'} still blank. ${wrong ? `${wrong} wrong so far.` : 'Everything you filled in is right so far.'}`;
  else if (wrong) out.innerHTML = `<span class="you">${wrong} wrong.</span> Red cells are wrong. For each one, list the values one move away and find the smallest number that is missing.`;
  else {
    const zeros = G.map((g, i) => g === 0 ? i : null).filter(x => x !== null);
    const p = period(G);
    out.innerHTML = `<span class="win-c">All ${lab.N + 1} correct.</span> The zeros, which are the L positions, sit at ${zeros.join(', ')}.` +
      (p ? ` In this range the values repeat every ${p}${p === 4 && lab.takes.join() === '1,2,3' ? ': G(n) = n mod 4' : ''}.` : '');
    if (lab.N >= 12) earn('gr-labels');
  }
});
$('#gr-lab-show').addEventListener('click', async () => {
  if (lab.busy) return;
  labSettings(); lab.busy = true;
  const G = grundy(lab.N, lab.takes);
  lab.vals = new Array(lab.N + 1).fill(null);
  for (let n = 0; n <= lab.N; n++){
    lab.vals[n] = G[n];
    labRender();
    $$('#gr-lab-cells .gr-cell')[n].classList.add('cur');
    $('#gr-lab-explain').textContent = labExplain(n, G, lab.takes);
    await wait(n < 8 ? 1000 : 400);
  }
  lab.busy = false; labRender();
  $('#gr-lab-explain').innerHTML = 'Done. Now try takes of 1, 3, 4 and predict the values <i>before</i> pressing Show me.';
});
$('#gr-lab-clear').addEventListener('click', () => { if (!lab.busy) labReset(); });
$('#gr-lab-n').addEventListener('change', () => { if (!lab.busy) labReset(); });
$('#gr-lab-takes').addEventListener('change', () => { if (!lab.busy) labReset(); });
labReset();

/* ================= a sum of two games ================= */
const sg = { games: [], turn: 'you', first: 'you', over: false, busy: false, log: [] };
sg.games = [$('#gr-game-a'), $('#gr-game-b')].map((el, i) => ({ el, name: i ? 'B' : 'A', n: 0, start: 0, takes: [1, 2, 3], G: [] }));
const sgGoof = () => $('#gr-sum-goof').checked;
const sgStatus = html => { $('#gr-sum-status').innerHTML = html; };
const sgAnyMove = () => sg.games.some(g => legal(g).length > 0);
const sgCounts = () => sg.games.map(g => `${g.name}: ${g.n}`).join(', ');

function sgReadSettings(){
  for (const g of sg.games){
    const nIn = $('[data-n]', g.el), tIn = $('[data-takes-in]', g.el);
    g.n = clamp(Math.round(+nIn.value || 10), 1, 24); nIn.value = g.n;
    g.takes = parseTakes(tIn.value); tIn.value = g.takes.join(', ');
    g.start = g.n; g.G = grundy(g.n, g.takes);
  }
}
function sgRender(){
  const secret = $('#gr-sum-secret').checked;
  for (const [i, g] of sg.games.entries()){
    $('[data-rule]', g.el).textContent = `Take ${listOr(g.takes)}`;
    const st = $('[data-stones]', g.el); st.innerHTML = '';
    for (let k = 1; k <= g.start; k++){
      const s = document.createElement('div'); s.className = 'stone' + (k > g.n ? ' gone' : ''); s.textContent = k; st.appendChild(s);
    }
    $('[data-count]', g.el).textContent = g.n;
    const val = $('[data-val]', g.el); val.hidden = !secret; val.textContent = `worth ${g.G[g.n]}`;
    const host = $('[data-takes]', g.el); host.innerHTML = '';
    for (const m of g.takes){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-you btn-sm'; b.textContent = `Take ${m}`;
      b.disabled = sg.over || sg.busy || sg.turn !== 'you' || m > g.n;
      b.addEventListener('click', () => sgYou(i, m)); host.appendChild(b);
    }
  }
  const total = nimSum(sg.games), [a, b] = sg.games, va = a.G[a.n], vb = b.G[b.n];
  const w = Math.max(1, total.toString(2).length, va.toString(2).length, vb.toString(2).length);
  const tot = $('#gr-sum-total'); tot.hidden = !secret;
  tot.textContent = `Nim-sum: ${va} ⊕ ${vb} = ${total}   (binary ${bin(va, w)} ⊕ ${bin(vb, w)} = ${bin(total, w)})   ` +
    (sg.over ? '' : total ? 'The player to move can win.' : 'The player to move is losing.');
  $('#gr-sum-hint').disabled = sg.over || sg.busy || sg.turn !== 'you';
  $('#gr-sum-log').innerHTML = sg.log.slice(-4).join('<br>');
}
function sgNew(){
  sgReadSettings();
  sg.over = false; sg.busy = false; sg.log = []; sg.turn = sg.first;
  sgRender();
  if (!sgAnyMove()){ sg.over = true; sgRender(); sgStatus('Nobody can move from this position, so whoever goes first has already lost. Change the piles or the takes.'); return; }
  if (sg.turn === 'you') sgStatus('Your turn. Pick a game and take some stones.');
  else { sgStatus('Robo goes first...'); sgRobo(); }
}
function sgFinish(lastMover){
  sg.over = true; sg.busy = false; sgRender();
  if (lastMover === 'you'){
    sgStatus('<span class="win-c">Robo cannot move anywhere. You win!</span>');
    const fair = !sgGoof() && sg.games.every(g => g.start >= 6);
    if (fair) earn('gr-sum');
  } else {
    sgStatus('<span class="robo">You cannot move anywhere. Robo wins.</span> Tick "Show the secret" and watch what Robo does to the nim-sum.');
  }
}
function sgRandomMove(){
  const opts = [];
  sg.games.forEach((g, i) => legal(g).forEach(m => opts.push({ i, m })));
  return pick(opts);
}
async function sgRobo(){
  sg.turn = 'robo'; sg.busy = true; sgRender();
  await wait(750);
  const win = sumWinningMove(sg.games);
  const goof = sgGoof() && Math.random() < 0.5;
  const move = (win && !goof) ? win : sgRandomMove();
  const g = sg.games[move.i]; g.n -= move.m;
  sg.log.push(`Robo took ${move.m} from Game ${g.name}. ${sgCounts()}.`);
  if (!sgAnyMove()) return sgFinish('robo');
  sg.turn = 'you'; sg.busy = false; sgRender();
  sgStatus(`Robo took ${move.m} from Game ${g.name}. Your turn.` + (win ? '' : ' <span class="note">(Robo had no winning move. You are on track.)</span>'));
}
function sgYou(i, m){
  if (sg.over || sg.busy || sg.turn !== 'you') return;
  const g = sg.games[i];
  if (!g.takes.includes(m) || m > g.n) return;
  g.n -= m; sg.log.push(`You took ${m} from Game ${g.name}. ${sgCounts()}.`);
  if (!sgAnyMove()) return sgFinish('you');
  sgStatus('Robo is thinking...'); sgRobo();
}
$('#gr-sum-hint').addEventListener('click', () => {
  if (sg.over || sg.busy || sg.turn !== 'you') return;
  const [a, b] = sg.games, va = a.G[a.n], vb = b.G[b.n], total = va ^ vb;
  if (!total){
    sgStatus(`Uh oh. Game A is worth ${va} and Game B is worth ${vb}, and ${va} ⊕ ${vb} = 0. You are on a losing position. Take something small and hope Robo goofs.`);
    return;
  }
  const w = sumWinningMove(sg.games); const g = sg.games[w.i];
  sgStatus(`Game A is worth ${va} and Game B is worth ${vb}: nim-sum ${total}. Fix Game ${g.name}: bring it from ${g.G[g.n]} down to ${w.target}. Take <b>${w.m}</b>, leaving ${g.n - w.m}, which is worth ${w.target}.`);
});
$('#gr-sum-secret').addEventListener('change', sgRender);
$('#gr-sum-new').addEventListener('click', sgNew);
for (const g of sg.games){
  $('[data-n]', g.el).addEventListener('change', sgNew);
  $('[data-takes-in]', g.el).addEventListener('change', sgNew);
}
seg($('#gr-sum-first'), v => { sg.first = v; sgNew(); });
sgNew();

/* ================= Kayles ================= */
const KMAX = 16;
const K = kaylesValues(KMAX);
const ky = { n: 8, up: [], turn: 'you', first: 'you', over: false, busy: false, sel: null, log: [] };
const kyStatus = html => { $('#gr-k-status').innerHTML = html; };
const describe = mv => mv.length === 1 ? `pin ${mv[0] + 1}` : `pins ${mv[0] + 1} and ${mv[1] + 1}`;
function kyRender(){
  const host = $('#gr-k-pins'); host.innerHTML = '';
  ky.up.forEach((u, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'gr-pin' + (u ? '' : ' down') + (ky.sel === i ? ' sel' : '');
    b.textContent = i + 1; b.setAttribute('aria-label', `pin ${i + 1}${u ? '' : ', knocked down'}`);
    b.disabled = !u || ky.over || ky.busy || ky.turn !== 'you';
    b.addEventListener('click', () => kyClick(i));
    host.appendChild(b);
  });
  const mine = !ky.over && !ky.busy && ky.turn === 'you';
  $('#gr-k-one').disabled = !(mine && ky.sel !== null);
  $('#gr-k-hint').disabled = !mine;
  const tot = $('#gr-k-total'); tot.hidden = !$('#gr-k-secret').checked;
  const rows = rowsOf(ky.up);
  tot.textContent = rows.length
    ? `Rows: ${rows.join(', ')}.   Values: ${rows.map(r => K[r]).join(' ⊕ ')} = ${kaylesTotal(ky.up, K)}.   ` + (ky.over ? '' : kaylesTotal(ky.up, K) ? 'The player to move can win.' : 'The player to move is losing.')
    : 'No pins standing.';
  $('#gr-k-log').innerHTML = ky.log.slice(-4).join('<br>');
}
function kyNew(){
  ky.n = clamp(Math.round(+$('#gr-k-n').value || 8), 3, KMAX); $('#gr-k-n').value = ky.n;
  ky.up = new Array(ky.n).fill(true); ky.sel = null; ky.over = false; ky.busy = false; ky.log = []; ky.turn = ky.first;
  kyRender();
  if (ky.turn === 'you') kyStatus('Your turn. Pick a pin.');
  else { kyStatus('Robo goes first...'); kyRobo(); }
}
function kyFinish(who){
  ky.over = true; ky.busy = false; ky.sel = null; kyRender();
  if (who === 'you') kyStatus('<span class="win-c">You knocked down the last pin. You win!</span>');
  else kyStatus('<span class="robo">Robo knocked down the last pin.</span> A single row is a win for whoever goes first, so go first and split it in the middle.');
}
function kyClick(i){
  if (ky.over || ky.busy || ky.turn !== 'you' || !ky.up[i]) return;
  if (ky.sel === i) return kyMove([i]);
  if (ky.sel !== null && ky.up[ky.sel] && Math.abs(ky.sel - i) === 1) return kyMove([Math.min(ky.sel, i), Math.max(ky.sel, i)]);
  ky.sel = i; kyRender();
  const nb = [i - 1, i + 1].filter(j => j >= 0 && j < ky.n && ky.up[j]).map(j => j + 1);
  kyStatus(`Pin ${i + 1} picked. Press the button to knock it down` + (nb.length ? `, or click pin ${nb.join(' or ')} to knock down two.` : '. It has no standing neighbor.'));
}
function kyMove(mv){
  ky.up = kaylesAfter(ky.up, mv); ky.sel = null;
  ky.log.push(`You knocked down ${describe(mv)}. Rows left: ${rowsOf(ky.up).join(', ') || 'none'}.`);
  if (!ky.up.some(Boolean)) return kyFinish('you');
  kyStatus('Robo is thinking...'); kyRobo();
}
async function kyRobo(){
  ky.turn = 'robo'; ky.busy = true; kyRender();
  await wait(750);
  const win = kaylesWinningMove(ky.up, K);
  const mv = win || pick(kaylesMoves(ky.up));
  ky.up = kaylesAfter(ky.up, mv);
  ky.log.push(`Robo knocked down ${describe(mv)}. Rows left: ${rowsOf(ky.up).join(', ') || 'none'}.`);
  if (!ky.up.some(Boolean)) return kyFinish('robo');
  ky.turn = 'you'; ky.busy = false; kyRender();
  kyStatus(`Robo knocked down ${describe(mv)}. Your turn.` + (win ? '' : ' <span class="note">(Robo had no winning move. You are on track.)</span>'));
}
$('#gr-k-one').addEventListener('click', () => { if (!ky.over && !ky.busy && ky.turn === 'you' && ky.sel !== null && ky.up[ky.sel]) kyMove([ky.sel]); });
$('#gr-k-hint').addEventListener('click', () => {
  if (ky.over || ky.busy || ky.turn !== 'you') return;
  const w = kaylesWinningMove(ky.up, K);
  if (w){
    const rows = rowsOf(kaylesAfter(ky.up, w));
    kyStatus(`Hint: knock down <b>${describe(w)}</b>. That leaves ${rows.length ? 'rows of ' + rows.join(' and ') + ', worth ' + rows.map(r => K[r]).join(' ⊕ ') + ' = 0' : 'nothing'}.`);
  } else {
    kyStatus(`Uh oh. The rows are worth ${rowsOf(ky.up).map(r => K[r]).join(' ⊕ ')} = 0 and it is your turn. Knock something down and hope.`);
  }
});
$('#gr-k-secret').addEventListener('change', kyRender);
$('#gr-k-new').addEventListener('click', kyNew);
$('#gr-k-n').addEventListener('change', kyNew);
seg($('#gr-k-first'), v => { ky.first = v; kyNew(); });
kyNew();
})();

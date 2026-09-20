/* Chapter 8: Chomp. Perfect play by memoized search, hints, the square trick, and shape counting. */
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, seg, fmtNum, turn, cue } = WM;

const st = { R: 4, C: 6, rows: [6, 6, 6, 6], over: false, busy: false, first: 'you', id: 0, ate: [] };   // ate: squares Robo's last bite removed
const say = (who, html, tag) => turn('#ch-bar', who, html, tag);
const YOUR_MOVE = 'Click any brown square to take a bite. You eat that square and everything to its right and below it.';
const memo = new Map();
const key = rows => rows.join(',');
function moves(rows){ const m = []; for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r]; c++) if (r || c) m.push([r, c]); return m; }
function apply(rows, r, c){ return rows.map((len, i) => i >= r ? Math.min(len, c) : len); }
function win(rows){ // true when the player to move can force a win
  const k = key(rows); if (memo.has(k)) return memo.get(k);
  let res = false;
  for (const [r, c] of moves(rows)) if (!win(apply(rows, r, c))){ res = true; break; }
  memo.set(k, res); return res;
}
const winningMoves = rows => moves(rows).filter(([r, c]) => !win(apply(rows, r, c)));
const left = () => st.rows.reduce((a, b) => a + b, 0);

function render(){
  const host = $('#ch-bar'); host.style.gridTemplateColumns = `repeat(${st.C}, auto)`;
  if (host.dataset.shape !== `${st.R}x${st.C}`){
    host.innerHTML = ''; host.dataset.shape = `${st.R}x${st.C}`;
    for (let r = 0; r < st.R; r++) for (let c = 0; c < st.C; c++){
      const b = document.createElement('button'); b.type = 'button'; b.dataset.r = r; b.dataset.c = c; b.setAttribute('aria-label', `row ${r + 1}, column ${c + 1}`);
      if (r === 0 && c === 0){ b.classList.add('poison'); b.textContent = '☠︎'; }
      b.addEventListener('click', () => you(r, c));
      b.addEventListener('mouseenter', () => preview(r, c));
      b.addEventListener('mouseleave', () => $$('#ch-bar button').forEach(x => x.classList.remove('will')));
      host.appendChild(b);
    }
  }
  $$('button', host).forEach(b => {
    const r = +b.dataset.r, c = +b.dataset.c, eaten = c >= st.rows[r];
    b.classList.toggle('eaten', eaten); b.classList.remove('hint', 'will'); b.disabled = eaten || st.over || st.busy;
    b.classList.toggle('ch-robo', eaten && st.ate.indexOf(`${r},${c}`) >= 0);
  });
  $('#ch-hint').disabled = st.over || st.busy;
}
function preview(r, c){ if (st.over || st.busy) return; $$('#ch-bar button').forEach(b => { const br = +b.dataset.r, bc = +b.dataset.c; b.classList.toggle('will', br >= r && bc >= c && bc < st.rows[br]); }); }
function end(loser){
  st.over = true; st.busy = false; render();
  if (loser === 'robo'){
    say('win', 'Robo had to eat the poison. You win! Press New bar to play again.');
    if (!$('#ch-goof').checked){
      if (st.R * st.C >= 20) earn('ch-win');
      if (st.R === st.C && st.R >= 4 && st.first === 'you') earn('ch-square');
    }
  } else say('lose', 'Only the poison is left, and you have to eat it. Press New bar to try again, and ask for a Hint when you are stuck.');
}
async function robo(){
  const opening = left() === st.R * st.C;
  st.busy = true; render(); say('robo', opening ? 'Robo goes first. Robo is thinking...' : 'Robo is thinking...');
  const id = st.id;
  await wait(650);
  if (id !== st.id) return;
  if (left() === 1) return end('robo');
  const goof = $('#ch-goof').checked && Math.random() < 0.5;
  const wins = winningMoves(st.rows);
  const mv = (wins.length && !goof) ? pick(wins) : pick(moves(st.rows));
  const before = st.rows;
  st.rows = apply(st.rows, mv[0], mv[1]);
  st.ate = [];
  for (let r = 0; r < st.R; r++) for (let c = st.rows[r]; c < before[r]; c++) st.ate.push(`${r},${c}`);
  st.busy = false; render();
  if (left() === 1) return end('you');
  const youCanWin = winningMoves(st.rows).length > 0;
  say('you', `Robo bit at row ${mv[0] + 1}, column ${mv[1] + 1} and ate ${st.ate.length} square${st.ate.length === 1 ? '' : 's'}, outlined in blue. Click a brown square.${youCanWin ? ' You have a winning move right now.' : ''}`);
}
function you(r, c){
  if (st.over || st.busy || c >= st.rows[r]) return;
  if (r === 0 && c === 0){ if (left() === 1) return end('you'); say('you', 'That is the poison. Whoever eats it loses. Click a brown square instead.', 'Not that one'); return; }
  st.rows = apply(st.rows, r, c); st.ate = []; render();
  if (left() === 1) return end('robo');
  robo();
}
function newGame(){
  st.R = Math.min(5, Math.max(2, +$('#ch-rows').value || 4)); st.C = Math.min(7, Math.max(2, +$('#ch-cols').value || 6));
  $('#ch-rows').value = st.R; $('#ch-cols').value = st.C;
  st.rows = Array(st.R).fill(st.C); st.over = false; st.busy = false; st.ate = []; st.id++;
  render();
  $('#ch-note').textContent = `Robo knows the winning move for every one of the ${fmtNum(choose(st.R + st.C, st.R))} shapes of this bar. That is different from knowing a rule for it.`;
  if (st.first === 'robo') robo(); else say('you', YOUR_MOVE);
}
$('#ch-hint').addEventListener('click', () => {
  if (st.over || st.busy) return;
  const wins = winningMoves(st.rows);
  if (!wins.length){ say('you', 'No winning move from here. Robo is ahead. Take a small bite and hope.', 'Hint'); return; }
  const [r, c] = pick(wins);
  $$('#ch-bar button').forEach(b => b.classList.toggle('hint', +b.dataset.r === r && +b.dataset.c === c));
  say('you', `The square ringed in green is a winning bite. Click it. There ${wins.length === 1 ? 'is 1 winning move' : 'are ' + wins.length + ' winning moves'} right now.`, 'Hint');
});
$('#ch-new').addEventListener('click', newGame);
$('#ch-rows').addEventListener('change', newGame);
$('#ch-cols').addEventListener('change', newGame);
$('#ch-square-btn').addEventListener('click', () => {
  $('#ch-rows').value = 5; $('#ch-cols').value = 5; newGame();
  if (st.first === 'you') say('you', 'Square bar. Click the square in row 2, column 2. After that, copy every bite Robo takes on the other arm.');
});
seg($('#ch-first'), v => { st.first = v; newGame(); });

/* ================= counting shapes ================= */
function choose(n, k){ let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
(function stairs(){
  const rows = [6, 4, 4, 1], cell = 44, ox = 30, oy = 20;
  let s = '';
  rows.forEach((len, r) => { for (let c = 0; c < 6; c++){ const on = c < len; s += `<rect x="${ox + c * cell}" y="${oy + r * cell}" width="${cell - 3}" height="${cell - 3}" rx="5" fill="${on ? (r === 0 && c === 0 ? '#3E9C55' : '#7A4A22') : 'none'}" stroke="${on ? '#3B2314' : 'var(--grid)'}" stroke-width="2" stroke-dasharray="${on ? '' : '4 3'}"/>`; } });
  // path along the staircase edge: from top-right (6,0) to bottom-left (0,4)
  let px = ox + 6 * cell - 3, py = oy; let d = `M${px} ${py}`;
  const steps = [];
  for (let r = 0; r < rows.length; r++){
    const len = rows[r];
    while ((px - ox + 3) / cell > len){ px -= cell; d += `L${px} ${py}`; steps.push('L'); }
    py += cell; d += `L${px} ${py - 3}`; steps.push('D');
  }
  while (px > ox){ px -= cell; d += `L${px} ${py - 3}`; steps.push('L'); }
  s += `<path d="${d}" fill="none" stroke="var(--math)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<text x="${ox}" y="${oy + 4 * cell + 36}" font-family="var(--f-mono)" font-size="14" fill="var(--ink)">${steps.join(' ')}</text>`;
  s += `<text x="${ox}" y="${oy + 4 * cell + 56}" font-family="var(--f-display)" font-size="13" fill="var(--ink-soft)">rows 6, 4, 4, 1: six lefts and four downs</text>`;
  $('#ch-stairs').innerHTML = s;
})();
const quiz = { r: 3, c: 5 };
const quizAsk = () => `How many shapes can a <b>${quiz.r} by ${quiz.c}</b> bar make?`;
function quizNew(){ quiz.r = 2 + rand(4); quiz.c = 2 + rand(6); $('#ch-quiz').value = ''; turn('#ch-quiz', 'you', `${quizAsk()} Type the number and press Check.`); $('#ch-quiz').focus({ preventScroll: true }); }
function quizCheck(){
  const want = choose(quiz.r + quiz.c, quiz.r), typed = $('#ch-quiz').value.trim(), got = +typed;
  if (typed === ''){ turn('#ch-quiz', 'you', `Type a number in the Shapes box first. ${quizAsk()}`, 'Not yet'); return; }
  if (got === want){ turn('#ch-quiz', 'win', `Yes: a ${quiz.r} by ${quiz.c} bar makes C(${quiz.r + quiz.c}, ${quiz.r}) = ${fmtNum(want)} shapes. Press Another bar for a new one.`, 'Correct'); earn('ch-count'); }
  else turn('#ch-quiz', 'you', `Not ${fmtNum(got || 0)}. ${quizAsk()} Count the steps: ${quiz.c} lefts and ${quiz.r} downs, ${quiz.r + quiz.c} steps in all. Choose which ${quiz.r} go down.`, 'Not yet');
}
$('#ch-quiz-check').addEventListener('click', quizCheck);
$('#ch-quiz').addEventListener('keydown', e => { if (e.key === 'Enter') quizCheck(); });
$('#ch-quiz-new').addEventListener('click', quizNew);
(function table(){
  let h = '<tr><th>rows × cols</th><th>steps</th><th>shapes</th></tr>';
  for (const [r, c] of [[2, 2], [2, 3], [3, 3], [3, 4], [4, 6], [5, 5], [5, 7], [10, 10]]) h += `<tr><td>${r} × ${c}</td><td>C(${r + c}, ${r})</td><td>${fmtNum(choose(r + c, r))}</td></tr>`;
  $('#ch-table').innerHTML = h;
})();
newGame();
cue($('#ch-bar'));   // the first thing to click in the chapter's first game: the bar itself
})();

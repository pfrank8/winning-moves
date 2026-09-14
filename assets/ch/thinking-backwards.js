/* Chapter: Thinking backwards (the 21 Game + position labeler). */
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, seg } = WM;

/* ---------- solver shared by both boards ----------
   labels(N, takes, misere)[n] is true when the player to move from n stones can force a win. */
function parseTakes(str){
  const t = Array.from(new Set(String(str).split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  return t.length ? t : [1, 2, 3];
}
function labels(N, takes, misere){
  const W = new Array(N + 1);
  W[0] = misere;                       // normal: facing 0 you already lost; misère: the other player took the last stone and lost
  for (let n = 1; n <= N; n++) W[n] = takes.some(m => m <= n && !W[n - m]);
  return W;
}

/* ================= the game ================= */
const g = { start: 21, takes: [1, 2, 3], misere: false, n: 21, turn: 'you', over: false, busy: false, first: 'you', log: [], W: [], id: 0 };
const goofOn = () => $('#tb-goof').checked;

function winningMoves(n){ return g.takes.filter(m => m <= n && !g.W[n - m]); }
function legalMoves(n){ return g.takes.filter(m => m <= n); }

function render(){
  const line = $('#tb-line'); line.innerHTML = '';
  const secret = $('#tb-secret').checked;
  for (let i = 1; i <= g.start; i++){
    const s = document.createElement('div'); s.className = 'stone';
    if (i > g.n) s.classList.add('gone');
    if (secret && !g.W[i]) s.classList.add('magic');
    s.textContent = i; line.appendChild(s);
  }
  $('#tb-count').textContent = g.n;
  const host = $('#tb-takes'); host.innerHTML = '';
  for (const m of g.takes){
    const b = document.createElement('button'); b.className = 'btn btn-you'; b.type = 'button'; b.textContent = 'Take ' + m;
    b.disabled = g.over || g.busy || g.turn !== 'you' || m > g.n;
    b.addEventListener('click', () => youTake(m)); host.appendChild(b);
  }
  $('#tb-hint').disabled = g.over || g.busy || g.turn !== 'you';
  $('#tb-rules').textContent = `Take ${g.takes.join(', ')} on your turn. Last stone ${g.misere ? 'loses' : 'wins'}.`;
  $('#tb-log').innerHTML = g.log.slice(-4).join('<br>');
}
const status = html => { $('#tb-status').innerHTML = html; };

function newGame(){
  g.start = Math.min(40, Math.max(8, +$('#tb-stones').value || 21)); $('#tb-stones').value = g.start;
  g.takes = parseTakes($('#tb-takes-in').value); $('#tb-takes-in').value = g.takes.join(', ');
  g.W = labels(g.start, g.takes, g.misere);
  g.n = g.start; g.over = false; g.busy = false; g.log = []; g.turn = g.first; g.id++;
  render();
  if (g.turn === 'you') status('Your turn. How many will you take?');
  else { status('Robo goes first...'); roboMove(); }
}
function finish(lastTaker){
  g.over = true; g.busy = false; render();
  const youWon = g.misere ? lastTaker !== 'you' : lastTaker === 'you';
  if (youWon){
    status(`<span class="win-c">${g.misere ? 'Robo had to take the last stone. You win!' : 'You took the last stone. You win!'}</span>`);
    const fair = !goofOn() && g.start >= 12 && Math.max.apply(null, g.takes) <= 5;
    if (fair) earn(g.misere ? 'tb-misere' : 'tb-win');
  } else {
    status(`<span class="robo">${g.misere ? 'You had to take the last stone.' : 'Robo took the last stone.'}</span> Try the hint, or turn on the losing positions.`);
  }
}
async function roboMove(){
  g.turn = 'robo'; g.busy = true; render();
  const id = g.id;
  await wait(750);
  if (id !== g.id) return;   // a new game started while Robo was thinking
  const wins = winningMoves(g.n);
  const goof = goofOn() && Math.random() < 0.5;
  const m = (wins.length && !goof) ? pick(wins) : pick(legalMoves(g.n));
  g.n -= m; g.log.push(`Robo took ${m}. ${g.n} left.`);
  if (g.n === 0) return finish('robo');
  g.turn = 'you'; g.busy = false; render();
  status(`Robo took ${m}. Your turn.` + (wins.length ? '' : ' <span class="note">(Robo had no winning move. You are on track.)</span>'));
}
function youTake(m){
  if (g.over || g.busy || g.turn !== 'you' || m > g.n) return;
  g.n -= m; g.log.push(`You took ${m}. ${g.n} left.`);
  if (g.n === 0) return finish('you');
  status('Robo is thinking...'); roboMove();
}
$('#tb-hint').addEventListener('click', () => {
  const wins = winningMoves(g.n);
  if (wins.length) status(`Hint: take <b>${wins[0]}</b>. That leaves ${g.n - wins[0]}, a losing position for Robo.`);
  else status(`Uh oh. ${g.n} is a losing position for the player to move, and that is you. Take something small and hope Robo goofs.`);
});
$('#tb-secret').addEventListener('change', render);
$('#tb-new').addEventListener('click', newGame);
$('#tb-stones').addEventListener('change', newGame);
$('#tb-takes-in').addEventListener('change', newGame);
seg($('#tb-first'), v => { g.first = v; newGame(); });
seg($('#tb-rule'), v => { g.misere = v === 'misere'; newGame(); });
newGame();

/* ================= the labeler ================= */
const lab = { N: 21, takes: [1, 2, 3], misere: false, marks: [], busy: false };
const MARK = ['', 'W', 'L'];
function labSettings(){
  lab.N = Math.min(40, Math.max(8, +$('#lab-n').value || 21)); $('#lab-n').value = lab.N;
  lab.takes = parseTakes($('#lab-takes').value); $('#lab-takes').value = lab.takes.join(', ');
}
function labRender(result){
  const host = $('#lab-cells'); host.innerHTML = '';
  for (let n = 0; n <= lab.N; n++){
    const b = document.createElement('button'); b.type = 'button';
    const m = lab.marks[n] || 0;
    b.className = MARK[m];
    if (result && m) b.classList.add(result[n] ? 'ok' : 'bad');
    b.innerHTML = `<span class="n">${n}</span><span class="m">${MARK[m] || '·'}</span>`;
    b.addEventListener('click', () => { if (lab.busy) return; lab.marks[n] = ((lab.marks[n] || 0) + 1) % 3; labRender(); });
    host.appendChild(b);
  }
}
function labReset(){ labSettings(); lab.marks = new Array(lab.N + 1).fill(0); labRender(); $('#lab-explain').textContent = 'Click a number to label it.'; }
function explain(n, W, takes, misere){
  if (n === 0) return misere ? '0: the other player took the last stone and lost. You win without moving. W.' : '0: the other player took the last stone. You lost. L.';
  const moves = takes.filter(m => m <= n);
  const toL = moves.filter(m => !W[n - m]);
  if (toL.length) return `${n}: you can move to ${n - toL[0]}, which is L. Hand them the L. W.`;
  return `${n}: every move (to ${moves.map(m => n - m).join(', ')}) lands on a W for the other player. L.`;
}
$('#lab-check').addEventListener('click', () => {
  if (lab.busy) return;
  labSettings();
  const W = labels(lab.N, lab.takes, lab.misere);
  const result = []; let blanks = 0, wrong = 0;
  for (let n = 0; n <= lab.N; n++){
    const m = lab.marks[n] || 0;
    if (!m){ blanks++; result[n] = false; continue; }
    const ok = (m === 1) === W[n]; result[n] = ok; if (!ok) wrong++;
  }
  labRender(result);
  if (blanks) $('#lab-explain').innerHTML = `${blanks} number${blanks > 1 ? 's are' : ' is'} still blank. ${wrong ? `${wrong} wrong so far.` : 'Everything you marked is right so far.'}`;
  else if (wrong) $('#lab-explain').innerHTML = `<span class="you">${wrong} wrong.</span> Red cells are wrong. Remember: W if any move reaches an L.`;
  else {
    $('#lab-explain').innerHTML = `<span class="win-c">All ${lab.N + 1} correct.</span> The L positions are ${W.map((w, i) => w ? null : i).filter(x => x !== null).join(', ')}.`;
    if (lab.N >= 15) earn('tb-labels');
  }
});
$('#lab-show').addEventListener('click', async () => {
  if (lab.busy) return;
  labSettings(); lab.busy = true;
  const W = labels(lab.N, lab.takes, lab.misere);
  lab.marks = new Array(lab.N + 1).fill(0);
  for (let n = 0; n <= lab.N; n++){
    lab.marks[n] = W[n] ? 1 : 2;
    labRender();
    const cells = $$('#lab-cells button'); cells[n].classList.add('cur');
    $('#lab-explain').textContent = explain(n, W, lab.takes, lab.misere);
    await wait(n < 8 ? 900 : 350);
  }
  lab.busy = false; labRender();
  $('#lab-explain').innerHTML = `Done. Now try a different set of allowed takes and predict the L positions <i>before</i> pressing Show me.`;
});
$('#lab-clear').addEventListener('click', () => { if (!lab.busy) labReset(); });
$('#lab-n').addEventListener('change', () => { if (!lab.busy) labReset(); });
$('#lab-takes').addEventListener('change', () => { if (!lab.busy) labReset(); });
seg($('#lab-rule'), v => { lab.misere = v === 'misere'; if (!lab.busy) labReset(); });
labReset();
})();

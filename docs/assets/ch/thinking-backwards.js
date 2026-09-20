/* Chapter: Thinking backwards (the 21 Game + position labeler). */
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, seg, turn, cue } = WM;

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
const g = { start: 21, takes: [1, 2, 3], misere: false, n: 21, turn: 'you', over: false, busy: false, first: 'you', log: [], W: [], who: [], id: 0 };
const BOARD = '#tb-line';
const goofOn = () => $('#tb-goof').checked;

function winningMoves(n){ return g.takes.filter(m => m <= n && !g.W[n - m]); }
function legalMoves(n){ return g.takes.filter(m => m <= n); }
const yourTurn = () => !g.over && !g.busy && g.turn === 'you';
const orList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1] : String(a[0]);
const left = () => `<b>${g.n}</b> stone${g.n === 1 ? '' : 's'} left.`;
/* The one sentence that says what to click right now. */
function ask(first){ return `Press ${orList(legalMoves(g.n).map(m => `<b class="you">Take ${m}</b>`))}${first ? ', or click a red-ringed stone' : ''}.`; }

function render(){
  const line = $('#tb-line'); line.innerHTML = '';
  const secret = $('#tb-secret').checked, live = yourTurn();
  for (let i = 1; i <= g.start; i++){
    const m = g.n - i + 1;                       // clicking stone i takes it and every stone after it
    const can = live && i <= g.n && g.takes.includes(m);
    const s = document.createElement(can ? 'button' : 'div'); s.className = 'stone';
    if (i > g.n){ s.classList.add('gone'); if (g.who[i]) s.classList.add(g.who[i]); }
    if (secret && !g.W[i]) s.classList.add('magic');
    if (can){
      s.type = 'button'; s.title = `Take ${m}, leaving ${g.n - m}`; s.setAttribute('aria-label', s.title);
      s.addEventListener('click', () => youTake(m));
    }
    s.textContent = i; line.appendChild(s);
  }
  $('#tb-count').textContent = g.n;
  const host = $('#tb-takes'); host.innerHTML = '';
  for (const m of g.takes){
    const b = document.createElement('button'); b.className = 'btn btn-you'; b.type = 'button'; b.textContent = 'Take ' + m;
    b.disabled = !live || m > g.n;
    b.addEventListener('click', () => youTake(m)); host.appendChild(b);
  }
  $('#tb-hint').disabled = !live;
  $('#tb-rules').textContent = `Take ${g.takes.join(', ')} on your turn. Last stone ${g.misere ? 'loses' : 'wins'}.`;
  $('#tb-log').innerHTML = g.log.slice(-4).join('<br>');
}

function newGame(){
  g.start = Math.min(40, Math.max(8, +$('#tb-stones').value || 21)); $('#tb-stones').value = g.start;
  g.takes = parseTakes($('#tb-takes-in').value); $('#tb-takes-in').value = g.takes.join(', ');
  g.W = labels(g.start, g.takes, g.misere);
  g.n = g.start; g.over = false; g.busy = false; g.log = []; g.who = []; g.turn = g.first; g.id++;
  render();
  if (g.turn === 'you') turn(BOARD, 'you', `${left()} ${ask(true)}`);
  else roboMove('Robo goes first.');
}
function finish(lastTaker){
  g.over = true; g.busy = false; render();
  const youWon = g.misere ? lastTaker !== 'you' : lastTaker === 'you';
  if (youWon){
    const fair = !goofOn() && g.start >= 12 && Math.max.apply(null, g.takes) <= 5;
    const noStar = fair ? '' : goofOn() ? ' No star while Robo goofs.' : ' No star for this one: it needs 12 or more stones and takes no bigger than 5.';
    turn(BOARD, 'win', `${g.misere ? 'Robo had to take the last stone. You win!' : 'You took the last stone. You win!'}${noStar} Press New game to play again.`);
    if (fair) earn(g.misere ? 'tb-misere' : 'tb-win');
  } else {
    turn(BOARD, 'lose', `${g.misere ? 'You had to take the last stone.' : 'Robo took the last stone.'} Press New game, then try the Hint or tick Show the losing positions.`);
  }
}
/* Only reachable when the allowed takes leave out 1 (say "2, 3" with 1 stone left): the player who cannot move loses, as in labels(). */
function stuck(who){
  g.over = true; g.busy = false; render();
  const why = `${left()} The smallest take is ${g.takes[0]}, so ${who === 'you' ? 'you' : 'Robo'} cannot move, and whoever cannot move loses.`;
  if (who === 'you') turn(BOARD, 'lose', `${why} Press New game.`);
  else turn(BOARD, 'win', `${why} Press New game to play again.`);
}
async function roboMove(lead){
  g.turn = 'robo'; g.busy = true; render();
  turn(BOARD, 'robo', `${lead} ${left()} Robo is thinking...`);
  const id = g.id;
  await wait(750);
  if (id !== g.id) return;   // a new game started while Robo was thinking
  if (!legalMoves(g.n).length) return stuck('robo');
  const wins = winningMoves(g.n);
  const goof = goofOn() && Math.random() < 0.5;
  const m = (wins.length && !goof) ? pick(wins) : pick(legalMoves(g.n));
  for (let i = g.n - m + 1; i <= g.n; i++) g.who[i] = 'robo';
  g.n -= m; g.log.push(`Robo took ${m}. ${g.n} left.`);
  if (g.n === 0) return finish('robo');
  g.turn = 'you'; g.busy = false; render();
  if (!legalMoves(g.n).length) return stuck('you');
  turn(BOARD, 'you', `<span class="robo">Robo took ${m}${wins.length ? '' : ', but it had no winning move'}.</span> ${left()} ${ask()}`);
}
function youTake(m){
  if (!yourTurn() || m > g.n || !g.takes.includes(m)) return;
  for (let i = g.n - m + 1; i <= g.n; i++) g.who[i] = 'you';
  g.n -= m; g.log.push(`You took ${m}. ${g.n} left.`);
  if (g.n === 0) return finish('you');
  roboMove(`You took ${m}.`);
}
$('#tb-hint').addEventListener('click', () => {
  if (!yourTurn()) return;
  const wins = winningMoves(g.n);
  if (wins.length) turn(BOARD, 'you', `Press <b class="you">Take ${wins[0]}</b>. That leaves ${g.n - wins[0]}, a losing position for Robo.`, 'Hint');
  else turn(BOARD, 'you', `Uh oh. ${g.n} is a losing position for the player to move, and that is you. Take something small and hope Robo goofs.`, 'Hint');
});
$('#tb-secret').addEventListener('change', render);
$('#tb-new').addEventListener('click', newGame);
$('#tb-stones').addEventListener('change', newGame);
$('#tb-takes-in').addEventListener('change', newGame);
seg($('#tb-first'), v => { g.first = v; newGame(); });
seg($('#tb-rule'), v => { g.misere = v === 'misere'; newGame(); });
newGame();
cue($('#tb-takes'));

/* ================= the labeler ================= */
const lab = { N: 21, takes: [1, 2, 3], misere: false, marks: [], busy: false };
const MARK = ['', 'W', 'L'];
const LAB = '#lab-cells';
function labSettings(){
  lab.N = Math.min(40, Math.max(8, +$('#lab-n').value || 21)); $('#lab-n').value = lab.N;
  lab.takes = parseTakes($('#lab-takes').value); $('#lab-takes').value = lab.takes.join(', ');
}
const labDone = () => lab.marks.filter(Boolean).length;
const labHelp = () => `Click a number to mark it <b class="win-c">W</b>. Click it again for <b class="you">L</b>. Label all ${lab.N + 1}, then press Check my labels.`;
function labRender(result){
  const host = $('#lab-cells'); host.innerHTML = '';
  for (let n = 0; n <= lab.N; n++){
    const b = document.createElement('button'); b.type = 'button';
    const m = lab.marks[n] || 0;
    b.className = MARK[m];
    if (result && m) b.classList.add(result[n] ? 'ok' : 'bad');
    b.disabled = lab.busy;
    b.setAttribute('aria-label', `${n} stones: ${MARK[m] || 'not labeled'}`);
    b.innerHTML = `<span class="n">${n}</span><span class="m">${MARK[m] || '·'}</span>`;
    b.addEventListener('click', () => { if (lab.busy) return; lab.marks[n] = ((lab.marks[n] || 0) + 1) % 3; labRender(); labProgress(n); });
    host.appendChild(b);
  }
  $('#lab-count').textContent = `${labDone()} of ${lab.N + 1} labeled.`;
  ['#lab-check', '#lab-show', '#lab-clear'].forEach(id => { $(id).disabled = lab.busy; });
}
function labProgress(n){
  const m = lab.marks[n] || 0, todo = lab.N + 1 - labDone();
  const did = m ? `${n} is marked <b class="${m === 1 ? 'win-c' : 'you'}">${MARK[m]}</b>.` : `${n} is blank again.`;
  turn(LAB, 'you', todo ? `${did} ${todo} to go. Click a number again to flip it.` : `${did} All ${lab.N + 1} are labeled. Press Check my labels.`);
}
function labReset(){ labSettings(); lab.marks = new Array(lab.N + 1).fill(0); labRender(); turn(LAB, 'you', labHelp()); }
function explain(n, W, takes, misere){
  if (n === 0) return misere ? '0: the other player took the last stone and lost. You win without moving. W.' : '0: the other player took the last stone. You lost. L.';
  const moves = takes.filter(m => m <= n);
  const toL = moves.filter(m => !W[n - m]);
  if (toL.length) return `${n}: you can move to ${n - toL[0]}, which is L. Hand them the L. W.`;
  if (!moves.length) return `${n}: no take is small enough, so you cannot move at all. L.`;
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
  if (blanks) turn(LAB, 'you', `${blanks} number${blanks > 1 ? 's are' : ' is'} still blank. ${wrong ? `${wrong} wrong so far, shaded red.` : 'Everything you marked is right so far.'} Click the blank ones, then check again.`, 'Not yet');
  else if (wrong) turn(LAB, 'you', `${wrong} wrong, shaded red. Click ${wrong > 1 ? 'them' : 'it'} to fix, then check again. Remember: W if any move reaches an L.`, 'Not yet');
  else {
    turn(LAB, 'win', `All ${lab.N + 1} correct. The L positions are ${W.map((w, i) => w ? null : i).filter(x => x !== null).join(', ')}. Change the allowed takes below and try again.`, 'Solved');
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
    turn(LAB, 'math', explain(n, W, lab.takes, lab.misere), 'Show me');
    await wait(n < 8 ? 900 : 350);
  }
  lab.busy = false; labRender();
  turn(LAB, 'math', 'Done. Now change the allowed takes below, and predict the L positions <i>before</i> pressing Show me.', 'Show me');
});
$('#lab-clear').addEventListener('click', () => { if (!lab.busy) labReset(); });
$('#lab-n').addEventListener('change', () => { if (!lab.busy) labReset(); });
$('#lab-takes').addEventListener('change', () => { if (!lab.busy) labReset(); });
seg($('#lab-rule'), v => { lab.misere = v === 'misere'; if (!lab.busy) labReset(); });
labReset();
})();

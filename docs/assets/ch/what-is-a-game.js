/* Chapter 1: What is a game? Rock Paper Scissors with three Robo brains, the RPSLS grid, and a fair-game builder. */
(function(){
'use strict';
const { $, $$, pick, earn, seg, turn, pickRows, cue } = WM;

/* ================= Rock, Paper, Scissors ================= */
const RPS = ['Rock', 'Paper', 'Scissors'];
const HAND = { Rock: '✊', Paper: '✋', Scissors: '✌' };
const BEATS = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' };   // key beats value
const BEATEN_BY = { Rock: 'Paper', Paper: 'Scissors', Scissors: 'Rock' }; // value beats key
const s = { w: 0, l: 0, t: 0, n: 0, mode: 'random', last: null, counts: { Rock: 0, Paper: 0, Scissors: 0 }, patternWins: 0, patternRounds: 0 };

function buildGrid(){
  let h = '<tr><th class="corner">you ↓ &nbsp; robo →</th>' + RPS.map(c => `<th class="ch" data-name="${c}"><span>${HAND[c]} ${c}</span></th>`).join('') + '</tr>';
  for (const y of RPS){
    h += `<tr><th class="rh" data-name="${y}"><span>${HAND[y]} ${y}</span></th>`;
    for (const r of RPS){
      const cls = y === r ? 'tie' : BEATS[y] === r ? 'win' : 'lose';
      h += `<td class="${cls}" data-you="${y}" data-robo="${r}">${cls === 'tie' ? 'Tie' : cls === 'win' ? 'Win' : 'Lose'}</td>`;
    }
    h += '</tr>';
  }
  $('#wg-grid').innerHTML = h;
}
function roboChoice(){
  if (s.mode === 'pattern' && s.last) return BEATEN_BY[s.last];
  if (s.mode === 'learner' && s.n > 0){
    const fav = RPS.reduce((a, b) => s.counts[b] > s.counts[a] ? b : a);
    return BEATEN_BY[fav];
  }
  return pick(RPS);
}
function updateStats(){
  $('#wg-n').textContent = s.n; $('#wg-w').textContent = s.w; $('#wg-l').textContent = s.l; $('#wg-t').textContent = s.t;
  if (s.n >= 10 && s.mode === 'random'){
    earn('wg-ten');
    $('#wg-note').textContent = `You tied ${s.t} of ${s.n} rounds. The math says about one third. Keep going and watch the fraction settle.`;
  }
}
$$('[data-rps]').forEach(b => b.addEventListener('click', () => {
  const you = b.dataset.rps, robo = roboChoice();
  let res;
  if (you === robo){ res = "It's a tie."; s.t++; }
  else if (BEATS[you] === robo){ res = 'You win!'; s.w++; }
  else { res = 'Robo wins.'; s.l++; }
  s.n++; s.counts[you]++; s.last = you;
  if (s.mode === 'pattern'){
    s.patternRounds++; if (BEATS[you] === robo) s.patternWins++;
    if (s.patternRounds >= 10 && s.patternWins >= 7) earn('wg-exploit');
  }
  /* the strip is the narrator: what both hands were, who won, how to go again */
  const who = you === robo ? 'math' : BEATS[you] === robo ? 'win' : 'lose';
  turn('#wg-grid', who, `You: <span class="you">${HAND[you]} ${you}</span>. Robo: <span class="robo">${HAND[robo]} ${robo}</span>. <b>${res}</b> ${s.n <= 3 ? "Your row meets Robo's column at the yellow box. " : ''}Click a hand to play again.`, `Round ${s.n}`);
  $$('#wg-grid td').forEach(td => td.classList.toggle('hit', td.dataset.you === you && td.dataset.robo === robo));
  $$('#wg-grid th.rh').forEach(th => th.classList.toggle('wg-on', th.dataset.name === you));
  $$('#wg-grid th.ch').forEach(th => th.classList.toggle('wg-on', th.dataset.name === robo));
  updateStats();
}));
const RPS_HELP = {
  random: 'Click a hand: <b class="you">Rock</b>, <b class="you">Paper</b> or <b class="you">Scissors</b>. Robo picks at the same moment.',
  pattern: 'Click a hand. Pattern Robo expects you to repeat your last move: work out what it will play, and beat it 7 times in 10.',
  learner: 'Click a hand. Learning Robo plays whatever beats the move you have used most so far.',
};
function resetRps(){
  s.w = s.l = s.t = s.n = 0; s.last = null; s.counts = { Rock: 0, Paper: 0, Scissors: 0 }; s.patternWins = 0; s.patternRounds = 0;
  updateStats(); $$('#wg-grid td').forEach(td => td.classList.remove('hit'));
  $$('#wg-grid th').forEach(th => th.classList.remove('wg-on'));
  turn('#wg-grid', 'you', RPS_HELP[s.mode]);
}
$('#wg-reset').addEventListener('click', resetRps);
seg($('#wg-mode'), v => {
  s.mode = v; resetRps();
  $('#wg-rules').textContent = v === 'random' ? 'Robo picks at random.' : v === 'pattern' ? 'Pattern Robo assumes you will repeat your last move.' : 'Learning Robo plays whatever beats your most common move.';
  $('#wg-note').textContent = v === 'pattern' ? 'Win 7 of 10 rounds to prove you have cracked the pattern.' : v === 'learner' ? 'The only defense against a learner is to have no favorite.' : 'After ten rounds, compare your number of ties with the math below.';
});
buildGrid(); updateStats();
cue($$('[data-rps]'));

/* ================= RPSLS grid ================= */
const RPSLS = ['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock'];
const BEATS5 = { Rock: ['Scissors', 'Lizard'], Paper: ['Rock', 'Spock'], Scissors: ['Paper', 'Lizard'], Lizard: ['Spock', 'Paper'], Spock: ['Scissors', 'Rock'] };
(function(){
  let h = '<tr><th class="corner">you ↓ &nbsp; robo →</th>' + RPSLS.map(c => `<th class="ch">${c}</th>`).join('') + '</tr>';
  for (const y of RPSLS){
    h += `<tr><th class="rh">${y}</th>`;
    for (const r of RPSLS){
      const cls = y === r ? 'tie' : BEATS5[y].includes(r) ? 'win' : 'lose';
      h += `<td class="${cls}" data-row="${y}">${cls === 'tie' ? 'Tie' : cls === 'win' ? 'Win' : 'Lose'}</td>`;
    }
    h += '</tr>';
  }
  const t = $('#wg-rpsls'); t.innerHTML = h;
  /* The rows are what you count, so the rows are what you click. No hover preview: a strip that changes height
     under a resting mouse moves the rows, which moves the hover, which changes the strip again. */
  const say = r => {
    const w = RPSLS[r], lost = RPSLS.filter(x => x !== w && !BEATS5[w].includes(x));
    turn(t, 'math', `<b class="you">${w}</b> beats ${BEATS5[w].join(' and ')}, and loses to ${lost.join(' and ')}: <b>2 wins</b>, 2 losses, 1 tie. Click another row: is it always two?`, `The ${w} row`);
  };
  const rows = pickRows(t, r => { rows.mark(r); $$('tr.pickable', t).forEach((tr, i) => tr.classList.toggle('wg-show', i === r)); say(r); });
})();

/* ================= fair game builder ================= */
const bal = { names: [], win: {} }; // win['i,j'] = true if i beats j, false if j beats i, undefined if unset
function balNames(){
  const raw = $('#wg-names').value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5);
  while (raw.length < 5) raw.push('Weapon ' + (raw.length + 1));
  bal.names = raw;
}
const BAL_HELP = 'Click any <b>?</b> box to decide who wins that matchup. Click it again to flip it. Goal: every weapon beats exactly two others.';
function balRender(did){
  const N = bal.names;
  let h = '<tr><th class="corner">row vs column</th>' + N.map(c => `<th class="ch">${c}</th>`).join('') + '</tr>';
  N.forEach((r, i) => {
    h += `<tr><th class="rh">${r}</th>`;
    N.forEach((c, j) => {
      if (i === j){ h += '<td class="diag">tie</td>'; return; }
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      const v = bal.win[key];
      let cls = '', txt = '?';
      if (v !== undefined){ const rowWins = (i < j) ? v : !v; cls = rowWins ? 'w' : 'l'; txt = rowWins ? 'beats' : 'loses'; }
      h += `<td class="${cls}" data-i="${i}" data-j="${j}" tabindex="0" role="button" aria-label="${r} against ${c}: ${v === undefined ? 'undecided' : txt}">${txt}</td>`;
    });
    h += '</tr>';
  });
  $('#wg-bal').innerHTML = h;
  $$('#wg-bal td[data-i]').forEach(td => {
    const flip = viaKey => {
      const i = +td.dataset.i, j = +td.dataset.j;
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      const rowWinsNow = bal.win[key] === undefined ? false : ((i < j) ? bal.win[key] : !bal.win[key]);
      const rowWinsNext = bal.win[key] === undefined ? true : !rowWinsNow;
      bal.win[key] = (i < j) ? rowWinsNext : !rowWinsNext;
      balRender(rowWinsNext ? `${N[i]} beats ${N[j]}.` : `${N[j]} beats ${N[i]}.`);
      if (viaKey){ const again = $(`#wg-bal td[data-i="${i}"][data-j="${j}"]`); if (again) again.focus(); } // the table was rebuilt: keep the keyboard where it was
    };
    td.addEventListener('click', () => flip(false));
    td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); flip(true); } });
  });
  // counts
  const wins = N.map(() => 0); let set = 0;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++){
    const v = bal.win[`${i},${j}`]; if (v === undefined) continue; set++;
    if (v) wins[i]++; else wins[j]++;
  }
  $('#wg-counts').innerHTML = N.map((n, i) => `<span class="${set === 10 && wins[i] === 2 ? 'ok' : ''}">${n}: ${wins[i]} win${wins[i] === 1 ? '' : 's'}</span>`).join('');
  /* the strip narrates: what that click did, how many are left, then the verdict */
  const said = did ? did + ' ' : '';
  if (set === 0) turn('#wg-bal', 'you', BAL_HELP);
  else if (set < 10) turn('#wg-bal', 'you', `${said}${10 - set} matchup${10 - set === 1 ? '' : 's'} still undecided. Click another <b>?</b> box.`, `${set} of 10 decided`);
  else if (wins.every(w => w === 2)){ turn('#wg-bal', 'win', 'Fair game. Every weapon beats exactly two others. Notice the shape: the wins form a loop, like Rock, Paper, Scissors with more stops.', 'Solved'); earn('wg-balance'); }
  else turn('#wg-bal', 'you', `${said}All ten decided, but ${N.filter((n, i) => wins[i] > 2).join(', ') || 'nobody'} beats too many and ${N.filter((n, i) => wins[i] < 2).join(', ') || 'nobody'} beats too few. Click a box to flip it.`, 'Not fair yet');
}
$('#wg-names').addEventListener('change', () => { balNames(); balRender(); });
$('#wg-bal-clear').addEventListener('click', () => { bal.win = {}; balRender(); });
balNames(); balRender();
})();

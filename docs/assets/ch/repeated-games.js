/* Chapter: Playing again and again (the repeated Cookie Game against Robo strategies, and a round-robin tournament).
   The core (strategies, matches, tournaments) is pure and is exported for node tests when there is no window. */
(function(){
'use strict';

/* ================= core ================= */
const S = 'S', G = 'G';
const PAYOFF = { SS: 3, SG: 0, GS: 5, GG: 1 };            // PAYOFF[mine + theirs] = my cookies
const pay = (mine, theirs) => PAYOFF[mine + theirs];
const flip = m => (m === S ? G : S);
const last = a => a[a.length - 1];

/* A strategy's move(me, them) sees both move histories so far (its own first) and returns S or G. */
const STRATS = [
  { key: 'tft', name: 'Tit for Tat', desc: 'Shares in round 1. After that it plays whatever you played in the round before.',
    move: (me, them) => (them.length ? last(them) : S) },
  { key: 'grab', name: 'Always Grab', desc: 'Grabs every round, whatever you do.', move: () => G },
  { key: 'share', name: 'Always Share', desc: 'Shares every round, whatever you do.', move: () => S },
  { key: 'grudger', name: 'Grudger', desc: 'Shares until you grab once. After that it grabs forever.',
    move: (me, them) => (them.indexOf(G) >= 0 ? G : S) },
  { key: 'random', name: 'Random', desc: 'Flips a coin every round.', random: true, move: () => (Math.random() < 0.5 ? S : G) },
  { key: 'pavlov', name: 'Pavlov', desc: 'Win-Stay, Lose-Shift. Shares in round 1. Then it repeats its own last move if that move scored 3 or 5, and switches if it scored 0 or 1.',
    move: (me, them) => { if (!me.length) return S; const m = last(me); return pay(m, last(them)) >= 3 ? m : flip(m); } },
  { key: 'tf2t', name: 'Tit for Two Tats', desc: 'Grabs only after you grab twice in a row. Otherwise it shares.',
    move: (me, them) => { const n = them.length; return (n >= 2 && them[n - 1] === G && them[n - 2] === G) ? G : S; } },
];
const byKey = key => STRATS.find(s => s.key === key);

/* The 8 strategies that remember exactly one round back. */
const KNOWN = { SSS: 'Always Share', SSG: 'Tit for Tat', GSG: 'Suspicious Tit for Tat', GGG: 'Always Grab' };
function custom(first, afterS, afterG){
  return { key: 'yours', name: 'Yours', first, afterS, afterG, code: first + afterS + afterG,
    move: (me, them) => (them.length ? (last(them) === S ? afterS : afterG) : first) };
}

/* Play R rounds. noise = chance (0..1) that each played move is flipped by mistake; both players see the flipped move. */
function playMatch(A, B, R, noise, rng){
  rng = rng || Math.random;
  const a = [], b = []; let sa = 0, sb = 0;
  for (let r = 0; r < R; r++){
    let ma = A.move(a, b), mb = B.move(b, a);
    if (noise > 0){ if (rng() < noise) ma = flip(ma); if (rng() < noise) mb = flip(mb); }
    a.push(ma); b.push(mb); sa += pay(ma, mb); sb += pay(mb, ma);
  }
  return { a: sa, b: sb, movesA: a, movesB: b };
}

/* Round robin: every strategy plays every other one once, and a copy of itself (that match counts the average of the two copies). */
function tournament(strats, R, noise){
  const n = strats.length;
  const total = new Array(n).fill(0);
  const vs = strats.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++){
    const m = playMatch(strats[i], strats[j], R, noise);
    if (i === j){ const avg = (m.a + m.b) / 2; total[i] += avg; vs[i][i] = avg; }
    else { total[i] += m.a; total[j] += m.b; vs[i][j] = m.a; vs[j][i] = m.b; }
  }
  return { total, vs };
}

/* Which deterministic strategies would have played exactly robo[] against you[]? */
function consistent(you, robo){
  return STRATS.filter(s => !s.random).filter(s => {
    const me = [];
    for (let r = 0; r < you.length; r++){
      const m = s.move(me, you.slice(0, r));
      if (m !== robo[r]) return false;
      me.push(m);
    }
    return true;
  }).map(s => s.key);
}

const core = { S, G, pay, flip, STRATS, byKey, KNOWN, custom, playMatch, tournament, consistent };
if (typeof window === 'undefined'){ if (typeof module !== 'undefined') module.exports = core; return; }

/* ================= the page ================= */
const { $, $$, pick, wait, earn, seg, slider, grid, fmtNum } = WM;
const ROUNDS = 20;
const GRID = { rows: ['Share', 'Grab'], cols: ['Share', 'Grab'], pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]] };
const idx = m => (m === S ? 0 : 1);
const word = m => (m === S ? 'shared' : 'grabbed');

/* ---------- board 1: twenty rounds against Robo ---------- */
const g = { pickKey: 'tft', strat: null, mystery: false, you: [], robo: [], yourScore: 0, roboScore: 0, over: false, busy: false, guessed: false };
const status = html => { $('#rg-status').innerHTML = html; };

function tile(who, m, pending){
  if (pending) return `<div class="rg-t q">?</div>`;
  if (!m) return `<div class="rg-t e"></div>`;
  return `<div class="rg-t ${who} ${m}">${m}</div>`;
}
function render(pendingRobo){
  const cur = g.over ? -1 : g.you.length + (pendingRobo ? 0 : 1);
  let h = '<div class="rg-lab">Round</div>';
  for (let r = 1; r <= ROUNDS; r++) h += `<div class="rg-n${r === cur ? ' cur' : ''}">${r}</div>`;
  h += '<div class="rg-lab you">You</div>';
  for (let r = 0; r < ROUNDS; r++) h += tile('rg-y', g.you[r], false);
  h += '<div class="rg-lab robo">Robo</div>';
  for (let r = 0; r < ROUNDS; r++) h += tile('rg-r', g.robo[r], pendingRobo && r === g.you.length - 1);
  $('#rg-strip').innerHTML = h;

  $('#rg-grid').innerHTML = grid(GRID);
  const n = g.robo.length;
  if (n){
    const td = $(`#rg-grid td[data-r="${idx(g.you[n - 1])}"][data-c="${idx(g.robo[n - 1])}"]`);
    if (td) td.classList.add('hit');
  }
  $('#rg-round').textContent = g.over ? '20 / 20' : `${Math.min(ROUNDS, g.you.length + 1)} / 20`;
  $('#rg-you').textContent = g.yourScore;
  $('#rg-robo').textContent = g.roboScore;
  const locked = g.over || g.busy;
  $('#rg-share').disabled = locked; $('#rg-grab').disabled = locked;
  $('#rg-hint').disabled = g.busy;
}

function newGame(){
  g.pickKey = $('#rg-strat').value;
  g.mystery = g.pickKey === 'mystery';
  g.strat = g.mystery ? pick(STRATS) : (byKey(g.pickKey) || STRATS[0]);
  g.you = []; g.robo = []; g.yourScore = 0; g.roboScore = 0; g.over = false; g.busy = false; g.guessed = false;
  $('#rg-desc').innerHTML = g.mystery
    ? 'Robo has picked one of the seven strategies in secret. Watch how it answers you. At the end you get one guess.'
    : `<b class="robo">${g.strat.name}:</b> ${g.strat.desc}`;
  $('#rg-end').hidden = true; $('#rg-guess').hidden = true; $('#rg-summary').innerHTML = '';
  render(false);
  status('Round 1 of 20. Share or Grab?');
}

async function play(m){
  if (g.over || g.busy) return;
  g.busy = true;
  const rm = g.strat.move(g.robo, g.you);       // Robo decides from the rounds so far, at the same time as you
  g.you.push(m);
  render(true);
  status(`Round ${g.you.length}: you ${word(m)}. Robo is choosing...`);
  await wait(600);
  g.robo.push(rm);
  const yp = pay(m, rm), rp = pay(rm, m);
  g.yourScore += yp; g.roboScore += rp;
  g.busy = false;
  if (g.you.length >= ROUNDS){ g.over = true; render(false); return finish(); }
  render(false);
  status(`Round ${g.you.length}: you ${word(m)}, Robo ${word(rm)}. <span class="you">+${yp}</span> for you, <span class="robo">+${rp}</span> for Robo. Round ${g.you.length + 1} of 20.`);
}

function finish(){
  const lead = g.yourScore - g.roboScore;
  const verdict = lead > 0 ? `You finished ${lead} ahead.` : lead < 0 ? `Robo finished ${-lead} ahead.` : 'A tie.';
  $('#rg-end').hidden = false;
  if (g.mystery){
    status(`Twenty rounds done. <span class="you">You: ${g.yourScore}</span>, <span class="robo">Robo: ${g.roboScore}</span>. ${verdict} Now: which strategy was Robo using?`);
    $('#rg-guess').hidden = false;
    $$('#rg-guess button').forEach(b => { b.disabled = false; });
    return;
  }
  status(`Twenty rounds done. <span class="you">You: ${g.yourScore}</span>, <span class="robo">Robo: ${g.roboScore}</span>. ${verdict}`);
  let extra = '';
  if (!g.strat.random){
    const allS = playMatch(custom(S, S, S), g.strat, ROUNDS, 0).a;
    const allG = playMatch(custom(G, G, G), g.strat, ROUNDS, 0).a;
    extra = ` Against ${g.strat.name}, sharing every round scores <b>${allS}</b> and grabbing every round scores <b>${allG}</b>.`;
  }
  $('#rg-summary').innerHTML = `Robo was playing <b class="robo">${g.strat.name}</b>.${extra}`;
  if (g.strat.key === 'tft' && g.yourScore >= 60 && g.you.every(m => m === S)) earn('rg-coop');
}

function guess(key){
  if (!g.over || !g.mystery || g.guessed) return;
  g.guessed = true;
  $$('#rg-guess button').forEach(b => { b.disabled = true; });
  const actual = g.strat, right = key === actual.key;
  const cons = consistent(g.you, g.robo);
  const others = cons.filter(k => k !== actual.key).map(k => byKey(k).name);
  let msg;
  if (right && (actual.random || others.length === 0)){
    msg = `<span class="win-c">Right.</span> Robo was playing <b class="robo">${actual.name}</b>, and your moves ruled out every other strategy.`;
    earn('rg-guess');
  } else if (right){
    msg = `<span class="win-c">Right</span>, it was <b class="robo">${actual.name}</b>. But that was a lucky guess: ${others.join(' and ')} would have played exactly the same 20 moves against you. For the star, play in a way that tells them apart.`;
  } else {
    const yours = byKey(key);
    const fits = cons.indexOf(key) >= 0;
    msg = `<span class="you">Not this time.</span> Robo was playing <b class="robo">${actual.name}</b>, not ${yours ? yours.name : key}.` +
      (fits ? ` Your guess would have played the same 20 moves, so your moves did not separate them. A grab followed by shares separates most strategies; a second grab separates the rest.` : ` Look at the rounds after your grabs: that is where the strategies differ.`);
  }
  $('#rg-summary').innerHTML = msg + ` <b class="robo">${actual.name}:</b> ${actual.desc}`;
  if (actual.key === 'tft' && g.yourScore >= 60 && g.you.every(m => m === S)) earn('rg-coop');
}

const HINTS = {
  tft: 'Share every round and you both get 60. The most you can possibly get from Tit for Tat in 20 rounds is 62: share 19 times and grab in round 20, when it cannot answer.',
  grab: 'Nothing you do changes Robo. Against a grab, 1 beats 0, so grab.',
  share: 'Robo never punishes anything. Grabbing every round scores 100. It is not much of a game.',
  grudger: 'One grab and Robo never shares again. Share all the way (60), or share 19 times and grab once in round 20 (62).',
  random: 'Robo ignores you completely, so each round is a one-shot Cookie Game. Grab is dominant.',
  pavlov: 'Sharing every round scores 60. If you grab, Pavlov grabs back, scores 1, and switches to sharing, so you can grab it again: 5, 1, 5, 1. That is also 60. Share 19 times and grab in round 20 for 62.',
  tf2t: 'It forgives a single grab. Grab, share, grab, share never triggers it: 5, 3, 5, 3, which is 80 in 20 rounds. Grab in rounds 19 and 20 as well and it is 82.',
  mystery: 'Probe it. Share a few times, grab once, then share again. Tit for Tat grabs back exactly once. Tit for Two Tats lets one grab go. Always Share never grabs. Grudger and Pavlov both keep grabbing while you share, so to tell those two apart, grab again: Pavlov gives up grabbing after a round where it scored only 1, Grudger never does. Random ignores your moves completely.',
};
$('#rg-hint').addEventListener('click', () => {
  const k = g.mystery ? 'mystery' : g.strat.key;
  status(`<span class="math-c">Hint:</span> ${HINTS[k]}`);
});
$('#rg-share').addEventListener('click', () => play(S));
$('#rg-grab').addEventListener('click', () => play(G));
$('#rg-new').addEventListener('click', newGame);
$('#rg-strat').addEventListener('change', newGame);
(function buildGuessButtons(){
  const host = $('#rg-guess-buttons');
  for (const s of STRATS){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-robo'; b.textContent = s.name;
    b.addEventListener('click', () => guess(s.key)); host.appendChild(b);
  }
})();
newGame();

/* ---------- board 2: the tournament ---------- */
const t = { first: G, afterS: S, afterG: G, rounds: 200, noise: 0 };

function describeBuild(){
  const c = custom(t.first, t.afterS, t.afterG);
  const w = m => (m === S ? 'Share' : 'Grab');
  const known = KNOWN[c.code];
  $('#rg-b-name').innerHTML = `<b class="you">Yours</b>: starts with ${w(t.first)}; after they share, ${w(t.afterS)}; after they grab, ${w(t.afterG)}.` +
    (known ? ` That is a copy of <b>${known}</b>.` : '');
  return c;
}
function field(){
  const chosen = $$('#rg-field input:checked').map(i => i.dataset.k);
  const list = STRATS.filter(s => chosen.indexOf(s.key) >= 0);
  if (chosen.indexOf('yours') >= 0) list.push(describeBuild());
  return list;
}
function runTournament(fromButton){
  const list = field();
  if (list.length < 2){
    $('#rg-tstatus').innerHTML = 'Tick at least two strategies.';
    $('#rg-results').innerHTML = '';
    return;
  }
  const noise = t.noise / 100;
  const res = tournament(list, t.rounds, noise);
  const tft = byKey('tft');
  const rows = list.map((s, i) => {
    const h2h = playMatch(s, tft, t.rounds, noise);
    return { s, total: res.total[i], self: res.vs[i][i] / t.rounds, h2h };
  }).sort((a, b) => b.total - a.total);
  const max = rows[0].total || 1;
  let h = '<tr><th>#</th><th>Strategy</th><th>Total</th><th>Per round</th><th>vs itself, per round</th><th>vs Tit for Tat</th><th></th></tr>';
  rows.forEach((r, i) => {
    const perRound = r.total / (t.rounds * list.length);
    const isYou = r.s.key === 'yours';
    h += `<tr class="${isYou ? 'rg-you' : ''}"><td>${i + 1}</td><td>${isYou ? '<b class="you">Yours</b>' : r.s.name}</td>` +
      `<td>${fmtNum(Math.round(r.total))}</td><td>${perRound.toFixed(2)}</td>` +
      `<td>${r.self.toFixed(2)}</td>` +
      `<td>${r.h2h.a} : ${r.h2h.b}</td>` +
      `<td class="rg-bar"><div class="bar${isYou ? ' you' : ''}"><i style="width:${(100 * r.total / max).toFixed(1)}%"></i></div></td></tr>`;
  });
  $('#rg-results').innerHTML = h;
  const w = rows[0];
  const runnerUp = rows[1];
  const gap = Math.round(w.total - runnerUp.total);
  const winName = w.s.key === 'yours' ? '<b class="you">Yours</b>' : `<b>${w.s.name}</b>`;
  $('#rg-tstatus').innerHTML = `${winName} came first with ${fmtNum(Math.round(w.total))} cookies` +
    (gap === 0 ? `, tied with ${runnerUp.s.name}.` : `, ${fmtNum(gap)} ahead of ${runnerUp.s.key === 'yours' ? 'Yours' : runnerUp.s.name}.`) +
    ` ${list.length} strategies, ${t.rounds} rounds each, noise ${t.noise}%.` +
    (t.noise > 0 || list.some(s => s.random) ? ' <span class="note">Coin flips are involved, so the numbers move a little from run to run.</span>' : '');
  if (fromButton && t.noise >= 5 && list.length >= 5) earn('rg-noise');
}

const enterYours = () => { const box = $('#rg-field input[data-k="yours"]'); if (box) box.checked = true; };
seg($('#rg-b-first'), v => { t.first = v; describeBuild(); enterYours(); });
seg($('#rg-b-s'), v => { t.afterS = v; describeBuild(); enterYours(); });
seg($('#rg-b-g'), v => { t.afterG = v; describeBuild(); enterYours(); });
slider($('#rg-rounds'), v => `${v} rounds`, v => { t.rounds = v; });
slider($('#rg-noise'), v => `${v}%`, v => { t.noise = v; });
$('#rg-run').addEventListener('click', () => runTournament(true));
describeBuild();
runTournament(false);
})();

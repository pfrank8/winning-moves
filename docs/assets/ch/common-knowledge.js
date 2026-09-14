/* Chapter: Common knowledge (the muddy children, the knowledge ladder, guess two thirds of the average, the three hats). */
(function(){
'use strict';
const { $, $$, rand, earn, seg, clamp } = WM;

/* @pure-start
   Everything between the pure markers is DOM-free. The node test evaluates this block on its own. */

/* ---- Muddy children ----
   A perfect reasoner who sees m muddy faces steps forward on round m + 1, and never before: if she were clean,
   the m children she sees would have stepped forward on round m. With k muddy children, every muddy child sees
   k - 1 muddy faces and steps forward on round k; every clean child sees k and is still waiting. */
function seesCount(muddy, i){
  let m = 0;
  for (let j = 0; j < muddy.length; j++) if (j !== i && muddy[j]) m++;
  return m;
}
function facesWord(m){ return m === 0 ? 'no muddy faces' : m === 1 ? '1 muddy face' : `${m} muddy faces`; }
/* What a robot that sees m muddy faces thinks on round r (r = 0 is before the first question), and whether it steps forward. */
function thought(m, r){
  if (r === 0) return { text: `I see ${facesWord(m)}.`, step: false };
  if (m === 0) return { text: 'I see no muddy faces, and the teacher says somebody is muddy. That somebody is me. I step forward.', step: true };
  if (r < m) return { text: `I see ${facesWord(m)}. If I were clean, they would step forward on round ${m}. It is only round ${r}, so I wait.`, step: false };
  if (r === m) return { text: `I see ${facesWord(m)}. If I were clean, they would step forward right now. I watch.`, step: false };
  if (r === m + 1) return { text: `I see ${facesWord(m)}. If I were clean, they would have stepped forward last round. They did not. So I am muddy. I step forward.`, step: true };
  return { text: `I see ${facesWord(m)}. They stepped forward on round ${m}. I am clean.`, step: false };
}
/* A room full of perfect reasoners. Returns, round by round, the indices who step forward, stopping after the
   first round in which anyone does. */
function simulateRoom(muddy){
  const rounds = [];
  for (let r = 1; r <= muddy.length + 1; r++){
    const who = [];
    for (let i = 0; i < muddy.length; i++) if (thought(seesCount(muddy, i), r).step) who.push(i);
    rounds.push(who);
    if (who.length) break;
  }
  return rounds;
}

/* ---- Guess two thirds of the average ---- */
const LEVEL_PICK = L => Math.round(50 * Math.pow(2 / 3, L));       // level 1: 33, level 2: 22, level 3: 15, level 4: 10
function resolveGuess(picks){
  const sum = picks.reduce((a, b) => a + b, 0);
  const avg = sum / picks.length, target = avg * 2 / 3;
  const dist = picks.map(p => Math.abs(p - target));
  const best = Math.min.apply(null, dist);
  const winners = [];
  dist.forEach((d, i) => { if (Math.abs(d - best) < 1e-9) winners.push(i); });
  return { avg, target, dist, winners };
}
const ceilingAfter = steps => 100 * Math.pow(2 / 3, steps);

/* ---- The three hats (0 = red, 1 = blue) ---- */
function cleverGuess(a, b){ return a === b ? 1 - a : null; }       // see two of a kind: guess the other color; otherwise pass
function cleverGuesses(hats){
  return hats.map((h, i) => { const o = hats.filter((_, j) => j !== i); return cleverGuess(o[0], o[1]); });
}
function teamWins(hats, guesses){
  let any = false;
  for (let i = 0; i < hats.length; i++){
    if (guesses[i] === null) continue;
    if (guesses[i] !== hats[i]) return false;
    any = true;
  }
  return any;
}
function allHatPatterns(){
  const out = [];
  for (let x = 0; x < 8; x++) out.push([(x >> 2) & 1, (x >> 1) & 1, x & 1]);
  return out;
}
/* @pure-end */

/* ================= drawing ================= */
const MUD = '<path class="mud" d="M29 27c1-7 8-10 13-7 5-3 11 1 10 6 3 2 1 7-3 7-3 3-9 3-12 0-5 2-9-2-8-6z"/>';
/* o = { kind: 'robo' | 'you', mud: true | false | null (unknown), hat: 0 | 1 | 'q' | undefined } */
function faceSVG(o){
  const hat = o.hat !== undefined;
  const H = hat ? 104 : 80, dy = hat ? 24 : 0;
  let s = `<svg class="ck-face${hat ? ' tall' : ''}" viewBox="0 0 80 ${H}" aria-hidden="true"><g transform="translate(0 ${dy})">`;
  if (o.kind === 'robo'){
    if (!hat) s += '<line class="ant" x1="40" y1="4" x2="40" y2="16"/><circle class="bulb" cx="40" cy="5" r="4"/>';
    s += '<rect class="head" x="10" y="14" width="60" height="60" rx="12"/>';
    s += '<circle class="eye" cx="28" cy="48" r="7"/><circle class="eye" cx="52" cy="48" r="7"/><circle class="pupil" cx="29" cy="49" r="3"/><circle class="pupil" cx="53" cy="49" r="3"/>';
    s += '<path class="mouth" d="M29 63h22"/>';
  } else {
    s += '<circle class="skin" cx="40" cy="44" r="32"/>';
    s += '<circle class="eye" cx="28" cy="46" r="6"/><circle class="eye" cx="52" cy="46" r="6"/><circle class="pupil" cx="29" cy="47" r="3"/><circle class="pupil" cx="53" cy="47" r="3"/>';
    s += '<path class="mouth" d="M30 60q10 8 20 0"/>';
  }
  if (o.mud === true) s += MUD;
  else if (o.mud === null) s += '<text class="q" x="40" y="36">?</text>';
  s += '</g>';
  if (hat){
    if (o.hat === 'q') s += '<path class="hatq" d="M40 3L14 38h52z"/><text class="q ink" x="40" y="35">?</text>';
    else s += `<path class="hat${o.hat}" d="M40 3L14 38h52z"/><rect class="band" x="10" y="35" width="60" height="7" rx="3"/>`;
  }
  return s + '</svg>';
}
function kidCard(o){
  /* o = { cls, name, face, bubble, bubbleCls, did } */
  const d = document.createElement('div');
  d.className = 'ck-kid ' + o.cls;
  d.innerHTML = o.face + `<span class="name">${o.name}</span><span class="did">${o.did || ''}</span><div class="ck-bubble ${o.bubbleCls || ''}">${o.bubble}</div>`;
  return d;
}

/* ================= the muddy children ================= */
const YOU = 0;
const mg = { n: 5, mode: 'secret', k: 1, muddy: [], round: 0, over: false, fwd: [], youFwd: 0, log: [] };
const mStatus = html => { $('#ck-status').innerHTML = html; };
const roboName = i => 'Robo ' + i;

function kOptions(){
  const sel = $('#ck-k'); const cur = sel.value || 'secret';
  let h = '<option value="secret">Secret</option>';
  for (let i = 1; i <= mg.n; i++) h += `<option value="${i}">${i}</option>`;
  sel.innerHTML = h;
  sel.value = (cur === 'secret' || +cur <= mg.n) ? cur : String(mg.n);
}
function newMuddy(){
  mg.n = clamp(Math.round(+$('#ck-n').value) || 5, 3, 8); $('#ck-n').value = mg.n;
  kOptions(); mg.mode = $('#ck-k').value;
  mg.k = mg.mode === 'secret' ? 1 + rand(mg.n) : clamp(+mg.mode, 1, mg.n);
  const idx = []; for (let i = 0; i < mg.n; i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--){ const j = rand(i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  mg.muddy = new Array(mg.n).fill(false);
  for (let i = 0; i < mg.k; i++) mg.muddy[idx[i]] = true;
  mg.round = 0; mg.over = false; mg.fwd = new Array(mg.n).fill(0); mg.youFwd = 0; mg.log = [];
  mStatus('Look at the faces, then decide: stay put or step forward?');
  renderMuddy();
}
function renderMuddy(){
  const host = $('#ck-kids'); host.innerHTML = '';
  const m = seesCount(mg.muddy, YOU);
  const youMud = mg.over ? mg.muddy[YOU] : null;
  host.appendChild(kidCard({
    cls: 'you' + (mg.youFwd ? ' fwd' : ''), name: 'You', face: faceSVG({ kind: 'you', mud: youMud }),
    bubble: `You see ${facesWord(m)}.` + (mg.over ? ` You are <b>${mg.muddy[YOU] ? 'muddy' : 'clean'}</b>.` : ''),
    bubbleCls: 'you', did: mg.youFwd ? `stepped forward, round ${mg.youFwd}` : ''
  }));
  for (let i = 1; i < mg.n; i++){
    const sees = seesCount(mg.muddy, i);
    const t = thought(sees, mg.round);
    let text = t.text;
    if (mg.over && !mg.muddy[i] && mg.round === mg.k && sees === mg.k){
      const allStepped = !mg.muddy[YOU] || mg.youFwd === mg.k;
      text += allStepped ? ' They did. I am clean.' : ' All but one of them did. Somebody is not playing this straight.';
    }
    host.appendChild(kidCard({
      cls: 'robo' + (mg.fwd[i] ? ' fwd' : ''), name: roboName(i), face: faceSVG({ kind: 'robo', mud: mg.muddy[i] }),
      bubble: text, did: mg.fwd[i] ? `stepped forward, round ${mg.fwd[i]}` : ''
    }));
  }
  $('#ck-round').textContent = String(mg.round);
  $('#ck-kshow').textContent = (mg.mode === 'secret' && !mg.over) ? '?' : String(mg.k);
  $('#ck-sees').textContent = `${m} muddy`;
  $('#ck-teacher').innerHTML = mg.over
    ? `Teacher: "That is the end of round ${mg.round}."`
    : `Teacher: "At least one of you has a muddy forehead." <span class="ck-nowrap">Round ${mg.round + 1}:</span> "If you know you are muddy, step forward."`;
  $('#ck-stay').disabled = mg.over; $('#ck-step').disabled = mg.over; $('#ck-hint').disabled = mg.over;
  $('#ck-log').innerHTML = mg.log.slice(-5).join('<br>');
}
function verdict(step, r){
  const k = mg.k, m = seesCount(mg.muddy, YOU), youMuddy = mg.muddy[YOU];
  const secret = mg.mode === 'secret';
  const reveal = secret ? ` There were ${k} muddy ${k === 1 ? 'child' : 'children'}.` : '';
  let h;
  if (step && youMuddy && r === k){
    h = `<span class="win-c">Right, and on exactly the right round.</span> You saw ${facesWord(m)}, ${m ? `and they did not step forward on round ${m}` : 'and the teacher said somebody was muddy'}, so it had to be you.${reveal}`;
    if (k >= 3 && secret) earn('ck-muddy');
    else if (k >= 3) h += ' <span class="note">(For the star, set the muddy count to Secret.)</span>';
    else h += ' <span class="note">(The star needs at least 3 muddy children.)</span>';
  } else if (step && youMuddy){
    h = `<span class="you">Too early.</span> You are muddy, but on round ${r} you could not have known it. You saw ${facesWord(m)}, and the earliest you could be sure was round ${m + 1}, after watching whether they stepped forward on round ${m}. A lucky guess is not knowing.${reveal}`;
  } else if (step){
    h = `<span class="you">Wrong: you are clean.</span> You saw ${facesWord(m)}, which is all of the mud there is. ${r === m ? 'They stepped forward this very round, which told you that you were clean.' : `The way to find out was to wait: if they stepped forward on round ${m}, you were clean.`}${reveal}`;
  } else if (youMuddy){
    h = `<span class="you">You missed it.</span> You are muddy. ${m ? `The ${facesWord(m)} you saw did not step forward on round ${m}, and that could only mean one thing.` : 'You saw no mud at all, and the teacher said somebody was muddy. That somebody was you.'} Round ${k} was your moment.${reveal}`;
  } else {
    h = `<span class="win-c">Right: you are clean, and you never had to guess.</span> The ${facesWord(m)} you saw stepped forward on round ${m}, exactly as they would if you were clean.${reveal}`;
  }
  mStatus(h);
}
function act(step){
  if (mg.over) return;
  mg.round++;
  const r = mg.round, stepped = [];
  for (let i = 1; i < mg.n; i++){
    if (mg.fwd[i]) continue;
    if (thought(seesCount(mg.muddy, i), r).step){ mg.fwd[i] = r; stepped.push(roboName(i)); }
  }
  if (step) mg.youFwd = r;
  let line = `Round ${r}: ` + (stepped.length ? stepped.join(', ') + ' stepped forward.' : 'no robot moved.');
  if (step) line += ' You stepped forward.';
  mg.log.push(line);
  if (step || r >= mg.k){ mg.over = true; verdict(step, r); }
  else mStatus(`Round ${r}: nobody moved. The teacher asks again.`);
  renderMuddy();
}
$('#ck-stay').addEventListener('click', () => act(false));
$('#ck-step').addEventListener('click', () => act(true));
$('#ck-hint').addEventListener('click', () => {
  if (mg.over) return;
  const m = seesCount(mg.muddy, YOU);
  mStatus(m
    ? `Hint: you see ${facesWord(m)}. If you were clean, they would step forward on round ${m}. So wait through round ${m}. If they step forward, you are clean. If they do not, step forward on round ${m + 1}.`
    : 'Hint: you see no mud at all, and the teacher said somebody is muddy. Who else could it be?');
});
$('#ck-new').addEventListener('click', newMuddy);
$('#ck-n').addEventListener('change', newMuddy);
$('#ck-k').addEventListener('change', newMuddy);
newMuddy();

/* ================= the knowledge ladder ================= */
const lad = { k: 2, after: false };
const RUNG_TEXT = [
  'Everyone knows that somebody is muddy.',
  'Everyone knows that everyone knows it.',
  'Everyone knows that everyone knows that everyone knows it.',
  'And so on, forever.'
];
function rungs(k, after){
  if (after) return [
    { ok: true, why: 'The teacher said it out loud, to everyone, with everyone watching everyone else hear it.' },
    { ok: true, why: 'Robo 1 saw Robo 2 hear it, and Robo 2 saw Robo 1 hear it.' },
    { ok: true, why: k === 2 ? 'Robo 1 saw Robo 2 see Robo 1 hear it. Nothing about the announcement was private.' : 'Robo 1 saw Robo 2 see Robo 3 hear it. Nothing about the announcement was private.' },
    { ok: true, why: 'There is no rung where this stops. That is what common knowledge means.' }
  ];
  if (k === 2) return [
    { ok: true, why: 'Robo 1 can see the mud on Robo 2, and Robo 2 can see the mud on Robo 1. Each of them knows.' },
    { ok: false, why: 'Robo 1 thinks: "If my own forehead is clean, Robo 2 sees no mud at all and knows nothing." Robo 1 cannot rule that out, so Robo 1 cannot be sure that Robo 2 knows.' },
    { ok: false, why: 'The ladder already broke at rung 2.' },
    { ok: false, why: 'Broken.' }
  ];
  return [
    { ok: true, why: 'Each robot can see two muddy faces.' },
    { ok: true, why: 'Robo 1 thinks: "Even if my own forehead is clean, Robo 2 still sees the mud on Robo 3, so Robo 2 knows." The same works for every pair.' },
    { ok: false, why: 'Robo 1 thinks: "If I am clean, Robo 2 sees only the mud on Robo 3, and then Robo 2 would think: if I am clean too, Robo 3 sees no mud at all." So Robo 1 cannot be sure that Robo 2 is sure that Robo 3 knows.' },
    { ok: false, why: 'The ladder already broke at rung 3.' }
  ];
}
function renderLadder(){
  const kids = $('#ck-lkids'); kids.innerHTML = '';
  for (let i = 1; i <= lad.k; i++){
    kids.appendChild(kidCard({
      cls: 'robo', name: roboName(i), face: faceSVG({ kind: 'robo', mud: true }),
      bubble: lad.after ? `I see ${facesWord(lad.k - 1)}, and I heard the teacher, and I saw everyone else hear her.` : `I see ${facesWord(lad.k - 1)}. Nobody has said anything.`
    }));
  }
  const list = $('#ck-rungs'); list.innerHTML = '';
  rungs(lad.k, lad.after).forEach((r, i) => {
    const li = document.createElement('li');
    li.className = 'ck-rung ' + (r.ok ? 'ok' : 'no');
    li.innerHTML = `<span class="mark">${r.ok ? 'yes' : 'no'}</span><div><div class="s">Rung ${i + 1}. ${RUNG_TEXT[i]}</div><div class="why">${r.why}</div></div>`;
    list.appendChild(li);
  });
  $('#ck-lstatus').innerHTML = lad.after
    ? `<span class="win-c">Every rung holds.</span> Now the round-${lad.k} argument works, and both robots step forward on round ${lad.k}.`.replace('both robots', lad.k === 2 ? 'both robots' : 'all three robots')
    : `Before the announcement the ladder stops at rung ${lad.k - 1}. The round-${lad.k} argument needs rung ${lad.k}, so nobody ever moves.`;
}
seg($('#ck-lk'), v => { lad.k = +v; renderLadder(); });
seg($('#ck-lwhen'), v => { lad.after = v === 'after'; renderLadder(); });
renderLadder();

/* ================= guess two thirds of the average ================= */
const tg = { mode: 'mixed', rounds: 0 };
const MIXED_LEVELS = [0, 0, 1, 1, 1, 2, 2, 2, 3];   // tuned so the target lands near 20 and picks from 17 to 25 all have a real chance
const MODE_NOTE = {
  '0': 'Every Robo picks a random number from 0 to 100.',
  '1': 'Every Robo assumes the others are random (average 50) and picks 33.',
  '2': 'Every Robo assumes the others are level 1 (all 33) and picks 22.',
  '3': 'Every Robo assumes the others are level 2 (all 22) and picks 15.',
  'mixed': 'Nine Robos: two level 0, three level 1, three level 2, one level 3, each wobbling by up to 2 points.',
  'perfect': 'Every Robo reasons all the way up the ladder and picks 0.'
};
function roboPicks(mode){
  if (mode === 'perfect') return MIXED_LEVELS.map(() => ({ n: 0, who: 'perfect' }));
  if (mode === 'mixed'){
    const levels = MIXED_LEVELS.slice();
    for (let i = levels.length - 1; i > 0; i--){ const j = rand(i + 1); const t = levels[i]; levels[i] = levels[j]; levels[j] = t; }
    return levels.map(L => ({ n: L === 0 ? rand(101) : clamp(LEVEL_PICK(L) + rand(5) - 2, 0, 100), who: 'level ' + L }));
  }
  const L = +mode;
  return MIXED_LEVELS.map(() => ({ n: L === 0 ? rand(101) : LEVEL_PICK(L), who: 'level ' + L }));
}
function playGuess(){
  const you = clamp(Math.round(+$('#ck-guess').value) || 0, 0, 100); $('#ck-guess').value = you;
  const robos = roboPicks(tg.mode);
  const picks = [you].concat(robos.map(r => r.n));
  const res = resolveGuess(picks);
  const host = $('#ck-chips'); host.innerHTML = '';
  picks.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'ck-chip ' + (i === 0 ? 'you' : 'robo') + (res.winners.includes(i) ? ' winner' : '');
    d.innerHTML = `<span class="n">${p}</span><span class="who">${i === 0 ? 'you' : roboName(i) + ', ' + robos[i - 1].who}</span>`;
    host.appendChild(d);
  });
  $('#ck-avg').textContent = res.avg.toFixed(1);
  $('#ck-target').textContent = res.target.toFixed(1);
  const youWin = res.winners.includes(0), sole = youWin && res.winners.length === 1;
  $('#ck-winner').textContent = sole ? 'You' : youWin ? 'You (tie)' : res.winners.length === 1 ? roboName(res.winners[0]) : `${res.winners.length}-way tie`;
  let h;
  if (sole) h = `<span class="win-c">You win!</span> Two thirds of the average was ${res.target.toFixed(1)}, and ${you} was closest.`;
  else if (youWin) h = `<span class="win-c">You tied for closest</span> at ${res.dist[0].toFixed(1)} away. A shared prize.`;
  else {
    const w = res.winners[0];
    h = `<span class="robo">${res.winners.length === 1 ? roboName(w) : 'Several Robos'} win${res.winners.length === 1 ? 's' : ''}</span> with ${picks[w]}, only ${res.dist[w].toFixed(1)} from the target. You were ${res.dist[0].toFixed(1)} away.`;
  }
  if (tg.mode === 'perfect' && !youWin) h += ' Against nine zeros, your number is the only thing pulling the average up, and two thirds of it is still below you.';
  if (tg.mode === 'mixed' && sole) earn('ck-average');
  $('#ck-gstatus').innerHTML = h;
  tg.rounds++;
  $('#ck-glog').innerHTML = `Round ${tg.rounds}: you ${you}, Robos ${robos.map(r => r.n).join(', ')}. Average ${res.avg.toFixed(1)}, target ${res.target.toFixed(1)}.`;
}
$('#ck-play').addEventListener('click', playGuess);
$('#ck-guess').addEventListener('keydown', e => { if (e.key === 'Enter') playGuess(); });
seg($('#ck-mode'), v => { tg.mode = v; $('#ck-modenote').textContent = MODE_NOTE[v]; });
$('#ck-modenote').textContent = MODE_NOTE[tg.mode];
$('#ck-gstatus').textContent = 'Type a number from 0 to 100 and play the round.';

/* ---- cross it out ---- */
const co = { step: 0 };
const MAX_STEPS = 10;
function renderCross(){
  const c = ceilingAfter(co.step), prev = ceilingAfter(Math.max(0, co.step - 1));
  $('#ck-dead').style.width = (100 - c) + '%';
  $('#ck-cap').textContent = co.step === 0 ? 'every number from 0 to 100 is still in' : `still in: 0 to ${c.toFixed(1)}`;
  let h;
  if (co.step === 0) h = 'Nothing crossed out yet.';
  else if (co.step === 1) h = `<b>Step 1.</b> Even if everyone picks 100, the average is 100 and two thirds of it is 66.7. No number above 66.7 can ever beat 66.7, so cross out 66.7 to 100.`;
  else if (co.step < MAX_STEPS) h = `<b>Step ${co.step}.</b> Everyone can see step ${co.step - 1}, so nobody picks above ${prev.toFixed(1)}. The average is at most ${prev.toFixed(1)}, and two thirds of it is at most ${c.toFixed(1)}. Cross out ${c.toFixed(1)} to ${prev.toFixed(1)}.`;
  else h = `<b>Step ${co.step}.</b> The ceiling is ${c.toFixed(1)}, and it keeps going: after 20 steps it is ${ceilingAfter(20).toFixed(3)}, after 50 steps it is under 0.000002. Every step cuts it to two thirds of what it was, and it never reaches 0. So which number is under every ceiling?`;
  $('#ck-steps').innerHTML = h;
  $('#ck-cross').disabled = co.step >= MAX_STEPS;
}
$('#ck-cross').addEventListener('click', () => { if (co.step < MAX_STEPS){ co.step++; renderCross(); } });
$('#ck-cross-reset').addEventListener('click', () => { co.step = 0; renderCross(); });
renderCross();
function checkZero(){
  const raw = $('#ck-zero').value.trim();
  const st = $('#ck-zstatus');
  if (raw === ''){ st.textContent = 'Type a number first.'; return; }
  const v = Number(raw);
  if (v === 0){
    st.innerHTML = '<span class="win-c">Yes: 0.</span> It is the only number under every ceiling, and if everyone picks 0, the average is 0, two thirds of it is 0, and everyone ties. Nobody can do better by switching alone.';
    earn('ck-zero');
  } else if (v === 1) st.innerHTML = 'Close, but the ceiling gets below 1 too: after 12 steps it is 0.8. Keep going.';
  else if (v > 0 && v <= 100) st.innerHTML = `Not yet. ${v} gets crossed out at step ${Math.ceil(Math.log(v / 100) / Math.log(2 / 3))}. Which number never does?`;
  else st.textContent = 'The numbers in this game run from 0 to 100.';
}
$('#ck-zero-check').addEventListener('click', checkZero);
$('#ck-zero').addEventListener('keydown', e => { if (e.key === 'Enter') checkZero(); });

/* ================= the three hats ================= */
const COLOR = ['red', 'blue'];
const colorHTML = c => `<span class="ck-${COLOR[c]}">${COLOR[c]}</span>`;
const hg = { hats: [0, 0, 0], done: false, tally: { one: [0, 0], clever: [0, 0] } };   // tally: [games, wins]
const hStatus = html => { $('#ck-hstatus').innerHTML = html; };
function hatSays(g){ return g === null ? 'passes' : 'guesses ' + colorHTML(g); }
function renderHats(guesses, win){
  const host = $('#ck-hatrow'); host.innerHTML = '';
  const advice = cleverGuess(hg.hats[1], hg.hats[2]);
  const cards = [
    { cls: 'you', name: 'You', hat: hg.done ? hg.hats[0] : 'q', says: hg.done ? `You ${hatSays(guesses[0])}. The plan said: ${advice === null ? 'pass' : 'guess ' + colorHTML(advice)}.` : `You see ${colorHTML(hg.hats[1])} and ${colorHTML(hg.hats[2])}.` },
    { cls: 'robo', name: 'Robo 1', hat: hg.hats[1], says: hg.done ? `Sees ${colorHTML(hg.hats[0])} and ${colorHTML(hg.hats[2])}, so it ${hatSays(guesses[1])}.` : 'Sees your hat and Robo 2\'s hat.' },
    { cls: 'robo', name: 'Robo 2', hat: hg.hats[2], says: hg.done ? `Sees ${colorHTML(hg.hats[0])} and ${colorHTML(hg.hats[1])}, so it ${hatSays(guesses[2])}.` : 'Sees your hat and Robo 1\'s hat.' }
  ];
  cards.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'ck-hat ' + c.cls;
    d.innerHTML = faceSVG({ kind: i === 0 ? 'you' : 'robo', mud: false, hat: c.hat }) + `<span class="name">${c.name}</span><div class="says">${c.says}</div>`;
    host.appendChild(d);
  });
  $$('#ck-say-red, #ck-say-blue, #ck-say-pass').forEach(b => { b.disabled = hg.done; });
}
function dealHats(){
  hg.hats = [rand(2), rand(2), rand(2)]; hg.done = false;
  renderHats();
  hStatus('Your hat is hidden. Guess red, guess blue, or pass. The Robos decide at the same moment.');
}
function youSay(g){
  if (hg.done) return;
  hg.done = true;
  const guesses = cleverGuesses(hg.hats); guesses[0] = g;
  const win = teamWins(hg.hats, guesses);
  renderHats(guesses, win);
  const yours = g === null ? 'You passed.' : g === hg.hats[0] ? `You guessed ${colorHTML(g)}, and your hat is ${colorHTML(hg.hats[0])}: right.` : `You guessed ${colorHTML(g)}, but your hat is ${colorHTML(hg.hats[0])}: wrong.`;
  const guessed = guesses.filter(x => x !== null).length;
  hStatus(`${yours} ${win ? '<span class="win-c">The team wins.</span>' : '<span class="you">The team loses.</span>'} ${guessed === 0 ? 'Nobody guessed, and a team that only passes cannot win.' : ''}`);
}
$('#ck-say-red').addEventListener('click', () => youSay(0));
$('#ck-say-blue').addEventListener('click', () => youSay(1));
$('#ck-say-pass').addEventListener('click', () => youSay(null));
$('#ck-deal').addEventListener('click', dealHats);
dealHats();

function runGames(plan, games){
  let wins = 0;
  for (let t = 0; t < games; t++){
    const hats = [rand(2), rand(2), rand(2)];
    const g = plan === 'one' ? [rand(2), null, null] : cleverGuesses(hats);
    if (teamWins(hats, g)) wins++;
  }
  hg.tally[plan][0] += games; hg.tally[plan][1] += wins;
  renderTally();
}
function renderTally(){
  for (const plan of ['one', 'clever']){
    const [games, wins] = hg.tally[plan];
    $(`#ck-t-${plan}`).textContent = games ? `${wins} of ${games} (${(100 * wins / games).toFixed(1)}%)` : '0 of 0';
    $(`#ck-b-${plan}`).style.width = (games ? 100 * wins / games : 0) + '%';
  }
}
$('#ck-run-one').addEventListener('click', () => runGames('one', 1000));
$('#ck-run-clever').addEventListener('click', () => runGames('clever', 1000));
$('#ck-run-reset').addEventListener('click', () => { hg.tally = { one: [0, 0], clever: [0, 0] }; renderTally(); });
runGames('one', 1000); runGames('clever', 1000);

(function hatTable(){
  const sq = c => `<span class="h${c}" title="${COLOR[c]}"></span>`;
  let h = '<tr><th>Hats (Robo 1, 2, 3)</th><th>Robo 1</th><th>Robo 2</th><th>Robo 3</th><th>Clever plan</th></tr>';
  let wins = 0;
  for (const hats of allHatPatterns()){
    const g = cleverGuesses(hats), win = teamWins(hats, g);
    if (win) wins++;
    h += `<tr class="${win ? 'win' : 'lose'}"><td class="hats">${hats.map(sq).join('')}</td>` + g.map(x => `<td>${x === null ? 'pass' : colorHTML(x)}</td>`).join('') + `<td>${win ? '<span class="win-c">win</span>' : '<span class="you">lose</span>'}</td></tr>`;
  }
  h += `<tr><td colspan="4">Wins</td><td><b>${wins} of 8</b></td></tr>`;
  $('#ck-hattable').innerHTML = h;
})();
})();

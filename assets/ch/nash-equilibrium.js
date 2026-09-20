/* Chapter 3: Nobody wants to switch. Equilibrium puzzles, best-response arrows, dynamics, and a designer. */
(function(){
'use strict';
const { $, $$, rand, wait, earn, grid, payCell, fmtN, fmtS, isNash, bestResponsesRow, bestResponsesCol, turn, cue } = WM;

/* ================= puzzles ================= */
const PUZZLES = [
  { id: 'p1', title: 'The Cookie Game', story: 'Share or Grab, same numbers as Chapter 2.', rows: ['Share', 'Grab'], cols: ['Share', 'Grab'], pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]], signed: false },
  { id: 'p2', title: 'The Hallway Game', story: 'You and Robo walk toward each other in a hallway. Same side: you pass (1 each). Different sides: you bump (0 each).', rows: ['Left', 'Right'], cols: ['Left', 'Right'], pay: [[[1, 1], [0, 0]], [[0, 0], [1, 1]]], signed: false },
  { id: 'p3', title: 'Matching Pennies', story: 'You each show a coin. If they match, Robo takes a point from you. If they differ, you take one from Robo.', rows: ['Heads', 'Tails'], cols: ['Heads', 'Tails'], pay: [[[-1, 1], [1, -1]], [[1, -1], [-1, 1]]], signed: true },
  { id: 'p4', title: 'The Sledding Hill', story: 'Two sleds racing straight at each other. Swerve and you look timid (0). Hold straight while the other swerves and you look brave (3). Both hold straight: crash (−5 each).', rows: ['Swerve', 'Straight'], cols: ['Swerve', 'Straight'], pay: [[[1, 1], [0, 3]], [[3, 0], [-5, -5]]], signed: true },
  { id: 'p5', title: 'The Stag Hunt', story: 'Hunting a stag takes both of you and feeds you well (4 each). Hunting rabbits alone is safe (2). If you go for the stag and Robo goes for rabbits, you get nothing.', rows: ['Stag', 'Rabbit'], cols: ['Stag', 'Rabbit'], pay: [[[4, 4], [0, 2]], [[2, 0], [2, 2]]], signed: false },
];
const state = {};
function total(pz){ let n = 0; for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) if (isNash(pz.pay, r, c)) n++; return n; }
function checkAll(){ if (PUZZLES.every(pz => state[pz.id].solved)) earn('ne-hunt'); }
function extra(pz){
  if (pz.id === 'p2') return 'Two equilibria, and it does not matter which. This is a <b>coordination game</b>: agreeing is all that counts.';
  if (pz.id === 'p4') return 'Two equilibria, and they are <b>unfair</b>: in each one, somebody swerves and somebody looks brave. Neither player wants to switch, and neither is happy. This game is usually called Chicken.';
  if (pz.id === 'p5') return 'Two equilibria, and one is <b>better for both</b> (Stag, Stag). Yet Rabbit-Rabbit is also settled, because hunting a stag only pays if you trust the other player to show up. Trust is a real ingredient of games.';
  return '';
}
/* One game on screen at a time (five stacked grids ran to two screens). The tabs and Next game move between
   them; every game keeps what the reader already found. The strip gives the verdict, #ne-why gives the reasons. */
for (const pz of PUZZLES) state[pz.id] = { found: new Set(), tested: new Set(), solved: false, total: total(pz), why: '' };
const hunt = { i: 0 };
const WHY_HELP = 'The reasons show up here: what you would get by switching rows, and what Robo would get by switching columns.';
const solvedCount = () => PUZZLES.filter(pz => state[pz.id].solved).length;
const nextHint = () => (solvedCount() === PUZZLES.length ? 'All five games solved.' : 'Press Next game.');
function huntStats(){
  const st = state[PUZZLES[hunt.i].id];
  $('#ne-found').textContent = `${st.found.size} of ${st.solved ? st.total : '?'}`;
  $('#ne-solved').textContent = `${solvedCount()} of ${PUZZLES.length}`;
  $$('#ne-tabs button').forEach((b, k) => { b.classList.toggle('on', k === hunt.i); b.classList.toggle('done', state[PUZZLES[k].id].solved); });
}
function huntShow(i){
  hunt.i = i; const pz = PUZZLES[i], st = state[pz.id];
  $('#ne-title').textContent = pz.title; $('#ne-story').textContent = pz.story;
  $('#ne-hunt').innerHTML = grid(pz, { clickable: true });
  $$('#ne-hunt td').forEach(td => {
    td.tabIndex = 0; td.setAttribute('role', 'button');
    td.setAttribute('aria-label', `Test the box ${pz.rows[+td.dataset.r]}, ${pz.cols[+td.dataset.c]}`);
    const k = td.dataset.r + ',' + td.dataset.c;
    if (st.found.has(k)) td.classList.add('ne'); else if (st.tested.has(k)) td.classList.add('no'); // every box already tested keeps its verdict
    const go = () => test(pz, +td.dataset.r, +td.dataset.c, td);
    td.addEventListener('click', go);
    td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } });
  });
  $('#ne-why').innerHTML = st.why || WHY_HELP;
  huntStats();
  if (st.solved) turn('#ne-hunt', 'win', `${pz.title} is already solved. ${nextHint()}`, 'Solved');
  else turn('#ne-hunt', 'you', 'Click a box in the grid to test it: would anybody want to switch?', `Game ${i + 1} of ${PUZZLES.length}`);
}
$$('#ne-tabs button').forEach(b => b.addEventListener('click', () => huntShow(+b.dataset.v)));
$('#ne-next').addEventListener('click', () => {
  let k = hunt.i;
  for (let n = 1; n <= PUZZLES.length; n++){ const j = (hunt.i + n) % PUZZLES.length; if (!state[PUZZLES[j].id].solved){ k = j; break; } }
  huntShow(k === hunt.i ? (hunt.i + 1) % PUZZLES.length : k);
});
$('#ne-none').addEventListener('click', () => {
  const pz = PUZZLES[hunt.i], st = state[pz.id];
  if (st.total === 0){
    st.solved = true; checkAll();
    st.why = 'Every box has somebody who wants to switch, so among these four boxes there is no equilibrium. Chapter 4 finds the one hiding outside the grid.';
    $('#ne-why').innerHTML = st.why; huntStats();
    turn('#ne-hunt', 'win', `Correct. Every box has somebody who wants to switch: no equilibrium among these four boxes. ${nextHint()}`, 'Solved');
  } else turn('#ne-hunt', 'you', `Not so fast. This game has ${st.total === 1 ? 'one' : 'two'}. Keep testing boxes.`, 'Not so fast');
});
function test(pz, r, c, td){
  const st = state[pz.id];
  const [u, v] = pz.pay[r][c]; const r2 = 1 - r, c2 = 1 - c;
  const u2 = pz.pay[r2][c][0], v2 = pz.pay[r][c2][1];
  const f = pz.signed ? fmtS : fmtN;
  const youStay = u >= u2, roboStay = v >= v2;
  const box = `<b>${pz.rows[r]} / ${pz.cols[c]}</b>`;
  let s = `<b class="you">You</b> get ${f(u)} here. Switching to ${pz.rows[r2]} would give you ${f(u2)}. ${youStay ? 'You stay.' : '<b>You would switch.</b>'}<br>`;
  s += `<b class="robo">Robo</b> gets ${f(v)}. Switching to ${pz.cols[c2]} would give Robo ${f(v2)}. ${roboStay ? 'Robo stays.' : '<b>Robo would switch.</b>'}`;
  st.tested.add(r + ',' + c);
  if (youStay && roboStay){
    td.classList.add('ne'); st.found.add(r + ',' + c);
    if (st.found.size === st.total && !st.solved){
      st.solved = true; const e = extra(pz); if (e) s += '<br>' + e; checkAll();
      turn(td, 'win', `${box}: nobody wants to switch, so it is a Nash equilibrium. ${st.total === 1 ? 'It is the only one in this game.' : 'That is both of them.'} ${nextHint()}`, 'Solved');
    }
    else if (st.solved) turn(td, 'win', `${box}: nobody wants to switch. You already solved this game. ${nextHint()}`, 'Solved');
    else turn(td, 'win', `${box}: nobody wants to switch, so it is a Nash equilibrium. There is another one. Keep testing boxes.`, 'Found one');
  } else {
    td.classList.add('no');
    const who = !youStay && !roboStay ? 'you and Robo would both switch' : !youStay ? `you would switch to ${pz.rows[r2]}` : `Robo would switch to ${pz.cols[c2]}`;
    const allFail = st.total === 0 && st.tested.size === 4;
    turn(td, 'you', `${box}: ${who}. Not an equilibrium. ${allFail ? 'That is all four boxes, and somebody wanted to switch in every one. Press There is no equilibrium!' : 'Click another box.'}`, 'Not settled');
  }
  st.why = s; $('#ne-why').innerHTML = s;
  huntStats();
}
huntShow(0);
cue($$('#ne-hunt td'));

/* ================= arrows ================= */
const LIB = PUZZLES.map(pz => ({ name: pz.title, rows: pz.rows, cols: pz.cols, pay: pz.pay, signed: pz.signed }));
LIB.push({ name: 'Which movie (exercise 1)', rows: ['Up', 'Down'], cols: ['Left', 'Right'], pay: [[[2, 1], [0, 0]], [[0, 0], [1, 2]]], signed: false });
const ar = { g: LIB[0], streak: 0, awaiting: false, token: null, id: 0 };
const sel = $('#ne-pick');
LIB.forEach((g, i) => { const o = document.createElement('option'); o.value = i; o.textContent = g.name; sel.appendChild(o); });
{ const o = document.createElement('option'); o.value = 'random'; o.textContent = 'A random game'; sel.appendChild(o); } // so the box is never blank
const DROP_HELP = 'Click any box to drop a token there, and watch you and Robo follow the arrows.';
function arrowsRender(showArrows){
  const g = ar.g;
  /* the boxes are where the token goes, so the boxes are the buttons (not while a prediction is pending: the arrows are hidden) */
  $('#ne-arrows').innerHTML = grid(g, { clickable: !ar.awaiting, render: (cell, r, c) => {
    let h = payCell(cell[0], cell[1], g.signed);
    if (showArrows){
      const br = bestResponsesRow(g.pay, c), bc = bestResponsesCol(g.pay, r);
      if (!br.includes(r)) h += `<span class="ay">${br[0] < r ? '↑' : '↓'}</span>`;
      if (!bc.includes(c)) h += `<span class="ar">${bc[0] < c ? '←' : '→'}</span>`;
    }
    return h;
  } });
  if (showArrows){
    $$('#ne-arrows td').forEach(td => td.classList.toggle('ne', isNash(g.pay, +td.dataset.r, +td.dataset.c)));
  }
  if (ar.token) $$('#ne-arrows td').forEach(td => td.classList.toggle('token', +td.dataset.r === ar.token[0] && +td.dataset.c === ar.token[1]));
  $$('#ne-arrows td.click').forEach(td => { td.tabIndex = 0; td.setAttribute('role', 'button'); td.setAttribute('aria-label', `Drop the token on ${g.rows[+td.dataset.r]}, ${g.cols[+td.dataset.c]}`); });
}
function countNE(g){ let n = 0; for (let r = 0; r < g.rows.length; r++) for (let c = 0; c < g.cols.length; c++) if (isNash(g.pay, r, c)) n++; return n; }
function describe(g){
  const n = countNE(g);
  return n === 0 ? 'No box is left alone by the arrows: no equilibrium in the grid.' : n === 1 ? 'Exactly one box has no arrows leaving it.' : `${n} boxes have no arrows leaving them.`;
}
function setGuessing(on){ ar.awaiting = on; $$('[data-guess]').forEach(b => { b.disabled = !on; }); }
sel.addEventListener('change', () => {
  if (sel.value === 'random'){ $('#ne-random').click(); return; }
  ar.id++; ar.g = LIB[+sel.value]; ar.token = null; setGuessing(false); arrowsRender(true);
  turn(sel, 'math', `${ar.g.name}: ${describe(ar.g)} ${DROP_HELP}`);
});
$('#ne-random').addEventListener('click', () => {
  const pay = [[0, 0], [0, 0]].map(() => [0, 0].map(() => [rand(6), rand(6)]));
  ar.id++; ar.g = { name: 'Random', rows: ['Up', 'Down'], cols: ['Left', 'Right'], pay, signed: false };
  ar.token = null; sel.value = 'random'; setGuessing(true);
  arrowsRender(false);
  turn(sel, 'you', 'Arrows hidden. How many boxes will have no arrow leaving them? Press <b>None</b>, <b>One</b>, <b>Two</b> or <b>Three or more</b>.', 'Predict');
});
$$('[data-guess]').forEach(b => b.addEventListener('click', () => {
  if (!ar.awaiting) return;
  setGuessing(false);
  const n = countNE(ar.g); const guess = +b.dataset.guess;
  const ok = (guess === 3 && n >= 3) || guess === n;
  ar.streak = ok ? ar.streak + 1 : 0; $('#ne-streak').textContent = `${Math.min(ar.streak, 5)} of 5`;
  arrowsRender(true);
  const tail = ar.streak >= 5 ? 'Five in a row.' : 'Press Random game for the next one, or click a box to drop a token.';
  if (ok) turn(sel, 'win', `${describe(ar.g)} That is ${ar.streak} right in a row. ${tail}`, 'Right');
  else turn(sel, 'you', `It has ${n}. ${describe(ar.g)} Your streak goes back to 0. ${tail}`, 'Not this time');
  if (ar.streak >= 5) earn('ne-predict');
}));
/* Drop the token on the clicked box, then you and Robo take turns moving to a best response. A new drop, a new
   game or a prediction bumps ar.id, and the old run bails out after its next wait. */
async function play(r, c){
  if (ar.awaiting) return;
  const id = ++ar.id, g = ar.g; let mover = 'you'; const path = [];
  const again = 'Click another box to drop the token there.';
  ar.token = [r, c]; arrowsRender(true);
  if (isNash(g.pay, r, c)){ turn(sel, 'win', `No arrow leaves ${g.rows[r]} / ${g.cols[c]}, so nobody moves. It is an equilibrium. ${again}`, 'Settled'); return; }
  turn(sel, 'math', `Token dropped on ${g.rows[r]} / ${g.cols[c]}. You move first.`, 'Token');
  for (let step = 0; step < 12; step++){
    await wait(650); if (id !== ar.id) return;
    let moved = false;
    if (mover === 'you'){ const br = bestResponsesRow(g.pay, c); if (!br.includes(r)){ r = br[0]; moved = true; } }
    else { const bc = bestResponsesCol(g.pay, r); if (!bc.includes(c)){ c = bc[0]; moved = true; } }
    ar.token = [r, c]; arrowsRender(true); path.push(`${g.rows[r]}/${g.cols[c]}`);
    if (isNash(g.pay, r, c)){ turn(sel, 'win', `Settled at ${g.rows[r]} / ${g.cols[c]} after ${step + 1} move${step ? 's' : ''}. Nobody wants to move again. ${again}`, 'Settled'); return; }
    if (mover === 'you') turn(sel, 'you', moved ? `You follow the red arrow to ${g.rows[r]}. Robo is next.` : 'You are already at your best response, so you stay. Robo is next.', `Move ${step + 1}`);
    else turn(sel, 'robo', moved ? `Robo follows the blue arrow to ${g.cols[c]}. You are next.` : 'Robo is already at its best response, so it stays. You are next.', `Move ${step + 1}`);
    mover = mover === 'you' ? 'robo' : 'you';
  }
  turn(sel, 'math', `The token chased itself around: ${path.slice(-4).join(' → ')} ... and would keep going forever. A game like this needs Chapter 4. ${again}`, 'Never settles');
}
const dropOn = e => { const td = e.target.closest('td.click'); if (td) play(+td.dataset.r, +td.dataset.c); };
$('#ne-arrows').addEventListener('click', dropOn);
$('#ne-arrows').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('td.click')){ e.preventDefault(); dropOn(e); } });
arrowsRender(true);

/* ================= designer ================= */
const D = { rows: ['Up', 'Down'], cols: ['Left', 'Right'], pay: [[[1, 1], [1, 1]], [[1, 1], [2, 0]]] };
function designRender(){
  let h = '<tr><th class="corner">you ↓ &nbsp; robo →</th>' + D.cols.map(c => `<th class="ch">${c}</th>`).join('') + '</tr>';
  D.rows.forEach((r, i) => {
    h += `<tr><th class="rh">${r}</th>`;
    D.cols.forEach((c, j) => {
      h += `<td class="${isNash(D.pay, i, j) ? 'ne' : ''}"><span class="pair"><input type="number" class="you" data-r="${i}" data-c="${j}" data-k="0" value="${D.pay[i][j][0]}" min="-9" max="9"><span class="sep">·</span><input type="number" class="robo" data-r="${i}" data-c="${j}" data-k="1" value="${D.pay[i][j][1]}" min="-9" max="9"></span></td>`;
    });
    h += '</tr>';
  });
  $('#ne-design').innerHTML = h;
  $$('#ne-design input').forEach(inp => inp.addEventListener('input', () => {
    const v = Math.max(-9, Math.min(9, +inp.value || 0)); D.pay[+inp.dataset.r][+inp.dataset.c][+inp.dataset.k] = v;
    $$('#ne-design td').forEach((td, idx) => { const i = Math.floor(idx / 2), j = idx % 2; td.classList.toggle('ne', isNash(D.pay, i, j)); });
    designCount();
  }));
  designCount();
}
function designCount(){
  const n = countNE(D); $('#ne-count').textContent = n;
  if (n === 3){ turn('#ne-design', 'win', 'Exactly three. Look at the box that is not green and at the ties that make the other three stick.', 'Solved'); earn('ne-three'); }
  else if (n === 4) turn('#ne-design', 'math', 'Every box is settled. That needs ties everywhere. Change one number so that exactly one box lets go.', 'Four');
  else if (n === 0) turn('#ne-design', 'math', 'None: like Matching Pennies, the arrows chase each other in a loop. Type a new payoff and aim for exactly three.', 'Zero');
  else turn('#ne-design', 'math', 'Type a new payoff into any box. Green boxes are equilibria: aim for exactly three.', `${n === 1 ? 'One' : 'Two'} so far`);
}
designRender();
})();

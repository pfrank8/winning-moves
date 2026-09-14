/* Chapter 3: Nobody wants to switch. Equilibrium puzzles, best-response arrows, dynamics, and a designer. */
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, grid, payCell, fmtN, fmtS, isNash, bestResponsesRow, bestResponsesCol } = WM;

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
for (const pz of PUZZLES){
  state[pz.id] = { found: new Set(), solved: false, total: total(pz) };
  const d = document.createElement('div'); d.className = 'puzzle'; d.id = 'ne-' + pz.id;
  d.innerHTML = `<h4>${pz.title}</h4><p class="note" style="margin:4px 0 10px">${pz.story}</p>
    <div class="two"><div class="scroll"><table class="pay">${grid(pz, { clickable: true })}</table></div>
    <div><div class="progress" id="ne-prog-${pz.id}">Equilibria found: 0 of ?</div><div class="msg" id="ne-msg-${pz.id}">Click a box to test it.</div>
    <button class="btn btn-sm" type="button" data-none="${pz.id}">There is no equilibrium!</button></div></div>`;
  $('#ne-puzzles').appendChild(d);
  $$('td.click', d).forEach(td => td.addEventListener('click', () => test(pz, +td.dataset.r, +td.dataset.c, td)));
  $('[data-none]', d).addEventListener('click', () => {
    const st = state[pz.id];
    if (st.total === 0){
      st.solved = true; d.classList.add('done');
      $('#ne-msg-' + pz.id).innerHTML = '<b class="win-c">Correct.</b> Every box has somebody who wants to switch. Among these four boxes there is no equilibrium. Chapter 4 finds the one hiding outside the grid.';
      $('#ne-prog-' + pz.id).textContent = 'Equilibria found: 0 of 0'; checkAll();
    } else $('#ne-msg-' + pz.id).innerHTML = `Not so fast. This game has ${st.total === 1 ? 'one' : 'two'}. Keep testing.`;
  });
}
function test(pz, r, c, td){
  const st = state[pz.id];
  const [u, v] = pz.pay[r][c]; const r2 = 1 - r, c2 = 1 - c;
  const u2 = pz.pay[r2][c][0], v2 = pz.pay[r][c2][1];
  const f = pz.signed ? fmtS : fmtN;
  const youStay = u >= u2, roboStay = v >= v2;
  let s = `<b class="you">You</b> get ${f(u)} here. Switching to ${pz.rows[r2]} would give you ${f(u2)}. ${youStay ? 'You stay.' : '<b>You would switch.</b>'}<br>`;
  s += `<b class="robo">Robo</b> gets ${f(v)}. Switching to ${pz.cols[c2]} would give Robo ${f(v2)}. ${roboStay ? 'Robo stays.' : '<b>Robo would switch.</b>'}<br>`;
  $$('td', td.closest('table')).forEach(x => x.classList.remove('no'));
  if (youStay && roboStay){
    s += '<b class="win-c">Nobody wants to switch: Nash equilibrium.</b>'; td.classList.add('ne'); st.found.add(r + ',' + c);
    if (st.found.size === st.total && !st.solved){ st.solved = true; $('#ne-' + pz.id).classList.add('done'); const e = extra(pz); if (e) s += '<br>' + e; checkAll(); }
    else if (st.total === 2 && st.found.size === 1) s += '<br>There is another one.';
  } else { s += 'Not an equilibrium.'; td.classList.add('no'); }
  $('#ne-msg-' + pz.id).innerHTML = s;
  $('#ne-prog-' + pz.id).textContent = `Equilibria found: ${st.found.size} of ${st.solved ? st.total : '?'}`;
}

/* ================= arrows ================= */
const LIB = PUZZLES.map(pz => ({ name: pz.title, rows: pz.rows, cols: pz.cols, pay: pz.pay, signed: pz.signed }));
LIB.push({ name: 'Which movie (exercise 1)', rows: ['Up', 'Down'], cols: ['Left', 'Right'], pay: [[[2, 1], [0, 0]], [[0, 0], [1, 2]]], signed: false });
const ar = { g: LIB[0], streak: 0, awaiting: false, token: null, running: false };
const sel = $('#ne-pick');
LIB.forEach((g, i) => { const o = document.createElement('option'); o.value = i; o.textContent = g.name; sel.appendChild(o); });
function arrowsRender(showArrows){
  const g = ar.g;
  $('#ne-arrows').innerHTML = grid(g, { render: (cell, r, c) => {
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
}
function countNE(g){ let n = 0; for (let r = 0; r < g.rows.length; r++) for (let c = 0; c < g.cols.length; c++) if (isNash(g.pay, r, c)) n++; return n; }
function describe(g){
  const n = countNE(g);
  return n === 0 ? 'No box is left alone by the arrows: no equilibrium in the grid.' : n === 1 ? 'Exactly one box has no arrows leaving it.' : `${n} boxes have no arrows leaving them.`;
}
sel.addEventListener('change', () => { ar.g = LIB[+sel.value]; ar.awaiting = false; ar.token = null; $('#ne-guess').hidden = true; arrowsRender(true); $('#ne-arrows-msg').textContent = describe(ar.g); });
$('#ne-random').addEventListener('click', () => {
  const pay = [[0, 0], [0, 0]].map(() => [0, 0].map(() => [rand(6), rand(6)]));
  ar.g = { name: 'Random', rows: ['Up', 'Down'], cols: ['Left', 'Right'], pay, signed: false };
  ar.awaiting = true; ar.token = null; sel.value = '';
  arrowsRender(false); $('#ne-guess').hidden = false; $('#ne-arrows-msg').textContent = 'Arrows hidden. Make your prediction.';
});
$$('[data-guess]').forEach(b => b.addEventListener('click', () => {
  if (!ar.awaiting) return;
  ar.awaiting = false; $('#ne-guess').hidden = true;
  const n = countNE(ar.g); const guess = +b.dataset.guess;
  const ok = (guess === 3 && n >= 3) || guess === n;
  ar.streak = ok ? ar.streak + 1 : 0; $('#ne-streak').textContent = ar.streak;
  arrowsRender(true);
  $('#ne-arrows-msg').innerHTML = (ok ? '<b class="win-c">Right.</b> ' : `<b class="you">Not this time.</b> It has ${n}. `) + describe(ar.g);
  if (ar.streak >= 5) earn('ne-predict');
}));
$('#ne-play').addEventListener('click', async () => {
  if (ar.running || ar.awaiting) return;
  ar.running = true;
  const g = ar.g; let r = rand(g.rows.length), c = rand(g.cols.length); let mover = 'you'; const path = [];
  ar.token = [r, c]; arrowsRender(true);
  $('#ne-play-msg').textContent = `Token dropped on ${g.rows[r]} / ${g.cols[c]}. You move first.`;
  for (let step = 0; step < 12; step++){
    await wait(650);
    if (mover === 'you'){ const br = bestResponsesRow(g.pay, c); if (!br.includes(r)) r = br[0]; }
    else { const bc = bestResponsesCol(g.pay, r); if (!bc.includes(c)) c = bc[0]; }
    ar.token = [r, c]; arrowsRender(true); path.push(`${g.rows[r]}/${g.cols[c]}`);
    if (isNash(g.pay, r, c)){ $('#ne-play-msg').innerHTML = `<b class="win-c">Settled</b> at ${g.rows[r]} / ${g.cols[c]} after ${step + 1} move${step ? 's' : ''}. Nobody wants to move again.`; ar.running = false; return; }
    mover = mover === 'you' ? 'robo' : 'you';
  }
  $('#ne-play-msg').innerHTML = `<b>Never settles.</b> The token chased itself around: ${path.slice(-4).join(' → ')} ... and would keep going forever. A game like this needs Chapter 4.`;
  ar.running = false;
});
arrowsRender(true); $('#ne-arrows-msg').textContent = describe(ar.g);

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
  const msg = $('#ne-design-msg');
  if (n === 3){ msg.innerHTML = '<b class="win-c">Exactly three.</b> Look at the box that is not green and at the ties that make the other three stick.'; earn('ne-three'); }
  else if (n === 4) msg.textContent = 'Four: every box is settled. That needs ties everywhere.';
  else if (n === 0) msg.textContent = 'Zero: like Matching Pennies, the arrows chase each other in a loop.';
  else msg.textContent = `${n === 1 ? 'One' : 'Two'} so far. Aim for three.`;
}
designRender();
})();

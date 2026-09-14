/* Chapter 2: The Cookie Game. Dominant strategies, best-response marking, iterated elimination of dominated strategies. */
(function(){
'use strict';
const { $, $$, earn, grid, payCell, bestResponsesRow, bestResponsesCol } = WM;

/* ================= Cookie Game ================= */
const COOKIE = { rows: ['Share', 'Grab'], cols: ['Share', 'Grab'], pay: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]] };
$('#pg-cookie').innerHTML = grid(COOKIE);
const checked = { 0: false, 1: false };
function whatIf(col){
  const cells = $$('#pg-cookie td');
  cells.forEach(td => td.classList.remove('colhl', 'best'));
  cells.filter(td => +td.dataset.c === col).forEach(td => td.classList.add('colhl'));
  const share = COOKIE.pay[0][col][0], grab = COOKIE.pay[1][col][0];
  cells.find(td => +td.dataset.c === col && +td.dataset.r === (grab > share ? 1 : 0)).classList.add('best');
  $('#pg-msg').innerHTML = `If Robo <b>${COOKIE.cols[col].toLowerCase()}s</b>: Share gives you <b class="you">${share}</b>, Grab gives you <b class="you">${grab}</b>. <b>Grab is better.</b>`;
  checked[col] = true;
  if (checked[0] && checked[1]) $('#pg-dominant').hidden = false;
}
$('#pg-if-share').addEventListener('click', () => whatIf(0));
$('#pg-if-grab').addEventListener('click', () => whatIf(1));
$$('[data-cookie]').forEach(b => b.addEventListener('click', () => {
  const you = b.dataset.cookie === 'Grab' ? 1 : 0, robo = 1;
  const [u, v] = COOKIE.pay[you][robo];
  $$('#pg-cookie td').forEach(td => td.classList.toggle('hit', +td.dataset.r === you && +td.dataset.c === robo));
  const tail = you === 1 ? 'You both did the "smart" thing and you both got 1 cookie.' : 'Robo grabbed everything. Sharing only works when the other player shares too.';
  $('#pg-result').innerHTML = `You chose <span class="you">${COOKIE.rows[you]}</span>. Robo chose <span class="robo">Grab</span>. You get <span class="you">${u}</span>, Robo gets <span class="robo">${v}</span>. ${tail}`;
  earn('pg-play');
}));

/* ================= best-response marking ================= */
const MARKG = { rows: ['Top', 'Middle', 'Bottom'], cols: ['Left', 'Center', 'Right'],
  pay: [[[2, 3], [5, 0], [1, 2]], [[4, 1], [1, 4], [3, 2]], [[0, 5], [2, 1], [6, 0]]] };
const marks = {}; // "r,c" -> 0 none, 1 red, 2 blue, 3 both
function markRender(){
  $('#pg-mark').innerHTML = grid(MARKG, { clickable: true, render: (cell, r, c) => {
    const m = marks[`${r},${c}`] || 0;
    return payCell(cell[0], cell[1]) + (m & 1 ? '<span class="arrow-you">●</span>' : '') + (m & 2 ? '<span class="arrow-robo">●</span>' : '');
  } });
  $$('#pg-mark td').forEach(td => td.addEventListener('click', () => {
    const k = `${td.dataset.r},${td.dataset.c}`; marks[k] = ((marks[k] || 0) + 1) % 4; markRender();
  }));
}
$('#pg-mark-check').addEventListener('click', () => {
  const want = {};
  for (let c = 0; c < 3; c++) bestResponsesRow(MARKG.pay, c).forEach(r => { want[`${r},${c}`] = (want[`${r},${c}`] || 0) | 1; });
  for (let r = 0; r < 3; r++) bestResponsesCol(MARKG.pay, r).forEach(c => { want[`${r},${c}`] = (want[`${r},${c}`] || 0) | 2; });
  let wrong = 0;
  $$('#pg-mark td').forEach(td => {
    const k = `${td.dataset.r},${td.dataset.c}`;
    const ok = (marks[k] || 0) === (want[k] || 0);
    td.classList.toggle('no', !ok); td.classList.toggle('ne', ok && (want[k] || 0) > 0);
    if (!ok) wrong++;
  });
  if (wrong === 0){ $('#pg-mark-msg').innerHTML = '<span class="win-c">All six marks are right.</span> Three red (one per column), three blue (one per row), and no box has both.'; earn('pg-best'); }
  else $('#pg-mark-msg').innerHTML = `<span class="you">${wrong} box${wrong > 1 ? 'es are' : ' is'} wrong.</span> Red boxes need fixing. Remember: red compares down a column, blue compares across a row.`;
});
$('#pg-mark-clear').addEventListener('click', () => { for (const k in marks) delete marks[k]; markRender(); $('#pg-mark-msg').textContent = 'Six marks in total.'; });
markRender();

/* ================= iterated elimination ================= */
const CROSS = { rows: ['Top', 'Middle', 'Bottom'], cols: ['Left', 'Center', 'Right'],
  pay: [[[4, 1], [2, 3], [1, 0]], [[3, 2], [3, 3], [2, 2]], [[1, 5], [1, 1], [0, 4]]] };
const dead = { rows: new Set(), cols: new Set() };
function liveRows(){ return [0, 1, 2].filter(r => !dead.rows.has(r)); }
function liveCols(){ return [0, 1, 2].filter(c => !dead.cols.has(c)); }
function rowDominated(r){ // some other live row strictly better in every live column
  return liveRows().filter(o => o !== r).find(o => liveCols().every(c => CROSS.pay[o][c][0] > CROSS.pay[r][c][0]));
}
function colDominated(c){
  return liveCols().filter(o => o !== c).find(o => liveRows().every(r => CROSS.pay[r][o][1] > CROSS.pay[r][c][1]));
}
function crossRender(){
  let h = '<tr><th class="corner">you ↓ &nbsp; robo →</th>' + CROSS.cols.map((c, j) => `<th class="ch click ${dead.cols.has(j) ? 'dead' : ''}" data-col="${j}">${c}</th>`).join('') + '</tr>';
  CROSS.rows.forEach((r, i) => {
    h += `<tr><th class="rh click ${dead.rows.has(i) ? 'dead' : ''}" data-row="${i}">${r}</th>`;
    CROSS.cols.forEach((c, j) => { h += `<td class="${dead.rows.has(i) || dead.cols.has(j) ? 'dead' : ''}">${payCell(CROSS.pay[i][j][0], CROSS.pay[i][j][1])}</td>`; });
    h += '</tr>';
  });
  $('#pg-cross').innerHTML = h;
  $$('#pg-cross th[data-row]').forEach(th => th.addEventListener('click', () => tryRow(+th.dataset.row)));
  $$('#pg-cross th[data-col]').forEach(th => th.addEventListener('click', () => tryCol(+th.dataset.col)));
  if (liveRows().length === 1 && liveCols().length === 1){
    const r = liveRows()[0], c = liveCols()[0];
    $$('#pg-cross td:not(.dead)').forEach(td => td.classList.add('ne'));
    $('#pg-cross-msg').innerHTML = `<span class="win-c">Down to one box: ${CROSS.rows[r]} and ${CROSS.cols[c]}.</span> Two sensible players who both know the other is sensible end up here without ever talking. Notice it is also the box where nobody wants to switch.`;
    earn('pg-cross');
  }
}
function tryRow(r){
  if (dead.rows.has(r) || liveRows().length === 1) return;
  const by = rowDominated(r);
  if (by === undefined){ $('#pg-cross-msg').innerHTML = `<span class="you">${CROSS.rows[r]} is not dominated</span> (yet). There is no other standing row that beats it in every standing column.`; return; }
  dead.rows.add(r); $('#pg-cross-msg').innerHTML = `${CROSS.rows[r]} crossed out: ${CROSS.rows[by]} beats it in every standing column. Robo knows you will never play it now.`; crossRender();
}
function tryCol(c){
  if (dead.cols.has(c) || liveCols().length === 1) return;
  const by = colDominated(c);
  if (by === undefined){ $('#pg-cross-msg').innerHTML = `<span class="you">${CROSS.cols[c]} is not dominated</span> (yet). No other standing column is better for Robo in every standing row.`; return; }
  dead.cols.add(c); $('#pg-cross-msg').innerHTML = `${CROSS.cols[c]} crossed out: ${CROSS.cols[by]} is better for Robo in every standing row.`; crossRender();
}
$('#pg-cross-reset').addEventListener('click', () => { dead.rows.clear(); dead.cols.clear(); crossRender(); $('#pg-cross-msg').textContent = 'Find a row that is worse than another row in every column, or a column that is worse for Robo than another column in every row.'; });
crossRender();
})();

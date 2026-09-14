/* Chapter: How to pick a winner when nobody agrees (ballot builder, Condorcet cycle, strategic voting). */
(function(){
'use strict';
const { $, $$, earn, seg } = WM;

/* RULES-BEGIN
   Pure vote counting, no DOM. n = number of candidates. groups = [{size, rank}], where rank is an
   array of candidate indexes from first choice to last, and every ballot ranks every candidate. */
function firstPlaceCounts(n, groups, alive){
  const c = new Array(n).fill(0);
  for (const g of groups){
    if (g.size <= 0) continue;
    const top = alive ? g.rank.find(x => alive.includes(x)) : g.rank[0];
    if (top !== undefined) c[top] += g.size;
  }
  return c;
}
function leaders(scores, among){
  const idx = among || scores.map((_, i) => i);
  const top = Math.max.apply(null, idx.map(i => scores[i]));
  return idx.filter(i => scores[i] === top);
}
function plurality(n, groups){
  const first = firstPlaceCounts(n, groups);
  const tied = leaders(first);
  return { first, tied, winner: tied.length === 1 ? tied[0] : null };
}
function borda(n, groups){
  const pts = new Array(n).fill(0);
  for (const g of groups) if (g.size > 0) g.rank.forEach((c, pos) => { pts[c] += g.size * (n - 1 - pos); });
  const tied = leaders(pts);
  return { pts, tied, winner: tied.length === 1 ? tied[0] : null };
}
/* Instant runoff: majority = more than half of all ballots. Ties for last place are broken by the
   round-1 counts, then by list order (the later-listed candidate goes out). If every remaining
   candidate is tied for last, the election is a tie. */
function irv(n, groups){
  const total = groups.reduce((s, g) => s + Math.max(0, g.size), 0);
  const majority = Math.floor(total / 2) + 1;
  let alive = Array.from({ length: n }, (_, i) => i);
  const rounds = [];
  let winner = null, tie = false;
  while (alive.length){
    const counts = firstPlaceCounts(n, groups, alive);
    const round = { alive: alive.slice(), counts, out: null, note: '' };
    rounds.push(round);
    const top = leaders(counts, alive);
    if (total > 0 && counts[top[0]] >= majority){ winner = top[0]; round.note = 'majority'; break; }
    const low = Math.min.apply(null, alive.map(i => counts[i]));
    let losers = alive.filter(i => counts[i] === low);
    if (losers.length === alive.length){ tie = true; round.note = 'all tied'; break; }
    if (losers.length > 1 && rounds.length > 1){
      const r1 = rounds[0].counts;
      const lowR1 = Math.min.apply(null, losers.map(i => r1[i]));
      const narrowed = losers.filter(i => r1[i] === lowR1);
      if (narrowed.length < losers.length){ losers = narrowed; round.note = 'tie for last, broken by the round 1 count'; }
    }
    if (losers.length > 1) round.note = 'tie for last, broken by list order';
    round.out = losers[losers.length - 1];
    alive = alive.filter(i => i !== round.out);
  }
  return { rounds, winner, tie, total, majority };
}
/* table[x][y] = number of voters who rank x above y */
function pairwise(n, groups){
  const t = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const g of groups){
    if (g.size <= 0) continue;
    const pos = new Array(n); g.rank.forEach((c, i) => { pos[c] = i; });
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (x !== y && pos[x] < pos[y]) t[x][y] += g.size;
  }
  return t;
}
/* Shortest directed cycle in the "beats" relation, as a list of candidates; null if there is none. */
function findCycle(n, beats){
  function search(path, len){
    if (path.length === len) return beats(path[len - 1], path[0]) ? path.slice() : null;
    for (let c = 0; c < n; c++){
      if (path.includes(c)) continue;
      if (path.length && c < path[0]) continue;               // every cycle can start at its smallest index
      if (path.length && !beats(path[path.length - 1], c)) continue;
      path.push(c); const r = search(path, len); path.pop();
      if (r) return r;
    }
    return null;
  }
  for (let len = 3; len <= n; len++){ const found = search([], len); if (found) return found; }
  return null;
}
function condorcet(n, groups){
  const table = pairwise(n, groups);
  const beats = (x, y) => table[x][y] > table[y][x];
  let winner = null, loser = null;
  for (let x = 0; x < n; x++){
    const others = []; for (let y = 0; y < n; y++) if (y !== x) others.push(y);
    if (others.length && others.every(y => beats(x, y))) winner = x;
    if (others.length && others.every(y => beats(y, x))) loser = x;
  }
  return { table, winner, loser, cycle: findCycle(n, beats), beats };
}
function countAll(n, groups){
  return { plurality: plurality(n, groups), irv: irv(n, groups), borda: borda(n, groups), condorcet: condorcet(n, groups) };
}
/* RULES-END */

/* ================= shared rendering ================= */
const PETS = ['Hamster', 'Turtle', 'Fish', 'Gecko'];
const LET = ['A', 'B', 'C', 'D'];
const ORD = ['1st', '2nd', '3rd', '4th'];
const MAXG = 5, MING = 3;
const name = i => PETS[i];
const chip = i => `<span class="vo-chip"><b>${LET[i]}</b>${PETS[i]}</span>`;
const list = arr => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
const total = groups => groups.reduce((s, g) => s + Math.max(0, g.size), 0);
const clone = groups => groups.map(g => ({ size: g.size, rank: g.rank.slice() }));
const fromPreset = p => p.map(([size, rank]) => ({ size, rank: rank.slice() }));

/* groups host: opts = {sizes, arrows, remove, names, mark} */
function groupsHTML(groups, n, opts){
  return groups.map((g, gi) => {
    const gname = (opts.names && opts.names[gi]) || `Group ${gi + 1}`;
    const size = opts.sizes
      ? `<span class="field"><input type="number" min="0" max="99" value="${g.size}" data-g="${gi}" aria-label="${gname}: number of students"> students</span>`
      : `<span class="vo-size">${g.size} students</span>`;
    const rm = opts.remove ? `<button type="button" class="vo-x" data-rm="${gi}" title="Remove this group" aria-label="Remove ${gname}">×</button>` : '';
    const rows = g.rank.map((c, pos) => {
      const arrows = opts.arrows
        ? `<span class="vo-arrows"><button type="button" data-g="${gi}" data-p="${pos}" data-d="-1"${pos === 0 ? ' disabled' : ''} aria-label="Move ${PETS[c]} up">▲</button><button type="button" data-g="${gi}" data-p="${pos}" data-d="1"${pos === n - 1 ? ' disabled' : ''} aria-label="Move ${PETS[c]} down">▼</button></span>`
        : '';
      return `<li><span class="vo-pos">${ORD[pos]}</span>${chip(c)}${arrows}</li>`;
    }).join('');
    return `<div class="vo-group${opts.mark === gi ? ' vo-mark' : ''}"><div class="vo-ghead${opts.remove ? '' : ' vo-plain'}"><span class="vo-gname">${gname}</span>${size}${rm}</div><ol class="vo-rank">${rows}</ol></div>`;
  }).join('');
}
/* Wire a groups host once. Handlers get (groupIndex, ...) and must re-render. */
function wireGroups(host, on){
  host.addEventListener('click', e => {
    const a = e.target.closest('button[data-d]');
    if (a){ on.move(+a.dataset.g, +a.dataset.p, +a.dataset.d); return; }
    const r = e.target.closest('button[data-rm]');
    if (r) on.remove(+r.dataset.rm);
  });
  host.addEventListener('input', e => {
    const inp = e.target.closest('input[data-g]');
    if (inp && on.size) on.size(+inp.dataset.g, inp.value, false);
  });
  host.addEventListener('change', e => {
    const inp = e.target.closest('input[data-g]');
    if (inp && on.size) on.size(+inp.dataset.g, inp.value, true);
  });
}
function moveInRank(rank, pos, d){
  const to = pos + d;
  if (to < 0 || to >= rank.length) return false;
  const t = rank[pos]; rank[pos] = rank[to]; rank[to] = t;
  return true;
}
function refocus(host, gi, pos, d){
  const b = host.querySelector(`button[data-g="${gi}"][data-p="${pos}"][data-d="${d}"]`);
  if (b && !b.disabled) b.focus();
  else { const other = host.querySelector(`button[data-g="${gi}"][data-p="${pos}"]`); if (other) other.focus(); }
}

function scoreRows(scores, n, winner){
  const max = Math.max.apply(null, scores.concat([1]));
  let h = '';
  for (let i = 0; i < n; i++){
    h += `<div class="vo-srow${winner === i ? ' win' : ''}"><span class="vo-slab">${name(i)}</span><div class="bar"><i style="width:${Math.round(100 * scores[i] / max)}%"></i></div><span class="vo-sn">${scores[i]}</span></div>`;
  }
  return h;
}
function winnerHTML(res){
  if (res.winner !== null && res.winner !== undefined) return `<div class="vo-winner"><span class="vo-wlab">Winner</span>${name(res.winner)}</div>`;
  const tied = res.tied || [];
  const txt = tied.length > 1 && tied.length < 4 ? `Tie: ${list(tied.map(name))}` : 'Tie';
  return `<div class="vo-winner vo-tie"><span class="vo-wlab">Result</span>${txt}</div>`;
}
function card(title, sub, res, body, wide){
  return `<div class="vo-card${wide ? ' vo-wide' : ''}"><div class="vo-rule">${title}</div><div class="vo-sub">${sub}</div>${winnerHTML(res)}${body}</div>`;
}
function pluralityCard(n, r){
  return card('Plurality', 'Most first-place votes wins.', r, scoreRows(r.first, n, r.winner));
}
function bordaCard(n, r){
  const w = Array.from({ length: n }, (_, i) => n - 1 - i).join(', ');
  return card('Borda count', `Points for 1st, 2nd, ...: ${w}. Most points wins.`, r, scoreRows(r.pts, n, r.winner));
}
function irvCard(n, r){
  const rows = r.rounds.map((rd, k) => {
    const counts = rd.alive.map(i => `${name(i)} ${rd.counts[i]}`).join(', ');
    let tail;
    if (rd.note === 'majority') tail = `${name(r.winner)} has a majority.`;
    else if (rd.note === 'all tied') tail = 'Everyone left is tied. No one can be fairly eliminated.';
    else tail = `Nobody has ${r.majority}. <b>${name(rd.out)}</b> is out${rd.note ? ` (${rd.note})` : ''}; those ballots move to their next choice.`;
    return `<li><b>Round ${k + 1}:</b> ${counts}. ${tail}</li>`;
  }).join('');
  const res = { winner: r.winner, tied: r.tie ? (r.rounds[r.rounds.length - 1] || { alive: [] }).alive : [] };
  return card('Instant runoff', `Eliminate the last-place pet and recount until someone has more than half (${r.majority} of ${r.total}).`, res, `<ol class="vo-rounds">${rows}</ol>`);
}
function condorcetCard(n, c){
  let t = '<div class="scroll" style="padding:0"><table class="data vo-pair"><tr><th></th>' + Array.from({ length: n }, (_, j) => `<th>vs ${name(j)}</th>`).join('') + '</tr>';
  for (let i = 0; i < n; i++){
    t += `<tr><th style="text-align:left">${name(i)}</th>`;
    for (let j = 0; j < n; j++){
      if (i === j){ t += '<td class="d">·</td>'; continue; }
      const a = c.table[i][j], b = c.table[j][i];
      const cls = a > b ? 'w' : a < b ? 'l' : 't';
      t += `<td class="${cls}">${a} to ${b}</td>`;
    }
    t += '</tr>';
  }
  t += '</table></div>';
  let v = '';
  if (c.winner !== null){
    const others = []; for (let y = 0; y < n; y++) if (y !== c.winner) others.push(`${name(y)} ${c.table[c.winner][y]} to ${c.table[y][c.winner]}`);
    v += `<p><b class="win-c">Condorcet winner: ${name(c.winner)}.</b> It beats ${list(others)}.</p>`;
  } else if (c.cycle){
    const cyc = c.cycle.concat([c.cycle[0]]);
    v += `<p><b>No Condorcet winner.</b> The majorities go in a circle: ${cyc.map(name).join(' beats ')}.</p>`;
  } else if (total_ > 0){
    v += '<p><b>No Condorcet winner.</b> Some head-to-head contest is a tie, so nobody beats everyone.</p>';
  } else {
    v += '<p>No ballots yet.</p>';
  }
  if (c.loser !== null) v += `<p>Condorcet loser: <b>${name(c.loser)}</b> (loses every contest).</p>`;
  v += '<p class="note" style="margin-top:0">Read across: a cell shows the row pet\'s votes, then the column pet\'s.</p>';
  const res = { winner: c.winner, tied: [] };
  const head = c.winner !== null ? winnerHTML(res) : `<div class="vo-winner vo-tie"><span class="vo-wlab">Result</span>${c.cycle ? 'A cycle' : 'No winner'}</div>`;
  return `<div class="vo-card vo-wide"><div class="vo-rule">Condorcet</div><div class="vo-sub">Head to head. A pet that beats every other pet wins.</div>${head}<div class="vo-condgrid">${t}<div class="vo-verdict">${v}</div></div></div>`;
}
let total_ = 0; // set before rendering the Condorcet card

/* ================= board 1: the ballot builder ================= */
const PRESET = {
  three: [[11, [0, 1, 2]], [10, [2, 1, 0]], [6, [1, 2, 0]], [3, [1, 0, 2]]],
  cycle: [[10, [0, 1, 2]], [10, [1, 2, 0]], [10, [2, 0, 1]]],
  reset: [[10, [0, 1, 2]], [10, [0, 1, 2]], [10, [0, 1, 2]]],
};
const st = { n: 3, groups: fromPreset(PRESET.three), loaded: 'three', sinceReset: false, hint: 0 };

/* A profile as a map "rank string" -> number of students, so reordering or splitting groups does not count as a change. */
function canon(groups){
  const m = {};
  for (const g of groups){ if (g.size <= 0) continue; const k = g.rank.join(''); m[k] = (m[k] || 0) + g.size; }
  return m;
}
function sameProfile(a, b){
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
}
/* Students whose ballot differs from the preset: sum over ballot types of (preset count - current count), positive parts. */
function movedFrom(presetGroups, groups){
  const p = canon(presetGroups), c = canon(groups);
  let moved = 0;
  for (const k of Object.keys(p)) moved += Math.max(0, p[k] - (c[k] || 0));
  return moved;
}

function bRender(){
  const n = st.n, groups = st.groups;
  $('#vo-groups').innerHTML = groupsHTML(groups, n, { sizes: true, arrows: true, remove: groups.length > MING });
  const tot = total(groups); total_ = tot;
  $('#vo-total').textContent = `${tot} student${tot === 1 ? '' : 's'} in ${groups.length} groups, ${n} pets`;
  $('#vo-add-group').disabled = groups.length >= MAXG;
  $('#vo-cand').textContent = n === 4 ? 'Remove the fourth pet' : 'Add a fourth pet';
  const r = countAll(n, groups);
  $('#vo-results').innerHTML = pluralityCard(n, r.plurality) + irvCard(n, r.irv) + bordaCard(n, r.borda) + condorcetCard(n, r.condorcet);
  bStatus(r);
}
function bStatus(r){
  const el = $('#vo-status');
  const P = r.plurality.winner, I = r.irv.winner, B = r.borda.winner, C = r.condorcet;
  if (total(st.groups) === 0){ el.innerHTML = 'Give the groups some students.'; return; }
  const three = P !== null && I !== null && B !== null && P !== I && I !== B && P !== B;
  const isThreePreset = sameProfile(canon(st.groups), canon(fromPreset(PRESET.three)));
  const parts = [];
  if (three){
    let h = `Three rules, three winners: plurality says <b>${name(P)}</b>, instant runoff says <b>${name(I)}</b>, Borda says <b>${name(B)}</b>.`;
    if (isThreePreset) h += ' <span class="note">This is the preset. Change something and keep them disagreeing to earn the star.</span>';
    else earn('vo-three');
    parts.push(h);
  }
  if (C.cycle){
    const cyc = C.cycle.concat([C.cycle[0]]).map(name).join(' beats ');
    let h = `No Condorcet winner: ${cyc}. A cycle.`;
    if (st.sinceReset) earn('vo-cycle');
    else h += ' <span class="note">To earn the star, press Reset and build a cycle yourself.</span>';
    parts.push(h);
  }
  if (parts.length){ el.innerHTML = parts.join(' '); return; }
  if (st.loaded === 'cycle' && C.winner !== null){
    const tot = total(st.groups);
    let h = `Cycle broken: <b>${name(C.winner)}</b> beats everyone.`;
    if (tot !== 30) h += ` <span class="note">But the class is now ${tot} students. Keep it at 30 and move students between groups instead.</span>`;
    else {
      const moved = movedFrom(fromPreset(PRESET.cycle), st.groups);
      h += ` You moved ${moved} student${moved === 1 ? '' : 's'}.`;
      h += moved <= 6 ? ' <span class="win-c">That is the fewest possible.</span>' : ' <span class="note">Can you do it with fewer?</span>';
    }
    el.innerHTML = h; return;
  }
  const say = w => (w === null ? 'a tie' : name(w));
  el.innerHTML = `Plurality: ${say(P)}. Instant runoff: ${say(I)}. Borda: ${say(B)}. Condorcet: ${C.winner === null ? 'nobody' : name(C.winner)}.`;
}
function bLoad(key){
  st.n = 3; st.groups = fromPreset(PRESET[key]); st.loaded = key; st.sinceReset = key === 'reset';
  bRender();
}
wireGroups($('#vo-groups'), {
  move(gi, pos, d){
    const g = st.groups[gi]; if (!g || !moveInRank(g.rank, pos, d)) return;
    bRender(); refocus($('#vo-groups'), gi, pos + d, d);
  },
  remove(gi){
    if (st.groups.length <= MING) return;
    st.groups.splice(gi, 1); bRender();
  },
  size(gi, raw, commit){
    const g = st.groups[gi]; if (!g) return;
    let v = Math.floor(Number(raw)); if (!Number.isFinite(v)) v = 0; v = Math.min(99, Math.max(0, v));
    g.size = v;
    if (commit){ bRender(); const inp = $(`#vo-groups input[data-g="${gi}"]`); if (inp) inp.focus(); }
    else {
      const tot = total(st.groups); total_ = tot;
      $('#vo-total').textContent = `${tot} student${tot === 1 ? '' : 's'} in ${st.groups.length} groups, ${st.n} pets`;
      const r = countAll(st.n, st.groups);
      $('#vo-results').innerHTML = pluralityCard(st.n, r.plurality) + irvCard(st.n, r.irv) + bordaCard(st.n, r.borda) + condorcetCard(st.n, r.condorcet);
      bStatus(r);
    }
  },
});
$('#vo-p-three').addEventListener('click', () => bLoad('three'));
$('#vo-p-cycle').addEventListener('click', () => bLoad('cycle'));
$('#vo-p-reset').addEventListener('click', () => bLoad('reset'));
$('#vo-load-cycle').addEventListener('click', () => { bLoad('cycle'); $('#vo-builder').scrollIntoView({ behavior: WM.reduced ? 'auto' : 'smooth', block: 'start' }); });
$('#vo-add-group').addEventListener('click', () => {
  if (st.groups.length >= MAXG) return;
  st.groups.push({ size: 0, rank: Array.from({ length: st.n }, (_, i) => i) });
  bRender();
  const inp = $(`#vo-groups input[data-g="${st.groups.length - 1}"]`); if (inp){ inp.focus(); inp.select(); }
});
$('#vo-cand').addEventListener('click', () => {
  if (st.n === 3){ st.n = 4; for (const g of st.groups) g.rank.push(3); }
  else { st.n = 3; for (const g of st.groups) g.rank = g.rank.filter(c => c !== 3); }
  bRender();
});
const HINTS = [
  'For a three-way split: give one pet a big loyal group that everyone else ranks last (plurality likes that), give another pet everyone\'s second place (Borda likes that), and make sure the second-place pet has the fewest first places so instant runoff throws it out in round one.',
  'For a cycle: press Reset, then give the three groups the same three pets rotated. Group 1: Hamster, Turtle, Fish. Group 2: Turtle, Fish, Hamster. Group 3: Fish, Hamster, Turtle. Then read the head-to-head table.',
  'For the Challenge at the bottom: add the fourth pet, give it one group that loves it and put it last on every other ballot.',
];
$('#vo-hint').addEventListener('click', () => {
  let i;
  if (!WM.has('vo-three')) i = 0; else if (!WM.has('vo-cycle')) i = 1; else i = 2;
  if (st.hint === i) i = (i + 1) % HINTS.length;   // a second click shows the next hint
  st.hint = i;
  $('#vo-status').innerHTML = `<span class="note" style="margin-top:0">Hint: ${HINTS[i]}</span>`;
});
bRender();

/* ================= board 2: the Fish group's trick (plurality, toggle) ================= */
const S1 = {
  honest: [[12, [0, 1, 2]], [10, [1, 0, 2]], [8, [2, 1, 0]]],
  lie:    [[12, [0, 1, 2]], [10, [1, 0, 2]], [8, [1, 2, 0]]],
};
const S1NAMES = ['Hamster group', 'Turtle group', 'Fish group'];
function s1Render(mode){
  const groups = fromPreset(S1[mode]);
  $('#vo-s1-groups').innerHTML = groupsHTML(groups, 3, { names: S1NAMES, mark: mode === 'lie' ? 2 : undefined });
  const r = plurality(3, groups);
  $('#vo-s1-results').innerHTML = pluralityCard(3, r);
  $('#vo-s1-status').innerHTML = mode === 'honest'
    ? `<b>${name(r.winner)}</b> wins with ${r.first[r.winner]} first-place votes. The Fish group gets its last choice.`
    : `<b>${name(r.winner)}</b> wins with ${r.first[r.winner]}. The Fish group ranks Turtle above Hamster, so all 8 of them are happier, and not one of them voted for Fish.`;
}
seg($('#vo-s1'), s1Render);
s1Render('honest');

/* ================= board 3: find the trick (Borda, editable) ================= */
const S2 = [[13, [0, 1, 2]], [10, [1, 0, 2]], [7, [2, 1, 0]]];
const s2 = { groups: fromPreset(S2), hint: 0 };
const s2Honest = fromPreset(S2);
const s2HonestWinner = borda(3, s2Honest).winner;   // Turtle
function s2Render(){
  const groups = s2.groups;
  const changed = groups.map((g, i) => g.rank.join('') !== s2Honest[i].rank.join('') ? i : -1).filter(i => i >= 0);
  $('#vo-s2-groups').innerHTML = groupsHTML(groups, 3, { arrows: true, names: S1NAMES, mark: changed.length === 1 ? changed[0] : undefined });
  const r = borda(3, groups);
  $('#vo-s2-results').innerHTML = bordaCard(3, r);
  const el = $('#vo-s2-status');
  const hw = s2HonestWinner;
  if (changed.length === 0){ el.innerHTML = `Honest votes: <b>${name(hw)}</b> wins with ${r.pts[hw]} points. Change one group's ranking with the arrows.`; return; }
  if (changed.length > 1){ el.innerHTML = 'Change just one group at a time. Two groups have changed; put one of them back.'; return; }
  const gi = changed[0], gname = S1NAMES[gi], honestRank = s2Honest[gi].rank;
  if (r.winner === null){ el.innerHTML = `A tie: ${list(r.tied.map(name))}. Not a win for anyone yet.`; return; }
  if (r.winner === hw){ el.innerHTML = `<b>${name(hw)}</b> still wins. The ${gname} is no better off.`; return; }
  if (honestRank.indexOf(r.winner) < honestRank.indexOf(hw)){
    el.innerHTML = `<span class="win-c">Now <b>${name(r.winner)}</b> wins</span>, and the ${gname} honestly likes ${name(r.winner)} more than ${name(hw)}. They got a better result by ranking dishonestly. That is a strategic vote, and this one has a name: burying.`;
    earn('vo-strategic');
  } else {
    el.innerHTML = `Now <b>${name(r.winner)}</b> wins, but the ${gname} likes ${name(r.winner)} even less than ${name(hw)}. That backfired.`;
  }
}
wireGroups($('#vo-s2-groups'), {
  move(gi, pos, d){
    const g = s2.groups[gi]; if (!g || !moveInRank(g.rank, pos, d)) return;
    s2Render(); refocus($('#vo-s2-groups'), gi, pos + d, d);
  },
  remove(){},
});
const S2HINTS = [
  'Ask which group is unhappiest with Turtle winning. Under the Borda count a group can hurt a pet without giving up its own favorite.',
  'The Hamster group ranks Turtle second, which hands Turtle 13 points. Move Turtle to the bottom of the Hamster group\'s ballot and watch the points.',
];
$('#vo-s2-hint').addEventListener('click', () => {
  $('#vo-s2-status').innerHTML = `<span class="note" style="margin-top:0">Hint: ${S2HINTS[s2.hint]}</span>`;
  s2.hint = (s2.hint + 1) % S2HINTS.length;
});
$('#vo-s2-reset').addEventListener('click', () => { s2.groups = fromPreset(S2); s2Render(); });
s2Render();
})();

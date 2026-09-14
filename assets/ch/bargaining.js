/* Chapter: Take it or leave it (ultimatum game, pirate game, melting cake). */
(function(){
'use strict';
const { $, $$, rand, wait, earn, seg, slider } = WM;

/* pure:start
   Pure solvers. Kept free of DOM so they can be unit-tested in node by slicing this block out. */

/* Pirate game by backward induction.
   n pirates, index 0 = most senior (the proposer). A pirate votes yes only when strictly better off
   than under the outcome if the proposer is thrown overboard (survive first, then coins, then a splash).
   The proposer votes yes and needs at least half of all votes (majority=true: more than half).
   Returns {alloc, alive, needed, bought, dies} for the n-pirate game; results for smaller crews are memoized. */
const pirateMemo = new Map();
function pirateSolve(n, coins, majority){
  const key = coins + '|' + (majority ? 'M' : 'H');
  let memo = pirateMemo.get(key);
  if (!memo){ memo = []; pirateMemo.set(key, memo); }
  if (memo[n]) return memo[n];
  let res;
  if (n <= 1){
    res = { alloc: [coins], alive: [true], needed: 0, bought: [], dies: false };
  } else {
    const next = pirateSolve(n - 1, coins, majority);
    const needed = (majority ? Math.floor(n / 2) + 1 : Math.ceil(n / 2)) - 1;   // votes to find beyond the proposer's own
    const costs = [];
    for (let j = 1; j < n; j++){
      const alive = next.alive[j - 1];
      costs.push({ j, cost: alive ? next.alloc[j - 1] + 1 : 0 });             // a pirate who would drown votes yes for free
    }
    costs.sort((a, b) => a.cost - b.cost || a.j - b.j);                        // ties: the more senior pirate is bought
    const buy = costs.slice(0, needed);
    const total = buy.reduce((s, x) => s + x.cost, 0);
    if (total > coins){
      res = { alloc: [0].concat(next.alloc), alive: [false].concat(next.alive), needed, bought: [], dies: true };
    } else {
      const alloc = new Array(n).fill(0), alive = new Array(n).fill(true);
      alloc[0] = coins - total;
      for (const b of buy) alloc[b.j] = b.cost;
      res = { alloc, alive, needed, bought: buy.map(b => b.j), dies: false };
    }
  }
  memo[n] = res;
  return res;
}

/* Alternating offers over a shrinking pie. You propose in odd rounds, Robo in even rounds.
   pies[r] is the pie in round r; g[r] = {you, robo} is what each player gets if the game reaches
   round r and both play backward induction (an indifferent responder says yes). */
function pieSolve(rounds, start, shrink){
  const pies = [];
  for (let r = 1; r <= rounds; r++) pies[r] = Math.round(start * Math.pow(shrink, r - 1) * 100) / 100;
  const g = []; g[rounds + 1] = { you: 0, robo: 0 };
  for (let r = rounds; r >= 1; r--){
    const p = pies[r], nx = g[r + 1];
    g[r] = (r % 2 === 1) ? { you: p - nx.robo, robo: nx.robo } : { you: nx.you, robo: p - nx.you };
  }
  return { pies, g };
}
/* pure:end */

const COINS = 10, ROUNDS = 10;
function coinRow(host, n, split, gone){
  // split = {you, robo} or null (no proposal yet). Coins 1..you are red, the rest blue.
  host.innerHTML = '';
  for (let i = 1; i <= n; i++){
    const c = document.createElement('div'); c.className = 'bg-coin';
    if (split) c.classList.add(i <= split.you ? 'you' : 'robo');
    if (gone) c.classList.add('gone');
    c.textContent = i; host.appendChild(c);
  }
}
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;

/* ================= Ultimatum A: you propose ================= */
const ua = { m: 1, round: 1, you: 0, robo: 0, nos: 0, log: [], over: false, busy: false, id: 0, last: null };
const uaStatus = html => { $('#ua-status').innerHTML = html; };
function uaRender(){
  const host = $('#ua-offers'); host.innerHTML = '';
  for (let k = 0; k <= COINS; k++){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-you'; b.textContent = String(k);
    b.disabled = ua.over || ua.busy;
    b.addEventListener('click', () => uaPropose(k)); host.appendChild(b);
  }
  coinRow($('#ua-coins'), COINS, ua.last ? { you: COINS - ua.last.offer, robo: ua.last.offer } : null, ua.last ? ua.last.rejected : false);
  $('#ua-round').textContent = `${Math.min(ua.round, ROUNDS)} of ${ROUNDS}`;
  $('#ua-you').textContent = String(ua.you); $('#ua-robo').textContent = String(ua.robo); $('#ua-nos').textContent = String(ua.nos);
  $('#ua-log').innerHTML = ua.log.slice(-4).join('<br>');
}
function uaNew(){
  ua.m = 1 + rand(5); ua.round = 1; ua.you = 0; ua.robo = 0; ua.nos = 0; ua.log = []; ua.over = false; ua.busy = false; ua.last = null; ua.id++;
  uaRender();
  uaStatus('New Robo, new secret minimum. How many of the 10 coins will you offer it?');
}
async function uaPropose(offer){
  if (ua.over || ua.busy) return;
  ua.busy = true; uaRender();
  uaStatus(`You keep ${COINS - offer} and offer Robo ${offer}. Robo is thinking...`);
  const id = ua.id;
  await wait(650);
  if (id !== ua.id) return;
  const ok = offer >= ua.m;
  ua.last = { offer, rejected: !ok };
  if (ok){ ua.you += COINS - offer; ua.robo += offer; }
  else ua.nos++;
  ua.log.push(`Round ${ua.round}: you offered ${offer}. Robo said ${ok ? 'yes' : 'no'}.${ok ? ` You keep ${COINS - offer}.` : ' Nobody gets anything.'}`);
  ua.round++; ua.busy = false;
  if (ua.round > ROUNDS) return uaFinish(ok, offer);
  uaRender();
  uaStatus(ok ? `<span class="win-c">Robo says yes.</span> You keep ${COINS - offer}. Round ${ua.round}: offer again.`
              : `<span class="you">Robo says no.</span> Nobody gets anything this round. Round ${ua.round}: offer again.`);
}
function uaFinish(ok, offer){
  ua.over = true; uaRender();
  const best = ROUNDS * (COINS - ua.m), need = 8 * (COINS - ua.m);
  const verdict = ok ? `Robo said yes to ${offer}.` : `Robo said no to ${offer}.`;
  let html = `${verdict} Done. Robo's minimum was <b class="robo">${ua.m}</b>. Knowing that, a player could keep ${COINS - ua.m} a round, ${best} in all. You kept <b class="you">${ua.you}</b>, which is ${pct(ua.you, best)} percent.`;
  if (ua.you >= need){ html += ` <span class="win-c">That is at least 80 percent.</span>`; earn('bg-probe'); }
  else html += ` You needed ${need}. Press New Robo and probe smarter.`;
  uaStatus(html);
}
$('#ua-new').addEventListener('click', uaNew);
uaNew();

/* ================= Ultimatum B: Robo proposes ================= */
const ub = { offers: [], round: 1, you: 0, robo: 0, theory: 0, log: [], over: false };
const ubStatus = html => { $('#ub-status').innerHTML = html; };
function shuffled(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function ubRender(){
  const x = ub.over ? null : ub.offers[ub.round - 1];
  coinRow($('#ub-coins'), COINS, x === null ? null : { you: x, robo: COINS - x }, false);
  $('#ub-yes').disabled = ub.over; $('#ub-no').disabled = ub.over;
  $('#ub-round').textContent = `${Math.min(ub.round, ROUNDS)} of ${ROUNDS}`;
  $('#ub-you').textContent = String(ub.you); $('#ub-robo').textContent = String(ub.robo); $('#ub-theory').textContent = String(ub.theory);
  $('#ub-log').innerHTML = ub.log.slice(-4).join('<br>');
  if (!ub.over) ubStatus(`Robo offers you <b class="you">${x}</b> and keeps <b class="robo">${COINS - x}</b>. Deal?`);
}
function ubNew(){
  ub.offers = shuffled([1, 1, 1, 2, 2, 2, 3, 3, 4, 5]); ub.round = 1; ub.you = 0; ub.robo = 0; ub.theory = 0; ub.log = []; ub.over = false;
  ubRender();
}
function ubAnswer(yes){
  if (ub.over) return;
  const x = ub.offers[ub.round - 1];
  ub.theory += x;
  if (yes){ ub.you += x; ub.robo += COINS - x; }
  ub.log.push(`Round ${ub.round}: Robo offered ${x}. You said ${yes ? 'yes' : 'no'}.`);
  ub.round++;
  if (ub.round > ROUNDS){
    ub.over = true; ubRender();
    const gap = ub.theory - ub.you;
    let html = `Done. You kept <b class="you">${ub.you}</b>. Saying yes to everything would have given you ${ub.theory}.`;
    if (gap === 0) html += ' You played it exactly the way backward induction says. Was any of it hard to click?';
    else html += ` You paid ${gap} coin${gap === 1 ? '' : 's'} to say no. Most people do.`;
    ubStatus(html);
    return;
  }
  ubRender();
}
$('#ub-yes').addEventListener('click', () => ubAnswer(true));
$('#ub-no').addEventListener('click', () => ubAnswer(false));
$('#ub-new').addEventListener('click', ubNew);
ubNew();

/* ================= The pirate game ================= */
const LETTERS = 'ABCDEFG'.split('');
const GOLD = 100;
const half = n => Math.ceil(n / 2);   // yes votes needed, counting the proposer's own

function pirateCard(letter, opts){
  const d = document.createElement('div'); d.className = 'bg-pirate';
  if (opts.prop) d.classList.add('prop'); if (opts.me) d.classList.add('me');
  d.innerHTML = `<span class="bg-letter">${letter}</span><span class="bg-role">${opts.role || ''}</span>`;
  if (opts.input){
    const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.max = String(GOLD); inp.step = '1';
    inp.value = opts.value === undefined || opts.value === null ? '' : String(opts.value);
    inp.setAttribute('aria-label', `Coins for pirate ${letter}`);
    d.appendChild(inp);
  } else {
    const a = document.createElement('span'); a.className = 'bg-amt'; a.textContent = String(opts.value); d.appendChild(a);
  }
  const v = document.createElement('span'); v.className = 'bg-vote'; d.appendChild(v);
  return d;
}
function readCards(host){
  return $$('input', host).map(i => {
    if (String(i.value).trim() === '') return NaN;
    const v = Math.floor(Number(i.value)); return Number.isFinite(v) ? Math.max(0, Math.min(GOLD, v)) : NaN;
  });
}
/* bad: the split cannot be proposed. red: show it in red (only once every box has something in it). */
function sumText(vals){
  if (vals.some(v => Number.isNaN(v))) return { text: 'Fill in every box', bad: true, red: false };
  const s = vals.reduce((a, b) => a + b, 0);
  return { text: `Total: ${s} of ${GOLD}` + (s === GOLD ? '' : ` (must be exactly ${GOLD})`), bad: s !== GOLD, red: s !== GOLD };
}
function listSplit(letters, alloc){ return letters.map((L, i) => `${L} ${alloc[i]}`).join(', '); }

/* Reasoning text for the crew `letters` (proposer first). */
function pirateReason(letters){
  const n = letters.length, P = letters[0];
  const sol = pirateSolve(n, GOLD, false), next = pirateSolve(n - 1, GOLD, false);
  if (sol.needed === 0){
    return `If ${P}'s proposal fails, ${P} goes overboard and ${letters[1]} takes all ${GOLD}. ${P} cannot buy ${letters[1]}'s vote for less than ${GOLD + 1} coins, and does not need to: ${P}'s own vote is 1 of 2, which is at least half. ${P} keeps everything: <b>${listSplit(letters, sol.alloc)}</b>.`;
  }
  const costs = letters.slice(1).map((L, i) => `${L} costs ${next.alloc[i] + 1}`).join(', ');
  const bought = sol.bought.map(j => letters[j]);
  const s = sol.needed === 1 ? '' : 's';
  return `If ${P}'s proposal fails, ${P} goes overboard and the rest split it <b>${listSplit(letters.slice(1), next.alloc)}</b>. ${P} needs ${sol.needed} more vote${s} besides its own (${sol.needed + 1} of ${n} is at least half). A pirate says yes only to strictly more than that, so ${costs}. ${P} buys ${bought.join(' and ')} for 1 coin each and keeps ${sol.alloc[0]}: <b>${listSplit(letters, sol.alloc)}</b>.`;
}

/* --- Work backwards stepper: crews of 2, 3, 4, 5 --- */
const pg = { step: 0, revealed: false };
const STEP_CREWS = [2, 3, 4, 5];
const crewLetters = n => LETTERS.slice(5 - n, 5);
function pgTitle(){
  const n = STEP_CREWS[pg.step], L = crewLetters(n), words = ['', '', 'two', 'three', 'four', 'five'];
  $('#pg-title').innerHTML = `Step ${pg.step + 1} of 4: ${words[n]} pirates left, <b>${L.join(', ')}</b>. ${L[0]} proposes. What does ${L[0]} offer each pirate?`;
}
function pgRender(){
  const n = STEP_CREWS[pg.step], L = crewLetters(n);
  const host = $('#pg-cards'); host.innerHTML = '';
  L.forEach((letter, i) => host.appendChild(pirateCard(letter, { prop: i === 0, role: i === 0 ? 'proposes' : '', input: true, value: null })));
  $$('input', host).forEach(inp => inp.addEventListener('input', pgSum));
  pgTitle(); pgSum();
  $('#pg-next').disabled = true; $('#pg-next').textContent = pg.step < 3 ? `Next: ${['', '', '', 'three', 'four', 'five'][STEP_CREWS[pg.step + 1]]} pirates` : 'Done';
  $('#pg-check').disabled = false; $('#pg-reveal').disabled = false;
  $('#pg-explain').innerHTML = pg.step === 0 ? 'Type a number of coins in each box. They must add up to 100.' : '';
  pg.revealed = false;
}
function pgSum(){
  const r = sumText(readCards($('#pg-cards')));
  const el = $('#pg-sum'); el.textContent = r.text; el.classList.toggle('bad', r.red);
}
function pgMark(vals, sol){
  $$('.bg-pirate', $('#pg-cards')).forEach((card, i) => {
    card.classList.remove('ok', 'bad');
    card.classList.add(vals[i] === sol.alloc[i] ? 'ok' : 'bad');
  });
}
function pgSolved(){
  const n = STEP_CREWS[pg.step];
  $('#pg-next').disabled = false; pg.revealed = true;
  if (pg.step === 3){
    $('#pg-next').textContent = 'Done';
    $('#pg-explain').innerHTML += `<p>That is the whole answer: the captain keeps ${pirateSolve(n, GOLD, false).alloc[0]} of 100 and two pirates are bought for a coin each. Now switch to <b>Play as pirate A</b> and try it against voters.</p>`;
  }
}
$('#pg-check').addEventListener('click', () => {
  if (pg.revealed) return;
  const n = STEP_CREWS[pg.step], vals = readCards($('#pg-cards')), r = sumText(vals);
  if (r.bad){ $('#pg-explain').innerHTML = `<span class="you">${r.text}.</span> Every coin in the chest gets handed to someone.`; return; }
  const sol = pirateSolve(n, GOLD, false);
  pgMark(vals, sol);
  const wrong = vals.filter((v, i) => v !== sol.alloc[i]).length;
  if (wrong === 0){
    $('#pg-explain').innerHTML = `<p><span class="win-c">Correct.</span> ${pirateReason(crewLetters(n))}</p>`;
    pgSolved();
  } else {
    const L = crewLetters(n);
    const hint = n === 2 ? `Ask: how many votes does ${L[0]} need, and does ${L[0]} already have them?`
      : `Ask: if ${L[0]} goes overboard, what does each pirate get? Whoever would get 0 can be bought for 1 coin. Nobody else is worth buying.`;
    $('#pg-explain').innerHTML = `<span class="you">${wrong} box${wrong === 1 ? ' is' : 'es are'} wrong.</span> ${hint}`;
  }
});
$('#pg-reveal').addEventListener('click', () => {
  if (pg.revealed) return;
  const n = STEP_CREWS[pg.step], sol = pirateSolve(n, GOLD, false);
  $$('input', $('#pg-cards')).forEach((inp, i) => { inp.value = String(sol.alloc[i]); });
  pgSum(); pgMark(sol.alloc, sol);
  $('#pg-explain').innerHTML = `<p>${pirateReason(crewLetters(n))}</p>`;
  pgSolved();
});
$('#pg-next').addEventListener('click', () => {
  if (!pg.revealed) return;
  if (pg.step < 3){ pg.step++; pgRender(); }
});
$('#pg-restart').addEventListener('click', () => { pg.step = 0; pgRender(); });

/* --- Play as pirate A --- */
const pp = { n: 5 };
function ppLetters(){ return LETTERS.slice(0, pp.n); }
function ppRender(keepValues){
  const old = keepValues ? readCards($('#pg-play-cards')) : null;
  const host = $('#pg-play-cards'); host.innerHTML = '';
  const L = ppLetters();
  const base = Math.floor(GOLD / pp.n);
  L.forEach((letter, i) => {
    let v = i === 0 ? GOLD - base * (pp.n - 1) : base;
    if (old && old.length === pp.n && !Number.isNaN(old[i])) v = old[i];
    host.appendChild(pirateCard(letter, { prop: i === 0, me: i === 0, role: i === 0 ? 'you propose' : '', input: true, value: v }));
  });
  $$('input', host).forEach(inp => inp.addEventListener('input', () => { ppSum(); ppClearVotes(); }));
  ppSum();
  $('#pg-status').innerHTML = `Type a split for ${L.join(', ')} and propose it. You need ${half(pp.n)} of ${pp.n} votes, and yours is one of them.`;
  $('#pg-play-explain').innerHTML = '';
}
function ppSum(){
  const r = sumText(readCards($('#pg-play-cards')));
  const el = $('#pg-play-sum'); el.textContent = r.text; el.classList.toggle('bad', r.red);
}
function ppClearVotes(){ $$('.bg-pirate', $('#pg-play-cards')).forEach(c => { c.classList.remove('yes', 'no', 'gone'); $('.bg-vote', c).textContent = ''; }); }
function ppN(){
  const v = Math.max(3, Math.min(7, Math.floor(Number($('#pg-n').value)) || 5));
  $('#pg-n').value = String(v);
  if (v !== pp.n){ pp.n = v; ppRender(false); }
}
$('#pg-n').addEventListener('change', ppN);
$('#pg-propose').addEventListener('click', () => {
  ppN();
  const vals = readCards($('#pg-play-cards')), r = sumText(vals), L = ppLetters();
  if (r.bad){ $('#pg-status').innerHTML = `<span class="you">${r.text}.</span>`; return; }
  const next = pirateSolve(pp.n - 1, GOLD, false);
  const cards = $$('.bg-pirate', $('#pg-play-cards'));
  let yes = 1;
  cards[0].classList.add('yes'); $('.bg-vote', cards[0]).textContent = 'yes (you)';
  const lines = [];
  for (let j = 1; j < pp.n; j++){
    const would = next.alive[j - 1] ? next.alloc[j - 1] : null;
    const v = would === null ? true : vals[j] > would;
    if (v) yes++;
    cards[j].classList.add(v ? 'yes' : 'no'); $('.bg-vote', cards[j]).textContent = v ? 'yes' : 'no';
    lines.push(`${L[j]}: offered ${vals[j]}, would get ${would === null ? 'thrown overboard' : would} if you sank. ${v ? 'Yes.' : 'No.'}`);
  }
  const pass = 2 * yes >= pp.n;
  if (pass){
    $('#pg-status').innerHTML = `<span class="win-c">It passes, ${yes} of ${pp.n} votes.</span> You keep ${vals[0]} coins.`;
    if (pp.n === 5 && vals[0] >= 98) earn('bg-pirate');
    else if (pp.n === 5) $('#pg-status').innerHTML += ' Can you keep 98?';
  } else {
    cards[0].classList.remove('yes'); cards[0].classList.add('gone'); $('.bg-vote', cards[0]).textContent = 'overboard';
    $('#pg-status').innerHTML = `<span class="you">It fails, ${yes} of ${pp.n} votes.</span> You go overboard and ${L[1]} proposes ${listSplit(L.slice(1), next.alloc)}.`;
  }
  $('#pg-play-explain').innerHTML = lines.map(t => `<p>${t}</p>`).join('');
});
$('#pg-hint').addEventListener('click', () => {
  ppN();
  const L = ppLetters(), next = pirateSolve(pp.n - 1, GOLD, false);
  $('#pg-play-explain').innerHTML = `<p>If you go overboard, ${L[1]} proposes <b>${listSplit(L.slice(1), next.alloc)}</b>, and it passes. Each pirate votes yes only if your offer beats their number there. You need ${half(pp.n) - 1} of them. Buy the cheapest.</p>`;
});
$('#pg-play-reset').addEventListener('click', () => ppRender(false));

/* --- Big crews --- */
function pgCrew(){
  const nEl = $('#pg-crew-n'), cEl = $('#pg-crew-c');
  const n = Math.max(2, Math.min(500, Math.floor(Number(nEl.value)) || 5)); nEl.value = String(n);
  const c = Math.max(1, Math.min(1000, Math.floor(Number(cEl.value)) || 100)); cEl.value = String(c);
  const sol = pirateSolve(n, c, false);
  const out = $('#pg-crew-out');
  if (!sol.dies){
    const k = sol.bought.length;
    const pos = sol.bought.map(j => j + 1);
    const posText = pos.length === 0 ? '' : pos.length <= 12 ? pos.join(', ') : `${pos.slice(0, 4).join(', ')}, ... , ${pos.slice(-2).join(', ')}`;
    out.innerHTML = `<p>With <b>${n}</b> pirates and <b>${c}</b> coins, the captain needs ${half(n)} of ${n} votes and buys ${k}. The captain keeps <b class="big">${sol.alloc[0]}</b>` +
      (k ? `, pays 1 coin each to ${k} pirate${k === 1 ? '' : 's'} (number${k === 1 ? '' : 's'} ${posText}, counting the captain as 1), and gives 0 to everyone else.` : ' and gives nothing to anyone.') + ' It passes.</p>';
  } else {
    let m = n; const drowned = [];
    while (m > 1 && pirateSolve(m, c, false).dies){ drowned.push(m); m--; }
    const s = pirateSolve(m, c, false);
    out.innerHTML = `<p>With <b>${n}</b> pirates and <b>${c}</b> coins, the captain needs ${half(n)} of ${n} votes and cannot buy enough of them. <b class="you">The captain goes overboard no matter what.</b></p>` +
      `<p>${drowned.length === 1 ? 'The next captain' : `The next ${drowned.length} captains`} (crew${drowned.length === 1 ? '' : 's'} of ${drowned.slice().reverse().join(', ')}) ${drowned.length === 1 ? 'goes' : 'go'} overboard too. The first proposal that passes is from the captain of <b>${m}</b> pirates, who keeps <b class="big">${s.alloc[0]}</b>. The doomed captains vote yes to that for free: it keeps them alive.</p>`;
  }
}
$('#pg-crew-n').addEventListener('change', pgCrew); $('#pg-crew-n').addEventListener('input', pgCrew);
$('#pg-crew-c').addEventListener('change', pgCrew); $('#pg-crew-c').addEventListener('input', pgCrew);

seg($('#pg-mode'), v => {
  $('#pg-back').hidden = v !== 'back'; $('#pg-play').hidden = v !== 'play'; $('#pg-crew').hidden = v !== 'crew';
  $('#pg-rules').textContent = v === 'crew' ? 'Same rules, any crew size. Type a number and see who survives.' : 'At least half the votes, counting the proposer\'s own, and the split happens.';
});
pgRender(); ppRender(false); pgCrew();

/* ================= The melting cake ================= */
const START = 100, SHRINK = 0.8;
const mp = { rounds: 3, round: 1, over: false, busy: false, id: 0, you: 0, robo: 0, log: [], sol: null, pending: null, puddle: false };
const mpStatus = html => { $('#mp-status').innerHTML = html; };
const fmt = x => Number.isInteger(x) ? String(x) : x.toFixed(1);
const mpPie = () => mp.sol.pies[mp.round];
const sliderEl = $('#mp-slider');
function wedge(cx, cy, r, f){
  if (f <= 0) return '';
  if (f >= 1) return `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 Z`;
  const a = 2 * Math.PI * f, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
  return `M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)} Z`;
}
function mpDraw(){
  const svg = $('#mp-pie');
  if (mp.puddle){
    svg.innerHTML = `<ellipse cx="110" cy="150" rx="70" ry="16" style="fill:var(--surface-2);stroke:var(--line);stroke-width:3"/><text x="110" y="120" text-anchor="middle" style="fill:var(--ink-soft);font-size:16px">melted</text>`;
    return;
  }
  const pie = mp.over && mp.pending && mp.pending.done ? mp.pending.pie : mpPie();
  const r = 88 * Math.sqrt(pie / START), cx = 110, cy = 98;
  const roboShare = mp.pending ? mp.pending.robo : Number(sliderEl.value);
  const f = pie > 0 ? Math.max(0, Math.min(1, roboShare / pie)) : 0;
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" style="fill:var(--you);stroke:var(--line);stroke-width:3"/>` +
    `<path d="${wedge(cx, cy, r, f)}" style="fill:var(--robo);stroke:var(--line);stroke-width:3;stroke-linejoin:round"/>` +
    `<text x="${cx}" y="210" text-anchor="middle" style="fill:var(--ink-soft);font-size:15px">worth ${fmt(pie)}</text>`;
}
function mpSplitText(){
  const pie = mpPie(), robo = mp.pending ? mp.pending.robo : Math.min(pie, Number(sliderEl.value));
  $('#mp-split').innerHTML = `<span class="you">You keep ${fmt(pie - robo)}</span> · <span class="robo">Robo gets ${fmt(robo)}</span>`;
}
const mpSlider = slider(sliderEl, v => fmt(v), () => { if (!mp.sol) return; if (!mp.over && !mp.pending) mpDraw(); mpSplitText(); });
function mpRender(){
  $('#mp-round').textContent = String(Math.min(mp.round, mp.rounds)); $('#mp-total').textContent = String(mp.rounds);
  $('#mp-left').textContent = mp.puddle ? '0' : fmt(mp.pending && mp.pending.done ? mp.pending.pie : mpPie());
  const youPropose = !mp.over && !mp.pending && mp.round % 2 === 1;
  $('#mp-offer-row').hidden = !youPropose; $('#mp-offer').disabled = mp.busy;
  $('#mp-respond').hidden = !(mp.pending && !mp.pending.done);
  sliderEl.disabled = mp.over || mp.busy || !!mp.pending;
  sliderEl.max = String(mp.over ? sliderEl.max : mpPie());
  $('#mp-hint').disabled = mp.over;
  $('#mp-log').innerHTML = mp.log.join('<br>');
  mpDraw(); mpSplitText();
}
function mpNew(){
  mp.sol = pieSolve(mp.rounds, START, SHRINK);
  mp.round = 1; mp.over = false; mp.busy = false; mp.you = 0; mp.robo = 0; mp.log = []; mp.pending = null; mp.puddle = false; mp.id++;
  sliderEl.max = String(START); sliderEl.value = '50'; mpSlider();
  mpRender();
  mpStatus('Round 1. Slide to choose how much of the cake Robo gets, then offer.');
}
function mpEnd(youGets, roboGets, pie){
  mp.over = true; mp.busy = false; mp.you = youGets; mp.robo = roboGets;
  mp.pending = { robo: roboGets, pie, done: true };
  mpRender();
}
function mpMelt(){
  mp.round++;
  if (mp.round > mp.rounds){
    mp.over = true; mp.busy = false; mp.puddle = true; mp.pending = null; mpRender();
    mpStatus('No deal in the last round. The cake is a puddle and nobody gets anything.');
    return false;
  }
  mp.log.push(`No deal. The cake melts to ${fmt(mpPie())}.`);
  return true;
}
async function mpOffer(){
  if (mp.over || mp.busy || mp.pending || mp.round % 2 !== 1) return;
  const pie = mpPie(), robo = Math.max(0, Math.min(pie, Number(sliderEl.value))), you = pie - robo;
  mp.busy = true; mpRender();
  mpStatus(`You offer Robo ${fmt(robo)} and keep ${fmt(you)}. Robo is thinking...`);
  const id = mp.id;
  await wait(700);
  if (id !== mp.id) return;
  const floor = mp.sol.g[mp.round + 1].robo;
  if (robo >= floor){
    mp.log.push(`Round ${mp.round}: you offered ${fmt(robo)}. Robo accepted.`);
    mpEnd(you, robo, pie);
    let html = `<span class="win-c">Robo accepts.</span> You keep ${fmt(you)}, Robo gets ${fmt(robo)}.`;
    if (mp.round === 1 && robo > floor) html += ` Robo would have taken ${fmt(floor)}.`;
    if (mp.rounds === 3 && mp.round === 1 && you >= 84){ html += ' That is the backward-induction offer.'; earn('bg-melt'); }
    mpStatus(html);
  } else {
    mp.log.push(`Round ${mp.round}: you offered ${fmt(robo)}. Robo refused.`);
    mp.busy = false;
    if (mpMelt()) mpRoboTurn(`<span class="robo">Robo says no.</span> `);
  }
}
async function mpRoboTurn(prefix){
  mp.busy = true; mp.pending = null; mpRender();
  mpStatus(`${prefix || ''}Round ${mp.round}: the cake is worth ${fmt(mpPie())} and Robo is deciding what to offer...`);
  const id = mp.id;
  await wait(750);
  if (id !== mp.id) return;
  const pie = mpPie(), you = mp.sol.g[mp.round + 1].you, robo = pie - you;
  mp.busy = false; mp.pending = { robo, you, pie, done: false };
  sliderEl.max = String(pie); sliderEl.value = String(robo); mpSlider();
  mpRender();
  const later = mp.round < mp.rounds ? ` Or reject, and propose from ${fmt(mp.sol.pies[mp.round + 1])} in round ${mp.round + 1}.` : ' Reject and it melts to nothing.';
  mpStatus(`Robo offers you <b class="you">${fmt(you)}</b> and keeps <b class="robo">${fmt(robo)}</b>. Accept?${later}`);
}
$('#mp-offer').addEventListener('click', mpOffer);
$('#mp-yes').addEventListener('click', () => {
  if (mp.over || !mp.pending || mp.pending.done) return;
  const p = mp.pending;
  mp.log.push(`Round ${mp.round}: Robo offered you ${fmt(p.you)}. You accepted.`);
  mpEnd(p.you, p.robo, p.pie);
  mpStatus(`Deal. You get ${fmt(p.you)}, Robo keeps ${fmt(p.robo)}.`);
});
$('#mp-no').addEventListener('click', () => {
  if (mp.over || !mp.pending || mp.pending.done) return;
  const p = mp.pending;
  mp.log.push(`Round ${mp.round}: Robo offered you ${fmt(p.you)}. You refused.`);
  mp.pending = null;
  if (!mpMelt()) return;
  sliderEl.max = String(mpPie()); sliderEl.value = String(Math.min(Number(sliderEl.value), mpPie())); mpSlider();
  mpRender();
  mpStatus(`Round ${mp.round}. The cake is worth ${fmt(mpPie())}. Your offer.`);
});
$('#mp-hint').addEventListener('click', () => {
  if (mp.over) return;
  const { pies, g } = mp.sol, parts = [];
  for (let r = mp.rounds; r >= mp.round; r--){
    const youP = r % 2 === 1;
    if (r === mp.rounds) parts.push(`round ${r} (worth ${fmt(pies[r])}): ${youP ? 'you propose and keep all of it' : 'Robo proposes and keeps all of it'}`);
    else if (youP) parts.push(`round ${r} (worth ${fmt(pies[r])}): Robo can guarantee ${fmt(g[r + 1].robo)} by refusing, so offer ${fmt(g[r + 1].robo)} and keep ${fmt(g[r].you)}`);
    else parts.push(`round ${r} (worth ${fmt(pies[r])}): you can guarantee ${fmt(g[r + 1].you)} by refusing, so Robo must offer you ${fmt(g[r + 1].you)} and keeps ${fmt(g[r].robo)}`);
  }
  mpStatus('Work backwards. ' + parts.join('. ') + '.');
});
$('#mp-new').addEventListener('click', mpNew);
seg($('#mp-rounds'), v => { mp.rounds = Number(v) === 2 ? 2 : 3; mpNew(); });
mpNew();
})();

/* Chapter: Going once, going twice (English, first-price, second-price, and Dutch auctions). */
(function(){
'use strict';
const { $, rand, wait, earn, slider } = WM;

/* ==== pure ====
   Auction arithmetic with no DOM. The block between these markers is also loaded by the node unit test. */
const ROBOTS = ['Robo', 'Robo 2', 'Robo 3'];
const LO = 10, HI = 100, SHADE = 0.75, STEP = 5, ROUNDS = 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r2 = x => Math.round(x * 100) / 100;
function money(x){
  const a = Math.abs(r2(x));
  return (r2(x) < 0 ? '−' : '') + '$' + (Number.isInteger(a) ? String(a) : a.toFixed(2));
}
const moneyS = x => (r2(x) > 0 ? '+' : '') + money(x);
/* Robot values: whole cents from 10.00 to 100.00, all equally likely. Reader values: whole dollars 10 to 100. */
const robotValue = rng => (LO * 100 + Math.floor(rng() * ((HI - LO) * 100 + 1))) / 100;
const readerValue = rng => LO + Math.floor(rng() * (HI - LO + 1));
const shadeBid = v => Math.round(SHADE * v * 100) / 100;
/* Index of the highest bid; a tie is broken at random. */
function highest(bids, rng){
  const m = Math.max.apply(null, bids);
  const tied = bids.map((b, i) => b === m ? i : -1).filter(i => i >= 0);
  return tied.length === 1 ? tied[0] : tied[Math.floor(rng() * tied.length)];
}
function resolveFirst(bids, rng){ const w = highest(bids, rng); return { winner: w, pay: bids[w] }; }
function resolveSecond(bids, rng){
  const w = highest(bids, rng);
  return { winner: w, pay: Math.max.apply(null, bids.filter((_, i) => i !== w)) };
}
/* Second price with one rival bid R: ties go to the rival. */
const vickreyProfit = (V, R, B) => (B > R ? V - R : 0);
/* First price vs three robots shading to 3/4: chance one robot bids below b, and the expected profit of bid b. */
const chanceBelow = b => clamp((b / SHADE - LO) / (HI - LO), 0, 1);
const evFirst = (V, b) => Math.pow(chanceBelow(b), 3) * (V - b);
function bestWholeBid(V){
  let best = 0, bv = -Infinity;
  for (let b = 0; b <= HI; b++){ const e = evFirst(V, b); if (e > bv + 1e-12){ bv = e; best = b; } }
  return { bid: best, ev: bv };
}
/* English auction, one price call at a time. Index 0 is the reader; robots stay exactly while price < value. */
function englishStart(values){
  return { price: STEP, values, inn: values.map(() => true), outAt: values.map(() => null), over: false, winner: -1, pay: 0, tie: false, dropped: [] };
}
function englishStep(st, readerStays, rng){
  const s = Object.assign({}, st, { inn: st.inn.slice(), outAt: st.outAt.slice(), dropped: [] });
  const before = s.inn.map((x, i) => x ? i : -1).filter(i => i >= 0);
  before.forEach(i => {
    const stay = i === 0 ? readerStays : s.values[i] > s.price;
    if (!stay){ s.inn[i] = false; s.outAt[i] = s.price; s.dropped.push(i); }
  });
  const after = s.inn.map((x, i) => x ? i : -1).filter(i => i >= 0);
  if (after.length === 1){ s.over = true; s.winner = after[0]; s.pay = s.price; }
  else if (after.length === 0){ s.over = true; s.winner = before[Math.floor(rng() * before.length)]; s.pay = s.price - STEP; s.tie = true; }
  else s.price += STEP;
  return s;
}
/* ==== end pure ==== */

const NAMES = ['You'].concat(ROBOTS);
const nameHtml = i => i === 0 ? '<span class="you">You</span>' : `<span class="robo">${ROBOTS[i - 1]}</span>`;
const bidNum = (el, fallback) => { const v = Math.round(+el.value); return Number.isFinite(v) ? clamp(v, 0, HI) : fallback; };

/* ================= 1. English auction ================= */
const E = { st: null, busy: false, n: 0, won: 0, total: 0 };
const eStatus = h => { $('#au-e-status').innerHTML = h; };
function eRender(){
  const st = E.st;
  $('#au-e-val').textContent = money(st.values[0]);
  $('#au-e-price').textContent = money(st.over ? st.pay : st.price);
  $('#au-e-in').textContent = String(st.inn.filter(Boolean).length);
  const host = $('#au-e-bidders'); host.innerHTML = '';
  NAMES.forEach((nm, i) => {
    const d = document.createElement('div');
    d.className = 'au-b ' + (i ? 'robo' : 'you');
    if (!st.inn[i]) d.classList.add('out');
    if (st.over && st.winner === i) d.classList.add('won');
    const s = st.over && st.winner === i ? `wins at ${money(st.pay)}` : st.inn[i] ? 'in' : `out at ${money(st.outAt[i])}`;
    const v = (i === 0 || st.over) ? `value ${money(st.values[i])}` : 'value ?';
    d.innerHTML = `<span class="n">${nm}</span><span class="s">${s}</span><span class="v">${v}</span>`;
    host.appendChild(d);
  });
  const can = !st.over && !E.busy && st.inn[0];
  $('#au-e-stay').disabled = !can; $('#au-e-drop').disabled = !can; $('#au-e-hint').disabled = !can;
  $('#au-e-new').disabled = E.busy;
  $('#au-e-n').textContent = String(E.n); $('#au-e-w').textContent = String(E.won);
  $('#au-e-total').textContent = moneyS(E.total);
}
function eNew(){
  if (E.busy) return;
  E.st = englishStart([readerValue(Math.random)].concat(ROBOTS.map(() => robotValue(Math.random))));
  $('#au-e-log').innerHTML = '';
  eRender();
  eStatus(`The card is up. Price called: <b>${money(E.st.price)}</b>. Your value is ${money(E.st.values[0])}. Stay in or drop out?`);
}
function eFinish(){
  const st = E.st, you = st.winner === 0, profit = you ? st.values[0] - st.pay : 0;
  E.n++; if (you) E.won++; E.total = r2(E.total + profit);
  eRender();
  const tieNote = st.tie ? `Everyone left dropped at ${money(st.pay + STEP)}, so a coin flip decided it at ${money(st.pay)}. ` : '';
  if (you){
    if (profit > 0){
      eStatus(`<span class="win-c">You win the card at ${money(st.pay)}. Profit ${moneyS(profit)}!</span> ${tieNote}`);
      earn('au-english');
    } else {
      eStatus(`<span class="you">You win the card at ${money(st.pay)}, but your value is ${money(st.values[0])}. Profit ${moneyS(profit)}.</span> ${tieNote}Winning is not the goal.`);
    }
  } else {
    const w = st.winner;
    let extra = '';
    if (st.outAt[0] !== null && st.outAt[0] < st.values[0]) extra = ` You dropped at ${money(st.outAt[0])} with a value of ${money(st.values[0])}; every price below your value was worth staying for.`;
    else if (st.values[w] > st.values[0]) extra = ` Its value was ${money(st.values[w])}, above yours, so it was always going to outlast you.`;
    eStatus(`<span class="robo">${ROBOTS[w - 1]} takes it at ${money(st.pay)}.</span> Your profit: $0.${tieNote ? ' ' + tieNote : ''}${extra}`);
  }
}
function eLog(st){
  if (!st.dropped.length) return;
  const at = st.over ? st.pay + (st.tie ? STEP : 0) : st.price - STEP;
  const line = `At ${money(at)}: ${st.dropped.map(nameHtml).join(', ')} dropped out.`;
  const log = $('#au-e-log'); log.innerHTML += (log.innerHTML ? '<br>' : '') + line;
}
async function eAct(stays){
  const st = E.st;
  if (!st || st.over || E.busy || !st.inn[0]) return;
  E.busy = true;
  E.st = englishStep(st, stays, Math.random); eLog(E.st); eRender();
  if (!E.st.over){
    eStatus(E.st.inn[0] ? `${E.st.dropped.length ? 'Someone dropped. ' : 'Everyone stayed. '}Price called: <b>${money(E.st.price)}</b>. Stay in or drop out?` : 'You are out. The robots keep going...');
    await wait(700);
  }
  while (!E.st.over && !E.st.inn[0]){
    E.st = englishStep(E.st, false, Math.random); eLog(E.st); eRender();
    if (!E.st.over) eStatus(`Price called: <b>${money(E.st.price)}</b>. ${E.st.inn.filter(Boolean).length} robots still in...`);
    await wait(700);
  }
  E.busy = false; eRender();
  if (E.st.over) eFinish();
}
$('#au-e-stay').addEventListener('click', () => eAct(true));
$('#au-e-drop').addEventListener('click', () => eAct(false));
$('#au-e-new').addEventListener('click', eNew);
$('#au-e-hint').addEventListener('click', () => {
  const st = E.st; if (!st || st.over || E.busy || !st.inn[0]) return;
  const v = st.values[0], p = st.price;
  if (p < v) eStatus(`Hint: ${money(p)} is below your value ${money(v)}. If the others drop out now you pocket ${moneyS(v - p)}, and staying costs nothing. <b>Stay in.</b>`);
  else eStatus(`Hint: ${money(p)} is not below your value ${money(v)}. Anything you win from here costs at least what it is worth to you. <b>Drop out.</b>`);
});
eNew();

/* ================= 2 and 3. Sealed-bid boards (first price and second price) ================= */
function sealedBoard(pfx, kind, hooks){
  const el = id => $(`#au-${pfx}-${id}`);
  const S = { round: 1, total: 0, value: 60, robots: [], phase: 'bid', hist: [] };
  const status = h => { el('status').innerHTML = h; };
  const roboBid = v => kind === 'first' ? shadeBid(v) : v;
  function renderHist(){
    el('hist').innerHTML = S.hist.map((p, i) => `<span class="${p > 0 ? 'up' : p < 0 ? 'down' : ''}">R${i + 1} ${moneyS(p)}</span>`).join('');
    el('total').textContent = moneyS(S.total);
    el('round').textContent = `${Math.min(S.round, ROUNDS)} of ${ROUNDS}`;
  }
  function newRound(){
    S.value = readerValue(Math.random);
    S.robots = ROBOTS.map(() => robotValue(Math.random));
    S.phase = 'bid';
    el('val').textContent = money(S.value);
    el('bid').value = String(kind === 'first' ? Math.round(SHADE * S.value) : S.value);
    el('bid').disabled = false;
    el('go').textContent = 'Seal it';
    el('tbl').innerHTML = '';
    status(`Round ${S.round}. Your value is <b>${money(S.value)}</b>. Write your number and seal it.`);
    renderHist();
    if (hooks.onValue) hooks.onValue(S.value);
  }
  function reset(){ S.round = 1; S.total = 0; S.hist = []; newRound(); }
  function seal(){
    const myBid = bidNum(el('bid'), 0); el('bid').value = String(myBid);
    const bids = [myBid].concat(S.robots.map(roboBid));
    const res = kind === 'first' ? resolveFirst(bids, Math.random) : resolveSecond(bids, Math.random);
    const you = res.winner === 0;
    const profit = you ? r2(S.value - res.pay) : 0;
    S.total = r2(S.total + profit); S.hist.push(profit);
    const values = [S.value].concat(S.robots);
    let h = `<tr><th>Bidder</th><th>Value</th><th>Bid</th><th>Result</th></tr>`;
    bids.forEach((b, i) => {
      const win = i === res.winner;
      const cls = i === 0 ? 'yb' : 'rb';
      const result = win ? `wins, pays ${money(res.pay)}, profit ${moneyS(r2(values[i] - res.pay))}` : 'loses';
      h += `<tr class="${win ? 'hl' : ''}"><td class="${cls}">${NAMES[i]}</td><td>${money(values[i])}</td><td>${money(b)}</td><td>${result}</td></tr>`;
    });
    el('tbl').innerHTML = h;
    if (you){
      if (profit > 0) status(`<span class="win-c">You win at ${money(res.pay)}. Profit ${moneyS(profit)}!</span>` + (hooks.onWin ? hooks.onWin(profit) : ''));
      else if (profit === 0) status(`<span class="you">You win at ${money(res.pay)}, exactly your value. Profit $0.</span> ${kind === 'first' ? 'Bidding your full value can never earn anything.' : 'The second-highest bid happened to equal your value.'}`);
      else status(`<span class="you">You win at ${money(res.pay)}, which is more than the card is worth to you. Profit ${moneyS(profit)}.</span> ${kind === 'first' ? 'You bid above your value.' : 'You bid above your value, and the second-highest bid landed in between.'}`);
    } else {
      const w = res.winner;
      let why = '';
      if (kind === 'first' && bids[w] < S.value) why = ` A bid of ${money(Math.ceil(bids[w]))} would have won for a profit of ${moneyS(S.value - Math.ceil(bids[w]))}. That is the tradeoff.`;
      if (kind === 'second' && myBid === S.value && S.robots[w - 1] > S.value) why = ` Its value was above yours; winning would have meant paying more than ${money(S.value)}. Losing was right.`;
      status(`<span class="robo">${ROBOTS[w - 1]} wins at ${money(res.pay)}.</span> Your profit: $0.${why}`);
    }
    S.phase = 'shown'; el('bid').disabled = true;
    if (S.round >= ROUNDS){
      S.phase = 'done'; el('go').textContent = 'Play 10 more';
      const verdict = S.total > 0 ? `<span class="win-c">Ten rounds done. Total profit ${moneyS(S.total)}.</span>` : `Ten rounds done. Total profit ${moneyS(S.total)}.`;
      status(el('status').innerHTML + '<br>' + verdict);
      if (hooks.onDone) hooks.onDone(S.total);
    } else {
      el('go').textContent = 'Next round';
    }
    renderHist();
  }
  el('go').addEventListener('click', () => {
    if (S.phase === 'bid') seal();
    else if (S.phase === 'shown'){ S.round++; newRound(); }
    else reset();
  });
  el('bid').addEventListener('keydown', ev => { if (ev.key === 'Enter' && S.phase === 'bid') seal(); });
  el('new').addEventListener('click', reset);
  el('hint').addEventListener('click', () => { if (S.phase === 'bid') status(hooks.hint(S.value)); });
  reset();
  return S;
}

/* Expected-profit table in the Math corner, driven by the first-price board's current value. */
function evTable(V){
  $('#au-ev-v').textContent = money(V);
  let h = `<tr><th>Bid</th><th>Chance all 3 robots bid lower</th><th>Profit if you win</th><th>Expected profit</th></tr>`;
  [50, 60, 70, 80].forEach(pct => {
    const b = Math.round(pct / 100 * V);
    const c = Math.pow(chanceBelow(b), 3);
    h += `<tr><td>${pct}% of value = ${money(b)}</td><td>${(100 * c).toFixed(1)}%</td><td>${money(V - b)}</td><td>${money(c * (V - b))}</td></tr>`;
  });
  $('#au-ev').innerHTML = h;
  const best = bestWholeBid(V);
  $('#au-ev-best').innerHTML = `Try every whole-dollar bid from $0 to $100 and the best one for a value of ${money(V)} is <b>${money(best.bid)}</b>, with expected profit ${money(best.ev)}. It always lands within a dollar of 0.75 × <span class="var">V</span> + 1.875, or $75 when that is bigger: against these robots, a bid of $75 already wins for sure.`;
}
const F = sealedBoard('f', 'first', {
  onValue: evTable,
  onDone: total => { if (total > 0) earn('au-shade'); },
  hint: V => `Hint: bidding ${money(V)} earns nothing even when it wins, so bid below it. Too far below and you never win. The Math corner under this board works out the expected profit for each bid from your value of ${money(V)}; the best whole-dollar bid is ${money(bestWholeBid(V).bid)}.`
});

/* ================= 3. Vickrey explorer ================= */
const X = { V: 60, R: 45, B: 60, quizOK: false };
const W = 640, H = 330, PL = 60, PR = 22, PT = 22, PB = 46;
const sx = b => PL + (W - PL - PR) * b / HI;
const sy = p => PT + (H - PT - PB) * (HI - p) / (2 * HI);
function xChart(){
  const { V, R, B } = X;
  const pV = vickreyProfit(V, R, V), pB = vickreyProfit(V, R, B), gain = V - R;
  let s = '';
  [-100, -50, 0, 50, 100].forEach(p => { s += `<line class="${p === 0 ? 'ax' : 'gl'}" x1="${PL}" x2="${W - PR}" y1="${sy(p)}" y2="${sy(p)}"/><text x="${PL - 8}" y="${sy(p) + 5}" text-anchor="end">${p > 0 ? '+' : ''}${p}</text>`; });
  [0, 25, 50, 75, 100].forEach(b => { s += `<line class="gl" y1="${PT}" y2="${H - PB}" x1="${sx(b)}" x2="${sx(b)}"/><text x="${sx(b)}" y="${H - PB + 20}" text-anchor="middle">${b}</text>`; });
  s += `<line class="ax" x1="${PL}" x2="${PL}" y1="${PT}" y2="${H - PB}"/>`;
  s += `<text class="lab" x="${(PL + W - PR) / 2}" y="${H - 8}" text-anchor="middle">your bid B (dollars)</text>`;
  s += `<text class="lab" transform="translate(16 ${(PT + H - PB) / 2}) rotate(-90)" text-anchor="middle">your profit</text>`;
  s += `<line class="rline" x1="${sx(R)}" x2="${sx(R)}" y1="${PT}" y2="${H - PB}"/><text x="${sx(R) + 6}" y="${PT + 14}">R = ${R}</text>`;
  s += `<line class="vline" x1="${sx(V)}" x2="${sx(V)}" y1="${PT}" y2="${H - PB}"/>`;
  /* profit curve: 0 for B at or below R, V - R above R */
  s += `<line class="curve" x1="${sx(0)}" x2="${sx(R)}" y1="${sy(0)}" y2="${sy(0)}"/>`;
  if (R < HI) s += `<line class="curve" x1="${sx(R)}" x2="${sx(HI)}" y1="${sy(gain)}" y2="${sy(gain)}"/><circle class="doto" cx="${sx(R)}" cy="${sy(gain)}" r="7"/>`;
  s += `<circle class="dotc" cx="${sx(R)}" cy="${sy(0)}" r="6"/>`;
  s += `<circle class="dotb" cx="${sx(B)}" cy="${sy(pB)}" r="9"/>`;
  s += `<circle class="dotv" cx="${sx(V)}" cy="${sy(pV)}" r="9"/><text x="${sx(V) + (V > 88 ? -12 : 12)}" y="${sy(pV) - 12}" text-anchor="${V > 88 ? 'end' : 'start'}">B = V</text>`;
  $('#au-chart').innerHTML = s;
}
function xRender(){
  const { V, R, B } = X;
  const pB = vickreyProfit(V, R, B), pV = vickreyProfit(V, R, V);
  let st;
  if (B > R) st = `B = ${money(B)} beats R = ${money(R)}: you win and pay ${money(R)}. Profit = ${V} − ${R} = <b>${moneyS(pB)}</b>.`;
  else st = `B = ${money(B)} does not beat R = ${money(R)}: you lose. Profit <b>$0</b>.`;
  $('#au-x-status').innerHTML = st;
  let note;
  if (pB === pV) note = `Bidding your value (${money(V)}) would earn ${moneyS(pV)} too. No difference.`;
  else if (pB < pV) note = `Bidding your value (${money(V)}) would earn ${moneyS(pV)}. Your bid earns ${moneyS(pB)}. Honesty is ahead by ${money(pV - pB)}.`;
  else note = 'This should be impossible. Tell a grown-up.';
  $('#au-x-note').textContent = note;
  xChart();
}
slider($('#au-v'), v => money(v), v => { X.V = v; $('#au-q-v').textContent = money(v); xRender(); });
slider($('#au-r'), v => money(v), v => { X.R = v; xRender(); });
slider($('#au-b'), v => money(v), v => { X.B = v; xRender(); });
function setSlider(id, v){ const s = $(id); s.value = String(v); s.dispatchEvent(new Event('input')); }
$('#au-q-go').addEventListener('click', () => {
  const raw = $('#au-q-in').value.trim();
  if (raw === '') { $('#au-q-status').textContent = 'Type a number first.'; return; }
  const a = bidNum($('#au-q-in'), -1), V = X.V;
  const q = $('#au-q-status');
  if (a === V){
    X.quizOK = true;
    q.innerHTML = `<span class="win-c">Right. Bid exactly your value, ${money(V)}.</span> Whatever R turns out to be, no other bid does better. Now win a round below with a profit to earn the star.`;
  } else if (a < V){
    const r = Math.max(a, Math.floor((a + V) / 2));
    setSlider('#au-r', r); setSlider('#au-b', a);
    q.innerHTML = `<span class="you">Not quite.</span> Bidding below your value can only lose auctions you wanted to win. I set R to ${money(r)}: bidding ${money(a)} earns ${moneyS(vickreyProfit(V, r, a))}, bidding ${money(V)} earns ${moneyS(vickreyProfit(V, r, V))}. Try again.`;
  } else {
    if (a >= V + 2){
      const r = V + 1;
      setSlider('#au-r', r); setSlider('#au-b', a);
      q.innerHTML = `<span class="you">Not quite.</span> Bidding above your value can only win auctions you should have lost. I set R to ${money(r)}: bidding ${money(a)} wins and pays ${money(r)} for a ${money(V)} card, profit ${moneyS(vickreyProfit(V, r, a))}. Bidding ${money(V)} loses and earns $0, which is better. Try again.`;
    } else {
      setSlider('#au-b', a);
      q.innerHTML = `<span class="you">Not quite.</span> One dollar over never helps: it can only win when the rival bid lands between ${money(V)} and ${money(a)}, and then you pay more than the card is worth. Try again.`;
    }
  }
});
$('#au-q-in').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#au-q-go').click(); });
xRender();

/* ================= 3b. Vickrey, ten rounds ================= */
sealedBoard('s', 'second', {
  onWin: profit => {
    if (profit > 0 && X.quizOK){ earn('au-honest'); return ''; }
    return profit > 0 && !X.quizOK ? ' (Answer the quiz above, then win again, for the star.)' : '';
  },
  hint: V => `Hint: bid your value, ${money(V)}. The proof above says nothing beats it, whatever the robots write.`
});

/* ================= 4. Dutch auction (falling clock) ================= */
const D = { value: 60, robots: [], waits: [], price: 100, timer: null, running: false, n: 0, total: 0 };
const dStatus = h => { $('#au-d-status').innerHTML = h; };
function dRender(){
  $('#au-d-val').textContent = money(D.value);
  $('#au-d-price').textContent = money(D.price);
  $('#au-d-total').textContent = moneyS(D.total);
  $('#au-d-mine').disabled = !D.running;
  $('#au-d-start').disabled = D.running;
  $('#au-d-start').textContent = D.n ? 'New card, start the clock' : 'Start the clock';
}
function dPrep(){
  D.value = readerValue(Math.random);
  D.robots = ROBOTS.map(() => robotValue(Math.random));
  D.waits = D.robots.map(shadeBid);
  D.price = 100;
  $('#au-d-log').innerHTML = '';
  dRender();
}
function dFinish(who, price, viaAuto){
  clearInterval(D.timer); D.timer = null; D.running = false;
  D.price = price; D.n++;
  const profit = who === 0 ? D.value - price : 0;
  D.total = r2(D.total + profit);
  dRender();
  const reveal = ROBOTS.map((nm, i) => `${nm} was waiting for ${money(D.waits[i])} (3/4 of ${money(D.robots[i])})`).join('; ');
  $('#au-d-log').innerHTML = reveal + '.';
  if (who === 0){
    const how = viaAuto ? `Your waiting number, ${money(price)}, came up first.` : `You shouted at ${money(price)}.`;
    if (profit > 0) dStatus(`<span class="win-c">${how} Your value is ${money(D.value)}: profit ${moneyS(profit)}!</span>`);
    else dStatus(`<span class="you">${how} Your value is ${money(D.value)}: profit ${moneyS(profit)}.</span> Never shout above your value.`);
  } else {
    dStatus(`<span class="robo">${ROBOTS[who - 1]} shouted first, at ${money(price)}.</span> Your profit: $0.`);
  }
}
function dTick(){
  D.price -= 1;
  dRender();
  const autoRaw = $('#au-d-auto').value.trim();
  const auto = autoRaw === '' ? -1 : bidNum($('#au-d-auto'), -1);
  /* Everyone whose waiting number the clock has reached shouts; the highest waiting number got there first. */
  let who = -1, best = -Infinity;
  D.waits.forEach((w, i) => { if (w >= D.price && w > best){ best = w; who = i + 1; } });
  if (auto >= 0 && auto >= D.price && auto > best){ best = auto; who = 0; }
  if (who >= 0) return dFinish(who, D.price, who === 0);
  if (D.price <= 0) return dFinish(-1, 0, false);
}
$('#au-d-start').addEventListener('click', () => {
  if (D.running) return;
  dPrep(); D.running = true; dRender();
  dStatus(`Clock running. Your value is <b>${money(D.value)}</b>. Shout when the price is right.`);
  D.timer = setInterval(dTick, 160);
});
$('#au-d-mine').addEventListener('click', () => { if (D.running) dFinish(0, D.price, false); });
dPrep();
dStatus('Press start. The clock falls from $100, one dollar at a time.');
})();

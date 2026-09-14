/* Winning Moves shared runtime.
   Exposes window.WM: small helpers, the star (progress) system, the payoff grid renderer, a toast.
   Chapter scripts live in assets/ch/<slug>.js and are loaded after this file. */
(function(){
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fmtN = n => (n < 0 ? '−' + (-n) : String(n));
const fmtS = n => (n > 0 ? '+' + n : n < 0 ? '−' + (-n) : '0');
const fmtNum = n => Number(n).toLocaleString('en-US');
function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); return b ? gcd(b, a % b) : a; }
function frac(pct){
  if (pct === 0) return '0'; if (pct === 100) return '1';
  const g = gcd(pct, 100); return `${pct / g}/${100 / g}`;
}
function fracOf(num, den){
  if (num === 0) return '0';
  const g = gcd(num, den); num /= g; den /= g;
  return den === 1 ? String(num) : `${num}/${den}`;
}
const payCell = (u, v, signed) => `<span class="you">${signed ? fmtS(u) : fmtN(u)}</span><span class="sep">·</span><span class="robo">${signed ? fmtS(v) : fmtN(v)}</span>`;

/* Payoff grid. g = {rows:[...], cols:[...], pay:[[[u,v],...],...], signed?, rowName?, colName?}
   Returns an HTML string for the inside of a <table class="pay">. Cells carry data-r / data-c. */
function grid(g, opts){
  opts = opts || {};
  const rowName = g.rowName || 'you', colName = g.colName || 'robo';
  let h = `<tr><th class="corner">${rowName} ↓ &nbsp; ${colName} →</th>` + g.cols.map(c => `<th class="ch">${c}</th>`).join('') + '</tr>';
  g.rows.forEach((r, i) => {
    h += `<tr><th class="rh">${r}</th>`;
    g.cols.forEach((c, j) => {
      const cell = g.pay[i][j];
      const inner = opts.render ? opts.render(cell, i, j) : payCell(cell[0], cell[1], g.signed);
      h += `<td class="${opts.clickable ? 'click' : ''}" data-r="${i}" data-c="${j}">${inner}</td>`;
    });
    h += '</tr>';
  });
  return h;
}
function isNash(pay, r, c){
  const u = pay[r][c][0], v = pay[r][c][1];
  return pay.every(row => row[c][0] <= u) && pay[r].every(cell => cell[1] <= v);
}
function bestResponsesRow(pay, c){ // rows that are best responses to column c
  const m = Math.max.apply(null, pay.map(row => row[c][0]));
  return pay.map((row, i) => row[c][0] === m ? i : -1).filter(i => i >= 0);
}
function bestResponsesCol(pay, r){
  const m = Math.max.apply(null, pay[r].map(cell => cell[1]));
  return pay[r].map((cell, j) => cell[1] === m ? j : -1).filter(j => j >= 0);
}

/* ---------- stars ---------- */
const KEY = 'wm-stars';
let stars = {};
try { stars = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { stars = {}; }
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const CHAPTERS = window.WM_CHAPTERS || [];        // emitted by build.py: [{slug,num,title,stars:[{id,label}]}]
const allStarIds = [];
CHAPTERS.forEach(ch => ch.stars.forEach(s => allStarIds.push(s.id)));
function starLabel(id){
  for (const ch of CHAPTERS) for (const s of ch.stars) if (s.id === id) return s.label;
  return id;
}
function has(id){ return !!stars[id]; }
function count(){ return allStarIds.filter(has).length; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(stars)); } catch (e) {} }
let toastTimer = null;
function toast(msg){
  let t = $('#toast');
  if (!t){ t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}
function renderStars(){
  const c = $('#star-count'); if (c) c.textContent = String(count());
  const t = $('#star-total'); if (t) t.textContent = String(allStarIds.length);
  $$('[data-star]').forEach(el => el.classList.toggle('on', has(el.dataset.star)));
  $$('[data-chapter-stars]').forEach(el => {
    const ids = el.dataset.chapterStars.split(',').filter(Boolean);
    const n = ids.filter(has).length;
    el.querySelectorAll('svg').forEach((svg, i) => svg.classList.toggle('on', i < n));
    const card = el.closest('.card'); if (card) card.classList.toggle('done', ids.length > 0 && n === ids.length);
  });
  const pb = $('#progress-fill'); if (pb) pb.style.width = (allStarIds.length ? 100 * count() / allStarIds.length : 0) + '%';
  const pt = $('#progress-text'); if (pt) pt.textContent = `${count()} of ${allStarIds.length} stars`;
}
function earn(id){
  if (stars[id]) return false;
  stars[id] = Date.now(); save(); renderStars();
  toast('★ Star earned: ' + starLabel(id));
  return true;
}
function resetStars(){ stars = {}; save(); renderStars(); toast('Stars reset. Go get them again!'); }

/* ---------- segmented controls: <div class="seg" data-seg="name"><button data-v="a" class="on">..</button>...</div> ---------- */
function seg(el, onChange){
  const buttons = $$('button', el);
  buttons.forEach(b => b.addEventListener('click', () => {
    buttons.forEach(x => x.classList.remove('on')); b.classList.add('on');
    onChange(b.dataset.v, b);
  }));
  const on = buttons.find(b => b.classList.contains('on'));
  return on ? on.dataset.v : null;
}

/* ---------- sliders: label value readout ---------- */
function slider(input, fmt, onChange){
  const out = $(`[data-for="${input.id}"]`);
  const upd = () => { if (out) out.textContent = fmt(+input.value); onChange && onChange(+input.value); };
  input.addEventListener('input', upd); upd();
  return upd;
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderStars();
  const rs = $('#reset-stars'); if (rs) rs.addEventListener('click', resetStars);
  $$('.starlist li[data-star] svg').forEach(() => {});
});

window.WM = { $, $$, rand, pick, reduced, wait, clamp, fmtN, fmtS, fmtNum, gcd, frac, fracOf, payCell, grid, isNash, bestResponsesRow, bestResponsesCol,
  has, earn, count, toast, seg, slider, renderStars, STAR_SVG, chapters: CHAPTERS };
})();

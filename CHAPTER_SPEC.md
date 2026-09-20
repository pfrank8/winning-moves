# Chapter authoring spec

Read this whole file before writing a chapter. Then read the exemplar:
`content/chapters/thinking-backwards.html` + `assets/ch/thinking-backwards.js`.
Copy its structure. Match its voice. Match its level.

## Who this is for

One reader: Garrett, age 9, a math savant ("9 going on 15" for math). He reads
fluently, likes real notation, gets bored by baby talk, and is thrilled by a
big idea stated plainly. He has never taken algebra formally but can handle a
variable, a fraction, an exponent, a remainder, base 2, and a proof with a
few steps, as long as each step is honest and concrete. Assume he will read
every word and try every button.

The opponent is **Robo**, a robot that plays perfectly (unless a "Robo goofs
sometimes" checkbox is on). Robo has no gender. Robo is blue. The reader is red.

## Voice

- Direct, warm, precise. Short sentences, but not clipped. No exclamation
  marks except in a game status line where something happened.
- Say the real name of every idea, then say it plainly. Use
  `<span class="term">Nash equilibrium</span>` for the first use of a term,
  and add a pronunciation for hard words: `<span class="say">(say: ee-kwi-LIB-ree-um)</span>`.
- Never talk down. "Grown-ups call this..." is fine once per chapter at most.
  "Isn't that fun?" is never fine.
- Concrete before abstract. A specific game with specific numbers first, the
  general rule second, the notation third.
- No em-dashes anywhere (use a comma, a period, or a colon). No emoji as
  section markers or decoration. Hand emoji inside a Rock/Paper/Scissors
  button is fine; a sparkle next to a heading is not.
- Use `<b>` for emphasis, `<i>` sparingly, `<code>` for numbers and small
  expressions (`<code>21 mod 4 = 1</code>`), `<div class="formula">` for a
  displayed formula, `<span class="var">n</span>` for a variable in prose.
- Facts must be true. Named people, dates, theorems, and numbers must be
  real and correct. If unsure, leave it out.

## Chapter file: `content/chapters/<slug>.html`

Starts with a JSON front-matter comment, then body HTML (no `<html>`, `<head>`,
`<body>`, no `<h1>`: the build adds the header from the front matter).

```html
<!--meta {
  "title": "Thinking backwards",
  "kicker": "Backward induction",
  "description": "One sentence for the chapter card on the home page.",
  "lede": "Two to four sentences under the title. Hook plus what the reader will be able to do.",
  "stars": [
    {"id": "tb-win", "label": "Beat a perfect Robo at the 21 Game"}
  ]
} -->
<style> /* chapter-specific CSS only; prefix every class with the chapter's short code, e.g. .tb- */ </style>
<section> ... </section>
```

Star ids are globally unique: prefix with the chapter's 2-3 letter code
(`tb-`, `nb-`, `hx-`...). 2 to 4 stars per chapter. A star is earned by doing
the clever thing (beating Robo fairly, solving a puzzle, making a correct
prediction), never by mere clicking. Do not award a star when "Robo goofs" is
on or when settings make the win trivial.

## Chapter structure (in this order, adapt as the topic needs)

1. Opening `<section>` with a `<div class="prose">` of 2-4 paragraphs that set
   up the first game, then the first `<div class="board">` (the game).
2. One or more further `<section>`s, each with an `<h2>`, prose, and usually
   an interactive `board`. Two to four interactives per chapter. At least one
   must be a real game against Robo or a real simulation, not a quiz.
3. A `<div class="math">` Math corner (the actual mathematics: notation,
   a formula, a computation the reader can redo by hand).
4. A `<div class="idea">` Big idea box: the one thing to remember, stated in
   two or three sentences.
5. A `<div class="try">` Try it on paper: 2-3 exercises, each answer inside
   `<details class="reveal"><summary>Answer</summary>...</details>`.
6. A `<div class="challenge">` Challenge: one genuinely hard problem, answer
   in a reveal. It may point back at the interactive tool.
7. A `<div class="story">` True story: a real historical or scientific note
   (who, when, what), 3-6 sentences.

Length: 900-1800 words of prose plus the interactives. Longer is fine if every
sentence earns its place.

## Components you can use (all styled in assets/site.css)

- `div.board` with `div.board-head > h3 + span.rules`, then `div.row` rows of
  controls, `div.status` (one-line game status, use innerHTML), `p.note`,
  `div.log`, `div.two` / `div.three` (columns that stack on phones), `div.stack`.
- Buttons: `button.btn` plus `.btn-you` (red), `.btn-robo` (blue), `.btn-math`
  (yellow), `.btn-win` (green), `.btn-sm`, `.btn-big`. Always `type="button"`.
- Segmented control: `<div class="seg" id="x"><button class="on" data-v="a">A</button><button data-v="b">B</button></div>`
  wired with `WM.seg(el, value => ...)`.
- Checkbox: `<label class="chk"><input type="checkbox" id="x"> Label</label>`.
- Number/text inputs inside `<span class="field">Label <input ...></span>`.
- Slider: `<div class="slider"><label class="lab" for="x"><span>Label</span><span class="v" data-for="x">50%</span></label><input type="range" id="x" ...></div>`
  wired with `WM.slider(input, v => text, v => onChange)`.
- Payoff grid: `<div class="scroll"><table class="pay" id="g"></table></div>` and
  `el.innerHTML = WM.grid({rows, cols, pay, signed, rowName, colName}, {clickable, render})`.
  `pay[i][j] = [youPayoff, roboPayoff]`. Cell classes available: `hit`,
  `colhl`, `rowhl`, `best`, `ne`, `no`, `dead`, `win`, `lose`, `tie`.
- Stat tiles: `<div class="stats"><div class="stat"><span class="k">Label</span><span class="v">42</span></div></div>`.
- Data table: `table.data`. Progress bars: `div.bar > i` (`.you`, `.win`).
- Stones: `div.stones > div.stone` (`.gone`, `.magic`). Generic grids: `div.cell-grid > button`.
- Canvas simulations: `<canvas class="sim" width="640" height="360">`; draw with
  theme colors read via `getComputedStyle(document.documentElement).getPropertyValue('--you')`.
- Callouts: `div.math`, `div.idea`, `div.try`, `div.challenge`, `div.story`,
  each starting with `<span class="tag">Label</span>`. `div.proof` with `<ol>`
  for a multi-step proof. `ol.steps` for numbered procedures. `details.reveal`.

Colors: never hard-code a color in chapter CSS or JS except inside a picture
of a real thing (chocolate, cake). Use the CSS variables: `--you`, `--robo`,
`--math`, `--win`, `--p3` (purple), `--p4` (teal) and their `-soft` versions,
`--ink`, `--ink-soft`, `--line`, `--surface`, `--surface-2`, `--paper`, `--grid`.
The site renders in light and dark mode; anything using the variables works in both.

## Game UX contract (every board, no exceptions)

Born 2026-09-20. Peter, about "Share or Grab?", whose rules line said "You pick the row. Robo picks
the column.": "the UI for the games is a little unintuitive. For example for this one you have to
scroll down to pick your choice and that's not really obvious." The grid was inert, and the real
Share / Grab buttons were hidden until two other buttons had been pressed. The reader should never
have to hunt for how to play. `content/chapters/payoff-grids.html` + `assets/ch/payoff-grids.js`
are the reference implementation. `scripts/ux_audit.py` enforces the measurable half of this.

1. **One "your move" strip per interactive board.** Written statically in the HTML, directly after
   `.board-head`:
   `<div class="turn" data-who="you"><span class="turn-tag">Your move</span><span class="turn-text">Click a row in the grid: <b class="you">Share</b> or <b class="you">Grab</b>.</span></div>`
   The first text names the exact first action and the exact thing to act on ("Click a door",
   "Click any empty cell", "Type a bid from 0 to 100 and press Bid", "Drag the slider"). One
   imperative sentence, two at most. Never "scroll down", never "use the controls below".
2. **The strip is the narrator.** Update it on every state change with
   `WM.turn(boardOrAnythingInside, who, html, tag?)`: `you` when it is the reader's turn (say what to
   click), `robo` while Robo thinks or moves, `win` / `lose` for an outcome, `math` for tools with
   no opponent. After an outcome, the same strip says how to go again ("Click a row to play again",
   "Press New game"). Pass `tag` when the default label is wrong for the moment: `'Solved'`,
   `'Not yet'`, `'Result'`, `'Round 3 of 10'`. The strip is sticky, so on a tall board the
   instruction and the result stay on screen. A detailed `.status`, `.log` or `.note` may stay for
   the long version, but the headline lives in the strip, and no board keeps two competing
   "what to do" messages.
3. **Direct manipulation.** The thing the rules line names is the thing you click. If the reader
   picks a row of a payoff grid, the rows are the buttons: `WM.pickRows(table, r => ...)` (call it
   again after each re-render; it returns `{lock, mark, clear}`). Delete the duplicate buttons. Keep
   real buttons only when they are the natural object (Rock / Paper / Scissors hands, Stay /
   Switch), and then they follow rule 4.
4. **Order inside a board:** head, strip, `.controls` row(s), play area, then stats, logs and
   explanations. `.controls` holds setup (who goes first, size, New game) and the move buttons. The
   button that makes something happen never sits underneath a tall play area. In a `.two` layout
   the side column counts as "beside", which is fine on a laptop; put that column first in the DOM
   if its controls must come before the grid on a phone.
5. **Nothing the reader needs is `hidden` at load.** A gated control is visible and `disabled`, and
   the strip says what unlocks it. `hidden` is for explanations that appear after an action.
6. **Fit one laptop screen** (740px tall at 1280 by 800) wherever you can: smaller cells, stats
   beside the play area with `.two`, long explanations moved to the prose under the board or into
   `<details>`. When a board truly cannot fit, rule 4 still holds, and call `WM.reveal(el)` on
   whatever changed so it scrolls into view.
7. **Clickable things look clickable:** a border and drop shadow or a hover fill, `cursor:pointer`,
   reachable by keyboard (a `<button>`, or `tabindex="0"` + `role="button"` + Enter and Space).
   Call `WM.cue(els)` once, at load, on the first thing to click in the chapter's FIRST game only.
   Pulsing on every board is noise.
8. **While Robo thinks,** lock the inputs and set the strip to `robo` ("Robo is thinking..."). Keep
   the race-token pattern from the script section below.
9. **Do not change** game logic, perfect play, the teaching copy in the prose, or the color
   semantics. Star ids stay; a star keeps the same cleverness bar even if the gate that used to
   guard it is gone.

Verify, in this order: `python3 scripts/smoke.py --only <slug>` and again with `--phone`;
`python3 scripts/ux_audit.py --only <slug>` with zero FAIL; then open the board screenshots it
writes to `.scratch/ux/shots/` and look at every one, at load and after a move.

## Chapter script: `assets/ch/<slug>.js`

```js
(function(){
'use strict';
const { $, $$, rand, pick, wait, earn, seg, slider, grid, fmtN, fmtS, fmtNum, frac, fracOf, toast } = WM;
// ... everything for this chapter ...
})();
```

- Vanilla JS only. No libraries. No `alert`/`confirm`/`prompt`.
- The script runs after the DOM is parsed (it is loaded at the end of body).
- Every interactive must be in a sensible resting state on load (a game ready
  to play, a simulation showing a real result), never an empty shell.
- Robo moves after `await wait(600..800)` so the reader sees turns happen.
  Guard against clicks during Robo's turn (a `busy` flag), AND guard against a
  new game starting while Robo is thinking: keep a game id counter, bump it in
  `newGame()`, capture it before the `await`, and bail out after the `await`
  if it changed (`const id = g.id; await wait(700); if (id !== g.id) return;`).
  Without this, changing a setting mid-turn spawns overlapping Robo moves.
- Perfect play must actually be perfect. Compute it (minimax, DP, memoized
  search, exact formula), do not fake it with heuristics. For games too big to
  solve, say so in the prose and use a clearly described method (Monte Carlo
  playouts, for example) and tell the reader what Robo is doing.
- Award stars with `earn('id')`. Keep a hint button where the reader can get
  stuck.
- Reduced motion: `WM.wait` already collapses to 0 when the OS asks for it.
- Keep it robust: clamp inputs, ignore illegal moves, never throw.

## Level calibration: what "9 going on 15" means here

Fine to use without apology: variables, fractions, percentages, exponents,
factorials, remainders and `mod`, binary, coordinates, inequalities (`>`),
expected value as a weighted average, a proof by contradiction, induction
stated as "if it works for n it works for n + 1", probability as area.

Introduce with one sentence of explanation the first time: summation notation,
a two-variable formula, a limit-like idea ("as the number of rounds grows").

Do not use: calculus, matrix multiplication, formal logic symbols, set-builder
notation, Greek letters other than in a "mathematicians write this as" aside.

## Mandatory self-check before you finish

Run the Game UX contract verification above first: smoke, phone smoke, `scripts/ux_audit.py`, then look.

1. `python3 build.py --check` passes.
2. Open `docs/<slug>.html` in a browser (or render it headless) and confirm
   every interactive works, Robo plays correctly, stars fire, nothing throws
   in the console.
3. Re-read your prose once as Garrett. Cut anything that talks down. Cut any
   sentence that is not true.

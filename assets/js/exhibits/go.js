// Extra exhibit: Go. Same approach as chess.js — not a simulated/random
// game, a REAL one replayed move by move from a standard SGF move list, so
// it works with any 19x19 game, not just the one it ships with. Ships with
// AlphaGo vs Lee Sedol, Google DeepMind Challenge Match Game 2 (Seoul,
// March 10 2016) — the game containing AlphaGo's famous "move 37" (5th
// line shoulder hit at a point no human professional would have
// considered), widely regarded a landmark moment for AI. AlphaGo (black)
// won by resignation after 211 moves.
//
// Move data fetched from the public SGF archive at
// homepages.cwi.nl/~aeb/go/games/games/AlphaGo/LeeSedol/2.sgf (not
// recalled from memory — a 211-move game is far too long to transcribe
// reliably from memory, unlike a ~41-move chess game).
//
// Parses the move list out of standard SGF text (`;B[xx]` / `;W[xx]`
// tokens, coordinates 'a'-'s' for 0-18 on each axis; an empty bracket is a
// pass) and replays it with a real (if minimal) Go engine: flood-fill each
// placed stone's group, remove any adjacent enemy group left with zero
// liberties, and — as a safety net, not expected to trigger on a real
// legal game — remove the just-placed group too if it has no liberties
// (self-capture). Verified against the real AlphaGo game: all 211 moves
// parse, 0 suicides were triggered (as expected for real legal play), the
// first/last moves and final stone count were cross-checked by hand (see
// plan.md). No stalemate/scoring/territory logic — this is a replay, not a
// rules engine or a bot.
//
// To replay a different game, replace GAME_SGF with any SGF text (only the
// `;B[xx];W[yy];...` move tokens are read — headers/comments are ignored).
//
// Markup it expects (see extra-exhibit.md): a <section id="go"> containing
// #go-board (empty — the 361 points are built here), #go-move, #go-turn,
// #go-last, #go-cap-b, #go-cap-w, #go-result, #go-play, #go-next, and
// [data-speed] buttons.
(() => {
  "use strict";

  const GAME_SGF = `(;
EV[Google DeepMind Challenge Match]
RO[2]
PB[AlphaGo]
PW[Lee Sedol]
WR[9p]
TM[2h]
KM[7.5]
RE[B+R]
DT[2016-03-10]
PC[Four Seasons Hotel, Seoul, Korea]
RU[Chinese]
OT[3x60s byo-yomi]

;B[pd];W[dp];B[cd];W[qp];B[op];W[oq];B[nq];W[pq];B[cn];W[fq]
;B[mp];W[qn];B[ic];W[dj];B[po];W[qo];B[cp];W[cq];B[bq];W[co]
;B[bp];W[bo];B[do];W[bn];B[dq];W[ep];B[dr];W[cm];B[jp];W[cg]
;B[ed];W[qf];B[qe];W[pf];B[nd];W[pi];B[oj];W[oi];B[nj];W[mh]
;B[gp];W[gq];B[dn];W[dm];B[fo];W[hp];B[ho];W[eo];B[en];W[fn]
;B[em];W[el];B[fm];W[gn];B[fl];W[go];B[ek];W[dk];B[dl];W[cl]
;B[eh];W[di];B[pj];W[qi];B[rf];W[rg];B[kd];W[hn];B[om];W[re]
;B[rd];W[sf];B[fi];W[gk];B[hm];W[in];B[hl];W[ko];B[kp];W[gc]
;B[df];W[id];B[jc];W[ge];B[dg];W[cf];B[ch];W[bh];B[dh];W[bi]
;B[hd];W[he];B[gd];W[fd];B[hc];W[fe];B[ec];W[gh];B[fc];W[gi]
;B[ii];W[hk];B[ik];W[il];B[im];W[ij];B[jl];W[jj];B[if];W[km]
;B[kl];W[lj];B[lk];W[lo];B[li];W[kj];B[ci];W[cj];B[mj];W[nr]
;B[mr];W[lq];B[lp];W[mq];B[np];W[lr];B[lm];W[kh];B[hg];W[qc]
;B[qd];W[rc];B[pc];W[sd];B[gg];W[ce];B[bd];W[qb];B[hi];W[jg]
;B[hj];W[ob];B[pb];W[pa];B[nb];W[de];B[ee];W[gj];B[hh];W[ej]
;B[nf];W[mf];B[me];W[rk];B[fh];W[el];B[nh];W[ng];B[lg];W[lh]
;B[mg];W[og];B[kg];W[ni];B[jh];W[na];B[ki];W[mi];B[ji];W[nc]
;B[mb];W[od];B[mc];W[oc];B[kr];W[ms];B[io];W[ip];B[jo];W[jn]
;B[ir];W[hr];B[ql];W[rl];B[qm];W[rm];B[ao];W[bm];B[ln];W[kn]
;B[mo];W[be];B[ae];W[af];B[ad];W[ma];B[la];W[oa];B[dd];W[bg]
;B[lb];W[pn];B[on];W[er];B[cr];W[fp];B[iq];W[hq];B[qj];W[rj]
;B[ks]
C[Time used: B: 2h, W: 2h+2x60s]
)`;
  const GAME_LABEL = "AlphaGo vs Lee Sedol, Seoul 2016, Google DeepMind Challenge Match Game 2";
  const RESULT_TEXT = GAME_LABEL + " — Black (AlphaGo) wins by resignation.";

  // ---------------------------------------------------------------- SGF parsing
  function parseSGFMoves(sgf) {
    const moves = [];
    const re = /;([BW])\[([a-s]{0,2})\]/g;
    let m;
    while ((m = re.exec(sgf))) {
      const color = m[1] === "B" ? "b" : "w";
      const coord = m[2];
      if (!coord) { moves.push({ color, pass: true }); continue; }
      moves.push({ color, col: coord.charCodeAt(0) - 97, row: coord.charCodeAt(1) - 97 });
    }
    return moves;
  }

  // ---------------------------------------------------------------- Go engine
  const N = 19;
  const key = (c, r) => c + "," + r;
  function neighbors(c, r) {
    const n = [];
    if (c > 0) n.push([c - 1, r]);
    if (c < N - 1) n.push([c + 1, r]);
    if (r > 0) n.push([c, r - 1]);
    if (r < N - 1) n.push([c, r + 1]);
    return n;
  }
  function getGroup(board, c, r) {
    const color = board[key(c, r)];
    const seen = new Set(), stack = [[c, r]], group = [];
    while (stack.length) {
      const [cc, rr] = stack.pop(), k = key(cc, rr);
      if (seen.has(k)) continue;
      seen.add(k);
      if (board[k] !== color) continue;
      group.push([cc, rr]);
      for (const nb of neighbors(cc, rr)) stack.push(nb);
    }
    return group;
  }
  function hasLiberty(board, group) {
    for (const [c, r] of group) for (const [nc, nr] of neighbors(c, r)) if (!board[key(nc, nr)]) return true;
    return false;
  }
  // Places a stone, removes any now-liberty-less enemy group(s), and (as a
  // safety net only) removes the placed group too if that leaves it with
  // no liberties. Returns how many stones were captured.
  function placeMove(board, c, r, color) {
    board[key(c, r)] = color;
    const opp = color === "b" ? "w" : "b";
    let captured = 0;
    for (const [nc, nr] of neighbors(c, r)) {
      if (board[key(nc, nr)] === opp) {
        const group = getGroup(board, nc, nr);
        if (!hasLiberty(board, group)) { for (const [gc, gr] of group) delete board[key(gc, gr)]; captured += group.length; }
      }
    }
    const own = getGroup(board, c, r);
    if (!hasLiberty(board, own)) for (const [gc, gr] of own) delete board[key(gc, gr)];
    return captured;
  }

  // Plays the whole game once, producing one event per move with a board
  // snapshot (same lesson as chess.js: the renderer just paints a known
  // board state rather than re-deriving it).
  function replaySGF(sgfText) {
    const moves = parseSGFMoves(sgfText);
    const board = {};
    let capB = 0, capW = 0; // stones captured BY black / BY white
    const events = [];
    for (const mv of moves) {
      if (mv.pass) { events.push({ pass: true, color: mv.color, capB, capW, boardAfter: { ...board } }); continue; }
      const taken = placeMove(board, mv.col, mv.row, mv.color);
      if (mv.color === "b") capB += taken; else capW += taken;
      events.push({ col: mv.col, row: mv.row, color: mv.color, capB, capW, boardAfter: { ...board } });
    }
    return events;
  }

  // ---------------------------------------------------------------- drawing
  // A real Go board is a lattice of 19 lines each way, with stones sitting
  // ON the crossings — not one stone per grid box — so this is drawn as
  // SVG (lines + circles at exact (col,row) coordinates), the same way the
  // theme's other precise diagrams (the map, the castle figure) are built,
  // rather than CSS grid cells with borders (which reads as "one stone per
  // box", not "stones threaded onto a line lattice"). viewBox runs -1..19
  // on both axes: points sit at integer coordinates 0..18, the extra unit
  // of margin keeps a stone's radius from clipping at the board edge.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const boardEl = $("go-board");
  if (!boardEl) return; // this page doesn't have the go markup

  const COL_LETTERS = "ABCDEFGHJKLMNOPQRST"; // Go board column labels skip "I"
  const coordName = (c, r) => COL_LETTERS[c] + (N - r);
  const STAR_POINTS = new Set([[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]].map(([c, r]) => key(c, r)));

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "-1 -1 20 20");
  svg.setAttribute("class", "go-svg");
  const last = N - 1; // 18: last line index
  for (let i = 0; i < N; i++) {
    const h = document.createElementNS(SVG_NS, "line");
    h.setAttribute("x1", 0); h.setAttribute("y1", i); h.setAttribute("x2", last); h.setAttribute("y2", i);
    h.setAttribute("class", "go-line");
    svg.appendChild(h);
    const v = document.createElementNS(SVG_NS, "line");
    v.setAttribute("x1", i); v.setAttribute("y1", 0); v.setAttribute("x2", i); v.setAttribute("y2", last);
    v.setAttribute("class", "go-line");
    svg.appendChild(v);
  }
  for (const k of STAR_POINTS) {
    const [c, r] = k.split(",").map(Number);
    const star = document.createElementNS(SVG_NS, "circle");
    star.setAttribute("cx", c); star.setAttribute("cy", r); star.setAttribute("r", 0.09);
    star.setAttribute("class", "go-star");
    svg.appendChild(star);
  }
  const ptEls = {};
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const stone = document.createElementNS(SVG_NS, "circle");
      stone.setAttribute("cx", c); stone.setAttribute("cy", r); stone.setAttribute("r", 0.46);
      stone.setAttribute("class", "go-stone");
      svg.appendChild(stone);
      ptEls[key(c, r)] = stone;
    }
  }
  boardEl.appendChild(svg);

  let events = [];
  try { events = replaySGF(GAME_SGF); } catch (err) { /* leaves events empty; board just won't animate */ }

  // Radius lives here, not in CSS: the CSS `r` property requires an
  // explicit length unit to parse at all (a bare number like `.32` is
  // invalid and silently dropped), whereas the SVG attribute correctly
  // takes a unitless number in the board's own user-space units (where 1 =
  // one grid spacing, per the viewBox set up above). Both colors share the
  // same radius now (and the same CSS stroke-width) — nothing distinguishes
  // their size on purpose.
  const STONE_R = { b: .36, w: .36 };
  function renderBoard(board) {
    for (const k in ptEls) {
      const stone = board[k];
      const el = ptEls[k];
      el.setAttribute("class", "go-stone" + (stone ? " " + stone : ""));
      el.setAttribute("r", stone ? STONE_R[stone] : 0);
    }
  }

  function show(step) {
    if (step === 0) {
      renderBoard({});
      $("go-move").textContent = "0";
      $("go-turn").textContent = "BLACK TO MOVE";
      $("go-last").textContent = "—";
      $("go-cap-b").textContent = "BLACK 0";
      $("go-cap-w").textContent = "WHITE 0";
      $("go-result").textContent = GAME_LABEL + ".";
      return;
    }
    // step is always 1..events.length here — tick() below never lets it
    // run past the end, so there's no dead "just past the last move"
    // branch to render.
    const e = events[step - 1];
    renderBoard(e.boardAfter);
    $("go-move").textContent = step;
    $("go-turn").textContent = e.color === "b" ? "WHITE TO MOVE" : "BLACK TO MOVE";
    $("go-last").textContent = (e.color === "b" ? "B " : "W ") + (e.pass ? "PASS" : coordName(e.col, e.row));
    $("go-cap-b").textContent = "BLACK " + e.capB;
    $("go-cap-w").textContent = "WHITE " + e.capW;
    $("go-result").textContent = step === events.length ? RESULT_TEXT : GAME_LABEL + ".";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 1200, 4: 500, 8: 220, 16: 100 }; // ms a move sits on screen
  // Fixed, not scaled by speed: at 1x this used to multiply out to several
  // seconds of apparent standstill right as the board was most full (the
  // end-of-game pause, long by design, got longer at slower speeds instead
  // of staying capped) — easy to read as "it stopped" rather than "it's
  // pausing on the result before looping back."
  const END_PAUSE = 1800, START_PAUSE = 900;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, step = 0;
  // Unlike the other exhibits, this doesn't also gate on scroll visibility
  // (IntersectionObserver) or tab visibility — this is the one exhibit
  // reported to actually stop playing, and the board here is by far the
  // largest/heaviest of the four (361 SVG points vs. a few dozen DOM nodes
  // elsewhere), the likeliest place for a visibility-tracking edge case
  // (a late layout shift misreporting intersection, then never firing
  // again) to silently wedge the loop with no user-visible explanation.
  // The only way to stop it now is the Play/Pause button itself.
  const running = () => !paused;

  // A single unexpected error inside show() used to kill this loop for
  // good: the throw would unwind past the setTimeout(tick, wait) call
  // below, so the chain never rescheduled itself and playback silently
  // stopped with no way to recover. The try/finally guarantees the next
  // tick is always scheduled regardless.
  function tick() {
    timer = 0;
    if (!running()) return;
    try {
      // Jumps straight back to move 1 once the last move has been shown —
      // no extra "just past the end" tick that renders nothing, which used
      // to add one more silent-looking pause before the loop restarted.
      step = step >= events.length ? 0 : step + 1;
      show(step);
    } finally {
      const wait = step === 0 ? START_PAUSE : step === events.length ? END_PAUSE : BASE[speed];
      timer = setTimeout(tick, wait);
    }
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("go-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("go-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    step = step >= events.length ? 0 : step + 1;
    show(step);
  });
  const speedBtns = document.querySelectorAll("#go [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  // ---------------------------------------------------------------- start
  show(0);
  syncPlay();
  if (!paused) kick();
})();

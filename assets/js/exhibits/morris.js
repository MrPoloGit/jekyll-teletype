// Extra exhibit: Nine Men's Morris. Two simulated bots play the full game
// on the traditional board — three nested squares (24 points total), each
// side's 4 corners and 4 edge-midpoints joined around the ring, and the
// midpoints additionally joined straight across to the matching midpoint
// of the next ring in (corners never get a radial line). That's 32 edges
// and 16 possible "mills" (3 points in an unbroken line): 12 running around
// the rings (4 sides x 3 rings) and 4 running radially through the
// midpoints.
//
// Real rules, both phases: PLACEMENT — each side places all 9 of its
// pieces one at a time, alternating; completing a mill lets you remove one
// of the opponent's pieces (any piece not currently part of one of *their*
// mills, unless every piece they have is in a mill, in which case any
// piece is fair game). MOVEMENT — once all 18 pieces are down, each turn
// you slide one piece to an empty point directly connected to it (mills
// still remove a piece the same way); a side reduced to exactly 3 pieces
// is allowed to "fly" — move to ANY empty point, not just an adjacent one.
// A side wins by reducing the opponent below 3 pieces, or by leaving them
// with no legal move at all on their turn.
//
// Bot play is NOT real strategy, same honesty convention as every other
// exhibit's bot logic: in both phases it's win-now (complete a mill) >
// block-now (deny the opponent a point that would complete THEIR mill) >
// random legal choice. No lookahead beyond one ply, no evaluation of
// board structure.
//
// Markup it expects (see extra-exhibits.md): a <section id="mr"> containing
// #mr-board (empty — built here), #mr-turn, #mr-side, #mr-result,
// #mr-play, #mr-back, #mr-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- board topology
  // ring 0 = outer square, ring 1 = middle, ring 2 = inner. Within a ring,
  // pos 0/2/4/6 are corners and 1/3/5/7 are side-midpoints (the only points
  // that get a radial edge to the next ring in).
  const idx = (ring, pos) => ring * 8 + pos;
  const COORD = [
    { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 3 },
    { x: 6, y: 6 }, { x: 3, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 3 },
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 3 },
    { x: 5, y: 5 }, { x: 3, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 3 },
    { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 },
    { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 },
  ];
  const MILLS = [
    [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
    [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
    [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
    [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23],
  ];
  const EDGES = [];
  const ADJ = Array.from({ length: 24 }, () => new Set());
  function addEdge(a, b) { ADJ[a].add(b); ADJ[b].add(a); EDGES.push([a, b]); }
  for (let ring = 0; ring < 3; ring++) for (let pos = 0; pos < 8; pos++) addEdge(idx(ring, pos), idx(ring, (pos + 1) % 8));
  for (const pos of [1, 3, 5, 7]) { addEdge(idx(0, pos), idx(1, pos)); addEdge(idx(1, pos), idx(2, pos)); }
  const MILLS_AT = Array.from({ length: 24 }, () => []);
  MILLS.forEach((m, mi) => m.forEach(p => MILLS_AT[p].push(mi)));

  const other = s => (s === "b" ? "w" : "b");
  function isMillAt(board, p, side) {
    for (const mi of MILLS_AT[p]) if (MILLS[mi].every(q => board[q] === side)) return true;
    return false;
  }

  // ---------------------------------------------------------------- game state
  let board, placed, counts, phase, activeSide, turnNo, gameNo;
  function resetGame() {
    board = new Array(24).fill(null);
    placed = { b: 0, w: 0 };
    counts = { b: 9, w: 9 };
    phase = "place";
    activeSide = "b";
    turnNo = 0;
    gameNo = (gameNo || 0) + 1;
  }
  resetGame();

  function emptyPoints() { const out = []; for (let i = 0; i < 24; i++) if (!board[i]) out.push(i); return out; }
  function sidePoints(side) { const out = []; for (let i = 0; i < 24; i++) if (board[i] === side) out.push(i); return out; }
  function isFlying(side) { return phase === "move" && counts[side] === 3; }
  function legalDestinations(from, side) {
    if (isFlying(side)) return emptyPoints();
    return [...ADJ[from]].filter(p => !board[p]);
  }
  function removablePieces(side) {
    const pts = sidePoints(side);
    const nonMill = pts.filter(p => !isMillAt(board, p, side));
    return nonMill.length ? nonMill : pts; // if every piece is in a mill, any can be taken
  }
  function chooseRemoval(side) {
    const options = removablePieces(side);
    return options[(Math.random() * options.length) | 0];
  }

  // ---- bot move selection: win (complete a mill) > block (deny the opponent one) > random ----
  function choosePlacement(side) {
    const empties = emptyPoints();
    const wins = empties.filter(p => { board[p] = side; const r = isMillAt(board, p, side); board[p] = null; return r; });
    if (wins.length) return wins[(Math.random() * wins.length) | 0];
    const opp = other(side);
    const blocks = empties.filter(p => { board[p] = opp; const r = isMillAt(board, p, opp); board[p] = null; return r; });
    if (blocks.length) return blocks[(Math.random() * blocks.length) | 0];
    return empties[(Math.random() * empties.length) | 0];
  }
  function chooseMove(side) {
    const pts = sidePoints(side);
    const moves = [];
    for (const from of pts) for (const to of legalDestinations(from, side)) moves.push({ from, to });
    if (!moves.length) return null;
    const wins = moves.filter(({ from, to }) => {
      board[from] = null; board[to] = side;
      const r = isMillAt(board, to, side);
      board[to] = null; board[from] = side;
      return r;
    });
    if (wins.length) return wins[(Math.random() * wins.length) | 0];
    const opp = other(side);
    const oppThreats = new Set();
    for (const p of emptyPoints()) { board[p] = opp; if (isMillAt(board, p, opp)) oppThreats.add(p); board[p] = null; }
    const blocks = moves.filter(({ to }) => oppThreats.has(to));
    if (blocks.length) return blocks[(Math.random() * blocks.length) | 0];
    return moves[(Math.random() * moves.length) | 0];
  }

  // One placement or slide = one turn. `actedPhase` is captured before the
  // placement -> movement transition check below, so the turn that places
  // the 18th piece is still correctly labeled "place" instead of getting
  // relabeled "move" a half-step early.
  function playTurn() {
    turnNo++;
    const side = activeSide;
    const actedPhase = phase;
    let fromPt = null, toPt, milled;

    if (actedPhase === "place") {
      toPt = choosePlacement(side);
      board[toPt] = side;
      placed[side]++;
      milled = isMillAt(board, toPt, side);
    } else {
      const mv = chooseMove(side);
      if (!mv) {
        const e = { type: "gameover", turnNo, winner: other(side), reason: "no legal moves", board: [...board], gameNo };
        resetGame();
        return [e];
      }
      board[mv.from] = null; board[mv.to] = side;
      fromPt = mv.from; toPt = mv.to;
      milled = isMillAt(board, toPt, side);
    }

    let removedPoint = null;
    if (milled) {
      removedPoint = chooseRemoval(other(side));
      board[removedPoint] = null;
      counts[other(side)]--;
    }

    if (phase === "place" && placed.b === 9 && placed.w === 9) phase = "move";

    const snapshot = [...board];
    const event = {
      type: "turn", turnNo, side, phase: actedPhase, fromPt, toPt, milled, removedPoint,
      countB: counts.b, countW: counts.w, board: snapshot, gameNo,
    };
    const out = [event];
    activeSide = other(side);

    if (phase === "move" && counts[activeSide] < 3) {
      out.push({ type: "gameover", turnNo, winner: side, reason: "reduced below 3 pieces", board: snapshot, gameNo });
      resetGame();
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  const SVG_NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const boardEl = $("mr-board");
  if (!boardEl) return; // this page doesn't have the Nine Men's Morris markup

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "-1 -1 8 8");
  svg.setAttribute("class", "mr-svg");
  for (const [a, b] of EDGES) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", COORD[a].x); line.setAttribute("y1", COORD[a].y);
    line.setAttribute("x2", COORD[b].x); line.setAttribute("y2", COORD[b].y);
    line.setAttribute("class", "mr-line");
    svg.appendChild(line);
  }
  const ptEls = [];
  for (let p = 0; p < 24; p++) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", COORD[p].x); c.setAttribute("cy", COORD[p].y); c.setAttribute("r", .35);
    c.setAttribute("class", "mr-pt");
    svg.appendChild(c);
    ptEls.push(c);
  }
  boardEl.appendChild(svg);

  function renderBoard(snapshot) {
    for (let p = 0; p < 24; p++) {
      const side = snapshot[p];
      ptEls[p].setAttribute("class", "mr-pt" + (side ? " " + side : ""));
    }
  }

  const PHASE_WORD = { place: "PLACEMENT", move: "MOVEMENT" };
  function show(e) {
    renderBoard(e.board);
    for (const el of ptEls) el.classList.remove("last", "from", "removed", "mill");
    if (e.type === "gameover") {
      $("mr-turn").textContent = e.turnNo;
      $("mr-side").textContent = "GAME OVER";
      $("mr-result").textContent = `Game #${e.gameNo - 1}: ` +
        (e.winner === "b" ? "Black" : "White") + " wins — " + e.reason + ". Resetting into a new game.";
      return;
    }
    if (e.fromPt != null) ptEls[e.fromPt].classList.add("from");
    ptEls[e.toPt].classList.add("last");
    if (e.milled && e.removedPoint != null) ptEls[e.removedPoint].classList.add("removed");
    if (e.milled) for (const mi of MILLS_AT[e.toPt]) if (MILLS[mi].every(q => e.board[q] === e.side)) MILLS[mi].forEach(q => ptEls[q].classList.add("mill"));
    $("mr-turn").textContent = e.turnNo;
    const name = e.side === "b" ? "BLACK" : "WHITE";
    // Derived from this event's own snapshot counts, not the live game
    // state — matters when replaying history with Back, which must not
    // depend on anything that keeps changing after the event happened.
    const sideCount = e.side === "b" ? e.countB : e.countW;
    const flying = e.phase === "move" && sideCount === 3 ? " (FLYING)" : "";
    $("mr-side").textContent = PHASE_WORD[e.phase] + " — " + name + (e.fromPt == null ? " PLACED" : " MOVED") + flying;
    $("mr-result").textContent = e.milled
      ? name + " formed a mill and removed an opponent piece."
      : "Nine Men's Morris, simple win/block lookahead, two bots. " + e.countB + " black, " + e.countW + " white on the board.";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 900, 4: 400, 8: 200, 16: 90 }; // ms a turn sits on screen
  const GAMEOVER_PAUSE = 2200;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, queue = [], qi = 0;
  const running = () => !paused;

  function next() {
    if (qi >= queue.length) { queue = playTurn(); qi = 0; }
    return queue[qi++];
  }
  // Same history pattern as mahjong.js/wizard.js/checkers.js/gomoku.js/blackjack.js.
  let history = [], historyIndex = -1;
  function advance() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
    } else {
      history.push(next());
      if (history.length > 800) { history.shift(); historyIndex--; }
      historyIndex = history.length - 1;
    }
    return history[historyIndex];
  }

  function tick() {
    timer = 0;
    if (!running()) return;
    const e = advance();
    show(e);
    timer = setTimeout(tick, e.type === "gameover" ? GAMEOVER_PAUSE : BASE[speed]);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("mr-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("mr-back").addEventListener("click", () => {
    if (historyIndex <= 0) return;
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    show(history[historyIndex]);
  });
  $("mr-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#mr [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));

  // ---------------------------------------------------------------- start
  $("mr-turn").textContent = "0";
  $("mr-side").textContent = "PLACEMENT — BLACK TO MOVE";
  $("mr-result").textContent = "Nine Men's Morris, simple win/block lookahead, two bots. 9 black, 9 white in reserve.";
  syncPlay();
  if (!paused) kick();
})();

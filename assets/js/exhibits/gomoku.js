// Extra exhibit: Gomoku (Five in a Row). Two simulated bots take turns
// placing a stone on a 15x15 lattice — same board rendering approach as
// go.js (lines + stones centered on intersections, not CSS grid boxes),
// much simpler rules: whoever gets 5+ of their own stones in an unbroken
// row (any of the 4 directions: horizontal, vertical, either diagonal)
// wins immediately. No captures, no liberties, no groups — just placement
// and a win-check. If the board fills with no winner, it's a draw. Either
// way the board resets into a new game, looping forever like every other
// exhibit here.
//
// Bot move choice is NOT real strategy, same honesty convention as every
// other exhibit's bot logic, but includes a little lookahead so games
// actually resolve into visible patterns rather than 225 cells of uniform
// noise: (1) if any empty cell completes 5 in a row right now, play it and
// win; (2) else if the opponent has such a cell, block it; (3) else play a
// random empty cell within 2 squares of an existing stone (so stones
// cluster instead of scattering edge to edge); (4) the very first move of
// a game is always the center point. That's the entire "AI" — no deeper
// search, no evaluation function.
//
// Markup it expects (see extra-exhibits.md): a <section id="gm"> containing
// #gm-board (empty — built here), #gm-move, #gm-side, #gm-result,
// #gm-play, #gm-back, #gm-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- rules engine
  const N = 15; // standard Gomoku board size (distinct from Go's 19x19)
  const key = (r, c) => r + "," + c;
  const other = s => (s === "b" ? "w" : "b");
  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function lineLength(board, r, c, side, dr, dc) {
    let len = 1, rr = r + dr, cc = c + dc;
    while (inB(rr, cc) && board[key(rr, cc)] === side) { len++; rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inB(rr, cc) && board[key(rr, cc)] === side) { len++; rr -= dr; cc -= dc; }
    return len;
  }
  // Returns the winning direction [dr,dc] if the stone just placed at
  // (r,c) completes 5+ in a row, else null.
  function winningDirAt(board, r, c, side) {
    for (const [dr, dc] of DIRS) if (lineLength(board, r, c, side, dr, dc) >= 5) return [dr, dc];
    return null;
  }
  function wouldWin(board, r, c, side) {
    return !!winningDirAt({ ...board, [key(r, c)]: side }, r, c, side);
  }
  // The 5 (or more) cells making up the winning line, for highlighting —
  // walks outward from (r,c) along the winning direction.
  function winningCells(board, r, c, side, dir) {
    const [dr, dc] = dir, cells = [{ r, c }];
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc) && board[key(rr, cc)] === side) { cells.push({ r: rr, c: cc }); rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (inB(rr, cc) && board[key(rr, cc)] === side) { cells.push({ r: rr, c: cc }); rr -= dr; cc -= dc; }
    return cells;
  }

  // ---------------------------------------------------------------- game state
  let board, turnNo, activeSide, gameNo, moveCount;
  function resetGame() {
    board = {};
    turnNo = 0;
    activeSide = "b";
    moveCount = 0;
    gameNo = (gameNo || 0) + 1;
  }
  resetGame();

  function emptyCells() {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!board[key(r, c)]) out.push({ r, c });
    return out;
  }
  function emptyNearStones(radius) {
    const set = new Set();
    for (const k in board) {
      const [r, c] = k.split(",").map(Number);
      for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
        const rr = r + dr, cc = c + dc;
        if (inB(rr, cc) && !board[key(rr, cc)]) set.add(key(rr, cc));
      }
    }
    return [...set].map(k => { const [r, c] = k.split(",").map(Number); return { r, c }; });
  }
  function chooseMove(side) {
    if (moveCount === 0) return { r: (N / 2) | 0, c: (N / 2) | 0 };
    const empties = emptyCells();
    const winNow = empties.filter(({ r, c }) => wouldWin(board, r, c, side));
    if (winNow.length) return winNow[(Math.random() * winNow.length) | 0];
    const blockNow = empties.filter(({ r, c }) => wouldWin(board, r, c, other(side)));
    if (blockNow.length) return blockNow[(Math.random() * blockNow.length) | 0];
    const near = emptyNearStones(2);
    const pool = near.length ? near : empties;
    return pool[(Math.random() * pool.length) | 0];
  }

  // One stone placed = one turn. Returns a "turn" event, plus a
  // "gameover" (and immediate reset) if that stone won or filled the board.
  function playTurn() {
    turnNo++;
    const side = activeSide;
    const { r, c } = chooseMove(side);
    board[key(r, c)] = side;
    moveCount++;
    const winDir = winningDirAt(board, r, c, side);
    const full = moveCount >= N * N;
    const snapshot = { ...board };
    activeSide = other(side);
    const event = {
      type: "turn", turnNo, side, r, c, win: !!winDir,
      winCells: winDir ? winningCells(board, r, c, side, winDir) : null,
      draw: !winDir && full, board: snapshot, gameNo,
    };
    const out = [event];
    if (winDir || full) {
      out.push({ type: "gameover", turnNo, winner: winDir ? side : null, board: snapshot, gameNo });
      resetGame();
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  const SVG_NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const boardEl = $("gm-board");
  if (!boardEl) return; // this page doesn't have the gomoku markup

  // Points run 0..N-1, so the viewBox needs width/height N+1 (not N) to put
  // an equal 1-unit margin on every side — go.js gets this right (19
  // points, viewBox width 20); this file originally copied the "-1 -1"
  // offset but not the "+1" width, so the lattice had a margin on its
  // top/left but none on its bottom/right, shoving the whole board toward
  // the top-left of its frame instead of centering it.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "-1 -1 " + (N + 1) + " " + (N + 1));
  svg.setAttribute("class", "gm-svg");
  const last = N - 1;
  for (let i = 0; i < N; i++) {
    const h = document.createElementNS(SVG_NS, "line");
    h.setAttribute("x1", 0); h.setAttribute("y1", i); h.setAttribute("x2", last); h.setAttribute("y2", i);
    h.setAttribute("class", "gm-line");
    svg.appendChild(h);
    const v = document.createElementNS(SVG_NS, "line");
    v.setAttribute("x1", i); v.setAttribute("y1", 0); v.setAttribute("x2", i); v.setAttribute("y2", last);
    v.setAttribute("class", "gm-line");
    svg.appendChild(v);
  }
  // Tengen (center point) marker, the one star point traditionally marked
  // on a Gomoku board.
  const center = document.createElementNS(SVG_NS, "circle");
  center.setAttribute("cx", (N - 1) / 2); center.setAttribute("cy", (N - 1) / 2); center.setAttribute("r", .09);
  center.setAttribute("class", "gm-star");
  svg.appendChild(center);

  const ptEls = {};
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const stone = document.createElementNS(SVG_NS, "circle");
      stone.setAttribute("cx", c); stone.setAttribute("cy", r); stone.setAttribute("r", .4);
      stone.setAttribute("class", "gm-stone");
      svg.appendChild(stone);
      ptEls[key(r, c)] = stone;
    }
  }
  boardEl.appendChild(svg);

  function renderBoard(snapshot) {
    for (const k in ptEls) {
      const side = snapshot[k];
      ptEls[k].setAttribute("class", "gm-stone" + (side ? " " + side : ""));
    }
  }

  function show(e) {
    if (e.type === "gameover") {
      renderBoard(e.board);
      $("gm-move").textContent = e.turnNo;
      $("gm-side").textContent = "GAME OVER";
      $("gm-result").textContent = `Game #${e.gameNo - 1}: ` +
        (e.winner ? (e.winner === "b" ? "Black" : "White") + " wins, 5 in a row." : "board filled, a draw.") +
        " Reshuffling into a new game.";
      return;
    }
    renderBoard(e.board);
    for (const k in ptEls) ptEls[k].classList.remove("last", "win");
    const lastEl = ptEls[key(e.r, e.c)];
    if (lastEl) lastEl.classList.add("last");
    if (e.winCells) for (const { r, c } of e.winCells) { const el = ptEls[key(r, c)]; if (el) el.classList.add("win"); }
    $("gm-move").textContent = e.turnNo;
    $("gm-side").textContent = (e.side === "b" ? "WHITE" : "BLACK") + " TO MOVE";
    $("gm-result").textContent = e.win
      ? (e.side === "b" ? "Black" : "White") + " just completed 5 in a row."
      : "Gomoku (Five in a Row), simple block/win lookahead, two bots.";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 900, 4: 400, 8: 200, 16: 90 }; // ms a move sits on screen
  const GAMEOVER_PAUSE = 2200;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, queue = [], qi = 0;
  const running = () => !paused;

  function next() {
    if (qi >= queue.length) { queue = playTurn(); qi = 0; }
    return queue[qi++];
  }
  // Same history pattern as mahjong.js/wizard.js/checkers.js.
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

  const playBtn = $("gm-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("gm-back").addEventListener("click", () => {
    if (historyIndex <= 0) return;
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    show(history[historyIndex]);
  });
  $("gm-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#gm [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));

  // ---------------------------------------------------------------- start
  $("gm-move").textContent = "0";
  $("gm-side").textContent = "BLACK TO MOVE";
  $("gm-result").textContent = "Gomoku (Five in a Row), simple block/win lookahead, two bots.";
  syncPlay();
  if (!paused) kick();
})();

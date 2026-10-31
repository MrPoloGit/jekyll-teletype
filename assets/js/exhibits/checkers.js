// Extra exhibit: checkers (English draughts). Two simulated bots play on a
// standard 8x8 board, 12 pieces each, starting on the dark squares of their
// own 3 back rows. Standard rules: diagonal moves only, forward for a man
// and both ways for a king; captures are MANDATORY whenever available, and
// a capturing piece must keep jumping as long as another capture is
// immediately available (multi-jump chains); a man promotes to a king the
// moment it lands on the opponent's back row. A side with no legal move on
// its turn (no pieces left, or every piece blocked) loses; the board then
// resets into a new game, looping forever like every other exhibit here.
//
// Bot move choice is NOT real strategy, same honesty convention as every
// other exhibit's bot logic: if a capture is available (mandatory), pick
// one of the available capture sequences at random, including which branch
// to take at each multi-jump fork — not "pick the longest" or any other
// heuristic, just a legal random choice among forced captures. Otherwise
// pick uniformly among all legal non-capture moves.
//
// Markup it expects (see extra-exhibits.md): a <section id="ck"> containing
// #ck-board (empty — the 64 squares are built here), #ck-turn, #ck-side,
// #ck-move, #ck-count-b, #ck-count-w, #ck-result, #ck-play, #ck-back,
// #ck-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- rules engine
  const N = 8;
  const isDark = (r, c) => (r + c) % 2 === 1;
  const key = (r, c) => r + "," + c;
  const other = s => (s === "b" ? "w" : "b");
  const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

  function initialBoard() {
    const b = {};
    for (let r = 0; r < 3; r++) for (let c = 0; c < N; c++) if (isDark(r, c)) b[key(r, c)] = { side: "b", king: false };
    for (let r = 5; r < N; r++) for (let c = 0; c < N; c++) if (isDark(r, c)) b[key(r, c)] = { side: "w", king: false };
    return b;
  }
  // "b" starts on rows 0-2 and moves toward row 7 (down); "w" starts on
  // rows 5-7 and moves toward row 0 (up). Kings move every diagonal.
  function dirsFor(side, king) {
    if (king) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    return side === "b" ? [[1, 1], [1, -1]] : [[-1, 1], [-1, -1]];
  }
  function simpleMovesFrom(board, r, c, side, king) {
    const out = [];
    for (const [dr, dc] of dirsFor(side, king)) {
      const tr = r + dr, tc = c + dc;
      if (inB(tr, tc) && !board[key(tr, tc)]) out.push({ toR: tr, toC: tc });
    }
    return out;
  }
  function captureJumpsFrom(board, r, c, side, king) {
    const out = [];
    for (const [dr, dc] of dirsFor(side, king)) {
      const er = r + dr, ec = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
      if (!inB(tr, tc)) continue;
      const enemy = board[key(er, ec)];
      if (enemy && enemy.side !== side && !board[key(tr, tc)]) out.push({ toR: tr, toC: tc, capR: er, capC: ec });
    }
    return out;
  }
  function withoutCaptured(board, removedKeys) {
    if (!removedKeys.length) return board;
    const copy = { ...board };
    for (const k of removedKeys) delete copy[k];
    return copy;
  }
  // Recursively finds every maximal capture sequence from one piece —
  // "maximal" meaning it keeps jumping until no further jump is available,
  // per the mandatory-multi-jump rule, but explores every branch where the
  // piece has a choice of which direction to continue in.
  function capSequencesFrom(board, r, c, king, side, path, captured) {
    const jumps = captureJumpsFrom(withoutCaptured(board, captured), r, c, side, king);
    if (!jumps.length) return path.length ? [{ path, captured }] : [];
    const out = [];
    for (const j of jumps) {
      out.push(...capSequencesFrom(board, j.toR, j.toC, king, side,
        [...path, { toR: j.toR, toC: j.toC }], [...captured, key(j.capR, j.capC)]));
    }
    return out;
  }
  function allCaptureSequencesForSide(board, side) {
    const seqs = [];
    for (const k in board) {
      const [r, c] = k.split(",").map(Number);
      const p = board[k];
      if (p.side !== side) continue;
      for (const s of capSequencesFrom(board, r, c, p.king, side, [], [])) seqs.push({ fromR: r, fromC: c, ...s });
    }
    return seqs;
  }
  function allSimpleMovesForSide(board, side) {
    const moves = [];
    for (const k in board) {
      const [r, c] = k.split(",").map(Number);
      const p = board[k];
      if (p.side !== side) continue;
      for (const m of simpleMovesFrom(board, r, c, side, p.king)) moves.push({ fromR: r, fromC: c, toR: m.toR, toC: m.toC });
    }
    return moves;
  }

  // ---------------------------------------------------------------- game state
  let board, turnNo, activeSide, gameNo;
  function resetGame() {
    board = initialBoard();
    turnNo = 0;
    activeSide = "b";
    gameNo = (gameNo || 0) + 1;
  }
  resetGame();

  // One full turn: a mandatory capture sequence if any piece has one
  // available, otherwise a random simple move. Returns 1 or 2 events — a
  // "turn" event, plus a "gameover" (and immediate reset) if this side had
  // no legal move at all.
  function playTurn() {
    turnNo++;
    const side = activeSide;
    const caps = allCaptureSequencesForSide(board, side);
    let kind, fromR, fromC, path, captured = [];
    if (caps.length) {
      const pick = caps[(Math.random() * caps.length) | 0];
      kind = "capture"; fromR = pick.fromR; fromC = pick.fromC; path = pick.path; captured = pick.captured;
    } else {
      const moves = allSimpleMovesForSide(board, side);
      if (!moves.length) {
        const e = { type: "gameover", turnNo, winner: other(side), reason: "no legal move", board: { ...board }, gameNo };
        resetGame();
        return [e];
      }
      const pick = moves[(Math.random() * moves.length) | 0];
      kind = "move"; fromR = pick.fromR; fromC = pick.fromC; path = [{ toR: pick.toR, toC: pick.toC }];
    }
    const piece = board[key(fromR, fromC)];
    delete board[key(fromR, fromC)];
    for (const ck of captured) delete board[ck];
    const last = path[path.length - 1];
    const backRow = side === "b" ? N - 1 : 0;
    const promoted = !piece.king && last.toR === backRow;
    if (promoted) piece.king = true;
    board[key(last.toR, last.toC)] = piece;

    const countB = Object.values(board).filter(p => p.side === "b").length;
    const countW = Object.values(board).filter(p => p.side === "w").length;
    const snapshot = { ...board };
    activeSide = other(side);
    const event = {
      type: "turn", turnNo, side, kind, fromR, fromC, path, captured, promoted,
      countB, countW, board: snapshot, gameNo,
    };
    const out = [event];
    if (countB === 0 || countW === 0) {
      out.push({ type: "gameover", turnNo, winner: countB > 0 ? "b" : "w", reason: "no pieces left", countB, countW, board: snapshot, gameNo });
      resetGame();
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  const boardEl = $("ck-board");
  if (!boardEl) return; // this page doesn't have the checkers markup

  const squareEls = {};
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const el = document.createElement("div");
      el.className = "ck-sq " + ((r + c) % 2 === 0 ? "lt" : "dk");
      boardEl.appendChild(el);
      squareEls[key(r, c)] = el;
    }
  }

  function renderBoard(snapshot) {
    for (const k in squareEls) {
      const p = snapshot[k];
      const el = squareEls[k];
      el.innerHTML = p ? `<span class="ck-piece ${p.side}${p.king ? " king" : ""}"></span>` : "";
      el.classList.remove("from", "to");
    }
  }

  function show(e) {
    if (e.type === "gameover") {
      renderBoard(e.board);
      $("ck-turn").textContent = e.turnNo;
      $("ck-side").textContent = "GAME OVER";
      $("ck-move").textContent = (e.winner === "b" ? "BLACK" : "WHITE") + " WINS (" + e.reason + ")";
      $("ck-result").textContent = `Game #${e.gameNo - 1} result: ` + (e.winner === "b" ? "Black" : "White") +
        ` wins, ${e.reason}. Reshuffling into a new game.`;
      $("ck-count-b").textContent = "BLACK " + (e.countB ?? Object.values(e.board).filter(p => p.side === "b").length);
      $("ck-count-w").textContent = "WHITE " + (e.countW ?? Object.values(e.board).filter(p => p.side === "w").length);
      return;
    }
    renderBoard(e.board);
    const from = key(e.fromR, e.fromC), to = key(e.path[e.path.length - 1].toR, e.path[e.path.length - 1].toC);
    if (squareEls[from]) squareEls[from].classList.add("from");
    if (squareEls[to]) squareEls[to].classList.add("to");
    $("ck-turn").textContent = e.turnNo;
    $("ck-side").textContent = (e.side === "b" ? "BLACK" : "WHITE") + "'S TURN";
    const jumps = e.captured.length;
    $("ck-move").textContent = (e.side === "b" ? "BLACK" : "WHITE") + " " +
      (e.kind === "capture" ? `CAPTURES ×${jumps}` : "MOVES") + (e.promoted ? " — KINGED" : "");
    $("ck-count-b").textContent = "BLACK " + e.countB;
    $("ck-count-w").textContent = "WHITE " + e.countW;
    $("ck-result").textContent = "English draughts, mandatory captures, two bots.";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 1100, 4: 500, 8: 260, 16: 120 }; // ms a turn sits on screen
  const GAMEOVER_PAUSE = 2200;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, queue = [], qi = 0;
  const running = () => !paused;

  function next() {
    if (qi >= queue.length) { queue = playTurn(); qi = 0; }
    return queue[qi++];
  }
  // Same history pattern as mahjong.js/wizard.js: Back re-shows a stored
  // snapshot, Play-after-Back replays recorded history before generating
  // anything new.
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

  const playBtn = $("ck-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("ck-back").addEventListener("click", () => {
    if (historyIndex <= 0) return;
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    show(history[historyIndex]);
  });
  $("ck-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#ck [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));

  // ---------------------------------------------------------------- start
  renderBoard(board);
  $("ck-turn").textContent = "0";
  $("ck-side").textContent = "BLACK'S TURN";
  $("ck-move").textContent = "—";
  $("ck-count-b").textContent = "BLACK 12";
  $("ck-count-w").textContent = "WHITE 12";
  $("ck-result").textContent = "English draughts, mandatory captures, two bots.";
  syncPlay();
  if (!paused) kick();
})();

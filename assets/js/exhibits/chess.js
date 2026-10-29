// Extra exhibit: chess. Not a simulated/random game like the other exhibits
// here — this replays a REAL game move by move, from a standard PGN
// movetext string (GAME_PGN below), so it works with any game, not just
// the one it ships with. Ships with Fischer vs Spassky, World Championship
// 1972 Game 6 (Reykjavik, July 23 1972) — widely regarded one of the
// greatest games ever played: Fischer surprised Spassky by opening 1.c4
// instead of his usual 1.e4, the game transposed into a Queen's Gambit
// Declined, and Fischer won in 41 moves (Spassky reportedly joined the
// audience in applauding at the end).
//
// Parses standard SAN movetext (move numbers, "O-O"/"O-O-O" castling,
// captures, disambiguation like "R1f2" or "Rbb7", "=Q" promotion, "+"/"#"
// suffixes, a trailing result) and resolves each move to the piece that
// actually made it via real move geometry for every piece type (knight
// jumps, sliding pieces with blocking, pawn forward/double-step/diagonal
// capture/en passant), the same kind of logic any PGN reader needs — not a
// full legal-move generator (no stalemate/checkmate detection), but it does
// check "does this candidate leave my own king in check" to resolve the
// rare case where disambiguation depends on a pin rather than geometry
// alone. Verified against the Fischer-Spassky game by cross-checking its
// output against an independently hand-derived from/to list (see plan.md)
// — all 81 plies matched — plus separate tests covering castling, en
// passant, promotion and checkmate notation.
//
// To replay a different game, replace GAME_PGN with any PGN movetext.
//
// Markup it expects (see extra-exhibit.md): a <section id="ch"> containing
// #ch-board (empty — the 64 squares are built here), #ch-move, #ch-turn,
// #ch-last, #ch-result, #ch-play, #ch-next, and [data-speed] buttons.
(() => {
  "use strict";

  const GAME_PGN = "1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6 " +
    "8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8 " +
    "14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6 " +
    "20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5 " +
    "27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8 " +
    "33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 " +
    "39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0";
  const GAME_LABEL = "Fischer vs Spassky, Reykjavik 1972, World Championship Game 6";

  // ---------------------------------------------------------------- board geometry
  const FILES = "abcdefgh";
  const fileOf = s => FILES.indexOf(s[0]);
  const rankOf = s => +s[1] - 1;
  const sqName = (f, r) => FILES[f] + (r + 1);

  function initialBoard() {
    const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
    const b = {};
    for (let f = 0; f < 8; f++) {
      const file = FILES[f];
      b[file + "1"] = { type: back[f], color: "w" };
      b[file + "2"] = { type: "P", color: "w" };
      b[file + "7"] = { type: "P", color: "b" };
      b[file + "8"] = { type: back[f], color: "b" };
    }
    return b;
  }

  const KNIGHT_OFFS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  function slidePathClear(board, f0, r0, f1, r1) {
    const df = Math.sign(f1 - f0), dr = Math.sign(r1 - r0);
    let f = f0 + df, r = r0 + dr;
    while (f !== f1 || r !== r1) {
      if (board[sqName(f, r)]) return false;
      f += df; r += dr;
    }
    return true;
  }
  // Pure geometry + blocking — not legality (doesn't know about check/pins;
  // that's layered on separately, see wouldLeaveKingInCheck).
  function pieceCanReach(board, from, to, type, color) {
    const f0 = fileOf(from), r0 = rankOf(from), f1 = fileOf(to), r1 = rankOf(to);
    const df = f1 - f0, dr = r1 - r0;
    switch (type) {
      case "N": return KNIGHT_OFFS.some(([a, b]) => a === df && b === dr);
      case "K": return Math.max(Math.abs(df), Math.abs(dr)) === 1;
      case "B": return Math.abs(df) === Math.abs(dr) && df !== 0 && slidePathClear(board, f0, r0, f1, r1);
      case "R": return (df === 0 || dr === 0) && (df !== 0 || dr !== 0) && slidePathClear(board, f0, r0, f1, r1);
      case "Q": return ((Math.abs(df) === Math.abs(dr) && df !== 0) || ((df === 0) !== (dr === 0))) && slidePathClear(board, f0, r0, f1, r1);
      case "P": {
        const dir = color === "w" ? 1 : -1, startRank = color === "w" ? 1 : 6;
        if (df === 0) {
          if (board[to]) return false;
          if (dr === dir) return true;
          return dr === 2 * dir && r0 === startRank && !board[sqName(f0, r0 + dir)];
        }
        return Math.abs(df) === 1 && dr === dir; // diagonal: capture, incl. en passant
      }
    }
    return false;
  }
  function isSquareAttacked(board, sq, byColor) {
    for (const s in board) {
      const p = board[s];
      if (p.color !== byColor) continue;
      if (p.type === "P") {
        const dir = byColor === "w" ? 1 : -1;
        if (Math.abs(fileOf(sq) - fileOf(s)) === 1 && rankOf(sq) - rankOf(s) === dir) return true;
        continue;
      }
      if (pieceCanReach(board, s, sq, p.type, p.color)) return true;
    }
    return false;
  }
  function findKing(board, color) {
    for (const s in board) if (board[s].type === "K" && board[s].color === color) return s;
  }
  function wouldLeaveKingInCheck(board, color, from, to) {
    const clone = { ...board };
    const piece = clone[from];
    delete clone[from];
    clone[to] = piece;
    const kingSq = piece.type === "K" ? to : findKing(clone, color);
    return kingSq ? isSquareAttacked(clone, kingSq, color === "w" ? "b" : "w") : false;
  }

  // ---------------------------------------------------------------- SAN parsing
  const PIECE_LETTERS = "KQRBN";
  function parseSAN(san) {
    san = san.replace(/[+#]$/, "").replace(/[!?]+$/, "");
    if (san === "O-O" || san === "0-0") return { castle: "K" };
    if (san === "O-O-O" || san === "0-0-0") return { castle: "Q" };
    let promotion = null;
    const promMatch = san.match(/=([QRBN])$/);
    if (promMatch) { promotion = promMatch[1]; san = san.slice(0, promMatch.index); }
    const capture = san.includes("x");
    san = san.replace("x", "");
    let piece = "P";
    if (PIECE_LETTERS.includes(san[0])) { piece = san[0]; san = san.slice(1); }
    return { piece, capture, dest: san.slice(-2), disambig: san.slice(0, -2), promotion };
  }
  function resolveMove(board, color, parsed) {
    if (parsed.castle) {
      const rank = color === "w" ? "1" : "8";
      return { from: "e" + rank, to: parsed.castle === "K" ? "g" + rank : "c" + rank };
    }
    let candidates = [];
    for (const s in board) {
      const p = board[s];
      if (p.color !== color || p.type !== parsed.piece) continue;
      if (!pieceCanReach(board, s, parsed.dest, p.type, p.color)) continue;
      if (p.type === "P" && (s[0] !== parsed.dest[0]) !== parsed.capture) continue;
      candidates.push(s);
    }
    if (parsed.disambig) {
      const fileHint = [...parsed.disambig].find(c => "abcdefgh".includes(c));
      const rankHint = [...parsed.disambig].find(c => "12345678".includes(c));
      if (fileHint) candidates = candidates.filter(s => s[0] === fileHint);
      if (rankHint) candidates = candidates.filter(s => s[1] === rankHint);
    }
    if (candidates.length > 1) {
      const narrowed = candidates.filter(s => !wouldLeaveKingInCheck(board, color, s, parsed.dest));
      if (narrowed.length) candidates = narrowed;
    }
    return { from: candidates[0], to: parsed.dest };
  }
  function parsePGNMoves(text) {
    return text
      .replace(/\{[^}]*\}/g, " ").replace(/\([^)]*\)/g, " ")
      .replace(/\d+\.(\.\.)?/g, " ").replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, " ")
      .trim().split(/\s+/).filter(Boolean);
  }

  // Plays the whole PGN once against a scratch board, producing one event
  // per ply with everything the renderer needs (from/to, captured piece,
  // the extra rook hop on a castle, en passant, promotion).
  function replayPGN(pgnText) {
    const tokens = parsePGNMoves(pgnText);
    const board = initialBoard();
    let color = "w";
    const plies = [];
    for (const san of tokens) {
      const parsed = parseSAN(san);
      const { from, to } = resolveMove(board, color, parsed);
      const piece = board[from];
      let capturedSq = to, enPassant = false;
      if (piece.type === "P" && from[0] !== to[0] && !board[to]) { enPassant = true; capturedSq = to[0] + from[1]; }
      const captured = board[capturedSq] || null;
      if (enPassant) delete board[capturedSq];
      delete board[from];
      board[to] = piece;
      let rook = null;
      if (piece.type === "K" && Math.abs(fileOf(from) - fileOf(to)) === 2) {
        const rank = from[1];
        rook = to[0] === "g" ? { from: "h" + rank, to: "f" + rank } : { from: "a" + rank, to: "d" + rank };
        board[rook.to] = board[rook.from];
        delete board[rook.from];
      }
      if (parsed.promotion) board[to] = { type: parsed.promotion, color: piece.color };
      // Snapshot the board as it stands right after this ply — simplest way
      // for the renderer below to just paint a known-good state rather than
      // re-deriving piece types by re-applying from/to/rook/enPassant itself.
      plies.push({ san, from, to, color, captured: captured ? captured.type : null, rook, promotion: parsed.promotion, enPassant, boardAfter: { ...board } });
      color = color === "w" ? "b" : "w";
    }
    return plies;
  }

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  const boardEl = $("ch-board");
  if (!boardEl) return; // this page doesn't have the chess markup

  const GLYPH = {
    w: { K: "♔︎", Q: "♕︎", R: "♖︎", B: "♗︎", N: "♘︎", P: "♙︎" },
    b: { K: "♚︎", Q: "♛︎", R: "♜︎", B: "♝︎", N: "♞︎", P: "♟︎" },
  };
  const squareEls = {};
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const name = FILES[f] + (r + 1);
      const el = document.createElement("div");
      el.className = "ch-sq " + ((f + r) % 2 === 0 ? "dk" : "lt");
      el.dataset.sq = name;
      boardEl.appendChild(el);
      squareEls[name] = el;
    }
  }

  let plies = [];
  try { plies = replayPGN(GAME_PGN); } catch (err) { /* leaves plies empty; board just won't animate */ }
  const resultLine = (GAME_PGN.match(/(1-0|0-1|1\/2-1\/2)\s*$/) || [])[0] || "";
  const RESULT_TEXT = GAME_LABEL + (resultLine ? " — " + resultLine : "");

  let board = initialBoard();
  function renderBoard() {
    for (const name in squareEls) {
      const p = board[name];
      squareEls[name].textContent = p ? GLYPH[p.color][p.type] : "";
      squareEls[name].classList.remove("from", "to");
    }
  }
  const moveText = ply => ply.san;

  function show(step) {
    if (step === 0) {
      board = initialBoard();
      renderBoard();
      $("ch-move").textContent = "0";
      $("ch-turn").textContent = "WHITE TO MOVE";
      $("ch-last").textContent = "—";
      $("ch-result").textContent = GAME_LABEL + ".";
      return;
    }
    if (step <= plies.length) {
      const ply = plies[step - 1];
      board = ply.boardAfter;
      renderBoard();
      squareEls[ply.from] && squareEls[ply.from].classList.add("from");
      squareEls[ply.to] && squareEls[ply.to].classList.add("to");
      $("ch-move").textContent = Math.ceil(step / 2);
      $("ch-turn").textContent = step % 2 === 0 ? "WHITE TO MOVE" : "BLACK TO MOVE";
      $("ch-last").textContent = moveText(ply);
      $("ch-result").textContent = step === plies.length ? RESULT_TEXT : GAME_LABEL + ".";
      return;
    }
    $("ch-turn").textContent = "GAME OVER";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 1600, 4: 900, 8: 450, 16: 220 }; // ms a move sits on screen
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 4, paused = reduce, inView = true, timer = 0, step = 0;
  const running = () => !paused && inView && !document.hidden;

  function tick() {
    timer = 0;
    if (!running()) return;
    step = step > plies.length ? 0 : step + 1;
    show(step);
    const wait = step === 0 ? BASE[speed] * 2 : step === plies.length ? BASE[speed] * 4 : BASE[speed];
    timer = setTimeout(tick, wait);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("ch-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("ch-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    step = step > plies.length ? 0 : step + 1;
    show(step);
  });
  const speedBtns = document.querySelectorAll("#ch [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("ch"));

  // ---------------------------------------------------------------- start
  show(0);
  syncPlay();
  if (!paused) kick();
})();

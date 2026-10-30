// Extra exhibit: wizard duel. Two simulated wizards fight on a 15x10 board.
// Every turn the active wizard casts ONE RANDOMLY-CHOSEN spell from a
// 10-spell starter subset and rolls against its real cast-success chance;
// then that wizard's living creatures each move toward the nearest enemy
// creature or attack if already adjacent. Combat is a single opposed roll,
// no hit points: attacker stat + d10 vs defender stat + d10, ties favor
// the defender — a straight kill or a miss. After a fixed number of turns
// the side with more creatures left wins, and the board resets for a new
// duel. Loops forever, same as every other exhibit here.
//
// Sourced from the real Chaos (1985) disassembly documentation — see
// wizard-plan.md for the research this is built from, including exactly
// which numbers are sourced vs. filled in for this first pass. Several
// DELIBERATE simplifications, flagged here and in wizard-duel-exhibit.md:
// - This is a RANDOM-spell bot-vs-bot demo, not the spell/build picker the
//   user separately described — that's an explicit later phase, not here.
// - Only 10 of the real game's 60 spells / 5 of its 33 summonable
//   creatures are modeled (see SPELLS below) — picked for mechanical
//   variety (cheap chaff, a flyer, a rare powerhouse, an undead, two
//   attack spells at different ranges, two buffs, one dispel), not
//   authoritative "starter tier" picks (the real game has no such tier).
// - Wizards are stationary and can never be attacked or killed (no
//   "ENGAGE?" mechanic) — a duel only ends by turn cap, never by
//   elimination. This was an open question in wizard-plan.md; resolved
//   this way to keep a first pass simple and guaranteed to terminate.
// - Attack spells target the nearest enemy creature within range directly
//   — no beam line-of-sight/obstruction simulation (the real game's beam
//   rendering is documented; what a beam actually hits along its path is
//   not, per wizard-plan.md). A straight visual line is still drawn for
//   the cast, purely cosmetic.
// - Undead creatures (Skeleton) can't be hurt by ordinary creature melee
//   in this subset (no anti-undead weapon items are modeled) but CAN be
//   killed by either wizard's attack spells, since those are magic, not a
//   physical weapon — this mirrors the real undead-immunity rule's spirit
//   without needing to model items.
// - Black/white sides are this theme's own convention (ink vs. paper,
//   matching every other exhibit) — the original game didn't color-code
//   wizards by player at all.
//
// Markup it expects (see wizard-duel-exhibit.md): a <section id="wiz">
// containing #wiz-board (empty — built here), #wiz-turn, #wiz-side,
// #wiz-spell, #wiz-count-b, #wiz-count-w, #wiz-result, #wiz-play,
// #wiz-back, #wiz-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- board / rules data
  const COLS = 15, ROWS = 10; // sourced board size (WizardPlacements.html)
  const MAX_TURNS = 60; // not sourced — a fixed cap since wizards can't die here (see header)
  // Sourced placements for 2 players (WizardPlacements.html): (row 4, col 1) / (row 4, col 13).
  const START = { b: { row: 4, col: 1 }, w: { row: 4, col: 13 } };

  // name, kind, cast-success % (sourced per spell from Spells.html), plus
  // whatever the kind needs. Combat/defence numbers for summons are
  // sourced from CreatureStats.html except Eagle's, which the research
  // pass didn't carry exact figures for — flagged as an approximate
  // placeholder, not sourced, same honesty convention as everywhere else
  // in this project.
  const SPELLS = [
    { name: "Goblin", kind: "summon", pct: 90, combat: 2, defence: 4 },
    { name: "Lion", kind: "summon", pct: 60, combat: 6, defence: 4 },
    { name: "Eagle", kind: "summon", pct: 70, combat: 4, defence: 3, flying: true }, // combat/defence approximate, not sourced
    { name: "Giant", kind: "summon", pct: 40, combat: 9, defence: 7 },
    { name: "Skeleton", kind: "summon", pct: 70, combat: 3, defence: 5, undead: true },
    { name: "Magic Bolt", kind: "attack", pct: 100, power: 5, range: 6 },
    { name: "Lightning", kind: "attack", pct: 100, power: 4, range: 4 },
    { name: "Magic Shield", kind: "buff", pct: 70, stat: "def", amount: 2 },
    { name: "Magic Sword", kind: "buff", pct: 40, stat: "combat", amount: 2 },
    { name: "Disbelieve", kind: "utility", pct: 100 },
  ];
  const SIDE_NAME = { b: "BLACK", w: "WHITE" };

  const rand10 = () => (Math.random() * 10) | 0;
  const chebyshev = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const other = s => (s === "b" ? "w" : "b");

  // ---------------------------------------------------------------- game state
  let pieces, buff, turnNo, activeSide, gameNo, nextId;
  function resetGame() {
    pieces = [
      { id: 1, side: "b", kind: "wizard", row: START.b.row, col: START.b.col, alive: true },
      { id: 2, side: "w", kind: "wizard", row: START.w.row, col: START.w.col, alive: true },
    ];
    nextId = 2;
    buff = { b: { combat: 0, def: 0 }, w: { combat: 0, def: 0 } };
    turnNo = 0;
    activeSide = "b";
    gameNo = (gameNo || 0) + 1;
  }
  resetGame();

  function occupied(row, col, excludeId) {
    return pieces.some(p => p.alive && p.row === row && p.col === col && p.id !== excludeId);
  }
  // Random order so repeated summons at the same wizard don't always fill
  // the same side first.
  function freeAdjacent(row, col) {
    const deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (let i = deltas.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[deltas[i], deltas[j]] = [deltas[j], deltas[i]]; }
    for (const [dr, dc] of deltas) {
      const r = row + dr, c = col + dc;
      if (inBounds(r, c) && !occupied(r, c)) return { row: r, col: c };
    }
    return null;
  }
  // Never targets a wizard (see header) — only creature-vs-creature.
  function nearestEnemy(row, col, side, maxRange) {
    let best = null, bestDist = Infinity;
    for (const p of pieces) {
      if (!p.alive || p.side === side || p.kind === "wizard") continue;
      const d = chebyshev({ row, col }, p);
      if (d <= maxRange && d < bestDist) { best = p; bestDist = d; }
    }
    return best;
  }
  function stepToward(p, enemy) {
    const dr = Math.sign(enemy.row - p.row), dc = Math.sign(enemy.col - p.col);
    for (const [tr, tc] of [[dr, dc], [dr, 0], [0, dc]]) {
      if (tr === 0 && tc === 0) continue;
      const r = p.row + tr, c = p.col + tc;
      if (inBounds(r, c) && !occupied(r, c, p.id)) return { row: r, col: c };
    }
    return { row: p.row, col: p.col };
  }

  // One full turn: the active wizard casts a random spell, then all of
  // that wizard's living creatures each move-or-attack once. Returns an
  // array of 1 or 2 events — a "turn" event, plus a "gameover" event (and
  // an immediate reset for the next duel) if this was the last turn.
  function playTurn() {
    turnNo++;
    const side = activeSide;
    const wiz = pieces.find(p => p.kind === "wizard" && p.side === side);
    const spell = SPELLS[(Math.random() * SPELLS.length) | 0];
    const success = Math.random() * 100 < spell.pct;
    let spellTarget = null, spellKilled = null, summonedId = null;
    if (success) {
      if (spell.kind === "summon") {
        const cell = freeAdjacent(wiz.row, wiz.col);
        if (cell) {
          const p = {
            id: ++nextId, side, kind: spell.name, row: cell.row, col: cell.col,
            combat: spell.combat, defence: spell.defence, undead: !!spell.undead, alive: true,
          };
          pieces.push(p);
          summonedId = p.id;
        }
      } else if (spell.kind === "attack") {
        const target = nearestEnemy(wiz.row, wiz.col, side, spell.range);
        if (target) {
          spellTarget = { row: target.row, col: target.col };
          const atk = spell.power + rand10();
          const def = target.defence + buff[other(side)].def + rand10();
          if (atk > def) { target.alive = false; spellKilled = target.id; }
        }
      } else if (spell.kind === "buff") {
        buff[side][spell.stat] += spell.amount;
      } else if (spell.kind === "utility") {
        const targets = pieces.filter(p => p.alive && p.side !== side && p.kind !== "wizard");
        if (targets.length) targets[(Math.random() * targets.length) | 0].alive = false;
      }
    }
    for (const p of pieces) {
      if (p.side !== side || !p.alive || p.kind === "wizard") continue;
      const enemy = nearestEnemy(p.row, p.col, side, Infinity);
      if (!enemy) continue;
      if (chebyshev(p, enemy) <= 1) {
        if (enemy.undead) continue; // creature melee can't hurt undead here (see header)
        const atk = p.combat + buff[side].combat + rand10();
        const def = enemy.defence + buff[other(side)].def + rand10();
        if (atk > def) enemy.alive = false;
      } else {
        const to = stepToward(p, enemy);
        p.row = to.row; p.col = to.col;
      }
    }
    const countB = pieces.filter(p => p.side === "b" && p.alive && p.kind !== "wizard").length;
    const countW = pieces.filter(p => p.side === "w" && p.alive && p.kind !== "wizard").length;
    const snapshot = pieces.filter(p => p.alive).map(p => ({ ...p }));
    activeSide = other(side);
    const event = {
      type: "turn", turnNo, side, spellName: spell.name, spellKind: spell.kind, success,
      spellTarget, spellKilled, summonedId, countB, countW, pieces: snapshot, gameNo,
    };
    const out = [event];
    if (turnNo >= MAX_TURNS) {
      const winner = countB > countW ? "BLACK" : countW > countB ? "WHITE" : "DRAW";
      out.push({ type: "gameover", turnNo, countB, countW, winner, pieces: snapshot, gameNo });
      resetGame();
    }
    return out;
  }

  // ---------------------------------------------------------------- drawing
  const SVG_NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const boardEl = $("wiz-board");
  if (!boardEl) return; // this page doesn't have the wizard-duel markup

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${COLS} ${ROWS}`);
  svg.setAttribute("class", "wiz-svg");
  // Checkerboard background, built once — only the pieces layer is
  // rebuilt per event.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElementNS(SVG_NS, "rect");
      cell.setAttribute("x", c); cell.setAttribute("y", r); cell.setAttribute("width", 1); cell.setAttribute("height", 1);
      cell.setAttribute("class", "wiz-cell" + ((r + c) % 2 === 0 ? " a" : " b"));
      svg.appendChild(cell);
    }
  }
  const piecesLayer = document.createElementNS(SVG_NS, "g");
  svg.appendChild(piecesLayer);
  boardEl.appendChild(svg);

  // ---------------------------------------------------------------- real sprites
  // Actual 16x16 pixel sprites from the Chaos (1985) ZX Spectrum disassembly
  // (archaos.co.uk/chaos-disassembly), not hand-drawn shapes. Each sprite is
  // 2x2 "UDGs" (user-defined graphics), 8 bytes each, one byte per pixel row,
  // most-significant-bit = leftmost pixel — standard ZX Spectrum UDG format.
  // Quadrant order (top-left, top-right, bottom-left, bottom-right) and the
  // frame picked (frame 0 of each creature's 3-frame ping-pong walk cycle;
  // animating a walk cycle didn't fit this exhibit's move-once-per-turn
  // model, so just the idle/first frame is used) are both inferences, not
  // confirmed by the source pages — but decoding these bytes to pixels and
  // looking at the result (done before committing to this) produces clearly
  // recognizable figures (a robed wizard, a maned lion, winged eagle, etc.),
  // which is good evidence the inference is right. Wizard sprite is Merlin's
  // ($FDD4 of 8 named wizards) — this project only needs one wizard look per
  // side, not all 8.
  const SPRITE_BYTES = {
    wizard: [
      [0x00, 0x00, 0x01, 0x01, 0x00, 0x1F, 0x0C, 0x08],
      [0x00, 0x00, 0x80, 0x80, 0x80, 0xC0, 0xE2, 0xD4],
      [0x01, 0x03, 0x03, 0x03, 0x03, 0x00, 0x00, 0x00],
      [0xC8, 0xD0, 0xE0, 0xE0, 0xF0, 0xFC, 0x00, 0x00],
    ],
    Goblin: [
      [0x00, 0x00, 0x00, 0x61, 0x71, 0x37, 0x1F, 0x1B],
      [0x00, 0x00, 0x00, 0x80, 0x80, 0xE0, 0xF0, 0xD8],
      [0x03, 0x07, 0x06, 0x06, 0x06, 0x0E, 0x00, 0x00],
      [0xC8, 0xE0, 0x60, 0x60, 0x60, 0xE0, 0x00, 0x00],
    ],
    Lion: [
      [0x00, 0x00, 0x00, 0x00, 0x18, 0x7E, 0x7F, 0x3F],
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xF0, 0xF8],
      [0x1F, 0x0F, 0x12, 0x22, 0x04, 0x00, 0x00, 0x00],
      [0xFC, 0x2C, 0x24, 0x44, 0x08, 0x00, 0x00, 0x00],
    ],
    Eagle: [
      [0x00, 0x00, 0x00, 0x00, 0x38, 0x6C, 0x07, 0x03],
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x78, 0xEC, 0x80],
      [0x06, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      [0x80, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    ],
    Giant: [
      [0x00, 0x00, 0x03, 0x07, 0x07, 0x0F, 0xFD, 0xF9],
      [0xC0, 0xC0, 0xF0, 0xF8, 0xF8, 0xEC, 0xE4, 0xE6],
      [0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x07],
      [0xF2, 0xF0, 0x30, 0x30, 0x30, 0x30, 0x30, 0x70],
    ],
    Skeleton: [
      [0x00, 0x01, 0x01, 0x00, 0x03, 0x05, 0x09, 0xF0],
      [0x00, 0x80, 0x88, 0x88, 0xF0, 0xC0, 0xC0, 0x80],
      [0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x03, 0x00],
      [0xC0, 0x20, 0x10, 0x10, 0x20, 0x40, 0x20, 0x00],
    ],
  };
  // Decodes one 8-byte UDG block into an 8x8 array of 0/1.
  function decodeBlock(bytes) {
    return bytes.map(b => {
      const row = [];
      for (let bit = 7; bit >= 0; bit--) row.push((b >> bit) & 1);
      return row;
    });
  }
  // Assembles the 2x2 UDG quadrants into one 16x16 grid, then run-length
  // encodes each row into horizontal rects (far fewer SVG elements than one
  // rect per lit pixel — a sprite is ~40-60 lit pixels but typically only
  // ~10-16 runs).
  function buildSpriteRuns(kind) {
    const [TL, TR, BL, BR] = SPRITE_BYTES[kind];
    const tl = decodeBlock(TL), tr = decodeBlock(TR), bl = decodeBlock(BL), br = decodeBlock(BR);
    const grid = [];
    for (let r = 0; r < 8; r++) grid.push([...tl[r], ...tr[r]]);
    for (let r = 0; r < 8; r++) grid.push([...bl[r], ...br[r]]);
    const runs = [];
    for (let r = 0; r < 16; r++) {
      let c = 0;
      while (c < 16) {
        if (grid[r][c]) {
          const start = c;
          while (c < 16 && grid[r][c]) c++;
          runs.push({ row: r, col: start, len: c - start });
        } else c++;
      }
    }
    return runs;
  }
  // Built once per kind, reused for every piece of that kind on the board.
  const SPRITE_RUNS = {};
  for (const kind in SPRITE_BYTES) SPRITE_RUNS[kind] = buildSpriteRuns(kind);

  // Black side: solid ink pixels. White side: paper-filled pixels with a
  // thin ink outline per run, so it reads against both checkerboard tones —
  // same solid-vs-outlined convention as Go's stones.
  // Stroking each run rect individually (the first version) outlined every
  // run on its own, including the seams between two runs that sit flush
  // against each other — it read as grid lines cutting through the sprite,
  // not one clean silhouette edge. Fixed by drawing white pieces as two
  // passes instead: an ink "shadow" layer using the same runs enlarged by a
  // small pad (no stroke, just a solid fill slightly bigger than the real
  // silhouette), then the real paper-filled runs on top at normal size —
  // the ink only peeks out around the sprite's actual outer edge, not
  // between internal runs, since both layers are solid fills with no
  // per-rect borders.
  function pieceShape(kind, cx, cy, side) {
    const runs = SPRITE_RUNS[kind];
    if (!runs) return "";
    const S = 0.85 / 16; // sprite spans .85 of a board cell, scaled from its native 16x16
    const ox = cx - 0.85 / 2, oy = cy - 0.85 / 2;
    const rectsAt = (pad, fill) => runs.map(run => {
      const x = (ox + run.col * S - pad).toFixed(3), y = (oy + run.row * S - pad).toFixed(3);
      const w = (run.len * S + 2 * pad).toFixed(3), h = (S + 2 * pad).toFixed(3);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
    }).join("");
    if (side === "b") return rectsAt(0, "var(--ink)");
    return rectsAt(S * 0.45, "var(--ink)") + rectsAt(0, "var(--paper)");
  }

  function render(e) {
    const parts = e.pieces.map(p => pieceShape(p.kind, p.col + 0.5, p.row + 0.5, p.side)).join("");
    let beam = "";
    if (e.type === "turn" && e.spellTarget) {
      const wiz = e.pieces.find(p => p.kind === "wizard" && p.side === e.side);
      if (wiz) {
        beam = `<line x1="${wiz.col + 0.5}" y1="${wiz.row + 0.5}" x2="${e.spellTarget.col + 0.5}" y2="${e.spellTarget.row + 0.5}" class="wiz-beam"/>`;
      }
    }
    piecesLayer.innerHTML = beam + parts;

    $("wiz-count-b").textContent = "BLACK " + e.countB;
    $("wiz-count-w").textContent = "WHITE " + e.countW;
    if (e.type === "gameover") {
      $("wiz-turn").textContent = e.turnNo;
      $("wiz-side").textContent = "GAME OVER";
      $("wiz-spell").textContent = e.winner === "DRAW" ? "DRAW" : e.winner + " WINS";
      $("wiz-result").textContent = `Duel #${e.gameNo - 1} result: ` + (e.winner === "DRAW" ? "a draw" : e.winner + " wins") + ` (${e.countB}-${e.countW}). Reshuffling into a new duel.`;
      return;
    }
    $("wiz-turn").textContent = e.turnNo;
    $("wiz-side").textContent = SIDE_NAME[e.side] + "'S TURN";
    const label = e.spellKind === "summon" ? "summon " + e.spellName : e.spellName;
    $("wiz-spell").textContent = SIDE_NAME[e.side] + " CASTS " + label.toUpperCase() + (e.success ? "" : " — FAILS");
    $("wiz-result").textContent = `Chaos (1985) mechanics, randomly-cast spells, two bots.`;
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 1100, 4: 500, 8: 260, 16: 120 }; // ms a turn sits on screen
  const GAMEOVER_PAUSE = 2200;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, queue = [], qi = 0;
  // Deliberately NOT also gated on scroll visibility (IntersectionObserver)
  // or document.hidden the way most other exhibits are — go.js had a
  // reported stall bug traced to exactly that mechanism, so this one skips
  // it entirely rather than risk the same failure mode; Play/Pause is the
  // only thing that stops it.
  const running = () => !paused;

  function next() {
    if (qi >= queue.length) { queue = playTurn(); qi = 0; }
    return queue[qi++];
  }
  // Same history pattern as mahjong.js: Back re-shows a stored snapshot,
  // Play-after-Back replays recorded history before generating anything
  // new.
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
    render(e);
    timer = setTimeout(tick, e.type === "gameover" ? GAMEOVER_PAUSE : BASE[speed]);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("wiz-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("wiz-back").addEventListener("click", () => {
    if (historyIndex <= 0) return;
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    render(history[historyIndex]);
  });
  $("wiz-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    render(advance());
  });
  const speedBtns = document.querySelectorAll("#wiz [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  // ---------------------------------------------------------------- start
  $("wiz-turn").textContent = "0";
  $("wiz-side").textContent = SIDE_NAME[activeSide] + "'S TURN";
  $("wiz-spell").textContent = "—";
  $("wiz-count-b").textContent = "BLACK 0";
  $("wiz-count-w").textContent = "WHITE 0";
  $("wiz-result").textContent = "Chaos (1985) mechanics, randomly-cast spells, two bots.";
  syncPlay();
  if (!paused) kick();
})();

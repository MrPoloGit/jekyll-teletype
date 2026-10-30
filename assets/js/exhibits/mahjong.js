// Extra exhibit: mahjong. Four simulated players sit on the sides of a
// square table, each starting with a 13-tile hand from a standard 136-tile
// set (no flower/season tiles). Every turn: draw one tile from the wall
// (flashes briefly), then discard one into the middle — each player's own
// discards land on their own side, like a real table. A round ends either
// by a self-drawn win (see isWinningHand below) or by the wall running out
// (exhaustive draw); either way the table reshuffles into a new round.
//
// Deliberately a SIMPLE rule set, not real mahjong scoring: a hand wins the
// moment its 14 tiles form 4 melds (triplets or same-suit runs of 3) + 1
// pair, checked only on the drawing player's own hand (tsumo). No ron
// (winning off another player's discard), no calling (pon/chi/kan), no
// yaku/scoring, no special hands (seven pairs, kokushi, ...). See plan.md's
// "Future exhibits roadmap" note: data stays simulated/visual, same as
// every other ported exhibit — this is just enough rule to make a round end
// on its own instead of running forever.
//
// Markup it expects (see extra-exhibit.md): a <section id="mj"> containing
// #mj-table (figure) with four #mj-side-{n,e,s,w} (each wrapping a .mj-lbl
// and #mj-h-{n,e,s,w}) and four #mj-d-{n,e,s,w} discard piles, #mj-turn,
// #mj-wall, #mj-round, #mj-play, #mj-back, #mj-next, and [data-speed] buttons.
(() => {
  "use strict";

  // Tiles are drawn as small bordered boxes containing a hand-built SVG
  // icon — the suits get real pip-style designs (pin = dots, sou = bamboo
  // sticks, man = a big numeral), not just a text abbreviation — rather
  // than any Unicode glyph block. The Mahjong Tiles block (U+1F000-1F021)
  // was tried first; its red dragon character defaults to emoji
  // presentation in most fonts while its 33 neighbors don't, and multiple
  // font-based/SVG-icon fixes for just that one tile each took several
  // rounds to get right (see plan.md). Rather than keep patching a single
  // glyph, every tile here now avoids Unicode symbol blocks entirely —
  // circles/bars are plain SVG shapes, numerals are plain digits set with
  // an SVG <text> (which inherits the page's own monospace font, same as
  // any other text here, so still zero font-coverage risk).
  const N_TYPES = 34;
  // Still used as each tile's accessible name (aria-label) even though the
  // visible content is now an icon, not text.
  const LABELS = [
    "East wind", "South wind", "West wind", "North wind",
    "Red dragon", "Green dragon", "White dragon",
    ...Array.from({ length: 9 }, (_, i) => (i + 1) + " characters"),
    ...Array.from({ length: 9 }, (_, i) => (i + 1) + " bamboo"),
    ...Array.from({ length: 9 }, (_, i) => (i + 1) + " circles"),
  ];

  // Dice/card-style pip layouts (fractional x,y within the tile), shared by
  // both suits that show "N marks" (pin's dots, sou's sticks) — not the
  // exact traditional arrangement for every number, but a systematic,
  // recognizable "this many" layout, same spirit as the simplified rule set
  // elsewhere in this file.
  const PIPS = {
    1: [[.5, .5]],
    2: [[.3, .3], [.7, .7]],
    3: [[.3, .25], [.5, .5], [.7, .75]],
    4: [[.3, .25], [.7, .25], [.3, .75], [.7, .75]],
    5: [[.3, .25], [.7, .25], [.5, .5], [.3, .75], [.7, .75]],
    6: [[.3, .2], [.7, .2], [.3, .5], [.7, .5], [.3, .8], [.7, .8]],
    7: [[.3, .15], [.7, .15], [.3, .4], [.7, .4], [.5, .58], [.3, .85], [.7, .85]],
    8: [[.3, .15], [.7, .15], [.3, .38], [.7, .38], [.3, .62], [.7, .62], [.3, .85], [.7, .85]],
    9: [[.22, .2], [.5, .2], [.78, .2], [.22, .5], [.5, .5], [.78, .5], [.22, .8], [.5, .8], [.78, .8]],
  };
  const TILE_W = 24, TILE_H = 32; // SVG viewBox units for every tile icon below
  const svgOpen = `viewBox="0 0 ${TILE_W} ${TILE_H}" aria-hidden="true" focusable="false"`;

  // Pin (circles): N filled dots.
  function pinIcon(n) {
    const r = n <= 3 ? 2.6 : n <= 6 ? 2.2 : 1.9;
    const dots = PIPS[n].map(([fx, fy]) =>
      `<circle cx="${(2 + fx * (TILE_W - 4)).toFixed(1)}" cy="${(2 + fy * (TILE_H - 4)).toFixed(1)}" r="${r}" fill="currentColor"/>`
    ).join("");
    return `<svg ${svgOpen}>${dots}</svg>`;
  }
  // Sou (bamboo): N short vertical bars, same layout as pin's dots.
  function souIcon(n) {
    // Thinner and noticeably longer than a pin dot (so the two suits read
    // as "sticks" vs "circles" at a glance, not just "big dot vs small
    // dot") — capped per tier so denser layouts (7-9, stacked closer
    // together) don't let adjacent bars touch or merge.
    const w = 1.8, h = n <= 3 ? 10 : n <= 6 ? 6.5 : 4.8;
    const bars = PIPS[n].map(([fx, fy]) => {
      const cx = 2 + fx * (TILE_W - 4), cy = 2 + fy * (TILE_H - 4);
      return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w}" height="${h}" rx="1" fill="currentColor"/>`;
    }).join("");
    return `<svg ${svgOpen}>${bars}</svg>`;
  }
  // Man (characters): the real pair printed on a physical tile — a big
  // Chinese numeral over 萬 ("ten thousand", what gives the suit its
  // Western name "characters"/"wan"). Earlier version stood in with an
  // Arabic numeral + "WAN" to avoid any CJK text; now that every tile is
  // its own self-contained SVG (not a glyph expected to match 33 neighbors
  // from one shared font, which is what made the Mahjong Tiles block's
  // inconsistent coverage a problem in the first place), a CJK fallback
  // font for just this text is no longer a mismatch risk — there's nothing
  // adjacent it needs to match anymore. CJK Unified Ideographs is also a
  // universally-covered block (every OS ships a CJK font), nothing like
  // the sparse symbol block the red dragon saga was about.
  const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  function manIcon(n) {
    return `<svg ${svgOpen}>` +
      `<text x="${TILE_W / 2}" y="13" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="currentColor">${CN_NUM[n - 1]}</text>` +
      `<text x="${TILE_W / 2}" y="25" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="currentColor">萬</text>` +
      `</svg>`;
  }
  function windIcon(char) {
    return `<svg ${svgOpen}><text x="${TILE_W / 2}" y="${TILE_H / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="currentColor">${char}</text></svg>`;
  }
  // Dragons: the real characters (中/發), in their traditional red/green
  // ink, same reasoning as manIcon above. White stays blank — real white
  // dragon tiles usually are too, often with just a plain frame.
  function dragonIcon(t) {
    if (t === 6) return `<svg ${svgOpen}><rect x="4" y="3" width="${TILE_W - 8}" height="${TILE_H - 6}" fill="none" stroke="var(--ink)" stroke-width="1"/></svg>`;
    const char = t === 4 ? "中" : "發";
    const color = t === 4 ? "var(--red)" : "var(--green)";
    return `<svg ${svgOpen}><text x="${TILE_W / 2}" y="${TILE_H / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="17" fill="${color}">${char}</text></svg>`;
  }
  function tileIcon(t) {
    if (t <= 3) return windIcon("東南西北"[t]);
    if (t <= 6) return dragonIcon(t);
    if (t <= 15) return manIcon(t - 6);
    if (t <= 24) return souIcon(t - 15);
    return pinIcon(t - 24);
  }

  const SIDES = ["n", "e", "s", "w"];
  const SIDE_NAME = { n: "NORTH", e: "EAST", s: "SOUTH", w: "WEST" };

  function buildWall() {
    const w = [];
    for (let t = 0; t < N_TYPES; t++) for (let c = 0; c < 4; c++) w.push(t);
    for (let i = w.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[w[i], w[j]] = [w[j], w[i]]; }
    return w;
  }
  const cmp = (a, b) => a - b;
  function countTypes(hand) {
    const c = new Array(N_TYPES).fill(0);
    for (const t of hand) c[t]++;
    return c;
  }
  // Not real strategy: a tile is "useful" if it has a duplicate (part of a
  // pair/triplet already) or a same-suit tile within 2 ranks of it (part of
  // a potential run); discard a non-useful tile most of the time, otherwise
  // lean toward the tile that was just drawn, else anything. Enough for
  // hands to occasionally come together into a real win (see isWinningHand)
  // without implementing an actual strategy.
  function chooseDiscardIndex(hand, justDrawn) {
    const counts = countTypes(hand);
    const useful = t => {
      if (counts[t] >= 2) return true;
      const s = suitOf(t);
      if (s < 0) return false; // a lone wind/dragon never builds into a run
      const r = rankOf(t);
      for (const d of [-2, -1, 1, 2]) {
        const nr = r + d;
        if (nr >= 0 && nr <= 8 && counts[t - r + nr] > 0) return true;
      }
      return false;
    };
    const dead = [];
    hand.forEach((t, i) => { if (!useful(t)) dead.push(i); });
    if (dead.length && Math.random() < 0.85) return dead[(Math.random() * dead.length) | 0];
    const j = hand.lastIndexOf(justDrawn);
    if (j >= 0 && Math.random() < 0.6) return j;
    return (Math.random() * hand.length) | 0;
  }

  // ---------------------------------------------------------------- simple win check
  // Tile types 0-3 are winds, 4-6 dragons (neither can form a run), 7-15
  // characters, 16-24 bamboo, 25-33 circles (each a run of 9, runs can't
  // cross from one suit into the next).
  const suitOf = t => (t < 7 ? -1 : Math.floor((t - 7) / 9));
  const rankOf = t => (t - 7) % 9; // 0-8 within its suit, meaningless if suitOf < 0
  // Can these tile counts (indexed by type) be split entirely into melds
  // (triplets, or same-suit runs of 3)? Recursive: always resolve the
  // lowest remaining tile first, so there's only ever one way to look at it.
  function canFormMelds(counts) {
    let i = 0;
    while (i < N_TYPES && counts[i] === 0) i++;
    if (i === N_TYPES) return true;
    if (counts[i] >= 3) {
      counts[i] -= 3;
      if (canFormMelds(counts)) { counts[i] += 3; return true; }
      counts[i] += 3;
    }
    const s = suitOf(i);
    if (s >= 0 && rankOf(i) <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0 && suitOf(i + 2) === s) {
      counts[i]--; counts[i + 1]--; counts[i + 2]--;
      if (canFormMelds(counts)) { counts[i]++; counts[i + 1]++; counts[i + 2]++; return true; }
      counts[i]++; counts[i + 1]++; counts[i + 2]++;
    }
    return false;
  }
  // A complete hand is 14 tiles: one pair plus four melds. Try every tile
  // type that has a pair as THE pair, and see if the rest resolves cleanly.
  function isWinningHand(hand) {
    if (hand.length !== 14) return false;
    const counts = countTypes(hand);
    for (let p = 0; p < N_TYPES; p++) {
      if (counts[p] < 2) continue;
      counts[p] -= 2;
      const ok = canFormMelds(counts);
      counts[p] += 2;
      if (ok) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- deal / wall
  let wall, hands, discards, turn, roundNo = 0;
  function resetRound() {
    wall = buildWall();
    hands = [[], [], [], []];
    for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) hands[s].push(wall.pop());
    hands.forEach(h => h.sort(cmp));
    // The last 14 tiles of a real wall are a "dead wall", never drawn from;
    // 136 - 52 dealt - 14 dead = 70 live draws every round.
    wall.splice(0, Math.min(14, wall.length));
    discards = [[], [], [], []];
    turn = 0; // simplified: always starts on seat 0 (north), no rotating "East" role
    roundNo++;
  }
  resetRound();

  // One turn = draw (hand grows to 14, snapshot for the "draw" event), then
  // either a self-drawn win ends the round right there, or discard (hand
  // back to 13, snapshot for the "discard" event) — and if that discard
  // empties the wall, the round ends as an exhaustive draw. Either ending
  // reshuffles for the next round before this function returns, so the
  // very next turn's events already belong to the new round.
  //
  // Every event carries a full snapshot of all 4 hands and all 4 discard
  // piles (not just the delta for the acting seat) — this is what lets
  // show() below render ANY event correctly regardless of which direction
  // playback is moving, so stepping backward through history (the "Back"
  // button) is just re-rendering a stored snapshot, the same way
  // chess.js/go.js already replay their own fixed move lists in either
  // direction.
  function turnEvents() {
    const seat = turn, tile = wall.pop();
    hands[seat].push(tile);
    hands[seat].sort(cmp);
    const snap = () => ({ hands: hands.map(h => h.slice()), discards: discards.map(d => d.slice()) });
    const drawn = { type: "draw", seat, tile, wall: wall.length, round: roundNo, ...snap() };
    if (isWinningHand(hands[seat])) {
      const won = { type: "win", seat, wall: wall.length, round: roundNo, ...snap() };
      resetRound();
      return [drawn, won];
    }
    const idx = chooseDiscardIndex(hands[seat], tile);
    const out = hands[seat][idx];
    hands[seat].splice(idx, 1);
    discards[seat].push(out);
    const discarded = { type: "discard", seat, tile: out, wall: wall.length, round: roundNo, ...snap() };
    turn = (turn + 1) % 4;
    if (wall.length === 0) {
      const over = { type: "wallout", round: roundNo, ...snap() };
      resetRound();
      return [drawn, discarded, over];
    }
    return [drawn, discarded];
  }

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  if (!$("mj-table")) return; // this page doesn't have the mahjong markup

  const sideEls = {}, handEls = {}, disEls = {};
  for (const s of SIDES) { sideEls[s] = $("mj-side-" + s); handEls[s] = $("mj-h-" + s); disEls[s] = $("mj-d-" + s); }
  const tileHTML = (t, cls) => `<span class="mj-tile${cls ? " " + cls : ""}" aria-label="${LABELS[t]}">${tileIcon(t)}</span>`;

  function renderHand(side, hand, newTile) {
    let used = false;
    handEls[side].innerHTML = hand.map(t => {
      if (!used && t === newTile) { used = true; return tileHTML(t, "new"); }
      return tileHTML(t);
    }).join("");
  }
  function renderAllHands() {
    SIDES.forEach((s, i) => renderHand(s, hands[i]));
  }
  function renderAllDiscards() {
    SIDES.forEach((s, i) => { disEls[s].innerHTML = discards[i].map(t => tileHTML(t)).join(""); });
  }
  function clearHighlights() {
    SIDES.forEach(s => sideEls[s].classList.remove("turn", "win"));
  }

  // Renders an event purely from its own stored snapshot (every event's
  // `hands`/`discards` — see turnEvents() above), never from the live
  // `hands`/`discards` globals — so this works identically whether it's
  // the newest event just generated or an older one being re-shown after
  // stepping backward in history.
  function show(e) {
    SIDES.forEach((s, i) => {
      const newTile = e.type === "draw" && i === e.seat ? e.tile : undefined;
      renderHand(s, e.hands[i], newTile);
    });
    SIDES.forEach((s, i) => { disEls[s].innerHTML = e.discards[i].map(t => tileHTML(t)).join(""); });
    if (e.type === "discard" && disEls[SIDES[e.seat]].lastElementChild) {
      disEls[SIDES[e.seat]].lastElementChild.classList.add("toss");
    }
    clearHighlights();
    if (e.type === "win") {
      sideEls[SIDES[e.seat]].classList.add("win");
      $("mj-turn").textContent = SIDE_NAME[SIDES[e.seat]] + " WINS!";
    } else if (e.type === "wallout") {
      $("mj-turn").textContent = "WALL EMPTY — ROUND OVER";
    } else {
      sideEls[SIDES[e.seat]].classList.add("turn");
      $("mj-turn").textContent = SIDE_NAME[SIDES[e.seat]];
    }
    $("mj-wall").textContent = e.type === "wallout" ? 0 : e.wall;
    $("mj-round").textContent = e.round;
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 900, 4: 320, 8: 160, 16: 70 }; // ms an event sits on screen
  const WAIT_MULT = { draw: 0.55, discard: 1, win: 3, wallout: 2.2 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true, timer = 0, queue = [], qi = 0;

  const running = () => !paused && inView && !document.hidden;

  function next() {
    if (qi >= queue.length) { queue = turnEvents(); qi = 0; }
    return queue[qi++];
  }

  // Every shown event is kept here so "Back" can re-display an earlier one
  // without un-doing any game state (the wall/hands/discards globals only
  // ever move forward — see turnEvents()). advance() replays from history
  // first if it's behind the frontier (so Back then Play resumes through
  // what already happened instead of generating something new), and only
  // calls next() once it's caught back up. Capped so a long-running page
  // doesn't grow this forever.
  let history = [], historyIndex = -1;
  function advance() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
    } else {
      history.push(next());
      if (history.length > 1000) { history.shift(); historyIndex--; }
      historyIndex = history.length - 1;
    }
    return history[historyIndex];
  }

  const waitAfter = e => BASE[speed] * WAIT_MULT[e.type];
  function tick() {
    timer = 0;
    if (!running()) return;
    const e = advance();
    show(e);
    timer = setTimeout(tick, waitAfter(e));
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("mj-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("mj-back").addEventListener("click", () => {
    if (historyIndex <= 0) return; // nothing earlier recorded yet
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    show(history[historyIndex]);
  });
  $("mj-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#mj [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("mj"));

  // ---------------------------------------------------------------- start
  renderAllHands();
  renderAllDiscards();
  $("mj-turn").textContent = SIDE_NAME[SIDES[turn]];
  $("mj-wall").textContent = wall.length;
  $("mj-round").textContent = roundNo;
  syncPlay();
  kick();
})();

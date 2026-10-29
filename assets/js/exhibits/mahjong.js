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
// #mj-wall, #mj-round, #mj-play, #mj-next, and [data-speed] buttons.
(() => {
  "use strict";

  // Unicode's Mahjong Tiles block happens to lay out exactly the 34 tile
  // kinds this needs (no flowers/seasons) as 34 consecutive code points:
  // U+1F000-1F003 winds (E S W N), U+1F004-1F006 dragons (red/green/white),
  // U+1F007-1F00F characters 1-9, U+1F010-1F018 bamboo 1-9, U+1F019-1F021
  // circles 1-9 — so the glyph for tile type t is just code point 0x1F000+t.
  // The red dragon (U+1F004) is the one tile in this block Unicode marks
  // Emoji_Presentation=Yes by default, so most fonts draw it as a colorful
  // image while its 33 neighbors stay plain monochrome glyphs from the same
  // symbol font — two attempts at a text substitute (a CJK "中", then a
  // U+FE0E text-presentation request on the same code point) both still
  // came out looking wrong in practice. Fixed for real by not depending on
  // any font for this one tile at all: a small hand-drawn inline SVG below,
  // styled like the other glyphs' tile-with-a-mark look (outline + a simple
  // center stroke standing in for 中, the character on a real red dragon
  // tile) and colored with currentColor/var(--paper) so it inverts correctly
  // in a ::: screen ::: block exactly like the rest of the theme's icons.
  const N_TYPES = 34;
  const GLYPH = Array.from({ length: N_TYPES }, (_, t) => String.fromCodePoint(0x1f000 + t));
  const RED_DRAGON = 4;
  const RED_DRAGON_ICON = '<svg viewBox="0 0 24 32" aria-hidden="true" focusable="false">' +
    '<rect x="1.5" y="1.5" width="21" height="29" rx="2" fill="var(--paper)" stroke="currentColor" stroke-width=".95"/>' +
    '<rect x="3" y="3.5" width="18" height="25" fill="none" stroke="currentColor" stroke-width=".95"/>' +
    '<line x1="12" y1="3" x2="12" y2="29" stroke="currentColor" stroke-width=".95"/>' +
    '</svg>';
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
  function turnEvents() {
    const seat = turn, tile = wall.pop();
    hands[seat].push(tile);
    hands[seat].sort(cmp);
    const drawn = { type: "draw", seat, tile, hand: hands[seat].slice(), wall: wall.length, round: roundNo };
    if (isWinningHand(hands[seat])) {
      const won = { type: "win", seat, hand: hands[seat].slice(), wall: wall.length, round: roundNo };
      resetRound();
      return [drawn, won];
    }
    const idx = chooseDiscardIndex(hands[seat], tile);
    const out = hands[seat][idx];
    hands[seat].splice(idx, 1);
    discards[seat].push(out);
    const discarded = { type: "discard", seat, tile: out, hand: hands[seat].slice(), wall: wall.length, round: roundNo };
    turn = (turn + 1) % 4;
    if (wall.length === 0) {
      const over = { type: "wallout", round: roundNo };
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
  const tileHTML = (t, cls) => {
    const classes = t === RED_DRAGON ? "tile rd" : "tile";
    return `<span class="${classes}${cls ? " " + cls : ""}">${t === RED_DRAGON ? RED_DRAGON_ICON : GLYPH[t]}</span>`;
  };

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

  // A round-ending event (win/wallout) already reshuffled the data for the
  // NEXT round by the time it's shown, so the fresh deal is only painted
  // once the following "draw" event arrives — see its `fresh` flag below.
  function show(e) {
    if (e.type === "win") {
      clearHighlights();
      renderHand(SIDES[e.seat], e.hand);
      sideEls[SIDES[e.seat]].classList.add("win");
      $("mj-turn").textContent = SIDE_NAME[SIDES[e.seat]] + " WINS!";
      $("mj-wall").textContent = e.wall;
      $("mj-round").textContent = e.round;
      return;
    }
    if (e.type === "wallout") {
      clearHighlights();
      $("mj-turn").textContent = "WALL EMPTY — ROUND OVER";
      $("mj-wall").textContent = 0;
      $("mj-round").textContent = e.round;
      return;
    }
    if (e.fresh) { renderAllHands(); renderAllDiscards(); }
    const side = SIDES[e.seat];
    if (e.type === "draw") {
      renderHand(side, e.hand, e.tile);
    } else {
      renderHand(side, e.hand);
      disEls[side].insertAdjacentHTML("beforeend", tileHTML(e.tile, "toss"));
    }
    clearHighlights();
    sideEls[side].classList.add("turn");
    $("mj-turn").textContent = SIDE_NAME[side];
    $("mj-wall").textContent = e.wall;
    $("mj-round").textContent = e.round;
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 900, 4: 320, 8: 160, 16: 70 }; // ms an event sits on screen
  const WAIT_MULT = { draw: 0.55, discard: 1, win: 3, wallout: 2.2 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true, timer = 0, queue = [], qi = 0, prevWasEnd = false;

  const running = () => !paused && inView && !document.hidden;

  function next() {
    if (qi >= queue.length) { queue = turnEvents(); qi = 0; }
    const e = queue[qi++];
    if (prevWasEnd && e.type === "draw") e.fresh = true;
    prevWasEnd = e.type === "win" || e.type === "wallout";
    return e;
  }
  const waitAfter = e => BASE[speed] * WAIT_MULT[e.type];
  function tick() {
    timer = 0;
    if (!running()) return;
    const e = next();
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
  $("mj-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(next());
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

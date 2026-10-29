// Extra exhibit: bridge. Four simulated players sit on the sides of a
// square table and play one standard "board" at a time — deal 13 cards
// each, a bidding auction to set the contract, then 13 tricks of play —
// exactly the real game's structure, just with simple/simulated bidding
// and card-play logic instead of real bridge strategy (see the heuristics
// below, each flagged as such). When a board finishes, the table reshuffles
// into the next board automatically.
//
// Deliberately self-contained, same as every other exhibit here: its own
// card encoding, its own evaluator-equivalent (handValue/analyzeHand), its
// own simplified bidding and trick-play heuristics. No shared engine with
// the poker exhibits or with mahjong.js.
//
// Simplifications, all intentional (see plan.md's "Future exhibits
// roadmap" — scope is the table/board display + simulated play, not a real
// bridge engine): dealer is always North (no rotating dealer/vulnerability);
// bidding only ever reaches a plain level+denomination contract (no
// doubles/redoubles, no conventions, no slam bidding beyond the natural
// level math below); every hand is shown face-up the whole time, including
// the declarer's — real bridge only exposes dummy, but this theme's other
// exhibits (e.g. Exhibit A's hole cards) already made the same legibility
// trade-off for a simulated demo.
//
// Markup it expects (see extra-exhibit.md): a <section id="br"> containing
// #br-table (figure) with four #br-side-{n,e,s,w} (each wrapping a .br-lbl
// and #br-h-{n,e,s,w}), four #br-tc-{n,e,s,w} trick-card slots, #br-board,
// #br-phase, #br-contract, #br-tricks-ns, #br-tricks-ew, #br-log, #br-play,
// #br-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- cards
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji, same as the poker exhibits.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const suitOf = c => (c / 13) | 0;
  const rankOf = c => c % 13;
  const SEATS = ["n", "e", "s", "w"]; // clockwise, matches real bidding/play rotation
  const SIDE_NAME = { n: "NORTH", e: "EAST", s: "SOUTH", w: "WEST" };
  const partnerOf = seat => (seat + 2) % 4;
  const sideOf = seat => (seat % 2 === 0 ? "NS" : "EW"); // seats 0,2 = N/S; 1,3 = E/W

  function shuffledDeck() {
    const d = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // ---------------------------------------------------------------- bidding (not real strategy)
  // High-card points (A=4 K=3 Q=2 J=1) plus one "length point" per card past
  // a 4-card suit. A rough bridge-table approximation, nothing more.
  const HCP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4];
  function suitCounts(hand) {
    const c = [0, 0, 0, 0];
    for (const card of hand) c[suitOf(card)]++;
    return c;
  }
  function handValue(hand) {
    const hcp = hand.reduce((s, c) => s + HCP[rankOf(c)], 0);
    const length = suitCounts(hand).reduce((s, n) => s + Math.max(0, n - 4), 0);
    return hcp + length;
  }
  function analyzeHand(hand) {
    const counts = suitCounts(hand);
    let best = 0;
    for (let s = 1; s < 4; s++) if (counts[s] > counts[best]) best = s;
    const balanced = counts.every(n => n >= 2 && n <= 5) && counts.filter(n => n === 5).length <= 1;
    return { suit: best, balanced };
  }
  // Bidding rank of a denomination, low to high: clubs, diamonds, hearts, spades, notrump.
  const SUIT_BID_RANK = [3, 2, 1, 0]; // indexed by suit 0..3 (spades..clubs)
  const denomRank = d => (d === "NT" ? 4 : SUIT_BID_RANK[d]);
  const bidVal = (level, denom) => level * 5 + denomRank(denom);
  const denomLabel = d => (d === "NT" ? "NT" : SUIT[d]);

  // Simulates one full auction. Each player in turn either passes or makes
  // the cheapest bid their (very roughly estimated) partnership strength
  // supports; ends after 3 passes following a bid, or 4 passes with none.
  function runAuction(hands) {
    const dealer = 0; // simplified: always seat 0 (north), like mahjong's fixed start
    const log = [];
    const firstToBid = {}; // `${side}-${denom}` -> seat that first named it (sets declarer)
    let current = null, passStreak = 0, totalBids = 0, seat = dealer, turns = 0;
    while (turns < 60) {
      const hv = handValue(hands[seat]);
      const { suit: bestSuit, balanced } = analyzeHand(hands[seat]);
      const partner = partnerOf(seat);
      const partnerBid = log.find(b => b.seat === partner && b.bid);
      const teamValue = hv + (partnerBid ? 6 : 0);
      let made = null;
      if (teamValue >= 12) {
        const level = Math.min(7, Math.floor(Math.max(0, teamValue - 12) / 3) + 1);
        const denom = balanced && teamValue >= 15 ? "NT" : bestSuit;
        const val = bidVal(level, denom);
        if (!current || val > current.val) made = { level, denom, val, seat };
      }
      if (made) {
        current = made; passStreak = 0; totalBids++;
        log.push({ seat, bid: made });
        const key = sideOf(seat) + "-" + made.denom;
        if (!(key in firstToBid)) firstToBid[key] = seat;
      } else {
        passStreak++;
        log.push({ seat, bid: null });
      }
      turns++;
      if (totalBids === 0 && passStreak === 4) return { log, contract: null };
      if (totalBids > 0 && passStreak === 3) break;
      seat = (seat + 1) % 4;
    }
    const side = sideOf(current.seat);
    const declarer = firstToBid[side + "-" + current.denom];
    return { log, contract: { level: current.level, denom: current.denom, side, declarer } };
  }

  // ---------------------------------------------------------------- play (not real strategy)
  // Follow suit and try to win as cheaply as possible; ruff cheaply when
  // void and no one has out-trumped yet; otherwise discard the lowest card
  // in hand. No signalling, no counting, no double-dummy analysis.
  function cardStrength(card, ledSuit, trump) {
    const s = suitOf(card), r = rankOf(card);
    if (trump != null && s === trump) return 100 + r;
    if (s === ledSuit) return r;
    return -1;
  }
  function trickWinner(trick, ledSuit, trump) {
    let best = trick[0], bestVal = cardStrength(best.card, ledSuit, trump);
    for (const entry of trick.slice(1)) {
      const v = cardStrength(entry.card, ledSuit, trump);
      if (v > bestVal) { best = entry; bestVal = v; }
    }
    return best.seat;
  }
  function chooseCard(hand, ledSuit, trump, trickSoFar) {
    const lowest = arr => arr.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
    const inLed = ledSuit == null ? [] : hand.filter(c => suitOf(c) === ledSuit);
    if (ledSuit != null && inLed.length) {
      const bestVal = trickSoFar.reduce((m, e) => Math.max(m, cardStrength(e.card, ledSuit, trump)), -1);
      const winners = inLed.filter(c => cardStrength(c, ledSuit, trump) > bestVal);
      return winners.length ? lowest(winners) : lowest(inLed);
    }
    if (ledSuit == null) { // opening lead: lowest card of the longest suit
      const counts = suitCounts(hand);
      let s = 0;
      for (let i = 1; i < 4; i++) if (counts[i] > counts[s]) s = i;
      return lowest(hand.filter(c => suitOf(c) === s));
    }
    if (trump != null) {
      const trumps = hand.filter(c => suitOf(c) === trump);
      if (trumps.length) {
        const bestTrump = trickSoFar.reduce((m, e) => (suitOf(e.card) === trump ? Math.max(m, rankOf(e.card)) : m), -1);
        const winners = trumps.filter(c => rankOf(c) > bestTrump);
        if (winners.length) return lowest(winners);
      }
    }
    return lowest(hand);
  }
  function playBoard(dealtHands, contract) {
    const trump = contract.denom === "NT" ? null : contract.denom;
    const hands = dealtHands.map(h => h.slice());
    const tricksWon = [0, 0, 0, 0];
    const events = [];
    let leader = (contract.declarer + 1) % 4;
    for (let t = 0; t < 13; t++) {
      const trick = [];
      let ledSuit = null;
      for (let k = 0; k < 4; k++) {
        const seat = (leader + k) % 4;
        const card = chooseCard(hands[seat], ledSuit, trump, trick);
        hands[seat].splice(hands[seat].indexOf(card), 1);
        trick.push({ seat, card });
        if (k === 0) ledSuit = suitOf(card);
        events.push({ type: "play", seat, card, trickNo: t });
      }
      const winner = trickWinner(trick, ledSuit, trump);
      tricksWon[winner]++;
      const ns = tricksWon[0] + tricksWon[2], ew = tricksWon[1] + tricksWon[3];
      events.push({ type: "trickWon", seat: winner, trickNo: t, ns, ew });
      leader = winner;
    }
    return events;
  }

  // ---------------------------------------------------------------- one full board
  function simulateBoard(boardNo) {
    const deck = shuffledDeck();
    const hands = [[], [], [], []];
    for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) hands[s].push(deck.pop());
    const events = [{ type: "deal", hands: hands.map(h => h.slice()), board: boardNo }];
    const { log, contract } = runAuction(hands);
    for (const b of log) events.push({ type: "bid", seat: b.seat, bid: b.bid, board: boardNo });
    if (!contract) {
      events.push({ type: "passedOut", board: boardNo });
      return events;
    }
    events.push({ type: "contract", contract, board: boardNo });
    const playEvents = playBoard(hands, contract);
    events.push(...playEvents);
    const need = 6 + contract.level;
    const last = playEvents[playEvents.length - 1];
    const made = (contract.side === "NS" ? last.ns : last.ew) >= need;
    const tricksMade = contract.side === "NS" ? last.ns : last.ew;
    events.push({ type: "result", board: boardNo, contract, need, tricksMade, made, diff: tricksMade - need });
    return events;
  }

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  if (!$("br-table")) return; // this page doesn't have the bridge markup

  const sideEls = {}, handEls = {}, tcEls = {};
  for (const s of SEATS) { sideEls[s] = $("br-side-" + s); handEls[s] = $("br-h-" + s); tcEls[s] = $("br-tc-" + s); }
  const cardText = c => RANK[rankOf(c)] + SUIT[suitOf(c)];
  const cardHTML = (c, cls) => `<span class="cd${cls ? " " + cls : ""}">${RANK[rankOf(c)]}<i>${SUIT[suitOf(c)]}</i></span>`;

  function renderHand(side, hand) {
    const bySuit = [[], [], [], []];
    for (const c of hand) bySuit[suitOf(c)].push(c);
    bySuit.forEach(arr => arr.sort((a, b) => rankOf(b) - rankOf(a)));
    handEls[side].innerHTML = bySuit.map((arr, si) =>
      `<div class="br-suit"><span class="sy">${SUIT[si]}</span><span>${arr.length ? arr.map(c => RANK[rankOf(c)]).join(" ") : "—"}</span></div>`
    ).join("");
  }
  function clearTrick() { SEATS.forEach(s => { tcEls[s].innerHTML = ""; }); }
  function clearHighlights() {
    SEATS.forEach(s => sideEls[s].classList.remove("turn", "declarer", "dummy"));
  }
  const logLines = [];
  function pushLog(line) {
    logLines.push(line);
    if (logLines.length > 6) logLines.shift();
    $("br-log").textContent = logLines.join("   ·   ");
  }

  // Live board state kept purely for rendering (hands shrink as cards are played).
  let liveHands = [[], [], [], []];

  function show(e) {
    if (e.type === "deal") {
      liveHands = e.hands.map(h => h.slice());
      SEATS.forEach((s, i) => renderHand(s, liveHands[i]));
      clearTrick();
      clearHighlights();
      logLines.length = 0;
      $("br-log").textContent = "—";
      $("br-board").textContent = e.board;
      $("br-phase").textContent = "BIDDING";
      $("br-contract").textContent = "—";
      $("br-info").textContent = "AUCTION";
      $("br-tricks-ns").textContent = "NS 0";
      $("br-tricks-ew").textContent = "EW 0";
      return;
    }
    if (e.type === "bid") {
      clearHighlights();
      sideEls[SEATS[e.seat]].classList.add("turn");
      pushLog(SIDE_NAME[SEATS[e.seat]][0] + ": " + (e.bid ? e.bid.level + denomLabel(e.bid.denom) : "PASS"));
      return;
    }
    if (e.type === "passedOut") {
      clearHighlights();
      $("br-phase").textContent = "PASSED OUT";
      $("br-info").textContent = "REDEALING";
      pushLog("ALL PASS — BOARD REDEALT");
      return;
    }
    if (e.type === "contract") {
      clearHighlights();
      const c = e.contract;
      sideEls[SEATS[c.declarer]].classList.add("declarer");
      sideEls[SEATS[partnerOf(c.declarer)]].classList.add("dummy");
      $("br-phase").textContent = "PLAY";
      $("br-contract").textContent = `${c.level}${denomLabel(c.denom)} BY ${SIDE_NAME[SEATS[c.declarer]]}`;
      $("br-info").textContent = `${c.level}${denomLabel(c.denom)} BY ${SIDE_NAME[SEATS[c.declarer]][0]}`;
      pushLog(`CONTRACT: ${c.level}${denomLabel(c.denom)} BY ${SIDE_NAME[SEATS[c.declarer]]}`);
      return;
    }
    if (e.type === "play") {
      const side = SEATS[e.seat];
      liveHands[e.seat].splice(liveHands[e.seat].indexOf(e.card), 1);
      renderHand(side, liveHands[e.seat]);
      tcEls[side].innerHTML = cardHTML(e.card, "new");
      clearHighlights();
      sideEls[side].classList.add("turn");
      return;
    }
    if (e.type === "trickWon") {
      $("br-tricks-ns").textContent = "NS " + e.ns;
      $("br-tricks-ew").textContent = "EW " + e.ew;
      clearHighlights();
      sideEls[SEATS[e.seat]].classList.add("turn");
      pushLog("TRICK " + (e.trickNo + 1) + " → " + SIDE_NAME[SEATS[e.seat]]);
      return;
    }
    if (e.type === "result") {
      clearTrick();
      const c = e.contract;
      const verdict = e.made ? `MADE +${e.diff}` : `DOWN ${-e.diff}`;
      $("br-phase").textContent = "RESULT";
      $("br-info").textContent = verdict;
      $("br-contract").textContent = `${c.level}${denomLabel(c.denom)} BY ${SIDE_NAME[SEATS[c.declarer]]}: ${verdict}`;
      pushLog(`RESULT: ${e.tricksMade}/${e.need + (e.made ? e.diff : 0)} TRICKS, ${verdict}`);
      return;
    }
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 900, 4: 320, 8: 160, 16: 70 };
  const WAIT_MULT = { deal: 2.5, bid: 1, passedOut: 2.5, contract: 2.5, play: 0.8, trickWon: 2, result: 3.5 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true, timer = 0;
  let boardNo = 1, events = simulateBoard(boardNo), k = -1;
  const running = () => !paused && inView && !document.hidden;

  function advance() {
    k++;
    if (k >= events.length) { events = simulateBoard(++boardNo); k = 0; }
    return events[k];
  }
  function tick() {
    timer = 0;
    if (!running()) return;
    const e = advance();
    show(e);
    timer = setTimeout(tick, BASE[speed] * WAIT_MULT[e.type]);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("br-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("br-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#br [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("br"));

  // ---------------------------------------------------------------- start
  show(events[0]);
  k = 0;
  syncPlay();
  if (paused) {
    // Reduced motion: jump straight to the result of this first board, still.
    while (k < events.length - 1) show(events[++k]);
  } else {
    kick();
  }
})();

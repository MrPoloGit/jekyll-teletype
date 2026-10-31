// Extra exhibit: blackjack. Two bot players and a dealer play one round at
// a time from a standard 52-card deck, reshuffled fresh every round. Real
// rules: aces count 11 unless that busts the hand, in which case they drop
// to 1 one at a time (so a hand can be "soft" or "hard"); a two-card 21
// is a blackjack and beats a dealer total of 21 reached with 3+ cards
// (blackjack vs. blackjack is a push); the dealer stands on any total of
// 17 or higher (the simpler of the two common casino rule variants — the
// other, "hits on soft 17," isn't modeled). Bot play is a single fixed
// threshold, not real strategy, same honesty convention as every other
// exhibit's bot logic: hit below 17, stand at 17 or above. Both bot hands
// and the dealer's are shown face-up the whole time — a real dealer hides
// one card until the players are done, but this theme's other card
// exhibits (Bridge in particular) already made the same
// legibility-over-realism trade-off.
//
// Markup it expects (see extra-exhibits.md): a <section id="bj"> containing
// #bj-round, #bj-status, #bj-hand-a, #bj-hand-b, #bj-hand-d, #bj-total-a,
// #bj-total-b, #bj-total-d, #bj-result, #bj-play, #bj-back, #bj-next, and
// [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- cards / rules
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji, same as the poker exhibits.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const rankOf = c => c % 13;
  const WHO = ["A", "B", "dealer"];
  const SEAT_NAME = { A: "BOT A", B: "BOT B", dealer: "DEALER" };

  function shuffledDeck() {
    const d = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  // Aces count 11 unless that busts the total, then drop to 1 one at a time.
  function handTotal(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      const r = rankOf(c);
      if (r === 12) { total += 11; aces++; }
      else if (r >= 7) total += 10; // 10, J, Q, K
      else total += r + 2; // 2-9
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  const isBlackjack = cards => cards.length === 2 && handTotal(cards) === 21;

  // ---------------------------------------------------------------- game state
  let deck, hands, roundNo;
  function resetRound() {
    deck = shuffledDeck();
    hands = { A: [], B: [], dealer: [] };
    for (let i = 0; i < 2; i++) for (const who of WHO) hands[who].push(deck.pop());
    roundNo = (roundNo || 0) + 1;
  }
  resetRound();

  // One card-by-card action for a seat: hit (draw, show new total, stop if
  // busted), or an immediate stand if already at 17+ or holding a natural
  // blackjack. Returns every event from this seat's whole turn.
  function playSeatTurn(who) {
    const events = [];
    if (isBlackjack(hands[who])) { events.push({ type: "blackjack", who }); return events; }
    while (true) {
      const total = handTotal(hands[who]);
      if (total >= 17) { events.push({ type: "stand", who, total }); break; }
      const card = deck.pop();
      hands[who].push(card);
      const newTotal = handTotal(hands[who]);
      events.push({ type: "hit", who, card, total: newTotal });
      if (newTotal > 21) { events.push({ type: "bust", who, total: newTotal }); break; }
    }
    return events;
  }
  function playDealerTurn() {
    const events = [];
    while (true) {
      const total = handTotal(hands.dealer);
      if (total >= 17) { events.push({ type: "dealer-stand", total }); break; }
      const card = deck.pop();
      hands.dealer.push(card);
      const newTotal = handTotal(hands.dealer);
      events.push({ type: "dealer-hit", card, total: newTotal });
      if (newTotal > 21) { events.push({ type: "dealer-bust", total: newTotal }); break; }
    }
    return events;
  }
  function resolveSeat(who) {
    const pTotal = handTotal(hands[who]), dTotal = handTotal(hands.dealer);
    const pBJ = isBlackjack(hands[who]), dBJ = isBlackjack(hands.dealer);
    if (pTotal > 21) return "lose";
    if (pBJ && dBJ) return "push";
    if (pBJ) return "blackjack";
    if (dBJ) return "lose";
    if (dTotal > 21) return "win";
    if (pTotal > dTotal) return "win";
    if (pTotal < dTotal) return "lose";
    return "push";
  }

  // A full round: deal, each bot's turn, the dealer's turn, then the
  // result for each seat — every event carries a full snapshot of all
  // three hands so the renderer (and Back/Next) never need the live
  // `hands` object, same pattern as every other exhibit's history model.
  function playRound() {
    const snap = () => ({ A: hands.A.slice(), B: hands.B.slice(), dealer: hands.dealer.slice() });
    const events = [{ type: "deal", hands: snap(), roundNo }];
    for (const who of ["A", "B"]) for (const e of playSeatTurn(who)) events.push({ ...e, hands: snap(), roundNo });
    for (const e of playDealerTurn()) events.push({ ...e, hands: snap(), roundNo });
    const results = { A: resolveSeat("A"), B: resolveSeat("B") };
    events.push({ type: "result", results, hands: snap(), roundNo });
    resetRound();
    return events;
  }

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  if (!$("bj-round")) return; // this page doesn't have the blackjack markup

  const handEls = { A: $("bj-hand-a"), B: $("bj-hand-b"), dealer: $("bj-hand-d") };
  const totalEls = { A: $("bj-total-a"), B: $("bj-total-b"), dealer: $("bj-total-d") };
  const cardHTML = c => `<span class="cd">${RANK[rankOf(c)]}<i>${SUIT[(c / 13) | 0]}</i></span>`;

  function renderHands(h) {
    for (const who of WHO) {
      handEls[who].innerHTML = h[who].map(cardHTML).join("");
      const t = handTotal(h[who]);
      totalEls[who].textContent = (who === "dealer" ? "DEALER " : SEAT_NAME[who] + " ") + t +
        (isBlackjack(h[who]) ? " — BLACKJACK" : t > 21 ? " — BUST" : "");
    }
  }
  const RESULT_WORD = { win: "WINS", lose: "LOSES", push: "PUSHES", blackjack: "BLACKJACK!" };

  function show(e) {
    renderHands(e.hands);
    $("bj-round").textContent = e.roundNo;
    if (e.type === "deal") {
      $("bj-status").textContent = "NEW ROUND DEALT";
      $("bj-result").textContent = "Standard rules, bots hit below 17 and stand at 17+ — not real strategy.";
      return;
    }
    if (e.type === "result") {
      $("bj-status").textContent = "ROUND OVER";
      $("bj-result").textContent = `Round #${e.roundNo - 1}: BOT A ${RESULT_WORD[e.results.A]}, BOT B ${RESULT_WORD[e.results.B]}. Reshuffling.`;
      return;
    }
    const who = e.who || "dealer";
    const name = SEAT_NAME[who];
    if (e.type === "blackjack") $("bj-status").textContent = name + " HAS BLACKJACK";
    else if (e.type === "hit" || e.type === "dealer-hit") $("bj-status").textContent = name + " HITS — " + e.total;
    else if (e.type === "stand" || e.type === "dealer-stand") $("bj-status").textContent = name + " STANDS AT " + e.total;
    else if (e.type === "bust" || e.type === "dealer-bust") $("bj-status").textContent = name + " BUSTS AT " + e.total;
    $("bj-result").textContent = "Standard rules, bots hit below 17 and stand at 17+ — not real strategy.";
  }

  // ---------------------------------------------------------------- playback
  const BASE = { 1: 1100, 4: 480, 8: 240, 16: 110 }; // ms an event sits on screen
  const DEAL_PAUSE = 1400, RESULT_PAUSE = 2200;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, timer = 0, queue = [], qi = 0;
  const running = () => !paused;

  function next() {
    if (qi >= queue.length) { queue = playRound(); qi = 0; }
    return queue[qi++];
  }
  // Same history pattern as every other exhibit here.
  let history = [], historyIndex = -1;
  function advance() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
    } else {
      history.push(next());
      if (history.length > 600) { history.shift(); historyIndex--; }
      historyIndex = history.length - 1;
    }
    return history[historyIndex];
  }

  function tick() {
    timer = 0;
    if (!running()) return;
    const e = advance();
    show(e);
    const wait = e.type === "deal" ? DEAL_PAUSE : e.type === "result" ? RESULT_PAUSE : BASE[speed];
    timer = setTimeout(tick, wait);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("bj-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("bj-back").addEventListener("click", () => {
    if (historyIndex <= 0) return;
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    historyIndex--;
    show(history[historyIndex]);
  });
  $("bj-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    show(advance());
  });
  const speedBtns = document.querySelectorAll("#bj [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
  }));

  // ---------------------------------------------------------------- start
  renderHands({ A: [], B: [], dealer: [] });
  $("bj-round").textContent = "0";
  $("bj-status").textContent = "—";
  $("bj-result").textContent = "Standard rules, bots hit below 17 and stand at 17+ — not real strategy.";
  syncPlay();
  if (!paused) kick();
})();

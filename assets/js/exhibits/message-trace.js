// Exhibit D: message trace. A sequence diagram of simulated heads-up poker —
// two bots and a dealer on one "wire", one message per row, newest at the
// bottom, scrolling as the hand plays. Each bot's reply carries a think time.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 3097.
// Self-contained — defines its own hand evaluator locally (marked
// `==== ENGINE START/END ====`, preserved below), same pattern as exhibits
// A and C: no shared dependency on the other exhibits' scripts.
//
// Markup it expects (see exhibits.md): a <section id="mt"> containing
// #mt-fig (with #mt-rows and three .mt-p/.mt-life pairs in #mt-head, in DOM
// order BOT A / DEALER / BOT B), #mt-hand, #mt-pot, #mt-a, #mt-b, #mt-play,
// #mt-next, and [data-speed] buttons.
(() => {
  "use strict";

  // ==== ENGINE START ====
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const CATS = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];
  const SB = 50, BB = 100, START = 10000, P5 = 13 ** 5;
  // Two bots with different temperaments; lat is [base, spread] reply time in ms.
  const BOTS = [{ tag: "A", name: "CFR-7", lat: [6, 24], agg: 0.55 }, { tag: "B", name: "NASH", lat: [2, 9], agg: 0.35 }];
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cardText = c => RANK[c % 13] + SUIT[(c / 13) | 0];
  const cardsText = cs => cs.map(cardText).join(" ");

  // Card c: rank c % 13 (0 = deuce, 12 = ace), suit c / 13. Works for 5 to 7 cards.
  function straightHigh(m) {
    for (let r = 12; r >= 4; r--) if (((m >> (r - 4)) & 31) === 31) return r;
    return (m & 0x100f) === 0x100f ? 3 : -1;
  }
  function topRanks(m, n, skip = []) {
    const out = [];
    for (let r = 12; r >= 0 && out.length < n; r--) if ((m >> r) & 1 && !skip.includes(r)) out.push(r);
    return out;
  }
  function score(cat, ks) {
    let s = cat;
    for (let i = 0; i < 5; i++) s = s * 13 + (ks[i] ?? 0);
    return s;
  }
  function evaluate(cards) {
    const rc = new Array(13).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
    let mask = 0;
    for (const c of cards) {
      const r = c % 13, s = (c / 13) | 0;
      rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r;
    }
    let fs = -1;
    for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
    if (fs >= 0) { const h = straightHigh(sm[fs]); if (h >= 0) return score(8, [h]); }
    const quads = [], trips = [], pairs = [];
    for (let r = 12; r >= 0; r--) {
      if (rc[r] === 4) quads.push(r); else if (rc[r] === 3) trips.push(r); else if (rc[r] === 2) pairs.push(r);
    }
    if (quads.length) return score(7, [quads[0], ...topRanks(mask, 1, [quads[0]])]);
    if (trips.length && (trips.length > 1 || pairs.length)) return score(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
    if (fs >= 0) return score(5, topRanks(sm[fs], 5));
    const st = straightHigh(mask);
    if (st >= 0) return score(4, [st]);
    if (trips.length) return score(3, [trips[0], ...topRanks(mask, 2, [trips[0]])]);
    if (pairs.length >= 2) return score(2, [pairs[0], pairs[1], ...topRanks(mask, 1, [pairs[0], pairs[1]])]);
    if (pairs.length) return score(1, [pairs[0], ...topRanks(mask, 3, [pairs[0]])]);
    return score(0, topRanks(mask, 5));
  }
  function handName(s) {
    const cat = Math.floor(s / P5);
    if (cat === 8 && Math.floor(s / 13 ** 4) % 13 === 12) return "ROYAL FLUSH";
    return CATS[cat];
  }

  // A bot sees only its own cards, so it rates its hand against a random one (Monte Carlo).
  function equityVsRandom(hole, board, iters) {
    const used = new Set([...hole, ...board]), rest = [];
    for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const need = 5 - board.length, b = board.slice();
    let win = 0;
    for (let it = 0; it < iters; it++) {
      for (let j = 0; j < need + 2; j++) {
        const k = j + ((Math.random() * (rest.length - j)) | 0);
        [rest[j], rest[k]] = [rest[k], rest[j]];
      }
      for (let j = 0; j < need; j++) b[board.length + j] = rest[j + 2];
      const me = evaluate([...hole, ...b]), op = evaluate([rest[0], rest[1], ...b]);
      win += me > op ? 1 : me === op ? 0.5 : 0;
    }
    return win / iters;
  }

  // Lanes: 0 BOT A, 1 DEALER, 2 BOT B. A message to ALL is a broadcast to both bots.
  // Kinds: bc broadcast, dl dealer to one bot, rq action request, rp bot reply, sep end of hand.
  const D = 1, ALL = 3, lane = i => (i ? 2 : 0);
  const seats = BOTS.map(b => ({ ...b, stack: START, cards: [], folded: false, bet: 0, total: 0 }));
  let handNo = 0, button = 1;

  // Plays one heads-up hand and returns every message on the wire, in order.
  // Heads-up: the button posts the small blind and acts first preflop; the big blind acts first after the flop.
  function simulateHand() {
    const out = [], board = [], hand = String(++handNo).padStart(6, "0");
    button ^= 1;
    const btn = button, bb = button ^ 1;
    let t = 0, street = 0;
    const pot = () => seats[0].total + seats[1].total;
    const canAct = p => !p.folded && p.stack > 0;
    const pay = (p, a) => { a = Math.min(a, p.stack); p.stack -= a; p.bet += a; p.total += a; return a; };
    const send = (from, to, full, short, kind, x = {}) => {
      t += kind === "rp" ? x.lat : out.length ? 0.2 + Math.random() * 0.8 : 0; // dealer turnaround under 1 ms
      out.push({ from, to, full, short: short || full, kind, t, hand, pot: pot(), stacks: seats.map(p => p.stack), ...x });
    };

    const reset = seats.some(p => p.stack < BB);
    for (const p of seats) Object.assign(p, { stack: reset ? START : p.stack, cards: [], folded: false, bet: 0, total: 0 });
    const deck = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    pay(seats[btn], SB); pay(seats[bb], BB);
    const A = seats[btn].tag, B = seats[bb].tag;
    send(D, ALL, `NEW HAND ${hand}: BOT ${A} SB ${SB}, BOT ${B} BB ${BB}`, `HAND ${hand}: ${A} SB, ${B} BB`, "bc");
    if (reset) send(D, ALL, `REBUY: BOTH STACKS RESET TO ${fmt(START)}`, `REBUY: STACKS ${fmt(START)}`, "bc");
    for (let r = 0; r < 2; r++) for (const i of [bb, btn]) seats[i].cards.push(deck.pop());
    for (const i of [bb, btn]) send(D, lane(i), `DEAL ${cardsText(seats[i].cards)}`, null, "dl");

    function round(first, cur) {
      let queue = [first, first ^ 1].filter(i => canAct(seats[i])), raises = 0;
      while (queue.length && !seats.some(p => p.folded)) {
        const i = queue.shift(), p = seats[i], o = seats[i ^ 1];
        if (!canAct(p)) continue;
        const toCall = cur - p.bet, potNow = pot(), owe = Math.min(toCall, p.stack);
        const ask = toCall > 0 ? `TO CALL ${fmt(owe)}` : cur > 0 ? "CHECK OR RAISE" : "CHECK OR BET";
        send(D, lane(i), `ACTION? ${ask}, POT ${fmt(potNow)}`, toCall > 0 ? `ACT? CALL ${fmt(owe)}` : cur > 0 ? "ACT? CHECK/RAISE" : "ACT? CHECK/BET", "rq", { seat: i });

        const e = equityVsRandom(p.cards, board, 160), r = Math.random();
        let kind;
        if (toCall > 0) {
          const odds = toCall / (potNow + toCall);
          if ((e > 0.6 && r < 0.25 + p.agg * 0.4 && raises < 3) || (r < 0.04 && raises < 2)) kind = "R";
          else if (e < odds + (street ? 0.1 : -0.02) && Math.random() < 0.85) kind = "F";
          else kind = "C";
        } else {
          kind = (e > 0.58 && r < 0.2 + p.agg * 0.5 && raises < 3) || r < 0.07 ? (cur > 0 ? "R" : "B") : "X";
        }
        // Nobody left to call a bet when the other bot is all-in.
        if ((kind === "R" || kind === "B") && !canAct(o)) kind = toCall > 0 ? "C" : "X";

        let text, short = null;
        if (kind === "F") { p.folded = true; text = "FOLD"; }
        else if (kind === "X") text = "CHECK";
        else if (kind === "C") { const amt = pay(p, toCall); text = (p.stack === 0 ? "ALL-IN " : "CALL ") + fmt(amt); }
        else {
          const size = Math.max(BB, Math.round((potNow * (0.5 + Math.random() * 0.6)) / 50) * 50);
          pay(p, cur + size - p.bet);
          if (p.bet > cur) { cur = p.bet; raises++; queue = canAct(o) ? [i ^ 1] : []; }
          if (p.stack === 0) text = "ALL-IN " + fmt(p.bet);
          else if (kind === "B") text = "BET " + fmt(p.bet);
          else { text = "RAISE TO " + fmt(p.bet); short = "RAISE " + fmt(p.bet); }
        }
        // Reply time: the bot's own speed, a little longer when facing a bet and on later streets.
        const lat = Math.max(1, Math.round(p.lat[0] + Math.random() * p.lat[1] + (toCall > 0 ? 3 : 0) + street * 2));
        send(lane(i), D, text, short, "rp", { seat: i, lat });
      }
    }

    round(btn, BB);
    for (const [name, count] of [["FLOP", 3], ["TURN", 1], ["RIVER", 1]]) {
      if (seats.some(p => p.folded)) break;
      for (const p of seats) p.bet = 0;
      deck.pop(); // burn
      for (let k = 0; k < count; k++) board.push(deck.pop());
      street++;
      const card = cardText(board[board.length - 1]);
      if (count === 3) send(D, ALL, `FLOP ${cardsText(board)}`, null, "bc");
      else send(D, ALL, `${name} ${card}, BOARD ${cardsText(board)}`, `${name} ${card}`, "bc");
      if (seats.every(canAct)) round(bb, 0);
    }

    // An uncalled bet goes back to its owner first, so a refund never reads as winnings.
    const hi = seats[0].total >= seats[1].total ? 0 : 1, excess = seats[hi].total - seats[hi ^ 1].total;
    if (excess > 0) {
      seats[hi].total -= excess; seats[hi].stack += excess;
      send(D, lane(hi), `RETURN ${fmt(excess)} UNCALLED`, `RETURN ${fmt(excess)}`, "dl");
    }
    const live = [0, 1].filter(i => !seats[i].folded), total = pot(), won = [0, 0];
    let what = "UNCONTESTED";
    if (live.length === 2) {
      const s = live.map(i => evaluate([...seats[i].cards, ...board]));
      send(D, ALL, `SHOWDOWN A: ${cardsText(seats[0].cards)}, B: ${cardsText(seats[1].cards)}`, `SHOWDOWN ${cardsText(seats[0].cards)} | ${cardsText(seats[1].cards)}`, "bc");
      if (s[0] === s[1]) won[0] = won[1] = total / 2; else won[s[0] > s[1] ? 0 : 1] = total;
      what = handName(Math.max(s[0], s[1]));
    } else won[live[0]] = total;
    const w = won[0] > won[1] ? 0 : won[1] > won[0] ? 1 : -1, net = w < 0 ? 0 : won[w] - seats[w].total;
    seats.forEach((p, i) => { p.stack += won[i]; p.total = 0; });
    if (w < 0) send(D, ALL, `POT ${fmt(total)} SPLIT, ${what}`, null, "bc");
    else send(D, ALL, `POT ${fmt(total)} AWARDED TO BOT ${seats[w].tag}, ${what}`, `POT ${fmt(total)} TO ${seats[w].tag}, ${what}`, "bc");
    const res = w < 0 ? "SPLIT POT" : `BOT ${seats[w].tag} +${fmt(net)}`;
    out.push({ kind: "sep", text: `END HAND ${hand}: ${res}, ${out.length} MSGS, ${(t / 1000).toFixed(3)} S`, hand, pot: 0, stacks: seats.map(p => p.stack), showdown: live.length === 2 });
    return out;
  }
  // ==== ENGINE END ====

  // ---------------------------------------------------------------- drawing
  const $ = id => document.getElementById(id);
  if (!$("mt-fig")) return; // this page doesn't have Exhibit D's markup
  const X = [8, 50, 92], VISIBLE = 10;
  const BASE = { 1: 640, 4: 160, 8: 80, 16: 40 }; // ms per message on screen; the timestamps are wire time
  const rowsEl = $("mt-rows"), parts = [...document.querySelectorAll("#mt-fig .mt-p")];
  const lats = [[], []];
  let n = 0, top = 0, msgNo = 0, live = [];

  const dual = (full, short) => (short === full ? full : `<span class="full">${full}</span><span class="short">${short}</span>`);
  function arrow(from, to, kind, d) {
    const a = Math.min(from, to), b = Math.max(from, to), right = to > from;
    const left = a === 1 ? "50%" : `calc(${X[0]}% + 4px)`, rt = b === 1 ? "50%" : `calc(${100 - X[2]}% + 3px)`;
    const head = kind === "rp"
      ? `<path d="${right ? "M1 .5 6.5 3.5 1 6.5" : "M6 .5 .5 3.5 6 6.5"}" fill="none" stroke="currentColor"/>`
      : `<path d="${right ? "M0 0 7 3.5 0 7z" : "M7 0 0 3.5 7 7z"}" fill="currentColor"/>`;
    return `<span class="mt-ar${kind === "rp" ? " rp" : ""} ${right ? "mt-e" : "mt-w"}" style="left:${left};right:${rt};--mt-d:${d}ms">` +
      `<svg width="7" height="7" viewBox="0 0 7 7">${head}</svg></span>`;
  }

  function scrollTo(still) {
    top = Math.max(0, n - VISIBLE);
    rowsEl.classList.toggle("jump", still);
    rowsEl.style.transform = `translateY(calc(${-top} * var(--mt-r)))`;
    if (still) void rowsEl.offsetHeight; // commit the jump before any transition comes back on
    while (live.length && live[0].i < top - 2) live.shift().el.remove();
  }
  // Keep row offsets small: every few hundred rows, shift the live ones back to the top.
  function rebase() {
    for (const r of live) { r.i -= top; r.el.style.top = `calc(${r.i} * var(--mt-r))`; }
    n -= top;
    scrollTo(true);
  }
  function addRow(html, still) {
    const el = document.createElement("div");
    el.className = "mt-row" + (still ? " still" : "");
    el.style.top = `calc(${n} * var(--mt-r))`;
    el.innerHTML = html;
    rowsEl.appendChild(el);
    live.push({ el, i: n++ });
    scrollTo(still);
    return el;
  }

  function show(m, wait, still) {
    const d = still ? 0 : Math.round(Math.min(220, BASE[speed] * 0.9));
    if (m.kind === "sep") addRow(`<span class="mt-sep"><span>${m.text}</span></span>`, still);
    else {
      msgNo++;
      const bc = m.kind === "bc", x = bc ? 50 : (X[m.from] + X[m.to]) / 2;
      const label = m.kind === "rp" ? dual(`${m.full}<em>${m.lat} MS</em>`, m.short) : dual(m.full, m.short);
      const ar = bc ? arrow(D, 0, "bc", d) + arrow(D, 2, "bc", d) : arrow(m.from, m.to, m.kind, d);
      const act = m.kind === "rq" ? `<span class="mt-act" style="--x:${X[m.to]}%"></span>` : "";
      const el = addRow(`<span class="mt-ts"><span class="full">+</span>${(m.t / 1000).toFixed(3)}</span>` +
        `<span class="mt-lb${bc ? " bc" : ""}" style="left:${x}%">${label}</span>${ar}${act}`, still);
      if (act) {
        const box = el.lastChild;
        box.style.transitionDuration = (still ? 0 : Math.round(wait)) + "ms";
        void box.offsetHeight; // start the growth from the collapsed box
        box.classList.add("on");
      }
      if (m.kind === "rp") { const L = lats[m.seat]; L.push(m.lat); if (L.length > 50) L.shift(); }
    }
    parts[0].classList.toggle("on", m.kind === "rq" && m.to === 0);
    parts[2].classList.toggle("on", m.kind === "rq" && m.to === 2);

    $("mt-hand").innerHTML = `HAND ${m.hand}<span class="full">, BLINDS 50/100</span>`;
    $("mt-pot").textContent = `POT ${fmt(m.pot)}, MSG ${String(msgNo).padStart(6, "0")}`;
    [0, 1].forEach(i => {
      const L = lats[i], avg = L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : 0, s = fmt(m.stacks[i]);
      $(i ? "mt-b" : "mt-a").innerHTML = `<span class="full">BOT ${BOTS[i].tag} ${BOTS[i].name}: ${s} CHIPS, AVG REPLY ${avg} MS</span>` +
        `<span class="short">${BOTS[i].tag} ${s}, ${avg} MS AVG</span>`;
    });
  }

  // ---------------------------------------------------------------- playback
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true, timer = 0, queue = [], qi = 0;
  const running = () => !paused && inView && !document.hidden;

  function next() {
    if (qi >= queue.length) {
      if (top > 400) rebase();
      queue = simulateHand(); qi = 0;
    }
    return queue[qi++];
  }
  // Time on screen until the next message. Before a reply, it follows that bot's think time.
  function waitAfter(m) {
    const nx = queue[qi];
    const w = m.kind === "sep" ? 5 : nx && nx.kind === "rp" ? 0.8 + nx.lat / 10 : m.kind === "bc" ? 1.6 : 1;
    return BASE[speed] * w;
  }
  function tick() {
    timer = 0;
    if (!running()) return;
    const m = next(), w = waitAfter(m);
    show(m, w, false);
    timer = setTimeout(tick, w);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  const playBtn = $("mt-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  $("mt-next").addEventListener("click", () => {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    const m = next();
    show(m, waitAfter(m), false);
  });
  const speedBtns = document.querySelectorAll("#mt [data-speed]");
  speedBtns.forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    speedBtns.forEach(x => x.setAttribute("aria-pressed", x === b));
    $("mt-fig").style.setProperty("--mt-s", Math.min(160, BASE[speed]) + "ms");
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("mt"));

  // ---------------------------------------------------------------- start
  // Open on one finished hand that reached a showdown, drawn at once: the still frame for reduced motion.
  let first = simulateHand();
  for (let tries = 0; tries < 30 && !first[first.length - 1].showdown; tries++) first = simulateHand();
  for (const m of first) show(m, 0, true);
  syncPlay();
  kick();
})();

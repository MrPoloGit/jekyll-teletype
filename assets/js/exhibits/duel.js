// Exhibit C: heads-up duel. Two bots play heads-up no-limit hold'em,
// printing their reasoning into a terminal on each side as a packet crosses
// the "wire" between them; tracks a running chip-lead sparkline.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 2668.
// Self-contained — defines its own hand evaluator (marked ENGINE START/END
// below) rather than sharing one with exhibits B/E, same as Exhibit A.
//
// Markup it expects (see exhibits.md): a <section id="duel"> containing
// #du-s0/#du-s1 (each with .du-pos/.du-stk/.du-hole/.du-term rows),
// #du-hand, #du-street, #du-board, #du-pot, #du-pkt, #du-eq0/#du-bar/#du-eq1,
// #du-n, #du-won, #du-split, #du-lead, #du-rate, #du-result, #du-spark
// (canvas), #du-play, and [data-speed] buttons.
(() => {
  "use strict";

  // ==== ENGINE START ====
  // ---------------------------------------------------------------- cards
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const NAMES = ["CFR-7", "MONTE"];
  const CATS = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];
  const SB = 50, BB = 100, START = 10000, P5 = 13 ** 5;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const signed = n => (n > 0 ? "+" : "") + fmt(n);
  const dec = x => x.toFixed(2).replace(/^0/, "");
  const cardText = c => RANK[c % 13] + SUIT[(c / 13) | 0];

  // ---------------------------------------------------------------- evaluator
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

  // ---------------------------------------------------------------- equity
  // A rough preflop score, used only to narrow the hands an aggressive opponent might hold.
  function pre(a, b) {
    const x = a % 13, y = b % 13, hi = Math.max(x, y), lo = Math.min(x, y);
    return hi * 2 + lo + (x === y ? 26 : 0) + (((a / 13) | 0) === ((b / 13) | 0) ? 4 : 0) - Math.min(4, Math.max(0, hi - lo - 1));
  }
  const PRE = [];
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) PRE.push(pre(a, b));
  PRE.sort((x, y) => y - x);
  // Range by the opponent's bets and raises so far this hand: all hands, then about the top
  // 60%, 35% and 20%. TOP is the share that really passes each cut, as the bot prints it.
  const CUT = [1, 0.6, 0.35, 0.2].map(t => (t >= 1 ? -1 : PRE[Math.round(t * PRE.length) - 1]));
  const TOP = CUT.map(c => Math.round((100 * PRE.filter(x => x >= c).length) / PRE.length));

  // Monte Carlo win share of one known hand against an unknown one (ties count half).
  // Opponent hands scoring under cut are resampled, which is how a range is applied.
  function eqVs(hole, board, iters, cut) {
    const dead = new Set([...hole, ...board]), rest = [];
    for (let c = 0; c < 52; c++) if (!dead.has(c)) rest.push(c);
    const need = 5 - board.length, b = board.slice();
    let win = 0, n = 0, tries = 0;
    while (n < iters && tries++ < iters * 8) {
      for (let j = 0; j < need + 2; j++) {
        const k = j + ((Math.random() * (rest.length - j)) | 0);
        [rest[j], rest[k]] = [rest[k], rest[j]];
      }
      if (cut >= 0 && pre(rest[0], rest[1]) < cut) continue;
      for (let j = 0; j < need; j++) b[board.length + j] = rest[2 + j];
      const me = evaluate([hole[0], hole[1], ...b]), op = evaluate([rest[0], rest[1], ...b]);
      win += me > op ? 1 : me === op ? 0.5 : 0;
      n++;
    }
    return { eq: n ? win / n : 0.5, n };
  }

  // The spectator's number: both hands known. Exact from the flop on, sampled preflop.
  function trueEq(h0, h1, board) {
    const used = new Set([...h0, ...h1, ...board]), rest = [];
    for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    let w = 0, n = 0;
    const run = extra => {
      const s0 = evaluate([...h0, ...board, ...extra]), s1 = evaluate([...h1, ...board, ...extra]);
      w += s0 > s1 ? 1 : s0 === s1 ? 0.5 : 0; n++;
    };
    const need = 5 - board.length;
    if (need === 0) run([]);
    else if (need === 1) for (const c of rest) run([c]);
    else if (need === 2) { for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) run([rest[i], rest[j]]); }
    else for (let it = 0; it < 500; it++) {
      for (let j = 0; j < 5; j++) {
        const k = j + ((Math.random() * (rest.length - j)) | 0);
        [rest[j], rest[k]] = [rest[k], rest[j]];
      }
      run(rest.slice(0, 5));
    }
    return w / n;
  }

  // ---------------------------------------------------------------- the two bots
  // Both price their options the same way and differ in how they estimate equity and choose.
  // CFR-7: equity against a range, then a mixed strategy over the options' values.
  // MONTE: equity against any two cards with more rollouts in bigger pots, then the best value.
  const BOTS = [
    { range: true, mix: true, size: 0.66, fe: 0.3, tax: 0.06 },
    { range: false, mix: false, size: 0.8, fe: 0.2, tax: 0.08 },
  ];
  const WORD = { C: "CALL", X: "CHECK", B: "BET", R: "RAISE" };

  // Value of each option in chips, measured from now, ignoring later streets:
  // fold 0; check eq x pot; call eq x (pot + call) - call; bet or raise: the opponent folds
  // with an assumed rate, otherwise calls with a hand a little better than the range.
  function decide(P, i, board, cur, raises, minRaise) {
    const bot = BOTS[i], me = P[i], op = P[1 - i];
    const toCall = op.bet - me.bet, pot = P[0].total + P[1].total, think = [];
    let eq;
    if (bot.range) {
      const lvl = Math.min(op.aggr, 3);
      eq = eqVs(me.cards, board, 300, CUT[lvl]).eq;
      think.push(`> EQ ${dec(eq)} VS TOP ${TOP[lvl]}%`);
    } else {
      const r = eqVs(me.cards, board, Math.min(1000, 200 + Math.round(pot / 1000) * 50), -1);
      eq = r.eq;
      think.push(`> EQ ${dec(eq)}±${dec(Math.sqrt((eq * (1 - eq)) / r.n))} N${r.n}`);
    }
    think.push(toCall > 0 ? `> POT ODDS ${dec(toCall / (pot + toCall))}` : `> SPR ${(me.stack / pot).toFixed(1)}`);
    const opts = [];
    if (toCall > 0) opts.push({ k: "F", ev: 0 });
    opts.push(toCall > 0 ? { k: "C", ev: eq * (pot + toCall) - toCall } : { k: "X", ev: eq * pot });
    if (me.stack > toCall && op.stack > 0 && raises < 3) {
      let to = op.bet + Math.round((bot.size * (pot + toCall)) / 50) * 50;
      to = Math.min(me.bet + me.stack, Math.max(to, op.bet + minRaise));
      const put = to - me.bet, fe = bot.fe / (1 + raises), eqc = Math.max(0, eq - bot.tax * (1 + raises));
      opts.push({ k: cur > 0 ? "R" : "B", to, ev: fe * pot + (1 - fe) * (eqc * (pot + put + to - op.bet) - put) });
    }
    for (const o of opts) if (o.k !== "F") think.push(`> EV(${WORD[o.k]}) ${signed(o.ev)}`);
    let pick = opts.reduce((a, b) => (b.ev > a.ev ? b : a));
    if (bot.mix) {
      // Softmax over value: options an eighth of the pot apart differ by a factor of e.
      const T = 0.12 * pot, w = opts.map(o => Math.exp((o.ev - pick.ev) / T)), sum = w.reduce((a, b) => a + b, 0);
      let x = Math.random() * sum;
      think.push("> MIX " + opts.map((o, j) => o.k + dec(w[j] / sum)).join(" "));
      for (let j = 0; j < opts.length; j++) if ((x -= w[j]) < 0) { pick = opts[j]; break; }
    }
    return { k: pick.k, to: pick.to, think };
  }

  // ---------------------------------------------------------------- one hand
  // Plays a whole hand up front and returns its steps. In heads-up the dealer posts the small
  // blind and acts first before the flop; the big blind acts first after it.
  let handNo = 0, dealer = 1;
  function playHand() {
    handNo++; dealer = 1 - dealer;
    const deck = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const P = [0, 1].map(() => ({ stack: START, bet: 0, total: 0, cards: [], aggr: 0, folded: false }));
    const board = [], steps = [], sb = dealer, bb = 1 - dealer, tag = String(handNo).padStart(6, "0");
    let street = "PREFLOP", eq = null, show = false, turn = -1;
    const pot = () => P[0].total + P[1].total;
    const pay = (p, a) => { a = Math.min(a, p.stack); p.stack -= a; p.bet += a; p.total += a; return a; };
    const step = (wait, lines, extra) => steps.push({
      wait, lines, ...extra,
      s: { hand: handNo, dealer, street, board: board.slice(), pot: pot(), stacks: P.map(p => p.stack), cards: P.map(p => p.cards.slice()), eq, show, turn },
    });
    const dealerSays = f => [0, 1].map(i => [i, "= " + f(i), "d"]);
    const reEq = () => { const e = trueEq(P[0].cards, P[1].cards, board); eq = [e, 1 - e]; };
    const reveal = () => { show = true; step(3, dealerSays(i => "OPP " + P[1 - i].cards.map(cardText).join(" "))); };

    pay(P[sb], SB); pay(P[bb], BB);
    step(2, dealerSays(i => `HAND ${tag}, ${i === sb ? "SB 50" : "BB 100"}`), { fresh: true });
    for (let r = 0; r < 2; r++) { P[bb].cards.push(deck.pop()); P[sb].cards.push(deck.pop()); }
    reEq();
    step(2, dealerSays(i => "HOLE " + P[i].cards.map(cardText).join(" ")));

    function round(first) {
      let cur = Math.max(P[0].bet, P[1].bet), raises = 0, minRaise = BB, queue = [first, 1 - first];
      while (queue.length) {
        const i = queue.shift(), me = P[i], op = P[1 - i];
        if (me.stack === 0 || (op.stack === 0 && me.bet >= op.bet)) continue;
        turn = i;
        const d = decide(P, i, board, cur, raises, minRaise);
        for (const t of d.think) step(1, [[i, t]]);
        let text;
        if (d.k === "F") { me.folded = true; text = "FOLD"; }
        else if (d.k === "X") text = "CHECK";
        else if (d.k === "C") { const a = pay(me, op.bet - me.bet); text = (me.stack ? "CALL " : "ALL-IN ") + fmt(a); }
        else {
          pay(me, d.to - me.bet);
          minRaise = Math.max(minRaise, me.bet - cur); cur = me.bet; raises++; me.aggr++;
          queue = [1 - i];
          text = (me.stack ? (d.k === "B" ? "BET " : "RAISE TO ") : "ALL-IN ") + fmt(me.bet);
        }
        step(2, [[i, "> " + text, "a"]], { pkt: { from: i, text } });
        turn = -1;
        step(1, [[1 - i, "< " + text]]);
        if (me.folded) return;
      }
    }

    round(sb);
    for (const [name, count] of [["FLOP", 3], ["TURN", 1], ["RIVER", 1]]) {
      if (P[0].folded || P[1].folded) break;
      const allIn = P[0].stack === 0 || P[1].stack === 0;
      if (allIn && !show) reveal(); // hands are tabled once nobody can bet
      P.forEach(p => { p.bet = 0; });
      deck.pop(); // burn
      for (let k = 0; k < count; k++) board.push(deck.pop());
      street = name;
      reEq();
      step(allIn ? 4 : 2, dealerSays(() => name + " " + board.slice(-count).map(cardText).join(" ")));
      if (!allIn) round(bb);
    }

    // An uncalled bet goes back to its owner first, so a refund never reads as winnings.
    const live = [0, 1].filter(i => !P[i].folded), hi = P[0].total > P[1].total ? 0 : 1;
    const excess = P[hi].total - P[1 - hi].total;
    if (excess > 0) { P[hi].total -= excess; P[hi].stack += excess; }
    const total = pot(), won = [0, 0];
    let label = "UNCONTESTED";
    if (live.length === 2) {
      if (!show) reveal();
      const sc = P.map(p => evaluate([...p.cards, ...board]));
      if (sc[0] === sc[1]) won[0] = won[1] = total / 2;
      else won[sc[0] > sc[1] ? 0 : 1] = total;
      label = handName(Math.max(sc[0], sc[1]));
      street = "SHOWDOWN";
    } else won[live[0]] = total;
    P.forEach((p, i) => { p.stack += won[i]; });
    eq = won.map(w => w / total);
    const net = P.map(p => p.stack - START), winner = net[0] > 0 ? 0 : net[1] > 0 ? 1 : -1;
    step(20, dealerSays(i => (winner < 0 ? "SPLIT POT" : (net[i] > 0 ? "WIN " : "LOSE ") + signed(net[i]))),
      { end: { net, winner, label, total, showdown: live.length === 2 } });
    return steps;
  }
  // ==== ENGINE END ====

  // ---------------------------------------------------------------- view
  const $ = id => document.getElementById(id);
  if (!$("duel")) return; // this page doesn't have Exhibit C's markup
  const ROWS = 6, TICK = { 1: 200, 4: 55, 8: 28, 16: 14 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true, timer = 0;
  const running = () => !paused && inView && !document.hidden;

  const face = (c, cls) => `<span class="cd${cls}">${RANK[c % 13]}<i>${SUIT[(c / 13) | 0]}</i></span>`;
  const SLOT = `<span class="cd slot"></span>`;
  const sides = [0, 1].map(i => {
    const el = $("du-s" + i);
    return {
      el, pos: el.querySelector(".du-pos"), stk: el.querySelector(".du-stk"), hole: el.querySelector(".du-hole"),
      rows: [...el.querySelectorAll(".du-term > div")], lines: [], key: null,
    };
  });
  const boardEl = $("du-board"), pkt = $("du-pkt"), bar = $("du-bar"), spark = $("du-spark"), sctx = spark.getContext("2d");
  let boardKey = null, pktAnim = null;

  // The terminal keeps its last six lines; the newest one types itself in.
  function print(i, text, cls, animate) {
    const sd = sides[i];
    sd.lines.push([text, cls || ""]);
    if (sd.lines.length > ROWS) sd.lines.shift();
    sd.rows.forEach((row, r) => {
      const ln = sd.lines[r] || ["", ""];
      row.textContent = ln[0]; row.className = ln[1];
    });
    if (animate && !reduce) {
      sd.rows[sd.lines.length - 1].animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        { duration: Math.min(200, TICK[speed] * 0.8), easing: `steps(${Math.min(12, text.length)})` });
    }
  }

  // Each move crosses the wire as a packet, from the bot that made it to the other one.
  function send(from, text, animate) {
    if (pktAnim) pktAnim.cancel();
    pkt.textContent = from === 0 ? text + " >" : "< " + text;
    pkt.style.visibility = "visible";
    const ends = [{ left: "0%", transform: "translate(0, -50%)" }, { left: "100%", transform: "translate(-100%, -50%)" }];
    const [a, b] = from === 0 ? ends : ends.reverse();
    Object.assign(pkt.style, b);
    pktAnim = animate && !reduce ? pkt.animate([a, b], { duration: TICK[speed] * 1.8, easing: "steps(8, end)" }) : null;
  }

  const stats = { hands: 0, won: [0, 0], split: 0, diff: 0, hist: [0] };
  function record(end) {
    stats.hands++;
    if (end.winner < 0) stats.split++; else stats.won[end.winner]++;
    stats.diff += end.net[0];
    stats.hist.push(stats.diff);
    if (stats.hist.length > 101) stats.hist.shift();
    const d = stats.diff;
    $("du-n").textContent = fmt(stats.hands);
    $("du-won").textContent = `WON: CFR-7 ${fmt(stats.won[0])}, MONTE ${fmt(stats.won[1])}`;
    $("du-split").textContent = `, SPLIT ${fmt(stats.split)}`;
    $("du-lead").textContent = d ? `${NAMES[d > 0 ? 0 : 1]} +${fmt(Math.abs(d))}` : "EVEN";
    $("du-rate").textContent = d ? ` (+${((Math.abs(d) / BB / stats.hands) * 100).toFixed(1)} BB/100)` : "";
    drawSpark();
  }

  // 1px line of CFR-7's net chips (MONTE's is its mirror); zero is the faint middle line.
  function drawSpark() {
    const w = spark.clientWidth, h = spark.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    if (spark.width !== Math.round(w * dpr) || spark.height !== Math.round(h * dpr)) {
      spark.width = Math.round(w * dpr); spark.height = Math.round(h * dpr);
    }
    const css = getComputedStyle(spark);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, w, h);
    sctx.lineWidth = 1;
    const mid = Math.floor(h / 2) + 0.5, H = stats.hist, max = Math.max(BB * 10, ...H.map(Math.abs));
    sctx.strokeStyle = css.getPropertyValue("--faint").trim();
    sctx.beginPath(); sctx.moveTo(0, mid); sctx.lineTo(w, mid); sctx.stroke();
    sctx.strokeStyle = sctx.fillStyle = css.getPropertyValue("--ink").trim();
    sctx.beginPath();
    let x = 0, y = mid;
    H.forEach((v, j) => {
      x = 1 + (j / 100) * (w - 3); y = mid - (v / max) * (h / 2 - 1.5);
      if (j) sctx.lineTo(x, y); else sctx.moveTo(x, y);
    });
    sctx.stroke();
    sctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }

  const resultText = e => e.winner < 0
    ? `SPLIT POT ${fmt(e.total)}, ${e.label}`
    : `${NAMES[e.winner]} WINS ${fmt(e.total)}, ${e.label}`;

  function render(st, animate) {
    const s = st.s;
    if (st.fresh) { if (pktAnim) pktAnim.cancel(); pkt.style.visibility = "hidden"; }
    sides.forEach((sd, i) => {
      sd.el.classList.toggle("turn", s.turn === i);
      sd.el.classList.toggle("win", !!st.end && st.end.winner === i);
      sd.pos.textContent = s.dealer === i ? "SB" : "BB";
      sd.stk.textContent = fmt(s.stacks[i]);
      const cards = s.cards[i], key = cards.join(",") + (s.show ? "+" : "");
      if (key !== sd.key) {
        const fx = animate ? (s.show ? " flip" : " new") : "";
        sd.hole.innerHTML = cards.length ? cards.map(c => (s.show ? face(c, fx) : `<span class="cd back${fx}"></span>`)).join("") : SLOT + SLOT;
        sd.key = key;
      }
    });
    const bkey = s.board.join(",");
    if (bkey !== boardKey) {
      const had = boardKey && s.board.length ? boardKey.split(",").length : 0;
      boardEl.innerHTML = [0, 1, 2, 3, 4].map(j => (j < s.board.length ? face(s.board[j], animate && j >= had ? " new" : "") : SLOT)).join("");
      boardKey = bkey;
    }
    $("du-hand").textContent = "HAND " + String(s.hand).padStart(6, "0");
    $("du-street").textContent = s.street;
    $("du-pot").textContent = "POT " + fmt(s.pot);
    $("du-eq0").textContent = s.eq ? Math.round(s.eq[0] * 100) + "%" : "--";
    $("du-eq1").textContent = s.eq ? 100 - Math.round(s.eq[0] * 100) + "%" : "--";
    bar.style.width = (s.eq ? s.eq[0] * 100 : 50) + "%";
    for (const [i, text, cls] of st.lines) print(i, text, cls, animate);
    if (st.pkt) send(st.pkt.from, st.pkt.text, animate);
    if (st.end) record(st.end);
    $("du-result").textContent = st.end ? resultText(st.end) : "IN PLAY";
  }

  // ---------------------------------------------------------------- loop
  let hand = playHand(), at = -1;
  function tick() {
    timer = 0;
    if (!running()) return;
    if (at >= hand.length - 1) { hand = playHand(); at = -1; }
    render(hand[++at], true);
    timer = setTimeout(tick, TICK[speed] * hand[at].wait);
  }
  function kick() { if (!timer && running()) timer = setTimeout(tick, 0); }

  // ---------------------------------------------------------------- controls
  const playBtn = $("du-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => {
    paused = !paused;
    if (paused) { clearTimeout(timer); timer = 0; }
    syncPlay(); kick();
  });
  document.querySelectorAll("#duel [data-speed]").forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll("#duel [data-speed]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("duel"));
  new ResizeObserver(drawSpark).observe(spark);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawSpark);

  // ---------------------------------------------------------------- start
  syncPlay();
  if (paused) {
    // Reduced motion: the end of a hand that went to showdown, still.
    for (let n = 0; ; n++) {
      hand.forEach(st => render(st, false));
      at = hand.length - 1;
      if (hand[at].end.showdown || n >= 30) break;
      hand = playHand();
    }
  } else {
    kick();
  }
})();

// Exhibit A: live tables. A full (small) poker engine — hand evaluator, bot
// decision logic, hand simulation — plus a featured-table view, per-seat
// action strips, and a canvas grid of many simulated tables playing at once.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 1182.
// Self-contained — no shared dependency on the other exhibits' scripts.
//
// Markup it expects (see exhibits.md): a <section id="exhibit"> containing
// #hands, #hps, #grid (canvas), #shown, #table (figure with .felt/.center/
// #board/#pot), #strips (empty div), #handinfo, #street, and the replay
// buttons #first/#prev/#play/#next plus [data-speed] buttons.
(() => {
  "use strict";

  // ---------------------------------------------------------------- cards
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const NAMES = ["CFR-7", "NASH", "MONTE", "TILT", "GTO-LITE", "RIVERRAT", "FOLDBOT", "BAYES"];
  const CATS = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];
  const N = 8, SB = 50, BB = 100, START = 10000, P5 = 13 ** 5;
  const fmt = n => n.toLocaleString("en-US");

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

  // Monte Carlo win share for every live seat. Folded hands count as dead cards.
  function equity(seats, board, iters) {
    const live = [];
    seats.forEach((p, i) => { if (!p.folded) live.push(i); });
    const eq = new Array(N).fill(0);
    if (live.length === 1) { eq[live[0]] = 1; return eq; }
    const used = new Set(board);
    for (const p of seats) for (const c of p.cards) used.add(c);
    const rest = [];
    for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const need = 5 - board.length, runs = need === 0 ? 1 : iters;
    const b = board.slice();
    for (let it = 0; it < runs; it++) {
      for (let j = 0; j < need; j++) {
        const k = j + ((Math.random() * (rest.length - j)) | 0);
        [rest[j], rest[k]] = [rest[k], rest[j]];
        b[board.length + j] = rest[j];
      }
      let best = -1, win = [];
      for (const i of live) {
        const s = evaluate([seats[i].cards[0], seats[i].cards[1], ...b]);
        if (s > best) { best = s; win = [i]; } else if (s === best) win.push(i);
      }
      for (const i of win) eq[i] += 1 / win.length;
    }
    return eq.map(x => x / runs);
  }

  // ---------------------------------------------------------------- hand simulation
  // Plays one full hand up front and returns its timeline of snapshots.
  const seats = NAMES.map(name => ({ name, stack: START, cards: [], folded: false, bet: 0, total: 0, eq: 0 }));
  let dealer = -1, handNo = 0;

  function simulateHand() {
    const ev = [];
    handNo++;
    for (const p of seats) {
      if (p.stack < BB) p.stack = START; // rebuy
      Object.assign(p, { cards: [], folded: false, bet: 0, total: 0, eq: 0 });
    }
    const deck = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const board = [];
    let street = "PREFLOP";
    dealer = (dealer + 1) % N;

    const nxt = i => (i + 1) % N;
    const live = () => seats.filter(p => !p.folded);
    const canAct = p => !p.folded && p.stack > 0;
    const pot = () => seats.reduce((a, p) => a + p.total, 0);
    const pay = (p, a) => { a = Math.min(a, p.stack); p.stack -= a; p.bet += a; p.total += a; return a; };
    const reEq = iters => { const e = equity(seats, board, iters); seats.forEach((p, i) => { p.eq = e[i]; }); };
    const snap = (type, extra = {}) => ev.push({
      type, street, hand: handNo, dealer, board: board.slice(), pot: pot(),
      seats: seats.map(p => ({ stack: p.stack, folded: p.folded, eq: p.eq, cards: p.cards.slice() })),
      ...extra,
    });

    snap("start");
    const sb = nxt(dealer), bb = nxt(sb);
    pay(seats[sb], SB); snap("act", { seat: sb, kind: "b", text: "SB " + SB });
    pay(seats[bb], BB); snap("act", { seat: bb, kind: "b", text: "BB " + BB });
    for (let r = 0; r < 2; r++) for (let k = 1; k <= N; k++) seats[(dealer + k) % N].cards.push(deck.pop());
    reEq(300);
    snap("deal");

    function round(first, cur) {
      let queue = [];
      for (let k = 0; k < N; k++) { const i = (first + k) % N; if (canAct(seats[i])) queue.push(i); }
      let raises = 0;
      while (queue.length && live().length > 1) {
        const i = queue.shift(), p = seats[i];
        if (!canAct(p)) continue;
        const toCall = cur - p.bet, strength = p.eq * live().length, r = Math.random(), potNow = pot();
        let kind;
        if (toCall > 0) {
          const odds = toCall / (potNow + toCall);
          if ((strength > 1.7 && r < 0.45 && raises < 3) || (r < 0.03 && raises < 2)) kind = "R";
          else if ((street === "PREFLOP" ? strength < 0.9 : p.eq < odds * 0.7) && Math.random() < 0.8) kind = "F";
          else kind = "C";
        } else {
          // The big blind's option is a raise, not a bet: there is already a bet to beat.
          kind = (strength > 1.3 && r < 0.5 && raises < 3) || r < 0.05 ? (cur > 0 ? "R" : "B") : "X";
        }
        // With every other live player all-in there is nobody left to call a bet.
        if ((kind === "R" || kind === "B") && !seats.some((q, j) => j !== i && canAct(q))) kind = toCall > 0 ? "C" : "X";
        if (kind === "F") { p.folded = true; reEq(200); snap("act", { seat: i, kind, text: "FOLD" }); continue; }
        if (kind === "X") { snap("act", { seat: i, kind, text: "CHECK" }); continue; }
        if (kind === "C") {
          const amt = pay(p, toCall), allIn = p.stack === 0;
          snap("act", { seat: i, kind: allIn ? "A" : "C", text: (allIn ? "ALL-IN " : "CALL ") + fmt(amt) });
          continue;
        }
        const size = Math.max(BB, Math.round((potNow * (0.5 + Math.random() * 0.6)) / 50) * 50);
        pay(p, cur + size - p.bet);
        const allIn = p.stack === 0;
        if (p.bet > cur) {
          cur = p.bet; raises++;
          queue = [];
          for (let k = 1; k < N; k++) { const j = (i + k) % N; if (canAct(seats[j])) queue.push(j); }
        }
        snap("act", { seat: i, kind: allIn ? "A" : kind, text: (allIn ? "ALL-IN " : kind === "B" ? "BET " : "RAISE TO ") + fmt(p.bet) });
      }
    }

    round(nxt(bb), BB);
    for (const [name, count] of [["FLOP", 3], ["TURN", 1], ["RIVER", 1]]) {
      if (live().length < 2) break;
      for (const p of seats) p.bet = 0;
      deck.pop(); // burn
      for (let k = 0; k < count; k++) board.push(deck.pop());
      street = name;
      reEq(300);
      snap("street");
      if (seats.filter(canAct).length > 1) round(nxt(dealer), 0);
    }

    // Showdown with side pots; an uncalled excess goes back to its owner.
    const contenders = [];
    seats.forEach((p, i) => { if (!p.folded) contenders.push(i); });
    const scores = new Array(N).fill(-1);
    if (contenders.length > 1) for (const i of contenders) scores[i] = evaluate([...seats[i].cards, ...board]);
    // An uncalled bet goes back to its owner first, so a refund never reads as winnings.
    const order = seats.map((_, i) => i).sort((a, b) => seats[b].total - seats[a].total);
    const excess = seats[order[0]].total - seats[order[1]].total;
    if (excess > 0) {
      const p = seats[order[0]];
      p.total -= excess; p.stack += excess;
      snap("refund", { seat: order[0], amt: excess });
    }
    const total = pot(), won = new Array(N).fill(0);
    const levels = [...new Set(seats.map(p => p.total).filter(t => t > 0))].sort((a, b) => a - b);
    let prev = 0;
    for (const lv of levels) {
      let slice = 0;
      for (const p of seats) slice += Math.min(p.total, lv) - Math.min(p.total, prev);
      const elig = contenders.filter(i => seats[i].total >= lv);
      const pool = elig.length ? elig : contenders;
      let best = -2, w = [];
      for (const i of pool) { if (scores[i] > best) { best = scores[i]; w = [i]; } else if (scores[i] === best) w.push(i); }
      w.forEach((i, k) => { won[i] += Math.floor(slice / w.length) + (k === 0 ? slice % w.length : 0); });
      prev = lv;
    }
    seats.forEach((p, i) => { p.stack += won[i]; p.eq = total ? won[i] / total : 0; });
    const winners = [];
    won.forEach((w, i) => { if (w > 0) winners.push(i); });
    winners.sort((a, b) => won[b] - won[a]);
    const hands = winners.map(i => (contenders.length > 1 ? handName(scores[i]) : "UNCONTESTED"));
    street = "SHOWDOWN";
    snap("show", { won, winners, hands, top: winners[0], label: hands[0], total, showdown: contenders.length > 1 });
    return ev;
  }

  // ---------------------------------------------------------------- playback state
  const SPEED_MS = { 1: 320, 4: 80, 8: 40, 16: 20 };
  const WAIT = { start: 2, act: 1, deal: 2, street: 3, refund: 2, show: 10 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true;
  const running = () => !paused && inView && !document.hidden;

  let events = simulateHand(), k = -1;

  // ---------------------------------------------------------------- featured table view
  const $ = id => document.getElementById(id);
  const fig = $("table"), boardEl = $("board"), potEl = $("pot");
  if (!fig) return; // this page doesn't have Exhibit A's markup
  const cardHTML = (c, fresh) => `<span class="cd${fresh ? " new" : ""}">${RANK[c % 13]}<i>${SUIT[(c / 13) | 0]}</i></span>`;
  const seatEls = NAMES.map((name, i) => {
    const el = document.createElement("div");
    el.className = "seat";
    el.innerHTML = `<div class="hole"></div><div class="who"></div><div class="meta"></div><div class="bar"><i></i></div><div class="act"></div>`;
    fig.appendChild(el);
    return { el, hole: el.children[0], who: el.children[1], meta: el.children[2], bar: el.children[3].firstChild, act: el.children[4], key: "" };
  });
  const seatLabel = i => `S${i + 1} ${NAMES[i]}`;
  // Seat angles shared with the grid: seat 1 sits lower left, then clockwise.
  const angle = i => ((112.5 + i * 45) * Math.PI) / 180;

  function placeSeats() {
    const portrait = fig.clientHeight > fig.clientWidth; // follows the aspect-ratio the CSS applied
    const rx = portrait ? 33 : 43, ry = portrait ? 41 : 39;
    seatEls.forEach((s, i) => {
      s.el.style.left = 50 + rx * Math.cos(angle(i)) + "%";
      s.el.style.top = 50 + ry * Math.sin(angle(i)) + "%";
    });
  }

  const acts = new Array(N).fill("");
  function renderTable(e) {
    acts.fill("");
    for (let j = 0; j <= k; j++) {
      const x = events[j];
      if (x.type === "street") acts.forEach((_, i) => { acts[i] = x.seats[i].folded ? "FOLD" : ""; });
      if (x.type === "act") acts[x.seat] = x.text;
      if (x.type === "refund") acts[x.seat] = "RETURNED " + fmt(x.amt);
      if (x.type === "show") x.won.forEach((w, i) => { if (w > 0) acts[i] = "+" + fmt(w); });
    }

    e.seats.forEach((p, i) => {
      const s = seatEls[i];
      const key = p.cards.join(",");
      if (key !== s.key) { s.hole.innerHTML = p.cards.map(c => cardHTML(c, true)).join(""); s.key = key; }
      s.who.textContent = seatLabel(i) + (e.dealer === i ? " (D)" : "");
      const pct = p.folded || !p.cards.length ? "--" : Math.round(p.eq * 100) + "%";
      s.meta.textContent = `${fmt(p.stack)}  ${pct}`;
      s.bar.style.width = (p.folded ? 0 : p.eq * 100) + "%";
      s.act.textContent = acts[i] || " ";
      s.el.classList.toggle("out", p.folded);
      s.el.classList.toggle("turn", e.type === "act" && e.seat === i);
      s.el.classList.toggle("win", e.type === "show" && e.won[i] > 0);
    });
    const slots = [];
    for (let j = 0; j < 5; j++) slots.push(j < e.board.length ? cardHTML(e.board[j], false) : `<span class="cd slot"></span>`);
    const bkey = e.board.join(",");
    if (boardEl.dataset.key !== bkey) { boardEl.innerHTML = slots.join(""); boardEl.dataset.key = bkey; }
    potEl.textContent = "POT " + fmt(e.pot);
    $("handinfo").textContent = `HAND ${String(e.hand).padStart(6, "0")}, BLINDS 50/100`;
    $("street").textContent = e.street;
  }

  // ---------------------------------------------------------------- action strips
  const stripsEl = $("strips");
  const makeStrip = (full, short, cls = "") => {
    const row = document.createElement("div");
    row.className = "strip " + cls;
    row.innerHTML = `<span class="name"><span class="full">${full}</span><span class="short">${short}</span></span><span class="track"><span class="in"></span></span>`;
    stripsEl.appendChild(row);
    return { row, track: row.querySelector(".in") };
  };
  const head = makeStrip("STREET", "", "head");
  const strips = NAMES.map((_, i) => makeStrip(seatLabel(i), "S" + (i + 1)));

  // The round names are built once per hand (and on resize) so a click is never lost
  // to a re-render; each tick only moves the progress line and greys upcoming rounds.
  let headFor = null, headW = -1, headTags = [], headLine = null;
  const pos = j => (j / (events.length - 1)) * 100;
  function buildHead() {
    const last = events.length - 1;
    const STREET_TAG = { deal: "PRE", show: "SHOW" };
    const tags = [];
    for (let j = 0; j <= last; j++) {
      const e = events[j];
      const tag = e.type === "street" ? e.street : STREET_TAG[e.type];
      if (tag) tags.push({ j, tag });
    }
    // Rounds that follow each other closely (an all-in run-out) collapse to one letter.
    const px = head.track.clientWidth / 100, chw = parseFloat(getComputedStyle(head.track).fontSize) * 0.6;
    for (let t = 1; t < tags.length; t++) {
      const room = (pos(tags[t].j) - pos(tags[t - 1].j)) * px;
      if (room < ((tags[t].tag.length + tags[t - 1].tag.length) / 2 + 1) * chw) tags[t].short = tags[t - 1].short = true;
    }
    head.track.innerHTML = `<i class="ln future" style="width:100%"></i><i class="ln now"></i>` +
      tags.map(({ j, tag, short }) => `<b data-j="${j}" style="left:${pos(j)}%" title="${tag}">${short ? tag[0] : tag}</b>`).join("");
    headTags = [...head.track.querySelectorAll("b")];
    headLine = head.track.querySelector(".ln.now");
    headFor = events; headW = head.track.clientWidth;
  }

  function renderStrips() {
    const last = events.length - 1, show = events[last];
    if (headFor !== events || headW !== head.track.clientWidth) buildHead();
    headLine.style.width = pos(k) + "%";
    headTags.forEach(b => b.classList.toggle("future", +b.dataset.j > k));

    strips.forEach((s, i) => {
      let end = k, letters = "", folded = false;
      for (let j = 0; j <= k; j++) {
        const e = events[j];
        if (e.type !== "act" || e.seat !== i) continue;
        letters += `<b style="left:${pos(j)}%">${e.kind}</b>`;
        if (e.kind === "F") { end = j; folded = true; break; }
      }
      if (k === last && show.won[i] > 0) letters += `<b class="w" style="left:${pos(last)}%">W</b>`;
      s.track.innerHTML = `<i class="ln" style="width:${pos(end)}%"></i>` + letters;
      s.row.classList.toggle("out", folded);
    });
  }

  // ---------------------------------------------------------------- grid of tiny tables
  const cv = $("grid"), ctx = cv.getContext("2d");
  // Canvas pixels are not adjusted by forced colours or print, so the grid takes its ink from
  // the page: the colour tokens normally, the system colours when forced colours are on.
  let INK, PAPER;
  const forced = matchMedia("(forced-colors: active)"), printing = matchMedia("print");
  function readInk() {
    if (forced.matches) {
      INK = getComputedStyle(cv).color; PAPER = getComputedStyle(document.body).backgroundColor;
    } else {
      const t = getComputedStyle(cv);
      INK = t.getPropertyValue("--ink").trim(); PAPER = t.getPropertyValue("--paper").trim();
    }
  }
  readInk();
  for (const q of [forced, printing]) q.addEventListener("change", () => { readInk(); drawGrid(); });
  let tables = [], cols = 0, rows = 0, cw = 0, ch = 0, ox = 0, feat = 0, perHand = 0;
  let handsPlayed = 0, hpsAcc = 0;

  function newTiny(t) { t.active = 255; t.board = 0; t.win = -1; t.hold = 0; t.steps = 0; }
  function stepTiny(t) {
    if (t.win >= 0) {
      if (++t.hold > 6) { newTiny(t); handsPlayed += perHand; hpsAcc += perHand; }
      return;
    }
    t.steps++;
    const on = [];
    for (let s = 0; s < N; s++) if (t.active >> s & 1) on.push(s);
    if (on.length > 1 && Math.random() < 0.42) t.active &= ~(1 << on[(Math.random() * on.length) | 0]);
    if (t.steps % 3 === 0 && t.board < 5) t.board = t.board === 0 ? 3 : t.board + 1;
    const left = [];
    for (let s = 0; s < N; s++) if (t.active >> s & 1) left.push(s);
    if (left.length === 1 || (t.board === 5 && t.steps % 3 === 2)) t.win = left[(Math.random() * left.length) | 0];
  }

  function layoutGrid() {
    const w = cv.parentElement.clientWidth, small = w < 560;
    cw = small ? 40 : 48; ch = small ? 28 : 32;
    cols = Math.max(1, Math.floor(w / cw)); rows = small ? 7 : 5;
    ox = (w - cols * cw) / 2;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(rows * ch * dpr);
    cv.style.height = rows * ch + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = cols * rows;
    while (tables.length < count) {
      const t = { acc: 0, jitter: 0.6 + Math.random() * 0.9 };
      newTiny(t);
      for (let n = (Math.random() * 14) | 0; n > 0; n--) stepTiny(t); // desync
      tables.push(t);
    }
    tables.length = count;
    feat = Math.floor(rows / 2) * cols + Math.floor(cols * 0.62);
    perHand = Math.round(10000 / count);
    $("shown").textContent = fmt(count);
  }

  function drawGrid() {
    const w = cv.clientWidth;
    ctx.clearRect(0, 0, w, rows * ch);
    const cur = k >= 0 ? events[k] : null;
    for (let idx = 0; idx < tables.length; idx++) {
      const t = tables[idx], x = ox + (idx % cols) * cw + cw / 2, y = Math.floor(idx / cols) * ch + ch / 2;
      const isFeat = idx === feat;
      let active = t.active, board = t.board, win = t.win, winMask = 0;
      if (isFeat && cur) {
        active = 0;
        cur.seats.forEach((p, i) => { if (!p.folded && p.cards.length) active |= 1 << i; });
        board = cur.board.length;
        win = -1;
        if (cur.type === "show") cur.winners.forEach(i => { winMask |= 1 << i; });
      }
      const fg = isFeat ? PAPER : INK;
      if (isFeat) { ctx.fillStyle = INK; ctx.fillRect(x - cw / 2 + 2, y - ch / 2 + 2, cw - 4, ch - 4); }
      const rx = cw * 0.3, ry = ch * 0.27;
      ctx.strokeStyle = fg; ctx.fillStyle = fg; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      for (let s = 0; s < N; s++) {
        const px = x + Math.cos(angle(s)) * rx, py = y + Math.sin(angle(s)) * ry;
        const on = active >> s & 1, r = s === win || (winMask >> s & 1) ? 3 : on ? 1.7 : 0;
        if (!r) continue;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      if (board) {
        const bw = board * 3 - 1;
        for (let b = 0; b < board; b++) ctx.fillRect(Math.round(x - bw / 2) + b * 3, y - 2, 2, 4);
      }
    }
  }

  // ---------------------------------------------------------------- loops
  let timer = 0, raf = 0, last = 0;
  function renderAt(j) {
    k = j;
    renderTable(events[k]);
    renderStrips();
  }
  function tick() {
    timer = 0;
    if (!running()) return;
    if (k >= events.length - 1) { events = simulateHand(); k = -1; }
    renderAt(k + 1);
    const e = events[k];
    if (e.type === "show") { handsPlayed += 1; hpsAcc += 1; }
    timer = setTimeout(tick, SPEED_MS[speed] * WAIT[e.type]);
  }
  function frame(t) {
    raf = 0;
    const dt = last ? Math.min(100, t - last) : 16;
    last = t;
    if (running()) {
      const base = SPEED_MS[speed] * 1.4;
      for (const tb of tables) {
        tb.acc += dt;
        const step = base * tb.jitter;
        while (tb.acc >= step) { tb.acc -= step; stepTiny(tb); }
      }
      $("hands").textContent = fmt(handsPlayed);
    }
    drawGrid();
    if (running()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
    if (!timer && running()) timer = setTimeout(tick, 0);
  }
  setInterval(() => {
    if (running()) $("hps").textContent = fmt(hpsAcc);
    else $("hps").textContent = "0";
    hpsAcc = 0;
  }, 1000);

  // ---------------------------------------------------------------- controls
  const playBtn = $("play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); kick(); });
  function stepTo(j) {
    paused = true; syncPlay();
    clearTimeout(timer); timer = 0;
    if (j > events.length - 1) { events = simulateHand(); j = 0; }
    renderAt(Math.max(0, j));
    drawGrid();
  }
  $("next").addEventListener("click", () => stepTo(k + 1));
  $("prev").addEventListener("click", () => stepTo(k - 1));
  $("first").addEventListener("click", () => stepTo(0));
  head.track.addEventListener("click", ev => {
    const b = ev.target.closest("b[data-j]");
    if (b) stepTo(+b.dataset.j);
  });
  document.querySelectorAll("#exhibit [data-speed]").forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll("#exhibit [data-speed]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe($("exhibit"));
  // Re-lay out whenever the exhibit's width changes (window resize, rotation, late web font)
  // and when the window moves to a screen with a different pixel density.
  const relayout = () => { layoutGrid(); placeSeats(); if (k >= 0) renderStrips(); drawGrid(); };
  new ResizeObserver(relayout).observe(cv.parentElement);
  const watchDpr = () => matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener("change", () => { relayout(); watchDpr(); }, { once: true });
  watchDpr();

  // ---------------------------------------------------------------- start
  layoutGrid();
  placeSeats();
  syncPlay();
  if (paused) {
    // Reduced motion: show one finished hand, still.
    renderAt(events.length - 1);
    drawGrid();
  } else {
    kick();
  }
})();

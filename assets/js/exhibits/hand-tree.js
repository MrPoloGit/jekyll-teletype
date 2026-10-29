// Exhibit B: analysis of one hand. A branching decision tree — the main
// line as played, with every move NOT made drawn as a side branch showing
// what it would have netted. The whole plate (text placement included) is
// laid out by a custom collision-avoiding geometry engine, then drawn
// in with a timed reveal.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 1698.
// Self-contained — defines its own hand evaluator locally (marked
// `==== ENGINE START/END ====`). The "LAYOUT START/END" section is pure
// geometry with no DOM dependency. Confirmed independent of Exhibit E's
// BookCore despite similar-looking code and a shared "from index.html"
// provenance comment on both — see plan.md.
//
// Markup it expects (see exhibits.md): a <section id="analysis"> containing
// #an-fig (figure) with an empty <svg id="an-tree"> inside, #an-handinfo,
// #an-stepinfo, #an-first/#an-prev/#an-play/#an-next, [data-speed] buttons,
// #an-now, #an-else, #an-pot, #an-played, #an-board, #an-street, #an-result.
(() => {
  "use strict";

  // ==== ENGINE START ====
  // ---------------------------------------------------------------- cards
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const NAMES = ["CFR-7", "NASH", "MONTE", "TILT", "GTO-LITE", "RIVERRAT", "FOLDBOT", "BAYES"];
  const CATS = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];
  const STREETS = ["PREFLOP", "FLOP", "TURN", "RIVER"];
  const N = 8, SB = 50, BB = 100, START = 10000, P5 = 13 ** 5;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const signed = n => (n > 0 ? "+" : "") + fmt(n);
  const cardText = c => RANK[c % 13] + SUIT[(c / 13) | 0];

  // ---------------------------------------------------------------- seeded random numbers
  // mulberry32. A generator's whole state is one integer, so a line of play can be copied
  // mid-hand and carried on with exactly the draws the original line would have used.
  function rand(r) {
    let t = (r.s = (r.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function mix(a, b) {
    let h = Math.imul((a ^ 0x9e3779b9) | 0, 0x85ebca6b) ^ b;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) | 0;
  }

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
  // Win share for every live seat; folded hands count as dead cards. The landing page
  // samples fresh runouts on every call. Here each hand samples its preflop runouts once
  // (300, as the page does) and enumerates them exactly from the flop on, so every line of
  // the analysis sees the same numbers for the same seats on the same board.
  const EQ_ITERS = 300;
  function runouts(holes, board, r) {
    const used = new Set(board);
    for (const h of holes) for (const c of h) used.add(c);
    const rest = [];
    for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
    const need = 5 - board.length, runs = [];
    if (need === 0) runs.push([]);
    else if (need === 1) for (const c of rest) runs.push([c]);
    else if (need === 2) { for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) runs.push([rest[i], rest[j]]); }
    else for (let it = 0; it < EQ_ITERS; it++) {
      for (let j = 0; j < need; j++) {
        const k = j + ((rand(r) * (rest.length - j)) | 0);
        [rest[j], rest[k]] = [rest[k], rest[j]];
      }
      runs.push(rest.slice(0, need));
    }
    const sc = new Float64Array(runs.length * N);
    runs.forEach((run, k) => holes.forEach((h, i) => { sc[k * N + i] = evaluate([h[0], h[1], ...board, ...run]); }));
    return { n: runs.length, sc };
  }
  function equity(tab, live) {
    const eq = new Array(N).fill(0);
    if (live.length === 1) { eq[live[0]] = 1; return eq; }
    for (let k = 0; k < tab.n; k++) {
      let best = -1, w = 0;
      for (const i of live) { const s = tab.sc[k * N + i]; if (s > best) { best = s; w = 1; } else if (s === best) w++; }
      for (const i of live) if (tab.sc[k * N + i] === best) eq[i] += 1 / w;
    }
    return eq.map(x => x / tab.n);
  }

  // ---------------------------------------------------------------- table state
  // A hand is a plain state object, so it can be copied at any decision and played on.
  const nxt = i => (i + 1) % N;
  const canAct = p => !p.folded && p.stack > 0;
  const pay = (p, a) => { a = Math.min(a, p.stack); p.stack -= a; p.bet += a; p.total += a; return a; };
  const potOf = st => st.seats.reduce((a, p) => a + p.total, 0);
  const liveCount = st => st.seats.reduce((a, p) => a + (p.folded ? 0 : 1), 0);
  const othersCanAct = (st, i) => st.seats.some((q, j) => j !== i && canAct(q));
  const clone = st => ({
    ...st, seats: st.seats.map(p => ({ ...p })), deck: st.deck.slice(), board: st.board.slice(), queue: st.queue.slice(),
  });

  function newHand(stacks, dealer, hand, seed) {
    const seats = stacks.map(stack => ({ stack: stack < BB ? START : stack, cards: [], folded: false, bet: 0, total: 0 })); // rebuy
    const dr = { s: mix(seed, 1) }, er = { s: mix(seed, 2) };
    const deck = [...Array(52).keys()];
    for (let i = 51; i > 0; i--) { const j = (rand(dr) * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const st = { hand, dealer, seats, deck, board: [], street: 0, cur: BB, raises: 0, queue: [], start: seats.map(p => p.stack), ctx: null };
    const sb = nxt(dealer), bb = nxt(sb);
    const blinds = [{ type: "blind", seat: sb, amt: pay(seats[sb], SB), kind: "b" }, { type: "blind", seat: bb, amt: pay(seats[bb], BB), kind: "b" }];
    for (let r = 0; r < 2; r++) for (let k = 1; k <= N; k++) seats[(dealer + k) % N].cards.push(deck.pop());
    // Once the hole cards are out the rest of the deck is fixed, so every line of the hand
    // that reaches a street sees the same board there.
    const d = deck.slice(), boards = [[]];
    for (const count of [3, 1, 1]) {
      d.pop(); // burn
      const b = boards[boards.length - 1].slice();
      for (let k = 0; k < count; k++) b.push(d.pop());
      boards.push(b);
    }
    const holes = seats.map(p => p.cards);
    st.ctx = { boards, tabs: boards.map(b => runouts(holes, b, er)), cache: new Map() };
    for (let k = 0; k < N; k++) { const i = (nxt(bb) + k) % N; if (canAct(seats[i])) st.queue.push(i); }
    return { st, blinds };
  }

  function eqOf(st) {
    let mask = 0;
    const live = [];
    st.seats.forEach((p, i) => { if (!p.folded) { mask |= 1 << i; live.push(i); } });
    const key = st.street * 256 + mask;
    let e = st.ctx.cache.get(key);
    if (!e) { e = equity(st.ctx.tabs[st.street], live); st.ctx.cache.set(key, e); }
    return e;
  }

  // The bot policy, as on the landing page; only the source of randomness changed.
  function decide(st, i, r) {
    const p = st.seats[i], eq = eqOf(st)[i], live = liveCount(st);
    const toCall = st.cur - p.bet, strength = eq * live, x = rand(r), potNow = potOf(st);
    let kind;
    if (toCall > 0) {
      const odds = toCall / (potNow + toCall);
      if ((strength > 1.7 && x < 0.45 && st.raises < 3) || (x < 0.03 && st.raises < 2)) kind = "R";
      else if ((st.street === 0 ? strength < 0.9 : eq < odds * 0.7) && rand(r) < 0.8) kind = "F";
      else kind = "C";
    } else {
      // The big blind's option is a raise, not a bet: there is already a bet to beat.
      kind = (strength > 1.3 && x < 0.5 && st.raises < 3) || x < 0.05 ? (st.cur > 0 ? "R" : "B") : "X";
    }
    // With every other live player all-in there is nobody left to call a bet.
    if ((kind === "R" || kind === "B") && !othersCanAct(st, i)) kind = toCall > 0 ? "C" : "X";
    return kind;
  }

  function legal(st, i) {
    const p = st.seats[i], toCall = st.cur - p.bet, other = othersCanAct(st, i);
    if (toCall > 0) return other && p.stack > toCall ? ["F", "C", "R"] : ["F", "C"];
    return other ? ["X", st.cur > 0 ? "R" : "B"] : ["X"];
  }

  // Applies one move. base is the move as a choice (F X C B R); kind is how it reads (A for all-in).
  function apply(st, i, move, r) {
    const p = st.seats[i], toCall = st.cur - p.bet, potNow = potOf(st), cur = st.cur;
    const ev = { type: "act", seat: i, raw: move, toCall, inBefore: p.total, street: st.street };
    if (move === "F") { p.folded = true; return Object.assign(ev, { base: "F", kind: "F", amt: 0 }); }
    if (move === "X") return Object.assign(ev, { base: "X", kind: "X", amt: 0 });
    if (move === "C") { const amt = pay(p, toCall); return Object.assign(ev, { base: "C", kind: p.stack === 0 ? "A" : "C", amt, to: p.bet }); }
    const size = Math.max(BB, Math.round((potNow * (0.5 + rand(r) * 0.6)) / 50) * 50);
    const amt = pay(p, cur + size - p.bet), allIn = p.stack === 0;
    if (p.bet > cur) {
      st.cur = p.bet; st.raises++;
      st.queue = [];
      for (let k = 1; k < N; k++) { const j = (i + k) % N; if (canAct(st.seats[j])) st.queue.push(j); }
      return Object.assign(ev, { base: move, kind: allIn ? "A" : move, amt, to: p.bet });
    }
    // All-in for no more than the bet already made: in effect a call.
    return Object.assign(ev, { base: "C", kind: "A", amt, to: p.bet });
  }

  // Next seat to act, dealing streets as betting rounds close; -1 when the hand is over.
  function nextActor(st, emit) {
    for (;;) {
      if (liveCount(st) > 1) while (st.queue.length) { const i = st.queue.shift(); if (canAct(st.seats[i])) return i; }
      if (!nextStreet(st, emit)) return -1;
    }
  }
  function nextStreet(st, emit) {
    while (st.street < 3) {
      if (liveCount(st) < 2) return false;
      for (const p of st.seats) p.bet = 0;
      st.street++;
      st.deck.pop(); // burn
      for (let k = st.street === 1 ? 3 : 1; k > 0; k--) st.board.push(st.deck.pop());
      st.cur = 0; st.raises = 0; st.queue = [];
      if (emit) emit({ type: "street", street: st.street, board: st.board.slice(), pot: potOf(st), live: liveCount(st) });
      if (st.seats.filter(canAct).length > 1) {
        for (let k = 0; k < N; k++) { const i = (nxt(st.dealer) + k) % N; if (canAct(st.seats[i])) st.queue.push(i); }
        return true;
      }
    }
    return false;
  }

  // Showdown with side pots; an uncalled excess goes back to its owner first.
  function settle(st) {
    const seats = st.seats, board = st.board, contenders = [];
    seats.forEach((p, i) => { if (!p.folded) contenders.push(i); });
    const scores = new Array(N).fill(-1);
    if (contenders.length > 1) for (const i of contenders) scores[i] = evaluate([...seats[i].cards, ...board]);
    const order = seats.map((_, i) => i).sort((a, b) => seats[b].total - seats[a].total);
    const excess = seats[order[0]].total - seats[order[1]].total;
    let refund = null;
    if (excess > 0) {
      const p = seats[order[0]];
      p.total -= excess; p.stack += excess;
      refund = { seat: order[0], amt: excess };
    }
    const total = potOf(st), won = new Array(N).fill(0);
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
    seats.forEach((p, i) => { p.stack += won[i]; });
    const winners = [];
    won.forEach((w, i) => { if (w > 0) winners.push(i); });
    winners.sort((a, b) => won[b] - won[a]);
    const hands = winners.map(i => (contenders.length > 1 ? handName(scores[i]) : "UNCONTESTED"));
    return {
      won, winners, hands, total, refund, showdown: contenders.length > 1, board: board.slice(),
      stacks: seats.map(p => p.stack), net: seats.map((p, i) => p.stack - st.start[i]),
    };
  }

  // Carries a copied line on from seat i's decision with that one move forced; from then on
  // every bot, seat i included, plays its usual policy. The policy's draws for the forced
  // decision are still spent, so a line forced to the move actually made replays it exactly.
  function playFrom(st, r, i, forced) {
    let first = null;
    while (i >= 0) {
      const kind = decide(st, i, r);
      const ev = apply(st, i, !first && forced ? forced : kind, r);
      if (!first) first = ev;
      i = nextActor(st, null);
    }
    return { first, res: settle(st) };
  }

  // Plays the hand, then plays out every move not made at each analysed decision.
  function playHand(stacks, dealer, hand, seed, keep) {
    const { st, blinds } = newHand(stacks, dealer, hand, seed);
    const r = { s: mix(seed, 3) };
    const events = blinds.map(e => ({ ...e, pot: 0 }));
    events[0].pot = SB; events[1].pot = SB + BB;
    const emit = e => events.push(e);
    let i = nextActor(st, emit);
    while (i >= 0) {
      const snap = clone(st), rs = r.s, lg = legal(st, i);
      const ev = apply(st, i, decide(st, i, r), r);
      Object.assign(ev, { snap, rs, legal: lg, pot: potOf(st) });
      events.push(ev);
      i = nextActor(st, emit);
    }
    const res = settle(st);
    for (const ev of events) {
      if (ev.type !== "act") continue;
      // A fold with nothing in the pot is routine: no variations, and runs of them collapse.
      ev.routine = ev.base === "F" && ev.inBefore === 0;
      ev.alts = ev.routine ? [] : ev.legal.filter(k => k !== ev.base).map(k => {
        const out = playFrom(clone(ev.snap), { s: ev.rs }, ev.seat, k);
        return { base: k, kind: out.first.kind, amt: out.first.amt, to: out.first.to, net: out.res.net[ev.seat], res: out.res };
      });
      if (!keep) ev.snap = null;
    }
    return { hand, dealer, seed, start: st.start, events, res, boards: st.ctx.boards };
  }

  // ---------------------------------------------------------------- the analysis tree
  const notation = (seat, a) => `S${seat + 1} ${a.kind}${a.kind === "B" || a.kind === "R" ? a.to : ""}`;
  function seatRun(seats) {
    if (seats.length === 1) return `S${seats[0] + 1}`;
    const run = seats.every((s, k) => k === 0 || s === nxt(seats[k - 1]));
    return run ? `S${seats[0] + 1}-S${seats[seats.length - 1] + 1}` : seats.map(s => `S${s + 1}`).join(",");
  }
  function buildTree(h) {
    const nodes = [];
    for (const ev of h.events) {
      if (ev.type === "blind") nodes.push({ t: "blind", ev, seat: ev.seat, label: `S${ev.seat + 1} b${ev.amt}`, alts: [] });
      else if (ev.type === "street") {
        const fresh = ev.board.slice(ev.street === 1 ? 0 : ev.street + 1).map(cardText).join(" ");
        nodes.push({ t: "chance", ev, lines: [STREETS[ev.street], fresh], alts: [] });
      } else if (ev.routine) {
        const prev = nodes[nodes.length - 1];
        if (prev && prev.t === "folds") { prev.seats.push(ev.seat); prev.evs.push(ev); }
        else nodes.push({ t: "folds", seats: [ev.seat], evs: [ev], alts: [] });
      } else {
        nodes.push({ t: "act", ev, seat: ev.seat, label: notation(ev.seat, ev), alts: ev.alts.map(a => ({ ...a, label: notation(ev.seat, a) })) });
      }
    }
    for (const nd of nodes) if (nd.t === "folds") nd.label = seatRun(nd.seats) + " F";
    return { hand: h.hand, dealer: h.dealer, nodes, res: h.res, h };
  }
  // ==== ENGINE END ====

  // ==== LAYOUT START ====
  // Pure geometry: no DOM, so the same code is checked in a shell for overlaps and bounds.
  const FS = 10, FS_VAL = 11, FS_SM = 9, PAD = 14;
  // Source Code Pro advances are 0.6em; suits fall back to another font, so allow them more.
  function textW(s, fs) {
    let w = 0;
    for (const ch of s) w += ch === "︎" ? 0 : /[♠-♧]/.test(ch) ? fs * 0.9 : fs * 0.6;
    return w;
  }

  function mkPath(a, b, c, d) {
    const pts = [], cum = [0], K = 48;
    for (let k = 0; k <= K; k++) {
      const t = k / K, u = 1 - t;
      const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
      const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
      if (k) cum.push(cum[k - 1] + Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]));
      pts.push([x, y]);
    }
    return { c: [a, b, c, d], pts, cum, len: cum[K] };
  }
  function along(P, s) {
    s = Math.max(0, Math.min(P.len, s));
    let k = 1;
    while (k < P.cum.length - 1 && P.cum[k] < s) k++;
    const s0 = P.cum[k - 1], s1 = P.cum[k], f = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const [x0, y0] = P.pts[k - 1], [x1, y1] = P.pts[k];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, tx: (x1 - x0) / l, ty: (y1 - y0) / l };
  }
  const f1 = v => Math.round(v * 10) / 10;
  const pathD = P => { const [a, b, c, d] = P.c; return `M${f1(a[0])} ${f1(a[1])}C${f1(b[0])} ${f1(b[1])} ${f1(c[0])} ${f1(c[1])} ${f1(d[0])} ${f1(d[1])}`; };

  // Text is modelled as a row of glyph-sized circles, ink as points along every stroke.
  function textCircles(x, base, s, fs, anchor) {
    const w = textW(s, fs), x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const n = Math.max(1, Math.round(w / (fs * 0.6))), out = [];
    for (let k = 0; k < n; k++) out.push([x0 + ((k + 0.5) * w) / n, base - 0.33 * fs, 0.42 * fs]);
    return out;
  }
  // Glyphs on a path: the run is centred on startOffset `so`; dy pushes it off the stroke.
  function pathCircles(P, so, s, fs, dy) {
    const w = textW(s, fs), n = Math.max(1, Math.round(w / (fs * 0.6))), out = [], off = dy - 0.33 * fs;
    for (let k = 0; k < n; k++) {
      const q = along(P, so - w / 2 + ((k + 0.5) * w) / n);
      out.push([q.x - q.ty * off, q.y + q.tx * off, 0.42 * fs]);
    }
    return out;
  }

  function makeSpace() {
    const C = 12, grid = new Map();
    const key = (cx, cy) => ((cx + 2048) << 12) | (cy + 2048);
    return {
      add(x, y, r, owner) {
        const e = { x, y, r, owner };
        for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++)
          for (let cy = Math.floor((y - r) / C); cy <= Math.floor((y + r) / C); cy++) {
            const k = key(cx, cy);
            let a = grid.get(k);
            if (!a) grid.set(k, (a = []));
            a.push(e);
          }
      },
      // Owners below -99 are corridors kept clear for branches not drawn yet; `real` skips them.
      hits(x, y, r, owner, real) {
        let n = 0;
        const seen = new Set();
        for (let cx = Math.floor((x - r) / C); cx <= Math.floor((x + r) / C); cx++)
          for (let cy = Math.floor((y - r) / C); cy <= Math.floor((y + r) / C); cy++) {
            const a = grid.get(key(cx, cy));
            if (a) for (const e of a) if (e.owner !== owner && !(real && e.owner < -99) && !seen.has(e) && Math.hypot(e.x - x, e.y - y) < e.r + r) { seen.add(e); n++; }
          }
        return n;
      },
    };
  }

  function newLay() { return { items: [], sp: makeSpace(), bad: 0, owner: 0, texts: [] }; }
  function inkPath(lay, P) { for (let s = 0; s <= P.len + 0.01; s += 2) { const q = along(P, s); lay.sp.add(q.x, q.y, 0.6, -1); } }
  function inkRect(lay, x, y, w, h) { for (let a = 0; a <= w; a += 2.5) for (let b = 0; b <= h; b += 2.5) lay.sp.add(x + a, y + b, 1, -1); }
  function addPath(lay, P, step, ph, j) { const it = { k: "path", P, step, ph, j }; lay.items.push(it); inkPath(lay, P); return it; }
  function addDot(lay, x, y, open, step) { lay.items.push({ k: "dot", x, y, open, step, ph: "node" }); lay.sp.add(x, y, open ? 5.5 : 3.5, -1); }
  function addBox(lay, x, y, w, h, open, step, ph, j) { lay.items.push({ k: "box", x, y, w, h, open, step, ph, j }); inkRect(lay, x, y, w, h); }
  const hitCount = (lay, circles, owner, real) => circles.reduce((a, c) => a + lay.sp.hits(c[0], c[1], c[2], owner, real), 0);
  // Places a text item (or a group of lines that move together), choosing among candidate
  // positions the first that touches nothing, else the one that touches least.
  function addText(lay, options) {
    const owner = ++lay.owner;
    let best = null, bestHits = Infinity;
    for (const o of options) {
      const specs = Array.isArray(o) ? o : [o];
      let h = 0;
      const placed = specs.map(sp => {
        const circles = sp.k === "tp" ? pathCircles(sp.P, sp.so, sp.s, sp.fs, sp.dy) : textCircles(sp.x, sp.y, sp.s, sp.fs, sp.anchor);
        h += hitCount(lay, circles, owner);
        if (sp.k === "tp" && (sp.so - textW(sp.s, sp.fs) / 2 < 0 || sp.so + textW(sp.s, sp.fs) / 2 > sp.P.len)) h += 99;
        return { ...sp, circles, owner };
      });
      if (h < bestHits) { best = placed; bestHits = h; }
      if (!h) break;
    }
    if (bestHits && best.some(it => hitCount(lay, it.circles, owner, true))) lay.bad++;
    for (const it of best) commitText(lay, it, it.circles, owner);
    return best;
  }
  function commitText(lay, it, circles, owner = ++lay.owner) {
    for (const c of circles) lay.sp.add(c[0], c[1], c[2], owner);
    const item = { ...it, circles, owner };
    lay.items.push(item);
    lay.texts.push(item);
  }

  // Bounds of everything drawn, then a translate so the drawing starts at PAD.
  function finish(lay, mode, extra) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    const tip = [];
    for (const it of lay.items) {
      let e;
      if (it.k === "path") { e = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, y] of it.P.pts) e = [Math.min(e[0], x), Math.min(e[1], y), Math.max(e[2], x), Math.max(e[3], y)]; }
      else if (it.k === "dot") { const r = it.open ? 5 : 3; e = [it.x - r, it.y - r, it.x + r, it.y + r]; }
      else if (it.k === "box") e = [it.x - 1, it.y - 1, it.x + it.w + 1, it.y + it.h + 1];
      else if (it.k === "wall") e = it.box;
      else { e = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, y, r] of it.circles) e = [Math.min(e[0], x - r - 1), Math.min(e[1], y - r - 1), Math.max(e[2], x + r + 1), Math.max(e[3], y + r + 1)]; }
      grow(...e);
      tip[it.step] = Math.max(tip[it.step] ?? -Infinity, e[2]);
    }
    for (let k = 1; k < tip.length; k++) tip[k] = Math.max(tip[k] ?? -Infinity, tip[k - 1]);
    const ox = PAD - x0, oy = PAD - y0;
    return { mode, items: lay.items, texts: lay.texts, bad: lay.bad, ox, oy, w: Math.ceil(x1 - x0 + 2 * PAD), h: Math.ceil(y1 - y0 + 2 * PAD), tip: tip.map(x => x + ox), ...extra };
  }

  // ---- horizontal: the spine runs left to right, its spacing scaled to the number of moves.
  // Variations fan up and down in turn. Each node's leaves take the lowest tier where nothing
  // is touched, so the plate packs the way the chess book's does: leaves stack where there is
  // room, and no branch crosses another or runs through a label.
  const TIER0 = 26, TIER = 19, MAX_TIER = 14;
  // Distance from each node to the one before it. Street labels need more room than a move,
  // and a long notation more than a short one.
  function spineGaps(nodes, dx) {
    const n = nodes.length, wide = Math.max(dx * 1.5, 52), gap = nodes.map(() => dx);
    gap[0] = Math.max(dx, 40);
    nodes.forEach((nd, i) => {
      if (nd.t === "chance") { gap[i] = Math.max(gap[i], wide); if (i + 1 < n) gap[i + 1] = Math.max(gap[i + 1], wide); return; }
      const w = textW(nd.label, FS);
      gap[i] = Math.max(gap[i], w / 2 + 12);
      if (i + 1 < n) gap[i + 1] = Math.max(gap[i + 1], w / 2 + 8);
    });
    return gap;
  }
  function layoutH(tree, dx) {
    const lay = newLay(), { nodes, res } = tree, n = nodes.length;
    const gap = spineGaps(nodes, dx), P = [];
    let x = 0;
    nodes.forEach((nd, i) => { x += gap[i]; P.push({ x, y: f1(5 * Math.sin((i + 1) * 0.8)) }); });
    const from = [{ x: 0, y: 0 }, ...P];
    const side = [];
    let s = -1;
    nodes.forEach((nd, i) => { if (nd.alts.length) { side[i] = s; s = -s; } else side[i] = 0; });

    // root: a hatched wall
    let hatch = "M0 -22V22";
    for (let y = -22; y <= 16; y += 5) hatch += `M0 ${y}l-6 6`;
    lay.items.push({ k: "wall", d: hatch, step: 0, ph: "wall", box: [-7, -23, 1, 23] });
    inkRect(lay, -6, -22, 6, 44);

    const segs = nodes.map((nd, i) => {
      const p = P[i], pr = from[i], h = (p.x - pr.x) / 2;
      const seg = addPath(lay, mkPath([pr.x, pr.y], [pr.x + h, pr.y], [p.x - h, p.y], [p.x, p.y]), i + 1, "edge").P;
      addDot(lay, p.x, p.y, nd.t === "chance", i + 1);
      return seg;
    });
    // Keep the first stretch of every variation clear while the spine's text is placed.
    nodes.forEach((nd, i) => {
      if (side[i]) for (let k = 0; k <= 12; k++) for (const f of [0, 0.3, 0.6]) lay.sp.add(P[i].x + f * k * 2.2, P[i].y + side[i] * k * 2.2, 1, -100 - i);
    });

    // The hand as played ends in one box per winner.
    const last = P[n - 1], k = res.winners.length, rdx = Math.max(40, 0.9 * dx), rx = last.x + rdx, step = n + 1;
    const results = res.winners.map((wi, j) => {
      const ry = last.y + (j - (k - 1) / 2) * 34;
      addPath(lay, mkPath([last.x, last.y], [last.x + 0.45 * rdx, last.y], [last.x + 0.55 * rdx, ry], [rx, ry]), step, "redge", j);
      addBox(lay, rx, ry - 6, 6, 12, res.net[wi] < 0, step, "rbox", j);
      return { wi, j, ry };
    });

    addText(lay, [{ k: "text", s: "HAND", x: -7, y: -42, fs: FS, anchor: "start", step: 0, ph: "wall" }]);
    addText(lay, [{ k: "text", s: String(tree.hand).padStart(6, "0"), x: -7, y: -30, fs: FS, anchor: "start", step: 0, ph: "wall" }]);
    for (const r of results) {
      addText(lay, [[
        { k: "text", s: `S${r.wi + 1} ${signed(res.net[r.wi])}`, x: rx + 11, y: r.ry + 4, fs: FS_VAL, anchor: "start", cls: "val", step, ph: "rtext", j: r.j },
        { k: "text", s: res.hands[r.j], x: rx + 11, y: r.ry + 15, fs: FS_SM, anchor: "start", cls: "sm", step, ph: "rtext", j: r.j },
      ]]);
    }

    // Notation on the branch into each move, street labels by their chance nodes: above or
    // below, mid-branch if it fits, sliding toward the node if not.
    const yAt = x => {
      for (let i = 0; i < from.length - 1; i++) if (x <= from[i + 1].x) { const a = from[i], b = from[i + 1]; return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1); }
      return from[from.length - 1].y;
    };
    nodes.forEach((nd, i) => {
      const p = P[i], pr = from[i], g = p.x - pr.x;
      const pref = side[i] ? -side[i] : i > 0 && side[i - 1] ? -side[i - 1] : -1, opts = [];
      if (nd.t === "chance") {
        for (const cx of [p.x, p.x + 0.3 * g, p.x - 0.3 * g]) for (const far of [0, 14]) for (const sd of [pref, -pref]) {
          const ys = sd < 0 ? [p.y - 25 - far, p.y - 13 - far] : [p.y + 17 + far, p.y + 29 + far];
          opts.push(nd.lines.map((s, k) => ({ k: "text", s, x: cx, y: ys[k], fs: FS, anchor: "middle", step: i + 1, ph: "nlabel" })));
        }
      } else {
        for (const cx of [pr.x + g / 2, p.x - g / 4, p.x, pr.x + g / 4]) for (const sd of [pref, -pref]) {
          const y = yAt(cx);
          opts.push({ k: "text", s: nd.label, x: cx, y: sd < 0 ? y - 6 : y + 13, fs: FS, anchor: "middle", step: i + 1, ph: "elabel" });
        }
      }
      addText(lay, opts);
    });

    // Variations, packed from the last move back, so that earlier lines arch over later ones
    // as in the chess book: the first alternatives of the hand are the outermost branches.
    for (let i = n - 1; i >= 0; i--) {
      const nd = nodes[i];
      if (!nd.alts.length) continue;
      const ws = nd.alts.map(a => textW(a.label, FS)), base = Math.max(40, Math.max(...ws) + 24);
      let best = null;
      search: for (let tier = 0; tier <= MAX_TIER; tier++) {
        for (const ddx of [base, base + 14, base + 28]) {
          const c = varCandidate(lay, i, P[i], nd.alts, ws, side[i], tier, ddx);
          if (!best || c.hits < best.hits) best = c;
          if (!c.hits) break search;
        }
      }
      if (best.hits) lay.bad++;
      for (const pt of best.parts) {
        lay.items.push({ k: "path", P: pt.path, step: i + 1, ph: "var", j: pt.j });
        inkPath(lay, pt.path);
        addBox(lay, pt.qx, pt.qy - 5, 5, 10, pt.a.net < 0, i + 1, "leaf", pt.j);
        commitText(lay, { k: "text", s: pt.val, x: pt.qx + 9, y: pt.qy + 4, fs: FS_VAL, anchor: "start", cls: "val", step: i + 1, ph: "leaf", j: pt.j }, pt.valC);
        commitText(lay, { k: "tp", s: pt.a.label, P: pt.path, so: pt.so, dy: pt.tdy, fs: FS, step: i + 1, ph: "vlabel", j: pt.j }, pt.label);
      }
    }
    return finish(lay, "h", { dx });
  }

  // One way of drawing a node's variations: leaves stacked at tiers `tier`, `tier + 1`, all at
  // the same distance along. Scored by how much it touches what is already on the plate.
  function varCandidate(lay, i, p, alts, ws, sd, tier, ddx) {
    const tmpInk = makeSpace(), tmpTxt = makeSpace(), parts = [], own = -100 - i, m = alts.length;
    let hits = 0;
    alts.forEach((a, j) => {
      // The inner branch leaves at a shallower angle than the outer, so the pair fans out.
      const dy = sd * (TIER0 + TIER * (tier + j)), k1 = m === 2 && j === 0 ? 0.3 : 0.14;
      const path = mkPath([p.x, p.y], [p.x + k1 * ddx, p.y + 0.78 * dy], [p.x + 0.42 * ddx, p.y + dy], [p.x + ddx, p.y + dy]);
      const [qx, qy] = path.c[3], so = path.len - ws[j] / 2 - 7, tdy = sd < 0 ? -3.5 : 10.5;
      if (so - ws[j] / 2 < 0) hits += 99;
      const label = pathCircles(path, so, a.label, FS, tdy), val = signed(a.net);
      const valC = textCircles(qx + 9, qy + 4, val, FS_VAL, "start");
      // Strokes are checked from 6px out, clear of the node's own dot.
      const ink = [];
      for (let s = 6; s <= path.len; s += 2) { const q = along(path, s); ink.push([q.x, q.y, 1]); }
      for (let u = 0; u <= 5; u += 2.5) for (let v = 0; v <= 10; v += 2.5) ink.push([qx + u, qy - 5 + v, 1]);
      const txt = [...label, ...valC];
      for (const c of ink) hits += lay.sp.hits(c[0], c[1], c[2], own) + tmpTxt.hits(c[0], c[1], c[2], j);
      for (const c of txt) hits += lay.sp.hits(c[0], c[1], c[2], own) + tmpTxt.hits(c[0], c[1], c[2], j) + tmpInk.hits(c[0], c[1], c[2], j);
      for (const c of ink) tmpInk.add(c[0], c[1], c[2], j);
      for (const c of txt) tmpTxt.add(c[0], c[1], c[2], j);
      parts.push({ a, j, path, qx, qy, so, tdy, label, val, valC });
    });
    return { hits, parts };
  }

  // ---- vertical: the spine runs top to bottom, variations branch to the right.
  function layoutV(tree, avail) {
    const lay = newLay(), { nodes, res } = tree, n = nodes.length;
    const handLabel = "HAND " + String(tree.hand).padStart(6, "0");
    let leftW = textW(handLabel, FS) + 16;
    for (const nd of nodes) leftW = Math.max(leftW, textW(nd.t === "chance" ? nd.lines.join(" ") : nd.label, FS) + 4);
    const SX = leftW + 10;
    const LX = Math.max(84, Math.min(140, avail - 2 * PAD - SX - 70));
    const P = [];
    let y = 30;
    nodes.forEach((nd, i) => {
      P.push({ x: SX + f1(3 * Math.sin((i + 1) * 0.8)), y });
      const m = nd.alts.length;
      y += m === 2 ? 46 : m === 1 ? 28 : 24;
    });

    let hatch = `M${SX - 22} 0H${SX + 22}`;
    for (let x = SX - 22; x <= SX + 16; x += 5) hatch += `M${x} 0l6 -6`;
    lay.items.push({ k: "wall", d: hatch, step: 0, ph: "wall", box: [SX - 23, -7, SX + 23, 1] });
    inkRect(lay, SX - 22, -6, 44, 6);

    const from = [{ x: SX, y: 0 }, ...P];
    nodes.forEach((nd, i) => {
      const p = P[i], pr = from[i], h = (p.y - pr.y) / 2;
      addPath(lay, mkPath([pr.x, pr.y], [pr.x, pr.y + h], [p.x, p.y - h], [p.x, p.y]), i + 1, "edge");
      addDot(lay, p.x, p.y, nd.t === "chance", i + 1);
    });

    const vars = [];
    nodes.forEach((nd, i) => {
      const p = P[i];
      nd.alts.forEach((a, j) => {
        const w = textW(a.label, FS), ddy = 14 + 22 * j;
        let ddx = LX, path;
        for (;;) {
          path = mkPath([p.x, p.y], [p.x + 0.1 * ddx, p.y + 0.85 * ddy], [p.x + 0.35 * ddx, p.y + ddy], [p.x + ddx, p.y + ddy]);
          if (path.len >= w + 18) break;
          ddx += 4;
        }
        addPath(lay, path, i + 1, "var", j);
        const [qx, qy] = path.c[3];
        addBox(lay, qx, qy - 5, 5, 10, a.net < 0, i + 1, "leaf", j);
        vars.push({ a, j, path, w, step: i + 1, qx, qy });
      });
    });

    const last = P[n - 1], mL = nodes[n - 1].alts.length, step = n + 1;
    const ry0 = last.y + (mL ? 14 + 22 * (mL - 1) + 26 : 30);
    const results = res.winners.map((wi, j) => {
      const ry = ry0 + 30 * j, rx = last.x + 18;
      addPath(lay, mkPath([last.x, last.y], [last.x, last.y + 0.75 * (ry - last.y)], [last.x + 2, ry], [rx, ry]), step, "redge", j);
      addBox(lay, rx, ry - 6, 6, 12, res.net[wi] < 0, step, "rbox", j);
      return { wi, j, ry, rx };
    });

    addText(lay, [{ k: "text", s: handLabel, x: SX - 28, y: 3, fs: FS, anchor: "end", step: 0, ph: "wall" }]);
    for (const v of vars) {
      addText(lay, [{ k: "text", s: signed(v.a.net), x: v.qx + 9, y: v.qy + 4, fs: FS_VAL, anchor: "start", cls: "val", step: v.step, ph: "leaf", j: v.j }]);
      addText(lay, [{ k: "tp", s: v.a.label, P: v.path, so: v.path.len - v.w / 2 - 7, dy: -3.5, fs: FS, step: v.step, ph: "vlabel", j: v.j }]);
    }
    for (const r of results) {
      addText(lay, [{ k: "text", s: `S${r.wi + 1} ${signed(res.net[r.wi])}`, x: r.rx + 11, y: r.ry + 4, fs: FS_VAL, anchor: "start", cls: "val", step, ph: "rtext", j: r.j }]);
      addText(lay, [{ k: "text", s: res.hands[r.j], x: r.rx + 11, y: r.ry + 15, fs: FS_SM, anchor: "start", cls: "sm", step, ph: "rtext", j: r.j }]);
    }
    nodes.forEach((nd, i) => {
      const p = P[i], pr = from[i];
      if (nd.t === "chance") addText(lay, [{ k: "text", s: nd.lines.join(" "), x: p.x - 10, y: p.y + 3.5, fs: FS, anchor: "end", step: i + 1, ph: "nlabel" }]);
      else addText(lay, [{ k: "text", s: nd.label, x: Math.min(pr.x, p.x) - 9, y: (pr.y + p.y) / 2 + 3.5, fs: FS, anchor: "end", step: i + 1, ph: "elabel" }]);
    });
    return finish(lay, "v", { LX });
  }

  // Horizontal when the plate is wide enough, with the spacing scaled down until the hand fits
  // (to a floor, past which the plate scrolls sideways inside itself). Vertical otherwise.
  const H_MIN = 940, DX_MIN = 24, DX_MAX = 88;
  function layoutTree(tree, avail) {
    if (avail < H_MIN) return layoutV(tree, avail);
    const spine = dx => spineGaps(tree.nodes, dx).reduce((a, g) => a + g, 0);
    let dx = DX_MAX, L = layoutH(tree, dx);
    if (L.w <= avail) return L;
    // Everything past the spine (wall, result, the last leaves) stays about the same width.
    const tail = L.w - spine(DX_MAX);
    while (dx > DX_MIN && spine(dx) + tail > avail) dx -= 0.5;
    L = layoutH(tree, dx);
    for (let it = 0; it < 4 && L.w > avail && dx > DX_MIN; it++) {
      dx = Math.max(DX_MIN, dx - Math.max(0.5, (L.w - avail) / (tree.nodes.length + 1)));
      L = layoutH(tree, dx);
    }
    // A clean drawing beats a snug one: if anything still touches, open the spacing up.
    for (let d = dx + 2; L.bad && d <= dx + 24; d += 2) {
      const L2 = layoutH(tree, d);
      if (L2.bad < L.bad) L = L2;
    }
    return L;
  }

  // ---- timeline, in units; a unit's length in ms is set by the speed buttons
  const PH = {
    wall: [0, 1], edge: [0, 4], elabel: [2, 2], node: [3.5, 1], nlabel: [3.5, 1.5],
    var: [5, 3], vlabel: [6.5, 1.5], leaf: [8, 1], redge: [0, 4], rbox: [3.5, 1], rtext: [4, 1.5],
  };
  const STAG = 0.8, HOLD = 50, FADE = 6;
  function timeline(tree) {
    const lens = [1.5];
    for (const nd of tree.nodes) { const m = nd.alts.length; lens.push(m ? 9 + (m - 1) * STAG : 5); }
    lens.push(6 + (tree.res.winners.length - 1) * STAG);
    const start = [], end = [];
    let acc = 0;
    for (const d of lens) { start.push(acc); acc += d; end.push(acc); }
    return { start, end, last: lens.length - 1, done: acc, total: acc + HOLD + FADE };
  }
  const itemAt = (T, it) => T.start[it.step] + PH[it.ph][0] + (it.j || 0) * STAG;
  const itemDur = it => PH[it.ph][1];
  // Last step fully drawn at time t, and the step being shown (for the readout).
  function doneStep(T, t) { let c = 0; for (let k = 0; k <= T.last; k++) if (T.end[k] <= t + 1e-9) c = k; return c; }
  function shownStep(T, t) { let c = 0; for (let k = 0; k <= T.last; k++) if (T.start[k] < t - 1e-9) c = k; return c; }
  // Where the step buttons go: a time, or -1 for "deal the next hand".
  function stepTarget(T, t, dir) {
    if (dir === 0) return T.end[0];
    const c = doneStep(T, t);
    if (dir > 0) return c + 1 > T.last ? -1 : T.end[c + 1];
    const mid = c < T.last && t > T.end[c] + 1e-9;
    return mid ? T.end[c] : T.end[Math.max(0, c - 1)];
  }
  // ==== LAYOUT END ====

  // ---------------------------------------------------------------- view
  const $ = id => document.getElementById(id);
  const fig = $("an-fig"), svg = $("an-tree");
  if (!fig || !svg) return; // this page doesn't have Exhibit B's markup
  const NS = "http://www.w3.org/2000/svg", XLINK = "http://www.w3.org/1999/xlink";
  const UNIT_MS = { 1: 150, 4: 40, 8: 20, 16: 10 };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speed = 8, paused = reduce, inView = true;
  const running = () => !paused && inView && !document.hidden;

  let stacks = new Array(N).fill(START), dealer = -1, handNo = 0;
  const baseSeed = (Math.random() * 0x7fffffff) | 0;
  let tree = null, T = null, L = null, els = [], group = null, t = 0, shown = -1, follow = true, autoLeft = 0, lastAvail = -1;

  const who = i => `S${i + 1} ${NAMES[i]}`;
  const el = (name, attrs = {}) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function dealHand() {
    handNo++;
    dealer = nxt(dealer);
    const h = playHand(stacks, dealer, handNo, mix(baseSeed, handNo));
    stacks = h.res.stacks;
    tree = buildTree(h);
    T = timeline(tree);
    t = 0; shown = -1; follow = true;
    fig.scrollLeft = autoLeft = 0;
    draw();
    const r = tree.res;
    svg.setAttribute("aria-label", `Analysis tree for simulated hand ${handNo}: ${tree.nodes.length} moves on the main line, ` +
      `${tree.nodes.reduce((a, nd) => a + nd.alts.length, 0)} variations. ${sayResult(r)}.`);
  }

  function avail() {
    const cs = getComputedStyle(fig);
    return fig.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  // Builds the SVG for the current hand at the current width. Everything is drawn up front
  // and hidden; render() reveals it by time.
  // Tallest plate so far at this width. The plate only grows, so a shorter hand never pulls
  // the page below it upward (Safari has no scroll anchoring to hide the jump).
  let reserved = { w: -1, h: 0 };
  function draw() {
    lastAvail = avail();
    L = layoutTree(tree, lastAvail);
    svg.textContent = "";
    // A hand longer than the plate is scaled down to fit rather than scrolled, so the plate
    // never shows a scrollbar.
    const fit = Math.min(1, lastAvail / L.w), dispW = L.w * fit, dispH = L.h * fit;
    svg.setAttribute("width", f1(dispW)); svg.setAttribute("height", f1(dispH));
    if (Math.abs(reserved.w - lastAvail) > 0.5) reserved = { w: lastAvail, h: 0 };
    reserved.h = Math.max(reserved.h, dispH);
    svg.style.marginBottom = reserved.h - dispH + "px";
    svg.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
    group = el("g", { transform: `translate(${f1(L.ox)} ${f1(L.oy)})` });
    svg.appendChild(group);
    els = [];
    const texts = [], paths = new Map();
    L.items.forEach((it, idx) => {
      let e = null, len = 0;
      if (it.k === "path") {
        e = el("path", { class: "br", d: pathD(it.P), id: `b${handNo}-${idx}` });
        paths.set(it.P, e.id);
      } else if (it.k === "wall") e = el("path", { class: "br", d: it.d });
      else if (it.k === "dot") e = el("circle", { class: it.open ? "ch" : "dot", cx: it.x, cy: it.y, r: it.open ? 4.5 : 2.5 });
      else if (it.k === "box") e = el("rect", { class: "bx" + (it.open ? " open" : ""), x: f1(it.x + 0.5), y: f1(it.y + 0.5), width: it.w - 1, height: it.h - 1 });
      else { texts.push(it); return; }
      group.appendChild(e);
      if (it.k === "path") {
        len = e.getTotalLength ? e.getTotalLength() : it.P.len;
        e.style.strokeDasharray = `${len} ${len}`;
      }
      els.push({ e, len, at: itemAt(T, it), dur: reduce ? 0 : itemDur(it), p: -1 });
    });
    // Text goes on top of the strokes.
    for (const it of texts) {
      const attrs = { class: it.cls || "" };
      let e;
      if (it.k === "tp") {
        e = el("text", { ...attrs, dy: it.dy, "text-anchor": "middle" });
        const tp = el("textPath", { startOffset: f1(it.so) });
        const id = paths.get(it.P);
        tp.setAttribute("href", "#" + id);
        tp.setAttributeNS(XLINK, "xlink:href", "#" + id);
        tp.textContent = it.s;
        e.appendChild(tp);
      } else {
        e = el("text", { ...attrs, x: f1(it.x), y: f1(it.y), "text-anchor": it.anchor });
        e.textContent = it.s;
      }
      group.appendChild(e);
      els.push({ e, len: 0, at: itemAt(T, it), dur: reduce ? 0 : itemDur(it), p: -1 });
    }
    render(true);
    autoLeft = fig.scrollLeft; // a narrower drawing may have clamped the scroll
  }

  function render(force, reveal) {
    for (const x of els) {
      let p = x.dur ? Math.min(1, Math.max(0, (t - x.at) / x.dur)) : t >= x.at - 1e-9 ? 1 : 0;
      if (!x.len) p = Math.ceil(p * 3) / 3; // text and marks print in, three steps, like the landing page's deal
      if (p === x.p && !force) continue;
      x.p = p;
      if (x.len) { x.e.style.strokeDashoffset = x.len * (1 - p); x.e.style.opacity = p > 0 ? 1 : 0; }
      else x.e.style.opacity = p;
    }
    const fade = Math.min(1, Math.max(0, (t - T.done - HOLD) / FADE));
    group.style.opacity = 1 - fade;
    const k = shownStep(T, t);
    if (k !== shown || force) { shown = k; readout(k); }
    // In a scrolling plate, keep the newest move in view unless the reader has taken over;
    // a step button always brings the move it lands on into view.
    if (L.mode === "h" && L.w > lastAvail && (reveal || (follow && running()))) {
      const tipX = L.tip[k] + parseFloat(getComputedStyle(fig).paddingLeft), view = fig.scrollLeft + fig.clientWidth;
      if (tipX > view || (reveal && tipX < fig.scrollLeft)) { fig.scrollLeft = Math.max(0, tipX - fig.clientWidth); autoLeft = fig.scrollLeft; }
    }
  }

  // ---------------------------------------------------------------- readout
  function sayAct(ev) {
    const n = who(ev.seat);
    if (ev.kind === "F") return `${n} FOLDS`;
    if (ev.kind === "X") return `${n} CHECKS`;
    if (ev.kind === "C") return `${n} CALLS ${fmt(ev.amt)}`;
    if (ev.kind === "B") return `${n} BETS ${fmt(ev.to)}`;
    if (ev.kind === "R") return `${n} RAISES TO ${fmt(ev.to)}`;
    return `${n} IS ALL-IN, ` + (ev.base === "C" ? `CALLING ${fmt(ev.amt)}` : `${ev.base === "B" ? "BETTING" : "RAISING TO"} ${fmt(ev.to)}`);
  }
  function sayAlt(a) {
    const w = { F: "FOLD", X: "CHECK", C: "CALL", A: "ALL-IN" }[a.kind] || (a.kind === "B" ? "BET " : "RAISE TO ") + fmt(a.to);
    return `IF ${w}: ${signed(a.net)}`;
  }
  function sayResult(r) {
    if (r.winners.length === 1) return `${who(r.winners[0])} WINS ${fmt(r.won[r.winners[0]])}, ${r.hands[0]}`;
    return r.winners.map((i, n) => `S${i + 1} WINS ${fmt(r.won[i])} (${r.hands[n]})`).join(", ");
  }
  function readout(k) {
    const nodes = tree.nodes, res = tree.res, nd = k >= 1 && k <= nodes.length ? nodes[k - 1] : null;
    let now, other = "", pot = "", played = "";
    if (k === 0) { now = `HAND ${String(handNo).padStart(6, "0")} DEALT, ${who(tree.dealer)} ON THE BUTTON`; other = "-"; }
    else if (k > nodes.length) {
      now = sayResult(res);
      other = "NET: " + res.winners.map(i => `S${i + 1} ${signed(res.net[i])}`).join(" / ");
      pot = "POT " + fmt(res.total);
    } else if (nd.t === "blind") {
      now = `${who(nd.seat)} POSTS THE ${nd.ev.amt === SB ? "SMALL" : "BIG"} BLIND, ${nd.ev.amt}`;
      other = "FORCED BET, NOT ANALYSED"; pot = "POT " + fmt(nd.ev.pot);
    } else if (nd.t === "folds") {
      now = nd.seats.map(who).join(", ") + (nd.seats.length > 1 ? " FOLD" : " FOLDS");
      other = "NO CHIPS IN THE POT, NOT ANALYSED"; pot = "POT " + fmt(nd.evs[nd.evs.length - 1].pot);
    } else if (nd.t === "chance") {
      now = `${nd.lines[0]}: ${nd.lines[1]}, ${nd.ev.live} BOTS IN`;
      other = "CHANCE NODE"; pot = "POT " + fmt(nd.ev.pot);
    } else {
      now = sayAct(nd.ev);
      other = nd.alts.length ? nd.alts.map(sayAlt).join(" / ") : "NO OTHER LEGAL MOVE";
      pot = "POT " + fmt(nd.ev.pot);
      played = "AS PLAYED: " + signed(res.net[nd.seat]);
    }
    let board = [], street = "PREFLOP";
    for (let j = 0; j < Math.min(k, nodes.length); j++) if (nodes[j].t === "chance") { board = nodes[j].ev.board; street = STREETS[nodes[j].ev.street]; }
    if (k > nodes.length) { board = res.board; street = res.showdown ? "SHOWDOWN" : "NO SHOWDOWN"; }
    $("an-now").textContent = now;
    $("an-else").textContent = other;
    $("an-pot").textContent = pot;
    $("an-played").textContent = played;
    $("an-board").textContent = board.length ? board.map(cardText).join(" ") : "NONE YET";
    $("an-street").textContent = street;
    $("an-result").textContent = k > nodes.length ? sayResult(res) : "IN PLAY";
    $("an-handinfo").textContent = `HAND ${String(handNo).padStart(6, "0")}, S${tree.dealer + 1} DEALER`;
    $("an-stepinfo").textContent = `STEP ${String(k).padStart(2, "0")} OF ${String(T.last).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------- loop
  let raf = 0, lastNow = 0;
  function frame(now) {
    raf = 0;
    const dt = lastNow ? Math.min(100, now - lastNow) : 0;
    lastNow = now;
    if (running()) {
      t += dt / UNIT_MS[speed];
      if (t >= T.total) dealHand();
      else render(false);
      raf = requestAnimationFrame(frame);
    } else lastNow = 0;
  }
  function kick() { if (!raf && running()) raf = requestAnimationFrame(frame); }

  // ---------------------------------------------------------------- controls
  const playBtn = $("an-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  playBtn.addEventListener("click", () => {
    paused = !paused;
    if (!paused && t >= T.done + HOLD) dealHand();
    syncPlay(); kick();
  });
  function stepBy(dir) {
    paused = true; syncPlay();
    const target = stepTarget(T, t, dir);
    if (target < 0) { dealHand(); t = T.end[0]; }
    else t = target;
    render(false, true);
  }
  $("an-next").addEventListener("click", () => stepBy(1));
  $("an-prev").addEventListener("click", () => stepBy(-1));
  $("an-first").addEventListener("click", () => stepBy(0));
  document.querySelectorAll("#analysis [data-speed]").forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed;
    document.querySelectorAll("#analysis [data-speed]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  // Scrolling the plate by hand stops it following the newest move until the next hand. Only a
  // scroll the page did not make counts, so wheeling or swiping the page past the plate does not.
  fig.addEventListener("scroll", () => { if (Math.abs(fig.scrollLeft - autoLeft) > 1) follow = false; }, { passive: true });
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); kick(); }).observe(fig);
  let pend = 0;
  new ResizeObserver(() => {
    if (pend) return;
    pend = requestAnimationFrame(() => { pend = 0; if (tree && Math.abs(avail() - lastAvail) > 0.5) draw(); });
  }).observe(fig);

  // ---------------------------------------------------------------- start
  dealHand();
  syncPlay();
  if (paused) { t = T.done; render(false); } // reduced motion: one finished tree, still
  else kick();
})();

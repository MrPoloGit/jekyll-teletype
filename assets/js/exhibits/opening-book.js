// Exhibit E: the opening book. Every simulated hand merged into one tree —
// the busiest branch runs straight on, less-played lines fan out, nodes
// grow and shrink as hands are added, and the highlighted (most recent)
// hand's board cards float beside wherever its line currently reaches.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 3510
// (BookCore, pure logic) and ~line 3998 (the page, DOM). Two scripts in the
// source, combined into one file here since load order already made them
// one logical unit (BookCore is a global the second script consumes).
//
// BookCore defines its own complete, independent hand evaluator/simulator
// (confirmed no runtime dependency on Exhibit B despite similar code and a
// shared "from index.html" provenance comment on both — see plan.md).
//
// Markup it expects (see exhibits.md): a <section id="book"> containing
// #bk-hands, #bk-hps, #bk-held, #bk-lines, #bk-folds, #bk-first/#bk-prev/
// #bk-play/#bk-next, [data-speed] buttons, #bk-fig (figure) with an empty
// <svg id="bk-tree"> inside, #bk-figNote, #bk-lastNo, #bk-lastRes,
// #bk-cards/#bk-board/#bk-win, and three `.wrap-last` rows (each with one
// child element) for the highlighted hand's notation to wrap into. No
// `#bk-mainMeta`/`.wrap-main` on this page — BookCore's mainLineText()
// already no-ops when that's absent, same as the source.

// ==== BookCore: engine + layout, no DOM ====
var BookCore = (function () {
  "use strict";

  // ---------------------------------------------------------------- cards
  const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  // U+FE0E keeps the suits as text glyphs instead of emoji.
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const NAMES = ["CFR-7", "NASH", "MONTE", "TILT", "GTO-LITE", "RIVERRAT", "FOLDBOT", "BAYES"];
  const CATS = ["HIGH CARD", "PAIR", "TWO PAIR", "THREE OF A KIND", "STRAIGHT", "FLUSH", "FULL HOUSE", "FOUR OF A KIND", "STRAIGHT FLUSH"];
  const N = 8, SB = 50, BB = 100, START = 10000, P5 = 13 ** 5;
  const fmt = n => n.toLocaleString("en-US");

  // ---------------------------------------------------------------- evaluator (from index.html)
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

  // ---------------------------------------------------------------- one hand, headless
  // simulateHand() from index.html with the snapshots taken out: same bots, same betting,
  // same side pots and refunds, but it returns the actions as data. The featured table
  // runs 300/200/300 equity iterations; the book plays thousands of hands, so fewer.
  const EQ = { deal: 40, fold: 20, street: 40 };
  const seats = NAMES.map(name => ({ name, stack: START, cards: [], folded: false, bet: 0, total: 0, eq: 0 }));
  let dealer = -1, handNo = 0;

  function simulateHand() {
    const acts = [];
    handNo++;
    for (const p of seats) {
      if (p.stack < BB) p.stack = START; // rebuy
      Object.assign(p, { cards: [], folded: false, bet: 0, total: 0, eq: 0 });
    }
    const chipsBefore = seats.reduce((a, p) => a + p.stack, 0);
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

    const sb = nxt(dealer), bb = nxt(sb);
    pay(seats[sb], SB);
    pay(seats[bb], BB);
    for (let r = 0; r < 2; r++) for (let k = 1; k <= N; k++) seats[(dealer + k) % N].cards.push(deck.pop());
    reEq(EQ.deal);

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
        if (kind === "F") { p.folded = true; reEq(EQ.fold); acts.push({ street, seat: i, kind }); continue; }
        if (kind === "X") { acts.push({ street, seat: i, kind }); continue; }
        if (kind === "C") {
          pay(p, toCall);
          acts.push({ street, seat: i, kind: p.stack === 0 ? "A" : "C" });
          continue;
        }
        const before = cur;
        const size = Math.max(BB, Math.round((potNow * (0.5 + Math.random() * 0.6)) / 50) * 50);
        pay(p, cur + size - p.bet);
        const allIn = p.stack === 0;
        if (p.bet > cur) {
          cur = p.bet; raises++;
          queue = [];
          for (let k = 1; k < N; k++) { const j = (i + k) % N; if (canAct(seats[j])) queue.push(j); }
        }
        acts.push({ street, seat: i, kind: allIn ? "A" : kind, to: p.bet, add: p.bet - before, pot: potNow });
      }
    }

    round(nxt(bb), BB);
    for (const [name, count] of [["FLOP", 3], ["TURN", 1], ["RIVER", 1]]) {
      if (live().length < 2) break;
      for (const p of seats) p.bet = 0;
      deck.pop(); // burn
      for (let k = 0; k < count; k++) board.push(deck.pop());
      street = name;
      reEq(EQ.street);
      acts.push({ street, kind: "S" });
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
    seats.forEach((p, i) => { p.stack += won[i]; });
    const winners = [];
    won.forEach((w, i) => { if (w > 0) winners.push(i); });
    winners.sort((a, b) => won[b] - won[a]);
    const showdown = contenders.length > 1;
    return {
      hand: handNo, dealer, acts, board, pot: total, showdown, won, winners, refund: Math.max(0, excess),
      holes: seats.map(p => p.cards.slice()),
      result: showdown ? handName(scores[winners[0]]) : "UNCONTESTED",
      chipsBefore, chipsAfter: seats.reduce((a, p) => a + p.stack, 0),
    };
  }

  // ---------------------------------------------------------------- notation
  // Seats become table positions counted from the dealer, so hands are comparable.
  const POS = ["BTN", "SB", "BB", "UTG", "UTG1", "MP", "HJ", "CO"];
  const CHANCE = new Set(["FLOP", "TURN", "RIVER"]);
  const SD = "SHOWDOWN", FO = "FOLDED OUT";
  const posOf = (seat, dealerSeat) => POS[(seat - dealerSeat + N) % N];

  function bucket(a) {
    if (a.kind === "X" || a.kind === "C" || a.kind === "A") return a.kind;
    if (a.street === "PREFLOP") {
      const n = Math.round(a.to / BB);
      return n >= 6 ? "R6+" : "R" + Math.max(2, n);
    }
    // Postflop raises are rare; they keep a plain R so "R2" can only mean 2 BB preflop.
    if (a.kind === "R") return "R";
    const f = a.add / a.pot;
    return "B" + (f < 0.75 ? "1/2" : f < 1.5 ? "1" : "2+");
  }

  // One hand as a line of the book: voluntary actions only (no blinds; folds are counted
  // where they happen but not drawn), street cards as chance nodes, the result as the leaf.
  function toRecord(h) {
    const tokens = [], foldsAt = [0];
    let folds = 0;
    for (const a of h.acts) {
      if (a.kind === "F") { foldsAt[tokens.length]++; folds++; continue; }
      tokens.push(a.kind === "S" ? a.street : posOf(a.seat, h.dealer) + " " + bucket(a));
      foldsAt.push(0);
    }
    tokens.push(h.showdown ? SD : FO);
    foldsAt.push(0);
    const w = h.winners[0];
    return {
      n: h.hand, idx: 0, tokens, foldsAt, folds, pot: h.pot, showdown: h.showdown,
      winPos: w === undefined ? "" : posOf(w, h.dealer), winAmt: w === undefined ? 0 : h.won[w],
      split: h.winners.length > 1, result: h.result, pushedOut: null,
      board: h.board.slice(), win: w === undefined ? [] : h.holes[w].slice(),
    };
  }

  const WORD_POS = { BTN: "BUTTON", SB: "SMALL BLIND", BB: "BIG BLIND", UTG: "UTG", UTG1: "UTG+1", MP: "MIDDLE", HJ: "HIJACK", CO: "CUTOFF" };
  const WORD_SIZE = { "1/2": "HALF POT", "1": "POT", "2+": "2X POT OR MORE" };
  function wordParts(tokens) {
    if (tokens.length === 1 && tokens[0] === FO) return ["ALL FOLD TO THE BIG BLIND"];
    return tokens.map(t => {
      if (CHANCE.has(t)) return t;
      if (t === SD) return "SHOWDOWN";
      if (t === FO) return "THE REST FOLD";
      const [p, a] = t.split(" ");
      const who = WORD_POS[p];
      if (a === "X") return who + " CHECKS";
      if (a === "C") return who + " CALLS";
      if (a === "A") return who + " ALL-IN";
      if (a === "R") return who + " RAISES";
      if (a[0] === "R") return who + " RAISES TO " + a.slice(1) + " BB";
      return who + " BETS " + WORD_SIZE[a.slice(1)];
    });
  }

  // ---------------------------------------------------------------- the book: a trie of lines
  // Keeps the last `window` hands. Every node counts the hands through it, how many of
  // them reached showdown, their pots, and the folds that happened there.
  function createBook(opt = {}) {
    const WINDOW = opt.window || 10000, DEPTH = opt.depth || 9, UNDO = opt.undo || 500;
    let ids = 0;
    const mk = (tok, parent) => ({
      id: ++ids, tok, parent, depth: parent ? parent.depth + 1 : 0,
      key: parent ? parent.key + "/" + tok : "",
      type: !parent ? "root" : CHANCE.has(tok) ? "chance" : tok === SD || tok === FO ? "end" : "act",
      count: 0, sd: 0, pot: 0, folds: 0, kids: new Map(),
    });
    const S = { root: mk("", null), win: [], head: 0, redo: [], undoable: 0, analyzed: 0, lines: 0, nodes: 1, folds: 0 };

    // Adds (s = 1) or removes (s = -1) one hand along its path.
    function apply(rec, s) {
      S.folds += s * rec.folds;
      const L = Math.min(rec.tokens.length, DEPTH);
      let n = S.root;
      for (let k = 0; ; k++) {
        let f = rec.foldsAt[k];
        if (k === L) for (let j = k + 1; j < rec.foldsAt.length; j++) f += rec.foldsAt[j];
        n.count += s; n.pot += s * rec.pot; n.folds += s * f;
        if (rec.showdown) n.sd += s;
        if (k === L) break;
        const tok = rec.tokens[k];
        let c = n.kids.get(tok);
        if (s < 0 && c.count === 1) {
          // Only this hand ran through c, so the whole branch goes.
          n.kids.delete(tok);
          S.nodes -= L - k;
          if (n.kids.size || n === S.root) S.lines--;
          break;
        }
        if (!c) {
          if (n.kids.size || n === S.root) S.lines++;
          c = mk(tok, n); n.kids.set(tok, c); S.nodes++;
        }
        n = c;
      }
    }

    const size = () => S.win.length - S.head;
    function push(rec) {
      apply(rec, 1);
      S.win.push(rec);
      rec.idx = ++S.analyzed;
      rec.pushedOut = null;
      if (size() > WINDOW) {
        const old = S.win[S.head];
        S.win[S.head++] = undefined;
        apply(old, -1);
        old.pushedOut = null;
        rec.pushedOut = old;
        if (S.head > 4096) { S.win = S.win.slice(S.head); S.head = 0; }
      }
      S.undoable = Math.min(UNDO, S.undoable + 1);
    }
    const last = () => (size() ? S.win[S.win.length - 1] : null);

    return {
      get root() { return S.root; },
      get size() { return size(); },
      get analyzed() { return S.analyzed; },
      get lines() { return S.lines; },
      get nodes() { return S.nodes; },
      get folds() { return S.folds; },
      get canUndo() { return S.undoable > 0 && size() > 0; },
      window: WINDOW, depth: DEPTH,
      last,
      records() { return S.win.slice(S.head); },
      // A freshly simulated hand: anything stepped back over is forgotten.
      add(rec) { S.redo.length = 0; push(rec); return rec; },
      // Step forward: replay a hand stepped back over if there is one, else take a new one.
      forward(make) { const rec = S.redo.length ? S.redo.pop() : make(); push(rec); return rec; },
      // Step back: take the newest hand out again (and restore the one it pushed out).
      back() {
        if (!(S.undoable > 0 && size() > 0)) return false;
        const rec = S.win.pop();
        apply(rec, -1);
        S.analyzed--; S.undoable--;
        if (rec.pushedOut) {
          const old = rec.pushedOut;
          rec.pushedOut = null;
          apply(old, 1);
          if (S.head > 0) S.win[--S.head] = old; else S.win.unshift(old);
        }
        S.redo.push(rec);
        return true;
      },
      reset() {
        S.root = mk("", null); S.win = []; S.head = 0; S.redo = []; S.undoable = 0;
        S.analyzed = 0; S.lines = 0; S.nodes = 1; S.folds = 0;
      },
    };
  }

  // The book's main line: the most frequent branch at every step.
  function mainLine(root) {
    const out = [];
    for (let n = root; n.kids.size;) {
      let b = null;
      for (const c of n.kids.values()) if (!b || c.count > b.count || (c.count === b.count && c.tok < b.tok)) b = c;
      out.push(b); n = b;
    }
    return out;
  }

  // ---------------------------------------------------------------- what to draw, and where
  // Best-first: open the busiest line next (deeper lines weigh more, so the main line runs
  // far to the right like a chess book), top `maxKids` branches per node, until the rows
  // run out. Branches that were already on screen get a bonus so near-ties do not flicker.
  function layout(root, P) {
    const total = root.count, prev = P.prev || new Set(), stick = P.stick || 1.25;
    const minCount = Math.max(1, Math.ceil(total * P.minShare));
    const weight = c => c.count * (prev.has(c.key) ? stick : 1);
    const pri = n => weight(n) * Math.pow(P.deep, n.depth);
    const open = new Map();
    let used = P.rowH;
    const heap = [root];
    while (heap.length) {
      let bi = 0;
      for (let i = 1; i < heap.length; i++) if (pri(heap[i]) > pri(heap[bi])) bi = i;
      const n = heap[bi];
      heap[bi] = heap[heap.length - 1]; heap.pop();
      if (n.depth >= P.maxDepth || !n.kids.size || n.count < minCount) continue;
      const kids = [...n.kids.values()]
        .sort((a, b) => weight(b) - weight(a) || b.count - a.count || (a.tok < b.tok ? -1 : 1))
        .filter(c => weight(c) >= minCount).slice(0, P.maxKids);
      while (kids.length) {
        const hidden = n.kids.size - kids.length;
        if (used + (kids.length - 1) * P.rowH + (hidden ? P.moreH : 0) <= P.budget) break;
        kids.pop();
      }
      if (!kids.length) continue;
      const hidden = n.kids.size - kids.length;
      used += (kids.length - 1) * P.rowH + (hidden ? P.moreH : 0);
      let hiddenHands = n.count;
      for (const c of kids) hiddenHands -= c.count;
      open.set(n, { kids, hidden, hiddenHands });
      for (const c of kids) heap.push(c);
    }

    const items = [];
    let cursor = 0;
    // The busiest branch runs straight on; the next two fan out above and below it.
    const order = (k, d) => (k.length === 3 ? [k[1], k[0], k[2]] : k.length === 2 && d % 2 ? [k[1], k[0]] : k);
    (function place(n, parent) {
      const it = {
        node: n, key: n.key, parent, depth: n.depth, x: P.x0 + n.depth * P.colW, y: 0,
        leaf: true, more: 0, moreHands: 0, moreY: 0, kids: [],
      };
      items.push(it);
      if (parent) parent.kids.push(it);
      const o = open.get(n);
      if (!o) { it.y = cursor + P.rowH / 2; cursor += P.rowH; return it; }
      it.leaf = false;
      for (const c of order(o.kids, n.depth)) {
        const ci = place(c, it);
        if (c === o.kids[0]) it.y = ci.y;
      }
      if (o.hidden) {
        it.more = o.hidden; it.moreHands = o.hiddenHands;
        it.moreY = cursor + P.moreH / 2; cursor += P.moreH;
      }
      return it;
    })(root, null);
    const off = P.top + Math.max(0, (P.budget - cursor) / 2);
    for (const it of items) { it.y += off; if (it.more) it.moreY += off; }
    return { items, used: cursor, minCount };
  }

  // Where text sits around a node at (0, 0), in px. Shared by the renderer and the self-test.
  // Labels go on the side of the branch away from its parent, so a label never covers its
  // own curve; the % goes on the other side.
  const CAP = 0.66, ADV = 0.6; // Source Code Pro cap height and advance width, in em
  function textGeom(fs) {
    const side = (below, f) => (below ? 3.5 + CAP * f : -3.5);
    return {
      lab(tok, below) {
        const f = tok === SD || tok === FO ? Math.min(fs, 9) : fs, w = tok.length * f * ADV, ty = side(below, f);
        return { f, tx: -6, ty, x: -7 - w, y: ty - CAP * f - 0.5, w: w + 2, h: CAP * f + 1 };
      },
      pct(s, below) {
        const f = 9, w = s.length * f * ADV, ty = side(below, f);
        return { f, tx: -6, ty, x: -6 - w, y: ty - CAP * f, w, h: CAP * f };
      },
      cnt(s) {
        const w = s.length * fs * ADV, ty = (CAP * fs) / 2;
        return { f: fs, tx: 6, ty, x: 4.5, y: -ty - 1.5, w: w + 3, h: CAP * fs + 3 };
      },
      more(s, dx, dy) {
        const f = 9, w = s.length * f * ADV, ty = dy + (CAP * f) / 2;
        return { f, tx: dx + 3, ty, x: dx + 1.5, y: ty - CAP * f - 1.5, w: w + 3, h: CAP * f + 3 };
      },
    };
  }

  // Smooth branch: leaves the node at an angle, bends, then runs level for the last 28px,
  // where the % sits on the curve's side (the label is on the other side).
  function edgePath(px, py, x, y) {
    const r = v => Math.round(v * 10) / 10;
    const dy = y - py, w = Math.max((x - px) * 0.42, x - px - 28);
    if (Math.abs(dy) < 0.5) return `M${r(px)},${r(py)}H${r(x)}`;
    return `M${r(px)},${r(py)}C${r(px + w * 0.3)},${r(py + dy * 0.62)} ${r(px + w * 0.55)},${r(y)} ${r(px + w)},${r(y)}H${r(x)}`;
  }

  return {
    RANK, SUIT, NAMES, N, SB, BB, START, POS, SD, FO, fmt, EQ,
    evaluate, handName, equity, simulateHand, toRecord, bucket, wordParts, createBook, mainLine,
    layout, textGeom, edgePath, _seats: seats,
  };
})();

// ==== The page: DOM, animation, controls ====
(() => {
  "use strict";
  const C = BookCore, fmt = C.fmt;
  const $ = id => document.getElementById(id);
  if (!$("book")) return; // this page doesn't have Exhibit E's markup
  const NS = "http://www.w3.org/2000/svg";
  const setA = (e, a) => { for (const k in a) e.setAttribute(k, a[k]); return e; };
  const el = (tag, a, parent) => { const e = setA(document.createElementNS(NS, tag), a || {}); if (parent) parent.appendChild(e); return e; };

  const WINDOW = 10000;
  const book = C.createBook({ window: WINDOW, depth: 9, undo: 500 });
  const make = () => C.toRecord(C.simulateHand());

  // ---------------------------------------------------------------- geometry
  const fig = $("bk-fig"), svg = $("bk-tree");
  const gE = el("g", {}, svg), gM = el("g", {}, svg), gT = el("g", {}, svg);
  const wall = el("g", { class: "wall" }, svg);
  const gC = el("g", { class: "bc", "aria-hidden": "true" }, svg); // street cards, on top
  el("path", { class: "wl", d: "M0,-16V16M0,-15l-6,6M0,-9l-6,6M0,-3l-6,6M0,3l-6,6M0,9l-6,6M0,15l-2,2" }, wall);
  el("path", { class: "wl ww", d: "M0,-16V16" }, wall);
  const wallN = el("text", { x: -10, y: -2, "text-anchor": "end" }, wall);
  const wallH = el("text", { x: -10, y: 10, "text-anchor": "end" }, wall);
  wallN.textContent = "0"; wallH.textContent = "HANDS";

  let G = null, T = null;
  function measure() {
    const cw = fig.clientWidth || 320;
    const narrow = cw < 560;
    const fs = narrow ? 9 : 10, x0 = narrow ? 46 : 52;
    let right = 60; // room for street cards beside the last column
    const minCol = narrow ? 62 : 68, avail = cw - x0 - right;
    // Phones keep 7 columns and scroll inside the figure; wider screens fit 7 to 9.
    const maxDepth = narrow ? 7 : Math.max(7, Math.min(9, Math.floor(avail / minCol)));
    const colW = Math.max(minCol, Math.floor(avail / maxDepth));
    // Where the wider margin alone would make the figure scroll, give it back.
    const base = x0 + maxDepth * colW;
    if (base + right > cw && base + (narrow ? 42 : 48) <= cw) right = cw - base;
    const rowH = narrow ? 20 : 22, rows = narrow ? 20 : 26, top = 14;
    const W = x0 + maxDepth * colW + right, H = rows * rowH + top * 2;
    const changed = !G || G.W !== W || G.fs !== fs;
    G = { narrow, fs, x0, colW, maxDepth, rowH, moreH: 12, budget: rows * rowH, top, W, H, deep: 2.2, maxKids: 3, minShare: 0.004 };
    T = C.textGeom(fs);
    setA(svg, { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const scrolls = W > cw + 1;
    if (scrolls) setA(fig, { tabindex: "0", role: "region", "aria-label": "Opening book tree, scrolls sideways" });
    else { fig.removeAttribute("tabindex"); fig.removeAttribute("role"); fig.removeAttribute("aria-label"); }
    if (!compiling) $("bk-figNote").textContent = scrolls ? "SCROLL THE FIGURE SIDEWAYS FOR DEEPER LINES" : "READ LEFT TO RIGHT FROM THE WALL";
    return changed;
  }

  // ---------------------------------------------------------------- one drawn node
  // Each node on screen has a record keyed by its line ("/UTG C/BB X"), so it keeps its
  // place while counts change, grows out of its parent when it appears and shrinks back
  // into it when it goes.
  const recs = new Map();
  function makeRec(key) {
    const r = { key, isRoot: key === "", x: 0, y: 0, a: 0, my: 0, tx: 0, ty: 0, ta: 1, tmy: 0,
      parent: null, item: null, node: null, dying: false, leaf: false, more: 0, below: false, w: 1, hl: 0, hlc: 0, hlm: 0 };
    r.e = el("path", { class: "e" }, gE);
    r.ms = el("path", { class: "ms" }, gE);
    r.gm = el("g", {}, gM);
    r.dot = el("circle", { class: "dot", r: 2.5 }, r.gm);
    r.box = el("rect", { class: "bx", x: -2.5, y: -5, width: 5, height: 10 }, r.gm);
    r.gt = el("g", {}, gT);
    r.tt = el("title", {}, r.gt);
    r.lb = el("rect", { class: "lb" }, r.gt);
    r.lt = el("text", { class: "lt", "text-anchor": "end" }, r.gt);
    r.pt = el("text", { class: "pt", "text-anchor": "end" }, r.gt);
    r.cb = el("rect", { class: "cb" }, r.gt);
    r.ct = el("text", { class: "ct" }, r.gt);
    r.mb = el("rect", { class: "mb" }, r.gt);
    r.mt = el("text", { class: "mt" }, r.gt);
    if (r.isRoot) for (const e of [r.e, r.gm, r.lb, r.lt, r.pt, r.cb, r.ct]) e.setAttribute("display", "none");
    return r;
  }
  const show = (e, on) => e.setAttribute("display", on ? "inline" : "none");
  const pctText = s => (s >= 0.995 ? "100%" : s >= 0.01 ? Math.round(s * 100) + "%" : s > 0 ? "<1%" : "0%");

  function setStatic(r) {
    const it = r.item, n = r.node;
    r.leaf = it.leaf && !r.isRoot;
    r.more = it.more;
    if (!r.isRoot) {
      r.below = it.y > it.parent.y + 0.5;
      const lb = T.lab(n.tok, r.below);
      r.lt.textContent = n.tok;
      setA(r.lt, { x: lb.tx, y: lb.ty, "font-size": lb.f });
      setA(r.lb, { x: lb.x, y: lb.y, width: lb.w, height: lb.h });
      setA(r.pt, { x: -6, y: T.pct("", !r.below).ty });
      const chance = n.type === "chance";
      setA(r.dot, { class: chance ? "ch" : "dot", r: chance ? 3.5 : 2.5 });
      show(r.dot, !r.leaf);
      show(r.box, r.leaf);
      show(r.ct, r.leaf); show(r.cb, r.leaf);
      setA(r.ct, { x: 6, y: T.cnt("").ty, "font-size": G.fs });
    }
    show(r.ms, r.more); show(r.mt, r.more); show(r.mb, r.more);
    const sd = n.count ? Math.round((100 * n.sd) / n.count) : 0;
    const avg = n.count ? fmt(Math.round(n.pot / n.count)) : "0";
    r.tt.textContent = r.isRoot
      ? `${fmt(n.count)} hands in the book`
      : `${n.tok}: ${fmt(n.count)} hands, ${sd}% reach showdown, average pot ${avg}, ${fmt(n.folds)} folds here` +
        (r.more ? `; ${r.more} more branches (${fmt(it.moreHands)} hands) not drawn` : "");
  }

  // ---------------------------------------------------------------- rebuild the drawing
  let prevKeys = new Set();
  function rebuild() {
    const L = C.layout(book.root, { ...G, prev: prevKeys });
    const keep = new Set();
    for (const it of L.items) {
      let r = recs.get(it.key);
      const pr = it.parent ? recs.get(it.parent.key) : null;
      if (!r) {
        r = makeRec(it.key);
        recs.set(it.key, r);
        const from = pr || { x: it.x, y: it.y };
        r.x = from.x; r.y = from.y; r.my = from.y; r.a = pr ? 0 : 1;
      }
      Object.assign(r, { dying: false, parent: pr, item: it, node: it.node, tx: it.x, ty: it.y, tmy: it.more ? it.moreY : it.y, ta: 1 });
      setStatic(r);
      keep.add(it.key);
    }
    for (const [k, r] of recs) if (!keep.has(k)) { r.dying = true; r.ta = 0; }
    prevKeys = keep;
    applyHl();
    mainLineText();
    dirty = true;
  }

  // ---------------------------------------------------------------- motion
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dirty = true;
  function animate(dt) {
    const k = reduce ? 1 : 1 - Math.exp(-dt / 110);
    let moving = false;
    for (const r of recs.values()) {
      if (r.dying && r.parent) { r.tx = r.parent.x; r.ty = r.parent.y; r.tmy = r.parent.y; }
      for (const [p, t] of [["x", "tx"], ["y", "ty"], ["my", "tmy"], ["a", "ta"]]) {
        const d = r[t] - r[p];
        if (Math.abs(d) < 0.05) r[p] = r[t]; else { r[p] += d * k; moving = true; }
      }
    }
    if (!moving && !dirty) return false;
    dirty = false;
    for (const r of recs.values()) {
      if (r.dying && r.a < 0.03) {
        for (const e of [r.e, r.ms, r.gm, r.gt]) e.remove();
        recs.delete(r.key);
        continue;
      }
      const op = r.a.toFixed(3), tr = `translate(${r.x.toFixed(1)},${r.y.toFixed(1)})`;
      if (r.isRoot) wall.setAttribute("transform", tr);
      else {
        r.e.setAttribute("d", C.edgePath(r.parent.x, r.parent.y, r.x, r.y));
        r.e.setAttribute("opacity", op);
        setA(r.gm, { transform: tr, opacity: op });
      }
      setA(r.gt, { transform: tr, opacity: op });
      if (r.more) {
        const dx = G.colW * 0.28, dy = r.my - r.y;
        setA(r.ms, { d: `M${r.x.toFixed(1)},${r.y.toFixed(1)}C${(r.x + dx * 0.3).toFixed(1)},${(r.y + dy * 0.7).toFixed(1)} ${(r.x + dx * 0.5).toFixed(1)},${r.my.toFixed(1)} ${(r.x + dx).toFixed(1)},${r.my.toFixed(1)}`, opacity: op });
        const m = T.more(r.mt.textContent, dx, dy);
        setA(r.mt, { x: m.tx, y: m.ty });
        setA(r.mb, { x: m.x, y: m.y, width: m.w, height: m.h });
      }
    }
    placeCards();
    return moving;
  }

  // ---------------------------------------------------------------- numbers on the tree
  function updateTexts() {
    const total = book.root.count || 1;
    for (const r of recs.values()) {
      if (r.dying) continue;
      const n = r.node;
      if (r.more) r.mt.textContent = `+${r.more} MORE`;
      if (r.isRoot) continue;
      const p = r.item.parent.node;
      // A branch every hand takes (single lines, street cards) needs no percentage.
      const share = p.count ? n.count / p.count : 0;
      r.pt.textContent = share >= 0.995 ? "" : pctText(share);
      r.w = 1 + 3 * Math.sqrt(Math.min(1, n.count / total)); // 1px to 4px
      setStrokes(r);
      if (r.leaf) {
        const s = fmt(n.count), c = T.cnt(s);
        r.ct.textContent = s;
        setA(r.cb, { x: c.x, y: c.y, width: c.w, height: c.h });
        r.box.setAttribute("class", n.count && n.sd * 2 >= n.count ? "bx full" : "bx");
      }
    }
    wallN.textContent = fmt(book.size);
    wallH.textContent = book.size === 1 ? "HAND" : "HANDS";
    $("bk-hands").textContent = fmt(book.analyzed);
    $("bk-held").textContent = fmt(book.size);
    $("bk-lines").textContent = fmt(book.lines);
    $("bk-folds").textContent = fmt(book.folds);
    $("bk-prev").setAttribute("aria-disabled", book.canUndo ? "false" : "true");
    // Labels, counts and "+N MORE" have just changed size, so the cards look for a spot again.
    streetCards();
    dirty = true;
  }
  function setStrokes(r) {
    r.e.setAttribute("stroke-width", (r.w + (r.hl ? 2 : 0)).toFixed(2));
    if (!r.leaf && r.node && r.node.type !== "chance") r.dot.setAttribute("r", r.hl ? 3.5 : 2.5);
  }

  // ---------------------------------------------------------------- the highlighted hand
  let shown = null;
  function setHighlight(rec) {
    shown = rec;
    applyHl();
    lastText();
  }
  function applyHl() {
    for (const r of recs.values()) { r.hl = r.hlc = r.hlm = 0; }
    if (shown) {
      let key = "", at = recs.get(""), k = 0;
      for (; k < shown.tokens.length; k++) {
        key += "/" + shown.tokens[k];
        const r = recs.get(key);
        if (!r || r.dying) break;
        r.hl = 1; at = r;
      }
      // Where the hand leaves the drawing: its "+N MORE", or the box that cuts the line off.
      if (at) { if (k < shown.tokens.length && at.more) at.hlm = 1; else if (at.leaf) at.hlc = 1; }
    }
    streetCards();
    for (const r of recs.values()) {
      r.gt.classList.toggle("hl", !!r.hl);
      r.gt.classList.toggle("hlc", !!r.hlc);
      r.gt.classList.toggle("hlm", !!r.hlm);
      r.gm.classList.toggle("hl", !!r.hl);
      if (!r.isRoot) setStrokes(r);
      if (r.hl) { gE.appendChild(r.e); }
    }
    dirty = true;
  }

  // The highlighted hand's flop, turn and river as tiny cards next to those nodes. Rows are
  // only 22px apart, so the cards are one line high (rank and suit side by side), and each
  // group takes whichever spot near its node covers the fewest labels, counts and branches.
  // Streets the drawing doesn't reach go where the hand leaves it: beside its "+N MORE" or
  // the box that cuts its line off, with a wider gap between flop, turn and river.
  const STREET = { FLOP: [0, 3], TURN: [3, 4], RIVER: [4, 5] };
  const CH = 10, GAP = 2, SGAP = 5, CPX = 4.8; // card height, gaps within and between streets, 8px glyph advance
  let marks = [];
  function streetCards() {
    gC.textContent = "";
    marks = [];
    if (!shown || !shown.board || !shown.board.length) return;
    // Walk the hand's line as far as it is drawn (as applyHl does).
    const want = [];
    let key = "", at = recs.get(""), dealt = 0;
    for (const tok of shown.tokens) {
      const r = recs.get(key + "/" + tok);
      if (!r || r.dying) break;
      key += "/" + tok; at = r;
      const span = STREET[tok];
      if (!span) continue;
      const cards = shown.board.slice(span[0], span[1]);
      if (cards.length) want.push({ r, from: span[0], cards, anchor: "node" });
      dealt = span[1];
    }
    const rest = shown.board.slice(dealt), last = want[want.length - 1];
    if (rest.length && at && !at.dying) {
      // A line cut off at its own FLOP or TURN keeps the whole board in one group, in order.
      if (last && last.r === at && !at.more) { last.cards = last.cards.concat(rest); last.anchor = at.leaf ? "box" : "node"; }
      else want.push({ r: at, from: dealt, cards: rest, anchor: at.more ? "more" : at.leaf ? "box" : "node" });
    }
    if (!want.length) return;
    const { boxes, pts } = obstacles();
    for (const { r, from, cards, anchor } of want) {
      const faces = cards.map(c => C.RANK[c % 13] + C.SUIT[(c / 13) | 0]);
      const ws = faces.map(f => [...f.replace("︎", "")].length * CPX + 3.5);
      const gapBefore = i => (from + i === 3 || from + i === 4 ? SGAP : GAP); // wider between streets
      // One row, or, when a later street follows, two rows (first street on top) so a long
      // board still finds room in a crowded spot.
      const all = faces.map((f, i) => i), cut = all.findIndex(i => i > 0 && gapBefore(i) === SGAP);
      const shapes = [[all]];
      if (cut > 0) shapes.push([all.slice(0, cut), all.slice(cut)]);
      // Spots relative to the anchor's resting place: the node, or the hand's "+N MORE" line.
      const oy = anchor === "more" ? r.tmy : r.ty;
      const m = anchor === "more" ? T.more(r.mt.textContent, G.colW * 0.28, 0) : null;
      const cx = m ? m.x + m.w / 2 : 0; // the point the cards should stay close to
      const right = anchor === "more" ? m.x + m.w + 3 : r.leaf ? +r.cb.getAttribute("x") + +r.cb.getAttribute("width") + 3 : 5;
      let best = null, bestCost = Infinity;
      for (const rows of shapes) {
        const rowW = rows.map(row => row.reduce((t, i, j) => t + ws[i] + (j ? gapBefore(i) : 0), 0));
        const w = Math.max(...rowW), h = rows.length * CH + (rows.length - 1) * 2;
        const off = 6.5, ys = [off, off + 6, off + 12, -off - h, -off - 6 - h, -off - 12 - h]; // clear of the dot and count box
        const xs = m ? [m.x, m.x + 12, cx - w / 2, right, m.x - w - 3] : [4, 16, 28, -w / 2, -w - 4, -w - 16];
        const spots = [[right, -h / 2]];
        for (const dy of ys) for (const dx of xs) spots.push([dx, dy]);
        for (const [dx, dy] of spots) {
          // The cards plus their 1px shadow, with 1.5px of air all round.
          const x0 = r.tx + dx - 1.5, y0 = oy + dy - 1.5, x1 = x0 + w + 4, y1 = y0 + h + 4;
          let cost = Math.hypot(dx + w / 2 - cx, dy + h / 2) / 2 + (rows.length - 1) * 6; // near the anchor, one row if it fits
          if (x0 + 1.5 < 0 || y0 + 1.5 < 0 || x1 - 1.5 > G.W || y1 - 1.5 > G.H) cost += 1e4;
          for (const b of boxes) {
            const ox = Math.min(x1, b[2]) - Math.max(x0, b[0]), oy2 = Math.min(y1, b[3]) - Math.max(y0, b[1]);
            if (ox > 0 && oy2 > 0) cost += 30 + 3 * ox * oy2; // covering text is the worst outcome
          }
          for (const [px, py, hl] of pts) if (px > x0 && px < x1 && py > y0 && py < y1) cost += hl ? 8 : 2;
          if (cost < bestCost) { bestCost = cost; best = { dx, dy, rows, w, h }; }
        }
      }
      const g = el("g", {}, gC);
      best.rows.forEach((row, k) => {
        const y0 = best.dy + k * (CH + 2);
        let x = best.dx;
        row.forEach((i, j) => {
          if (j) x += gapBefore(i);
          el("rect", { class: "cs", x: x + 1, y: y0 + 1, width: ws[i], height: CH, rx: 1.5 }, g);
          el("rect", { class: "cf", x: x + 0.5, y: y0 + 0.5, width: ws[i] - 1, height: CH - 1, rx: 1.5 }, g);
          el("text", { x: x + ws[i] / 2, y: y0 + 7.6 }, g).textContent = faces[i];
          x += ws[i];
        });
      });
      boxes.push([r.tx + best.dx, oy + best.dy, r.tx + best.dx + best.w + 1, oy + best.dy + best.h + 1]);
      marks.push({ r, g, my: anchor === "more" });
    }
  }
  // Everything already on the tree, at its resting place: text boxes as [x0, y0, x1, y1] and
  // points sampled along every branch ([x, y, isHighlighted]).
  function obstacles() {
    const boxes = [], pts = [];
    const add = (r, x, y, w, h) => { if (w > 0) boxes.push([r.tx + x, r.ty + y, r.tx + x + w, r.ty + y + h]); };
    const attr = (e, k) => +e.getAttribute(k) || 0;
    for (const r of recs.values()) {
      if (r.dying) continue;
      if (r.more) { const m = T.more(r.mt.textContent, G.colW * 0.28, r.tmy - r.ty); add(r, m.x, m.y, m.w, m.h); }
      if (r.isRoot || !r.parent) continue;
      add(r, attr(r.lb, "x"), attr(r.lb, "y"), attr(r.lb, "width"), attr(r.lb, "height"));
      if (r.pt.textContent) { const q = T.pct(r.pt.textContent, !r.below); add(r, q.x, q.y, q.w, q.h); }
      if (r.leaf) add(r, attr(r.cb, "x"), attr(r.cb, "y"), attr(r.cb, "width"), attr(r.cb, "height"));
      add(r, -3.5, -5, 7, 10); // the node's own dot or box
      // The branch in from the parent, sampled the way edgePath draws it.
      const px = r.parent.tx, py = r.parent.ty, x = r.tx, y = r.ty, dy = y - py;
      const w = Math.max((x - px) * 0.42, x - px - 28), h = !!r.hl;
      if (Math.abs(dy) < 0.5) for (let u = px; u <= x; u += 4) pts.push([u, y, h]);
      else {
        for (let i = 0; i <= 16; i++) {
          const t = i / 16, m = 1 - t;
          pts.push([m * m * m * px + 3 * m * m * t * (px + w * 0.3) + 3 * m * t * t * (px + w * 0.55) + t * t * t * (px + w),
            m * m * m * py + 3 * m * m * t * (py + dy * 0.62) + 3 * m * t * t * y + t * t * t * y, h]);
        }
        for (let u = px + w; u <= x; u += 4) pts.push([u, y, h]);
      }
    }
    return { boxes, pts };
  }
  function placeCards() {
    for (const m of marks) {
      const y = m.my ? m.r.my : m.r.y;
      setA(m.g, { transform: `translate(${m.r.x.toFixed(1)},${y.toFixed(1)})`, opacity: m.r.dying ? 0 : m.r.a.toFixed(3) });
    }
  }

  // ---------------------------------------------------------------- readouts below the figure
  let chPx = 9;
  function measureCh() {
    const s = document.createElement("span");
    s.textContent = "0".repeat(40);
    s.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    document.body.appendChild(s);
    chPx = s.getBoundingClientRect().width / 40 || 9;
    s.remove();
  }
  // Breaks a line of notation across numbered rows, the way a printer would.
  function wrapInto(cls, parts, tail) {
    const rows = [...$("book").querySelectorAll("." + cls)];
    const max = Math.max(12, Math.floor((rows[0].clientWidth - 2 * chPx) / chPx) - 1);
    const lines = [];
    let cur = "";
    parts.forEach((p, i) => {
      const piece = p + (i < parts.length - 1 ? tail : "");
      const cand = cur ? cur + " " + piece : piece;
      if (cand.length <= max || !cur) cur = cand; else { lines.push(cur); cur = piece; }
    });
    if (cur) lines.push(cur);
    if (lines.length > rows.length) {
      lines.length = rows.length;
      const l = lines[rows.length - 1];
      lines[rows.length - 1] = (l.length > max - 2 ? l.slice(0, max - 2) : l) + " …";
    }
    rows.forEach((row, i) => { row.firstElementChild.textContent = lines[i] || ""; });
  }

  function mainLineText() {
    if (!$("bk-mainMeta")) return; // the most common line is not shown on this page
    const line = C.mainLine(book.root);
    if (!line.length) {
      $("bk-mainMeta").textContent = "NO HANDS YET"; $("bk-mainPot").textContent = "";
      wrapInto("wrap-main", [], ""); return;
    }
    const end = line[line.length - 1], total = book.root.count;
    const share = ((100 * end.count) / total).toFixed(1);
    const done = end.type === "end";
    $("bk-mainMeta").textContent = `${fmt(end.count)} HAND${end.count === 1 ? "" : "S"} (${share}%) ${done ? "PLAY IT OUT" : "GET THIS FAR"}`;
    $("bk-mainPot").textContent = `AVG POT ${fmt(Math.round(end.pot / end.count))}`;
    const parts = C.wordParts(line.map(n => n.tok));
    if (!done) parts[parts.length - 1] += " …";
    wrapInto("wrap-main", parts, ",");
  }

  function lastText() {
    const r = shown;
    if (!r) {
      $("bk-lastNo").textContent = "NO HANDS YET"; $("bk-lastRes").textContent = "";
      wrapInto("wrap-last", [], ""); showCards(null); return;
    }
    $("bk-lastNo").textContent = `#${fmt(r.idx)}  POT ${fmt(r.pot)}  ${r.folds} FOLD${r.folds === 1 ? "" : "S"}`;
    $("bk-lastRes").textContent = r.showdown
      ? `${r.split ? "SPLIT, " + r.winPos + " TOP" : r.winPos + " WINS"}: ${r.result}`
      : `${r.winPos} WINS UNCONTESTED`;
    wrapInto("wrap-last", r.tokens, " ·");
    showCards(r);
  }
  // The last hand as tiny cards: the board in its five slots, then the winner's two cards,
  // face down when everyone else folded and nobody saw them.
  const cardHTML = c => `<span class="mc">${C.RANK[c % 13]}<i>${C.SUIT[(c / 13) | 0]}</i></span>`;
  function showCards(r) {
    const slots = [];
    for (let j = 0; j < 5; j++) slots.push(r && j < r.board.length ? cardHTML(r.board[j]) : '<span class="mc slot"></span>');
    $("bk-board").innerHTML = slots.join("");
    $("bk-win").innerHTML = !r || !r.win.length ? '<span class="mc slot"></span><span class="mc slot"></span>'
      : r.showdown ? r.win.map(cardHTML).join("") : '<span class="mc back"></span><span class="mc back"></span>';
  }

  // ---------------------------------------------------------------- playback
  // Hands per second at 1x and 4x; 16x plays as many as fit in a few ms of each frame.
  const RATE = { 1: 4, 4: 80, 8: 600 }, FRAME_MS = 5, HL_MS = 350, BUILD_MS = 500;
  let speed = 16, paused = reduce, inView = true, compiling = false;
  const running = () => !paused && inView && !document.hidden && !compiling;
  let raf = 0, last = 0, acc = 0, hpsAcc = 0, lastBuild = -1e9, lastHl = -1e9, lastTxt = -1e9;
  let needBuild = true, needText = true;

  function addHands(dt) {
    const t0 = performance.now();
    let added = 0;
    if (speed === 16) {
      do { book.add(make()); added++; } while (performance.now() - t0 < FRAME_MS && added < 400);
    } else {
      acc = Math.min(acc + (dt / 1000) * RATE[speed], Math.max(4, RATE[speed] / 10)); // room for 8x's rate
      while (acc >= 1) {
        book.add(make()); added++; acc--;
        if (performance.now() - t0 > FRAME_MS) { acc = 0; break; }
      }
    }
    hpsAcc += added;
    return added;
  }

  let wasRunning = false;
  function frame(t) {
    raf = 0;
    // Reduced motion compiles the book first; nothing is drawn from a half-built book.
    if (compiling) { last = 0; return; }
    const dt = last ? Math.min(100, t - last) : 16;
    last = t;
    const run = running();
    if (wasRunning && !run) {
      // Just stopped: settle on the true last hand and up-to-date numbers.
      if (book.last() !== shown) setHighlight(book.last());
      needBuild = true; needText = true;
    }
    wasRunning = run;
    if (run) {
      const added = addHands(dt);
      // At 1x every hand gets its moment; faster, one recent hand every HL_MS.
      if (added && (speed === 1 || t - lastHl >= HL_MS)) { setHighlight(book.last()); lastHl = t; }
      if (added && speed === 1) needBuild = true;
    }
    if (needBuild || (running() && t - lastBuild >= BUILD_MS)) { rebuild(); needBuild = false; lastBuild = t; needText = true; }
    if (needText || (running() && t - lastTxt >= 100)) { updateTexts(); needText = false; lastTxt = t; }
    const moving = animate(dt);
    if (running() || moving || needBuild || needText) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  setInterval(() => {
    $("bk-hps").textContent = running() ? fmt(hpsAcc) : "0";
    hpsAcc = 0;
  }, 1000);

  // ---------------------------------------------------------------- controls
  const playBtn = $("bk-play");
  function syncPlay() {
    playBtn.textContent = paused ? "[PLAY]" : "[PAUSE]";
    playBtn.setAttribute("aria-label", paused ? "Play" : "Pause");
  }
  function stepped(rec) {
    paused = true; syncPlay();
    setHighlight(rec);
    needBuild = true; needText = true;
    kick();
  }
  playBtn.addEventListener("click", () => { paused = !paused; syncPlay(); last = 0; kick(); });
  $("bk-next").addEventListener("click", () => { if (!compiling) stepped(book.forward(make)); });
  $("bk-prev").addEventListener("click", () => { if (!compiling && book.back()) stepped(book.last()); });
  $("bk-first").addEventListener("click", () => {
    if (compiling) return;
    book.reset(); acc = 0;
    setHighlight(null);
    needBuild = true; needText = true;
    kick();
  });
  document.querySelectorAll("#book [data-speed]").forEach(b => b.addEventListener("click", () => {
    speed = +b.dataset.speed; acc = 0;
    document.querySelectorAll("#book [data-speed]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  }));
  document.addEventListener("visibilitychange", () => { last = 0; kick(); });
  new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); last = 0; kick(); }).observe(fig);
  const relayout = () => {
    measureCh();
    if (measure()) needBuild = true;
    needText = true;
    if (!compiling) { lastText(); mainLineText(); }
    kick();
  };
  new ResizeObserver(relayout).observe(fig);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureCh(); if (!compiling) { lastText(); mainLineText(); } });

  // ---------------------------------------------------------------- start
  measureCh();
  measure();
  syncPlay();
  if (reduce) {
    // Reduced motion: compile a full book quietly, then show it still. Until then only
    // the empty wall is drawn, in its place.
    rebuild(); updateTexts(); animate(16);
    compiling = true;
    $("bk-figNote").textContent = "COMPILING THE BOOK";
    const chunk = () => {
      const t0 = performance.now();
      while (book.size < WINDOW && performance.now() - t0 < 12) book.add(make());
      $("bk-hands").textContent = fmt(book.analyzed);
      if (book.size < WINDOW) { setTimeout(chunk, 0); return; }
      compiling = false;
      measure();
      setHighlight(book.last());
      needBuild = true; needText = true;
      kick();
    };
    chunk();
  } else {
    kick();
  }
})();

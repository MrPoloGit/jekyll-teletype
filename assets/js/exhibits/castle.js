// Castle Challenge drawing. Five small castles drawn in the venue map's dots:
// a wall between two corner towers, with merlons and crenels along the tops.
// Soldiers are ink dots inside, one per soldier, filling from the bottom row
// up as the number fields change; a castle's flag goes up once exactly 100
// soldiers are placed across all five. Drawn at the figure's width in whole
// lines, like the map. Decorative: the number fields carry the real values.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 4848.
// Self-contained — no shared dependency on the other exhibits' scripts.
//
// Markup it expects (see exhibits.md): a <figure id="g1-castles"> with an
// empty <svg> inside, plus five <input id="g1c1">..<input id="g1c5">. Looks
// for games 1 and 2 (the source page has two allocation games); this page
// only has game 1, and the script already skips any game whose markup isn't
// present (`.filter(g => g.fig && g.inputs.every(Boolean))`).
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  // In castle cells: the wall is 12 wide and 11 tall, its top at y = 0, so towers and flags
  // have negative y. Soldier slots: 10 by 10 inside.
  const CW = 12, CH = 11, GAP = 3, ABOVE = 5, LABEL = 30;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (name, attrs, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const soldiers = i => { const v = i.value.trim(); return /^\d+$/.test(v) ? Math.min(100, Number(v)) : 0; };
  const games = [1, 2].map(n => ({
    fig: document.getElementById(`g${n}-castles`),
    inputs: [1, 2, 3, 4, 5].map(c => document.getElementById(`g${n}c${c}`)),
    drawnW: 0, prev: [0, 0, 0, 0, 0],
  })).filter(g => g.fig && g.inputs.every(Boolean));
  if (!games.length) return;

  // A castle, as lines in cell units. Every castle is the same; the label says its points.
  function castle() {
    const t = -2;                // tower tops, two cells over the wall
    const m = t - 1;             // tower merlon tops
    const outline = [
      [0, CH], [0, m], [1, m], [1, t], [2, t], [2, m], [3, m], [3, 0],            // left tower
      [3.5, 0], [3.5, -1], [4.5, -1], [4.5, 0], [5.5, 0], [5.5, -1], [6.5, -1],   // curtain wall
      [6.5, 0], [7.5, 0], [7.5, -1], [8.5, -1], [8.5, 0], [9, 0],
      [9, m], [10, m], [10, t], [11, t], [11, m], [12, m], [12, CH], [0, CH],    // right tower
    ];
    return { lines: [outline], pole: [[1.5, m], [1.5, m - 1.6]], pennant: [[2.4, m - 1.6]] };
  }
  // Soldier slots in fill order: bottom row first, left to right.
  const SLOTS = [];
  for (let r = 0; r < CH - 1; r++) for (let c = 0; c < 10; c++) SLOTS.push([c, r]);

  function draw(g) {
    const W = Math.round(g.fig.clientWidth);
    if (!W || W === g.drawnW) return;
    g.drawnW = W;
    const s = Math.max(3, Math.min(6, Math.floor(W / (5 * CW + 4 * GAP)))); // one cell, in px
    const step = (CW + GAP) * s, x0 = Math.round((W - (5 * CW + 4 * GAP) * s) / 2);
    const lh = parseFloat(getComputedStyle(g.fig).lineHeight) || 27;
    const H = Math.ceil(((ABOVE + CH) * s + 8 + LABEL) / lh) * lh; // whole lines, so the numbers keep their rhythm
    g.fig.style.height = H + "px";
    const svg = g.fig.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.textContent = "";
    const top = H - LABEL - CH * s; // the wall's top edge, in px
    const dot = (x, y, r) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    // Lines drawn as evenly spaced dots, like the map's coast.
    const dotted = (pts, ox, r) => {
      let d = "";
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) * 2)); // two dots per cell
        for (let k = 0; k < n; k++) d += dot(ox + (x1 + ((x2 - x1) * k) / n) * s, top + (y1 + ((y2 - y1) * k) / n) * s, r);
      }
      const [xe, ye] = pts[pts.length - 1];
      return d + dot(ox + xe * s, top + ye * s, r);
    };
    const fine = Math.max(0.6, s * 0.14);
    g.cells = []; g.flags = []; g.counts = [];
    for (let c = 0; c < 5; c++) {
      const ox = x0 + c * step, shape = castle();
      const grp = svg.appendChild(el("g", {}));
      grp.appendChild(el("path", { class: "stone", d: shape.lines.map(l => dotted(l, ox, fine)).join("") }));
      grp.appendChild(el("path", { class: "stone", d: dotted(shape.pole, ox, fine) }));
      g.flags.push(grp.appendChild(el("path", { class: "flag", d: shape.pennant.map(([x, y]) => dot(ox + x * s, top + y * s, s * 0.3)).join("") })));
      const cells = SLOTS.map(([col, row]) => grp.appendChild(el("circle", {
        class: "sol", cx: (ox + (1.5 + col) * s).toFixed(1), cy: (top + (CH - 1 - row) * s).toFixed(1), r: (s * 0.32).toFixed(2),
      })));
      g.cells.push(cells);
      const mid = ox + (CW * s) / 2;
      g.counts.push(grp.appendChild(el("text", { class: "n", x: mid.toFixed(1), y: H - LABEL + 13 }, "0")));
      grp.appendChild(el("text", { class: "d", x: mid.toFixed(1), y: H - LABEL + 26 }, c === 0 ? "1 PT" : `${c + 1} PTS`));
    }
    g.prev = [0, 0, 0, 0, 0];
    update(g, true);
  }

  function update(g, instant) {
    if (!g.cells) return;
    let sum = 0, valid = true;
    g.inputs.forEach((input, c) => {
      const raw = input.value.trim(), num = /^\d+$/.test(raw);
      if (raw && !num) valid = false;
      if (num) sum += Number(raw);
      const n = soldiers(input), was = g.prev[c];
      g.cells[c].forEach((cell, i) => {
        const on = i < n;
        if (cell.classList.contains("on") === on) return;
        // A short cascade: new soldiers march in from the bottom, leavers go from the top.
        cell.style.transitionDelay = instant || reduce ? "0ms" : `${Math.min(400, (on ? i - was : was - 1 - i) * 7)}ms`;
        cell.classList.toggle("on", on);
      });
      g.counts[c].textContent = String(n);
      g.prev[c] = n;
    });
    const placed = valid && sum === 100;
    g.flags.forEach((f, c) => f.classList.toggle("up", placed && g.prev[c] > 0));
  }

  for (const g of games) {
    for (const input of g.inputs) input.addEventListener("input", () => update(g));
    new ResizeObserver(() => draw(g)).observe(g.fig);
    draw(g);
  }
  if (document.fonts) document.fonts.ready.then(() => games.forEach(g => { g.drawnW = 0; draw(g); }));
})();

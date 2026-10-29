// Thank you. When an application goes in ("pbt:applied" on document), a short note sits over
// the page while the deck cascades off four foundation piles at the top right, kings first,
// each card bouncing to the floor and leaving a trail like the old solitaire win. The cards
// are this page's plain ones: paper face, ink border, offset shadow, rank over suit. A click,
// Esc or [CLOSE] ends it. With reduced motion there is only the note. Open the page with
// #thanks to preview it without filling in the form.
//
// Ported from teletype.html (source: pokerbot.sequoiacap.com), ~line 4968.
// Self-contained and fully decoupled from markup — it builds and appends its
// own overlay to document.body, so there's nothing to author in exhibits.md
// beyond something that fires the "pbt:applied" event (see the demo button).
(() => {
  "use strict";
  const RANK = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];
  const W = 42, H = 58;                 // card size in CSS px, as the exhibits' board cards
  const GRAVITY = 1500, BOUNCE = 0.78;  // px/s², and the share of speed kept after a bounce
  const EVERY = 380;                    // ms between cards leaving the piles
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let root = null, raf = 0, opener = null;

  // One card drawn once, then stamped every frame.
  function card(rank, suit, ink, paper, font, dpr) {
    const c = document.createElement("canvas");
    c.width = Math.ceil((W + 2) * dpr); c.height = Math.ceil((H + 2) * dpr);
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const shape = (x, y) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, W - 1, H - 1, 4); else g.rect(x, y, W - 1, H - 1); };
    g.fillStyle = ink; shape(2, 2); g.fill();                    // the offset shadow
    g.fillStyle = paper; shape(0.5, 0.5); g.fill();
    g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `17px ${font}`; g.fillText(rank, W / 2, H * 0.35);
    g.font = `21px ${font}`; g.fillText(suit, W / 2, H * 0.68);
    return c;
  }

  function cascade(cv) {
    const dpr = window.devicePixelRatio || 1, vw = innerWidth, vh = innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    const cs = getComputedStyle(cv);
    const ink = cs.getPropertyValue("--ink").trim() || "#111", paper = cs.getPropertyValue("--paper").trim() || "#fff";
    const font = getComputedStyle(document.body).fontFamily;
    const cache = new Map();
    const img = (r, s) => {
      const k = r * 4 + s;
      if (!cache.has(k)) cache.set(k, card(RANK[r], SUIT[s], ink, paper, font, dpr));
      return cache.get(k);
    };
    const gap = vw < 520 ? 8 : 14;
    const piles = [0, 1, 2, 3].map(i => ({ x: vw - 16 - (4 - i) * (W + gap), y: 16 }));
    const pile = (s, r) => {
      const p = piles[s];
      g.clearRect(p.x - 1, p.y - 1, W + 6, H + 6);
      if (r >= 0) g.drawImage(img(r, s), p.x, p.y, W + 2, H + 2);
    };
    piles.forEach((p, s) => pile(s, 12));
    const order = [];
    for (let r = 12; r >= 0; r--) for (let s = 0; s < 4; s++) order.push([r, s]);
    let next = 0, flying = [], last = 0, due = 0;
    function frame(now) {
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 0;
      last = now;
      if (next < order.length && now >= due) {
        const [r, s] = order[next++];
        pile(s, r - 1); // the card underneath shows
        const dir = Math.random() < 0.75 ? -1 : 1; // mostly out across the page
        flying.push({ im: img(r, s), x: piles[s].x, y: piles[s].y, vx: dir * (140 + Math.random() * 280), vy: -Math.random() * 520 });
        due = now + EVERY;
      }
      for (const c of flying) {
        c.vy += GRAVITY * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > vh - H) { c.y = vh - H; c.vy = -c.vy * BOUNCE; }
        g.drawImage(c.im, c.x, c.y, W + 2, H + 2); // never cleared: the trail
      }
      flying = flying.filter(c => c.x > -W - 4 && c.x < vw + 4);
      raf = next < order.length || flying.length ? requestAnimationFrame(frame) : 0;
    }
    raf = requestAnimationFrame(frame);
  }

  function close() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    root.remove(); root = null;
    document.documentElement.classList.remove("celebrating");
    const receipt = document.getElementById("receipt");
    const back = receipt && !receipt.hidden ? receipt : opener;
    if (back && back.focus) back.focus({ preventScroll: true });
  }

  function show() {
    close();
    opener = document.activeElement;
    root = document.createElement("div");
    root.className = "thanks"; // not "win": the duel marks a winning bot with that class
    root.innerHTML = '<canvas aria-hidden="true"></canvas>' +
      '<div class="thanks-card" role="dialog" aria-modal="true" aria-labelledby="win-title" aria-describedby="win-text">' +
      '<h2 id="win-title">*** Thank you for your submission ***</h2><p id="win-text"></p><button type="button">Close</button></div>';
    root.querySelector("#win-text").textContent = "We'll send updates on your application by email.";
    const btn = root.querySelector("button");
    btn.addEventListener("click", close);
    root.querySelector("canvas").addEventListener("click", close);
    root.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") { e.preventDefault(); btn.focus(); } // the note's only control keeps focus
    });
    document.body.appendChild(root);
    document.documentElement.classList.add("celebrating");
    btn.focus();
    if (!reduce) cascade(root.querySelector("canvas"));
  }

  document.addEventListener("pbt:applied", () => show());
  if (location.hash === "#thanks") {
    const go = () => show();
    if (document.fonts) document.fonts.ready.then(go); else go();
  }
})();

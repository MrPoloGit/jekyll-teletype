---
layout: page
title: Exhibits
description: Ported animations and diagrams from the source page — see plan.md's roadmap.
extra_css:
  - /assets/css/exhibits.css
extra_js:
  - /assets/js/exhibits/map.js
  - /assets/js/exhibits/live-tables.js
  - /assets/js/exhibits/duel.js
  - /assets/js/exhibits/message-trace.js
  - /assets/js/exhibits/castle.js
  - /assets/js/exhibits/thanks.js
  - /assets/js/exhibits/hand-tree.js
  - /assets/js/exhibits/opening-book.js
---

# Exhibits

[← Back to the main page]({{ "/" | relative_url }}){: .apply}

Ported, one at a time, from the source page's bespoke animations/diagrams —
see "Exhibits porting roadmap" in `plan.md` for the full list and status.
These are page-specific: each one's CSS/JS is declared in this page's own
front matter (`extra_css`/`extra_js`), not loaded site-wide.

## Venue map

<figure id="map" class="map-fig">
  <svg id="map-svg" role="img" aria-label="Map of the venues: regionals in the Bay Area (Nov. 6), Boston (Nov. 9) and Pittsburgh (Nov. 12); Finals in San Francisco (Nov. 15)."></svg>
</figure>

A dot-matrix United States, redrawn at the rendered column width. Resize the
window to see it redraw — it's generated from a ~90-point coastline outline
on every resize, not a static image.

## Exhibit A: live tables

10,000 simulated games, 8 bots each, no-limit hold'em — the whole exhibit
below (stats, grid, featured table, action strips) is one unit, so it shares
a single gutter number rather than numbering each internal row; see
`plan.md` for why.

<section class="exhibit-a" id="exhibit" aria-label="Exhibit A: simulated live poker tables" markdown="1">

<div class="row">10,000 GAMES, 8 BOTS EACH, NO-LIMIT HOLD'EM<span>SIMULATED PLAY</span></div>

<div class="row">HANDS PLAYED: <span id="hands">0</span><span>HANDS/SEC: <span id="hps">0</span></span></div>

<figure class="grid-fig"><canvas id="grid" aria-label="A grid of tiny poker tables, each with eight seats, playing hands at high speed"></canvas></figure>

<div class="row">SHOWING <span id="shown">0</span> OF 10,000 GAMES<span>▲ TABLE 4,812, FEATURED BELOW</span></div>

<div class="subhead">Table 4,812</div>

<div class="row">REPLAY<span>
<button class="t" id="first" aria-label="Back to start of hand">[|&lt;]</button><button class="t" id="prev" aria-label="Previous action">[&lt;]</button><button class="t" id="play" aria-label="Pause">[PAUSE]</button><button class="t" id="next" aria-label="Next action">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<div class="row"><span id="handinfo">HAND 000000, BLINDS 50/100</span><span id="street">—</span></div>

<figure class="table-fig" id="table" aria-label="Featured table with eight bots">
<div class="felt"></div>
<div class="center">
<div class="board" id="board"><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span></div>
<div id="pot">POT 0</div>
</div>
</figure>

<div class="subhead">Action</div>

<div id="strips"></div>

<p class="legend">b BLIND&nbsp;&nbsp;X CHECK&nbsp;&nbsp;C CALL&nbsp;&nbsp;B BET&nbsp;&nbsp;R RAISE&nbsp;&nbsp;A ALL-IN&nbsp;&nbsp;F FOLD&nbsp;&nbsp;W WIN</p>

</section>

## Exhibit C: heads-up duel

Two bots play heads-up, printing their reasoning into a terminal on each
side as a packet crosses the wire between them.

<section class="exhibit-c" id="duel" aria-label="Exhibit C: heads-up duel" markdown="1">

<div class="row">2 BOTS, HEADS-UP NO-LIMIT HOLD'EM, BLINDS 50/100<span>SIMULATED PLAY</span></div>

<div class="row">MATCH<span>
<button class="t" id="du-play" aria-label="Pause">[PAUSE]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false" aria-label="Speed 1x">1x</button><button class="t" data-speed="4" aria-pressed="false" aria-label="Speed 4x">4x</button><button class="t" data-speed="8" aria-pressed="true" aria-label="Speed 8x">8x</button><button class="t" data-speed="16" aria-pressed="false" aria-label="Speed 16x">16x</button>
</span></div>

<figure class="du-fig" aria-label="Simulated heads-up match: two example bots print their reasoning as they play">
<div class="du-side du-l" id="du-s0">
<div class="du-head"><span class="du-name">CFR-7</span><span class="du-pos">—</span><span class="du-stk">10,000</span></div>
<div class="du-hole"><span class="cd slot"></span><span class="cd slot"></span></div>
<div class="du-term"><div></div><div></div><div></div><div></div><div></div><div></div></div>
</div>
<div class="du-mid">
<div class="du-row"><span id="du-hand">HAND 000000</span><span id="du-street">—</span></div>
<div class="du-board" id="du-board"><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span><span class="cd slot"></span></div>
<div id="du-pot">POT 0</div>
<div class="du-wire"><span class="du-pkt" id="du-pkt"></span></div>
<div class="du-eq" title="True equity, both hands known"><span id="du-eq0">--</span><span class="du-bar"><i id="du-bar"></i></span><span id="du-eq1">--</span></div>
</div>
<div class="du-side du-r" id="du-s1">
<div class="du-head"><span class="du-name">MONTE</span><span class="du-pos">—</span><span class="du-stk">10,000</span></div>
<div class="du-hole"><span class="cd slot"></span><span class="cd slot"></span></div>
<div class="du-term"><div></div><div></div><div></div><div></div><div></div><div></div></div>
</div>
</figure>

<div class="row du-ro">HANDS <span id="du-n">0</span><span><span id="du-won">WON: CFR-7 0, MONTE 0</span><span class="wide" id="du-split">, SPLIT 0</span></span></div>

<div class="row du-ro">CHIP LEAD<canvas class="du-spark" id="du-spark" role="img" aria-label="Sparkline: CFR-7's net chips, last 100 hands"></canvas><span><span id="du-lead">EVEN</span><span class="wide" id="du-rate"></span></span></div>

<div class="row du-ro">RESULT:<span id="du-result">IN PLAY</span></div>

<p class="du-legend">= DEALER&nbsp;&nbsp;&gt; BOT OUTPUT&nbsp;&nbsp;&lt; FROM OPPONENT</p>

<p class="du-legend">BAR: TRUE EQUITY, BOTH HANDS KNOWN. LINE: CFR-7 NET CHIPS, LAST 100 HANDS. STACKS RESET TO 10,000 EVERY HAND.</p>

</section>

## Exhibit D: message trace

A sequence diagram: two bots and a dealer exchange one message per move on a
single wire, newest row at the bottom, scrolling as the hand plays.

<section class="exhibit-d" id="mt" aria-label="Exhibit D: message trace" markdown="1">

<div class="row"><span><span class="full">HEADS-UP: TWO BOTS AND A DEALER ON ONE WIRE</span><span class="short">TWO BOTS, ONE DEALER</span></span><span>SIMULATED PLAY</span></div>

<div class="row">TRACE<span>
<button class="t" id="mt-play" aria-label="Pause">[PAUSE]</button><button class="t" id="mt-next" aria-label="Next message">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false" aria-label="Speed 1x">1x</button><button class="t" data-speed="4" aria-pressed="false" aria-label="Speed 4x">4x</button><button class="t" data-speed="8" aria-pressed="true" aria-label="Speed 8x">8x</button><button class="t" data-speed="16" aria-pressed="false" aria-label="Speed 16x">16x</button>
</span></div>

<div class="row ro"><span id="mt-hand">HAND 000000<span class="full">, BLINDS 50/100</span></span><span id="mt-pot">POT 0, MSG 000000</span></div>

<figure class="mt-fig" id="mt-fig" role="img" aria-label="Sequence diagram of simulated heads-up poker: two bots and a dealer exchange one message per move, newest at the bottom">
<div class="mt-head" aria-hidden="true">
<i class="mt-life" style="--x:8%"></i><i class="mt-life" style="--x:50%"></i><i class="mt-life" style="--x:92%"></i>
<span class="mt-p" style="--x:8%">BOT A<span class="full"> CFR-7</span></span>
<span class="mt-p" style="--x:50%">DEALER</span>
<span class="mt-p" style="--x:92%">BOT B<span class="full"> NASH</span></span>
</div>
<div class="mt-win" aria-hidden="true">
<div class="mt-in">
<i class="mt-life" style="--x:8%"></i><i class="mt-life" style="--x:50%"></i><i class="mt-life" style="--x:92%"></i>
<div class="mt-rows" id="mt-rows"></div>
</div>
</div>
</figure>

<div class="row ro mt-bots"><span id="mt-a"><span class="full">BOT A CFR-7: 10,000 CHIPS, AVG REPLY 0 MS</span><span class="short">A 10,000, 0 MS AVG</span></span><span id="mt-b"><span class="full">BOT B NASH: 10,000 CHIPS, AVG REPLY 0 MS</span><span class="short">B 10,000, 0 MS AVG</span></span></div>

<div class="row key"><span><svg width="24" height="7" viewBox="0 0 24 7" aria-hidden="true"><path d="M0 3.5H18" stroke="currentColor"></path><path d="M17 0 24 3.5 17 7z" fill="currentColor"></path></svg>DEALER<span class="full"> SENDS</span></span><span><svg width="24" height="7" viewBox="0 0 24 7" aria-hidden="true"><path d="M0 3.5H23" stroke="currentColor" stroke-dasharray="3 2"></path><path d="M18 .5 23.5 3.5 18 6.5" fill="none" stroke="currentColor"></path></svg><span class="full">BOT REPLIES, WITH THINK TIME</span><span class="short">REPLY</span></span><span><svg width="9" height="12" viewBox="0 0 9 12" aria-hidden="true"><rect x="1.5" y=".5" width="6" height="11" fill="none" stroke="currentColor"></rect></svg><span class="full">BOT </span>THINKING</span></div>

</section>

## Castle Challenge diagram

Five castles, 100 soldiers to split between them. Each castle fills with
soldier dots from the bottom as you type, and every occupied castle's flag
goes up once the total hits exactly 100. (The source page uses this inside
its application form, asking for two different allocations — this is just
the diagram itself, on its own.)

<figure class="castle-fig" id="g1-castles" aria-hidden="true" style="height: 135px;">
<svg viewBox="0 0 776 135" width="776" height="135"></svg>
</figure>

Castle 1 (1 pt)
: <input id="g1c1" name="g1c1" type="number" class="qty" inputmode="numeric" min="0" max="100" step="1" placeholder="0">
{: .kv}

Castle 2 (2 pts)
: <input id="g1c2" name="g1c2" type="number" class="qty" inputmode="numeric" min="0" max="100" step="1" placeholder="0">
{: .kv}

Castle 3 (3 pts)
: <input id="g1c3" name="g1c3" type="number" class="qty" inputmode="numeric" min="0" max="100" step="1" placeholder="0">
{: .kv}

Castle 4 (4 pts)
: <input id="g1c4" name="g1c4" type="number" class="qty" inputmode="numeric" min="0" max="100" step="1" placeholder="0">
{: .kv}

Castle 5 (5 pts)
: <input id="g1c5" name="g1c5" type="number" class="qty" inputmode="numeric" min="0" max="100" step="1" placeholder="0">
{: .kv}

Total
: <span id="g1-total">0</span> / 100 soldiers
{: .kv}

<script>
// NOT part of the ported exhibit: in the source page this running total was
// kept by the application form's own (deliberately unported) script. This is
// new glue, just enough to make the demo legible on its own.
(() => {
  const inputs = [1, 2, 3, 4, 5].map(c => document.getElementById("g1c" + c));
  const total = document.getElementById("g1-total");
  if (!inputs.every(Boolean) || !total) return;
  const update = () => {
    const sum = inputs.reduce((a, el) => a + (parseInt(el.value, 10) || 0), 0);
    total.textContent = sum;
  };
  inputs.forEach(el => el.addEventListener("input", update));
  update();
})();
</script>

## Thank-you card cascade

Fires once on a `pbt:applied` event after a real application submits — a
full deck cascades off four piles, kings first, each card bouncing across
the page and leaving a trail. Click the overlay, press Esc, or use Close to
dismiss it.

<button type="button" class="apply" onclick="document.dispatchEvent(new Event('pbt:applied'))">Preview the cascade</button>

Loading this page with `#thanks` in the URL triggers it automatically too —
that's how the source page's own preview worked.

## Exhibit B: hand-tree analysis

A branching decision tree for one hand: the main line as played, with every
move NOT made drawn as a side branch showing what it would have netted. Laid
out by a custom collision-avoiding geometry engine, then drawn in with a
timed reveal.

The tree only runs horizontally once its plate has real width (≥940px) to
fan branches left to right — otherwise it falls back to a vertical layout.
The figure below is wrapped in `::: wide ::: ::: ` so it can break out of
this page's normal ~96ch text column and actually reach that width; see
plan.md for the structural bug this fixes and why.

<div class="exhibit-b" markdown="1">
<div class="row">8 BOTS, NO-LIMIT HOLD'EM, BLINDS 50/100<span>SIMULATED PLAY</span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row">MAIN LINE: THE HAND AS PLAYED.<span>SIDE BRANCHES: MOVES NOT MADE.</span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row"><span id="an-handinfo">HAND 000000, S0 DEALER</span><span id="an-stepinfo">STEP 00 OF 00</span></div>
</div>

<div class="exhibit-b" id="analysis" markdown="1">
<div class="row">REPLAY<span>
<button class="t" id="an-first" aria-label="Back to start of hand">[|&lt;]</button><button class="t" id="an-prev" aria-label="Previous move">[&lt;]</button><button class="t" id="an-play" aria-label="Pause">[PAUSE]</button><button class="t" id="an-next" aria-label="Next move">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false" aria-label="Speed 1x">1x</button><button class="t" data-speed="4" aria-pressed="false" aria-label="Speed 4x">4x</button><button class="t" data-speed="8" aria-pressed="true" aria-label="Speed 8x">8x</button><button class="t" data-speed="16" aria-pressed="false" aria-label="Speed 16x">16x</button>
</span></div>
</div>

::: wide

<div class="exhibit-b" markdown="1">
<figure class="tree-fig" id="an-fig">
<svg class="tree" id="an-tree" role="img" aria-label="Analysis tree"></svg>
</figure>
</div>

:::

<div class="exhibit-b" markdown="1">
<div class="row ro"><span class="k">NOW</span><span class="v" id="an-now">—</span><span class="r" id="an-pot">POT 0</span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row ro"><span class="k">ELSE</span><span class="v" id="an-else"></span><span class="r" id="an-played"></span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row ro"><span class="k">BOARD</span><span class="v" id="an-board">NONE YET</span><span class="r" id="an-street">PREFLOP</span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row ro"><span class="k">RESULT</span><span class="v" id="an-result">IN PLAY</span></div>
</div>

<div class="exhibit-b" markdown="1">
<div class="row keyline"><span class="ki"><svg width="10" height="16" viewBox="6 0 8 16" aria-hidden="true"><path d="M12.5 1V15M12.5 2l-5 5M12.5 6l-5 5M12.5 10l-5 5" fill="none" stroke="currentColor"></path></svg>DEAL</span><span class="ki"><svg width="8" height="16" viewBox="5 0 8 16" aria-hidden="true"><circle cx="9" cy="8" r="2.5" fill="currentColor"></circle></svg>AS PLAYED</span><span class="ki"><svg width="11" height="16" viewBox="3.5 0 11 16" aria-hidden="true"><circle cx="9" cy="8" r="4.5" fill="none" stroke="currentColor"></circle></svg>NEW CARDS</span><span class="ki"><svg width="7" height="16" viewBox="5.5 0 7 16" aria-hidden="true"><rect x="6.5" y="3" width="5" height="10" fill="currentColor" stroke="currentColor"></rect></svg>NET UP</span><span class="ki"><svg width="7" height="16" viewBox="5.5 0 7 16" aria-hidden="true"><rect x="6.5" y="3" width="5" height="10" fill="none" stroke="currentColor"></rect></svg>NET DOWN</span><span class="ki">SIDE LINES: MOVES NOT MADE</span></div>
</div>

<div class="exhibit-b" markdown="1">
<p class="legend">b BLIND&nbsp;&nbsp;X CHECK&nbsp;&nbsp;C CALL&nbsp;&nbsp;B BET&nbsp;&nbsp;R RAISE TO&nbsp;&nbsp;A ALL-IN&nbsp;&nbsp;F FOLD</p>
</div>

## Exhibit E: opening book

Every simulated hand merged into one tree: the busiest branch runs straight
on, less-played lines fan out, and branches thin out and vanish the further
a line strays from how most hands actually go. Unlike Exhibit B, this one
adapts its column count to whatever width it has rather than switching
layout mode, so it doesn't need the `::: wide :::` breakout — it stays in
the normal dark panel below, matching the source page.

::: screen

<section class="exhibit-e" id="book" aria-label="Exhibit E: opening book of 10,000 hands" markdown="1">

<div class="row">8 BOTS, NO-LIMIT HOLD'EM, EVERY HAND MERGED INTO ONE TREE<span>SIMULATED PLAY</span></div>

<div class="row pair">HANDS ANALYZED: <span class="num" id="bk-hands">0</span><span>HANDS/SEC: <span class="num r" id="bk-hps">0</span></span></div>

<div class="row pair">IN THE BOOK: <span class="num r" id="bk-held">0</span> OF 10,000 MAX<span>DISTINCT LINES: <span class="num r" id="bk-lines">0</span></span></div>

<div class="row">BOOK<span>
<button class="t" id="bk-first" aria-label="Reset the book to empty">[|&lt;]</button><button class="t" id="bk-prev" aria-label="Previous hand" aria-disabled="true">[&lt;]</button><button class="t" id="bk-play" aria-label="Pause">[PAUSE]</button><button class="t" id="bk-next" aria-label="Next hand">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-label="Speed 1x" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-label="Speed 4x" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-label="Speed 8x" aria-pressed="false">8x</button><button class="t" data-speed="16" aria-label="Speed 16x" aria-pressed="true">16x</button>
</span></div>

<figure class="tree-fig" id="bk-fig">
<svg id="bk-tree" role="img" aria-label="Opening book: a tree of betting lines merged from thousands of simulated hands."></svg>
</figure>

<div class="row pair"><span id="bk-figNote">READ LEFT TO RIGHT FROM THE WALL</span><span>FOLDS COUNTED, NOT DRAWN: <span class="num r" id="bk-folds">0</span></span></div>

<div class="row legend"><span><svg class="glyph" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.5" fill="currentColor"></circle></svg><span class="k">ACTION</span> <svg class="glyph" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" style="fill:var(--paper)" stroke="currentColor"></circle></svg><span class="k">CARDS</span> <svg class="glyph" viewBox="0 0 12 12" aria-hidden="true"><rect x="3.5" y="1" width="5" height="10" fill="currentColor" stroke="currentColor"></rect></svg><span class="k">SHOWDOWN</span> <svg class="glyph" viewBox="0 0 12 12" aria-hidden="true"><rect x="3.5" y="1" width="5" height="10" style="fill:var(--paper)" stroke="currentColor"></rect></svg><span class="k">FOLDED</span></span><span><span class="k">C</span> CALL <span class="k">X</span> CHECK <span class="k">B</span> BET <span class="k">R</span> RAISE <span class="k">A</span> ALL-IN</span></div>

<div class="subhead">Last hand, highlighted</div>

<div class="row pair"><span id="bk-lastNo">NO HANDS YET</span><span id="bk-lastRes"></span></div>

<div class="row mcards" id="bk-cards" aria-live="off"><span class="lbl">BOARD</span><span class="mrow" id="bk-board"><span class="mc slot"></span><span class="mc slot"></span><span class="mc slot"></span><span class="mc slot"></span><span class="mc slot"></span></span><span class="lbl">WINNER</span><span class="mrow" id="bk-win"><span class="mc slot"></span><span class="mc slot"></span></span></div>

<div class="row ro indent wrap-last"><span></span></div>

<div class="row ro indent wrap-last"><span></span></div>

<div class="row ro indent wrap-last"><span></span></div>

</section>

:::

---
layout: page
title: Extra exhibits
permalink: /extra-exhibit/
description: The live-tables pattern ported to other games — see plan.md's "Future exhibits roadmap".
extra_css:
  - /assets/css/exhibits.css
  - /assets/css/extra-exhibits.css
extra_js:
  - /assets/js/exhibits/mahjong.js
  - /assets/js/exhibits/bridge.js
  - /assets/js/exhibits/chess.js
  - /assets/js/exhibits/go.js
---

# Extra exhibits

[← Back to the main page]({{ "/" | relative_url }}){: .apply}

Exhibit A's live-tables pattern — a board, simulated play, replay controls —
ported to games beyond poker. See "Future exhibits roadmap" in `plan.md`:
Mahjong, Bridge, Chess, and Go are all built.

## Mahjong

Four players sit around a square table, each starting with a 13-tile hand
from a standard 136-tile set (characters, bamboo, circles, winds, dragons —
no flowers). Every turn the current player draws a tile from the wall (it
flashes), then discards one into the middle — each player's own discards
land toward their own side, like a real table. When the wall runs out, the
table reshuffles and a new round starts. No winning hands, calls, or
scoring — just the draw/discard loop.

<section class="extra-mahjong" id="mj" aria-label="Mahjong: four simulated players draw and discard around a square table" markdown="1">

<div class="row">4 PLAYERS, STANDARD 136-TILE SET, 13-TILE HANDS<span>SIMULATED PLAY</span></div>

<div class="row">ROUND <span id="mj-round">1</span><span>WALL <span id="mj-wall">70</span> LEFT</span></div>

<div class="row"><span id="mj-turn">NORTH</span>'S TURN<span>
<button class="t" id="mj-play" aria-label="Pause">[PAUSE]</button><button class="t" id="mj-next" aria-label="Next turn">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="mj-fig" id="mj-table" aria-label="Square table with a player on each side">
<div class="mj-side n" id="mj-side-n"><div class="mj-lbl">NORTH</div><div class="mj-hand" id="mj-h-n"></div></div>
<div class="mj-side e" id="mj-side-e"><div class="mj-lbl">EAST</div><div class="mj-hand" id="mj-h-e"></div></div>
<div class="mj-side s" id="mj-side-s"><div class="mj-lbl">SOUTH</div><div class="mj-hand" id="mj-h-s"></div></div>
<div class="mj-side w" id="mj-side-w"><div class="mj-lbl">WEST</div><div class="mj-hand" id="mj-h-w"></div></div>
<div class="mj-mid">
<div class="mj-dis n" id="mj-d-n"></div>
<div class="mj-dis e" id="mj-d-e"></div>
<div class="mj-dis s" id="mj-d-s"></div>
<div class="mj-dis w" id="mj-d-w"></div>
<div class="mj-info">DISCARDS</div>
</div>
</figure>

<p class="legend">Each side is one player's hand, sorted. The highlighted tile is the one just drawn; discards fan out toward the player who tossed them.</p>

</section>

## Bridge

Four players sit around a square table and play one board at a time: deal
13 cards each, an auction sets the contract (level, denomination, and
declarer), then 13 tricks are played out. The bidding and card-play are
simplified heuristics, not real bridge strategy — see `bridge.js` — and
every hand stays face-up the whole time rather than hiding declarer's hand
and the defenders' hands the way a real game would, so the whole board is
legible as a demo. When a board finishes, the table reshuffles into the
next one.

<section class="extra-bridge" id="br" aria-label="Bridge: four simulated players bid and play one board at a time" markdown="1">

<div class="row">4 PLAYERS, STANDARD 52-CARD DECK, ONE BOARD AT A TIME<span>SIMULATED PLAY</span></div>

<div class="row">BOARD <span id="br-board">1</span><span id="br-phase">DEALING</span></div>

<div class="row"><span id="br-contract">—</span><span>
<button class="t" id="br-play" aria-label="Pause">[PAUSE]</button><button class="t" id="br-next" aria-label="Next step">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="br-fig" id="br-table" aria-label="Square table with a player on each side">
<div class="br-side n" id="br-side-n"><div class="br-lbl">NORTH</div><div class="br-hand" id="br-h-n"></div></div>
<div class="br-side e" id="br-side-e"><div class="br-lbl">EAST</div><div class="br-hand" id="br-h-e"></div></div>
<div class="br-side s" id="br-side-s"><div class="br-lbl">SOUTH</div><div class="br-hand" id="br-h-s"></div></div>
<div class="br-side w" id="br-side-w"><div class="br-lbl">WEST</div><div class="br-hand" id="br-h-w"></div></div>
<div class="br-mid">
<div class="br-trick n" id="br-tc-n"></div>
<div class="br-trick e" id="br-tc-e"></div>
<div class="br-trick s" id="br-tc-s"></div>
<div class="br-trick w" id="br-tc-w"></div>
<div class="br-info" id="br-info">—</div>
</div>
</figure>

<div class="row">TRICKS<span><span id="br-tricks-ns">NS 0</span>&nbsp;&nbsp;<span id="br-tricks-ew">EW 0</span></span></div>

<p class="legend" id="br-log">—</p>

</section>

## Chess

Not a simulated game like the two above — this replays a real one, move by
move, from standard PGN movetext: **Fischer vs Spassky, Reykjavik 1972,
World Championship Game 6**, widely considered one of the greatest games
ever played. Fischer surprised Spassky by opening 1.c4 instead of his usual
1.e4; the game transposed into a Queen's Gambit Declined, and Fischer won in
41 moves. The engine (`chess.js`) parses any standard PGN movetext — swap in
a different game by replacing the `GAME_PGN` string at the top of that file.

<section class="extra-chess" id="ch" aria-label="Chess: a real historical game replayed move by move" markdown="1">

<div class="row">FISCHER VS SPASSKY, REYKJAVIK 1972, GAME 6<span>REAL GAME, NOT SIMULATED</span></div>

<div class="row">MOVE <span id="ch-move">0</span> / 41<span id="ch-turn">WHITE TO MOVE</span></div>

<div class="row">LAST: <span id="ch-last">—</span><span>
<button class="t" id="ch-play" aria-label="Pause">[PAUSE]</button><button class="t" id="ch-next" aria-label="Next move">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="true">4x</button><button class="t" data-speed="8" aria-pressed="false">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="ch-fig" id="ch-fig" aria-label="Chess board">
<div class="ch-board" id="ch-board"></div>
</figure>

<p class="legend" id="ch-result">—</p>

</section>

## Go

Also a real game, not simulated: **AlphaGo vs Lee Sedol, Google DeepMind
Challenge Match Game 2** (Seoul, March 10 2016) — the game containing
AlphaGo's famous "move 37", a shoulder hit no human professional would have
played, widely considered a landmark moment for AI. AlphaGo (black) won by
resignation after 211 moves. The engine (`go.js`) parses standard SGF move
text and plays a real (minimal) Go engine — stone groups, liberties,
captures — so it works with any 19×19 game; swap in a different one by
replacing the `GAME_SGF` string at the top of that file.

<section class="extra-go" id="go" aria-label="Go: a real historical game replayed move by move" markdown="1">

<div class="row">ALPHAGO VS LEE SEDOL, SEOUL 2016, GAME 2<span>REAL GAME, NOT SIMULATED</span></div>

<div class="row">MOVE <span id="go-move">0</span> / 211<span id="go-turn">BLACK TO MOVE</span></div>

<div class="row">LAST: <span id="go-last">—</span><span>
<button class="t" id="go-play" aria-label="Pause">[PAUSE]</button><button class="t" id="go-next" aria-label="Next move">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<div class="row">CAPTURES<span><span id="go-cap-b">BLACK 0</span>&nbsp;&nbsp;<span id="go-cap-w">WHITE 0</span></span></div>

<figure class="go-fig" id="go-fig" aria-label="19 by 19 Go board">
<div class="go-board" id="go-board"></div>
</figure>

<p class="legend" id="go-result">—</p>

</section>

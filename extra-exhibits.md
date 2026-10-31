---
layout: page
title: Extra exhibits
permalink: /extra-exhibits
description: The live-tables pattern ported to other games.
extra_css:
  - /assets/css/exhibits.css
  - /assets/css/extra-exhibits.css
extra_js:
  - /assets/js/exhibits/mahjong.js
  - /assets/js/exhibits/bridge.js
  - /assets/js/exhibits/chess.js
  - /assets/js/exhibits/go.js
  - /assets/js/exhibits/checkers.js
  - /assets/js/exhibits/gomoku.js
  - /assets/js/exhibits/blackjack.js
  - /assets/js/exhibits/morris.js
---

# Extra exhibits

[← Back to the main page]({{ "/" | relative_url }}){: .apply}
[See the wizard duel →]({{ "/wizard-duel-exhibit" | relative_url }}){: .apply}

Exhibit A's live-tables pattern — a board, simulated play, replay controls —
ported to games beyond poker: Mahjong, Bridge, Chess, Go, Checkers, Gomoku,
Blackjack, and Nine Men's Morris. The Wizard Duel exhibit is a separate
page, not part of this one.

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
<button class="t" id="mj-back" aria-label="Previous turn">[&lt;]</button><button class="t" id="mj-play" aria-label="Pause">[PAUSE]</button><button class="t" id="mj-next" aria-label="Next turn">[&gt;]</button>
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

## Checkers

Two simulated bots play standard English draughts on an 8×8 board, 12
pieces each, same board shape as the chess exhibit but with the
black/white disc convention from Go's stones. Captures are mandatory
whenever available, and a capturing piece must keep jumping as long as
another capture is immediately available (multi-jump chains); a man
promotes to a king on reaching the opponent's back row. A side with no
legal move loses, and the board resets into a new game. Bot play is a
simple random choice among forced captures (or legal moves when none are
forced) — not real strategy, see `checkers.js`.

<section class="extra-checkers" id="ck" aria-label="Checkers: two simulated bots play English draughts" markdown="1">

<div class="row">8×8 BOARD, 12 PIECES EACH, MANDATORY CAPTURES<span>SIMULATED PLAY</span></div>

<div class="row">TURN <span id="ck-turn">0</span><span id="ck-side">BLACK'S TURN</span></div>

<div class="row"><span id="ck-move">—</span><span>
<button class="t" id="ck-back" aria-label="Previous turn">[&lt;]</button><button class="t" id="ck-play" aria-label="Pause">[PAUSE]</button><button class="t" id="ck-next" aria-label="Next turn">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<div class="row">PIECES<span><span id="ck-count-b">BLACK 12</span>&nbsp;&nbsp;<span id="ck-count-w">WHITE 12</span></span></div>

<figure class="ck-fig" id="ck-fig" aria-label="8 by 8 checkers board">
<div class="ck-board" id="ck-board"></div>
</figure>

<p class="legend" id="ck-result">English draughts, mandatory captures, two bots.</p>

</section>

## Gomoku

Two simulated bots take turns placing a stone on a 15×15 lattice — same
board rendering as the Go exhibit (lines and stones on intersections, not
grid boxes), much simpler rules: whoever gets 5 in a row first (any
direction) wins, no captures or liberties involved. The bots aren't
playing randomly — each checks for an immediate win, then an immediate
block, before falling back to a random nearby cell — but it's still just
that one-step lookahead, not real strategy; see `gomoku.js`. A full board
with no winner is a draw. Either way, the board resets into a new game.

<section class="extra-gomoku" id="gm" aria-label="Gomoku: two simulated bots play Five in a Row" markdown="1">

<div class="row">15×15 BOARD, FIVE IN A ROW TO WIN<span>SIMULATED PLAY</span></div>

<div class="row">MOVE <span id="gm-move">0</span><span id="gm-side">BLACK TO MOVE</span></div>

<div class="row"><span></span><span>
<button class="t" id="gm-back" aria-label="Previous move">[&lt;]</button><button class="t" id="gm-play" aria-label="Pause">[PAUSE]</button><button class="t" id="gm-next" aria-label="Next move">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="gm-fig" id="gm-fig" aria-label="15 by 15 Gomoku board">
<div class="gm-board" id="gm-board"></div>
</figure>

<p class="legend" id="gm-result">Gomoku (Five in a Row), simple block/win lookahead, two bots.</p>

</section>

## Blackjack

Two bot players and a dealer play one round at a time from a standard
52-card deck, reshuffled fresh every round — the simplest card game here,
reusing the same `.cd` card look as the poker exhibits and Bridge. Real
rules: aces count 11 unless that busts the hand; a two-card 21
(blackjack) beats a dealer 21 reached with more cards, and blackjack vs.
blackjack is a push; the dealer stands on any 17 or higher. Bots hit below
17 and stand at 17+ — a single fixed threshold, not real strategy. Every
hand, including the dealer's, stays face-up the whole round rather than
hiding a hole card, the same legibility trade-off Bridge already makes.

<section class="extra-blackjack" id="bj" aria-label="Blackjack: two bot players and a dealer play one round at a time" markdown="1">

<div class="row">2 BOT PLAYERS, STANDARD 52-CARD DECK, ONE ROUND AT A TIME<span>SIMULATED PLAY</span></div>

<div class="row">ROUND <span id="bj-round">0</span><span id="bj-status">—</span></div>

<div class="row"><span></span><span>
<button class="t" id="bj-back" aria-label="Previous step">[&lt;]</button><button class="t" id="bj-play" aria-label="Pause">[PAUSE]</button><button class="t" id="bj-next" aria-label="Next step">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="bj-fig" aria-label="Two bot players and a dealer">
<div class="bj-seat"><div class="bj-lbl">BOT A</div><div class="bj-hand" id="bj-hand-a"></div><div class="bj-total" id="bj-total-a">BOT A 0</div></div>
<div class="bj-seat"><div class="bj-lbl">BOT B</div><div class="bj-hand" id="bj-hand-b"></div><div class="bj-total" id="bj-total-b">BOT B 0</div></div>
<div class="bj-seat dealer"><div class="bj-lbl">DEALER</div><div class="bj-hand" id="bj-hand-d"></div><div class="bj-total" id="bj-total-d">DEALER 0</div></div>
</figure>

<p class="legend" id="bj-result">Standard rules, bots hit below 17 and stand at 17+ — not real strategy.</p>

</section>

## Nine Men's Morris

Two simulated bots play a full game on the traditional board: three nested
squares, 24 points total, each side's 4 corners and 4 edge-midpoints
joined around the ring, and the midpoints also joined straight through to
the matching midpoint of the next ring in (corners never get that radial
line) — 32 edges, 16 possible "mills" (3 points in an unbroken line).
Real rules, both phases: placement — each side places all 9 pieces one at
a time, alternating, and completing a mill removes one of the opponent's
pieces (never one of their own mills unless every piece they have is in
one); movement — once all 18 pieces are down, each turn slides one piece
to an adjacent empty point, with the same mill-and-remove rule, and a side
down to exactly 3 pieces may "fly" to any empty point rather than only an
adjacent one. A side wins by reducing the opponent below 3 pieces, or by
leaving them with no legal move. Bots use the same one-step win-now /
block-now / random lookahead as every other exhibit's "AI" — see
`morris.js`.

<section class="extra-morris" id="mr" aria-label="Nine Men's Morris: two simulated bots play a full game" markdown="1">

<div class="row">24-POINT BOARD, 9 PIECES EACH, PLACE THEN MOVE<span>SIMULATED PLAY</span></div>

<div class="row">TURN <span id="mr-turn">0</span><span id="mr-side">PLACEMENT — BLACK TO MOVE</span></div>

<div class="row"><span></span><span>
<button class="t" id="mr-back" aria-label="Previous turn">[&lt;]</button><button class="t" id="mr-play" aria-label="Pause">[PAUSE]</button><button class="t" id="mr-next" aria-label="Next turn">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<figure class="mr-fig" id="mr-fig" aria-label="Nine Men's Morris board, three nested squares">
<div class="mr-board" id="mr-board"></div>
</figure>

<p class="legend" id="mr-result">Nine Men's Morris, simple win/block lookahead, two bots. 9 black, 9 white in reserve.</p>

</section>

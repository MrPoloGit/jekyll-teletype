---
layout: page
title: Wizard Duel
permalink: /wizard-duel-exhibit
description: Two simulated wizards duel with randomly-cast spells, based on the real mechanics of Chaos (1985).
extra_css:
  - /assets/css/exhibits.css
  - /assets/css/wizard-exhibit.css
extra_js:
  - /assets/js/exhibits/wizard.js
---

# Wizard Duel

[← Back to the main page]({{ "/" | relative_url }}){: .apply}

Two simulated wizards duel on a 15×10 board, built from real mechanics
researched out of the public disassembly of *Chaos: The Battle of
Wizards* (1985, Julian Gollop). Each turn the active wizard casts **one
randomly-chosen spell** from a 10-spell starter subset and rolls against
its real cast-success chance; then that wizard's living creatures each
move toward the nearest enemy creature, or attack if already adjacent,
using the real combat formula — attacker stat + d10 vs. defender stat +
d10, ties favor the defender, a straight kill or a miss, no hit points.
After a fixed number of turns the side with more creatures left wins, and
the board resets into a new duel.

This is a bot-vs-bot "phase 1," not the spell/build picker — spells are
random, not chosen by anyone. A few other
deliberate simplifications, flagged honestly: only 10 of the real game's
60 spells and 5 of its 33 creatures are modeled here; wizards are
stationary and can never be attacked or killed (no "ENGAGE?" mechanic), so
a duel only ends by turn limit, not elimination; attack spells target the
nearest enemy creature in range directly rather than simulating a beam's
full line-of-sight; and the black/white sides are this theme's own
convention — the original game didn't color-code wizards by player at
all.

<section class="wizard-duel" id="wiz" aria-label="Wizard duel: two simulated wizards cast random spells and fight" markdown="1">

<div class="row">TWO WIZARDS, 15×10 BOARD, RANDOM SPELLS<span>SIMULATED PLAY</span></div>

<div class="row">TURN <span id="wiz-turn">0</span><span id="wiz-side">BLACK'S TURN</span></div>

<div class="row"><span id="wiz-spell">—</span><span>
<button class="t" id="wiz-back" aria-label="Previous turn">[&lt;]</button><button class="t" id="wiz-play" aria-label="Pause">[PAUSE]</button><button class="t" id="wiz-next" aria-label="Next turn">[&gt;]</button>
SPEED
<button class="t" data-speed="1" aria-pressed="false">1x</button><button class="t" data-speed="4" aria-pressed="false">4x</button><button class="t" data-speed="8" aria-pressed="true">8x</button><button class="t" data-speed="16" aria-pressed="false">16x</button>
</span></div>

<div class="row">CREATURES<span><span id="wiz-count-b">BLACK 0</span>&nbsp;&nbsp;<span id="wiz-count-w">WHITE 0</span></span></div>

<figure class="wiz-fig" id="wiz-fig" aria-label="15 by 10 wizard duel board">
<div class="wiz-board" id="wiz-board"></div>
</figure>

<p class="legend">Pieces are the actual 16×16 pixel sprites from the real game's disassembly (Merlin for the wizard, one frame of each creature's walk cycle) — not hand-drawn icons. Skeleton is undead: only attack spells can kill it here, not ordinary creature melee. Black fills solid, white is outlined.</p>

<p class="legend" id="wiz-result">Chaos (1985) mechanics, randomly-cast spells, two bots.</p>

</section>

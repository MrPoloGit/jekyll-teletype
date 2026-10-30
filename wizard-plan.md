# Wizard duel exhibit — research + plan

Expands the brief note in `plan.md` (search "wizard duel" / "Chaos: The
Battle of Wizards") into a real plan, sourced from the *Chaos* (1985,
ZX Spectrum, by Julian Gollop) disassembly documentation at
archaos.co.uk. That note stays as-is in `plan.md` as the short pointer;
this file is the detailed version it points to. Nothing here has been
implemented — no `wizard-duel-exhibit.md`, no JS/CSS — this is research
and scope only.

## What the real game actually does, per source page

**Board and placement** (`WizardPlacements.html`)
- Board is **15 columns × 10 rows** (coordinates given as (row, col),
  rows 0–9, cols 0–14).
- 7 built-in starting layouts, one per supported player count, 2–8
  players. For 2 players specifically: wizards start at **(4,1)** and
  **(4,13)** — roughly centered vertically, near the left/right edges.
  Layouts are read from a fixed position table, not computed; no general
  symmetry rule is stated, though most layouts mirror left-right around
  column 7.

**Movement** (`move-combat.html`)
- Movement phase loops over all *live* wizards (a status bit marks dead
  ones); each wizard moves all its own pieces, then play passes on.
  Human wizards move via a cursor the player drives square by square;
  computer wizards use a fixed AI routine to pick a target square.
- A piece's movement stat is stored, then doubled into a per-turn points
  pool; each step spends points, and stepping further than remaining
  points prints "TOO FAR." A flying wizard's movement is fixed at 13; a
  mounted wizard's is fixed at 6 ("one square per mount step"), regardless
  of the rider's own stat.
- No line-of-sight or facing rules are documented on this page at all.

**Combat resolution** (`move-combat.html`)
- A single opposed roll, no hit points: **attacker total = attack stat
  (melee or ranged, whichever applies) + an equipment bonus + random
  0–9**; **defender total = defence stat + an equipment bonus + random
  0–9**. If defender's total ≥ attacker's total, the attack **misses**
  (ties favor the defender). Otherwise the target is killed outright.
  Manoeuvre and magic-resistance stats are *not* part of this roll (they
  must matter for something else not covered on this page — likely spell
  targeting/resistance, not melee/ranged combat).
- Undead targets can't be hurt by a non-anti-undead attacker at all (the
  attack is simply refused) — anti-undead comes from specific items
  (magic sword/knife/bow) or another explicit flag.
- Attacking an enemy wizard prompts "ENGAGE? Y/N" rather than resolving
  immediately.

**Spells** (`Spells.html`)
- **60 spells total** (the page's own header claims 65; the actual table
  has 60), each with a cast-success chance, a range (stored doubled;
  "Range: Self," "Range: Adjacent," or a number — the biggest is
  **Vengeance/Decree/Dark Power/Justice at range 15**), and an alignment
  tag (Law/Neutral/Chaos, with `^`/`*` intensity markers). No effect
  text or mana/cost figures are on this page — costs seem to not exist
  as a separate resource in this design; casting is gated by the success
  chance alone (e.g. a wizard "chooses" to cast and rolls against the
  listed %, not a prepared/paid cost).
- Categories: **Summon Creature** (33 entries, one per creature below, all
  range "Adjacent"), **Summon Structure/Wall** (Magic Wood, Shadow Wood,
  Magic/Dark Castle, Wall), **Attack** (Magic Bolt, Lightning, the four
  alignment-attack spells, Subversion, Turmoil), **Buff** (Magic
  Shield/Armour/Sword/Knife/Bow, Magic Wings, Shadow Form — all
  self-range), **Alignment shift** (Law-1/2, Chaos-1/2 — all self-range),
  and **Utility** (Raise Dead, Disbelieve — Disbelieve is 100% and has
  infinite range, clearly the "remove an illusory/summoned thing"
  spell).

**Creatures** (`CreatureStats.html`)
- **40 rows** (33 summonable creatures + a handful of structure/fire/blob
  entries that double as "creature" stat rows). Columns: Combat, Defence,
  Manoeuvre, Magic Resistance, Movement, ranged-attack flag + range +
  ranged-combat stat, Undead flag, Flying flag, Mountable flag, cast %
  (duplicates the Spells.html cast chance per creature).
- Notable extremes: Golden Dragon (9 combat / 9 defence, 10% cast, Law)
  and Giant (9/7, Law) are the strongest melee pieces; Zombie/Goblin/Orc
  are cheap, high-cast-chance, low-stat chaff; Elf/Manticore/Dragons have
  ranged attacks; Vampire/Ghost/Spectre/Wraith/Skeleton/Zombie are undead.
  Structure/Fire/Blob rows are all-zero combat stats (they're
  board-state objects, not fighters).

**Beams** (`Beams.html`)
- Six beam *types* (Arrow, Ghost [unused], Cast, Dragon, Magic Bolt,
  Lightning) all drawn with a Bresenham line, differing only in visual
  trail (continuous vs. a dotted 13-cell stamp). The page is purely about
  rendering — it doesn't say what a beam does when it crosses a creature
  or hits the map edge, so beam *gameplay* logic (does it stop at the
  first obstacle? hit everything along the line?) is **not sourced** and
  shouldn't be invented without flagging it as a guess.

**Sprites** (`CreatureSprites.html`, `WizardSprites.html`)
- Both creature and wizard sprites are tiny: 2×2 blocks of 8×8 UDGs (so
  16×16px), mostly 3-frame ping-pong or 4-frame looping animations; a
  few (Spectre, the structure pieces) animate by cycling ink color
  instead of swapping frames. Wizards are **not** color-coded by player
  in the source — each of the 8 named wizards (Merlin, Gandalf, etc.)
  has its own unique sprite, not a shared sprite tinted per player. This
  matters for our plan: the "one side black, one side white" idea is
  **our own convention** (matching the rest of this theme), not something
  the original game did — worth being upfront about in the exhibit's own
  text, the way Mahjong/Bridge/Chess/Go each flag their own simplifications.
- `EffectsUI.html` only documents cursor/animation graphics (a casting
  twirl, an explosion, a melee flash, a "disappear" effect, dragon
  breath), not menu/UI flow for picking a spell or seeing success/fail
  feedback — that part of the real UI isn't sourced at all.

## Mapping onto this theme's established exhibit pattern

- New page `wizard-duel-exhibit.md` at `/wizard-duel-exhibit`, its own
  `assets/js/exhibits/wizard.js`, its own `.extra-wizard` CSS scope in
  `extra-exhibits.css` — same per-exhibit isolation as every other one
  (own engine, no shared code, `extra_css`/`extra_js` front matter only
  on this page).
- Board: 15×10 is a very different shape from the square boards used so
  far (8×8 chess, 19×19 Go, the mahjong/bridge "sides of a square table"
  layout) — needs its own CSS grid, not a reuse of an existing one. At a
  reasonable cell size (~28–32px) that's roughly 420–480px × 280–320px,
  landscape rather than square — fits this theme's `~96ch`/`wide_max_px`
  column conventions fine, probably doesn't need a `::: wide :::`
  breakout the way Exhibit B's tree did.
- Pieces as hand-built SVG icons, continuing the established rule (no
  raw Unicode glyph blocks — there's no well-covered "fantasy creature"
  Unicode block anyway, so this was never really a choice). Realistically
  this means: simple geometric/silhouette icons per creature *category*
  rather than 33 bespoke unique creature drawings up front (see scope
  below) — matches how Mahjong's suits are systematic pip-layouts/numerals
  rather than 34 hand-authored unique images.
- Two-side color convention (black ink / white paper, matching every
  other exhibit) is **this project's own simplification**, not sourced
  from the original game (which didn't color-code wizards at all, per
  `WizardSprites.html`) — should be stated plainly in the exhibit's own
  intro text, the same way Bridge's intro says every hand stays face-up
  unlike a real game, or Mahjong's says it's missing calls/scoring.
- Combat resolution (opposed roll, ties favor defender, no hit points,
  straight kill/miss) is simple enough to port faithfully almost as-is —
  genuinely one of the more direct wins here, unlike mahjong's win-check
  or bridge's bidding which both needed real simplification.

## The real scope difference: interactivity

Every exhibit built so far is **pure replay or pure simulation** — Chess
and Go replay a fixed real game move-by-move; Mahjong and Bridge run a
simulated bot-vs-bot loop with explicit "not real strategy" heuristics.
The user's ask for wizard duels is different: **players pick spells and
assemble a build**, and bots then play *using whatever build they're
given* — that's real interactivity (a selection UI, state that isn't just
"replay the next scripted event"), not another drop-in replay viewer.

### Recommended scope for a first pass

Go simulation-first, matching every other exhibit's actual build order,
rather than starting with the harder interactive piece:

1. **Phase 1 — bot vs. bot, fixed builds, no picker UI.** Two wizards,
   each with a small *hardcoded* spell loadout (not the full 60), play a
   duel automatically with Play/Pause/Back/Next/speed controls — the
   exact same shape as Mahjong/Bridge. This proves the board, piece
   rendering, movement, and combat-resolution engine work before any UI
   for picking spells exists at all.
2. **Phase 2 — spell/build selection UI.** Only after phase 1 works: let
   the viewer actually choose a loadout from a worked subset of the
   spell list and have the bot play that build. This is the part that
   breaks the "simulated client-side page, no backend" pattern the least
   (a build is just client-side state), so it probably still doesn't need
   a real backend — but see open questions below.

### A starter spell/creature subset, not all 60/40

Proposing roughly **12–15 spells** and the creatures they summon for a
first pass, picked for mechanical variety without needing all 60:

- **Summons** (a cheap chaff creature, a mid-tier generalist, a flyer, a
  rare powerhouse, an undead for the anti-undead rule to matter): Goblin
  (90%, Com 2/Def 4), Lion (60%, Com 6/Def 4), Eagle (70%, flying),
  Giant (40%, Com 9/Def 7 — rare and strong), Skeleton (70%, undead).
- **Attack**: Magic Bolt (100%, range 6.5, ranged) and Lightning (100%,
  range 4.5) — both unconditional, good contrast in range.
- **Buff**: Magic Shield (70%) and Magic Sword (40%) — raise the
  defender/attacker bonus the combat roll already uses, so these plug
  directly into the ported combat formula with no new mechanic needed.
- **Utility**: Disbelieve (100%, infinite range) — removes a summoned
  piece, needed for the "undo an opponent's threat" dynamic that makes a
  duel feel like more than two creature piles colliding.
- **Alignment**: Law-1 / Chaos-1 only (not the "-2" escalations) if
  alignment ends up mattering for anything in the ported ruleset; skip
  entirely if it doesn't turn out to gate anything else we port.

This is a judgment call, not sourced — the real spell list has no
official "starter tier," this is just picking for range of mechanics
(melee chaff, flyer, rare powerhouse, undead, two attack spells at
different ranges, two buffs that hook the existing combat formula, one
remove-effect utility spell) while staying small enough to hand-build
~10–15 SVG icons instead of 40.

### What "simulated bot play" means here

Same honesty convention as Mahjong's discard heuristic and Bridge's
bidding/play logic: a simple, explicitly-not-real-strategy decision
loop — e.g. "summon if you have fewer live pieces than the opponent,
else move toward the nearest enemy piece and attack if adjacent, else
cast an offensive spell on the nearest target" — documented in the code
exactly as un-strategic as it is, not dressed up as AI.

## Open questions (carried forward from `plan.md`, plus new ones from research)

Carried forward, still unresolved:
- How many spells in total, long-term, if this grows past the phase-1
  subset above?
- What does a "build" actually constrain — fixed-size loadout, or a
  points/budget system? (The source game has no "cost" at all, just a
  per-spell cast-success %, so there's no existing budget concept to
  port — if we want one, it's invented, not sourced.)
- Real head-to-head (two live viewers picking builds and playing) vs.
  spectating two bots each given a different build — phase 2 above
  assumes the latter (viewer picks builds, bots play them), not live PvP.
- Does this still fit "simulated client-side, no backend" (decision
  #2/#6 in `plan.md`), or does build-sharing / anything persistent need
  one? Phase 2 as scoped above (ephemeral per-visit build choice, no
  save/share) still fits client-side-only.

New, from this research:
- **Beam gameplay logic is unsourced.** `Beams.html` only covers
  rendering (Bresenham line, visual trail style) — whether a beam stops
  at the first creature it crosses, hits everyone along the line, or
  something else isn't documented anywhere in the 8 pages fetched. If
  Magic Bolt/Lightning are in the phase-1 subset, this needs either a
  deliberate, flagged simplification (e.g. "hits the first piece in the
  line, stop") or more disassembly reading before implementing it.
- **No damage/HP system exists in the source** — combat is a single
  opposed roll ending in an outright kill or a miss, not a health bar.
  Matches this project's general "simple rule set" preference already
  (no hit points to simulate), but worth stating explicitly since it's a
  bigger departure from typical "wizard battle" assumptions than it
  might look.
- **Undead/anti-undead interaction** is a real rule worth porting (it's
  one of the few places a creature *category* changes combat outcome
  rather than just raw stats) — decide whether phase 1's starter subset
  needs to include it (Skeleton above was picked partly for this reason)
  or whether it's deferred to a later phase.
- **The "ENGAGE?" wizard-vs-wizard prompt** — the source treats attacking
  an enemy wizard directly as a special confirmable action, not an
  ordinary combat roll. Decide whether a wizard-vs-wizard kill (ending
  the duel) is in scope for phase 1 at all, or whether phase 1 just ends
  on a fixed turn/kill-count limit instead, with direct wizard combat
  saved for later.
- **Wizard placement** — 2-player layout is sourced exactly ((4,1) and
  (4,13) on the 15×10 board), so phase 1 doesn't need to invent this.

## Phase 1 — built

User said to skip phase 2 (the spell/build picker) entirely for now and go
straight to phase 1: random-spell bot vs. bot. Built as proposed above,
with the open questions resolved the way this file already leaned:

- Wizards stationary, never attacked/killed — a duel ends purely by a
  fixed turn cap (60 turns, not sourced — the real game has no such cap
  since wizard death normally ends it), not elimination. Resolves the
  "ENGAGE?" open question by deferring it entirely.
- Attack spells (Magic Bolt, Lightning) target the nearest enemy creature
  within range directly — no beam line-of-sight/obstruction simulated,
  per the "Beams.html only documents rendering" finding above. A straight
  SVG line is still drawn for the cast, cosmetic only.
- Undead (Skeleton) immunity: can't be killed by ordinary creature melee
  (no anti-undead weapon items are modeled in this subset) but CAN be
  killed by either wizard's attack spells, since those are magic rather
  than a physical weapon — a deliberate reading of the undead rule's
  spirit without modeling items.
- Eagle's combat/defence numbers (4 combat / 3 defence, as shipped) are an
  acknowledged placeholder, not sourced — the research pass didn't carry
  exact figures for it from `CreatureStats.html`.
- Final 10-spell roster shipped: Goblin, Lion, Eagle, Giant, Skeleton
  (summons), Magic Bolt, Lightning (attacks), Magic Shield, Magic Sword
  (buffs), Disbelieve (utility) — matches the proposed starter subset
  above exactly.

**Files**: `wizard-duel-exhibit.md` (`/wizard-duel-exhibit`),
`assets/js/exhibits/wizard.js`, `assets/css/wizard-exhibit.css`. Board
drawn as SVG (checkerboard cells + piece shapes at cell centers), same
reasoning as `go.js` — precise placement beats CSS grid boxes for this
kind of diagram. Pieces are simple systematic shapes (a 5-point star for
the wizard, triangle/circle/diamond/square/X for the five creatures), not
bespoke art, matching mahjong's "systematic, not hand-authored per piece"
precedent. Deliberately **not** gated on scroll visibility
(`IntersectionObserver`) or `document.hidden` the way most other exhibits
are — `go.js` had a reported stall bug traced to exactly that mechanism,
so this one skips it from the start rather than risk the same failure
mode; Play/Pause is the only thing that stops it.

Event/history model matches mahjong.js's (the most recently hardened
version of this pattern in the codebase): every turn produces a full
snapshot of all alive pieces, `show()`/`render()` always paints purely
from that snapshot, and a capped `history` array + index lets "Back"
re-display an earlier turn and "Play-after-Back" replay recorded history
before generating anything new, rather than mahjong's first version, which
only stored deltas and had no way to step backward at all.

**Verified**: the pure simulation logic was stress-tested standalone
(outside the DOM-dependent part) for 20,000+ turns across 333 full games —
zero exceptions, zero out-of-bounds piece positions, zero instances of two
alive pieces sharing a cell. Then the actual `wizard.js` file was run
end-to-end against a stubbed DOM in Node: confirmed all 150 checkerboard
cells get built, drove hundreds of turns across many game resets with no
exceptions, and verified back/forward history consistency (stepped forward
15 turns, back 8, confirmed the back sequence exactly reverses the
corresponding forward slice, then forward 8 more and confirmed it replays
those exact same events rather than generating new random ones — same
check used to validate mahjong's history mechanism). `node --check` passes,
`jekyll build` succeeds, every `#wiz-*` id the script touches is confirmed
present in the built HTML, and nav links from `index.md`/`extra-exhibits.md`
resolve correctly under the site's `baseurl`. **Not** verified visually in
an actual browser — ask the user to confirm the board/piece rendering,
spell-cast pacing, and beam-line visual actually look right at
`http://127.0.0.1:4001/wizard-duel-exhibit`.

## Phase 1, round 2 — real sprites, not hand-drawn shapes

User asked to swap the simple geometric shapes (star/triangle/circle/etc.)
for the actual sprites documented on `CreatureSprites.html`/
`WizardSprites.html`, in black and white. Those index pages only list
sprite memory addresses, not raw bytes — had to fetch each creature's own
disassembly sub-page (`asm/edb3.html` for Goblin, `asm/f033.html` Lion,
`asm/f994.html` Eagle, `asm/fb94.html` Giant, `asm/f734.html` Skeleton, and
`asm/fdd4.html` for Merlin's wizard sprite — one of 8 named wizards; this
project only needs one wizard look per side, not all 8) to get the actual
`DEFB` byte tables.

Format, confirmed by decoding and looking at the result (see below) rather
than taken purely on faith: each sprite is **2×2 UDGs** (ZX Spectrum
user-defined graphics), 8 bytes per UDG, one byte per pixel row, MSB =
leftmost pixel — standard ZX Spectrum format. Each creature has 3 walk-cycle
frames (ping-pong order 0,1,2,1); only **frame 0** is used here, since
animating a multi-frame walk cycle doesn't fit this exhibit's
move-once-per-turn model. Two things the source pages explicitly say they
don't confirm, and this project had to infer: which of the 4 UDG addresses
maps to which screen quadrant (assumed top-left/top-right/bottom-left/
bottom-right, address order), and that assumption's correctness was
checked empirically — decoded all 6 sprites' bytes to a 16×16 bit grid and
printed it as ASCII art before writing any rendering code, and every one
came out as a clearly recognizable figure (a robed wizard with a staff, a
goblin with legs, a maned lion, a winged eagle, a large giant, a skeleton
with a visible ribcage pattern) rather than visual noise, which is good
evidence the quadrant-order and bit-order assumptions are both right.

Rendering: each sprite's lit pixels are run-length encoded per row into
horizontal `<rect>`s (far fewer SVG elements than one rect per pixel — a
~40-60-pixel sprite needs only ~10-16 rects) and scaled to fill .85 of a
board cell. Kept the existing solid-ink-vs-outlined-paper black/white
convention (same as Go's stones) rather than introducing a new one — black
pieces are solid-filled runs, white pieces are paper-filled runs with a
thin ink outline, so a run is visible against either checkerboard tone.

Verified: rendered pieces after several turns and confirmed well-formed
`<rect>` markup with zero `NaN`/`undefined` and coordinates landing where
expected (clustered near the wizard's known start cell early in a game);
ran 2000 turns through the real "Next" handler checking for malformed
markup on every single one, found none. `node --check` passes, `jekyll
build` succeeds. **Not** verified visually — the sprite byte decoding was
sanity-checked via ASCII art in a standalone script, but how the actual
rendered SVG pixels look in a real browser at the exhibit's small piece
size is still unconfirmed; ask the user to check legibility at
`http://127.0.0.1:4001/wizard-duel-exhibit`.

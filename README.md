# jekyll-teletype

A Jekyll theme for the "printed transcript" look: monospace type, every row numbered
in a left gutter like a line printer, and a two-tone ink/paper color scheme that
flips to dark wherever you mark a section with `::: screen`.

## Inspired by

[No Limit: A Bot Building Tournament](https://pokerbot.sequoiacap.com/) — the
landing page Sequoia, Citadel Securities and OpenAI built for their pokerbot
tournament. That page reads like a printed government memo ("DEPARTMENT OF
ALGORITHMIC PLAY"): one running line count down the left margin, plain
monospace type, ASCII `====` dividers, and sections that invert from white-on-
black to black-on-white where the page switches into a "live exhibit."

This theme extracts that reusable design system — the typography, the line
numbering, the two-color scheme and where it inverts — so you can write
ordinary markdown and get the same look, without rebuilding the page by hand.

The theme itself deliberately does **not** try to generate the source page's
bespoke, campaign-specific interactive exhibits (a simulated live poker
table, a hand-tree analysis view, a heads-up duel, a message trace, an
animated dot-matrix US map, an opening-book tree, a Castle Challenge
diagram, a thank-you card cascade) from markdown — that's ~4,000 lines of
one-off JS/SVG, not a reusable markdown feature. They have, however, all
been **ported** as plain HTML/CSS/JS and live on `exhibits.md` (`/exhibits`)
as a demonstration — see "Exhibits" below and `plan.md`'s full roadmap. If
you want something like that on your own page, that's the pattern: write it
as plain HTML/JS, scope its CSS/JS to just that page via `extra_css`/
`extra_js` (see "Per-page CSS/JS"), and the theme leaves it alone.

## What it can do

- **Numbered gutter** — every top-level block on the page (paragraph, heading,
  list item, kv row, divider) gets a running line number, like the source
  page's line-printer margin. Toggle it on/off, and set its width and offset,
  site-wide in `_config.yml`.
- **Two-tone color scheme** — one `ink` (text) / `paper` (background) pair for
  the page, plus secondary tones (`gutter`, `faint`, `muted`) and a few named
  accents (`amber`, `green`, `warn`, `red`). All configurable, all just colors
  in `_config.yml` — no CSS editing required to retheme the page.
- **Inverting "screen" panels** — wrap any part of a markdown file in
  `::: screen` / `:::` and that section's colors flip to a second, separately
  configured palette (dark-on-light by default). This is how you control
  exactly where the page switches tone, same as the source page's alternating
  light/dark panels.
- **Breaking out of the text column** — wrap a part of a markdown file in
  `::: wide` / `:::` and that section ignores the normal ~96ch column,
  running up to `theme_config.wide_max_px` (default 1440) instead, centered.
  For content that genuinely needs real horizontal room, like a wide
  diagram — not a general "make this bigger" tool. That content gets no
  gutter number of its own (there's no `.sheet` to number it against).
- **Section headers** — `##` renders centered and uppercase, like the source
  page's section titles (`SCHEDULE`, `EXHIBIT A`, etc).
- **Full-width dividers** — a markdown `---` renders as a literal run of `=`
  clipped to the column width, same technique the source page uses.
- **Buttons** — `[text](url){: .apply}` renders a bordered monospace chip;
  `{: .cta}` renders the inverted, primary version (ink-filled).
- **Key/value rows** — an ordinary markdown definition list
  (`Term` / `: Definition`) renders as a two-column row. By default the value
  right-aligns (good for schedules, dates, stats); add `{: .kv}` after the
  list for a left-aligned, fixed-width label column instead (field-style
  rows).
- **`{: .notice}`** on any block renders it in capitals, like the source
  page's system text (vs. sentence-case body copy).
- **Focus ring** — every focusable element (inputs, textareas, selects,
  buttons, links) gets a square, 2px, ink-colored `outline` on
  `:focus-visible` — never the browser's default rounded ring.
- **Radio/checkbox groups** — real `<input type="radio">`/`<input
  type="checkbox">`, drawn as `( )` text that becomes `(X)` when checked, with
  a black underline on hover. See "Radio and checkbox groups" below.
- **`.banner`** — a solid accent-color band around just a line's text (e.g. a
  section heading), centered. See "Banners" below.
- **Custom favicon** — drop an icon file (SVG/PNG/ICO/JPG) anywhere under the
  site (e.g. `assets/favicon.svg`) and point `theme_config.favicon` at it in
  `_config.yml`; the right `<link rel="icon" type="...">` is emitted for you.
  Leave it `""` for no icon.
- **Backend wiring** — a small client-side layer (`assets/js/api.js`,
  `bind.js`, `forms.js`) for talking to a real API: a fetch helper, declarative
  live-data binding (`data-source`/`data-field`), and form POSTing
  (`data-api`). See "Connecting to a backend" below.

## What it can't do (on purpose)

- The theme itself has no markdown syntax for generating interactive
  exhibits, canvases, or SVG simulations — see "Exhibits" below for what's
  actually been built (as page content, not theme features).
- No per-page overrides of color/gutter settings — the look is one consistent
  site-wide config, matching how the source page is styled throughout.
- Line numbers count one per **block element**, not one per **visual wrapped
  line** the way the source page's JS does. A long paragraph that wraps to
  three lines on screen still gets a single number. This keeps the theme pure
  CSS (no JS numbering pass) at the cost of that one bit of fidelity.

## Quickstart

Needs Ruby + Bundler, on a Ruby new enough for Jekyll 4.4.1's `liquid ~> 4.0`
dependency to resolve — the macOS system Ruby (2.6.x) is too old; use
rbenv/asdf or similar if `bundle install` fails.

```bash
bundle install
bundle exec jekyll serve
```

`_config.yml` sets `baseurl: /jekyll-teletype` (for GitHub Pages project-site
hosting), so the dev server serves from that path, not `/` — open
`http://127.0.0.1:4000/jekyll-teletype/`. Edit `index.md`, `exhibits.md`, or
`_config.yml` and the site rebuilds automatically.

## Configuring the look

Everything is under `theme_config` in `_config.yml`:

```yaml
theme_config:
  favicon: ""   # path to an icon file (svg/png/ico/jpg), or "" for none

  mono_font: "'Source Code Pro', ui-monospace, Menlo, monospace"
  line_height: 1.8
  max_width_ch: 96
  wide_max_px: 1440   # cap for a ::: wide ::: block

  gutter:
    show: true     # turn the numbered column on/off, site-wide
    width: 3.2      # ch — width reserved for the number itself
    offset: 5       # ch — how far left of the text column the number sits

  colors:            # the light ("paper") palette — used outside ::: screen :::
    ink: "#111111"
    paper: "#ffffff"
    gutter: "#8a8a8a"
    faint: "#c9c9c9"
    muted: "#595959"
    amber: "#b06300"
    green: "#0cab2c"
    warn: "#ffc400"
    red: "#d0141e"

  screen_colors:     # the dark palette used inside ::: screen ... ::: blocks
    ink: "#f2f2f2"
    paper: "#0a0a0a"
    gutter: "#747474"
    faint: "#3d3d3d"
    muted: "#a6a6a6"

  api:
    base_url: ""   # see "Connecting to a backend" below
```

`assets/css/main.css` has YAML front matter, so Jekyll runs these values
through Liquid when it builds the CSS — edit the config, not the CSS file.

## Writing a page

```markdown
---
layout: page
title: My Page
---

# Hero Title

A short line of context.
{: .notice}

## Schedule

Applications open
: Tuesday, October 27

Finals: San Francisco
: Sunday, November 15

---

[Apply now →](#){: .cta}

::: screen

## A Dark Panel

Anything here — text, buttons, kv rows — automatically uses the
`screen_colors` palette instead of `colors`.

:::

[Read the rules](#){: .apply}
```

## Radio and checkbox groups

Both input types render the same way — `( )`, turning into `(X)` when
checked — which is a deliberate simplification of the source page (which drew
checkboxes as `[ ]`/`[X]` and radios as `( )`/`(X)`). Write them as plain HTML
inside markdown (same `markdown="1"` idiom used elsewhere):

```markdown
How you heard
: <span class="opts">
    <label class="opt"><input type="radio" name="heard" value="club"><span class="box"></span>University club</label>
    <label class="opt"><input type="radio" name="heard" value="other"><span class="box"></span>Other</label>
  </span>
{: .kv}

Agree to terms
: <label class="opt"><input type="checkbox" name="agree" required><span class="box"></span>I agree</label>
{: .kv}
```

The real `<input>` stays in the DOM — only visually hidden — so it's still
keyboard-navigable, gets the standard focus ring, and submits through
`forms.js`/`FormData` exactly like any other field: an unchecked checkbox is
simply absent from the submitted JSON, several checkboxes sharing one `name`
submit as an array, nothing backend-specific to account for.

## Banners

Wrap text in `<span class="banner green">` (or `.amber`) to put a solid
accent-color band around just that text, e.g. inside a centered `##` heading:

```markdown
## <span class="banner green">Optional: the castle challenge</span>
```

It has to be an inline span *inside* a normal, full-width row — not a block
class on the heading itself (e.g. `{: .banner}` on the `##` line). Styling the
whole heading block would shrink it to the band's width and center it, which
also drags that row's gutter number along with it, off the actual gutter.

## Per-page CSS/JS

Declare `extra_css`/`extra_js` (arrays of asset paths) in a page's front
matter to load additional stylesheets/scripts on just that page — nothing
else changes site-wide:

```yaml
---
layout: page
extra_css:
  - /assets/css/exhibits.css
extra_js:
  - /assets/js/exhibits/map.js
---
```

This is how `exhibits.md` loads its ported animations/diagrams (see below)
without bloating every other page.

## Exhibits

`exhibits.md` (`/exhibits`) hosts animations/diagrams ported from the source
page — see `plan.md`'s "Exhibits porting roadmap" for the full list and
status. These are page-specific, not theme features: each lives in
`assets/css/exhibits.css` / `assets/js/exhibits/<name>.js`, loaded only on
that page via the mechanism above. All eight ported: the venue map (a
dot-matrix US outline with pulsing venue dots, regenerated on resize),
Exhibit A (a small self-contained poker engine driving a canvas grid of
10,000 simulated tables plus one fully interactive featured table with
replay controls), Exhibit C (two bots playing heads-up, printing their
reasoning into a terminal on each side as a packet animates across the wire
between them, with a live chip-lead sparkline), Exhibit D (a scrolling
sequence diagram of a dealer and two bots exchanging messages on one wire,
each bot reply carrying a simulated think-time), the Castle Challenge
diagram (dot-matrix castles that fill with soldier dots as you type, flags
raised once exactly 100 are placed), the thank-you card cascade (a
full-deck animation that plays on a `pbt:applied` event — try the demo
button on the exhibits page), Exhibit B (a branching decision tree for
one simulated hand, laid out by a from-scratch collision-avoiding geometry
engine, with every move not taken drawn as a side branch), and Exhibit E
(every simulated hand merged into one opening-book tree, the busiest line
running straight through and thinner branches fanning out and pruning as
a sliding window of the last 10,000 hands streams in).

**All eight items on the roadmap are now ported.** See `plan.md`'s "Exhibits
porting roadmap" for the full build notes on each.

## Connecting to a backend

This is still a static site — Jekyll has no server at request time — so
"connected to a backend" means plain client-side JS calling your API from the
visitor's browser. Three small vanilla-JS files, loaded on every page via
`_includes/head.html`, give you that without writing fetch boilerplate per
page:

**1. Set where requests go**, once, in `_config.yml`:

```yaml
theme_config:
  api:
    base_url: ""   # "" = same origin, or "https://api.example.com"
```

If the backend lives on a different origin, it needs to send CORS headers —
there's no proxy to hide that from the browser.

**2. Live data display** — mark any element with `data-source` (the API path)
and optionally `data-field` (a dot-path into the JSON response) and
`data-format` (currently just `number`, for `toLocaleString()` comma
grouping). `assets/js/bind.js` fetches it on page load and writes the result
in with `textContent` (never `innerHTML`, so an API response can't inject
markup):

```markdown
Hands played
: <span data-source="/api/stats" data-field="hands_played" data-format="number">—</span>
{: .kv}
```

Add `data-poll="5000"` (milliseconds) to refetch on an interval — useful for
something like the source page's live hand counter. Elements that share a
`data-source` are fetched together as one request.

**3. Form submission** — any `<form data-api="/api/path">` is intercepted by
`assets/js/forms.js`: its fields are serialized to JSON and POSTed instead of
navigating the browser. Toggle a `[data-success]` / `[data-error]` element
inside the form to show the result:

```markdown
<form data-api="/api/apply" markdown="1">

Email
: <input type="email" name="email" required>
{: .kv}

<button type="submit">Submit</button>
<p data-success hidden>Thanks — you're in.</p>
<p data-error hidden></p>

</form>
```

(The `markdown="1"` attribute is the same kramdown idiom `screen_blocks.rb`
uses — it tells kramdown to still run markdown over the form's contents.)

**4. General-purpose calls from your own JS** — `Theme.api.get(path)` /
`.post(path, body)` / `.put(path, body)` / `.del(path)` are available
globally once `api.js` has loaded, for anything `bind.js`/`forms.js` don't
cover.

**A tested example backend** lives at `../jekyll-teletype-backend` (Flask +
SQLite): `GET /api/stats` and `POST /api/apply` back the live hand counter
and apply form on `index.md` (not `exhibits.md` — that page's exhibits are
all self-contained, no backend calls). Run it alongside `jekyll serve` and
`theme_config.api.base_url` pointed at it to see the wiring work end to end.

## How it's built

- `_plugins/screen_blocks.rb` — a pre-render hook that splits a page's
  markdown on `::: screen ... :::` and `::: wide ... :::`, wrapping each
  resulting chunk in its own `<div class="sheet" markdown="1">` (plain
  chunks), `<div class="screen"><div class="sheet" markdown="1">` (screen
  chunks), or `<div class="wide" markdown="1">` (wide chunks — no nested
  `.sheet`, since escaping its width is the point), mirroring the source
  page's actual DOM: `.screen`/`.wide` are siblings of `.sheet`, never nested
  inside one.
- `assets/css/main.css` — the theme's whole visual system, generated from
  `theme_config` via Liquid.
- `assets/css/exhibits.css` / `assets/js/exhibits/*.js` — the ported
  exhibits' own styling/behavior; deliberately *not* part of the theme (see
  "Exhibits").
- `_layouts/default.html` / `_layouts/page.html` / `_includes/head.html` —
  the page shell.
- `assets/js/api.js` / `bind.js` / `forms.js` — the backend-wiring layer
  described above.

See `plan.md` for the full design-system catalog and the decisions made while
scoping this theme.

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

It deliberately does **not** try to reproduce the source page's bespoke,
campaign-specific interactive exhibits (a simulated live poker table, a
hand-tree analysis view, a heads-up duel, a message trace, an animated dot-matrix
US map). Those were ~4,000 lines of one-off JS/SVG built for that one page. If
you want something like that, write it as plain HTML/JS and drop it straight
into a markdown file — the theme will leave it alone.

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
- **Backend wiring** — a small client-side layer (`assets/js/api.js`,
  `bind.js`, `forms.js`) for talking to a real API: a fetch helper, declarative
  live-data binding (`data-source`/`data-field`), and form POSTing
  (`data-api`). See "Connecting to a backend" below.

## What it can't do (on purpose)

- No interactive exhibits, canvases, or SVG simulations — see above.
- No per-page overrides of color/gutter settings — the look is one consistent
  site-wide config, matching how the source page is styled throughout.
- Line numbers count one per **block element**, not one per **visual wrapped
  line** the way the source page's JS does. A long paragraph that wraps to
  three lines on screen still gets a single number. This keeps the theme pure
  CSS (no JS numbering pass) at the cost of that one bit of fidelity.

## Quickstart

Requires Ruby and Bundler.

```bash
bundle install
bundle exec jekyll serve
```

Then open `http://127.0.0.1:4000/`. Edit `index.md` or `_config.yml` and the
site rebuilds automatically.

## Configuring the look

Everything is under `theme_config` in `_config.yml`:

```yaml
theme_config:
  mono_font: "'Source Code Pro', ui-monospace, Menlo, monospace"
  line_height: 1.8
  max_width_ch: 96

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

## How it's built

- `_plugins/screen_blocks.rb` — a pre-render hook that splits a page's markdown
  on `::: screen ... :::`, wrapping each resulting chunk in its own
  `<div class="sheet" markdown="1">` (plain chunks) or
  `<div class="screen"><div class="sheet" markdown="1">` (screen chunks),
  mirroring the source page's actual DOM: `.screen` is a sibling of `.sheet`,
  never nested inside one.
- `assets/css/main.css` — the whole visual system, generated from
  `theme_config` via Liquid.
- `_layouts/default.html` / `_layouts/page.html` / `_includes/head.html` —
  the page shell.
- `assets/js/api.js` / `bind.js` / `forms.js` — the backend-wiring layer
  described above.

See `plan.md` for the full design-system catalog and the decisions made while
scoping this theme.

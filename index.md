---
layout: page
title: Demo
description: Example page for the printed-transcript Jekyll theme.
---

# No Limit: a bot building tournament

Teams of 1 or 2 get 60 minutes to build a pokerbot from scratch.
{: .notice}

[See the ported exhibits →]({{ "/exhibits/" | relative_url }}){: .apply}
[See the extra exhibits →]({{ "/extra-exhibit/" | relative_url }}){: .apply}

## Schedule

Applications open
: Tuesday, October 27

Regional: Bay Area
: Friday, November 6

Regional: Boston
: Monday, November 9

Finals: San Francisco
: Sunday, November 15

---

[Apply to compete →](#){: .cta}

::: screen

## Exhibit A: live tables

10,000 games, 8 bots each, no-limit hold'em
{: .notice}

Hands played
: <span data-source="/api/stats" data-field="hands_played" data-format="number" data-poll="4000">—</span>
{: .kv}

This whole block sits on the dark panel — every custom property (`--ink`,
`--paper`, `--gutter`, `--faint`, `--muted`) flips here, so anything you put
inside it — text, buttons, kv rows — automatically reads correctly. The
"Hands played" row above is live: it's fetched from
[jekyll-teletype-backend](../jekyll-teletype-backend) and refetched every 4s —
run that backend alongside `jekyll serve` to see it move.

:::

## Event details

How you heard
: <span class="opts">
    <label class="opt"><input type="radio" name="heard" value="club"><span class="box"></span>University club</label>
    <label class="opt"><input type="radio" name="heard" value="mailing-list"><span class="box"></span>Mailing list</label>
    <label class="opt"><input type="radio" name="heard" value="social"><span class="box"></span>Social media</label>
    <label class="opt"><input type="radio" name="heard" value="friend"><span class="box"></span>Friend</label>
    <label class="opt"><input type="radio" name="heard" value="other"><span class="box"></span>Other</label>
  </span>
{: .kv}

## Apply

<form data-api="/api/apply" markdown="1">

Email
: <input type="email" name="email" required placeholder="you@example.com">
{: .kv}

Agree to terms
: <label class="opt"><input type="checkbox" name="agree" required><span class="box"></span>I agree to the rules</label>
{: .kv}

<button type="submit">Submit</button>
<p data-success hidden>Thanks — application received.</p>
<p data-error hidden></p>

</form>

Posts to the same backend's `/api/apply`, which writes to SQLite and returns
a validation error if the email looks wrong — try submitting an empty form.
The radio group and checkbox above are real `<input>`s drawn as `( )`/`(X)`
text; they submit through `forms.js` exactly like any other field.

## <span class="banner green">Optional: the castle challenge</span>

An entirely optional event — place soldiers across five castles.

## FAQ

Who can apply?
: University students and '25/'26 grads.
{: .kv}

What do I need to bring?
: Nothing — a laptop is provided.
{: .kv}

[Read the rules](#){: .apply}

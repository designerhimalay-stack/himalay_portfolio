# "What changes" — pinned fly-apart headline

Cloned from `https://kora.framer.media/?utm_source=launchnow`, the section Framer
names **"Inside Container" → "Text / Comparison Cards"**
(`section.framer-17nt9ag` > `div.framer-1wmipoq`).

Every number below came out of `getComputedStyle` / `getBoundingClientRect` on the
live page. Nothing here is estimated.

## Overview

- **Target files:** `site/src/components/Changes.astro`, `site/src/scripts/changes.js`
- **Screenshots:** `docs/design-references/kora/rest-p0.png` (rest), `rest-p05.png` (act two)
- **Interaction model:** scroll-driven, scrubbed. Not click, not IntersectionObserver,
  not a one-shot reveal — the transform is a pure function of scroll offset, so it
  runs backwards on the way up with no state to unwind.

## The mechanism

A tall section containing a `position:sticky; top:0` frame one viewport high. While
the frame is pinned, the headline — split into two halves — flies apart in 3D and
fades out.

The halves are two separate blocks, not split text. Framer's own markup:

```html
<div class="framer-1pwqs1k" style="opacity:0;
     transform: perspective(1200px) translateX(-2000px) scale(1.5) rotateY(-60deg)">
  <h2>What changes <span style="color:rgb(97,97,97)">when</span> </h2>
</div>
<div class="framer-fsssoq" style="opacity:0;
     transform: perspective(1200px) translateX(2000px) scale(1.5) rotateY(60deg)">
  <h2 style="color:rgb(97,97,97)"> you work with us.</h2>
</div>
```

The transform *source order* is readable straight off the element, so the matrix
never had to be reversed — `perspective → translateX → scale → rotateY`.

**It is a departure, not an arrival.** At rest the headline is centred, opaque and
readable; scrolling pushes it away from the camera and off both edges.

## The crossover — how the section enters (THE defining move)

The section does not follow section two down the page. It **rides up over it**.

Framer's topology for the wrapper (`section.framer-tn7gs8`, 5970px):

| child | docY | h | position | z |
|---|---|---|---|---|
| Hero | 0 | 900 | `sticky; top:0` | auto |
| Problem Intro | 900 | 900 | `sticky; top:0` | 1 |
| Scroll Space | 1800 | 900 | `relative` | auto |
| **Comparison** (this section) | 2700 | 3270 | `relative` | **1** |

The sections that get covered are `position:sticky; top:0` — they park at the
viewport top and **hold perfectly still** while this section, opaque and on a
higher z-index, climbs from the viewport's bottom edge to its top. The empty
900px "Scroll Space" is the overlap budget: **exactly one viewport of climb.**

There is no JS in this. It is sticky + opaque + z-index and nothing else.

**Why the stillness is load-bearing:** two elements scrolling at the same rate
show no cover at all — just a static edge. The covered section must be pinned or
the move does not read. This is the part that is invisible in a screenshot and
the easiest thing in the whole section to miss.

### How it is reproduced here

`.tpath-stage` was already `sticky; top:0` inside `.tpath`, but only for as long
as the sentence needed. Two changes, which must agree with each other:

- `text-on-path.js` — `HOLD = 1`. The box is set to `(scrub + 100)vh` so the
  stage stays parked one viewport longer than the reveal, and `progress()`
  subtracts the hold back out of `span` so the sentence's timing is unchanged
  (measured: reveal span still 1800px at vh 900, exactly as before).
- `global.css` — `.chg { margin-top: -100vh }` at ≥1200px only.

Pull further than the hold and the sheet starts climbing over a section that has
already begun scrolling away, and the cover stops reading.

Verified by walking the cover window in 10 steps: `.tpath-stage`'s viewport top
held at **0 at every step** while `.chg`'s top went 900 → 0 linearly.

## Geometry — all viewport-relative (verified, not assumed)

Measured at viewport heights 700 / 900 / 1200 px. Section height, pin height and
animation distance all scaled exactly 1:1 with `vh` at every one:

| | value |
|---|---|
| section height | **350vh** (2450 / 3150 / 4200 px measured) |
| pin | `position:sticky; top:0; height:100vh` |
| animation distance | **exactly 100vh** from the moment the pin engages |
| remaining 250vh | act two — the comparison cards (out of scope, see below) |
| content width | `vw − 120px` at ≥1200, `vw − 80` at 810–1199, `vw − 40` below |
| headline block | vertically centred in the pin |

## The curve — linear, measured at 24 scroll positions

`p = clamp((scrollY − sectionTop) / vh, 0, 1)`

| p | translateX | scale | rotateY | opacity |
|---|---|---|---|---|
| 0.000 | 0 | 1.000 | 0° | 1.000 |
| 0.127 | ∓253px | 1.063 | ∓7.6° | 0.873 |
| 0.313 | ∓627px | 1.157 | ∓18.8° | 0.687 |
| 0.501 | ∓1002px | 1.251 | ∓30.1° | 0.499 |
| 0.689 | ∓1378px | 1.344 | ∓41.3° | 0.311 |
| 0.877 | ∓1753px | 1.438 | ∓52.6° | 0.123 |
| 1.000 | ∓2000px | 1.500 | ∓60.0° | 0.000 |

Every column is **linear in p** — regression on translateX gave a ratio constant to
within 0.7% across the whole run, and `opacity === 1 − p` to three decimals. There
is **no easing curve on the scrub.** The smoothness the eye reads comes entirely
from Lenis interpolating the scroll position, not from an ease on the property.
Adding an ease here would be wrong and visibly wrong.

So, per half:

```
transform: perspective(1200px) translateX(±2000px · p) scale(1 + 0.5·p) rotateY(±60deg · p)
opacity:   1 − p
```

Left half takes the negative signs, right half the positive. `perspective` is first
in the chain, which is what makes the rotation read as depth rather than a squash.

## Typography

Same tracking (−0.04em) and line-height (1.05) at every breakpoint:

| viewport | font-size | line-height | letter-spacing |
|---|---|---|---|
| ≥1200 | 80px | 84px | −3.2px (−0.04em) |
| 810–1199 | 60px | 63px | −2.4px (−0.04em) |
| <810 | 35px | 36.75px | −1.4px (−0.04em) |

- weight 400, `text-align:center`
- **"What changes"** — `rgb(36,36,36)` `#242424`
- **"when you work with us."** — `rgb(97,97,97)` `#616161`
- section background — `rgb(252,252,250)` `#FCFCFA`
- original face is *Manrope Variable*; see "Deviations".

## Responsive behaviour

The pin is **abandoned below 1200px** — this is a real behaviour, not a fallback:

| viewport | pin | section height |
|---|---|---|
| ≥1200 | `sticky` | 350vh |
| 810–1199 | `relative` | 1496px (no scroll animation at all) |
| <810 | `relative` | 975px (no scroll animation at all) |

Under 1200px the headline is simply static, centred and fully opaque.

## Text content (verbatim)

> What changes when you work with us.

Split as `"What changes when"` / `" you work with us."` — note the break falls
*after* "when", and "when" is already in the grey colour on the first line.

## Deviations from the original, and why

1. **Face: Instrument Sans, not Manrope.** Standing instruction on this project is
   one family everywhere — the loader's face — so `--f-ui` wins over the
   reference's choice. All *metrics* are cloned (−0.04em, 1.05, weight 400).
   One-line revert if wanted.
2. **Act two (comparison cards) not built.** It occupies the remaining 250vh of the
   same pin. Scope was "just this section" pointing at the headline.
3. **Copy left as the reference's.** Placeholder — it is kora's agency line, not
   Himalay's.

## What the section became

Act one is the cloned headline. Act two is the payload:

- **copy** — "Built alongside *teams you already know.*" The claim clears the
  stage in act one and the logos pay it off in act two. "alongside" is chosen
  over "for" or "trusted by": Himalay met these teams through an organisation,
  not as their client, and the stronger words would overclaim it.
- **brand stickers** (`Brands.astro`) — the four die-cut PNGs, centred, sized by
  **optical area with a weight correction**, not by width. See that file.
- **tag pile** (`Tags.astro`) — split three to the top edge and three to the
  bottom, framing the logos instead of competing with them.

Stacking: brands under tags, so a dragged tag passes over a sticker rather than
disappearing behind it.

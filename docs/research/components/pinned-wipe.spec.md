# Pinned four-card wipe — measured from blink.trade

Source: `https://www.blink.trade/`, the `[ Why blink? ]` block. Everything below was
read off the live site (computed styles, sampled transforms, sampled pixels), not
estimated. Build: `site/src/components/Why.astro`, `src/scripts/why.js`,
`src/scripts/why-viz.js`, `.why*` in `src/styles/global.css`.

## The mechanic

Four panels, three steps, one clamped value. Over the pinned range let `s` be how
many viewport-heights have been scrolled, clamped to `[0, panels - 2]`:

```
s    = clamp(-sectionTop / vh, 0, panels - 2)
rail   translateX = -s * 50%
panel i translateY = (clamp(s - i, 0, 1) + clamp(i - 1 - s, 0, 1)) * 100%
```

The two clamps are a panel's whole life — the first is its exit (it drops away over
the step at its own index), the second its entry (it rises into place one step
earlier). No per-panel state, no step counter, no direction flag, so scrubbing
backwards at speed is seamless.

**It is linear.** Sampled at eleven scroll positions their values sit on the line to
five decimals. All the softness is Lenis smoothing the scroll position; easing here
would double up.

Verified against the reference at five positions — exact match:

| s   | translateX | panel translateY            |
|-----|-----------|------------------------------|
| 0   | 0%        | 0 / 0 / 100 / 100            |
| 0.5 | −25%      | 50 / 0 / 50 / 100            |
| 1   | −50%      | 100 / 0 / 0 / 100            |
| 1.5 | −75%      | 100 / 50 / 0 / 50            |
| 2   | −100%     | 100 / 100 / 0 / 0            |

Track height is `steps × 100svh` and the horizontal travel finishes exactly as the
pin releases — the apparent "hold" in the last third is just the pin ending there.

Panels are `width: calc(50% + 1px)` at `left: i * 50%`, z-index descending, so the
panel dropping away passes in front of the one rising behind it. Even panels put the
heading on top, odd panels flip it.

## Type and layout (1440 viewport)

Their fluid scale interpolates against `100vw` **including the scrollbar** — matching
that is what makes 117.03px come out at 117.03px:

```
fluid = (100vw - 375px) / 1225
title  clamp(18, 18 + 4·fluid, 22)     lh 1.2   ls  1%   mono, uppercase
figure clamp(64, 64 + 61·fluid, 125)   lh 1     ls −2%   mono
unit   clamp(36, 36 + 28·fluid, 64)    lh 1     ls −2%   mono, ink 40%, pb .15em
body   clamp(15, 15 + 1·fluid, 16)     lh 1.3            sans, ink 65%
label  clamp(13, 13 + 1·fluid, 14)     lh 1     ls  1%   mono, ink 65%
```

Header `py-96`, centred. Copy column `max-width 450`, `padding 64`, `gap 64`,
`justify-content: space-between`. Card `outline: 1px solid #b2ada7` at
`outline-offset: -1px` plus a matching bottom border. Artwork bay `aspect-ratio 1/2`,
`inset-block: 0; right: 0`.

Below `lg` everything unpins into a plain stack: card 429px, copy `max-width 220`,
`padding 32px 0 32px 32px`, title 18.18px, figure 66.74px, bay 215px wide.

## Reveal

GSAP-style split into words (headings), chars (figures), laid-out lines (body).
Every fragment holds at `translateY(8px)` / `opacity 0` then **snaps** — `duration: 0`,
100ms apart. Confirmed by sampling computed style each frame: the last word sits at
opacity 0 until t=500ms and is at 1 by the next frame. It reads as a bug and is the
effect: the copy assembles like a terminal filling in.

Base delays within a card: title 0, body 200, figure 0, unit 100. Section eyebrow 400.
Cards reveal independently as each enters view.

## Artwork

Theirs are two Rive documents (`@rive-app/canvas` 2.39.1, `.riv` files off the Sanity
CDN) — their artwork, not ours, so all four are rebuilt in 2D canvas from measurements
off their rendered frames. Bay is 347 wide at the measured size; `u = w/347`.

- **fiber** — five rules at pitch 58, last 7 in from the right edge (the open inner
  third is what gives the bundle an edge). A hairline bar rises bottom to top over
  ~3.3s with a 1.1s pause, orange dots on rules 2 and 4, heat curtain 140 long
  decaying as `exp(-d/70)` — stops `[0,1] [.15,.76] [.3,.6] [.45,.47] [.6,.33] [.75,.22] [1,0]`.
- **radar** — pivot `(w, h/2)`, R 256 (fitted through the sweep dot across eight
  frames: centre 350.8/344.4, r 249.8). The trail **accumulates** rather than lagging:
  a sliver a second in, a full disc several seconds later, then it clears. Fill is a
  radial ramp .42 at the pivot to .77 at the rim, measured along three rays.
  Their two dotted arcs are *not* concentric — inner is the disc edge, outer is centred
  at 2.06w with radius 1.78w — but both are omitted here: on a white sheet the dots
  read as specks rather than draughting.
- **book** — five contiguous bands, each a fifth of the height, each with its own
  price edge; heat bleeds left, cool fills from the edge to a shared boundary at .97w
  or 70 wide, whichever is less.
- **curve** — a cubic, not a power curve (fitting one gives a different exponent at
  every pair of traced points). Control points `(.45,1.12) (.72,.90) (.93,.66) (1.04,.02)`,
  both ends outside the bay.

Accents are quoted as the colour their pixels land on at alpha 1: `#cc7245` hot,
`#929e69` cool.

## Deviations from the reference, and why

| Theirs | Ours | Why |
|---|---|---|
| Aeonik Mono Pro / Neue Haas Grotesk | Geist Mono / Inter | licensed faces, not ours to ship |
| `#edeceb` paper, opaque grey grain plate at 20% | frosted white, no grain | asked for; see "the surface" below for why it is frosted and not opaque |
| two dotted arcs on the radar | none | asked for |
| ∞ as an SVG from their CDN | ∞ drawn as a path | the glyph is content, the file is theirs |
| grain over the whole page | — | removed with the grain |
| section arrives with a hard edge | staircase climb, off `stepped.js` | matches section two |

Copy is blink's, verbatim, so the clone can be diffed frame-for-frame against the
original. It lives in one `PANELS` array at the top of `Why.astro`.

---

# The handoff, the traverse, and the frost

Added after the clone landed. Turns the ~3 viewports of dead scroll between the hero
and the pinned wipe into the page's set piece.

## The measured scroll map (vh = 900)

| y | state |
|---|---|
| 0 – 765 | hero. `parallax.js` glides the hash to centre, zoom 1 → 0.70, spin 0 → −0.62 |
| 765 – 2700 | hash holds. Section two reads, `.tpath` scrubs its sentence |
| **2700 – 3600** | `.tpath-stage` pinned. `.why` rides up over it. Staircase climbs 2700 → 3465 |
| **3600 – 5400** | `.why-pin` pinned. Panel wipe `s` = 0 → 2 |
| 5400 – 6300 | `.why` releases |

**The overlap was already there.** `.glass`'s bottom and `.why`'s top are the same
screen line at every position — sampled at y = 2600/2900/3200/3465/3600 they are
1000/1000, 700/700, 400/400, 135/135, 0/0. No negative margins were needed and the
page height did not change.

## The interlock — `stepped.js`

One `tops[]` array, two sides of it. `.why-paper` keeps what is *below* its step
edge; `.glass` and `.tpath-stage` are given a stepped **bottom** on that same line,
so section two ends exactly where section three begins. Verified: when the two
staircases meet (y = 3465) the per-column seam is **0.00px** (−0.01 to +0.01).

`.tpath-stage` is created by `text-on-path.js`, which loads *after* `stepped.js` — it
must be resolved lazily or section two's sentence outlives its own glass.

**The one load-bearing guard:** `cutAt()` clamps each bottom to ≥ its own top. An
inverted polygon self-intersects and renders as torn garbage, not as nothing.
Verified 0 inversions across 71 scroll positions × 2 panes × 7 columns.

## The hash — `hash-journey.js`, `hash-gl.js`

Two acts off numbers that already existed: `A = 1 − whyTop/vh` (the handoff, the
same window the staircase climbs) and `s = −whyTop/vh` clamped to [0,2] (the exact
expression `why.js` drives the rail with). They hand off at `whyTop = 0`, so they
can never both be mid-flight.

| | zoom | spin | roll | --hx |
|---|---|---|---|---|
| rest (parallax.js) | 0.70 | −0.62 | 0 | 0 |
| left, end of Act I | 1.40 | −0.10 | −0.22 | −0.22vw |
| right, end of Act II | 0.55 | +0.85 | +0.08 | +0.26vw |

Act I eases out (it settles), Act II eases in-out (a long travel). Act III holds by
construction, since `s` clamps at 2.

New: a `ROLL` uniform with `rotZ`, applied **innermost** (`rotZ*rotX*rotY`) so it
turns the object in the image plane. Outermost would rotate the yaw axis with it and
tumble the hash out of frame. Yaw alone is a turntable; the roll is what makes it a
camera move.

**Yaw safety:** the arc ends at spin +0.85, i.e. yaw ≈ +1.19 rad / 68°. Edge-on is
±1.571, where a 20 mm plate smears — the failure `parallax.js`'s TURN comment
records. Do not raise `SPIN_R` past +1.05 without re-checking against a live cursor
at `M.x = 1`.

`parallax.js` gained a one-line guard. Its `P` clamps at 1, so past the hero it kept
re-asserting the rest pose on the same frames the journey was writing a different
one — which of the two landed last came down to import order in `Base.astro`.
`window.__hashJourney` is the contract.

The canvas box grew to `min(72vw,900px)` × `132vh` at `top:-16vh`, because at zoom
1.40 the hash renders ≈ 630 × 770 and the old box sheared its refraction off. The
offset keeps the box's centre at 50vh, so parallax.js's "centred is offset 0" anchor
is untouched. `HashGL.quality()` drops dpr to 1.0 while it is actually moving and
restores 1.75 when it settles; motion hides the softer edge, a held pose does not.

## The surface: frosted white, not black

A dim to black glass was built here and measured out. At the midpoint of the
crossfade the paper read srgb .645 and the title .654 — the type was briefly
invisible. A paper and an ink that cross each other always have a contrast minimum;
offsetting the curves only shortens the bad window. **Do not rebuild it.**

But a fully opaque white fails worse: the hash spends the whole section travelling
behind it and none of the choreography is visible. `rgba(255,255,255,.94)` with
`blur(20px)` is where both hold — the hash reads through as light rather than as an
object, and because both ends of the surface stay light the contrast problem cannot
arise. `--why-veil` is the single number to turn.

Traced through the frost, the hash's centre moves 300 → 520 → 600 → 900 → 1140 px
across the traverse, with its blue bias falling 11.2 → 5.7 as it recedes.

Where nothing pins — below `lg`, and under reduced motion — the sheet is removed and
the section carries an opaque white, since there is no traverse to reveal and the
frost would only tint the paper where the fixed hash happens to sit.

## Verified

60–61 fps at every act at 1440×900. Reverse scrub returns identical values to the
forward pass at all five sample points — nothing in the choreography holds state.

# Text On Path — specification

Reverse-engineered from `https://annnimate.com/animations/text-on-path`.
The page itself is a Next.js shell; the live preview runs in an iframe at
`https://annnimate.com/api/sandbox/iframe/text-on-path`, and that document ships
the whole component (markup, CSS, minified JS). Everything below is read off
that source and off the rendered DOM at 1440x900 — no estimates.

## Overview
- **Target files:** `site/src/components/TextOnPath.astro`, `site/src/scripts/text-on-path.js`, block in `site/src/styles/global.css`
- **Reference frames:** `docs/design-references/annnimate/ref-000..100.png` (scroll progress 0 → 1)
- **Interaction model:** scroll-driven. A sticky stage inside a tall track; scroll
  position decides *when* each word is due, and each word's fade then runs on its
  own clock. Not click, not hover, not time.
- **Dependencies on the original:** GSAP 3.15 + ScrollTrigger (loaded from jsDelivr in the sandbox).
  Ours is vanilla — the portfolio ships no animation library and every other
  effect here is hand-rolled. Behaviour is ported, not the runtime.

## The idea, in the author's own words
> "The first version set the whole sentence on the path the way SVG lets you, and
> let the browser space it. On a straight stretch that reads fine, but the moment
> the line bends the letters drift apart over every hill and crush together in the
> dips … So now every letter is measured and placed on the curve individually, and
> the spacing corrects itself wherever the line turns."

> "The reveal is split in two on purpose: the scroll decides when each word is due,
> but the fade itself runs on its own clock, so someone flying through the section
> still sees every word get its full soft bloom instead of snapping in. The gaps
> between words also stretch a little so the sentence fills the curve edge to edge
> — the letters themselves never do."

## Configuration (verbatim defaults from the demo element)
| attribute | default | notes |
|---|---|---|
| `data-anm-text` | `The fastest line is never straight, every curve earns its place, and the finish only proves the path.` | one sentence |
| `data-anm-text-position` | `above` | `above` \| `center` \| `below` |
| `data-anm-path` | `M -20 780 C 80 760, 150 690, 210 580 C 275 460, 350 395, 460 385 C 570 375, 640 415, 720 455 C 800 495, 870 515, 950 495 C 1030 475, 1060 400, 1110 310 C 1155 228, 1210 185, 1290 182 C 1370 180, 1420 250, 1460 350 C 1505 465, 1545 590, 1620 680` | authored in a 1600×900 space, overshooting both edges |
| `data-anm-scrub-distance` | `300` | vh of track (100–500) |
| `data-anm-direction` | `ltr` | `rtl` reveals from the far end |
| `data-anm-split` | `words` | `chars` = one tween per glyph |
| `data-anm-font-size` | `48` | design-space px, not real px |
| `data-anm-letter-spacing` | `0em` | em or px |
| `data-anm-curve-spread` | `1` | strength of the curvature correction |
| `data-anm-disable` | `` | csv of `mobile,landscape,tablet,desktop` |

Breakpoints used by `disable`: mobile `(max-width:479px)`, landscape
`(orientation:landscape) and (max-width:767px)`, tablet `(max-width:991px)`,
desktop `(min-width:992px)`.

## DOM the script builds
```
div[data-…]                      height: <scrub>vh
└ div.top_stage                  position:sticky; top:0; height:100svh; overflow:hidden
  └ svg.top_svg                  preserveAspectRatio="xMidYMid slice", role=img, aria-label=<sentence>
    └ g.top_shift                translate(0, (viewBoxH-900)/2)
      ├ path.top_path            the curve — fill:none, stroke:none, never drawn
      ├ g.top_text[aria-hidden]  font-size=<fontSize>; one <text.top_letter> per glyph
      └ text.top_measurer        hidden; the ruler for glyph advances
```

## CSS (verbatim from the sandbox)
```css
.top_wrap { --top-bg:#fffaf2; --top-fg:#101010; position:relative; width:100%;
            min-height:100svh; box-sizing:border-box; background:var(--top-bg); }
.top_stage { position:sticky; top:0; height:100svh; overflow:hidden; }
.top_svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
.top_path { fill:none; stroke:none; pointer-events:none; }
.top_text { font-family:'Switzer',…; font-weight:400; fill:var(--top-fg);
            -webkit-font-smoothing:antialiased; }
.top_letter { text-anchor:middle; }
.top_measurer { font-family:'Switzer',…; font-weight:400; visibility:hidden; pointer-events:none; }
```
Sandbox page background is `#F0F0F0`; the component paints its own `#fffaf2`.

## The maths (ported exactly)

**viewBox fit** — on build and on debounced resize (150 ms):
```
h/w of the stage → viewBoxH = round(height / width * 1600)
svg.viewBox = "0 0 1600 <viewBoxH>";  g.transform = translate(0, round((viewBoxH-900)/2))
```
The 1600×900 design space therefore stays centred whatever the aspect ratio, and
`slice` crops the overshoot rather than shrinking the curve.

**Sampling the curve** (`L` = total length):
```
at(l)        = path.getPointAtLength(clamp(l, 0, L))
tangent(l)   = atan2(at(l+1).y - at(l-1).y, at(l+1).x - at(l-1).x)
curvature(l) = wrapPi(tangent(l+8) - tangent(l-8)) / 16
```

**Radial offsets** — `above:-12/44`, `center:15/44`, `below:48/44`, each × fontSize:
```
draw   = offset[position] * fontSize        // where the glyph is painted, along the normal
comp   = draw - 0.33 * fontSize             // the offset the spacing correction is computed at
```

**Curvature-compensated advance** — a letter riding at radial offset `comp`
travels a parallel curve, so its own arc length differs by `1 - κ·comp`:
```
scale(l) = clamp(1 - curveSpread * comp * curvature(l), 0.5, 2)
step     = advance / scale(pos + advance/2)
```

**Justification** — the word gaps flex, the letters never do:
```
space  = width("n n") - width("nn")  + letterSpacing      // measured, not assumed
width  = per-glyph getComputedTextLength() + letterSpacing
gap    = clamp((L - Σwidth) / spaceCount, -0.4*space, 1.5*space)
start  = max(0, (L - (Σwidth + gap*spaceCount)) / 2)      // sentence centred on the curve
```

**Placing one glyph** at `mid = pos + step/2`:
```
p = at(mid); a = tangent(mid)
transform = translate(p.x + (-sin a)*draw, p.y + (cos a)*draw) rotate(a in degrees)
t = mid / L                                               // its position in the reveal order
```
Ground truth to check against (1440×900, Switzer 400, path length **2269.01**):
```
T  translate(-7.13 763.60) rotate(-14.73)
h  translate(21.82 754.09) rotate(-21.68)
e  translate(48.36 741.68) rotate(-28.44)
f  translate(86.48 716.48) rotate(-38.30)
a  translate(102.75 702.66) rotate(-42.37)
s  translate(122.20 683.39) rotate(-46.98)
```
(Different font ⇒ different advances, so only the first glyph's position and the
angles are directly comparable.)

## States & behaviours

### Reveal (the whole point)
- **Trigger:** ScrollTrigger on the wrap, `start:"top top"`, `end:"bottom bottom"`,
  `scrub:true` → progress 0→1 across `(scrub - 100)` vh of scrolling.
- **Per unit** (a word, or a glyph in `chars` mode) with normalised position `t`:
  `threshold = direction==='rtl' ? 1-t : t`, clamped to `[0.001, 0.999]`;
  `shown = progress >= threshold`. On a change of `shown` the unit's own tween
  plays or reverses — the scroll never scrubs the fade itself.
- **The tween:** `autoAlpha 0 → 1`, `filter blur(5px) → blur(0px)`,
  `duration 0.6s`, `ease power3.out` (= `1-(1-x)^4`), pre-built paused.
  Reversing runs the same ease backwards.

### Reduced motion
`gsap.matchMedia('(prefers-reduced-motion: reduce)')` → wrap height `100svh`,
every glyph set to `autoAlpha:1, blur(0px)`, no ScrollTrigger. Same for a
viewport listed in `disable`.

### Font loading
Glyph advances are wrong until the webfont lands: on `document.fonts.ready` the
width cache is dropped, the layout is rebuilt and the tweens are re-created.

### Resize
Debounced 150 ms → **viewBox refit only**. The letter layout is not recomputed
(the design space is resolution-independent, so it doesn't need to be).

### Visibility
`visibilitychange` → `gsap.globalTimeline.pause()/resume()`.

## Responsive
- **Desktop 1440×900:** viewBox `0 0 1600 1000`, shift `translate(0 50)`.
- Narrower/taller viewports keep the 1600-wide design space, so the type shrinks
  with the width — the author's own tip is to `disable` the reveal on mobile and
  show the sentence flat instead.

## Deliberate deviations for this site
1. **Vanilla, not GSAP.** Same numbers, same split-clock reveal, hand-rolled rAF —
   the portfolio has no animation library and adding 110 KB for one section is not
   worth it.
2. **Type:** Instrument Sans (the site's display face) instead of Switzer. The
   layout is measured at runtime, so any face lays out correctly.
3. **No paper of its own.** The reference paints `#fffaf2` behind the curve. Here
   the section lives inside `.pane`, so the glass is the background and the
   sentence is painted in `--ink` over it. `.tpath` is `background:none`,
   `z-index:1` — the same footing the marquee arc had.
4. **Placement:** section two, inside the glass pane rather than a chapter of its
   own. Sticky still resolves against the viewport and is bounded by `.tpath`'s
   own 300vh box, and `stepped.js` measures the pane's *top*, not its height, so
   the taller pane leaves the staircase timing untouched.

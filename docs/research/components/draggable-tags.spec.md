# Draggable tags — act two of section three

Cloned from `https://draggable-tags.framer.website/`. Measured, not estimated.

## Interaction model

Pointer-driven drag. **No physics library** — Framer Motion `drag` with momentum off.
Probed by grabbing the top tag, moving +220/-130 and releasing:

| stage | tx | ty | scale | cursor | z |
|---|---|---|---|---|---|
| rest | 17 | -37.6 | 1.000 | grab | 6 |
| mousedown (no move) | 17 | -37.6 | 1.000 | grab | 6 |
| dragging | 237 | -167.6 | **1.040** | grabbing | **8** |
| +120ms after release | 237 | -167.6 | 1.008 | grab | 8 |
| +1.4s after release | 237 | -167.6 | 1.000 | grab | 8 |

Reading of that table:

- movement is **exactly 1:1** with the pointer (+220/-130 landed +220/-130) — no
  constraints, no `dragElastic`
- **no momentum** — it stops dead where released; position is identical at release,
  +120ms and +1.4s
- **scale 1.04 while held**, springs back to 1 on release. Nothing on mousedown
  alone — it takes actual movement
- **z jumps to the top and STAYS there.** Bring-to-front is permanent, which is
  what lets you deal the pile out one tag at a time
- rotation does **not** change during drag
- **no hover state at all** — shadow, scale and z are identical on and off

## Entrance

Sampled per-frame from load. Spring, staggered per tag:

- from `translate(+408, +152)` off rest, `rotate(0)`, `opacity 0`
- to rest offset, rest rotation, `opacity 1`
- rise ≈ 320ms, then **overshoots ~10% past rest** (travelled to -25 where rest is
  +17) and settles back
- rotation animates 0 → rest angle across the same spring

Damping ratio ≈ 0.59, ωn ≈ 13 rad/s → `stiffness 170, damping 15.5, mass 1`.

## The six tags (original)

| z | label | icon | rot | bg | ink | h | radius |
|---|---|---|---|---|---|---|---|
| 1 | branding | ✦ | -5° | rgb(102,103,171) | rgb(43,44,102) | 62.5 | 16 |
| 2 | content | ✎ | +8° | rgb(241,138,173) | rgb(163,47,86) | 62.5 | 16 |
| 3 | creative | ◆ | -3° | rgb(234,103,89) | rgb(179,39,23) | 62.5 | 16 |
| 4 | strategy | ◎ | +6° | rgb(248,143,88) | rgb(176,84,35) | 77 | 20 |
| 5 | design | ◇ | -7° | rgb(243,198,95) | rgb(166,124,28) | 62.5 | 20 |
| 6 | growth | ↗ | +4° | rgb(139,194,140) | rgb(59,140,59) | 77 | 28 |

Ink is always a much darker version of the tag's own hue — never black.

Rest positions cluster tightly: every tag centres within ±25px of the same point,
about 120px above viewport centre. It is a **tight fanned pile**, not a spread.

### Construction of one pill

```html
<div  <!-- drag wrapper: absolute, cursor grab, touch-action none, will-change transform -->
  <div style="background:C; color:INK; border-radius:R; box-shadow:rgba(0,0,0,.18) 3px 10px 28px;
              overflow:hidden; display:flex; flex-direction:column">
    <div style="position:absolute;top:0;left:R;right:R;height:2px;
                background:rgba(255,255,255,.3);z-index:10"></div>   <!-- specular strip -->
    <div style="display:flex;align-items:center;gap:8px;padding:1px 20px;white-space:nowrap">
```

The 2px white strip inset by exactly the corner radius is the whole material trick
in the original — it reads as a highlight catching the top edge of a moulded
object. Label 48px/600, icon 50px, gap 8px.

## Deviations — the redesign the brief asked for

Mechanic cloned exactly. The *asset* is deliberately not:

1. **Material.** The original is flat fill + one 2px strip. Ours adds a vertical
   gradient, a hairline inner rim, an inset floor shadow for thickness, and a
   two-layer drop shadow (tight contact + wide ambient) that lifts on grab. That
   pairing is what makes an object look like it is resting ON something rather
   than pasted over it.
2. **Palette.** The original's six saturated hues are an agency rainbow and would
   fight this site. Ours is one cool-leaning muted family at matched lightness.
3. **Icons.** Unicode dingbats (✦ ✎ ◆) render differently on every platform.
   Replaced with inline SVG at a single stroke weight.
4. **Copy.** The labels are Himalay's practice, echoing section two's sentence —
   research first, craft second.
5. **Entrance trigger.** Fires on scroll when the headline has left, not on load,
   because here this is act two of a pinned section.

6. **Fan spread.** The original's tags all centre within ±25px because its labels
   are single words of near-identical width. Ours are phrases, and at ±25px the
   lower four were fully buried — measured 19–80% visible only after opening the
   fan to ±96px. The rest offsets also scale down with the viewport (×0.58 under
   1200, ×0.4 under 810) so the pile fits a 390px screen; the **drag stays 1:1 at
   every width**, since a drag that moved less than the pointer feels broken.
7. **Unpinned layouts.** Below 1200px there is no pin to gate on, so the pile is
   simply present and moves into flow beneath the headline. Without that it was
   gated on a scroll that never happens and never appeared at all on tablet or
   mobile — caught by measuring opacity at those widths, not by looking.

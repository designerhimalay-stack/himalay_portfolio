# Stepped Reveal — specification

Extracted from https://labs.anyflow.agency/ (the `.weare` section, document offset
7316px). Measured, not estimated: every number below came from `getComputedStyle`
on the live site at three scroll positions, and the model was then checked by
predicting a fourth.

## Interaction model
**Scroll-driven**, continuous (not a trigger). Lenis is the scroll authority on
the source site.

## Structure
- A row of **7 equal columns** sits directly above the dark section.
- Viewport 1440 → each column **205.71px** (`width: 100/7 %`), measured 206.
- Column height **351px** on a 900px viewport = **39vh**. Class was `h-[39vh]`.
- `margin-top: 9px` = **1vh** (source class `mt-[1vh]`).
- Each column is plain `background: #000`. No clip-path, no SVG, no canvas.

## The animation
Each column is driven **only by `transform: scaleY()`**, origin bottom. Nothing
else moves — no opacity, no translate.

    u_i     = clamp(U - |i - 3| / 15, 0, 1)      // centre column leads
    scaleY_i = 1 - (1 - u_i)^2                   // ease-out quad

`U` is the section's scroll progress. The 1/15 stagger and the quad were derived
by inverting the measured scale values; the per-column progress gaps came out
constant at 0.0667 across every sample, which is what proves the model.

### Measured values (viewport 1440x900)
| scrollY | col 0 | col 1 | col 2 | col 3 (centre) |
|---|---|---|---|---|
| 6297 | 0.0563 | 0.1814 | 0.2976 | 0.4049 |
| 6549 | 0.4664 | 0.5594 | 0.6434 | 0.7186 |
| 6749 | 0.7084 | — | — | — |

Model predicted 0.7089 for the last cell. Match to three decimals.

## Scroll range
`U` runs over **1046px** ≈ **1.162 viewport heights**.
`U = 0` when the row's bottom edge sits **358px (0.40vh) below the viewport
bottom**; `U = 1` 1046px later.

    U = ((innerHeight * 1.40) - row.bottom) / (innerHeight * 1.162)

Expressed in viewport units so it holds at any height.

## Why it reads as a staircase
All 7 share one curve; the centre is 3 steps (0.2) ahead of the outermost. The
silhouette is a symmetric pyramid that flattens as `U` approaches 1, because the
ease-out compresses the gaps — at `U=1` every column is at 1.0 and the row is a
flush band, so it joins the dark section with no seam.

## Not reproduced
The source's own hero content and the rotated-card variant lower on their page
are out of scope; only the transition geometry is being taken.

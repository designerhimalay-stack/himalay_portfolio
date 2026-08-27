# HorizonX hero fan — act two of section three

Cloned from `https://horizonx.so/`. `networkidle` never settles on that site;
`domcontentloaded` + a wait is the only way to sample it.

## The finding that shapes everything

**The fan is static.** Every card's rotation and offset is identical at scroll
0 / 120 / 260 / 420 / 600 — it never reacts to scroll, and never staggers.

The entire animation lives on the **rig**, one element (`.hero-fadescale`):

| | |
|---|---|
| scale | **0.82 → 1.0** |
| opacity | **0 → 1** |
| delay | ~760ms after load |
| duration | ~800ms (t=760 → t=1574) |
| transform-origin | centred (`650px 220px` of a 1300×440 rig) |

One transform on one element. Not five staggered cards. That restraint is why it
reads as a photograph being placed rather than a UI assembling itself.

## Card geometry (static, measured)

Cards are `240 x 320`, `border-radius: 24px`, absolutely positioned in a
`max-w-[1300px] h-[440px]` rig.

| i | rotate | tx | ty | z |
|---|---|---|---|---|
| 0 | −14.08° | −432 | 49 | 10 |
| 1 | −7.04° | −216 | 16 | 20 |
| 2 | −1.76° | −18 | −5 | 30 |
| 3 | +6.16° | +180 | 11 | 40 |
| 4 | +14.08° | +396 | 43 | 20 |

Two things to note. The values are **not symmetric** — rotation steps run
7.04 / 5.28 / 7.92 / 7.92 and tx steps 216 / 198 / 198 / 216. They are
hand-placed, not generated. And `ty` traces an arc: the middle card sits
*highest* (−5) with the outer pair lowest (+49 / +43).

## Type

- H1 — 56px / 58.8 / −2.8px (−0.05em) / 700, centred, `rgb(23,23,23)`
- body — 18px / 27, `max-width: 560px`, centred, ink at 60%

## Deviations

1. **Four cards, re-derived symmetrically.** The original's five are hand-tuned
   and irregular; halving them cleanly is not possible, and the asymmetry is not
   the part worth keeping. Ours uses `u = (i − 1.5)/1.5` so
   `rot = 13u`, `tx = 372u`, `ty = −6 + 52u²` — the same arc idea (middle
   highest, outer lowest) expressed as a curve rather than five typed numbers.
2. **Cards carry content, not photographs.** The original's are pure imagery.
   Ours hold a die-cut sticker and a caption, so they are sized 260×350 and the
   overlap is kept light (~12px) — in a fan, anything on a covered strip is lost.
3. **The rig's fade+scale is scrubbed on the pin's progress**, not fired on a
   load timer, because here this is act two of a pinned section rather than a
   hero.
4. **Header is deliberately small** (36px against the reveal headline's 80px).
   Two headings at similar weight in one section read as competing.

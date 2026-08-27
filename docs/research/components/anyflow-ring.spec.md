# The dial — cloned from labs.anyflow.agency

Their section 2 (`docY 900`, height `1332` = 1.48vh at 900).
`networkidle` never settles there; use `domcontentloaded` + a wait.

## The mechanism — measured across 13 scroll positions

**The mark does not travel to the ring. The ring rises to meet the mark.**

| scrollY | mark cy | ring cy | ring size | ring rot |
|---|---|---|---|---|
| 900 | **450** | 882 | 504 | 180° |
| 1011 | **450** | 771 | 504 | 180° |
| 1122 | **450** | 660 | 504 | 180° |
| 1233 | **450** | 549 | 504 | 180° |
| 1344 | 438 | **438** | 504 | 180° |
| 1455 | 327 | 327 | 504 | 180° |
| 1566 | 216 | 216 | 504 | 180° |
| 1677 | 105 | 105 | 595 | −168.4° |
| 1788 | −6 | −6 | 673 | −154.2° |
| 1899 | −117 | −117 | 710 | −139.9° |
| 2010 | −228 | −228 | 705 | −126.4° |
| 2121 | −339 | −339 | 657 | −112.2° |
| 2232 | −450 | −450 | 574 | −98.7° |

Read that in three beats:

1. **Approach.** The mark is pinned at viewport centre (cy 450, unmoving). The
   ring scrolls up at 1:1 with the page — 882 → 771 → 660 → 549, exactly 111px
   per 111px of scroll.
2. **Meeting.** At scrollY ≈ 1344 the ring's centre reaches the mark's. From
   here the mark unpins and the two travel together, still 1:1.
3. **Spin-up.** Only *after* they meet does the ring begin to rotate — about
   **+14° per 111px** of scroll — and to pulse in size, 504 → 710 → 574. A plain
   circle rotating is invisible; a DASHED one is not, and the travelling dashes
   are the whole effect.

Nothing rotates before the meeting. That ordering is the point: the dial is
inert until the mark is seated in it, and only then does it come alive.

## Parts

- **ring** — a CSS element, not SVG: `rounded-full border-2 border-dashed`,
  504px, lime `lab(83.79 -45.04 88.47)` ≈ `#A3E635`.
- **mark** — a 432×432 `<canvas>`; its rotation is drawn *inside* the canvas, so
  the element's own CSS transform reads 0° at every scroll position.
- **labels** — fixed at −88.5° (top), 0° (right), +88.5° (bottom), radius ≈306,
  i.e. **outside** the 252px ring radius. They do not orbit; their angles are
  constant at every sample. Bebas Neue 28.8px/600, uppercase.
- a 1px hairline crosses the stage horizontally at the centre line, and another
  runs vertically down the section.

## Deviations

1. **Our hash, not their logo.** `hash-gl.js` is already a raymarched 3D mark
   with yaw/roll/zoom, and `parallax.js` already parks it at viewport centre by
   the end of the hero — so the pinned mark this effect needs already exists and
   is already in the right place. The spin is driven through `HashGL.set`.
2. **Instrument Sans**, per the one-family rule. Their Bebas Neue is a condensed
   display face; the metrics do not transfer, so the headline is re-fitted
   rather than copied.
3. **Ring colour** is the site's ink at low alpha rather than lime — a
   lime dashed circle would be the only saturated thing on the page. One token.

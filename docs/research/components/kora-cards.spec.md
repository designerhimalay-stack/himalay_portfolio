# Before / After comparison cards — act two of section three

Cloned from `https://kora.framer.media/?utm_source=launchnow`, the part Framer
names **"Comparison Cards"**. Every number measured off the live page.

## Geometry (1440x900)

| | value |
|---|---|
| card | **500 x 650**, `border-radius: 40px`, `padding: 50px` |
| pair | 20px apart, centred — Before lands at **x210**, After at **x730** |
| headline | content width **400px** (500 − 2×50), wraps to **2 lines**, 99px tall |
| list rows | **25px** tall on a **45px pitch** → a 20px gap |
| list inset | last row sits **50px** off the card's bottom — the padding, exactly |
| chip | 25×25, fully round, svg 17×17 |

Type — 45/49.5/−1.8/400 headline, 15/22.5/−0.45/600 list, 13/19.5/−0.325/600
eyebrow. Colours — Before `rgb(245,245,233)` cream on `rgb(36,36,36)` ink;
After `rgb(93,195,155)` green on `rgb(252,252,250)`, eyebrow at 75% white.

The card leaves a deliberate **void in its middle**: headline hard against the
top block, list hard against the bottom, nothing distributed between them.

## The choreography — two stages, measured across 21 scroll positions

### Stage 1 — grow (p 0 → 1)

The Before card is centred and scales **0.7 → 1.0**. Dead linear: width read
350 / 388 / 425 / 463 / 500 at even steps. The After card waits behind it at
**0.8**, completely covered — 400px hidden beneath 500px, so it is not visible
at all until the split.

### Stage 2 — split (p ≈1.4 → 1.75)

Before slides left, After slides right **and scales 0.8 → 1.0**, landing as two
500px columns 20px apart.

**It overshoots.** Sampled mid-move, Before reached **x203** before settling to
210, and After reached **x735** before settling to 730 — about 7px past on both
sides. That overshoot is the character of the whole move: the pair separate like
two things being dealt apart, not like a slider being dragged.

On the original this is a *triggered* spring (Framer's "Cards Trigger 1/2"), not
a scrub — which is why samples taken at settled scroll positions still showed it
mid-flight.

## Deviations

1. **Reproduced as a back-out ease on the scrub, not a spring.** A scrub has to
   be a pure function of scroll; a spring carries velocity, and scrubbing
   backwards through one leaves it fighting itself. `outBack` with c = 1.36
   gives the measured ~7px overshoot and reverses cleanly.
2. **Face is Instrument Sans**, per the one-family rule. All metrics are kora's.
3. **Colours ARE kora's** — the brief was "stick to the url". Two tokens if that
   changes.
4. **Copy is not kora's.** Same Before/After frame pointed at how design gets
   made, matching the claim section two's sentence already stakes out.
5. **Below 1200px** the cards stack vertically at full opacity and the transform
   is dropped — consistent with the section abandoning its pin there.

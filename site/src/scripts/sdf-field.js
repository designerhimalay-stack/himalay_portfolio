/* Signed distance field baked from a live typeface.

   Exact Euclidean transform (Felzenszwalb's 1D squared-distance envelope run over
   rows then columns), so the field is TRUE distance, not an approximation — a
   sphere tracer will tunnel straight through anything less. Packed into R,G as
   16 bits because 8 would quantise coarser than the march threshold.

   Shared, and cached: the glyph set and the inline marks both need the same '&'
   field, and the transform blocks the main thread for ~150ms. Baking it twice —
   once per WebGL context — spent that twice for one identical Uint8Array. The
   cache is keyed on everything that changes the result, so a different character,
   face or box still bakes its own. */

var cache = {};

function edt1d(f, n) {
  var d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  var k = 0, q, s; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (q = 1; q < n; q++) {
    s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  for (k = 0, q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  return d;
}
function edt2d(mask, W, H, inside) {
  var INF = 1e20, f = new Float64Array(Math.max(W, H)), g = new Float64Array(W * H), x, y;
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) f[x] = (mask[y * W + x] === inside) ? 0 : INF;
    var r = edt1d(f, W);
    for (x = 0; x < W; x++) g[y * W + x] = r[x];
  }
  for (x = 0; x < W; x++) {
    for (y = 0; y < H; y++) f[y] = g[y * W + x];
    var cc = edt1d(f, H);
    for (y = 0; y < H; y++) g[y * W + x] = cc[y];
  }
  return g;
}

/* 1024 rather than 512: the crisp specular (pow 420) needs a normal sampled finer
   than the field's texel spacing, and at 512 the normal step straddled more than
   a texel and averaged the highlight away. One-time cost, measured. */
export function bakeField(ch, font, box) {
  var key = ch + '|' + font + '|' + box;
  if (cache[key] !== undefined) return cache[key];

  var S = 1024, c2 = document.createElement('canvas'); c2.width = c2.height = S;
  var x2 = c2.getContext('2d');
  x2.font = font; x2.textAlign = 'center'; x2.textBaseline = 'alphabetic';
  var m = x2.measureText(ch);
  var ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (!ink) return (cache[key] = null);
  /* the built marks stand 1.0 tall in a `box` tall box; scale the glyph to match
     and centre it on its ink, not on its baseline */
  var want = S * (0.92 / box);
  /* parseFloat(font) would read the WEIGHT, not the size — '500 160px ...' parses
     as 500 and rasterises the glyph three times too big, which fills the whole
     field and reads as a solid block. Match the px token instead. */
  var k = want / ink, px = parseFloat(font.match(/([\d.]+)px/)[1]) * k;
  x2.font = font.replace(/[\d.]+px/, px.toFixed(2) + 'px');
  m = x2.measureText(ch);
  x2.fillStyle = '#000';
  x2.fillText(ch, S / 2, S / 2 + (m.actualBoundingBoxAscent - (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 2));
  var px4 = x2.getImageData(0, 0, S, S).data, mask = new Uint8Array(S * S), i;
  for (i = 0; i < S * S; i++) mask[i] = px4[i * 4 + 3] > 127 ? 1 : 0;
  /* seed each transform on the OTHER phase: distance-to-glyph grows outward from
     the ink, distance-to-background grows inward from it, and the signed field is
     their difference — positive outside, negative in. */
  var dToGlyph = edt2d(mask, S, S, 1), dToBack = edt2d(mask, S, S, 0);
  var unit = box / S, out = new Uint8Array(S * S * 4), x, y;
  /* rows are written bottom-up: canvas y runs down, glyph space runs up, and
     UNPACK_FLIP_Y_WEBGL is ignored for ArrayBufferView uploads */
  for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
    var si = y * S + x, di = (S - 1 - y) * S + x;
    var sd = (Math.sqrt(dToGlyph[si]) - Math.sqrt(dToBack[si])) * unit;
    var n = Math.max(0, Math.min(1, sd / (2 * box) + 0.5)) * 65535;
    out[di * 4] = Math.floor(n / 255); out[di * 4 + 1] = Math.round(n % 255);
    out[di * 4 + 2] = 0; out[di * 4 + 3] = 255;
  }
  return (cache[key] = { data: out, size: S });
}

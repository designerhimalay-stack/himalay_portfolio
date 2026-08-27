# Sticker pipeline

Turns a brand logo into the die-cut sticker the section-three cards use.

Two halves, each doing the part it is actually good at:

1. **`make-sticker-plate.py`** (PIL) computes the DIE LINE. The white border has to
   follow the artwork's own outline, and that is an alpha-channel offset: dilate,
   round the corners, threshold. Tracing it into geometry in Blender would be
   slower, less exact, and would break on a mark with interior holes.
2. **`blender/sticker_rig_v001.blend`** does the PHYSICAL half — paper thickness,
   a 6° curl, and a real contact shadow, rendered on transparency.

## Running it

    python3 tools/make-sticker-plate.py logo.png plate.png --border 26

`--border` is in pixels of the source image, so run it on art at the resolution
you want the die line judged at. Bigger art wants a bigger border.

Then in Blender (rig already set up — open the .blend):

    import bpy
    tex = next(n for n in bpy.data.materials['MAT_Sticker'].node_tree.nodes
               if n.type == 'TEX_IMAGE')
    img = bpy.data.images.load('plate.png')
    tex.image = img
    st = bpy.data.objects['SM_Sticker']
    w, h = img.size
    st.scale = (w / max(w, h), h / max(w, h), 1.0)      # or the mark stretches
    sc = bpy.context.scene
    sc.render.resolution_x = 1200
    sc.render.resolution_y = round(1200 * h / w)
    sc.render.filepath = 'site/public/assets/brands/<slug>.png'
    bpy.ops.render.render(write_still=True)

## Two things that will bite

- **The plane needs a UV layer.** `bmesh.ops.create_grid(calc_uvs=True)` did not
  produce one here; the rig builds UVs from the mesh's own XY bounds instead,
  which is exact for a flat plane. Without them the texture samples one texel and
  the whole sticker renders invisible.
- **The material is 62% emission, not a lit surface.** A sticker is artwork before
  it is an object, and a normal Principled under studio lights drove black type to
  mid-grey and a saturated blue to pastel. The emission carries the printed colour
  at its authored value; the BSDF on top supplies the sheen and the shading across
  the curl. Verified: source blue (30,110,240) renders (38,108,233).

## Where the files go

`site/public/assets/brands/<slug>.png`, where slug is the one in `Why.astro`'s
PANELS array: `stanford`, `worldbank`, `itap`, `canvia`. Why.astro checks for the
file at BUILD time and only emits an `<img>` when it exists, so a missing mark is
a text chip rather than a broken image.


## The other route: keying a finished sticker

`key-sticker.py` covers the case where the sticker already exists as a flat
export on a white background — which is how all four of these arrived.

    python3 tools/key-sticker.py "stanford sticker.png" site/public/assets/brands/stanford.png

The catch is that a die-cut sticker's border is white and the page it was
exported on is also white, so keying by colour eats the border. What separates
them is the drop shadow: reading across one of these files the values run 254
(paper) -> ~218 (shadow) -> 255 (border, enclosed by that shadow). So background
is not "white", it is "white reachable from the edge of the canvas without
crossing the shadow" — a flood fill, not a threshold. Everything the fill cannot
reach is kept, and the result is cropped to its own alpha bounds so the card is
not laying out around a dead margin.

Verified by compositing the output on magenta: no surviving background rectangle
on any of the four, borders and shadows intact.

`worldbank logo.png` already had real alpha and was copied through untouched.

## Which route to use

Use the KEY route when you already have a finished sticker export. Use the PLATE
+ Blender route when you have raw logo artwork and want the sticker generated —
it gives real paper thickness, a curl and a rendered contact shadow rather than
whatever was baked into the export.

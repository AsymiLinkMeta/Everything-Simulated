"""
Builds assets/rig3d/rig.blend: a generic, Everything Simulated branded aluminium-profile sim rig for the
rig builder preview. Units are metres; the model is laid out in millimetres via mm().

    blender -b --factory-startup -P scripts/rig3d/build_rig.py

Axes: +X forward (the driver faces +X), +Y the driver's left, +Z up. Every part lives in a
collection named after its preview layer (see LAYERS); rig parts hang off the "RigLift"
empty so the motion layer can raise the whole frame by MOTION_LIFT.
Proportions follow real 160 x 40 aluminium-profile cockpits (see docs/rig3d/REMODEL-PLAN.md). The model is
generic and carries only Everything Simulated branding (make_brand_art.py).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "assets", "rig3d", "rig.blend")
MOTION_LIFT = 0.07


def mm(*v):
    return Vector([x / 1000.0 for x in v]) if len(v) > 1 else v[0] / 1000.0


# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

LAYERS = [
    "chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals", "sidemount", "shifter", "handbrake", "pc", "motion-back", "motion",
    "headset", "mount", "mount-sides", "mount-top", "screen-center", "screen-sides", "screen-dual", "screen-top",
]
RIG_LAYERS = {"chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals", "sidemount", "shifter", "handbrake", "headset"}
COLL = {}
for name in LAYERS:
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    COLL[name] = c
lift = bpy.data.objects.new("RigLift", None)
scene.collection.objects.link(lift)
CUR = {"layer": "chassis"}


def layer(name):
    CUR["layer"] = name


def link(obj):
    COLL[CUR["layer"]].objects.link(obj)
    if CUR["layer"] in RIG_LAYERS:
        obj.parent = lift
    return obj


# ----------------------------------------------------------------------------- materials
def principled(name, color, metallic=0.0, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def add_bump(m, scale, strength, kind="noise", detail=6.0, distance=0.0004):
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    if kind == "noise":
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = detail
        nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
        out = tex.outputs["Fac"]
    else:
        tex = nt.nodes.new("ShaderNodeTexWave")
        tex.inputs["Scale"].default_value = scale
        nt.links.new(coord.outputs["UV"], tex.inputs["Vector"])
        out = tex.outputs["Fac"]
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(out, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


CACHE = os.path.join(ROOT, "assets", "rig3d", "cache")  # CC0 textures, scripts/rig3d/fetch_assets.py


def cache_img(name, colour=False):
    im = bpy.data.images.load(os.path.join(CACHE, name), check_existing=True)
    if not colour:
        im.colorspace_settings.name = "Non-Color"
    return im


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def rough_variation(m, lo, hi, scale=40.0, scratch=0.0):
    """Roughness that drifts between lo and hi over the part (handling marks, anodising variation),
    plus optional fine directional scratches (stretched noise) that read in the highlights."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = node(nt, "ShaderNodeTexNoise", Scale=scale, Detail=5.0, Roughness=0.6)
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    mr = node(nt, "ShaderNodeMapRange", **{"From Min": 0.3, "From Max": 0.7, "To Min": lo, "To Max": hi})
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
    out = mr.outputs["Result"]
    if scratch:
        mp = node(nt, "ShaderNodeMapping", Scale=(4000.0, 4000.0, 25.0))
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        sc = node(nt, "ShaderNodeTexNoise", Scale=1.0, Detail=2.0)
        nt.links.new(mp.outputs["Vector"], sc.inputs["Vector"])
        st = node(nt, "ShaderNodeMapRange", **{"From Min": 0.62, "From Max": 0.7, "To Min": 0.0, "To Max": scratch})
        nt.links.new(sc.outputs["Fac"], st.inputs["Value"])
        add = node(nt, "ShaderNodeMath"); add.operation = "SUBTRACT"
        nt.links.new(out, add.inputs[0]); nt.links.new(st.outputs["Result"], add.inputs[1])
        out = add.outputs[0]
    nt.links.new(out, b.inputs["Roughness"])
    return m


def carbon(name):
    """2x2 twill carbon fibre: alternating bands of fibre under a deep clear coat."""
    m = principled(name, (0.02, 0.02, 0.022), 0.0, 0.35, **{"Coat Weight": 1.0, "Coat Roughness": 0.04, "Anisotropic": 0.6})
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = node(nt, "ShaderNodeMapping", Scale=(260.0, 260.0, 260.0))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    ch = node(nt, "ShaderNodeTexChecker", Scale=1.0, Color1=(0.006, 0.006, 0.007, 1), Color2=(0.05, 0.05, 0.055, 1))
    nt.links.new(mp.outputs["Vector"], ch.inputs["Vector"])
    nt.links.new(ch.outputs["Color"], b.inputs["Base Color"])
    rm = node(nt, "ShaderNodeMapRange", **{"To Min": 0.45, "To Max": 0.22})
    nt.links.new(ch.outputs["Fac"], rm.inputs["Value"])
    nt.links.new(rm.outputs["Result"], b.inputs["Roughness"])
    return m


MAT = {
    # black anodised extrusion: dark satin metal, roughness drifting over each part, faint scratches
    "alu": rough_variation(add_bump(principled("Black anodised aluminium", (0.024, 0.025, 0.028), 0.9, 0.32, **{"Anisotropic": 0.45, "Coat Weight": 0.12, "Coat Roughness": 0.25}), 900, 0.03), 0.27, 0.36, 8, 0.04),
    "alu_bright": rough_variation(principled("Machined aluminium", (0.62, 0.63, 0.65), 1.0, 0.22, **{"Anisotropic": 0.7}), 0.16, 0.3, 50, 0.08),
    # textured powder coat: orange-peel bump, satin
    "steel": add_bump(principled("Black powder coat", (0.02, 0.021, 0.024), 0.0, 0.5), 450, 0.12, distance=0.0006),
    "plastic": rough_variation(principled("Satin black plastic", (0.018, 0.018, 0.02), 0.0, 0.45), 0.38, 0.55, 25),
    "cap": add_bump(principled("End cap", (0.012, 0.012, 0.013), 0.0, 0.6), 1600, 0.2),
    "bolt": principled("Black oxide screw", (0.035, 0.036, 0.04), 0.85, 0.32),
    "gloss": principled("Gloss black", (0.012, 0.012, 0.014), 0.0, 0.12, **{"Coat Weight": 1.0}),
    "rubber": add_bump(principled("Rubber", (0.012, 0.012, 0.013), 0.0, 0.75), 1800, 0.25),
    # ES brand red #e10600 (--es-red), as linear RGB
    "red": principled("ES red accent", (0.753, 0.0018, 0.0), 0.0, 0.32, **{"Coat Weight": 0.6}),
    "silver": principled("Polished foot", (0.8, 0.8, 0.82), 1.0, 0.15),
    "red_anod": rough_variation(principled("ES red anodised", (0.62, 0.0015, 0.0), 1.0, 0.3, **{"Anisotropic": 0.4}), 0.24, 0.36, 40, 0.06),
    "motor": rough_variation(principled("Motor housing", (0.04, 0.042, 0.047), 0.9, 0.3), 0.26, 0.4, 20),
    "carbon": carbon("Carbon fibre"),
    "cable": principled("Braided cable", (0.01, 0.01, 0.011), 0.0, 0.55, **{"Sheen Weight": 0.4}),
    "lcd": principled("Wheel display", (0.0, 0.0, 0.0), 0.0, 0.1, **{"Emission Color": (0.2, 0.6, 1.0, 1), "Emission Strength": 1.5, "Coat Weight": 1.0}),
    "spring": principled("Spring steel", (0.6, 0.6, 0.62), 1.0, 0.25),
}


def seat_material():
    """Black suede-like fabric insert (CC0 fabric normal map) between grained leatherette bolsters,
    with red stitching along the seam. UV: U across the seat (-1..1), V along it (0..1)."""
    m = bpy.data.materials.new("Seat fabric and leather")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    absu = nt.nodes.new("ShaderNodeMath"); absu.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["X"], absu.inputs[0])
    mask = nt.nodes.new("ShaderNodeMath"); mask.operation = "GREATER_THAN"; mask.inputs[1].default_value = 0.62
    nt.links.new(absu.outputs[0], mask.inputs[0])
    # fabric: tiled at ~6 cm (U spans ~0.5 m, V ~1.4 m)
    mp = node(nt, "ShaderNodeMapping", Scale=(4.5, 24.0, 1.0))
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    fn = nt.nodes.new("ShaderNodeTexImage"); fn.image = cache_img("fabric_pattern_07_nor_gl.jpg")
    fr = nt.nodes.new("ShaderNodeTexImage"); fr.image = cache_img("fabric_pattern_07_Rough.jpg")
    for t in (fn, fr):
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    # leather grain: fine voronoi
    vor = node(nt, "ShaderNodeTexVoronoi", Scale=900.0)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    leather_bump = node(nt, "ShaderNodeBump", Strength=0.25, Distance=0.0004)
    nt.links.new(vor.outputs["Distance"], leather_bump.inputs["Height"])
    fabric_nm = node(nt, "ShaderNodeNormalMap", Strength=1.2)
    nt.links.new(fn.outputs["Color"], fabric_nm.inputs["Color"])
    # quilted channels on the insert
    wave = node(nt, "ShaderNodeTexWave", Scale=14.0)
    wave.wave_type = "BANDS"; wave.bands_direction = "Y"
    nt.links.new(uv.outputs["UV"], wave.inputs["Vector"])
    quilt = node(nt, "ShaderNodeBump", Strength=0.3, Distance=0.003)
    nt.links.new(wave.outputs["Fac"], quilt.inputs["Height"])
    nt.links.new(fabric_nm.outputs["Normal"], quilt.inputs["Normal"])
    nmix = nt.nodes.new("ShaderNodeMix"); nmix.data_type = "VECTOR"
    nt.links.new(mask.outputs[0], nmix.inputs["Factor"])
    nt.links.new(quilt.outputs["Normal"], nmix.inputs[4]); nt.links.new(leather_bump.outputs["Normal"], nmix.inputs[5])
    nt.links.new(nmix.outputs[1], b.inputs["Normal"])
    # roughness: fabric map (very matte) vs leatherette (satin)
    fr_m = node(nt, "ShaderNodeMapRange", **{"To Min": 0.75, "To Max": 1.0})
    nt.links.new(fr.outputs["Color"], fr_m.inputs["Value"])
    rough = nt.nodes.new("ShaderNodeMix"); rough.data_type = "FLOAT"
    rough.inputs["B"].default_value = 0.42
    nt.links.new(mask.outputs[0], rough.inputs["Factor"])
    nt.links.new(fr_m.outputs["Result"], rough.inputs["A"])
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    shm = nt.nodes.new("ShaderNodeMix"); shm.data_type = "FLOAT"
    shm.inputs["A"].default_value = 0.08; shm.inputs["B"].default_value = 0.0
    nt.links.new(mask.outputs[0], shm.inputs["Factor"])
    nt.links.new(shm.outputs["Result"], b.inputs["Sheen Weight"])
    b.inputs["Sheen Roughness"].default_value = 0.4
    b.inputs["Specular IOR Level"].default_value = 0.25  # fabric scatters, it doesn't shine
    # red stitching just inside the bolster seam
    band = nt.nodes.new("ShaderNodeMath"); band.operation = "COMPARE"
    band.inputs[1].default_value = 0.6; band.inputs[2].default_value = 0.005
    nt.links.new(absu.outputs[0], band.inputs[0])
    dash = nt.nodes.new("ShaderNodeMath"); dash.operation = "SINE"
    vs = nt.nodes.new("ShaderNodeMath"); vs.operation = "MULTIPLY"; vs.inputs[1].default_value = 1400
    nt.links.new(sep.outputs["Y"], vs.inputs[0]); nt.links.new(vs.outputs[0], dash.inputs[0])
    dpos = nt.nodes.new("ShaderNodeMath"); dpos.operation = "GREATER_THAN"; dpos.inputs[1].default_value = -0.2
    nt.links.new(dash.outputs[0], dpos.inputs[0])
    stitch = nt.nodes.new("ShaderNodeMath"); stitch.operation = "MULTIPLY"
    nt.links.new(band.outputs[0], stitch.inputs[0]); nt.links.new(dpos.outputs[0], stitch.inputs[1])
    base = nt.nodes.new("ShaderNodeMix"); base.data_type = "RGBA"
    base.inputs["A"].default_value = (0.011, 0.011, 0.012, 1)   # fabric, a touch lighter than the leather
    base.inputs["B"].default_value = (0.008, 0.008, 0.009, 1)
    nt.links.new(mask.outputs[0], base.inputs["Factor"])
    col = nt.nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
    col.inputs["B"].default_value = (0.6, 0.004, 0.002, 1)
    nt.links.new(base.outputs["Result"], col.inputs["A"])
    nt.links.new(stitch.outputs[0], col.inputs["Factor"])
    nt.links.new(col.outputs["Result"], b.inputs["Base Color"])
    return m


MAT["seat"] = seat_material()
def shell_material():
    """The seat's back and sides: covered in the same black fabric as the insert (object-space
    mapped), as on real fabric GT buckets."""
    m = principled("Seat back fabric", (0.007, 0.007, 0.008), 0.0, 0.9, **{"Sheen Weight": 0.08, "Sheen Roughness": 0.5, "Specular IOR Level": 0.15})
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = node(nt, "ShaderNodeMapping", Scale=(16.0, 16.0, 16.0))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = cache_img("fabric_pattern_07_nor_gl.jpg"); t.projection = "BOX"; t.projection_blend = 0.3
    nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    nm = node(nt, "ShaderNodeNormalMap", Strength=1.0)
    nt.links.new(t.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


MAT["shell"] = shell_material()


ART = os.path.join(ROOT, "assets", "rig3d")
SCREEN_IMG = {}


def screen_material(image, u0=0.0, u1=1.0):
    """A lit panel showing part of a screen image (make_screen_art.py): u0..u1 of its width.
    Emission carries the picture; a near-black glossy base keeps the studio reflections."""
    key = (image, u0, u1)
    if key in SCREEN_IMG:
        return SCREEN_IMG[key]
    m = bpy.data.materials.new(f"Screen {image} {u0:.3f}-{u1:.3f}")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.004, 0.005, 0.007, 1)
    b.inputs["Roughness"].default_value = 0.45  # matte anti-glare panel
    b.inputs["Coat Weight"].default_value = 0.12  # faint reflection off the anti-glare film
    b.inputs["Coat Roughness"].default_value = 0.12
    uv = nt.nodes.new("ShaderNodeUVMap")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (u0, 0, 0)
    mp.inputs["Scale"].default_value = (u1 - u0, 1, 1)
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    path = os.path.join(ART, image)
    img = bpy.data.images.get(image) or bpy.data.images.load(path)
    img.name = image
    tex.image = img
    tex.extension = "EXTEND"
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    gam = nt.nodes.new("ShaderNodeGamma"); gam.inputs["Gamma"].default_value = 1.35  # panel contrast
    hs = nt.nodes.new("ShaderNodeHueSaturation"); hs.inputs["Saturation"].default_value = 1.35
    nt.links.new(tex.outputs["Color"], hs.inputs["Color"])
    nt.links.new(hs.outputs["Color"], gam.inputs["Color"])
    nt.links.new(gam.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.0
    SCREEN_IMG[key] = m
    return m


DECAL_MAT = {}


def decal_material(image, kind="print"):
    """Transparent decal from a brand image (make_brand_art.py). kind "print" is a satin screen print,
    "stitch" a slightly raised embroidered look for the seat."""
    key = (image, kind)
    if key in DECAL_MAT:
        return DECAL_MAT[key]
    m = bpy.data.materials.new(f"Decal {image} {kind}")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.get(image) or bpy.data.images.load(os.path.join(ART, image))
    img.name = image
    tex.image = img
    tex.extension = "CLIP"
    nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    if kind == "stitch":
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs["Factor"].default_value = 0.2
        mix.inputs["B"].default_value = (0.3, 0.3, 0.3, 1)
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 0.85
        b.inputs["Sheen Weight"].default_value = 0.8
        noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3000
        bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.4; bump.inputs["Distance"].default_value = 0.0008
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    else:
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = 0.42
    DECAL_MAT[key] = m
    return m


def decal(name, image, centre_mm, normal, up, width, kind="print", segs=1, wrap_to=None):
    """A flat decal width mm wide (height from the image's aspect) facing along normal, 0.8 mm off the
    surface. wrap_to shrink-wraps a subdivided decal onto a curved object (the seat shell)."""
    img = bpy.data.images.get(image) or bpy.data.images.load(os.path.join(ART, image))
    img.name = image
    h = width * img.size[1] / img.size[0]
    n = Vector(normal).normalized()
    upv = Vector(up).normalized()
    right = upv.cross(n).normalized()
    upv = n.cross(right).normalized()
    c = Vector(centre_mm) + n * 0.8
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    vs = [[bm.verts.new(mm(*(c + right * (width * (i / segs - 0.5)) + upv * (h * (j / segs - 0.5))))) for j in range(segs + 1)] for i in range(segs + 1)]
    for i in range(segs):
        for j in range(segs):
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = (a / segs, b / segs)
    ob = mesh_obj(name, bm, decal_material(image, kind))
    for p in ob.data.polygons:
        p.use_smooth = True
    if wrap_to is not None:
        sw = ob.modifiers.new("Wrap", "SHRINKWRAP")
        sw.target = wrap_to
        sw.wrap_method = "NEAREST_SURFACEPOINT"
        sw.wrap_mode = "OUTSIDE_SURFACE"
        sw.offset = 0.0012
    return ob


PANO = "screen-pano.png"
TOP = "screen-top.png"
MAT["pc_glass"] = principled("Tinted glass", (0.02, 0.02, 0.025), 0.0, 0.03, **{"Transmission Weight": 1.0, "IOR": 1.5})
MAT["glow"] = principled("Red glow", (0.0, 0.0, 0.0), 0.0, 0.5, **{"Emission Color": (1.0, 0.03, 0.01, 1), "Emission Strength": 3.0})


# ----------------------------------------------------------------------------- mesh helpers
def mesh_obj(name, bm, mat, smooth_angle=None, bevel=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    link(ob)
    if smooth_angle is not None:
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    if bevel:
        md = ob.modifiers.new("Bevel", "BEVEL")
        md.width = bevel
        md.segments = 2
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(40)
        md.harden_normals = True
    return ob


def section_with_slots(w, h, slot=8.0, depth=5.5, pitch=40.0):
    """Outline (mm, centred) of a w x h T-slot extrusion: a groove in every 40 mm cell of each face."""
    pts = []

    def side(p0, p1, inward):
        length = (p1 - p0).length
        d = (p1 - p0).normalized()
        cells = max(1, round(length / pitch))
        pts.append(p0.copy())
        for i in range(cells):
            c = (i + 0.5) * length / cells
            a = p0 + d * (c - slot / 2)
            bpt = p0 + d * (c + slot / 2)
            pts.extend([a, a + inward * depth, a + inward * depth + d * 0.0, bpt + inward * depth, bpt])

    hw, hh = w / 2, h / 2
    corners = [Vector((-hw, -hh)), Vector((hw, -hh)), Vector((hw, hh)), Vector((-hw, hh))]
    inwards = [Vector((0, 1)), Vector((-1, 0)), Vector((0, -1)), Vector((1, 0))]
    for i in range(4):
        side(corners[i], corners[(i + 1) % 4], inwards[i])
    out = []
    for p in pts:
        if not out or (p - out[-1]).length > 1e-6:
            out.append(p)
    return out


def extrude(name, section, p0, p1, u, mat, bevel=0.0006, caps=True, smooth=None):
    """Extrude a 2D section (mm, in the u / v plane) from p0 to p1 (mm)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    u = Vector(u).normalized()
    v = d.cross(u).normalized()
    bm = bmesh.new()
    a = [bm.verts.new(mm(*(p0 + u * s.x + v * s.y))) for s in section]
    b = [bm.verts.new(mm(*(p1 + u * s.x + v * s.y))) for s in section]
    n = len(section)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    if caps:
        bm.faces.new(list(reversed(a)))
        bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, smooth_angle=smooth, bevel=bevel)


def profile(name, p0, p1, w, h, u=(0, 0, 1), mat=None, caps=True):
    """T-slot extrusion w (along u) x h (along d x u) mm, with moulded black end caps (2.5 mm) that
    follow the slot outline, as on real profile cockpits."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    sec = section_with_slots(w, h)
    ob = extrude(name, sec, p0 + d * (2.5 if caps else 0), p1 - d * (2.5 if caps else 0), u, mat or MAT["alu"], bevel=0.0012)
    if caps:
        inset = [Vector((q.x * (w - 1.0) / w, q.y * (h - 1.0) / h)) for q in sec]
        for k, (a, b) in enumerate(((p0, p0 + d * 2.5), (p1 - d * 2.5, p1))):
            cap = extrude(f"{name} cap {k}", inset, a, b, u, MAT["cap"], bevel=0.0009)
            cap.parent = ob.parent
    return ob


def bolt(name, c, normal, r=5.0, h=3.2, mat=None):
    """Button-head socket screw: a domed head with a dark hex socket, sitting on a surface."""
    n = Vector(normal).normalized()
    c = Vector(c)
    head = cylinder(name, tuple(c), tuple(c + n * h), r, mat or MAT["bolt"], segs=20, bevel=0.0012)
    cylinder(name + " socket", tuple(c + n * (h - 0.6)), tuple(c + n * (h + 0.05)), r * 0.45, MAT["gloss"], segs=6, bevel=0, smooth=False)
    return head


def box(name, c, size, mat, bevel=0.0008, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vtx in bm.verts:
        vtx.co = Vector((vtx.co.x * size[0], vtx.co.y * size[1], vtx.co.z * size[2])) / 1000.0
    if rot is not None:
        bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=mm(*c), verts=bm.verts)
    return mesh_obj(name, bm, mat, bevel=bevel)


def cylinder(name, p0, p1, r, mat, segs=48, bevel=0.0008, smooth=True):
    sec = [Vector((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs))) for i in range(segs)]
    d = (Vector(p1) - Vector(p0)).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    return extrude(name, sec, p0, p1, d.cross(ref), mat, bevel=bevel, smooth=30 if smooth else None)


def torus(name, c, axis, R, r, mat, maj=96, mnr=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=mm(R), minor_radius=mm(r), major_segments=maj, minor_segments=mnr)
    ob = bpy.context.active_object
    for col in ob.users_collection:
        col.objects.unlink(ob)
    ob.name = name
    q = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    ob.rotation_mode = "QUATERNION"
    ob.rotation_quaternion = q
    ob.location = mm(*c)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    link(ob)
    return ob


def plate(name, outline, origin, u, v, thick, mat, bevel=0.0008):
    """Flat plate from a 2D outline (mm) in the u/v plane, thickness along u x v."""
    u, v = Vector(u).normalized(), Vector(v).normalized()
    w = u.cross(v)
    sec = outline
    bm = bmesh.new()
    a = [bm.verts.new(mm(*(Vector(origin) + u * p[0] + v * p[1]))) for p in sec]
    b = [bm.verts.new(mm(*(Vector(origin) + u * p[0] + v * p[1] + w * thick))) for p in sec]
    n = len(sec)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, bevel=bevel)


def rounded_rect(w, h, r, segs=6):
    pts = []
    for cx, cy, a0 in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        for i in range(segs + 1):
            a = math.radians(a0 + 90 * i / segs)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def tube_curve(name, pts_mm, r, mat, kind="POLY", res=24):
    """A round tube along points (mm): smooth (NURBS) for cables, poly for springs."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = mm(r)
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new(kind)
    sp.points.add(len(pts_mm) - 1)
    for p, q in zip(sp.points, pts_mm):
        p.co = (*mm(*q), 1.0)
    if kind == "NURBS":
        sp.order_u = 4
        sp.use_endpoint_u = True
        sp.resolution_u = res
    ob = bpy.data.objects.new(name, cu)
    cu.materials.append(mat)
    link(ob)
    return ob


def cable(name, pts_mm, r=3.0, ties=()):
    ob = tube_curve(name, pts_mm, r, MAT["cable"], "NURBS")
    for k, (c, axis) in enumerate(ties):  # cable ties at given points
        torus(f"{name} tie {k}", c, axis, r + 1.2, 1.0, MAT["plastic"], 24, 6)
    return ob


def helix(name, a, b, R, turns, wire, mat):
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    v = d.cross(u)
    n = int(turns * 24)
    pts = [a + (b - a) * (i / n) + (u * math.cos(2 * math.pi * turns * i / n) + v * math.sin(2 * math.pi * turns * i / n)) * R for i in range(n + 1)]
    return tube_curve(name, [tuple(p) for p in pts], wire, mat)


# ============================================================================= MODEL
# Proportions follow real 160 x 40 profile cockpits (see docs/rig3d/REMODEL-PLAN.md): a 660 x 1440 black
# anodised base, side-mounted 160 x 40 wheel uprights, a 120 x 40 wheel deck channel with red side plates,
# a slotted pedal plate low at the front, a reclined GT bucket, and a freestanding triple / quad stand.
RAIL_Y = 310  # side rail centre line: rails 40 wide, 660 mm outer width
LEN = 1440
RZ0, RZ1 = 15, 175  # rails stand on edge, 160 tall, on 15 mm feet
RZ = (RZ0 + RZ1) / 2
UP_X0, UP_X1, UP_TOP = 860, 1020, 820
UP_Y = RAIL_Y + 40  # uprights bolt to the outside of the rails

# ---- chassis --------------------------------------------------------------------
layer("chassis")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Rail {side}", (0, s * RAIL_Y, RZ), (LEN, s * RAIL_Y, RZ), 160, 40, u=(0, 0, 1))
    for x in (30, LEN - 30):
        cylinder(f"Foot {side}{x}", (x, s * RAIL_Y, 0), (x, s * RAIL_Y, RZ0), 22, MAT["rubber"])
    # red dust strips in the upper and lower slots of the outer face
    for zc in (RZ - 40, RZ + 40):
        box(f"Slot strip {side}{zc}", (LEN / 2, s * (RAIL_Y + 20 - 2.2), zc), (LEN - 8, 3.5, 7), MAT["red"], bevel=0.0003)
    # uprights, side-mounted, with corner brackets fore and aft
    profile(f"Upright {side}", ((UP_X0 + UP_X1) / 2, s * UP_Y, RZ0), ((UP_X0 + UP_X1) / 2, s * UP_Y, UP_TOP), 160, 40, u=(1, 0, 0))
    for zc in (300, 500, 700):
        box(f"Upright strip {side}{zc}", ((UP_X0 + UP_X1) / 2, s * (UP_Y + 20 - 2.2), zc), (7, 3.5, 160), MAT["red"], bevel=0.0003)
    for x, dirx in ((UP_X0, -1), (UP_X1, 1)):
        tri = [(0, 0), (190 * dirx, 0), (0, 300)]
        if dirx < 0:
            tri = list(reversed(tri))
        plate(f"Gusset {side}{x}", tri, (x, s * (UP_Y - 20) if s > 0 else s * (UP_Y + 20), RZ0 + 4), (1, 0, 0), (0, 0, 1), -40, MAT["alu"])
    for x in (20, LEN - 20):  # cross members bolt through the rail ends
        for zc in (RZ - 40, RZ + 40):
            bolt(f"Rail bolt {side}{x}{zc}", (x, s * (RAIL_Y + 20), zc), (0, s, 0), r=6)
    for xo in (-40, 40):  # upright foot bolts into the rail slot
        for zc in (RZ0 + 60, RZ0 + 120):
            bolt(f"Upright bolt {side}{xo}{zc}", ((UP_X0 + UP_X1) / 2 + xo, s * (UP_Y + 20), zc), (0, s, 0), r=6)
for x, nm in ((20, "Rear cross"), (LEN - 20, "Front cross")):
    profile(nm, (x, -RAIL_Y + 20, RZ), (x, RAIL_Y - 20, RZ), 160, 40, u=(0, 0, 1))
    for zc in (RZ - 40, RZ + 40):
        box(f"{nm} strip {zc}", (x + (22.2 if x > 700 else -22.2), 0, zc), (3.5, 2 * RAIL_Y - 50, 7), MAT["red"], bevel=0.0003)
for x in (300, 600):
    profile(f"Seat cross {x}", (x, -RAIL_Y + 20, RZ1 - 20), (x, RAIL_Y - 20, RZ1 - 20), 40, 80, u=(0, 0, 1))
# wheel deck: a 120 x 40 channel across the uprights on red anodised side plates
DECK_X, DECK_Z = 940, 780
profile("Wheel deck channel", (DECK_X, -UP_Y + 20, DECK_Z), (DECK_X, UP_Y - 20, DECK_Z), 120, 40, u=(1, 0, 0))
for s, side in [(1, "L"), (-1, "R")]:
    plate(f"Deck side plate {side}", rounded_rect(220, 180, 14), (DECK_X, s * (UP_Y - 20), DECK_Z), (1, 0, 0), (0, 0, 1), 8 * s, MAT["red_anod"])
    for bx, bz in ((-70, -60), (0, -60), (70, -60), (-45, 50), (45, 50)):
        bolt(f"Deck bolt {side}{bx}{bz}", (DECK_X + bx, s * (UP_Y - 28), DECK_Z + bz), (0, -s, 0), r=6.5)
plate("Wheel deck plate", rounded_rect(300, 260, 8), (DECK_X - 20, 0, DECK_Z + 20), (1, 0, 0), (0, 1, 0), 6, MAT["steel"])
for bx in (-125, 125):
    for by in (-105, 105):
        bolt(f"Deck plate bolt {bx}{by}", (DECK_X - 20 + bx, by, DECK_Z + 26), (0, 0, 1), r=5)
# cable run: motor power and USB down the near upright, along the rail to the back, tied off
for k, (r, off) in enumerate(((4.2, 0), (2.6, 11))):
    cable(f"Wheelbase cable {k}", [
        (DECK_X + 80, -30 - off, DECK_Z + 60), (DECK_X + 150, -120 - off, DECK_Z + 10), (UP_X1 + 12, -(UP_Y - 48) - off, DECK_Z - 60),
        (UP_X1 + 12, -(UP_Y - 48) - off, 420), (UP_X1 + 6, -(UP_Y - 48) - off, RZ1 + 30), (UP_X0 - 60, -(RAIL_Y - 30) - off, RZ1 + 8),
        (400, -(RAIL_Y - 30) - off, RZ1 + 6), (90, -(RAIL_Y - 30) - off, RZ1 + 6), (40, -(RAIL_Y - 60) - off, RZ1 - 40), (10, -(RAIL_Y - 90) - off, 60)],
        r=r, ties=[((UP_X1 + 12, -(UP_Y - 48) - 5, z), (0, 0, 1)) for z in (520, 680)] if k == 0 else ())

# Parts drawn under the pedals and the seat (the far side and the front, from the preview camera); the
# rest of the frame is drawn over them (see stack_order.py).
BACK = ["Rail L", "Front cross", "Foot L30", f"Foot L{LEN - 30}", "Upright L", "Gusset L860", "Gusset L1020", "Seat cross 300", "Seat cross 600",
        "Wheel deck channel", "Deck side plate L"]
BACK += [o.name for o in COLL["chassis"].objects if o.name.startswith(("Slot strip L", "Upright strip L", "Front cross strip", "Deck bolt L"))]
for nm in BACK:
    ob = bpy.data.objects[nm]
    COLL["chassis"].objects.unlink(ob)
    COLL["chassis-back"].objects.link(ob)

# ES branding on the frame: lockups on the rear and front crosses, the mark on the near upright,
# the wordmark on the inside of both brand-red deck side plates
layer("chassis")
decal("Brand rear cross", "brand-lockup.png", (0, 0, RZ), (-1, 0, 0), (0, 0, 1), 440)
decal("Brand upright R", "brand-mark.png", ((UP_X0 + UP_X1) / 2, -UP_Y - 20, 690), (0, -1, 0), (0, 0, 1), 110)
decal("Brand deck plate R", "brand-wordmark-white.png", (DECK_X, -(UP_Y - 28), DECK_Z), (0, 1, 0), (0, 0, 1), 170)
layer("chassis-back")
decal("Brand front cross", "brand-lockup.png", (LEN, 0, RZ), (1, 0, 0), (0, 0, 1), 440)
decal("Brand deck plate L", "brand-wordmark-white.png", (DECK_X, UP_Y - 28, DECK_Z), (0, -1, 0), (0, 0, 1), 170)

# ---- wheelbase: generic direct-drive motor on the deck, tilted up toward the driver --------------
layer("wheelbase")
TILT = math.radians(12)
AX = Vector((-math.cos(TILT), 0, math.sin(TILT)))  # from the motor's front toward the driver
MB0 = Vector((DECK_X + 70, 0, DECK_Z + 26 + 78))
MB1 = MB0 + AX * 230
mrot = Matrix.Rotation(-TILT, 4, "Y")
box("Motor body", tuple(MB0 + AX * 115), (230, 140, 140), MAT["motor"], bevel=0.012, rot=mrot)
box("Motor clamp", tuple(MB0 + AX * 115 - Vector((0, 0, 70))), (160, 170, 24), MAT["plastic"], bevel=0.003)
for k in range(8):  # cooling fins on the top
    a = MB0 + AX * (40 + k * 20) + Vector((0, 0, 72))
    box(f"Fin {k}", tuple(a), (6, 120, 8), MAT["motor"], bevel=0.001, rot=mrot)
for k in range(9):  # heatsink fins down both flanks
    for sy in (1, -1):
        a = MB0 + AX * (30 + k * 20) + Vector((0, sy * 72, 8))
        box(f"Side fin {k}{sy}", tuple(a), (5, 8, 100), MAT["motor"], bevel=0.0008, rot=mrot)
box("Motor stripe", tuple(MB0 + AX * 190), (6, 142.5, 142.5), MAT["red"], bevel=0.003, rot=mrot)
cylinder("Motor face", tuple(MB1), tuple(MB1 + AX * 8), 56, MAT["gloss"], segs=64)
cylinder("Shaft hub", tuple(MB1 + AX * 8), tuple(MB1 + AX * 34), 30, MAT["alu_bright"], segs=40)

# ---- wheel: 300 mm round rim, three spokes, quick release, paddles ---------------------
layer("wheel")
WC = MB1 + AX * 80
cylinder("Quick release", tuple(MB1 + AX * 34), tuple(WC - AX * 6), 28, MAT["alu_bright"], segs=40)
cylinder("QR collar", tuple(MB1 + AX * 40), tuple(MB1 + AX * 50), 32, MAT["red_anod"], segs=40)
torus("Rim", tuple(WC), AX, 150, 15.5, add_bump(principled("Grip", (0.012, 0.012, 0.013), 0.0, 0.7, **{"Specular IOR Level": 0.25}), 2500, 0.3), 128, 28)
wu = AX.cross(Vector((0, 0, 1))).normalized()
wv = AX.cross(wu).normalized()
plate("Wheel plate", rounded_rect(200, 110, 26), WC - AX * 4, wu, wv, -8, MAT["carbon"])
plate("Wheel display", rounded_rect(70, 26, 3), WC - AX * 1.0 + wv * 28, wu, wv, -1.5, MAT["lcd"])
for k, sx in enumerate((-70, 70)):  # rotary encoders
    p = WC + wu * sx - wv * 22 - AX * 1
    cylinder(f"Encoder {k}", tuple(p), tuple(p + AX * 9), 9, MAT["alu_bright"], segs=24)
    cylinder(f"Encoder cap {k}", tuple(p + AX * 9), tuple(p + AX * 11), 7, MAT["red_anod"], segs=24)
for ang in (180, 0, 270):
    dvec = wu * math.cos(math.radians(ang)) + wv * math.sin(math.radians(ang))
    side = AX.cross(dvec)
    a = WC + dvec * 50
    b = WC + dvec * 138
    sec = rounded_rect(30, 7, 3, 3)
    extrude(f"Spoke {ang}", [Vector(p) for p in sec], tuple(a), tuple(b), side, MAT["alu_bright"], bevel=0.0005)
for ang, col, rr in ((15, "red", 62), (165, "red", 62), (35, "plastic", 58), (145, "plastic", 58), (-12, "plastic", 64), (192, "plastic", 64),
                     (330, "alu_bright", 50), (210, "alu_bright", 50), (300, "plastic", 40), (240, "plastic", 40)):
    dvec = wu * math.cos(math.radians(ang)) + wv * math.sin(math.radians(ang))
    p = WC + dvec * rr - AX * 1
    cylinder(f"Button {ang}", tuple(p), tuple(p + AX * 6), 6.5, MAT[col], segs=24)
for s in (1, -1):  # paddles behind the rim
    plate(f"Paddle {s}", rounded_rect(36, 90, 10), WC + wu * (s * 95) + AX * 10, wu, wv, -3, MAT["alu_bright"])

# ---- pedals: slotted plate low at the front, 18 deg, heel rest, three pedals ---------------------
layer("pedals")
PA = math.radians(18)
PU = Vector((math.cos(PA), 0, math.sin(PA)))  # up the plate, toward the front
PN = Vector((-math.sin(PA), 0, math.cos(PA)))  # plate normal, toward the driver
P0 = Vector((1000, 0, 120))
plate("Pedal plate", [(y, x + 210) for (y, x) in rounded_rect(560, 420, 10)], P0, (0, 1, 0), PU, -6, MAT["steel"])
for k, yy in enumerate((-180, -90, 90, 180)):  # mounting slots
    box(f"Plate slot {k}", tuple(P0 + PU * 230 + Vector((0, yy, 0)) + PN * 0.6), (300, 9, 1), MAT["gloss"], bevel=0, rot=Matrix.Rotation(-PA, 4, "Y"))
plate("Heel rest", rounded_rect(560, 70, 8), P0 + PU * 4, (0, 1, 0), PN, 6, MAT["steel"])
decal("Brand heel rest", "brand-lockup.png", tuple(P0 + PU * 3.2 + PN * 36), tuple(-PU), tuple(PN), 250)
for s in (1, -1):  # side brackets from the plate to the rails
    plate(f"Pedal bracket {s}", [(0, 0), (420, 0), (420, 150), (0, 40)], (1000, s * (RAIL_Y - 26), 60), (1, 0, 0), (0, 0, 1), 6 * s, MAT["steel"])


def pedal(name, y, arm, face_h, red):
    base = P0 + PU * 150 + Vector((0, y, 0))
    box(f"{name} base", tuple(base + PU * 60 + PN * 14), (150, 62, 28), MAT["plastic"], rot=Matrix.Rotation(-PA, 4, "Y"))
    pivot = base + PU * 18 + PN * 30
    tip = pivot + PU * (arm * 0.42) + PN * (arm * 0.9)
    d = (tip - pivot).normalized()
    extrude(f"{name} arm", [Vector(p) for p in rounded_rect(20, 14, 3, 3)], tuple(pivot), tuple(tip), (0, 1, 0), MAT["alu_bright"], bevel=0.0004)
    plate(f"{name} face", rounded_rect(80, face_h, 12), tip - d * (face_h * 0.55), (0, 1, 0), d, 8, MAT["alu_bright"])
    for k in (-1, 1):
        bolt(f"{name} base bolt {k}", tuple(base + PU * (60 + 55 * k) + PN * 28 + Vector((0, 22, 0))), tuple(PN), r=4, h=2.5)
    if not red:  # coil spring from the base to the arm (load-cell brake uses elastomers instead)
        a = base + PU * 118 + PN * 28
        b = pivot + d * (arm * 0.5)
        helix(f"{name} spring", tuple(a), tuple(b), 13, 7, 2.0, MAT["spring"])
        cylinder(f"{name} spring rod", tuple(a), tuple(b), 5, MAT["alu_bright"], segs=16)
    if red:
        a = base + PU * 125 + PN * 30
        b = pivot + d * (arm * 0.52)
        for k in range(4):
            t0 = a + (b - a) * (k / 4.0)
            t1 = a + (b - a) * ((k + 0.8) / 4.0)
            cylinder(f"{name} elastomer {k}", tuple(t0), tuple(t1), 16, MAT["red"], segs=32)


pedal("Clutch", 125, 230, 105, False)
pedal("Brake", 0, 235, 115, True)
pedal("Throttle", -125, 255, 160, False)
cable("Pedal cable", [tuple(P0 + PU * 150 + PN * 20 + Vector((0, -190, 0))), tuple(P0 + PU * 60 + PN * 10 + Vector((0, -240, 0))),
                      (990, -(RAIL_Y - 30), RZ1 + 6), (600, -(RAIL_Y - 45), RZ1 + 6), (60, -(RAIL_Y - 45), RZ1 + 6), (15, -(RAIL_Y - 80), 70)], r=2.6)

# ---- side mount, shifter, handbrake (driver's right, beside the cushion) -----------------------
layer("sidemount")
SM_X = 700
SM_Y = -RAIL_Y - 150
profile("Side arm", (SM_X, -RAIL_Y - 20, RZ + 20), (SM_X, -RAIL_Y - 260, RZ + 20), 80, 40, u=(0, 0, 1))
profile("Side post", (SM_X, SM_Y, RZ + 60), (SM_X, SM_Y, 470), 40, 40, u=(1, 0, 0))
box("Side bracket", (SM_X - 10, SM_Y, 495), (220, 150, 50), MAT["steel"], bevel=0.003)
layer("shifter")
box("Shifter body", (SM_X + 40, SM_Y, 545), (90, 60, 50), MAT["plastic"])
cylinder("Shifter boot", (SM_X + 40, SM_Y, 570), (SM_X + 40, SM_Y, 584), 18, MAT["rubber"])
cylinder("Shifter lever", (SM_X + 40, SM_Y, 584), (SM_X + 25, SM_Y, 690), 6.5, MAT["alu_bright"], segs=24)
cylinder("Shifter knob", (SM_X + 24, SM_Y, 688), (SM_X + 22, SM_Y, 730), 21, MAT["gloss"], segs=40)
cylinder("Knob ring", (SM_X + 24, SM_Y, 698), (SM_X + 24, SM_Y, 706), 21.6, MAT["red_anod"], segs=40)
layer("handbrake")
box("Handbrake body", (SM_X - 60, SM_Y, 560), (80, 50, 80), MAT["plastic"])
cylinder("Handbrake lever", (SM_X - 60, SM_Y, 580), (SM_X - 130, SM_Y, 780), 9, MAT["alu_bright"], segs=24)
cylinder("Handbrake grip", (SM_X - 124, SM_Y, 762), (SM_X - 150, SM_Y, 840), 17, MAT["rubber"], segs=32)
cylinder("Handbrake cap", (SM_X - 150, SM_Y, 840), (SM_X - 152, SM_Y, 850), 17.5, MAT["red_anod"], segs=32)

# ---- GT bucket seat on brackets and a slider, reclined 25 deg ---------------------------------
layer("seat")
for s in (1, -1):
    box(f"Slider rail {s}", (460, s * 160, RZ1 + 13), (440, 34, 26), MAT["alu_bright"])
    plate(f"Seat bracket {s}", [(0, 0), (330, 0), (300, 150), (40, 170)], (300, s * 268, RZ1 + 26), (1, 0, 0), (0, 0, 1), 6 * s, MAT["steel"])
box("Slider bar", (640, 0, RZ1 + 18), (30, 300, 12), MAT["alu_bright"])


def lerp_table(tab, s):
    for (s0, v0), (s1, v1) in zip(tab, tab[1:]):
        if s0 <= s <= s1:
            t = (s - s0) / (s1 - s0)
            t = t * t * (3 - 2 * t)
            return v0 + (v1 - v0) * t
    return tab[-1][1]


# sitting-surface centre line (x, z) from the cushion front, down into the seat and up the reclined back
CENTRE = [(690, 350), (610, 318), (500, 292), (410, 284), (350, 305), (318, 400), (275, 520), (220, 660), (165, 800), (110, 930), (62, 1050)]
HALF_W = [(0, 250), (0.25, 255), (0.45, 255), (0.62, 272), (0.8, 262), (0.88, 175), (0.94, 180), (1.0, 165)]
BOLSTER = [(0, 80), (0.2, 105), (0.42, 95), (0.55, 150), (0.75, 130), (0.86, 75), (0.93, 60), (1.0, 50)]


def centre(s):
    L = [0]
    for a, b in zip(CENTRE, CENTRE[1:]):
        L.append(L[-1] + math.dist(a, b))
    target = s * L[-1]
    for i in range(len(CENTRE) - 1):
        if L[i] <= target <= L[i + 1]:
            t = (target - L[i]) / (L[i + 1] - L[i])
            a, b = Vector(CENTRE[i]), Vector(CENTRE[i + 1])
            p0 = Vector(CENTRE[max(i - 1, 0)])
            p3 = Vector(CENTRE[min(i + 2, len(CENTRE) - 1)])
            t2, t3 = t * t, t * t * t
            return 0.5 * ((2 * a) + (-p0 + b) * t + (2 * p0 - 5 * a + 4 * b - p3) * t2 + (-p0 + 3 * a - 3 * b + p3) * t3)
    return Vector(CENTRE[-1])


NS, NT = 48, 28
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new("UVMap")
grid = []
for i in range(NS + 1):
    s = i / NS
    c = centre(s)
    c2 = centre(min(1, s + 0.01)) if s < 1 else c
    c1 = centre(max(0, s - 0.01))
    tan = (c2 - c1).normalized()
    nrm = Vector((tan.y, -tan.x))
    if nrm.y < 0 and s < 0.3:
        nrm = -nrm
    if s >= 0.3 and nrm.x < 0:
        nrm = -nrm
    hw = lerp_table(HALF_W, s)
    bh = lerp_table(BOLSTER, s)
    row = []
    for j in range(NT + 1):
        t = -1 + 2 * j / NT
        at = abs(t)
        rise = 0.0 if at < 0.55 else ((at - 0.55) / 0.4) ** 1.6
        rise = min(rise, 1.0)
        if at > 0.95:
            rise = 1.0 - ((at - 0.95) / 0.05) ** 2 * 0.35
        y = t * hw * (1.0 - 0.06 * rise)
        off = bh * rise
        pt2 = c + nrm * off
        row.append((bm.verts.new(mm(pt2.x, y, pt2.y)), (t, s)))
    grid.append(row)
for i in range(NS):
    for j in range(NT):
        f = bm.faces.new((grid[i][j][0], grid[i][j + 1][0], grid[i + 1][j + 1][0], grid[i + 1][j][0]))
        for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
            loop[uv_layer].uv = grid[ii][jj][1]
seat = mesh_obj("Seat shell", bm, MAT["seat"])
seat.data.materials.append(MAT["shell"])
for p in seat.data.polygons:
    p.use_smooth = True
sol = seat.modifiers.new("Shell", "SOLIDIFY")
sol.thickness = -0.036
sol.offset = 1
sol.material_offset = 1
sol.material_offset_rim = 1
sol.use_even_offset = False
sol.use_quality_normals = True
sub = seat.modifiers.new("Smooth", "SUBSURF")
sub.levels = 2
sub.render_levels = 2
for i, (y, sv, w, h) in enumerate([(-85, 0.86, 34, 75), (85, 0.86, 34, 75)]):
    c = centre(sv)
    cut = box(f"Slot cutter {i}", (c.x - 10, y, c.y), (220, w, h), MAT["plastic"], bevel=0)
    cut.hide_render = True
    cut.display_type = "WIRE"
    cut.hide_viewport = True
    b = seat.modifiers.new(f"Slot {i}", "BOOLEAN")
    b.object = cut
    b.operation = "DIFFERENCE"

_c = centre(0.8)
_c2, _c1 = centre(0.81), centre(0.79)
_t = (_c2 - _c1).normalized()
_n = Vector((_t.y, -_t.x))
if _n.x < 0:
    _n = -_n
_back = _c - _n * 90
decal("Brand seat back", "brand-mark.png", (_back.x, 0, _back.y), (-_n.x, 0, -_n.y), (_t.x, 0, _t.y), 150, kind="stitch", segs=14, wrap_to=seat)
_f = centre(0.9) + Vector((_n.x, _n.y)) * 60
decal("Brand seat headrest", "brand-mark.png", (_f.x, 0, _f.y), (_n.x, 0, _n.y), (_t.x, 0, _t.y), 90, kind="stitch", segs=10, wrap_to=seat)

# red piping along the crest of both side bolsters and round the headrest, laid on the finished shell
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
_ev = seat.evaluated_get(_dg)
_tree = BVHTree.FromObject(_ev, _dg)
for _side in (1, -1):
    _path = []
    for _i in range(2, NS - 1):
        _s = _i / NS
        _c = centre(_s)
        _c2, _c1 = centre(min(1, _s + 0.01)), centre(max(0, _s - 0.01))
        _tn = (_c2 - _c1).normalized()
        _nr = Vector((_tn.y, -_tn.x))
        if (_nr.y < 0 and _s < 0.3) or (_s >= 0.3 and _nr.x < 0):
            _nr = -_nr
        _hw = lerp_table(HALF_W, _s)
        _bh = lerp_table(BOLSTER, _s)
        _q = _c + _nr * (_bh * 0.97 + 60)
        _origin = Vector((_q.x, _side * _hw * 0.84, _q.y)) / 1000.0
        _dirn = Vector((-_nr.x, 0, -_nr.y))
        _hit = _tree.ray_cast(_origin, _dirn, 0.5)
        if _hit[0] is not None:
            _path.append(tuple((_hit[0] + _hit[1] * 0.0025) * 1000.0))
    if len(_path) > 4:
        tube_curve(f"Seat piping {_side}", _path, 2.4, MAT["red"], "NURBS", res=8)

# ---- VR headset on the headrest ---------------------------------------------------------
layer("headset")
hc = centre(1.0) + Vector((50, 60))
box("Visor", (hc.x + 35, 0, hc.y), (95, 175, 92), MAT["gloss"], bevel=0.02)
box("Face pad", (hc.x - 18, 0, hc.y), (22, 160, 80), MAT["rubber"], bevel=0.008)
torus("Strap", (hc.x - 40, 0, hc.y + 8), (0, 0.25, 1), 88, 9, MAT["plastic"], 64, 12)
box("Visor stripe", (hc.x + 83, 0, hc.y - 20), (2, 120, 4), MAT["red"], bevel=0.0005)

# ---- PC tower beside the seat (driver's left) -------------------------------------------
layer("pc")
PCY = RAIL_Y + 330
PCX = 650
box("Case", (PCX, PCY, 245), (470, 220, 490), MAT["plastic"], bevel=0.004)
box("Glass", (PCX, PCY - 112, 250), (440, 4, 450), MAT["pc_glass"], bevel=0.001)
box("GPU", (PCX, PCY - 40, 220), (300, 60, 120), MAT["steel"])
box("GPU glow", (PCX, PCY - 72, 168), (300, 2, 4), MAT["glow"], bevel=0)
cylinder("CPU cooler", (PCX + 60, PCY - 20, 360), (PCX + 60, PCY - 90, 360), 55, MAT["plastic"])
torus("Fan ring", (PCX + 60, PCY - 92, 360), (0, 1, 0), 52, 3, MAT["glow"], 64, 8)
for z in (100, 230, 360):
    torus(f"Rear fan {z}", (PCX - 236, PCY, z), (1, 0, 0), 55, 2.5, MAT["glow"], 64, 8)
decal("Brand PC", "brand-mark.png", (PCX - 235, PCY, 452), (-1, 0, 0), (0, 0, 1), 52)
for i in range(4):
    cylinder(f"PC foot {i}", (PCX - 200 + 400 * (i % 2), PCY - 90 + 180 * (i // 2), 0), (PCX - 200 + 400 * (i % 2), PCY - 90 + 180 * (i // 2), 10), 14, MAT["rubber"])

# ---- motion: four corner actuators bolted outboard of the rails (modelled in the raised pose) -----
layer("motion")
LZ = MOTION_LIFT * 1000
for x in (110, LEN - 110):
    for s in (1, -1):
        layer("motion-back" if s > 0 else "motion")  # the far-side pair draws behind the frame
        y = s * (RAIL_Y + 20 + 85)
        box(f"Actuator bracket {x}{s}", (x, s * (RAIL_Y + 20 + 10), RZ + LZ), (190, 20, 150), MAT["steel"], bevel=0.002)
        box(f"Actuator body {x}{s}", (x, y, RZ + LZ + 40), (170, 130, 300), MAT["plastic"], bevel=0.008)
        for k in range(5):  # vents on the outer face
            box(f"Actuator vent {x}{s}{k}", (x, y + s * 65.5, RZ + LZ + 100 + k * 18), (110, 1.5, 6), MAT["gloss"], bevel=0)
        box(f"Actuator band {x}{s}", (x, y + s * 65.6, RZ + LZ - 60), (170, 1.5, 10), MAT["red"], bevel=0)
        bottom = RZ + LZ + 40 - 150
        cylinder(f"Actuator piston {x}{s}", (x, y, 22), (x, y, bottom), 42, MAT["gloss"], segs=40)
        cylinder(f"Actuator foot {x}{s}", (x, y, 0), (x, y, 22), 62, MAT["silver"], segs=48)
layer("motion-back")
box("Motion controller", (720, 0, 40), (260, 220, 80), MAT["plastic"], bevel=0.004)

# ---- freestanding display stand and curved screens -------------------------------------------
ST_X = 1520      # stand posts
ST_Y = 600
BAR_Z = 1040     # crossbar centre
SB = 840         # screen bottom
SW, SH = 720, 420
SIDE = math.radians(55)
CX = 1400        # chord line of the centre screen
layer("mount")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Stand foot {side}", (1180, s * ST_Y, 20), (1780, s * ST_Y, 20), 40, 80, u=(0, 0, 1))
    for x in (1190, 1770):
        cylinder(f"Stand foot pad {side}{x}", (x, s * ST_Y, 0), (x, s * ST_Y, 4), 22, MAT["rubber"])
    profile(f"Stand post {side}", (ST_X, s * ST_Y, 40), (ST_X, s * ST_Y, BAR_Z + 40), 40, 80, u=(1, 0, 0))
profile("Stand crossbar", (ST_X - 40, -ST_Y - 40, BAR_Z), (ST_X - 40, ST_Y + 40, BAR_Z), 80, 40, u=(0, 0, 1))
profile("Stand lower bar", (ST_X, -ST_Y + 40, 140), (ST_X, ST_Y - 40, 140), 80, 40, u=(0, 0, 1))
decal("Brand stand", "brand-lockup.png", (ST_X - 20, 0, 140), (-1, 0, 0), (0, 0, 1), 380)
layer("mount-top")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Top post {side}", (ST_X - 40, s * 340, BAR_Z + 40), (ST_X - 40, s * 340, 1760), 40, 40, u=(1, 0, 0))
profile("Top crossbar", (ST_X - 80, -360, 1640), (ST_X - 80, 360, 1640), 80, 40, u=(0, 0, 1))
layer("mount-sides")
for s, side in [(1, "L"), (-1, "R")]:
    d = Vector((-math.sin(SIDE), s * math.cos(SIDE), 0))
    behind = Vector((math.cos(SIDE), s * math.sin(SIDE), 0))  # away from the driver, square to the screen
    h = Vector((CX, s * (SW / 2 + 4), BAR_Z)) + behind * 95 + d * 40
    profile(f"Side arm {side}", tuple(h), tuple(h + d * 520), 40, 40, u=(0, 0, 1))
    box(f"Side hinge {side}", tuple(h), (60, 60, 90), MAT["alu"], bevel=0.003)

R_CURVE = 1000
BEZEL = 7


def curved_monitor(name, p0, p1, bottom, height=SH, screen=None, tilt=0.0):
    """Curved panel (1000R, concave toward the driver) between chord ends p0 -> p1 (driver's left -> right).
    tilt (deg) leans the top toward the driver about the panel's horizontal centre line."""
    p0, p1 = Vector(p0), Vector(p1)
    chord = p1 - p0
    c = chord.length
    along = chord.normalized()
    facing = along.cross(Vector((0, 0, 1))).normalized()  # toward the driver
    mid = (p0 + p1) / 2
    phi = math.asin(c / 2 / R_CURVE)
    N = 48
    made = []

    def at(t, inset=0.0):
        a = -phi + 2 * phi * t
        back = R_CURVE * math.cos(a) - R_CURVE * math.cos(phi)
        n = (facing * math.cos(a) - along * math.sin(a)).normalized()
        p = mid + along * (R_CURVE * math.sin(a)) - facing * back + n * inset
        return Vector((p.x, p.y, bottom)), n

    def strip(nm, t0, t1, z0, z1, inset, depth, mat, uv=False):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap") if uv else None
        rows = []
        for i in range(N + 1):
            t = t0 + (t1 - t0) * i / N
            p, n = at(t, inset)
            rows.append((p, n, (i / N)))
        front, back = [], []
        for p, n, _ in rows:
            front.append((bm.verts.new(mm(p.x, p.y, z0)), bm.verts.new(mm(p.x, p.y, z1))))
            if depth:
                q = p - n * depth
                back.append((bm.verts.new(mm(q.x, q.y, z0)), bm.verts.new(mm(q.x, q.y, z1))))
        for i in range(N):
            f = bm.faces.new((front[i][0], front[i + 1][0], front[i + 1][1], front[i][1]))
            if uvl:
                u0, u1 = rows[i][2], rows[i + 1][2]
                for loop, uvv in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
                    loop[uvl].uv = uvv
            if depth:
                bm.faces.new((back[i][1], back[i + 1][1], back[i + 1][0], back[i][0]))
                bm.faces.new((front[i][1], front[i + 1][1], back[i + 1][1], back[i][1]))
                bm.faces.new((back[i][0], back[i + 1][0], front[i + 1][0], front[i][0]))
        if depth:
            for k in (0, N):
                bm.faces.new((front[k][0], front[k][1], back[k][1], back[k][0]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ob = mesh_obj(nm, bm, mat, bevel=0.001 if depth else None)
        for p in ob.data.polygons:
            p.use_smooth = True
        made.append(ob)
        return ob

    strip(f"{name} body", 0, 1, bottom, bottom + height, 0, 16, MAT["gloss"])
    e = BEZEL / c
    strip(f"{name} panel", e, 1 - e, bottom + BEZEL, bottom + height - BEZEL, 0.6, 0, screen or screen_material(PANO, 1 / 3, 2 / 3), uv=True)
    back_c, _ = at(0.5)
    hub = back_c - facing * 16
    made.append(box(f"{name} housing", (hub.x - facing.x * 30, hub.y - facing.y * 30, bottom + height * 0.5), (60, 240, 200), MAT["plastic"], bevel=0.012,
                    rot=Matrix.Rotation(math.atan2(along.y, along.x) + math.pi / 2, 4, "Z")))
    if tilt:
        pivot = mm(mid.x, mid.y, bottom + height / 2)
        M = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-tilt), 4, "Y") @ Matrix.Translation(-pivot)
        for ob in made:
            ob.data.transform(M)


layer("screen-center")
curved_monitor("Centre screen", (CX, SW / 2, 0), (CX, -SW / 2, 0), SB)
layer("screen-sides")
for s, side in [(1, "L"), (-1, "R")]:
    d = Vector((-math.sin(SIDE), s * math.cos(SIDE), 0))
    hinge = Vector((CX, s * (SW / 2 + 4), 0))
    outer = hinge + d * SW
    if s > 0:
        curved_monitor(f"Side screen {side}", outer, hinge, SB, screen=screen_material(PANO, 0, 1 / 3))
    else:
        curved_monitor(f"Side screen {side}", hinge, outer, SB, screen=screen_material(PANO, 2 / 3, 1))
layer("screen-dual")
DUAL = math.radians(22)
for s, side in [(1, "L"), (-1, "R")]:
    d = Vector((-math.sin(DUAL), s * math.cos(DUAL), 0))
    seam = Vector((CX, s * 4, 0))
    outer = seam + d * SW
    if s > 0:
        curved_monitor(f"Dual screen {side}", outer, seam, SB, screen=screen_material(PANO, 1 / 6, 1 / 2))
    else:
        curved_monitor(f"Dual screen {side}", seam, outer, SB, screen=screen_material(PANO, 1 / 2, 5 / 6))
layer("screen-top")
# a distinct, smaller panel on its own posts, centred over the centre screen and tilted down at the driver
curved_monitor("Top screen", (CX + 20, 300, 0), (CX + 20, -300, 0), SB + SH + 28, 350, screen=screen_material(TOP), tilt=15)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
for im in bpy.data.images:  # pack the brand and screen art; CC0 textures stay in the gitignored cache
    if im.filepath and "cache" not in im.filepath and not im.packed_file:
        im.pack()
    elif im.filepath and "cache" in im.filepath:
        im.filepath = bpy.path.relpath(im.filepath, start=os.path.dirname(OUT))
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("saved", OUT, sum(len(c.objects) for c in COLL.values()), "objects")

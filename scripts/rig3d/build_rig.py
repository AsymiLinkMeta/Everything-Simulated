"""
Builds assets/rig3d/rig.blend: a generic (unbranded) aluminium-profile sim rig for the
rig builder preview. Units are metres; the model is laid out in millimetres via mm().

    blender -b --factory-startup -P scripts/rig3d/build_rig.py

Axes: +X forward (the driver faces +X), +Y the driver's left, +Z up. Every part lives in a
collection named after its preview layer (see LAYERS); rig parts hang off the "RigLift"
empty so the motion layer can raise the whole frame by MOTION_LIFT.
Proportions follow common 1350-1440 x 580-660 mm profile cockpits (e.g. Sim-Lab P1X Pro,
Trak Racer TR160): 160x40 side rails, 120x40 wheel uprights, a 300 mm wheel.
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
MOTION_LIFT = 0.15


def mm(*v):
    return Vector([x / 1000.0 for x in v]) if len(v) > 1 else v[0] / 1000.0


# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

LAYERS = [
    "chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals", "sidemount", "shifter", "handbrake", "pc", "motion",
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


MAT = {
    # titanium-grey anodised extrusion, faint brushed variation
    "alu": add_bump(principled("Anodised aluminium", (0.20, 0.21, 0.23), 1.0, 0.33, **{"Anisotropic": 0.4}), 900, 0.08),
    "alu_bright": principled("Machined aluminium", (0.62, 0.63, 0.65), 1.0, 0.22),
    "steel": add_bump(principled("Black powder coat", (0.025, 0.026, 0.03), 0.0, 0.55), 2500, 0.15),
    "plastic": principled("Satin black plastic", (0.02, 0.02, 0.022), 0.0, 0.42),
    "gloss": principled("Gloss black", (0.012, 0.012, 0.014), 0.0, 0.12, **{"Coat Weight": 1.0}),
    "rubber": add_bump(principled("Rubber", (0.012, 0.012, 0.013), 0.0, 0.75), 1800, 0.25),
    "red": principled("Red accent", (0.62, 0.008, 0.004), 0.0, 0.32, **{"Coat Weight": 0.6}),
    "red_anod": principled("Red anodised", (0.55, 0.01, 0.008), 1.0, 0.3),
    "motor": principled("Motor housing", (0.05, 0.052, 0.058), 0.9, 0.28),
}


def seat_material():
    m = bpy.data.materials.new("Seat fabric and leather")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.014, 0.014, 0.016, 1)
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    # |u| > 0.62 is the leather bolster, inside is the quilted fabric insert
    absu = nt.nodes.new("ShaderNodeMath"); absu.operation = "ABSOLUTE"
    nt.links.new(sep.outputs["X"], absu.inputs[0])
    mask = nt.nodes.new("ShaderNodeMath"); mask.operation = "GREATER_THAN"; mask.inputs[1].default_value = 0.62
    nt.links.new(absu.outputs[0], mask.inputs[0])
    rough = nt.nodes.new("ShaderNodeMix"); rough.data_type = "FLOAT"
    rough.inputs["A"].default_value = 0.85
    rough.inputs["B"].default_value = 0.5
    nt.links.new(mask.outputs[0], rough.inputs["Factor"])
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    b.inputs["Sheen Weight"].default_value = 0.6
    # red stitching just inside the bolster seam
    band = nt.nodes.new("ShaderNodeMath"); band.operation = "COMPARE"
    band.inputs[1].default_value = 0.585; band.inputs[2].default_value = 0.006
    nt.links.new(absu.outputs[0], band.inputs[0])
    dash = nt.nodes.new("ShaderNodeMath"); dash.operation = "SINE"
    vs = nt.nodes.new("ShaderNodeMath"); vs.operation = "MULTIPLY"; vs.inputs[1].default_value = 900
    nt.links.new(sep.outputs["Y"], vs.inputs[0]); nt.links.new(vs.outputs[0], dash.inputs[0])
    dpos = nt.nodes.new("ShaderNodeMath"); dpos.operation = "GREATER_THAN"; dpos.inputs[1].default_value = 0.0
    nt.links.new(dash.outputs[0], dpos.inputs[0])
    stitch = nt.nodes.new("ShaderNodeMath"); stitch.operation = "MULTIPLY"
    nt.links.new(band.outputs[0], stitch.inputs[0]); nt.links.new(dpos.outputs[0], stitch.inputs[1])
    col = nt.nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
    col.inputs["A"].default_value = (0.014, 0.014, 0.016, 1)
    col.inputs["B"].default_value = (0.6, 0.01, 0.005, 1)
    nt.links.new(stitch.outputs[0], col.inputs["Factor"])
    nt.links.new(col.outputs["Result"], b.inputs["Base Color"])
    # quilted channels on the insert, grain on the leather
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.inputs["Scale"].default_value = 14
    wave.wave_type = "BANDS"; wave.bands_direction = "Y"
    nt.links.new(uv.outputs["UV"], wave.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 1500
    hm = nt.nodes.new("ShaderNodeMix"); hm.data_type = "FLOAT"
    nt.links.new(mask.outputs[0], hm.inputs["Factor"])
    nt.links.new(wave.outputs["Fac"], hm.inputs["A"]); nt.links.new(noise.outputs["Fac"], hm.inputs["B"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.003
    nt.links.new(hm.outputs["Result"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


MAT["seat"] = seat_material()
MAT["shell"] = principled("Seat shell", (0.012, 0.012, 0.014), 0.0, 0.32, **{"Coat Weight": 0.5, "Coat Roughness": 0.25})


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
    b.inputs["Roughness"].default_value = 0.08
    b.inputs["Coat Weight"].default_value = 0.3
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
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 2.2
    SCREEN_IMG[key] = m
    return m


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


def profile(name, p0, p1, w, h, u=(0, 0, 1), mat=None):
    """T-slot extrusion w (along u) x h (along d x u) mm."""
    return extrude(name, section_with_slots(w, h), p0, p1, u, mat or MAT["alu"])


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


# ============================================================================= MODEL
RAIL_Y = 270  # side rail centre line: a 580 mm wide frame

# ---- chassis --------------------------------------------------------------------
layer("chassis")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Rail {side}", (0, s * RAIL_Y, 102), (1400, s * RAIL_Y, 102), 160, 40, u=(0, 0, 1))
    for x in (40, 1360):
        cylinder(f"Foot {side}{x}", (x, s * RAIL_Y, 0), (x, s * RAIL_Y, 22), 24, MAT["rubber"])
    # red slot covers in the middle grooves of the outer face (a common profile-rig accent)
    for zc in (82, 122):
        box(f"Slot strip {side}{zc}", (700, s * (RAIL_Y + 20 - 2.2), zc), (1396, 3.5, 7), MAT["red"], bevel=0.0003)
profile("Rear cross", (20, -RAIL_Y + 20, 62), (20, RAIL_Y - 20, 62), 80, 40, u=(0, 0, 1))
profile("Front cross", (1380, -RAIL_Y + 20, 62), (1380, RAIL_Y - 20, 62), 80, 40, u=(0, 0, 1))
for x in (270, 580):
    profile(f"Seat cross {x}", (x, -RAIL_Y + 20, 162), (x, RAIL_Y - 20, 162), 40, 40, u=(0, 0, 1))
UP_X0, UP_X1, UP_TOP = 880, 1000, 760
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Upright {side}", ((UP_X0 + UP_X1) / 2, s * RAIL_Y, 182), ((UP_X0 + UP_X1) / 2, s * RAIL_Y, UP_TOP), 120, 40, u=(1, 0, 0))
    for x, dirx in ((UP_X0, -1), (UP_X1, 1)):
        tri = [(0, 0), (130 * dirx, 0), (0, 130)]
        if dirx < 0:
            tri = list(reversed(tri))
        plate(f"Gusset {side}{x}", tri, (x, s * RAIL_Y - 16, 182), (1, 0, 0), (0, 0, 1), 32, MAT["alu"])
# front-mount cross bar across the tops of the uprights (keeps the pedals in view below it)
profile("Wheel deck beam", (UP_X0 + 20, -RAIL_Y + 20, UP_TOP - 30), (UP_X0 + 20, RAIL_Y - 20, UP_TOP - 30), 40, 60, u=(1, 0, 0))

# Frame parts the pedals sit in front of (from the preview camera) go to their own layer, drawn
# under the pedals; the rest of the frame is drawn over them (see stack_order.py).
for nm in ("Rail L", "Front cross", "Foot L1360", "Slot strip L82", "Slot strip L122", "Seat cross 270", "Seat cross 580", "Upright L", "Gusset L880"):
    ob = bpy.data.objects[nm]
    COLL["chassis"].objects.unlink(ob)
    COLL["chassis-back"].objects.link(ob)

# ---- wheelbase on a front mount ------------------------------------------------------
layer("wheelbase")
TILT = math.radians(14)
AX = Vector((-math.cos(TILT), 0, -math.sin(TILT)))  # from the mount toward the driver
PLATE = Vector((UP_X0 - 4, 0, 690))
plate("Front mount plate", rounded_rect(190, 200, 10), PLATE + Vector((0, 0, -10)), (0, 1, 0), (0, 0, 1), 10, MAT["steel"])
MB0 = PLATE + AX * 2
MB1 = PLATE + AX * 215
box("Motor flange", tuple(MB0 + AX * 9), (18, 160, 160), MAT["plastic"], rot=Matrix.Rotation(TILT, 4, "Y"))
cylinder("Motor body", tuple(MB0 + AX * 18), tuple(MB1), 74, MAT["motor"], segs=64)
for k in range(10):  # cooling ribs
    a = MB0 + AX * (40 + k * 14)
    cylinder(f"Rib {k}", tuple(a), tuple(a + AX * 5), 76.5, MAT["motor"], segs=64)
cylinder("Motor ring", tuple(MB0 + AX * 192), tuple(MB0 + AX * 204), 75.5, MAT["red"], segs=64)
cylinder("Motor cap", tuple(MB1), tuple(MB1 + AX * 6), 66, MAT["gloss"], segs=64)
cylinder("Shaft hub", tuple(MB1 + AX * 6), tuple(MB1 + AX * 30), 32, MAT["alu_bright"], segs=40)

# ---- wheel: 300 mm round rim, three spokes, quick release, paddles ---------------------
layer("wheel")
WC = MB1 + AX * 72
cylinder("Quick release", tuple(MB1 + AX * 30), tuple(WC - AX * 6), 30, MAT["alu_bright"], segs=40)
cylinder("QR collar", tuple(MB1 + AX * 38), tuple(MB1 + AX * 48), 34, MAT["red_anod"], segs=40)
torus("Rim", tuple(WC), AX, 150, 15.5, add_bump(principled("Grip", (0.015, 0.015, 0.016), 0.0, 0.62), 2500, 0.3), 128, 28)
wu = AX.cross(Vector((0, 0, 1))).normalized()
wv = AX.cross(wu).normalized()
plate("Wheel plate", rounded_rect(120, 80, 22), WC - AX * 4, wu, wv, -8, MAT["gloss"])
for ang in (180, 0, 270):
    dvec = wu * math.cos(math.radians(ang)) + wv * math.sin(math.radians(ang))
    side = AX.cross(dvec)
    a = WC + dvec * 48
    b = WC + dvec * 138
    sec = rounded_rect(30, 7, 3, 3)
    extrude(f"Spoke {ang}", [Vector(p) for p in sec], tuple(a), tuple(b), side, MAT["alu_bright"], bevel=0.0005)
for ang, col in ((30, "red"), (150, "red"), (60, "plastic"), (120, "plastic"), (300, "alu_bright"), (240, "alu_bright")):
    dvec = wu * math.cos(math.radians(ang)) + wv * math.sin(math.radians(ang))
    p = WC + dvec * 36 - AX * 1
    cylinder(f"Button {ang}", tuple(p), tuple(p + AX * 6), 6.5, MAT[col], segs=24)
for s in (1, -1):  # paddles behind the rim
    plate(f"Paddle {s}", rounded_rect(36, 90, 10), WC + wu * (s * 95) + AX * 10 - wv * 0, wu, wv, -3, MAT["alu_bright"])

# ---- pedal deck with three pedals ---------------------------------------------------------
layer("pedals")
PA = math.radians(36)
PU = Vector((math.cos(PA), 0, math.sin(PA)))  # up the deck, toward the front
PN = Vector((-math.sin(PA), 0, math.cos(PA)))  # deck normal, toward the driver
P0 = Vector((1110, 0, 200))
deck_out = rounded_rect(440, 330, 12)
plate("Pedal deck", [(y, x + 165) for (y, x) in deck_out], P0, (0, 1, 0), PU, -6, MAT["steel"])
profile("Deck bar", (1100, -RAIL_Y + 20, 162), (1100, RAIL_Y - 20, 162), 40, 40, u=(0, 0, 1), mat=MAT["alu"])
for s in (1, -1):
    profile(f"Deck post {s}", (1340, s * 150, 182), (1340, s * 150, 392), 30, 30, u=(1, 0, 0), mat=MAT["alu"])


def pedal(name, y, arm, face_h, red):
    base = P0 + PU * 40 + Vector((0, y, 0))
    box(f"{name} base", tuple(base + PU * 60 + PN * 14), (120, 56, 28), MAT["plastic"], rot=Matrix.Rotation(-PA, 4, "Y"))
    pivot = base + PU * 18 + PN * 30
    tip = pivot + PU * (arm * 0.55) + PN * (arm * 0.83)
    d = (tip - pivot).normalized()
    extrude(f"{name} arm", [Vector(p) for p in rounded_rect(18, 14, 3, 3)], tuple(pivot), tuple(tip), (0, 1, 0), MAT["alu_bright"], bevel=0.0004)
    n = d.cross(Vector((0, 1, 0))).normalized()
    plate(f"{name} face", rounded_rect(78, face_h, 12), tip - d * (face_h * 0.55), (0, 1, 0), d, 8, MAT["alu_bright"])
    if red:
        a = base + PU * 115 + PN * 30
        b = pivot + d * (arm * 0.52)
        for k in range(4):
            t0 = a + (b - a) * (k / 4.0)
            t1 = a + (b - a) * ((k + 0.8) / 4.0)
            cylinder(f"{name} elastomer {k}", tuple(t0), tuple(t1), 15, MAT["red"], segs=32)
    return n


pedal("Clutch", 135, 220, 100, False)
pedal("Brake", 0, 225, 110, True)
pedal("Throttle", -128, 250, 150, False)

# ---- side mount, shifter, handbrake (driver's right) -----------------------------------------
layer("sidemount")
SM_Y = -RAIL_Y - 100
profile("Side arm", (620, -RAIL_Y - 20, 140), (620, SM_Y - 20, 140), 40, 40, u=(0, 0, 1))
profile("Side post", (620, SM_Y, 160), (620, SM_Y, 470), 40, 40, u=(1, 0, 0))
plate("Side plate", rounded_rect(200, 90, 8), (610, SM_Y, 470), (1, 0, 0), (0, 1, 0), 8, MAT["steel"])
layer("shifter")
box("Shifter body", (655, SM_Y, 505), (90, 60, 62), MAT["plastic"])
cylinder("Shifter boot", (655, SM_Y, 536), (655, SM_Y, 552), 18, MAT["rubber"])
cylinder("Shifter lever", (655, SM_Y, 552), (640, SM_Y, 690), 6.5, MAT["alu_bright"], segs=24)
cylinder("Shifter knob", (639, SM_Y, 688), (637, SM_Y, 730), 21, MAT["gloss"], segs=40)
cylinder("Knob ring", (639, SM_Y, 698), (639, SM_Y, 706), 21.6, MAT["red_anod"], segs=40)
layer("handbrake")
box("Handbrake body", (560, SM_Y, 515), (80, 50, 80), MAT["plastic"])
cylinder("Handbrake lever", (560, SM_Y, 540), (470, SM_Y, 800), 9, MAT["alu_bright"], segs=24)
cylinder("Handbrake grip", (478, SM_Y, 778), (452, SM_Y, 860), 17, MAT["rubber"], segs=32)
cylinder("Handbrake cap", (452, SM_Y, 860), (450, SM_Y, 870), 17.5, MAT["red_anod"], segs=32)

# ---- bucket seat on a slider -------------------------------------------------------------
layer("seat")
for s in (1, -1):
    box(f"Slider rail {s}", (430, s * 170, 197), (460, 34, 26), MAT["alu_bright"])
    plate(f"Seat bracket {s}", [(0, 0), (280, 0), (250, 120), (30, 120)], (290, s * 262, 205), (1, 0, 0), (0, 0, 1), 6 * s, MAT["steel"])
box("Slider bar", (585, 0, 200), (30, 300, 12), MAT["alu_bright"])


def lerp_table(tab, s):
    for (s0, v0), (s1, v1) in zip(tab, tab[1:]):
        if s0 <= s <= s1:
            t = (s - s0) / (s1 - s0)
            t = t * t * (3 - 2 * t)
            return v0 + (v1 - v0) * t
    return tab[-1][1]


# sitting-surface centre line (x, z) from the cushion front, down into the seat and up the back
CENTRE = [(650, 335), (560, 300), (430, 268), (320, 262), (255, 300), (215, 430), (180, 600), (150, 760), (128, 880), (115, 1000)]
HALF_W = [(0, 235), (0.25, 245), (0.45, 245), (0.62, 262), (0.8, 250), (0.88, 160), (0.94, 165), (1.0, 150)]
BOLSTER = [(0, 70), (0.2, 95), (0.42, 85), (0.55, 140), (0.75, 120), (0.86, 70), (0.93, 55), (1.0, 45)]


def centre(s):
    L = [0]
    for a, b in zip(CENTRE, CENTRE[1:]):
        L.append(L[-1] + math.dist(a, b))
    target = s * L[-1]
    for i in range(len(CENTRE) - 1):
        if L[i] <= target <= L[i + 1]:
            t = (target - L[i]) / (L[i + 1] - L[i])
            a, b = Vector(CENTRE[i]), Vector(CENTRE[i + 1])
            # Catmull-Rom for a smooth line
            p0 = Vector(CENTRE[max(i - 1, 0)])
            p3 = Vector(CENTRE[min(i + 2, len(CENTRE) - 1)])
            t2, t3 = t * t, t * t * t
            return 0.5 * ((2 * a) + (-p0 + b) * t + (2 * p0 - 5 * a + 4 * b - p3) * t2 + (-p0 + 3 * a - 3 * b + p3) * t3)
    return Vector(CENTRE[-1])


NS, NT = 44, 28
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new("UVMap")
grid = []
for i in range(NS + 1):
    s = i / NS
    c = centre(s)
    c2 = centre(min(1, s + 0.01)) if s < 1 else c
    c1 = centre(max(0, s - 0.01))
    tan = (c2 - c1).normalized()
    nrm = Vector((tan.y, -tan.x))  # toward the occupant (up / forward)
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
        # U-shaped section: flat insert, rising bolster, rolled outer edge
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
sol.thickness = -0.032
sol.offset = 1
sol.material_offset = 1
sol.material_offset_rim = 1
sol.use_even_offset = True
sub = seat.modifiers.new("Smooth", "SUBSURF")
sub.levels = 2
sub.render_levels = 2
# harness slots through the back, and a hip slot
cutter_mat = MAT["plastic"]
for i, (y, z, w, h) in enumerate([(-80, 860, 32, 70), (80, 860, 32, 70)]):
    c = centre(0.85)
    cut = box(f"Slot cutter {i}", (c.x - 10, y, z), (200, w, h), cutter_mat, bevel=0)
    cut.hide_render = True
    cut.display_type = "WIRE"
    cut.hide_viewport = True
    b = seat.modifiers.new(f"Slot {i}", "BOOLEAN")
    b.object = cut
    b.operation = "DIFFERENCE"

# ---- VR headset on the headrest ---------------------------------------------------------
layer("headset")
hc = centre(1.0) + Vector((40, 70))
box("Visor", (hc.x + 35, 0, hc.y), (95, 175, 92), MAT["gloss"], bevel=0.02)
box("Face pad", (hc.x - 18, 0, hc.y), (22, 160, 80), MAT["rubber"], bevel=0.008)
torus("Strap", (hc.x - 40, 0, hc.y + 8), (0, 0.25, 1), 88, 9, MAT["plastic"], 64, 12)
box("Visor stripe", (hc.x + 83, 0, hc.y - 20), (2, 120, 4), MAT["red"], bevel=0.0005)

# ---- PC tower beside the seat (driver's left) -------------------------------------------
layer("pc")
PCY = RAIL_Y + 300
box("Case", (300, PCY, 245), (470, 220, 490), MAT["plastic"], bevel=0.004)
box("Glass", (300, PCY - 112, 250), (440, 4, 450), MAT["pc_glass"], bevel=0.001)
box("GPU", (300, PCY - 40, 220), (300, 60, 120), MAT["steel"])
box("GPU glow", (300, PCY - 72, 168), (300, 2, 4), MAT["glow"], bevel=0)
cylinder("CPU cooler", (360, PCY - 20, 360), (360, PCY - 90, 360), 55, MAT["plastic"])
torus("Fan ring", (360, PCY - 92, 360), (0, 1, 0), 52, 3, MAT["glow"], 64, 8)
for z in (120, 260, 400):
    torus(f"Rear fan {z}", (64, PCY, z), (1, 0, 0), 55, 2.5, MAT["glow"], 64, 8)
for i in range(4):
    cylinder(f"PC foot {i}", (100 + 400 * (i % 2), PCY - 90 + 180 * (i // 2), 0), (100 + 400 * (i % 2), PCY - 90 + 180 * (i // 2), 10), 14, MAT["rubber"])

# ---- motion actuators (under the frame when it is raised) ----------------------------------
layer("motion")
# four corner actuators, sized like common 3-4 DOF platforms (about 200 mm across), with a top
# plate under each frame corner; their tops meet the raised frame
for x in (90, 1310):
    for s in (1, -1):
        base = Vector((x, s * (RAIL_Y + 30), 0))
        top = 22 + MOTION_LIFT * 1000 - 4
        cylinder(f"Actuator pad {x}{s}", tuple(base), tuple(base + Vector((0, 0, 20))), 110, MAT["rubber"], segs=48)
        cylinder(f"Actuator {x}{s}", tuple(base + Vector((0, 0, 20))), tuple(base + Vector((0, 0, top - 46))), 92, MAT["motor"], segs=48)
        for k, zc in enumerate((48, 70, 92)):
            cylinder(f"Actuator rib {x}{s}{k}", tuple(base + Vector((0, 0, zc))), tuple(base + Vector((0, 0, zc + 5))), 94.5, MAT["motor"], segs=48)
        cylinder(f"Actuator band {x}{s}", tuple(base + Vector((0, 0, top - 70))), tuple(base + Vector((0, 0, top - 56))), 94, MAT["red"], segs=48)
        cylinder(f"Actuator rod {x}{s}", tuple(base + Vector((0, 0, top - 46))), tuple(base + Vector((0, 0, top - 12))), 40, MAT["alu_bright"], segs=32)
        box(f"Actuator top plate {x}{s}", tuple(base + Vector((0, -s * 30, top - 6))), (190, 200, 12), MAT["steel"], bevel=0.002)
        box(f"Actuator glow {x}{s}", tuple(base + Vector((-60 if x < 700 else 60, 0, 34))), (4, 60, 6), MAT["glow"], bevel=0)
box("Motion controller", (720, 0, 40), (260, 220, 80), MAT["plastic"], bevel=0.004)

# ---- display stand and curved screens ----------------------------------------------------
SX = 1760
SB = 820
SW = 720
SH = 420
SIDE = math.radians(58)
layer("mount")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Stand foot {side}", (1520, s * 310, 20), (1990, s * 310, 20), 40, 40, u=(0, 0, 1))
    profile(f"Stand upright {side}", (SX + 60, s * 310, 40), (SX + 60, s * 310, 1270), 40, 40, u=(1, 0, 0))
    for zc in (0,):
        cylinder(f"Stand foot pad {side}", (1530, s * 310, 0), (1530, s * 310, 6), 18, MAT["rubber"])
profile("Stand crossbar", (SX + 60, -380, 1000), (SX + 60, 380, 1000), 40, 40, u=(0, 0, 1))
profile("Stand lower bar", (SX + 60, -290, 60), (SX + 60, 290, 60), 40, 40, u=(0, 0, 1))
layer("mount-top")
for s, side in [(1, "L"), (-1, "R")]:
    profile(f"Top extension {side}", (SX + 60, s * 310, 1270), (SX + 60, s * 310, 1700), 40, 40, u=(1, 0, 0))
profile("Top crossbar", (SX + 60, -330, 1440), (SX + 60, 330, 1440), 40, 40, u=(0, 0, 1))
layer("mount-sides")
for s, side in [(1, "L"), (-1, "R")]:
    h = Vector((SX + 60, s * 380, 1000))
    d = Vector((-math.sin(SIDE), s * math.cos(SIDE), 0))
    profile(f"Side arm {side}", tuple(h), tuple(h + d * 520), 40, 40, u=(0, 0, 1))

R_CURVE = 1200
BEZEL = 7
CX = SX - 60


def curved_monitor(name, p0, p1, bottom, height=SH, screen=None):
    """Curved panel (1200R, concave toward the driver) between chord ends p0 -> p1 (driver's left -> right)."""
    p0, p1 = Vector(p0), Vector(p1)
    chord = p1 - p0
    c = chord.length
    along = chord.normalized()
    facing = along.cross(Vector((0, 0, 1))).normalized()  # toward the driver
    mid = (p0 + p1) / 2
    phi = math.asin(c / 2 / R_CURVE)
    N = 48

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
        return ob

    strip(f"{name} body", 0, 1, bottom, bottom + height, 0, 18, MAT["plastic"])
    e = BEZEL / c
    strip(f"{name} panel", e, 1 - e, bottom + BEZEL, bottom + height - BEZEL, 0.6, 0, screen or screen_material(PANO, 1 / 3, 2 / 3), uv=True)
    back_c, _ = at(0.5)
    hub = back_c - facing * 18
    box(f"{name} housing", (hub.x - facing.x * 22, hub.y - facing.y * 22, bottom + height * 0.5), (44, 210, 170), MAT["plastic"], bevel=0.008,
        rot=Matrix.Rotation(math.atan2(along.y, along.x) + math.pi / 2, 4, "Z"))


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
curved_monitor("Top screen", (CX, 305, 0), (CX, -305, 0), 1268, 350, screen=screen_material(TOP))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("saved", OUT, sum(len(c.objects) for c in COLL.values()), "objects")

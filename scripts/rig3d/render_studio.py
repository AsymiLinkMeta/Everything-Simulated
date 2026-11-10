"""
Marketing studio renders for the site (home hero, prebuild galleries, category heroes, fallbacks).

Same model as the builder preview (assets/rig3d/rig.blend, built by build_rig.py), lit as a dark
product studio: a near-black sweep, a soft overhead pool of light, long strip lights that draw edges
down the black extrusions and a low rim behind the rig for separation. Each shot names the parts it
shows, the camera (azimuth / elevation round the subject), the frame aspect and where in the frame the
subject should sit (so the home hero leaves room for the headline).

    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_studio.py -- --out /workspace/es-redesign/renders
    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_studio.py -- --only hero-wide --samples 32 --width 960

Resumable: a finished PNG is skipped unless --force. scripts/rig3d/pack_studio.py turns the PNGs into
AVIF/WebP sizes for upload to Supabase Storage (site-media bucket).
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="/tmp/studio")
ap.add_argument("--samples", type=int, default=192)
ap.add_argument("--width", type=int, default=0, help="override every shot's width (quick tests)")
ap.add_argument("--only", default="")
ap.add_argument("--force", action="store_true")
ap.add_argument("--list", action="store_true")
ap.add_argument("--real", action="store_true", help="close-up material pass (realism.py) and product framing")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "rig3d", "cache"))
scene = bpy.context.scene
COLL = {c.name: c for c in bpy.data.collections}
LIFT = bpy.data.objects["RigLift"]
MOTION_LIFT = 0.07


def mm(*v):
    return Vector([x / 1000.0 for x in v])


CORE = ["chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals"]
MOTION = ["motion", "motion-back"]
TRIPLE = ["mount", "mount-sides", "screen-center", "screen-sides"]
QUAD = TRIPLE + ["mount-top", "screen-top"]
STARTER = CORE + TRIPLE + ["shifter", "handbrake", "sidemount", "pc"]
HAPTIC = CORE + QUAD + ["shifter", "pc", "headset"]
MOTIONRIG = CORE + QUAD + MOTION + ["shifter", "pc"]

# region = (x0, x1, y0, y1) of the frame the subject should fill (0..1, y up)
CENTER = (0.05, 0.95, 0.06, 0.94)
SHOTS = {}


def shot(name, layers, az, el, aspect, width, region=CENTER, lifted=False, fit=None, dof=4.0, dist=7.4, hide=()):
    SHOTS[name] = dict(layers=layers, az=az, el=el, aspect=aspect, width=width, region=region,
                       lifted=lifted, fit=fit or layers, dof=dof, dist=dist, hide=tuple(hide))


# home hero: full motion rig with the triple + top screen, sitting right of the headline
shot("hero-wide", MOTIONRIG, 28, 9, 9 / 16, 2400, region=(0.36, 0.99, 0.03, 0.95), lifted=True, dist=8.5)
shot("hero-tall", MOTIONRIG, 28, 10, 5 / 4, 1200, region=(0.04, 0.96, 0.03, 0.62), lifted=True, dist=8.5)
# prebuilds: four angles each (rear three-quarter both sides, profile, high)
for slug, layers, lifted in (("starter", STARTER, False), ("haptic", HAPTIC, False), ("motion", MOTIONRIG, True)):
    shot(f"prebuild-{slug}-1", layers, 30, 12, 3 / 4, 1800, lifted=lifted)
    shot(f"prebuild-{slug}-2", layers, -34, 10, 3 / 4, 1800, lifted=lifted)
    shot(f"prebuild-{slug}-3", layers, 64, 7, 3 / 4, 1800, lifted=lifted)
    shot(f"prebuild-{slug}-4", layers, 18, 34, 3 / 4, 1800, lifted=lifted)
# category heroes (wide) and the same parts as square product fallbacks
CATS = {
    "chassis": ["chassis", "chassis-back"],
    "seat": ["chassis-back", "chassis", "seat"],
    "wheel": ["chassis-back", "chassis", "wheelbase", "wheel"],
    "pedals": ["chassis-back", "chassis", "pedals"],
    "screens": QUAD,
    "motion": CORE + MOTION,
    # Shown bolted to the cockpit: on its own the side mount's arm hung in the air above the floor.
    "shifter": ["chassis-back", "chassis", "seat", "sidemount", "shifter", "handbrake"],
    "pc": ["pc"],
}
# What the camera frames, when it isn't every layer shown (the rest runs out of frame as context).
CAT_FIT = {"shifter": ["sidemount", "shifter", "handbrake"], "seat": ["seat"], "wheel": ["wheelbase", "wheel"], "pedals": ["pedals"]}
CAT_VIEW = {"chassis": (32, 16), "seat": (38, 12), "wheel": (40, 8), "pedals": (20, 38), "screens": (24, 8),
            "motion": (30, 10), "shifter": (58, 16), "pc": (35, 12)}
for k, layers in CATS.items():
    az, el = CAT_VIEW[k]
    fit = CAT_FIT.get(k)
    ctx = k in CAT_FIT  # leave room round a framed sub-assembly so the rig it's bolted to reads
    shot(f"cat-{k}", layers, az, el, 9 / 16, 1800, region=(0.42, 0.86, 0.14, 0.86) if ctx else (0.30, 0.94, 0.08, 0.92), lifted=k == "motion", dof=2.8, hide=("Pedal cable",), fit=fit)
    # square product art: the whole part with breathing room on every side; a deeper focus at --real
    shot(f"part-{k}", layers, az, el, 1.0, 1200,
         region=(0.24, 0.76, 0.2, 0.8) if ctx else (0.15, 0.85, 0.16, 0.84) if args.real else (0.10, 0.90, 0.12, 0.88),
         lifted=k == "motion", dof=6.3 if args.real else 2.8, hide=("Pedal cable",), fit=fit)
shot("plate", [], 30, 12, 9 / 16, 1600, fit=CORE)

if args.real:
    sys.path.insert(0, HERE)
    import realism  # noqa: E402

    realism.apply()



def detail_side_mount():
    """Render-time finish for the shifter/handbrake close-ups (rig.blend is untouched): softened
    edges on the blocky bodies, black anodised bracket with cap screws, and an H-pattern gate."""
    def mat(name, base, metal, rough, coat=0.0):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*base, 1)
        b.inputs["Metallic"].default_value = metal
        b.inputs["Roughness"].default_value = rough
        b.inputs["Coat Weight"].default_value = coat
        return m
    # Same finish as the extrusions they bolt to (dark diffuse materials read grey under the key).
    anod = bpy.data.materials.get("Black anodised aluminium") or mat("ES anodised black", (0.012, 0.012, 0.014), 1.0, 0.35)
    body = mat("ES graphite body", (0.02, 0.02, 0.022), 0.85, 0.3, coat=0.4)
    screw = mat("ES cap screw", (0.55, 0.56, 0.58), 1.0, 0.22)
    for name, m in (("Side bracket", anod), ("Shifter body", body), ("Handbrake body", body)):
        ob = bpy.data.objects.get(name)
        if not ob:
            continue
        ob.data.materials.clear()
        ob.data.materials.append(m)
        if not any(md.type == "BEVEL" for md in ob.modifiers):
            bv = ob.modifiers.new("Soft edges", "BEVEL")
            bv.width = 0.004
            bv.segments = 4
            bv.limit_method = "ANGLE"
        for p in ob.data.polygons:
            p.use_smooth = True
        if hasattr(ob.data, "set_sharp_from_angle"):
            ob.data.set_sharp_from_angle(angle=math.radians(40))
    br = bpy.data.objects.get("Side bracket")
    sh = bpy.data.objects.get("Shifter body")
    if br and not bpy.data.objects.get("Bracket screw 0"):
        lo = Vector(min((br.matrix_world @ v.co for v in br.data.vertices), key=lambda q: q.x + q.y))
        hi = Vector(max((br.matrix_world @ v.co for v in br.data.vertices), key=lambda q: q.x + q.y))
        top = max((br.matrix_world @ v.co).z for v in br.data.vertices)
        coll = br.users_collection[0]
        for i, (fx, fy) in enumerate(((0.07, 0.1), (0.93, 0.1), (0.07, 0.9), (0.93, 0.9))):
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0055, depth=0.004,
                                                location=(lo.x + (hi.x - lo.x) * fx, lo.y + (hi.y - lo.y) * fy, top + 0.002))
            ob = bpy.context.active_object
            ob.name = f"Bracket screw {i}"
            ob.data.materials.append(screw)
            for c in ob.users_collection:
                c.objects.unlink(ob)
            coll.objects.link(ob)
    if sh and not bpy.data.objects.get("Shifter gate"):
        top = max((sh.matrix_world @ v.co).z for v in sh.data.vertices)
        cx = sum((sh.matrix_world @ v.co).x for v in sh.data.vertices) / len(sh.data.vertices)
        cy = sum((sh.matrix_world @ v.co).y for v in sh.data.vertices) / len(sh.data.vertices)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, top + 0.0015))
        gate = bpy.context.active_object
        gate.name = "Shifter gate"
        gate.scale = (0.084, 0.054, 0.003)
        bpy.ops.object.transform_apply(scale=True)
        gate.data.materials.append(anod)
        bv = gate.modifiers.new("Soft edges", "BEVEL")
        bv.width = 0.0012
        bv.segments = 3
        # H-pattern slots cut into the gate plate
        slots = [((cx, cy, top + 0.0015), (0.006, 0.040, 0.01))] + [((cx + dx, cy, top + 0.0015), (0.006, 0.040, 0.01)) for dx in (-0.024, 0.024)]
        slots.append(((cx, cy, top + 0.0015), (0.054, 0.006, 0.01)))
        for loc, dims in slots:
            bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
            cut = bpy.context.active_object
            cut.scale = dims
            cut.hide_render = True
            cut.name = "Slot cutter gate"
            bo = gate.modifiers.new("Slot", "BOOLEAN")
            bo.operation = "DIFFERENCE"
            bo.object = cut
        for c in gate.users_collection:
            c.objects.unlink(gate)
        sh.users_collection[0].objects.link(gate)
    bpy.context.view_layer.update()


if any(n.endswith("-shifter") for n in (args.only.split(",") if args.only else SHOTS)):
    detail_side_mount()

if args.list:
    print("\n".join(SHOTS))
    sys.exit(0)

# ----------------------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new("Camera")
cam_data.sensor_width = 36
cam_data.sensor_fit = "AUTO"
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def hidden(ob, hide):
    return ob.name.startswith("Slot cutter") or any(ob.name.startswith(h) for h in hide)


def mesh_points(layers, lifted, hide=()):
    LIFT.location.z = MOTION_LIFT if lifted else 0.0
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for n in layers:
        for ob in COLL[n].objects:
            if ob.type not in ("MESH", "CURVE") or hidden(ob, hide):
                continue
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            mw = ev.matrix_world
            step = max(1, len(me.vertices) // 4000)
            pts += [mw @ me.vertices[i].co for i in range(0, len(me.vertices), step)]
            ev.to_mesh_clear()
    return pts


def place_camera(s):
    from bpy_extras.object_utils import world_to_camera_view
    pts = mesh_points(s["fit"], s["lifted"], s["hide"])
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    target = (lo + hi) / 2
    size = (hi - lo).length
    az, el = math.radians(s["az"]), math.radians(s["el"])
    view = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), -math.sin(el)))
    cam.location = target - view * max(s["dist"], size * 2.6)
    cam.rotation_euler = view.to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 85
    cam_data.shift_x = cam_data.shift_y = 0.0
    bpy.context.view_layer.update()
    xs, ys = [], []
    for p in pts:
        co = world_to_camera_view(scene, cam, p)
        xs.append(co.x); ys.append(co.y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    rx0, rx1, ry0, ry1 = s["region"]
    k = max((x1 - x0) / (rx1 - rx0), (y1 - y0) / (ry1 - ry0))
    cam_data.lens /= k
    ox, oy = (x0 + x1) / 2, (y0 + y1) / 2
    cx, cy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
    asp = s["aspect"]
    # shift is in units of the larger sensor side
    unit_x = 1.0 if asp <= 1 else 1 / asp
    unit_y = asp if asp <= 1 else 1.0
    cam_data.shift_x = (0.5 + (ox - 0.5) / k - cx) * unit_x
    cam_data.shift_y = (0.5 + (oy - 0.5) / k - cy) * unit_y
    cam_data.dof.use_dof = s["dof"] > 0
    cam_data.dof.focus_distance = (target - cam.location).dot(view)
    cam_data.dof.aperture_fstop = s["dof"] or 8
    return target, view


# ----------------------------------------------------------------------------- studio
STUDIO = []


def area(name, loc, size, energy, color=(1, 1, 1), size_y=None, target=None, spread=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = color
    ld.shape = "RECTANGLE"
    ld.size = size
    ld.size_y = size_y or size
    if spread:
        ld.spread = math.radians(spread)
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = False
    STUDIO.append(ob)
    return ob


def build_studio(target, view, scale):
    for ob in STUDIO:
        bpy.data.objects.remove(ob, do_unlink=True)
    STUDIO.clear()
    H = Vector((view.x, view.y, 0)).normalized()
    SIDE = Vector((-H.y, H.x, 0))
    C = Vector((target.x, target.y, 0))
    t = target
    s = scale
    area("Key", C - H * 3.0 * s + SIDE * 2.4 * s + Vector((0, 0, 3.2 * s)), 2.2 * s, 900 * s * s, (1.0, 0.98, 0.95), 1.4 * s, t)
    area("Fill", C - H * 3.6 * s - SIDE * 2.8 * s + Vector((0, 0, 1.6 * s)), 3.0 * s, 70 * s * s, (0.95, 0.97, 1.0), 2.0 * s, t)
    area("Top", C + Vector((0, 0, 3.4 * s)), 2.6 * s, 520 * s * s, size_y=1.8 * s, target=C, spread=50)
    area("Strip L", C + H * 1.0 * s + SIDE * 2.4 * s + Vector((0, 0, 1.3 * s)), 0.3 * s, 700 * s * s, (0.92, 0.95, 1.0), 2.6 * s, t)
    area("Strip R", C + H * 0.6 * s - SIDE * 2.6 * s + Vector((0, 0, 1.3 * s)), 0.3 * s, 700 * s * s, (0.92, 0.95, 1.0), 2.6 * s, t)
    # a low warm rim from behind, and a soft glow on the wall behind the subject for separation
    area("Rim", C + H * 2.6 * s + Vector((0, 0, 0.5 * s)), 2.2 * s, 120 * s * s, (1.0, 0.93, 0.88), 0.5 * s, t)
    area("Wall", C + H * 1.2 * s + Vector((0, 0, 0.2 * s)), 2.0 * s, 90 * s * s, (0.85, 0.88, 0.95), 2.0 * s,
         C + H * 6.0 * s + Vector((0, 0, 1.6 * s)))


world = bpy.data.worlds.new("Studio HDRI")
world.use_nodes = True
wn = world.node_tree
env = wn.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(CACHE, "studio_small_09_2k.hdr"), check_existing=True)
wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
wn.nodes["Background"].inputs["Strength"].default_value = 0.12
scene.world = world

CYC = []


def build_cyc(target, view, scale):
    for ob in CYC:
        bpy.data.objects.remove(ob, do_unlink=True)
    CYC.clear()
    H = Vector((view.x, view.y, 0)).normalized()
    SIDE = Vector((-H.y, H.x, 0))
    C = Vector((target.x, target.y, 0))
    back, R = 3.8 * scale, 2.2 * scale
    bm = bmesh.new()
    prof = [(-16.0 * scale + i * (16.0 * scale + back - R) / 24, 0.0) for i in range(25)]
    for i in range(1, 17):
        a = math.radians(90 * i / 16)
        prof.append((back - R + R * math.sin(a), R - R * math.cos(a)))
    for i in range(1, 9):
        prof.append((back, R + i * 1.2 * scale))
    rows = [[bm.verts.new(C + H * d + SIDE * w + Vector((0, 0, z))) for d, z in prof] for w in (-16.0 * scale, 16.0 * scale)]
    for k in range(len(prof) - 1):
        bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Cyclorama")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Cyclorama", me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    if sum(p.normal.z for p in me.polygons) < 0:
        me.flip_normals()
    cm = bpy.data.materials.get("Studio black") or bpy.data.materials.new("Studio black")
    cm.use_nodes = True
    cb = cm.node_tree.nodes["Principled BSDF"]
    cb.inputs["Base Color"].default_value = (0.0032, 0.0034, 0.0038, 1)
    cb.inputs["Roughness"].default_value = 0.92
    cb.inputs["Specular IOR Level"].default_value = 0.12
    me.materials.append(cm)
    CYC.append(ob)


r = scene.render
r.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.01
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
scene.cycles.max_bounces = 10
scene.cycles.glossy_bounces = 6
scene.cycles.transmission_bounces = 6
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 0.5
r.resolution_percentage = 100
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.image_settings.color_depth = "8"
r.film_transparent = False
r.use_border = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"
scene.view_settings.exposure = 0.0
scene.use_nodes = False


def show(layers, lifted, hide=()):
    for name, c in COLL.items():
        c.hide_render = name not in layers
        for ob in c.objects:
            ob.hide_render = hidden(ob, hide)
            ob.is_holdout = False
    LIFT.location.z = MOTION_LIFT if lifted else 0.0


only = set(filter(None, args.only.split(",")))
for name, s in SHOTS.items():
    if only and name not in only:
        continue
    path = os.path.join(args.out, f"{name}.png")
    if os.path.exists(path) and not args.force:
        print("skip", path, flush=True)
        continue
    w = args.width or s["width"]
    r.resolution_x = w
    r.resolution_y = round(w * s["aspect"])
    target, view = place_camera(s)
    pts = mesh_points(s["fit"], s["lifted"], s["hide"])
    span = max((max(p[i] for p in pts) - min(p[i] for p in pts)) for i in range(3))
    scale = max(0.45, min(1.0, span / 2.4))
    build_studio(target, view, scale)
    build_cyc(target, view, scale)
    show(s["layers"], s["lifted"], s["hide"])
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)
print("studio done", flush=True)

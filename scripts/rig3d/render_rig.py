"""
Renders the rig builder preview from assets/rig3d/rig.blend (built by build_rig.py) as studio product
photos: the rig on a charcoal cyclorama, lit by softboxes and a CC0 studio HDRI, with true contact
shadows and a soft floor reflection.

    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode frames --out /tmp/rig
    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode overlays --out /tmp/rig
    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode frame --key s4m1 --width 900 --samples 64

frames    one opaque full-frame photo per visually distinct build (FRAMES): every screen layout
          (none, stand only, 1, 2, 3, 3 + top) on the floor and on the motion platform. The core
          cockpit (frame, seat, wheelbase, wheel, pedals) is in all of them, rendered together, so
          every contact shadow, occlusion and reflection between parts is real.
overlays  the small add-ons (PC, side mount, shifter, handbrake, VR headset) as transparent layers,
          with everything else in the scene as an invisible holdout (so they tuck correctly behind
          the cockpit) and their own floor shadow from a shadow catcher; raised variants for the
          ones that ride the motion platform.
scripts/rig3d/pack_frames.py turns the PNGs into WebP and writes the manifest the app reads.
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
ap.add_argument("--mode", default="frame")
ap.add_argument("--key", default="s4m1")
ap.add_argument("--out", default="/tmp/rig")
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--width", type=int, default=1800)  # 2x the 900 px asset, downscaled when packing
ap.add_argument("--only", default="")
ap.add_argument("--force", action="store_true", help="re-render outputs that already exist")
ap.add_argument("--az", type=float, default=30)
ap.add_argument("--el", type=float, default=14)
ap.add_argument("--dist", type=float, default=7.4)
ap.add_argument("--dof", type=int, default=1)
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "rig3d", "cache"))
scene = bpy.context.scene
COLL = {c.name: c for c in bpy.data.collections}
LIFT = bpy.data.objects["RigLift"]
MOTION_LIFT = 0.07
ASPECT = 0.82  # height / width of the preview frame

CORE = ["chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals"]
MOTION = ["motion", "motion-back"]
SCREENS = {
    "s0": [],
    "st": ["mount"],
    "s1": ["mount", "screen-center"],
    "s2": ["mount", "screen-dual"],
    "s3": ["mount", "mount-sides", "screen-center", "screen-sides"],
    "s4": ["mount", "mount-sides", "screen-center", "screen-sides", "mount-top", "screen-top"],
}
FRAMES = {f"{k}m{m}": CORE + v + (MOTION if m else []) for k, v in SCREENS.items() for m in (0, 1)}
OVERLAYS = ["pc", "sidemount", "shifter", "handbrake", "headset"]
RIDES = {"sidemount", "shifter", "handbrake", "headset"}  # bolted to the frame: raised on motion


def mm(*v):
    return Vector([x / 1000.0 for x in v])


# ----------------------------------------------------------------------------- camera
TARGET = mm(950, 0, 820)
AZ, EL = math.radians(args.az), math.radians(args.el)
VIEW = Vector((math.cos(AZ) * math.cos(EL), math.sin(AZ) * math.cos(EL), -math.sin(EL)))  # camera -> target
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 85
cam_data.sensor_width = 36
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam.location = TARGET - VIEW * args.dist
cam.rotation_euler = VIEW.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
MARGIN = 0.04


def fit_camera():
    """Keep the view direction; pick the focal length and lens shift so the largest build (raised,
    quad screens, every add-on) just fits the frame. Every frame shares this camera."""
    from bpy_extras.object_utils import world_to_camera_view
    LIFT.location.z = MOTION_LIFT
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for c in COLL.values():
        if c.name == "screen-dual":
            continue
        for ob in c.objects:
            if ob.type not in ("MESH", "CURVE") or ob.hide_render:
                continue
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            for v in me.vertices:
                co = world_to_camera_view(scene, cam, ev.matrix_world @ v.co)
                xs.append(co.x); ys.append(co.y)
            ev.to_mesh_clear()
    LIFT.location.z = 0.0
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    k = max((x1 - x0) / (1 - 2 * MARGIN), (y1 - y0) / (1 - 2 * MARGIN))
    cam_data.lens /= k
    cam_data.shift_x = ((x0 + x1) / 2 - 0.5) / k
    cam_data.shift_y = ((y0 + y1) / 2 - 0.5) / k * ASPECT
    print(f"fit: lens {cam_data.lens:.1f} mm shift {cam_data.shift_x:.3f},{cam_data.shift_y:.3f}", flush=True)


# ----------------------------------------------------------------------------- studio
def area(name, loc, size, energy, color=(1, 1, 1), size_y=None, target=TARGET, spread=None):
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
    return ob


H = Vector((VIEW.x, VIEW.y, 0)).normalized()   # horizontal view direction
SIDE = Vector((-H.y, H.x, 0))                  # to the camera's left
C = Vector((TARGET.x, TARGET.y, 0))
# big soft key high over the camera's left shoulder, fill low on the right, broad top softbox,
# and long strip lights behind both sides that draw bright edges down the black extrusions
area("Key", C - H * 3.2 + SIDE * 2.6 + Vector((0, 0, 3.4)), 2.4, 1100, (1.0, 0.98, 0.95), size_y=1.6)
area("Fill", C - H * 3.6 - SIDE * 2.8 + Vector((0, 0, 1.8)), 3.0, 220, (0.95, 0.97, 1.0), size_y=2.0)
area("Top", C + Vector((0, 0, 3.6)), 3.0, 450, size_y=2.0, spread=60)
area("Strip L", C + H * 1.0 + SIDE * 2.6 + Vector((0, 0, 1.4)), 0.35, 520, (0.92, 0.95, 1.0), size_y=2.8)
area("Strip R", C + H * 0.6 - SIDE * 2.8 + Vector((0, 0, 1.4)), 0.35, 520, (0.92, 0.95, 1.0), size_y=2.8)
area("Kicker", C + H * 2.4 + Vector((0, 0, 0.6)), 2.0, 50, (1.0, 0.96, 0.92), size_y=0.6, target=TARGET + Vector((0, 0, -0.5)))

world = bpy.data.worlds.new("Studio HDRI")
world.use_nodes = True
wn = world.node_tree
env = wn.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(CACHE, "studio_small_09_2k.hdr"), check_existing=True)
wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
wn.nodes["Background"].inputs["Strength"].default_value = 0.35
scene.world = world

# seamless charcoal cyclorama: floor sweeping up into a back wall behind the rig
CYC_BACK = 3.6      # wall distance beyond the target, along the view
R = 2.2             # cove radius
bm = bmesh.new()
prof = []
for i in range(0, 25):
    prof.append((-14.0 + i * (14.0 + CYC_BACK - R) / 24, 0.0))
for i in range(1, 17):
    a = math.radians(90 * i / 16)
    prof.append((CYC_BACK - R + R * math.sin(a), R - R * math.cos(a)))
for i in range(1, 9):
    prof.append((CYC_BACK, R + i * 1.0))
rows = []
for w in (-14.0, 14.0):
    rows.append([bm.verts.new(C + H * d + SIDE * w + Vector((0, 0, z))) for d, z in prof])
for k in range(len(prof) - 1):
    bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Cyclorama")
bm.to_mesh(me)
bm.free()
cyc = bpy.data.objects.new("Cyclorama", me)
scene.collection.objects.link(cyc)
for p in me.polygons:
    p.use_smooth = True
if sum(p.normal.z for p in me.polygons) < 0:
    me.flip_normals()
cm = bpy.data.materials.new("Charcoal sweep")
cm.use_nodes = True
cb = cm.node_tree.nodes["Principled BSDF"]
cb.inputs["Base Color"].default_value = (0.006, 0.0062, 0.007, 1)
cb.inputs["Roughness"].default_value = 0.6
cb.inputs["Specular IOR Level"].default_value = 0.2
cb.inputs["Coat Weight"].default_value = 0.1   # a soft, blurred floor reflection
cb.inputs["Coat Roughness"].default_value = 0.22
me.materials.append(cm)

# ----------------------------------------------------------------------------- render settings
r = scene.render
r.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.012
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
scene.cycles.max_bounces = 10
scene.cycles.glossy_bounces = 6
scene.cycles.transmission_bounces = 6
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 0.5
r.resolution_x = args.width
r.resolution_y = round(args.width * ASPECT)
r.resolution_percentage = 100
r.image_settings.file_format = "PNG"
r.image_settings.color_depth = "8"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"
scene.view_settings.exposure = 0.0
r.threads_mode = "AUTO"

fit_camera()
# slight depth of field, focused on the wheel
cam_data.dof.use_dof = bool(args.dof) and args.mode != "parts"  # part masks must line up with the beauty
cam_data.dof.focus_distance = (mm(1000, 0, 900) - cam.location).dot(VIEW)
cam_data.dof.aperture_fstop = 4.0


def objects(layers):
    for name in layers:
        for ob in COLL[name].objects:
            yield ob


def reset():
    for c in COLL.values():
        c.hide_render = False
        for ob in c.objects:
            ob.hide_render = False
            ob.is_holdout = False
            ob.visible_camera = ob.visible_shadow = ob.visible_diffuse = ob.visible_glossy = ob.visible_transmission = True
    for c in COLL.values():
        for ob in c.objects:
            if ob.name.startswith("Slot cutter"):
                ob.hide_render = True


def show_frame(layers, lifted):
    reset()
    for name, c in COLL.items():
        c.hide_render = name not in layers
    cyc.is_shadow_catcher = False
    r.use_border = False
    r.film_transparent = False
    r.image_settings.color_mode = "RGB"
    LIFT.location.z = MOTION_LIFT if lifted else 0.0


def show_overlay(name, context_layers, lifted):
    """The add-on visible; the cockpit it sits in as a holdout that casts nothing (so the shadow
    catcher only picks up the add-on's own shadow, the frame already has the rest)."""
    reset()
    for n, c in COLL.items():
        c.hide_render = not (n == name or n in context_layers)
    for ob in objects([n for n in context_layers if n != name]):
        ob.is_holdout = True
        ob.visible_shadow = ob.visible_diffuse = ob.visible_glossy = ob.visible_transmission = False
    cyc.is_shadow_catcher = True
    # only render the add-on's own region (plus room for its floor shadow): the rest is transparent
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for ob in objects([name]):
        if ob.type not in ("MESH", "CURVE"):
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            for p in (w, Vector((w.x, w.y, 0.0))):  # the part and its footprint on the floor
                co = world_to_camera_view(scene, cam, p)
                xs.append(co.x); ys.append(co.y)
        ev.to_mesh_clear()
    pad = 0.06
    r.use_border = True
    r.use_crop_to_border = False
    r.border_min_x, r.border_max_x = max(0, min(xs) - pad), min(1, max(xs) + pad)
    r.border_min_y, r.border_max_y = max(0, min(ys) - pad), min(1, max(ys) + pad)
    r.film_transparent = True
    r.image_settings.color_mode = "RGBA"
    LIFT.location.z = MOTION_LIFT if lifted else 0.0


def render(path):
    if os.path.exists(path) and not args.force:  # resumable: a finished frame is never redone
        print("skip", path, flush=True)
        return
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)


# ----------------------------------------------------------------------------- part passes
# The builder shows the whole rig as a ghost and lights up each picked part. One beauty render per
# screen layout with every part in it (motion platform and all add-ons included), plus an
# anti-aliased mask per part from the object index pass; pack_parts.py cuts the parts out of the
# beauty and draws the ghost and the outlines from the masks, so every layer lines up exactly.
PART_GROUPS = {
    "chassis": ["chassis", "chassis-back"],
    "seat": ["seat"],
    "wheelbase": ["wheelbase"],
    "wheel": ["wheel"],
    "pedals": ["pedals"],
    "mount": ["mount", "mount-sides", "mount-top"],
    "screens": ["screen-center", "screen-sides", "screen-dual", "screen-top"],
    "motion": ["motion", "motion-back"],
    "pc": ["pc"],
    "headset": ["headset"],
    "sidemount": ["sidemount"],
    "shifter": ["shifter"],
    "handbrake": ["handbrake"],
}
PART_VARIANTS = ["s1", "s2", "s3", "s4"]


def setup_part_passes(out_dir, key):
    for i, (part, colls) in enumerate(PART_GROUPS.items(), start=1):
        for cn in colls:
            for ob in COLL[cn].objects:
                ob.pass_index = i
    bpy.context.view_layer.use_pass_object_index = True
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new("CompositorNodeRLayers")
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], comp.inputs["Image"])
    fo = nt.nodes.new("CompositorNodeOutputFile")
    fo.base_path = out_dir
    fo.format.file_format = "PNG"
    fo.format.color_mode = "BW"
    fo.format.color_depth = "8"
    try:  # masks are data: no view transform
        fo.format.color_management = "OVERRIDE"
        fo.format.view_settings.view_transform = "Standard"
        fo.format.view_settings.look = "None"
    except Exception as e:  # noqa: BLE001
        print("color override failed", e, flush=True)
    fo.file_slots.clear()
    for i, part in enumerate(PART_GROUPS, start=1):
        idm = nt.nodes.new("CompositorNodeIDMask")
        idm.index = i
        idm.use_antialiasing = True
        nt.links.new(rl.outputs["IndexOB"], idm.inputs[0])
        fo.file_slots.new(f"mask-{key}-{part}-")
        nt.links.new(idm.outputs[0], fo.inputs[-1])


only = set(filter(None, args.only.split(",")))
if args.mode == "frame":
    show_frame(FRAMES[args.key], args.key.endswith("m1"))
    render(os.path.join(args.out, f"frame-{args.key}.png"))
elif args.mode == "frames":
    for key, layers in FRAMES.items():
        if only and key not in only:
            continue
        show_frame(layers, key.endswith("m1"))
        render(os.path.join(args.out, f"frame-{key}.png"))
elif args.mode in ("overlays", "full"):
    for name in OVERLAYS:
        for lifted in ((False, True) if name in RIDES else (False,)):
            key = name + ("--raised" if lifted else "")
            if only and key not in only:
                continue
            ctx = CORE + SCREENS["s3"] + (MOTION if lifted else [])
            show_overlay(name, ctx, lifted)
            render(os.path.join(args.out, f"overlay-{key}.png"))
    if args.mode == "full":  # the reference: everything in one render, to check overlays against
        show_frame(FRAMES["s3m1"] + OVERLAYS, True)
        render(os.path.join(args.out, "full-s3m1-all.png"))
elif args.mode == "parts":
    pdir = os.path.join(args.out, "parts")
    os.makedirs(pdir, exist_ok=True)
    every = [c for g in PART_GROUPS.values() for c in g]
    for key in PART_VARIANTS:
        if only and key not in only:
            continue
        layers = [c for c in every if c not in {"screen-center", "screen-sides", "screen-dual", "screen-top", "mount", "mount-sides", "mount-top"}]
        layers += SCREENS[key]
        path = os.path.join(pdir, f"beauty-{key}.png")
        if os.path.exists(path) and not args.force:
            print("skip", path, flush=True)
            continue
        show_frame(layers, True)
        setup_part_passes(pdir, key)
        scene.frame_set(1)
        render(path)
print("render done", flush=True)

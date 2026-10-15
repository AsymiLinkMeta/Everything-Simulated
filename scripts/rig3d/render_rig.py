"""
Renders the rig builder preview from assets/rig3d/rig.blend (built by build_rig.py).

    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode full --out /tmp/rig
    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode layers --out /tmp/rig
    blender -b assets/rig3d/rig.blend -P scripts/rig3d/render_rig.py -- --mode depth --out /tmp/rig

full   one beauty frame of a fully loaded rig (the reference the layers must match)
layers one transparent PNG per layer (and the raised variant of each rig layer), plus the
       floor shadows and the ghosted empty state; scripts/rig3d/pack_layers.py turns them
       into WebP and checks the layered composite against the full frame
depth  per-layer depth maps at low resolution, used to work out the layer stacking order
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--mode", default="full")
ap.add_argument("--out", default="/tmp/rig")
ap.add_argument("--samples", type=int, default=160)
ap.add_argument("--width", type=int, default=1200)
ap.add_argument("--only", default="")
ap.add_argument("--layers", default="", help="full mode: comma-separated layers instead of the fully loaded rig")
ap.add_argument("--az", type=float, default=None)
ap.add_argument("--el", type=float, default=None)
ap.add_argument("--dist", type=float, default=None)
ap.add_argument("--lens", type=float, default=None)
ap.add_argument("--target", default="")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

scene = bpy.context.scene
COLL = {c.name: c for c in bpy.data.collections}
LIFT = bpy.data.objects["RigLift"]
MOTION_LIFT = 0.07
ASPECT = 0.82  # height / width of the preview frame
RIG_LAYERS = ["chassis-back", "chassis", "seat", "wheelbase", "wheel", "pedals", "sidemount", "shifter", "handbrake", "headset"]
ALL = list(COLL)


def mm(*v):
    return Vector([x / 1000.0 for x in v])


# ----------------------------------------------------------------------------- camera
TARGET = mm(*map(float, args.target.split(","))) if args.target else mm(920, -20, 820)
# Rear three-quarter, raised: the screens face the driver, so this is the view in which they face
# the viewer, and it looks over the seat at the wheel and pedals.
AZ = math.radians(28 if args.az is None else args.az)  # swung from straight behind toward the driver's right
EL = math.radians(46 if args.el is None else args.el)
DIST = 6.9 if args.dist is None else args.dist
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 70 if args.lens is None else args.lens
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam.location = TARGET + Vector((-math.cos(AZ) * math.cos(EL), -math.sin(AZ) * math.cos(EL), math.sin(EL))) * DIST
cam.rotation_euler = (TARGET - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

ap_margin = 0.035  # frame margin, as a share of the frame


def fit_camera():
    """Tighten the frame around everything any layer can show (raised rig, top screen, PC):
    keep the view direction, then set the lens and lens shift so that bounding box just fits."""
    from bpy_extras.object_utils import world_to_camera_view
    LIFT.location.z = MOTION_LIFT
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for c in COLL.values():
        for ob in c.objects:
            if ob.type != "MESH" or ob.hide_render:
                continue
            ev = ob.evaluated_get(dg)
            for v in ev.data.vertices:
                co = world_to_camera_view(scene, cam, ev.matrix_world @ v.co)
                xs.append(co.x); ys.append(co.y)
    LIFT.location.z = 0.0
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # frame coordinates are 0..1 of the current frame; scale so the box fills it with a margin
    sx = (x1 - x0) / (1 - 2 * ap_margin)
    sy = (y1 - y0) / (1 - 2 * ap_margin)
    k = max(sx, sy)
    cam_data.lens /= k
    # the shift is in units of the larger frame dimension (width here)
    cam_data.shift_x = ((x0 + x1) / 2 - 0.5) / k
    cam_data.shift_y = ((y0 + y1) / 2 - 0.5) / k * ASPECT
    print(f"fit: lens {cam_data.lens:.1f} shift {cam_data.shift_x:.3f},{cam_data.shift_y:.3f} (box {x1-x0:.2f} x {y1-y0:.2f})", flush=True)


# ----------------------------------------------------------------------------- studio lights
def area(name, loc, size, energy, color=(1, 1, 1), shape="RECTANGLE", size_y=None, target=TARGET):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = color
    ld.shape = shape
    ld.size = size
    if size_y:
        ld.size_y = size_y
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


# Product-photo studio for a black rig: a big soft key over the camera's shoulder, a broad top softbox,
# and strong rim strips behind and beside the rig so black anodised edges separate from a dark page.
CAM_DIR = (TARGET - cam.location).normalized()
area("Key", cam.location + Vector((0.6, 1.6, 1.8)), 3.0, 900, size_y=2.0)
area("Fill", cam.location + Vector((0.4, -1.2, -0.6)), 3.0, 160, (0.92, 0.95, 1.0))
area("Top", Vector((0.9, 0, 3.4)), 3.2, 520, size_y=2.0)
area("Rim L", Vector((2.6, 2.4, 2.0)), 0.5, 900, (0.9, 0.94, 1.0), size_y=3.0)
area("Rim R", Vector((2.4, -2.6, 1.6)), 0.5, 700, (0.9, 0.94, 1.0), size_y=3.0)
area("Rim back", Vector((-1.6, 1.8, 1.4)), 0.5, 500, (1.0, 0.92, 0.88), size_y=2.4)
area("Rim red", Vector((3.2, 0.0, 0.5)), 1.6, 260, (1.0, 0.08, 0.04))
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
# a dim studio gradient (darker floor, soft lighter ceiling) so metals have something to reflect
wn = world.node_tree
bg = wn.nodes["Background"]
geo = wn.nodes.new("ShaderNodeTexCoord")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
ramp = wn.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.45
ramp.color_ramp.elements[0].color = (0.012, 0.012, 0.014, 1)
ramp.color_ramp.elements[1].position = 0.9
ramp.color_ramp.elements[1].color = (0.42, 0.42, 0.45, 1)
mapr = wn.nodes.new("ShaderNodeMapRange")
mapr.inputs["From Min"].default_value = -1
wn.links.new(geo.outputs["Generated"], sep.inputs["Vector"])
wn.links.new(sep.outputs["Z"], mapr.inputs["Value"])
wn.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
wn.links.new(ramp.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.0
scene.world = world

# floor: a shadow catcher, only used by the shadow passes
bpy.ops.mesh.primitive_plane_add(size=12, location=(0.8, 0, 0))
floor = bpy.context.active_object
floor.name = "Floor"
floor_mat = bpy.data.materials.new("Studio floor")
floor_mat.use_nodes = True
floor_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.4, 0.4, 0.42, 1)
floor_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.45
floor.data.materials.append(floor_mat)
for c in floor.users_collection:
    c.objects.unlink(floor)
scene.collection.objects.link(floor)

# ----------------------------------------------------------------------------- render settings
r = scene.render
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 6
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
r.resolution_x = args.width
r.resolution_y = round(args.width * ASPECT)
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.image_settings.color_depth = "8"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.threads_mode = "AUTO"


fit_camera()


def show(layers, lifted=False, floor_on=False, shadow_only=False):
    """Make only these layers visible. shadow_only keeps them out of camera rays (for the shadow passes)."""
    for name, c in COLL.items():
        on = name in layers
        c.hide_render = not on
        for ob in c.objects:
            ob.visible_camera = not shadow_only
    # The floor always bounces light onto the rig; the camera only sees it, as a shadow catcher,
    # in the shadow passes.
    floor.hide_render = False
    floor.is_shadow_catcher = floor_on
    floor.visible_camera = floor_on
    LIFT.location.z = MOTION_LIFT if lifted else 0.0


def render(path):
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)


FULL = [n for n in ALL if n not in ("screen-dual", "screen-center")]
FULL = [n for n in ALL if n not in ("screen-dual",)]

if args.layers:
    FULL = args.layers.split(",")
if args.mode == "full":
    show(FULL, lifted=True)
    render(os.path.join(args.out, "full.png"))
    show(FULL, lifted=True, floor_on=True)
    render(os.path.join(args.out, "full-floor.png"))

elif args.mode == "layers":
    only = set(filter(None, args.only.split(",")))
    jobs = []
    for name in ALL:
        jobs.append((name, [name], False))
        if name in RIG_LAYERS:
            jobs.append((name + "@raised", [name], True))
    # floor shadows: the rig on the ground, the rig on the motion platform, the stand, the PC
    rig_ground = RIG_LAYERS
    jobs.append(("shadow-rig", rig_ground, False, True))
    jobs.append(("shadow-rig@raised", rig_ground + ["motion"], True, True))
    jobs.append(("shadow-stand", ["mount", "mount-sides", "screen-center", "screen-sides"], False, True))
    jobs.append(("shadow-pc", ["pc"], False, True))
    for job in jobs:
        name, layers, lifted = job[0], job[1], job[2]
        shadow = len(job) > 3
        if only and name not in only:
            continue
        if shadow:
            show(layers, lifted=lifted, floor_on=True, shadow_only=True)
        else:
            show(layers, lifted=lifted)
        render(os.path.join(args.out, name.replace("@", "--") + ".png"))

elif args.mode == "depth":
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    r.filter_size = 0.01
    scene.view_layers[0].use_pass_z = True
    scene.use_nodes = True
    nt = scene.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new("CompositorNodeRLayers")
    out = nt.nodes.new("CompositorNodeOutputFile")
    out.base_path = args.out
    out.format.file_format = "OPEN_EXR"
    out.format.color_depth = "32"
    nt.links.new(rl.outputs["Depth"], out.inputs[0])
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(rl.outputs["Image"], comp.inputs["Image"])
    for name in ALL if args.only != "chassis-objects" else []:
        for lifted in (False, True):
            if lifted and name not in RIG_LAYERS + ["motion"]:
                continue
            show([name], lifted=lifted)
            out.file_slots[0].path = f"depth-{name}{'--raised' if lifted else ''}-"
            r.filepath = os.path.join(args.out, "scratch.png")
            bpy.ops.render.render(write_still=True)
    if args.only == "chassis-objects":
        show(["chassis"])
        obs = list(COLL["chassis"].objects)
        for ob in obs:
            for o2 in obs:
                o2.hide_render = o2 is not ob
            out.file_slots[0].path = f"depth-obj~{ob.name}-"
            bpy.ops.render.render(write_still=True)
        for o2 in obs:
            o2.hide_render = False
    print("depth done")

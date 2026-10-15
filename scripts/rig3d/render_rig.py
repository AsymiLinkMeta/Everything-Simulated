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
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

scene = bpy.context.scene
COLL = {c.name: c for c in bpy.data.collections}
LIFT = bpy.data.objects["RigLift"]
MOTION_LIFT = 0.15
RIG_LAYERS = ["chassis", "seat", "wheelbase", "wheel", "pedals", "sidemount", "shifter", "handbrake", "headset"]
ALL = list(COLL)


def mm(*v):
    return Vector([x / 1000.0 for x in v])


# ----------------------------------------------------------------------------- camera
TARGET = mm(930, -40, 700)
# Rear three-quarter, raised: the screens face the driver, so this is the view in which they face
# the viewer, and it looks over the seat at the wheel and pedals.
AZ = math.radians(36)  # swung from straight behind toward the driver's right
EL = math.radians(30)
DIST = 7.0
cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 70
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam.location = TARGET + Vector((-math.cos(AZ) * math.cos(EL), -math.sin(AZ) * math.cos(EL), math.sin(EL))) * DIST
cam.rotation_euler = (TARGET - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

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


area("Key", Vector((-2.2, 2.4, 3.2)), 2.4, 260, size_y=1.6)
area("Fill", Vector((-3.2, -3.0, 1.8)), 3.0, 70, (0.92, 0.95, 1.0))
area("Rim cool", Vector((3.4, -2.2, 2.4)), 1.6, 160, (0.85, 0.9, 1.0))
area("Rim red", Vector((3.0, 2.6, 1.2)), 1.8, 140, (1.0, 0.1, 0.05))
area("Top", Vector((0.8, 0, 4.0)), 3.0, 90, size_y=1.2)
world = bpy.data.worlds.new("Studio")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.012, 0.014, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world

# floor: a shadow catcher, only used by the shadow passes
bpy.ops.mesh.primitive_plane_add(size=12, location=(0.8, 0, 0))
floor = bpy.context.active_object
floor.name = "Floor"
floor.is_shadow_catcher = True
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
r.resolution_y = round(args.width * 0.7)
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.image_settings.color_depth = "8"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.threads_mode = "AUTO"


def show(layers, lifted=False, floor_on=False, shadow_only=False):
    """Make only these layers visible. shadow_only keeps them out of camera rays (for the shadow passes)."""
    for name, c in COLL.items():
        on = name in layers
        c.hide_render = not on
        for ob in c.objects:
            ob.visible_camera = not shadow_only
    floor.hide_render = not floor_on
    LIFT.location.z = MOTION_LIFT if lifted else 0.0


def render(path):
    r.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path, flush=True)


FULL = [n for n in ALL if n not in ("screen-dual", "screen-center")]
FULL = [n for n in ALL if n not in ("screen-dual",)]

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
    for name in ALL:
        for lifted in (False, True):
            if lifted and name not in RIG_LAYERS + ["motion"]:
                continue
            show([name], lifted=lifted)
            out.file_slots[0].path = f"depth-{name}{'--raised' if lifted else ''}-"
            r.filepath = os.path.join(args.out, "scratch.png")
            bpy.ops.render.render(write_still=True)
    print("depth done")

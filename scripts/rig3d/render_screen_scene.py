"""
Renders the in-game images shown on the preview's screens: a photoreal race track with a generic,
unbranded GT car ahead, lit by a CC0 sky HDRI (fetch_assets.py).

    blender -b --factory-startup -P scripts/rig3d/render_screen_scene.py

screen-pano.png  the driver's view across a triple (left / centre / right thirds), equirectangular
screen-top.png   a chase-cam replay angle for the separate top screen
Both land in assets/rig3d/ (build_rig.py packs them into rig.blend).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ART = os.path.join(ROOT, "assets", "rig3d")
CACHE = os.path.join(ART, "cache")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def img(name, colour=True):
    im = bpy.data.images.load(os.path.join(CACHE, name), check_existing=True)
    if not colour:
        im.colorspace_settings.name = "Non-Color"
    return im


def textured(name, base, scale, tint=(1, 1, 1, 1), rough_mul=1.0, normal=1.0, coord="UV"):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs[coord], mp.inputs["Vector"])

    def tex(suffix, colour):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img(f"{base}_{suffix}.jpg", colour)
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    d = tex("Diffuse", True)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(d.outputs["Color"], mix.inputs["A"])
    mix.inputs["B"].default_value = tint
    # large-scale tone variation so tiling doesn't show
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 0.05; nz.inputs["Detail"].default_value = 4
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.8, 0.8, 0.8, 1); ramp.color_ramp.elements[1].color = (1.15, 1.12, 1.05, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"; mix2.blend_type = "MULTIPLY"; mix2.inputs["Factor"].default_value = 1.0
    nt.links.new(mix.outputs["Result"], mix2.inputs["A"]); nt.links.new(ramp.outputs["Color"], mix2.inputs["B"])
    nt.links.new(mix2.outputs["Result"], b.inputs["Base Color"])
    r = tex("Rough", False)
    rm = nt.nodes.new("ShaderNodeMath"); rm.operation = "MULTIPLY"; rm.inputs[1].default_value = rough_mul
    nt.links.new(r.outputs["Color"], rm.inputs[0]); nt.links.new(rm.outputs[0], b.inputs["Roughness"])
    n = tex("nor_gl", False)
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = normal
    nt.links.new(n.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def flat(name, colour, rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*colour, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def stripes(name, a, b_, period, rough=0.5):
    """Kerb paint: alternating bands along the strip's U (metres along the track)."""
    m = flat(name, a, rough)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sep.inputs["Vector"])
    md = nt.nodes.new("ShaderNodeMath"); md.operation = "PINGPONG"; md.inputs[1].default_value = period / 2
    nt.links.new(sep.outputs["X"], md.inputs[0])
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = period / 4
    nt.links.new(md.outputs[0], gt.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*a, 1); mix.inputs["B"].default_value = (*b_, 1)
    nt.links.new(gt.outputs[0], mix.inputs["Factor"]); nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


def obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- track centre line
# straight past the camera, a long right-hander, then a short straight
pts, heads = [], []
p, h = Vector((-40.0, 0.0)), 0.0
STEP = 1.0
segments = [(70, 0.0), (110, -1.0 / 85), (60, 0.0), (90, 1.0 / 120), (200, 0.0)]
for length, curv in segments:
    for _ in range(int(length / STEP)):
        pts.append(p.copy()); heads.append(h)
        h += curv * STEP
        p += Vector((math.cos(h), math.sin(h))) * STEP
dist = [i * STEP for i in range(len(pts))]
W = 12.0


def frame(i):
    t = Vector((math.cos(heads[i]), math.sin(heads[i])))
    return pts[i], t, Vector((-t.y, t.x))  # left normal


def ribbon(name, off0, off1, z, mat, i0=0, i1=None, uscale=1.0):
    i1 = len(pts) if i1 is None else i1
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rows = []
    for i in range(i0, i1):
        c, _, n = frame(i)
        a = c + n * off0
        b = c + n * off1
        za = z(off0) if callable(z) else z
        zb = z(off1) if callable(z) else z
        rows.append((bm.verts.new((a.x, a.y, za)), bm.verts.new((b.x, b.y, zb)), dist[i] * uscale))
    for k in range(len(rows) - 1):
        f = bm.faces.new((rows[k][0], rows[k + 1][0], rows[k + 1][1], rows[k][1]))
        for loop, uv in zip(f.loops, ((rows[k][2], 0), (rows[k + 1][2], 0), (rows[k + 1][2], 1), (rows[k][2], 1))):
            loop[uvl].uv = uv
    o = obj(name, bm, mat)
    for poly in o.data.polygons:
        poly.use_smooth = True
    return o


asphalt = textured("Asphalt", "asphalt_track", (1 / 6, 1 / 6 * 1, 1), tint=(0.62, 0.62, 0.64, 1), rough_mul=1.0, normal=0.6)
# track UVs are metres: U along, V 0..1 across 12 m, so scale V by 12/6
asphalt.node_tree.nodes["Mapping"].inputs["Scale"].default_value = (1 / 6, 2, 1)
ribbon("Track", -W / 2, W / 2, 0.0, asphalt)
paint = flat("Line paint", (0.8, 0.8, 0.78), 0.55)
ribbon("Line L", W / 2 - 0.45, W / 2 - 0.3, 0.004, paint)
ribbon("Line R", -W / 2 + 0.3, -W / 2 + 0.45, 0.004, paint)
kerb = stripes("Kerb", (0.62, 0.02, 0.015), (0.82, 0.82, 0.8), 3.0, 0.45)
apex0, apex1 = 95, 170   # inside of the right-hander (driver's right)
ribbon("Kerb apex", -W / 2 - 1.3, -W / 2 + 0.02, lambda o: 0.05 if o < -W / 2 - 0.2 else 0.012, kerb, apex0, apex1)
ribbon("Kerb exit", W / 2 - 0.02, W / 2 + 1.3, lambda o: 0.05 if o > W / 2 + 0.2 else 0.012, kerb, 160, 215)
ribbon("Kerb entry", W / 2 - 0.02, W / 2 + 1.3, lambda o: 0.05 if o > W / 2 + 0.2 else 0.012, kerb, 55, 85)
grass_strip = textured("Verge", "leafy_grass", (1 / 2.5, 22 / 2.5, 1), tint=(0.3, 0.6, 0.18, 1), normal=0.8)
for s in (1, -1):
    ribbon(f"Verge {s}", s * (W / 2 + 0.01), s * (W / 2 + 22), -0.01, grass_strip)
# armco barrier with posts on both sides
armco = flat("Armco", (0.55, 0.56, 0.57), 0.35, 1.0)
for s in (1, -1):
    ribbon(f"Armco {s}", s * 16.0, s * 16.0, 0.0, armco).data  # placeholder for UVs
    o = bpy.data.objects[f"Armco {s}"]
    bpy.data.objects.remove(o)
    bm = bmesh.new()
    prev = None
    for i in range(0, len(pts), 1):
        c, _, n = frame(i)
        q = c + n * (s * 16.0)
        a, b2 = bm.verts.new((q.x, q.y, 0.45)), bm.verts.new((q.x, q.y, 0.78))
        if prev:
            bm.faces.new((prev[0], a, b2, prev[1]))
        prev = (a, b2)
    obj(f"Armco {s}", bm, armco)
    for i in range(0, len(pts), 4):
        c, _, n = frame(i)
        q = c + n * (s * 16.15)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(q.x, q.y, 0.35))
        post = bpy.context.active_object
        post.scale = (0.08, 0.08, 0.7)
        post.data.materials.append(armco)
    # catch-fence posts beyond the barrier
    for i in range(0, len(pts), 12):
        c, _, n = frame(i)
        q = c + n * (s * 17.5)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=4.0, location=(q.x, q.y, 2.0), vertices=12)
        bpy.context.active_object.data.materials.append(armco)
# tyre wall on the outside of the right-hander
tyre = flat("Tyres", (0.02, 0.02, 0.02), 0.8)
for i in range(apex0 - 10, apex1 + 30, 1):
    c, _, n = frame(i)
    for k in range(3):
        q = c + n * 14.8
        bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.12, location=(q.x, q.y, 0.12 + k * 0.24), major_segments=20, minor_segments=8)
        bpy.context.active_object.data.materials.append(tyre)
# ground beyond, and low hills on the horizon
bpy.ops.mesh.primitive_plane_add(size=3000, location=(200, 0, -0.03))
ground = bpy.context.active_object
ground.data.materials.append(textured("Field", "leafy_grass", (1 / 3, 1 / 3, 1), tint=(0.26, 0.52, 0.15, 1), normal=0.6, coord="Object"))
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=160, y_segments=40, size=1)
for v in bm.verts:
    ang = v.co.x * math.pi * 0.9           # -0.9pi..0.9pi around the camera, open behind
    rr = 380 + (v.co.y + 1) * 220
    hgt = (math.sin(ang * 3.1 + 1.3) * 0.5 + math.sin(ang * 7.3) * 0.25 + math.sin(ang * 1.7 + 0.4) * 0.6 + 1.2) * 18 * (1 - abs(v.co.y) ** 2)
    v.co = Vector((200 + math.cos(ang) * rr, math.sin(ang) * rr, max(0, hgt) - 2))
hills = obj("Hills", bm, flat("Hills", (0.05, 0.09, 0.035), 0.9))
for poly in hills.data.polygons:
    poly.use_smooth = True
# simple tree line: clustered dark ellipsoids along the infield and behind the fences
tree_mats = [flat(f"Trees {k}", c, 0.85) for k, c in enumerate([(0.02, 0.045, 0.015), (0.03, 0.06, 0.02), (0.035, 0.05, 0.018), (0.018, 0.035, 0.014)])]
import random
random.seed(7)
leaf = bpy.data.textures.new("Leafy", "CLOUDS"); leaf.noise_scale = 0.35; leaf.noise_depth = 3
for k in range(260):
    i = random.randrange(0, len(pts))
    c, _, n = frame(i)
    s = random.choice((1, -1))
    q = c + n * (s * random.uniform(28, 120))
    if q.x < 0:
        continue
    r = random.uniform(2.5, 5.0)
    for j in range(random.randint(2, 4)):  # each tree a cluster of leafy clumps
        off = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(0, 1.2))) * r * 0.6
        rr = r * random.uniform(0.6, 0.9)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=rr, location=(q.x + off.x, q.y + off.y, r * 1.2 + off.z))
        t = bpy.context.active_object
        t.scale = (1, 1, random.uniform(1.0, 1.4))
        t.data.materials.append(random.choice(tree_mats))
        d = t.modifiers.new("Leaf", "DISPLACE")
        d.texture = leaf; d.strength = 1.4; d.texture_coords = "GLOBAL"
        for poly in t.data.polygons:
            poly.use_smooth = True

# ---------------------------------------------------------------- generic GT car (no branding)
def car(name, at_index, lateral, paint_rgb, stripe_rgb):
    c, t, n = frame(at_index)
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    paint_m = flat(f"{name} paint", paint_rgb, 0.25, 0.4, **{"Coat Weight": 1.0, "Coat Roughness": 0.03})
    stripe_m = flat(f"{name} stripe", stripe_rgb, 0.3, 0.2, **{"Coat Weight": 1.0, "Coat Roughness": 0.03})
    glass = flat(f"{name} glass", (0.01, 0.012, 0.015), 0.04, 0.0, **{"Coat Weight": 1.0})
    black = flat(f"{name} black", (0.015, 0.015, 0.016), 0.5)
    lamp = flat(f"{name} lamp", (0.2, 0.0, 0.0), 0.3, **{"Emission Color": (1, 0.02, 0.01, 1), "Emission Strength": 6.0})
    # body: loft of rounded sections, x from rear (0) to nose (4.5)
    sections = [  # x, half width, bottom, top
        (0.00, 0.86, 0.16, 0.86), (0.25, 0.97, 0.12, 0.95), (0.9, 1.0, 0.11, 0.98), (1.6, 0.99, 0.11, 0.92),
        (2.6, 0.98, 0.11, 0.86), (3.4, 0.96, 0.11, 0.74), (4.1, 0.9, 0.12, 0.6), (4.45, 0.78, 0.16, 0.45), (4.55, 0.6, 0.2, 0.36)]
    NS = 20
    bm = bmesh.new()
    rings = []
    for x, hw, zb, zt in sections:
        ring = []
        for j in range(NS):
            a = 2 * math.pi * j / NS
            ca, sa = math.cos(a), math.sin(a)
            y = hw * math.copysign(abs(ca) ** 0.35, ca)
            z = (zb + zt) / 2 + (zt - zb) / 2 * math.copysign(abs(sa) ** 0.5, sa)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for j in range(NS):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % NS], rings[k + 1][(j + 1) % NS], rings[k + 1][j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    body = obj(f"{name} body", bm, paint_m)
    body.data.materials.append(stripe_m)
    for poly in body.data.polygons:
        poly.use_smooth = True
        if abs(poly.center.y) < 0.36 and poly.center.z > 0.5 and 0.2 < poly.center.x < 4.4:
            poly.material_index = 1  # centre stripe
    sub = body.modifiers.new("Sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
    # cabin / greenhouse
    bm = bmesh.new()
    cab = [(1.15, 0.62, 0.9, 0.95), (1.5, 0.72, 0.9, 1.25), (2.3, 0.72, 0.88, 1.28), (2.95, 0.7, 0.86, 1.05), (3.3, 0.66, 0.84, 0.86)]
    rings = []
    for x, hw, zb, zt in cab:
        ring = []
        for j in range(NS):
            a = 2 * math.pi * j / NS
            ca, sa = math.cos(a), math.sin(a)
            y = hw * math.copysign(abs(ca) ** 0.5, ca) * (0.82 if sa > 0 else 1.0)
            z = (zb + zt) / 2 + (zt - zb) / 2 * math.copysign(abs(sa) ** 0.6, sa)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for j in range(NS):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % NS], rings[k + 1][(j + 1) % NS], rings[k + 1][j]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    cabin = obj(f"{name} cabin", bm, glass)
    for poly in cabin.data.polygons:
        poly.use_smooth = True
    sub = cabin.modifiers.new("Sub", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
    parts = [body, cabin]
    # wheels
    for wx in (0.85, 3.55):
        for s in (1, -1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=0.3, location=(wx, s * 0.86, 0.34), rotation=(math.pi / 2, 0, 0), vertices=40)
            w = bpy.context.active_object; w.data.materials.append(black)
            for poly in w.data.polygons:
                poly.use_smooth = True
            parts.append(w)
    # rear wing on two uprights, diffuser, tail lights
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.05, 0, 1.22)); wing = bpy.context.active_object
    wing.scale = (0.3, 1.8, 0.03); wing.data.materials.append(black); parts.append(wing)
    for s in (1, -1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.15, s * 0.45, 1.05)); up = bpy.context.active_object
        up.scale = (0.12, 0.02, 0.34); up.data.materials.append(black); parts.append(up)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, s * 0.92, 1.22)); ep = bpy.context.active_object
        ep.scale = (0.4, 0.015, 0.22); ep.data.materials.append(black); parts.append(ep)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.01, s * 0.66, 0.74)); tl = bpy.context.active_object
        tl.scale = (0.03, 0.34, 0.06); tl.data.materials.append(lamp); parts.append(tl)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.05, 0, 0.22)); df = bpy.context.active_object
    df.scale = (0.2, 1.6, 0.16); df.data.materials.append(black); parts.append(df)
    for o in parts:
        o.parent = root
    root.location = (c.x + n.x * lateral, c.y + n.y * lateral, 0)
    root.rotation_euler = (0, 0, heads[at_index])
    return root


car("Car ahead", 82, -1.6, (0.85, 0.85, 0.86), (0.75, 0.0015, 0.0))
car("Car far", 128, -3.0, (0.02, 0.06, 0.2), (0.8, 0.8, 0.8))

# ---------------------------------------------------------------- sky, render
world = bpy.data.worlds.new("Sky")
world.use_nodes = True
wn = world.node_tree
env = wn.nodes.new("ShaderNodeTexEnvironment")
env.image = img("kloofendal_48d_partly_cloudy_puresky_4k.hdr")
mpw = wn.nodes.new("ShaderNodeMapping")
mpw.inputs["Rotation"].default_value = (0, 0, math.radians(200))
tcw = wn.nodes.new("ShaderNodeTexCoord")
wn.links.new(tcw.outputs["Generated"], mpw.inputs["Vector"])
wn.links.new(mpw.outputs["Vector"], env.inputs["Vector"])
wn.links.new(env.outputs["Color"], wn.nodes["Background"].inputs["Color"])
scene.world = world
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 4.5; sun.angle = math.radians(1.5); sun.color = (1.0, 0.95, 0.86)
sun_o = bpy.data.objects.new("Sun", sun); scene.collection.objects.link(sun_o)
sun_o.rotation_euler = (math.radians(50), 0, math.radians(140))
world.mist_settings.start = 40
world.mist_settings.depth = 700
world.mist_settings.falloff = "QUADRATIC"

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy"
scene.view_layers[0].use_pass_mist = True
scene.use_nodes = True
nt = scene.node_tree
for nd in list(nt.nodes):
    nt.nodes.remove(nd)
rl = nt.nodes.new("CompositorNodeRLayers")
haze = nt.nodes.new("CompositorNodeMixRGB")
haze.inputs[2].default_value = (0.62, 0.68, 0.78, 1)
pw = nt.nodes.new("CompositorNodeMath"); pw.operation = "MULTIPLY"; pw.inputs[1].default_value = 0.25
nt.links.new(rl.outputs["Mist"], pw.inputs[0])
nt.links.new(pw.outputs[0], haze.inputs["Fac"])
nt.links.new(rl.outputs["Image"], haze.inputs[1])
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(haze.outputs["Image"], comp.inputs["Image"])

cam_d = bpy.data.cameras.new("Driver")
cam_d.type = "PANO"
cam_d.panorama_type = "EQUIRECTANGULAR"
cam_d.longitude_min, cam_d.longitude_max = math.radians(-75), math.radians(75)
cam_d.latitude_min, cam_d.latitude_max = math.radians(-17.5), math.radians(11.3)
cam_d.clip_end = 2000
cam = bpy.data.objects.new("Driver", cam_d)
scene.collection.objects.link(cam)
c0, t0, n0 = frame(60)
cam.location = (c0.x + n0.x * 1.0, c0.y + n0.y * 1.0, 1.05)
cam.rotation_euler = (math.radians(90), 0, heads[60] - math.radians(90) - math.radians(6))
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 3072, 600
scene.render.filepath = os.path.join(ART, "screen-pano.png")
bpy.ops.render.render(write_still=True)

chase_d = bpy.data.cameras.new("Chase")
chase_d.lens = 32
chase_d.clip_end = 2000
chase = bpy.data.objects.new("Chase", chase_d)
scene.collection.objects.link(chase)
ci, ti, ni = frame(74)
chase.location = (ci.x - ni.x * 1.8, ci.y - ni.y * 1.8, 2.3)
tgt = bpy.data.objects["Car ahead"].location + Vector((0, 0, 0.6))
chase.rotation_euler = (tgt - chase.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = chase
scene.render.resolution_x, scene.render.resolution_y = 1200, 700
scene.render.filepath = os.path.join(ART, "screen-top.png")
bpy.ops.render.render(write_still=True)
print("screens done")

"""
Physically grounded material pass for close-up studio renders (render_studio.py --real).

The builder's materials are tuned for small, fast previews; up close they read as plastic. This pass
rebuilds the hero materials: brushed machined alloy with anisotropic highlights, black and graphite
anodised alloy, a 2x2 twill carbon weave under a clear coat, napped Alcantara-style suede on the rim
and an emissive wheel display with real dash art. Only node trees change; geometry is untouched.
"""
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "rig3d", "cache"))


def fresh(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, b


def setv(b, **kw):
    names = {"base": "Base Color", "metal": "Metallic", "rough": "Roughness", "aniso": "Anisotropic",
             "aniso_rot": "Anisotropic Rotation", "coat": "Coat Weight", "coat_rough": "Coat Roughness",
             "sheen": "Sheen Weight", "sheen_rough": "Sheen Roughness", "sheen_tint": "Sheen Tint",
             "spec": "Specular IOR Level", "spec_tint": "Specular Tint", "emit": "Emission Color", "emit_k": "Emission Strength"}
    for k, v in kw.items():
        sock = b.inputs[names[k]]
        if isinstance(v, (tuple, list)) and len(v) == 3:
            v = (*v, 1.0)
        sock.default_value = v


def fine_grain(nt, b, lo, hi, scale=900.0, stretch=(1.0, 1.0, 60.0)):
    """High-frequency stretched noise into roughness: machining/brush lines instead of blotches."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 3.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.3
    mr.inputs["From Max"].default_value = 0.7
    mr.inputs["To Min"].default_value = lo
    mr.inputs["To Max"].default_value = hi
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.03
    bump.inputs["Distance"].default_value = 0.0002
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])


def brushed(name, base, rough=(0.18, 0.3), aniso=0.7, edge=None):
    """Metal: F0 from base, the grazing (F82) tint kept near the base so dark anodising stays dark."""
    m, nt, b = fresh(name)
    setv(b, base=base, metal=1.0, aniso=aniso, spec_tint=edge or tuple(min(1.0, c * 1.6 + 0.04) for c in base))
    fine_grain(nt, b, *rough)
    return m


def carbon(name="Carbon fibre"):
    m, nt, b = fresh(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ck = nt.nodes.new("ShaderNodeTexChecker")
    ck.inputs["Scale"].default_value = 320.0
    ck.inputs["Color1"].default_value = (1, 1, 1, 1)
    ck.inputs["Color2"].default_value = (0, 0, 0, 1)
    nt.links.new(tc.outputs["Object"], ck.inputs["Vector"])
    # alternate tows: slightly different tone and a 90-degree turn of the anisotropic sheen
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.0035, 0.0037, 0.004, 1)
    mix.inputs[7].default_value = (0.0075, 0.008, 0.009, 1)
    nt.links.new(ck.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    rot = nt.nodes.new("ShaderNodeMath")
    rot.operation = "MULTIPLY"
    rot.inputs[1].default_value = 0.25
    nt.links.new(ck.outputs["Fac"], rot.inputs[0])
    nt.links.new(rot.outputs["Value"], b.inputs["Anisotropic Rotation"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.025
    bump.inputs["Distance"].default_value = 0.0002
    nt.links.new(ck.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    setv(b, metal=0.0, rough=0.3, aniso=0.85, spec=0.6, coat=1.0, coat_rough=0.035)
    return m


def suede(name="Suede grip"):
    m, nt, b = fresh(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1400.0
    nz.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.0004
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    setv(b, base=(0.007, 0.007, 0.0075), rough=0.97, spec=0.12, sheen=0.18, sheen_rough=0.5,
         sheen_tint=(0.16, 0.16, 0.17))
    return m


def display(ob):
    """Emissive dash art mapped onto the display's two largest local axes, behind a glossy cover glass."""
    img = bpy.data.images.load(os.path.join(CACHE, "wheel-dash.png"), check_existing=True)
    m, nt, b = fresh("Wheel display (real)")
    dims = sorted(range(3), key=lambda i: -ob.dimensions[i])
    u, v = dims[0], dims[1]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["XYZ"[u]], comb.inputs["X"])
    flip = nt.nodes.new("ShaderNodeMath")
    flip.operation = "SUBTRACT"
    flip.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["XYZ"[v]], flip.inputs[1])
    nt.links.new(flip.outputs["Value"] if os.environ.get("DASH_FLIP_V") else sep.outputs["XYZ"[v]], comb.inputs["Y"])
    if not os.environ.get("DASH_NO_FLIP_U"):
        fu = nt.nodes.new("ShaderNodeMath")
        fu.operation = "SUBTRACT"
        fu.inputs[0].default_value = 1.0
        nt.links.new(sep.outputs["XYZ"[u]], fu.inputs[1])
        nt.links.new(fu.outputs["Value"], comb.inputs["X"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.extension = "CLIP"
    nt.links.new(comb.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    setv(b, base=(0.0, 0.0, 0.0), rough=0.04, spec=0.5, coat=1.0, coat_rough=0.02, emit_k=3.5)
    ob.material_slots[0].material = m


def apply():
    bpy.data.materials.get("Machined aluminium") and brushed("Machined aluminium", (0.64, 0.65, 0.67))
    brushed("Motor housing", (0.035, 0.036, 0.04), rough=(0.28, 0.4), aniso=0.55)
    bpy.data.materials.get("Black anodised aluminium") and brushed(
        "Black anodised aluminium", (0.03, 0.031, 0.034), rough=(0.3, 0.42), aniso=0.5)
    graphite = brushed("Graphite anodised", (0.09, 0.092, 0.1), rough=(0.24, 0.34), aniso=0.6)
    cf = carbon()
    suede()
    for ob in bpy.data.collections["wheel"].objects:
        if ob.name == "Wheel display" and ob.material_slots:
            display(ob)
            continue
        # spokes, paddles and plates on the wheel: graphite anodised, the quick release stays bright
        if ob.name.startswith("Quick release") or ob.name.startswith("Encoder"):
            continue
        for s in getattr(ob, "material_slots", []):
            if s.material and s.material.name == "Machined aluminium":
                s.material = cf if ob.name.startswith("Paddle") else graphite
    print("realism pass applied", flush=True)

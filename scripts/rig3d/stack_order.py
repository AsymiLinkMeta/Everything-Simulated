"""
Works out the back-to-front stacking order of the preview layers from per-layer depth maps
(render_rig.py --mode depth) and reports any pair that overlaps both ways, which a plain
stack cannot draw correctly.

    blender -b -P scripts/rig3d/stack_order.py -- /tmp/rig-depth
"""
import glob
import itertools
import os
import sys

import bpy
import numpy as np

d = sys.argv[sys.argv.index("--") + 1]
maps = {}
for f in sorted(glob.glob(os.path.join(d, "depth-*.exr"))):
    name = os.path.basename(f)[len("depth-"):].rsplit("-", 1)[0]
    img = bpy.data.images.load(f)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[..., 0]
    maps[name] = px
    bpy.data.images.remove(img)

STAND = ["mount", "mount-sides", "mount-top", "screen-center", "screen-sides", "screen-dual", "screen-top", "pc"]
for raised in (False, True):
    names = [n for n in maps if n.endswith("--raised") == raised and "--raised" in n or (not raised and "--raised" not in n)]
    if raised:
        names = [n for n in maps if n.endswith("--raised")] + STAND
    else:
        names = [n for n in maps if "--raised" not in n and n != "motion"]
    front = {n: set() for n in names}
    print("\n== raised" if raised else "\n== ground")
    for a, b in itertools.combinations(names, 2):
        A, B = maps[a], maps[b]
        both = (A < 1e5) & (B < 1e5)
        n = int(both.sum())
        if not n:
            continue
        a_front = int((A[both] < B[both] - 1e-4).sum())
        b_front = int((B[both] < A[both] - 1e-4).sum())
        if min(a_front, b_front) > 6:
            print(f"CONFLICT {a} / {b}: {a} in front on {a_front}px, {b} in front on {b_front}px")
        if a_front > b_front:
            front[a].add(b)
        elif b_front > a_front:
            front[b].add(a)
    # back-to-front: emit a layer once everything it is in front of has been emitted
    order, left = [], set(names)
    while left:
        ready = sorted(n for n in left if not (front[n] & left))
        if not ready:
            print("CYCLE among", sorted(left))
            ready = sorted(left)
        order.append(ready[0])
        left.remove(ready[0])
    print("ORDER", " < ".join(order))

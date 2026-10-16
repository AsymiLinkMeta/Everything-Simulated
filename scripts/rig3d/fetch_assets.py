"""
Downloads the CC0 HDRIs and textures the rig renders use from Poly Haven (polyhaven.com, CC0) into
assets/rig3d/cache/ (gitignored; the renders that use them are committed).

    python3 scripts/rig3d/fetch_assets.py
"""
import json
import os
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "assets", "rig3d", "cache")
UA = {"User-Agent": "everything-simulated-rig-renders/1.0"}
HDRIS = {"studio_small_09": "2k", "meadow_2": "8k"}
TEXTURES = {
    "asphalt_track": ["Diffuse", "nor_gl", "Rough"],
    "leafy_grass": ["Diffuse", "nor_gl", "Rough"],
    "fabric_pattern_07": ["nor_gl", "Rough"],
    "denim_fabric": ["Diffuse", "nor_gl", "Rough"],
}


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()


def save(url, name):
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        open(path, "wb").write(fetch(url))
        print("fetched", name)


os.makedirs(CACHE, exist_ok=True)
for asset, res in HDRIS.items():
    files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset}"))
    save(files["hdri"][res]["hdr"]["url"], f"{asset}_{res}.hdr")
for asset, maps in TEXTURES.items():
    files = json.loads(fetch(f"https://api.polyhaven.com/files/{asset}"))
    for m in maps:
        save(files[m]["2k"]["jpg"]["url"], f"{asset}_{m}.jpg")

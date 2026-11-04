#!/usr/bin/env python3
"""Convert data/mmc1_insulinaemic_index.csv into data/foods.json and run data checks.

The CSV (Supplemental Table 1 of Hendricks et al., 2024) is the source of truth.
Every published value is copied through as an unchanged string. The only fields
added are derived helpers the website needs for filtering and sorting:
group, ref, iiValue and searchKey. No low/high bands are added: the paper gives
no agreed cut-off, so the site shows each II as published.

Usage:  python3 scripts/build_foods.py           (build + check)
        python3 scripts/build_foods.py --check   (check only, no write)
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "mmc1_insulinaemic_index.csv"
JSON_PATH = ROOT / "data" / "foods.json"
PHOTO_MAP_PATH = ROOT / "data" / "photo_map.csv"      # Number -> photo type (blank = no photo)
PHOTO_TYPES_PATH = ROOT / "data" / "photo_types.csv"  # photo type -> file and credit

# The paper's 25 categories are folded into 14 browsing groups for this site.
# The original category is always kept and shown on each food.
# Columns: id, label, representative photo type, background colour, ink colour, paper categories.
GROUPS = [
    ("bread", "Bread", "white-bread", "#F4E3CB", "#74491B", ["Bread"]),
    ("bakes", "Biscuits & Bakes", "choc-chip-cookie", "#FCE0CC", "#8E4214",
     ["Cookies, Crackers & Biscuits", "Bakery Products (Non-Bread)"]),
    ("cereals", "Cereals, Grains & Fibre", "muesli", "#EEEDC6", "#5C5A0E",
     ["Cereals & Cereal-Based Food", "Non-Rice Grains & Non-Rice Grains Products",
      "Fibre & Fibre-Based Products"]),
    ("rice", "Rice, Pasta & Noodles", "white-rice", "#E4F0D2", "#42601A",
     ["Rice & Rice Products", "Pasta & Noodles"]),
    ("potatoes", "Potatoes", "boiled-potato", "#F8EAC0", "#6F5408", ["Potatoes & Potato-Based Meals"]),
    ("fruit", "Fruit", "apple", "#FADBE5", "#9A2850", ["Fruits", "Fruit Products"]),
    ("veg", "Vegetables, Legumes & Nuts", "broccoli", "#D8F0DC", "#24683A",
     ["Vegetables & Vegetable Products", "Legumes, Pulse Products & Dishes", "Seed / Nut Products"]),
    ("dairy", "Dairy", "milk", "#D7E8F7", "#24588A", ["Dairy Products"]),
    ("protein", "Meat, Fish & Eggs", "roast-chicken", "#FADAD5", "#9A2F22",
     ["Animal Protein, Poultry / Seafood / Meat Meals"]),
    ("drinks", "Drinks", "orange-juice", "#D3EFEA", "#1B6458", ["Beverages"]),
    ("snacks", "Snacks & Sweeteners", "chocolate-bar", "#F4DDF2", "#823479", ["Snack Food", "Sweeteners"]),
    ("meals", "Breakfast, Lunch & Dinner", "lasagne", "#ECE6DF", "#5A4B3E",
     ["Breakfast / Tea-Time Meals", "Lunch / Dinner Meals (Non-Rice)", "Lunch / Dinner Meals (Rice)"]),
    ("regional", "Regional & Traditional", "dosa", "#E9DFF7", "#5E3A8E", ["Regional / Traditional Food"]),
    ("special", "Infant & Nutrition Products", "infant-formula", "#DFE2FA", "#3B4697",
     ["Infant Formulae / Food",
      "Nutritional Support Products, Meal Replacement Food, Formulae & Bars"]),
]
CATEGORY_TO_GROUP = {c: g[0] for g in GROUPS for c in g[5]}

def search_key(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[‡¶†§*]|\|\|", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def load_photos():
    """Photo types with an image file on disk, and the Number -> photo type map.

    A photo shows the type of food (for example "rye bread"), not the exact product tested.
    """
    photo_map = {}
    if PHOTO_MAP_PATH.exists():
        with PHOTO_MAP_PATH.open(encoding="utf-8-sig", newline="") as fh:
            photo_map = {r["Number"]: r["Photo type"].strip() for r in csv.DictReader(fh)}
    photos = {}
    if PHOTO_TYPES_PATH.exists():
        with PHOTO_TYPES_PATH.open(encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh):
                kind = r["Photo type"].strip()
                src = f"assets/img/foods/{kind}.jpg"
                thumb = f"assets/img/foods/thumb/{kind}.jpg"
                if not ((ROOT / src).exists() and (ROOT / thumb).exists()):
                    continue
                photos[kind] = {
                    "label": r["Shows"], "src": src, "thumb": thumb,
                    "credit": {"title": r["Title"], "author": r["Author"], "authorUrl": r["Author URL"],
                               "licence": r["Licence"], "licenceUrl": r["Licence URL"],
                               "source": r["Source URL"], "via": r["Via"]},
                }
    return photos, photo_map


def build():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    foods = []
    for row in rows:
        category = row["Category"]
        if category not in CATEGORY_TO_GROUP:
            sys.exit(f"Unknown category {category!r} in row {row['Number']}: add it to GROUPS")
        comparator = row["Comparator"]
        foods.append({
            "n": row["Number"],
            "name": row["Food / Beverage Name"],
            "category": category,
            "subcategory": row["Subcategory"],
            "portion": row["Total Weight (g) / Portion"],
            "meal": row["Single / Mixed Meal"],
            "ii": row["II"],
            "iiNote": row["II footnote"],
            "subjects": row["Subject Details (No. of Subjects)"],
            "comparator": comparator,
            "study": row["Author / Year / Reference"],
            "country": row["Country"],
            # derived helpers
            "iiValue": float(row["II"]),
            "group": CATEGORY_TO_GROUP[category],
            "ref": "bread" if "bread" in comparator.lower() else "glucose",
            "searchKey": search_key(row["Food / Beverage Name"]),
        })

    photos, photo_map = load_photos()
    for f in foods:
        kind = photo_map.get(f["n"], "")
        f["photo"] = kind if kind in photos else None

    groups = [
        {"id": g[0], "label": g[1], "photo": g[2] if g[2] in photos else None, "bg": g[3], "ink": g[4], "categories": g[5]}
        for g in GROUPS
    ]
    return rows, {
        "source": {
            "citation": "Hendricks SA, Paul MJ, Subramaniam Y, Vijayam B. A collectanea of food "
                        "insulinaemic index: 2023. Clinical Nutrition ESPEN. 2024;63:92–104.",
            "doi": "https://doi.org/10.1016/j.clnesp.2024.06.017",
            "licence": "CC BY-NC-ND 4.0",
            "table": "Supplemental Table 1",
        },
        "groups": groups,
        "photos": photos,
        "foods": foods,
    }


def check(rows, data):
    foods = data["foods"]
    results = []

    def expect(label, actual, expected):
        results.append((actual == expected, label, actual, expected))

    meal = Counter(f["meal"] for f in foods)
    ref = Counter(f["ref"] for f in foods)
    group = Counter(f["group"] for f in foods)
    studies = {re.search(r"\[(\d+)\]", f["study"]).group(1) for f in foods}

    expect("foods", len(foods), 629)
    expect("SINGLE", meal["SINGLE"], 469)
    expect("MIXED MEAL", meal["MIXED MEAL"], 160)
    expect("sum of II", sum(Decimal(f["ii"]) for f in foods), Decimal("42429.12"))
    expect("lowest II", min(f["iiValue"] for f in foods), 1.0)
    expect("highest II", max(f["iiValue"] for f in foods), 209.0)
    expect("vs bread", ref["bread"], 227)
    expect("vs glucose", ref["glucose"], 402)
    expect("countries", len({f["country"] for f in foods}), 32)
    expect("studies (unique reference numbers)", len(studies), 80)
    expect("single foods vs glucose / vs bread",
           (sum(1 for f in foods if f["meal"] == "SINGLE" and f["ref"] == "glucose"),
            sum(1 for f in foods if f["meal"] == "SINGLE" and f["ref"] == "bread")), (344, 125))
    expect("groups", len(group), 14)
    expect("group counts add up", sum(group.values()), 629)
    mapped = {f["n"]: f["photo"] for f in foods}
    with PHOTO_MAP_PATH.open(encoding="utf-8-sig", newline="") as fh:
        map_rows = list(csv.DictReader(fh))
    expect("photo map lists every food in order", [r["Number"] for r in map_rows] == [f["n"] for f in foods], True)
    expect("mixed meals have no photo", sum(1 for f in foods if f["meal"] == "MIXED MEAL" and f["photo"]), 0)
    missing = sorted({r["Photo type"] for r in map_rows if r["Photo type"]} - set(data["photos"]))
    expect("photo types still without a photo", len(missing), 0)
    if missing:
        print("  missing photos: " + ", ".join(missing[:12]) + (" …" if len(missing) > 12 else ""))
    expect("values copied unchanged", all(
        f["name"] == r["Food / Beverage Name"] and f["ii"] == r["II"] and f["study"] == r["Author / Year / Reference"]
        for f, r in zip(foods, rows)), True)

    width = max(len(r[1]) for r in results)
    for ok, label, actual, expected in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {label.ljust(width)}  {actual}" + ("" if ok else f"  (expected {expected})"))
    print("  group counts: " + ", ".join(f"{g['id']} {group[g['id']]}" for g in data["groups"]))
    return all(r[0] for r in results)


def main():
    rows, data = build()
    ok = check(rows, data)
    if "--check" not in sys.argv:
        JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Wrote {JSON_PATH.relative_to(ROOT)} ({JSON_PATH.stat().st_size // 1024} KB)")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

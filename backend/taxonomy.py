"""One product classification for every page: asset class → product type → subcategory → product.

The four asset classes are the ones the CIO's bands and every client's allocation use. Products Kova
doesn't sell (direct equity, ETFs, SIFs, REITs…) are listed too, so outside holdings from a statement
can be placed on the same tree later.
"""
from __future__ import annotations

ASSET_CLASSES = ["Equity", "Debt", "Gold", "Cash"]

# asset class → product type → subcategories. Types Kova doesn't offer yet are marked off-shelf.
TREE: dict[str, dict[str, list[str]]] = {
    "Equity": {
        "Mutual fund": ["Large cap", "Flexi cap", "Mid cap", "Small cap", "Index", "ELSS", "International FoF",
                        "Balanced advantage", "Multi asset", "Sectoral and thematic"],
        "PMS": ["Mid and small cap", "Multi cap quality"],
        "AIF": ["Long-short equity"],
        "SIF": ["Equity long-short", "Hybrid long-short"],
        "Direct equity": ["Listed shares"],
        "ETF": ["Index ETF"],
        "Unlisted shares": ["Pre-IPO"],
    },
    "Debt": {
        "Mutual fund": ["Corporate bond", "Short duration", "Gilt", "Dynamic bond", "Credit risk"],
        "AIF": ["Private credit", "Real estate"],
        "Bond": ["Secured NCD", "G-Sec", "Tax-free bond"],
        "Fixed deposit": ["Bank FD", "Corporate FD"],
        "REIT and InvIT": ["REIT", "InvIT"],
    },
    "Gold": {
        "Mutual fund": ["Gold FoF"],
        "Bond": ["Sovereign gold bond"],
        "ETF": ["Gold ETF"],
        "Physical and digital gold": ["Digital gold"],
    },
    "Cash": {
        "Mutual fund": ["Liquid", "Arbitrage", "Overnight"],
        "Savings": ["Bank balance"],
    },
}
OFF_SHELF_TYPES = {"SIF", "Direct equity", "ETF", "Unlisted shares", "REIT and InvIT", "Physical and digital gold", "Savings"}

# Kova products by id → (asset class, product type, subcategory). The holding's own asset class
# in the sample data already follows this (hybrids count as equity, liquid and arbitrage as cash).
_PRODUCTS: dict[str, tuple[str, str, str]] = {
    "PD-101": ("Equity", "Mutual fund", "Flexi cap"),
    "PD-102": ("Equity", "Mutual fund", "Large cap"),
    "PD-103": ("Equity", "Mutual fund", "Mid cap"),
    "PD-104": ("Equity", "Mutual fund", "Small cap"),
    "PD-105": ("Equity", "Mutual fund", "Balanced advantage"),
    "PD-106": ("Equity", "Mutual fund", "Multi asset"),
    "PD-107": ("Debt", "Mutual fund", "Corporate bond"),
    "PD-108": ("Debt", "Mutual fund", "Short duration"),
    "PD-109": ("Cash", "Mutual fund", "Liquid"),
    "PD-110": ("Cash", "Mutual fund", "Arbitrage"),
    "PD-111": ("Equity", "Mutual fund", "Index"),
    "PD-112": ("Equity", "Mutual fund", "ELSS"),
    "PD-113": ("Equity", "Mutual fund", "International FoF"),
    "PD-114": ("Gold", "Mutual fund", "Gold FoF"),
    "PD-201": ("Equity", "PMS", "Mid and small cap"),
    "PD-202": ("Equity", "PMS", "Multi cap quality"),
    "PD-301": ("Debt", "AIF", "Private credit"),
    "PD-302": ("Equity", "AIF", "Long-short equity"),
    "PD-303": ("Debt", "AIF", "Real estate"),
    "PD-401": ("Debt", "Bond", "Secured NCD"),
    "PD-402": ("Debt", "Bond", "Secured NCD"),
    "PD-403": ("Debt", "Bond", "G-Sec"),
    "PD-404": ("Debt", "Bond", "Tax-free bond"),
    "PD-501": ("Debt", "Fixed deposit", "Bank FD"),
    "PD-502": ("Debt", "Fixed deposit", "Corporate FD"),
    "PD-601": ("Gold", "Bond", "Sovereign gold bond"),
}
# Loans against securities are a credit line, not an investment: no place in the asset tree.
CREDIT_PRODUCTS = {"PD-701"}


def classify(product: dict) -> dict:
    """The taxonomy fields for a Kova product (empty for credit products)."""
    t = _PRODUCTS.get(product["id"])
    if not t:
        return {"asset_class": None, "product_type": product.get("category"), "subcategory": product.get("sub_category")}
    return {"asset_class": t[0], "product_type": t[1], "subcategory": t[2]}


def tree(products: list[dict]) -> list[dict]:
    """The whole classification with how many Kova products sit at each level."""
    out = []
    for ac, types in TREE.items():
        tlist = []
        for pt, subs in types.items():
            slist = []
            for s in subs:
                ids = [p["id"] for p in products if p.get("asset_class") == ac and p.get("product_type") == pt and p.get("subcategory") == s]
                slist.append({"name": s, "products": ids})
            tlist.append({"name": pt, "on_shelf": pt not in OFF_SHELF_TYPES, "subcategories": slist,
                          "count": sum(len(x["products"]) for x in slist)})
        out.append({"name": ac, "types": tlist, "count": sum(t["count"] for t in tlist)})
    return out

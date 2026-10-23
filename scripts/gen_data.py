"""Generate KOVA Work mock data.

All dates are written relative to ANCHOR. The API shifts every date by
(today - ANCHOR) when it seeds the database, so the demo always looks current.
Run:  python3 scripts/gen_data.py
"""
import json, random, os, datetime as dt

random.seed(42)
ANCHOR = dt.date(2026, 10, 26)  # a Monday
OUT = os.path.join(os.path.dirname(__file__), "..", "data")


def d(days):  # date string relative to anchor
    return (ANCHOR + dt.timedelta(days=days)).isoformat()


def t(days, hh=10, mm=0):  # datetime string relative to anchor (IST, naive)
    x = dt.datetime.combine(ANCHOR + dt.timedelta(days=days), dt.time(hh, mm))
    return x.isoformat(timespec="minutes")


def w(name, obj):
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------- RM
rm = {
    "id": "RM-0042",
    "name": "Priya Sharma",
    "title": "Senior Relationship Manager",
    "grade": "AVP",
    "branch": "Mumbai West",
    "email": "priya.sharma@kova.in",
    "phone": "+91 98200 41842",
    "joined": d(-2 * 365 - 40),
    "euin": "E482913",
    "arn": "ARN-271845",
    "certifications": ["NISM Series V-A (Mutual Fund Distributors)", "NISM Series XV (Research Analyst)", "NISM Series X-A (Investment Adviser L1)"],
    "languages": ["English", "Hindi", "Marathi", "Gujarati"],
    "manager": {"id": "RM-0007", "name": "Rohan Kapoor", "title": "Branch Head, Mumbai West"},
    "photo": None,
    "about": "Works with business-owner and professional families across the western suburbs. Focus on long-term portfolios, debt allocation and succession conversations.",
}
w("rm", rm)

# ---------------------------------------------------------------- products
MANUF = {
    "Banyan": "Banyan Mutual Fund", "Meridian": "Meridian AMC", "Sahyadri": "Sahyadri Mutual Fund",
    "Indus Peak": "Indus Peak Asset Managers", "Coastline": "Coastline Capital", "Harbor": "Harbor Bank",
}
products = []


def prod(pid, name, manuf, cat, sub, risk, r1, r3, r5, minimum, liquidity, **kw):
    p = {
        "id": pid, "name": name, "manufacturer": manuf, "category": cat, "sub_category": sub,
        "risk": risk, "returns": {"1y": r1, "3y": r3, "5y": r5}, "min_investment": minimum,
        "liquidity": liquidity,
    }
    p.update(kw)
    products.append(p)


prod("PD-101", "Banyan Flexi Cap Fund", MANUF["Banyan"], "Mutual fund", "Equity: Flexi cap", "Very high", 14.2, 18.6, 19.4, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.68, aum_cr=48210, benchmark="Nifty 500 TRI", fund_manager="Aditi Rao")
prod("PD-102", "Meridian Large Cap Fund", MANUF["Meridian"], "Mutual fund", "Equity: Large cap", "Very high", 9.8, 14.1, 15.3, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.74, aum_cr=36120, benchmark="Nifty 100 TRI", fund_manager="Karan Bhatia")
prod("PD-103", "Sahyadri Mid Cap Opportunities", MANUF["Sahyadri"], "Mutual fund", "Equity: Mid cap", "Very high", 21.4, 24.8, 26.1, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.81, aum_cr=22840, benchmark="Nifty Midcap 150 TRI", fund_manager="Neha Kulkarni")
prod("PD-104", "Indus Peak Small Cap Fund", MANUF["Indus Peak"], "Mutual fund", "Equity: Small cap", "Very high", 18.9, 27.2, 29.0, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.88, aum_cr=14310, benchmark="Nifty Smallcap 250 TRI", fund_manager="Vikram Shetty")
prod("PD-105", "Banyan Balanced Advantage Fund", MANUF["Banyan"], "Mutual fund", "Hybrid: Balanced advantage", "High", 10.6, 12.4, 12.9, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.71, aum_cr=29880, benchmark="Nifty 50 Hybrid Composite Debt 50:50", fund_manager="Aditi Rao")
prod("PD-106", "Meridian Multi Asset Allocation", MANUF["Meridian"], "Mutual fund", "Hybrid: Multi asset", "High", 13.1, 15.0, 14.6, 5000, "T+3, exit load 1% within 1 year", expense_ratio=0.65, aum_cr=11250, benchmark="Nifty 500 65% + Debt 25% + Gold 10%", fund_manager="Karan Bhatia")
prod("PD-107", "Sahyadri Corporate Bond Fund", MANUF["Sahyadri"], "Mutual fund", "Debt: Corporate bond", "Moderate", 7.9, 7.1, 7.0, 5000, "T+1, no exit load", expense_ratio=0.32, aum_cr=26400, benchmark="CRISIL Corporate Bond A-II", fund_manager="Rahul Menon", ytm=7.42, duration_yrs=3.1)
prod("PD-108", "Meridian Short Duration Fund", MANUF["Meridian"], "Mutual fund", "Debt: Short duration", "Low to moderate", 7.6, 6.9, 6.8, 5000, "T+1, no exit load", expense_ratio=0.29, aum_cr=15620, benchmark="CRISIL Short Duration A-II", fund_manager="Ishaan Gupta", ytm=7.28, duration_yrs=2.4)
prod("PD-109", "Banyan Liquid Fund", MANUF["Banyan"], "Mutual fund", "Debt: Liquid", "Low to moderate", 7.1, 6.6, 5.4, 500, "T+1, graded exit load for 7 days", expense_ratio=0.18, aum_cr=61200, benchmark="CRISIL Liquid Debt A-I", fund_manager="Rahul Menon", ytm=6.95, duration_yrs=0.1)
prod("PD-110", "Indus Peak Arbitrage Fund", MANUF["Indus Peak"], "Mutual fund", "Hybrid: Arbitrage", "Low", 7.4, 6.9, 5.8, 5000, "T+2, exit load 0.25% within 30 days", expense_ratio=0.35, aum_cr=18730, benchmark="Nifty 50 Arbitrage", fund_manager="Pooja Iyer")
prod("PD-111", "Sahyadri Nifty 50 Index Fund", MANUF["Sahyadri"], "Mutual fund", "Equity: Index", "Very high", 8.9, 13.2, 14.8, 1000, "T+3, no exit load", expense_ratio=0.18, aum_cr=9420, benchmark="Nifty 50 TRI", fund_manager="Neha Kulkarni")
prod("PD-112", "Meridian ELSS Tax Saver", MANUF["Meridian"], "Mutual fund", "Equity: ELSS", "Very high", 15.6, 17.9, 18.2, 500, "3-year lock-in", expense_ratio=0.79, aum_cr=12880, benchmark="Nifty 500 TRI", fund_manager="Karan Bhatia")
prod("PD-113", "Coastline International Equity FoF", MANUF["Coastline"], "Mutual fund", "Equity: International FoF", "Very high", 22.3, 12.6, 15.1, 5000, "T+5, exit load 1% within 1 year", expense_ratio=0.62, aum_cr=3870, benchmark="MSCI ACWI", fund_manager="Sana Merchant")
prod("PD-114", "Banyan Gold ETF FoF", MANUF["Banyan"], "Mutual fund", "Commodity: Gold", "High", 24.8, 17.2, 13.4, 1000, "T+3, exit load 1% within 15 days", expense_ratio=0.15, aum_cr=5240, benchmark="Domestic gold price", fund_manager="Pooja Iyer")
prod("PD-201", "Indus Peak Emerging Leaders PMS", MANUF["Indus Peak"], "PMS", "Equity: Mid and small cap", "Very high", 26.1, 25.4, 24.0, 5000000, "Redeem any time; exit load 2% in year 1", fee="2% fixed or 1% + 15% over 10% hurdle", strategy_aum_cr=3120, fund_manager="Vikram Shetty", stocks=24)
prod("PD-202", "Coastline Quality Compounders PMS", MANUF["Coastline"], "PMS", "Equity: Multi cap quality", "Very high", 15.4, 19.8, 20.6, 5000000, "Redeem any time; exit load 1% in year 1", fee="1.75% fixed", strategy_aum_cr=5860, fund_manager="Arjun Desai", stocks=20)
prod("PD-301", "Meridian Private Credit Fund III", MANUF["Meridian"], "AIF", "Category II: Private credit", "High", None, None, None, 10000000, "Closed-ended, 4 years + 1 year extension", target_irr="13-14% gross", commitment_period="18 months", close_date=d(52), fee="1.5% on drawn capital + 10% carry over 10% hurdle")
prod("PD-302", "Indus Peak Long-Short Fund", MANUF["Indus Peak"], "AIF", "Category III: Long-short equity", "Very high", 16.2, 15.1, None, 10000000, "Monthly liquidity after 1-year lock-in", fee="1.5% + 20% over 10% hurdle")
prod("PD-303", "Coastline Real Estate Yield Fund", MANUF["Coastline"], "AIF", "Category II: Real estate", "High", None, None, None, 10000000, "Closed-ended, 5 years", target_irr="15-16% gross", close_date=d(24), fee="2% + 15% carry over 12% hurdle", is_new=True)
prod("PD-401", "Western Highways InvIT NCD 2031", "Western Highways InvIT", "Bond", "Secured NCD, AAA", "Moderate", None, None, None, 100000, "Listed; secondary market liquidity limited", coupon=7.95, ytm=7.88, rating="AAA (CRISIL)", maturity=d(5 * 365 - 30), payout="Quarterly")
prod("PD-402", "Coastal Housing Finance NCD 2029", "Coastal Housing Finance", "Bond", "Secured NCD, AA+", "Moderately high", None, None, None, 10000, "Listed; secondary market liquidity limited", coupon=8.85, ytm=8.9, rating="AA+ (ICRA)", maturity=d(3 * 365 - 75), payout="Monthly", is_new=True)
prod("PD-403", "Government of India 7.18% 2037", "Government of India", "Bond", "G-Sec", "Low to moderate", None, None, None, 10000, "Listed; RBI Retail Direct and secondary market", coupon=7.18, ytm=6.98, rating="Sovereign", maturity=d(11 * 365), payout="Half-yearly")
prod("PD-404", "State Power Utility Tax-free 2032", "State Power Utility", "Bond", "Tax-free bond, AAA", "Low to moderate", None, None, None, 1000, "Listed; secondary market only", coupon=7.35, ytm=5.6, rating="AAA (CARE)", maturity=d(6 * 365 - 20), payout="Annual")
prod("PD-501", "Harbor Bank Senior Citizen FD", MANUF["Harbor"], "Fixed deposit", "Bank FD", "Low", None, None, None, 10000, "Premature withdrawal with 0.5% penalty", rate=7.75, tenor="1-5 years", insured_upto=500000)
prod("PD-502", "Coastal Housing Finance FD", "Coastal Housing Finance", "Fixed deposit", "Corporate FD, AAA", "Low to moderate", None, None, None, 25000, "Premature withdrawal after 3 months", rate=8.05, tenor="1-5 years", rating="AAA (CRISIL)")
prod("PD-601", "Sovereign Gold Bond (secondary)", "Reserve Bank of India", "Bond", "Sovereign gold bond", "High", 25.6, 17.0, 14.1, 5000, "Listed; RBI early redemption after year 5", coupon=2.5, rating="Sovereign")
prod("PD-701", "Kova Loan Against Securities", "Partner NBFC", "Credit", "Loan against mutual funds and shares", "—", None, None, None, 1000000, "Overdraft; repay any time", rate=9.75, ltv="Up to 50% equity, 80% debt", is_new=True)

# CIO views, rewards, L&D, briefs
cio_auth = {"name": "Anand Iyer", "title": "Chief Investment Officer"}
cio_texts = {
    "PD-101": ("Preferred", "Our core equity holding for most moderate and above profiles. Manager has stayed true to style through two cycles; portfolio turnover is low. Use as the anchor, not as a satellite."),
    "PD-102": ("Neutral", "Fine as a large-cap anchor but the index fund delivers most of the same at a fraction of the cost. Prefer PD-111 for new money unless the client wants active management."),
    "PD-103": ("Preferred", "Mid-cap valuations are stretched; stagger entry over 6 months through STP. Cap at 15% of equity for moderate profiles."),
    "PD-104": ("Under review", "Strong numbers, but liquidity in the small-cap segment is thin. We are reviewing position sizing guidance; don't add fresh lumpsums until the review closes."),
    "PD-105": ("Preferred", "Good first equity product for conservative clients moving up the risk ladder. Dynamic equity range 30-80%."),
    "PD-106": ("Preferred", "The single-fund answer for clients who want equity, debt and gold in one place. Taxed as equity."),
    "PD-107": ("Preferred", "Core debt holding. Portfolio is 90%+ AAA. Suits 3-year horizons."),
    "PD-108": ("Neutral", "Use for 1-3 year money. Rate cuts are mostly priced in."),
    "PD-109": ("Neutral", "Parking only. Move to arbitrage for anything held longer than 3 months in the higher tax brackets."),
    "PD-110": ("Preferred", "Equity taxation with debt-like returns. Best parking option for 30%-bracket clients holding cash over 3 months."),
    "PD-111": ("Preferred", "Lowest-cost core equity exposure on the shelf."),
    "PD-112": ("Neutral", "Only for clients still on the old tax regime who need 80C."),
    "PD-113": ("Neutral", "Max 10% of equity. Currency adds to returns but also to volatility."),
    "PD-114": ("Preferred", "5-8% allocation as a hedge. We prefer SGB secondary for long holding periods because of tax treatment at maturity."),
    "PD-201": ("Preferred", "For clients with 5+ year horizon and high risk appetite only. Concentrated 24-stock book."),
    "PD-202": ("Preferred", "Steadier of our two PMS options. Good fit for business owners moving surplus from FDs into equity over time."),
    "PD-301": ("Preferred", "Senior secured lending to mid-market companies. Final close in under two months. Accredited or Rs 1 Cr+ clients only."),
    "PD-302": ("Neutral", "Lower drawdowns than long-only, but the fee drag is high. Discuss only with clients who value lower volatility over return."),
    "PD-303": ("Under review", "New launch. Diligence on the sponsor's track record is ongoing; hold client conversations until the CIO note is out."),
    "PD-401": ("Preferred", "AAA, secured on toll cash flows. Good quarterly income for retirees."),
    "PD-402": ("Neutral", "Higher yield for AA+ risk. Keep under 10% of debt for any one client."),
    "PD-403": ("Preferred", "Locks in today's yields for 11 years. Best for clients who want zero credit risk."),
    "PD-404": ("Preferred", "Excellent post-tax yield for 30%-bracket clients. Supply is thin; buy when available."),
    "PD-501": ("Neutral", "Only for senior citizens who insist on FDs; prefer the bond ladder."),
    "PD-502": ("Neutral", "Rate is competitive, but bank FDs have deposit insurance; explain the difference."),
    "PD-601": ("Preferred", "Preferred gold route for 5+ years: interest plus tax-free redemption at maturity."),
    "PD-701": ("Neutral", "Liquidity tool, not a leverage tool. Never pitch it for investing borrowed money."),
}
rewards = {
    "PD-101": 6, "PD-102": 4, "PD-103": 6, "PD-104": 5, "PD-105": 6, "PD-106": 6, "PD-107": 4, "PD-108": 3,
    "PD-109": 1, "PD-110": 2, "PD-111": 3, "PD-112": 5, "PD-113": 4, "PD-114": 3, "PD-201": 8, "PD-202": 8,
    "PD-301": 9, "PD-302": 7, "PD-303": 9, "PD-401": 3, "PD-402": 4, "PD-403": 2, "PD-404": 2, "PD-501": 1,
    "PD-502": 2, "PD-601": 2, "PD-701": 3,
}
contest_tags = {"PD-105": "CT-01", "PD-106": "CT-01", "PD-107": "CT-02", "PD-401": "CT-02", "PD-202": "CT-03"}
pm = {
    "Mutual fund": {"name": "Meera Joshi", "title": "Product Manager, Mutual Funds"},
    "PMS": {"name": "Siddharth Rao", "title": "Product Manager, PMS & AIF"},
    "AIF": {"name": "Siddharth Rao", "title": "Product Manager, PMS & AIF"},
    "Bond": {"name": "Farah Khan", "title": "Product Manager, Fixed Income"},
    "Fixed deposit": {"name": "Farah Khan", "title": "Product Manager, Fixed Income"},
    "Credit": {"name": "Farah Khan", "title": "Product Manager, Fixed Income"},
}


def ld_modules(p):
    cat = p["category"]
    base = [
        {"id": "m1", "title": f"What {p['name']} is", "type": "reading", "minutes": 6,
         "body": f"{p['name']} from {p['manufacturer']} sits in {p['sub_category']}. Read the one-page summary covering who it is for, how it makes money and what can go wrong."},
        {"id": "m2", "title": "Product manager walkthrough", "type": "video", "minutes": 12,
         "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" if False else None,
         "body": f"{pm[cat]['name']} explains the strategy, fees and the questions clients ask most. (Video link to be added by the product team.)"},
        {"id": "m3", "title": "Fact sheet and offer document", "type": "document", "minutes": 10,
         "body": "Latest fact sheet, key information memorandum and the regulatory disclosures you must share before the client invests."},
        {"id": "m4", "title": "Suitability: who it fits and who it doesn't", "type": "reading", "minutes": 7,
         "body": f"Risk level {p['risk']}. Match against the client's risk profile, horizon and liquidity needs. Never pitch to a client whose profile is lower than the product's risk."},
        {"id": "m5", "title": "Quick check", "type": "quiz", "minutes": 5,
         "body": "Two questions on liquidity and risk. Answer both correctly to complete the module.",
         "questions": [
             {"q": "What is the exit / liquidity condition?", "options": [p["liquidity"], "Daily liquidity with no conditions", "Locked in for 10 years"], "answer": 0},
             {"q": "What is the product's risk level?", "options": ["Low", p["risk"], "Not rated"] if p["risk"] != "Low" else ["Very high", p["risk"], "Not rated"], "answer": 1},
         ]},
    ]
    if cat in ("PMS", "AIF"):
        base.insert(3, {"id": "m3b", "title": "Eligibility, agreements and fees", "type": "reading", "minutes": 8,
                        "body": "Minimum ticket size, accredited investor rules, the client agreement, and how fixed and performance fees are charged."})
    return base


def brief(p):
    lines = [
        f"{p['name']} ({p['sub_category']}) from {p['manufacturer']}.",
        f"Risk: {p['risk']}. Minimum: Rs {p['min_investment']:,}. Liquidity: {p['liquidity']}.",
    ]
    r = p.get("returns", {})
    if r.get("3y"):
        lines.append(f"Returns: {r['1y']}% (1y), {r['3y']}% (3y CAGR), {r.get('5y') or '-'}% (5y CAGR). Past returns don't guarantee future returns.")
    for k in ("coupon", "ytm", "rate", "target_irr", "fee", "expense_ratio", "rating", "maturity"):
        if p.get(k) is not None:
            lines.append(f"{k.replace('_', ' ').capitalize()}: {p[k]}.")
    lines.append(f"CIO stance: {p['cio_view']['stance']}. {p['cio_view']['comment']}")
    return "\n".join(lines)


for p in products:
    st, txt = cio_texts[p["id"]]
    p["cio_view"] = {"stance": st, "comment": txt, "author": cio_auth, "date": d(-random.randint(3, 40))}
    p["rewards"] = {"points_per_lakh": rewards[p["id"]], "contest": contest_tags.get(p["id"])}
    p["product_manager"] = pm[p["category"]]
    p["is_new"] = p.get("is_new", False)
    p["launched"] = d(-random.randint(400, 3000)) if not p["is_new"] else d(-random.randint(5, 25))
    p["ld"] = {"modules": ld_modules(p), "video_url": None}
    p["brief"] = brief(p)
    p["highlights"] = []
    p["risks"] = []
    p["comments"] = [
        {"by": p["product_manager"], "kind": "product", "date": d(-random.randint(2, 30)),
         "text": "Updated fact sheet uploaded. Ask me if a client needs the full portfolio disclosure."}
    ]
    p["status"] = "Open" if not (p["category"] == "AIF" and p.get("close_date")) else "Open, closing " + p["close_date"]

hl = {
    "Mutual fund": (["Daily NAV, SIP and STP available", "Regulated by SEBI, held with registrar", "Diversified across 40-80 holdings"],
                    ["Market-linked; can fall 20-30% in a bad year", "Exit load if redeemed early"]),
    "PMS": (["Stocks held directly in the client's demat", "Concentrated portfolio run by a dedicated manager", "Quarterly manager letters"],
            ["Rs 50 lakh minimum", "Higher fees than mutual funds", "Concentration risk"]),
    "AIF": (["Access to private markets", "Institutional-grade diligence", "Accredited and Rs 1 Cr+ investors"],
            ["Illiquid for the fund's term", "Capital is drawn down over time", "Returns are targets, not guarantees"]),
    "Bond": (["Fixed income on a known schedule", "Listed on the exchange", "Rated by an approved agency"],
             ["Price changes if sold before maturity", "Credit risk below AAA"]),
    "Fixed deposit": (["Fixed rate for the tenor", "Simple to understand"], ["Interest fully taxable", "Penalty on early withdrawal"]),
    "Credit": (["Liquidity without selling investments", "Interest only on amount used"], ["Margin calls if pledged securities fall", "Not to be used to buy more investments"]),
}
for p in products:
    p["highlights"], p["risks"] = hl[p["category"]]
w("products", products)
P = {p["id"]: p for p in products}

# ---------------------------------------------------------------- families and clients
first_m = ["Rajesh", "Vikram", "Sanjay", "Anil", "Suresh", "Arvind", "Nitin", "Karan", "Rohit", "Amit", "Harish", "Mahesh", "Deepak", "Farhan", "Zubin", "Gautam"]
first_f = ["Anjali", "Kavita", "Sunita", "Meenal", "Rhea", "Pooja", "Nisha", "Shalini", "Tanvi", "Zarine", "Leena", "Radhika"]
fams = [
    ("FM-01", "Mehta", "Andheri West", "Textile exports business"),
    ("FM-02", "Desai", "Juhu", "Pharma distribution"),
    ("FM-03", "Kapadia", "Bandra West", "Chartered accountant practice"),
    ("FM-04", "Iyer", "Powai", "Senior technology executive"),
    ("FM-05", "Shah", "Santacruz", "Diamond trading"),
    ("FM-06", "Khanna", "Khar", "Film production"),
    ("FM-07", "Patil", "Goregaon", "Real estate developer"),
    ("FM-08", "Bhatt", "Vile Parle", "Retired banker"),
    ("FM-09", "Wadia", "Bandra West", "Hospitality family"),
    ("FM-10", "Nair", "Malad", "Doctor couple"),
    ("FM-11", "Agarwal", "Andheri East", "Logistics business"),
    ("FM-12", "Fernandes", "Bandra West", "Advertising agency founder"),
]

client_specs = [
    # family, first, gender, age, role, aum_lakh, segment, risk
    ("FM-01", "Rajesh", "M", 54, "Head", 1840, "active", "Moderately aggressive"),
    ("FM-01", "Kavita", "F", 51, "Spouse", 420, "active", "Moderate"),
    ("FM-01", "Rhea", "F", 26, "Daughter", 65, "engaged", "Aggressive"),
    ("FM-02", "Sanjay", "M", 61, "Head", 1260, "active", "Moderate"),
    ("FM-02", "Sunita", "F", 58, "Spouse", 380, "dormant", "Moderately conservative"),
    ("FM-03", "Amit", "M", 47, "Head", 690, "active", "Moderately aggressive"),
    ("FM-04", "Arvind", "M", 44, "Head", 540, "active", "Aggressive"),
    ("FM-04", "Meenal", "F", 42, "Spouse", 210, "engaged", "Moderate"),
    ("FM-05", "Harish", "M", 58, "Head", 2350, "active", "Moderate"),
    ("FM-05", "Tanvi", "F", 31, "Daughter-in-law", 140, "engaged", "Moderately aggressive"),
    ("FM-06", "Karan", "M", 39, "Head", 310, "dormant", "Aggressive"),
    ("FM-07", "Mahesh", "M", 63, "Head", 1520, "active", "Moderately conservative"),
    ("FM-07", "Nitin", "M", 35, "Son", 180, "engaged", "Aggressive"),
    ("FM-08", "Suresh", "M", 72, "Head", 460, "active", "Conservative"),
    ("FM-08", "Leena", "F", 68, "Spouse", 240, "active", "Conservative"),
    ("FM-09", "Zubin", "M", 50, "Head", 1980, "active", "Moderately aggressive"),
    ("FM-09", "Zarine", "F", 46, "Spouse", 520, "engaged", "Moderate"),
    ("FM-10", "Deepak", "M", 49, "Head", 380, "active", "Moderate"),
    ("FM-10", "Radhika", "F", 47, "Spouse", 260, "active", "Moderate"),
    ("FM-11", "Gautam", "M", 45, "Head", 0, "lost", "Moderately aggressive"),
    ("FM-11", "Nisha", "F", 43, "Spouse", 35, "dormant", "Moderate"),
    ("FM-12", "Farhan", "M", 41, "Head", 290, "engaged", "Aggressive"),
    ("FM-12", "Shalini", "F", 40, "Spouse", 0, "lost", "Moderate"),
    ("FM-03", "Anjali", "F", 45, "Spouse", 150, "active", "Moderate"),
]

risk_mix = {
    "Conservative": {"Equity": 0.15, "Debt": 0.75, "Gold": 0.05, "Cash": 0.05},
    "Moderately conservative": {"Equity": 0.3, "Debt": 0.6, "Gold": 0.05, "Cash": 0.05},
    "Moderate": {"Equity": 0.5, "Debt": 0.4, "Gold": 0.07, "Cash": 0.03},
    "Moderately aggressive": {"Equity": 0.65, "Debt": 0.27, "Gold": 0.05, "Cash": 0.03},
    "Aggressive": {"Equity": 0.8, "Debt": 0.15, "Gold": 0.05, "Cash": 0.0},
}
equity_pool = ["PD-101", "PD-102", "PD-103", "PD-104", "PD-111", "PD-112", "PD-113", "PD-105", "PD-106"]
equity_big = ["PD-201", "PD-202", "PD-302"]
debt_pool = ["PD-107", "PD-108", "PD-401", "PD-403", "PD-404", "PD-501", "PD-502", "PD-402"]
gold_pool = ["PD-114", "PD-601"]
cash_pool = ["PD-109", "PD-110"]


def asset_class(pid):
    if pid in gold_pool:
        return "Gold"
    if pid in cash_pool:
        return "Cash"
    if pid in debt_pool or pid == "PD-301":
        return "Debt"
    return "Equity"


occupations = {
    "Head": None, "Spouse": "Homemaker / co-owner", "Daughter": "Product designer", "Son": "Joined family business",
    "Daughter-in-law": "Architect",
}
clients = []
cid = 1001
family_heads = {}
for spec in client_specs:
    fam, first, g, age, role, aum_l, seg, risk = spec
    fam_rec = next(f for f in fams if f[0] == fam)
    name = f"{first} {fam_rec[1]}"
    aum = aum_l * 100000
    holdings = []
    if aum > 0:
        mix = risk_mix[risk]
        for cls, wt in mix.items():
            amt = aum * wt
            if amt <= 0:
                continue
            if cls == "Equity":
                pool = list(equity_pool)
                picks = random.sample(pool, 3 if aum < 5e7 else 4)
                if aum >= 1.5e8:
                    picks.append(random.choice(equity_big))
            elif cls == "Debt":
                picks = random.sample(debt_pool, 2 if aum < 5e7 else 3)
                if aum >= 1.5e8 and risk != "Conservative":
                    picks.append("PD-301")
            elif cls == "Gold":
                picks = [random.choice(gold_pool)]
            else:
                picks = [random.choice(cash_pool)]
            weights = [random.uniform(0.6, 1.4) for _ in picks]
            s = sum(weights)
            for pid, wt2 in zip(picks, weights):
                val = round(amt * wt2 / s, -3)
                pr = P[pid]
                r = (pr["returns"].get("3y") or pr.get("ytm") or pr.get("rate") or pr.get("coupon") or 8) / 100
                yrs = random.uniform(0.6, 4.5)
                if pr["category"] in ("AIF",):
                    yrs = random.uniform(0.3, 1.2)
                gain = (1 + r) ** yrs - 1
                inv = round(val / (1 + gain), -3)
                h = {"product_id": pid, "asset_class": cls, "invested": inv, "value": val,
                     "since": d(-int(yrs * 365)), "mode": "SIP" if (pr["category"] == "Mutual fund" and cls == "Equity" and random.random() < 0.45) else "Lumpsum"}
                if h["mode"] == "SIP":
                    h["sip_amount"] = random.choice([10000, 15000, 25000, 50000, 100000])
                    h["sip_date"] = random.choice([5, 10, 15, 25])
                holdings.append(h)
    total_val = sum(h["value"] for h in holdings)
    total_inv = sum(h["invested"] for h in holdings)
    last_contact_days = {"active": random.randint(2, 30), "engaged": random.randint(8, 50), "dormant": random.randint(190, 320), "lost": random.randint(120, 260)}[seg]
    last_txn_days = {"active": random.randint(5, 150), "engaged": random.randint(200, 500), "dormant": random.randint(200, 600), "lost": random.randint(120, 260)}[seg]
    since_days = random.randint(300, 2200)
    occ = occupations[role] or fam_rec[3]
    c = {
        "id": f"CL-{cid}",
        "name": name,
        "first_name": first,
        "gender": g,
        "age": age,
        "dob": d(-age * 365 - random.randint(0, 360)),
        "family_id": fam,
        "family_role": role,
        "city": "Mumbai",
        "locality": fam_rec[2],
        "occupation": occ,
        "segment": seg,
        "risk_profile": risk,
        "risk_profile_date": d(-random.randint(60, 700)),
        "client_since": d(-since_days),
        "phone": f"+91 98{random.randint(10, 99)}{random.randint(100, 999)} {random.randint(10000, 99999)}",
        "email": f"{first.lower()}.{fam_rec[1].lower()}@{random.choice(['gmail.com', 'outlook.com', 'yahoo.co.in'])}",
        "pan_masked": f"XXXXX{random.randint(1000, 9999)}X",
        "kyc": {"status": "Verified" if seg != "lost" else "Verified", "validated_on": d(-random.randint(100, 900)), "registration_agency": "CVL KRA"},
        "accounts": {"investing": True, "demat": random.random() < 0.6, "trading": random.random() < 0.4, "ddpi": random.random() < 0.3},
        "nominee": "Missing" if first in ("Sunita", "Karan", "Leena") else "Registered",
        "consent": {
            "whatsapp": random.random() < 0.8,
            "email": True,
            "profile_enrichment": random.random() < 0.55,
            "marketing": random.random() < 0.5,
            "data_sharing_with_partners": False,
            "captured_on": d(-random.randint(60, 600)),
            "version": "DPDP consent v1.2",
        },
        "aum": total_val,
        "invested": total_inv,
        "xirr": round(random.uniform(8.5, 17.5) if total_val else 0, 1),
        "allocation": {},
        "holdings": holdings,
        "last_contact": d(-last_contact_days),
        "last_transaction": d(-last_txn_days) if seg != "lost" else d(-last_txn_days),
        "photo": None,
        "tags": [],
        "goals": [],
        "interests": [],
        "notes_summary": "",
        "revenue_ytd": round(total_val * random.uniform(0.004, 0.009), -2),
    }
    if total_val:
        for h in holdings:
            c["allocation"][h["asset_class"]] = c["allocation"].get(h["asset_class"], 0) + h["value"]
        c["allocation"] = {k: round(v / total_val * 100, 1) for k, v in c["allocation"].items()}
    clients.append(c)
    cid += 1

# hand-written personal colour for key clients
extra = {
    "Rajesh Mehta": dict(goals=[{"name": "Rhea's wedding", "target": 15000000, "year": 2028}, {"name": "Business succession corpus", "target": 200000000, "year": 2034}],
                         interests=["Golf", "Single malts", "Cricket (MI season ticket)"], tags=["Business owner", "Family office candidate"],
                         notes_summary="Decision-maker for the family. Prefers short WhatsApp updates, quarterly in-person reviews at his Andheri office. Sceptical of PMS fees."),
    "Sanjay Desai": dict(goals=[{"name": "Retirement income from 2027", "target": 3500000, "year": 2027, "kind": "annual income"}],
                         interests=["Classical music", "Temple trust work"], tags=["Pre-retiree", "Income focus"],
                         notes_summary="Planning to hand the distribution business to his nephew next year. Wants predictable monthly income. Wife Sunita's account has been untouched for 8 months."),
    "Harish Shah": dict(goals=[{"name": "Grandchildren's education", "target": 40000000, "year": 2038}, {"name": "Charitable trust", "target": 50000000, "year": 2030}],
                        interests=["Jain community trust", "Gemology"], tags=["Top 10 client", "Philanthropy"],
                        notes_summary="Largest relationship. Gold-heavy outside Kova; open to moving part of it to SGBs. Always wants son Nikhil copied on decisions."),
    "Zubin Wadia": dict(goals=[{"name": "Hotel renovation reserve", "target": 60000000, "year": 2027}],
                        interests=["Vintage cars", "Parsi gymkhana cricket"], tags=["Liquidity events", "PMS client"],
                        notes_summary="Expects a large property sale proceeds in Q1. Wants a parking strategy ready before then."),
    "Arvind Iyer": dict(goals=[{"name": "Early retirement at 52", "target": 120000000, "year": 2034}],
                        interests=["Marathons", "Carnatic music"], tags=["ESOP holder", "Tech executive"],
                        notes_summary="Large unvested ESOPs. Concentration in employer stock outside Kova is the main risk to discuss."),
    "Suresh Bhatt": dict(goals=[{"name": "Monthly income", "target": 150000, "year": 2026, "kind": "monthly income"}],
                         interests=["Gardening", "Grandchildren in Pune"], tags=["Senior citizen", "Income focus"],
                         notes_summary="Former banker; reads every document. Prefers phone calls to WhatsApp."),
    "Gautam Agarwal": dict(tags=["Lost: moved to competitor"], notes_summary="Moved the full book to a bank wealth desk after a fee disagreement in April. Wife Nisha still holds a small SIP."),
    "Mahesh Patil": dict(goals=[{"name": "Debt-free company by 2027", "target": 80000000, "year": 2027}], tags=["Business owner", "Real estate"],
                         interests=["Ganesh mandal committee"], notes_summary="Lumpy cash flows from project completions. Prefers bonds and FDs; equity only via balanced advantage."),
    "Amit Kapadia": dict(goals=[{"name": "Children's overseas education", "target": 25000000, "year": 2031}], tags=["Referral source"],
                         interests=["Tax law", "Trekking"], notes_summary="CA; has referred four clients. Detailed questions on taxation, always."),
}
for c in clients:
    if c["name"] in extra:
        c.update(extra[c["name"]])
    if not c["tags"]:
        c["tags"] = [{"active": "Regular investor", "engaged": "Warm, not transacting", "dormant": "Needs re-engagement", "lost": "Lost"}[c["segment"]]]
    if not c["interests"]:
        c["interests"] = random.sample(["Travel", "Cricket", "Cooking", "Yoga", "Photography", "Theatre", "Reading", "Badminton"], 2)
    if not c["notes_summary"]:
        c["notes_summary"] = f"{c['family_role']} in the {c['name'].split()[1]} family. {c['occupation']}."
C = {c["id"]: c for c in clients}

families = []
for f in fams:
    members = [c["id"] for c in clients if c["family_id"] == f[0]]
    families.append({"id": f[0], "name": f"{f[1]} family", "locality": f[2], "head": members[0], "members": members,
                     "aum": sum(C[m]["aum"] for m in members), "business": f[3]})
w("families", families)

# timeline per client
def tl(cid_, items):
    C[cid_]["timeline"] = items


def make_timeline(c):
    fn = c["first_name"]
    seg = c["segment"]
    base = [
        {"id": "e1", "kind": "system", "at": t(-random.randint(60, 90), 9, 15), "title": "Quarterly statement sent", "body": "Consolidated statement for Jul-Sep emailed automatically."},
        {"id": "e2", "kind": "note", "at": t(-random.randint(20, 55), 18, 40), "title": "Internal note", "body": f"{fn} asked about rebalancing after the market rally. Wants to discuss at next review.", "by": "Priya Sharma"},
        {"id": "e3", "kind": "comm", "channel": "WhatsApp" if c["consent"]["whatsapp"] else "Email", "at": t(-random.randint(8, 30), 11, 5), "title": "Diwali greetings and review invite", "body": f"Hi {fn}, wishing you and the family a very happy Diwali. Could we set up a short review next week?", "by": "Priya Sharma"},
        {"id": "e4", "kind": "client", "at": t(-random.randint(3, 25), 20, 12), "title": "Viewed portfolio in Kova Client", "body": "Opened holdings and the Debt allocation view."},
    ]
    if seg == "active":
        base.append({"id": "e5", "kind": "client", "at": t(-random.randint(5, 60), 14, 30), "title": "Approved transaction", "body": "Approved Rs 5,00,000 into Sahyadri Corporate Bond Fund via OTP."})
        base.append({"id": "e6", "kind": "agent", "at": t(-random.randint(1, 15), 17, 50), "title": "MoM drafted by agent, approved by RM", "body": "Review meeting: agreed to move FD maturities into the corporate bond fund. Client to share updated ITR."})
    if seg == "dormant":
        base.append({"id": "e5", "kind": "system", "at": t(-30, 9, 0), "title": "No contact in 6 months", "body": "Flagged as dormant by the re-engagement rule."})
    if seg == "lost":
        base.append({"id": "e5", "kind": "system", "at": t(-150, 9, 0), "title": "Full redemption processed", "body": "All holdings redeemed and transferred out."})
    return sorted(base, key=lambda e: e["at"], reverse=True)


for c in clients:
    c["timeline"] = make_timeline(c)

# upcoming cash flows and red flags
for c in clients:
    flows = []
    for h in c["holdings"]:
        pr = P[h["product_id"]]
        if pr["category"] == "Fixed deposit":
            flows.append({"date": d(random.randint(5, 80)), "kind": "Maturity", "product_id": pr["id"], "amount": h["value"]})
        if pr["category"] == "Bond" and pr.get("payout"):
            flows.append({"date": d(random.randint(3, 60)), "kind": "Coupon", "product_id": pr["id"], "amount": round(h["value"] * (pr.get("coupon", 7) / 100) / 4, -2)})
        if h.get("mode") == "SIP":
            flows.append({"date": d(random.randint(1, 28)), "kind": "SIP debit", "product_id": pr["id"], "amount": -h["sip_amount"]})
    c["cash_flows"] = sorted(flows, key=lambda x: x["date"])[:6]
    flags = []
    if c["nominee"] == "Missing":
        flags.append({"severity": "high", "text": "No nominee registered on the folios"})
    if c["segment"] == "dormant":
        flags.append({"severity": "medium", "text": "No contact in over 6 months"})
    rp_age = (ANCHOR - dt.date.fromisoformat(c["risk_profile_date"])).days
    if rp_age > 540:
        flags.append({"severity": "medium", "text": "Risk profile older than 18 months"})
    if any(h["product_id"] == "PD-104" for h in c["holdings"]):
        flags.append({"severity": "low", "text": "Holds a fund under CIO review (Indus Peak Small Cap)"})
    if c["allocation"].get("Equity", 0) > {"Conservative": 25, "Moderately conservative": 40, "Moderate": 60, "Moderately aggressive": 75, "Aggressive": 95}[c["risk_profile"]]:
        flags.append({"severity": "high", "text": "Equity above the risk-profile band"})
    c["red_flags"] = flags

# a deliberate drift
C["CL-1001"]["consent"].update(whatsapp=True, profile_enrichment=True)
C["CL-1004"]["consent"].update(whatsapp=True)
C["CL-1002"]["red_flags"].append({"severity": "high", "text": "Equity above the risk-profile band after the rally"})
w("clients", clients)

# ---------------------------------------------------------------- prospects
pros = [
    ("Vivek Malhotra", 46, "M", "Referral", "Prospect", 25000000, "Selling a stake in his SaaS company; wants a plan for the proceeds", 14, 3, "Amit Kapadia (client)"),
    ("Ritu Sabharwal", 52, "F", "Event", "KYC in progress", 8000000, "Moving from bank FDs to a bond ladder", 6, 1, "Kova bond seminar, Sep"),
    ("Dr. Imran Qureshi", 44, "M", "Referral", "Registered", 12000000, "Surplus from clinic; no time to manage it", 4, 0, "Deepak Nair (client)"),
    ("Neeraj Choksi", 38, "M", "Inbound", "Lead", 3000000, "Downloaded the Kova Client app; asked about SIPs", 33, 0, "Kova Client app sign-up"),
    ("Sneha Kulkarni", 41, "F", "Cold outreach", "Prospect", 6000000, "Recently promoted; RSUs vesting", 41, 0, "LinkedIn"),
    ("Pervez Engineer", 66, "M", "Referral", "Investing client", 20000000, "Wants monthly income; KYC done, first bond purchase next", 2, 5, "Zubin Wadia (client)"),
    ("Ananya Rao", 29, "F", "Inbound", "Lead", 1500000, "Asked about international funds", 12, 0, "Website enquiry"),
    ("Hitesh Gala", 50, "M", "Event", "Prospect", 40000000, "Family business; three brothers splitting assets", 22, 2, "Chamber of commerce dinner"),
    ("Mrs. Lata Venkatesh", 70, "F", "Referral", "Registered", 9000000, "Widowed recently; son in US wants her money managed simply", 9, 1, "Suresh Bhatt (client)"),
    ("Kunal Bajaj", 35, "M", "Cold outreach", "Lead", 5000000, "Startup founder; liquidity event possible next year", 58, 0, "Founders meet-up"),
    ("Sahil & Priyanka Arora", 39, "M", "Referral", "Investing and trading client", 15000000, "Want PMS once demat is live", 5, 4, "Arvind Iyer (client)"),
    ("Joseph D'Souza", 57, "M", "Event", "Prospect", 11000000, "Retiring from shipping company next year", 31, 1, "Kova retirement workshop"),
    ("Nandini Hegde", 48, "F", "Inbound", "KYC in progress", 7000000, "Doctor; FATCA declaration pending", 15, 2, "Kova Client app sign-up"),
    ("Rohan Thakkar", 33, "M", "Cold outreach", "Closed", 4000000, "Chose a robo-advisor", 120, 1, "LinkedIn"),
    ("Meher Batliwala", 61, "F", "Referral", "Closed", 18000000, "Paused: family property dispute; revisit next year", 95, 2, "Zarine Wadia (client)"),
    ("Aditya Saraf", 43, "M", "Event", "Prospect", 30000000, "Considering a family office; comparing three firms", 8, 2, "Kova CIO breakfast"),
]
prospects = []
for i, (nm, age, g, src, stage, val, need, lc, mtgs, srcd) in enumerate(pros):
    pid = f"PR-{2001 + i}"
    closed = stage == "Closed"
    p = {
        "id": pid, "name": nm, "age": age, "gender": g, "source": src, "source_detail": srcd,
        "stage": stage, "estimated_investable": val, "need": need,
        "last_contact": d(-lc), "meetings_held": mtgs, "created": d(-lc - random.randint(10, 120)),
        "phone": f"+91 99{random.randint(10, 99)}{random.randint(100, 999)} {random.randint(10000, 99999)}",
        "email": nm.lower().replace("dr. ", "").replace("mrs. ", "").replace(" & ", ".").replace(" ", ".").replace("'", "") + "@example.com",
        "city": "Mumbai", "risk_indication": random.choice(["Moderate", "Moderately aggressive", "Moderately conservative", "Not assessed"]),
        "probability": {"Lead": 10, "Prospect": 30, "Registered": 45, "KYC in progress": 65, "Investing client": 85, "Investing and trading client": 90, "Closed": 0}[stage],
        "next_step": None if closed else random.choice(["First meeting", "Send proposal", "Follow up on KYC documents", "Portfolio review meeting", "Share bond ladder note", "Intro call"]),
        "next_step_date": None if closed else d(random.randint(-3, 14)),
        "app_access": stage in ("Registered", "KYC in progress", "Investing client", "Investing and trading client"),
        "kyc_steps": [],
        "interests": [],
        "app_activity": [],
        "suggestions": [],
        "recommended_portfolio_id": None,
        "notes": need,
        "timeline": [
            {"id": "e1", "kind": "note", "at": t(-lc - 5, 19, 0), "title": "Internal note", "body": need, "by": "Priya Sharma"},
            {"id": "e2", "kind": "comm", "channel": "Email", "at": t(-lc, 10, 30), "title": "Follow-up email", "body": "Shared Kova's approach note and asked for a convenient time to meet."},
        ],
        "closed": {"reason": need, "date": d(-lc + 10), "learning": "Price-sensitive; lead with fee transparency next time." if "robo" in need else "Timing; keep warm with quarterly notes."} if closed else None,
    }
    steps = [("Mobile and email verified", "Registered"), ("PAN and KYC (KRA)", "KYC in progress"), ("Bank account", "KYC in progress"),
             ("FATCA declaration", "KYC in progress"), ("Nominee", "KYC in progress"), ("Risk profile", "KYC in progress"),
             ("Demat and trading account", "Investing and trading client"), ("Exchange registration (UCC)", "Investing and trading client"), ("DDPI", "Investing and trading client")]
    order = ["Lead", "Prospect", "Registered", "KYC in progress", "Investing client", "Investing and trading client"]
    lvl = order.index(stage) if stage in order else 0
    for j, (s, needed) in enumerate(steps):
        done = (lvl >= 4 and j <= 5) or (lvl >= 5) or (lvl >= 2 and j == 0) or (stage == "KYC in progress" and j in (1, 2) and random.random() < 0.8)
        if nm.startswith("Nandini") and s == "FATCA declaration":
            done = False
        p["kyc_steps"].append({"step": s, "done": bool(done)})
    prospects.append(p)
PR = {p["id"]: p for p in prospects}
PR["PR-2001"].update(interests=["PD-202", "PD-301", "PD-110"], app_activity=[], recommended_portfolio_id="PF-2026-000118")
PR["PR-2002"].update(interests=["PD-401", "PD-403", "PD-107"])
PR["PR-2003"].update(interests=["PD-106", "PD-105"], app_activity=[{"at": t(-1, 22, 10), "text": "Viewed Meridian Multi Asset Allocation 3 times"}, {"at": t(-2, 21, 40), "text": "Opened the Kova approach video"}])
PR["PR-2009"].update(interests=["PD-401", "PD-501"], app_activity=[{"at": t(-2, 11, 5), "text": "Viewed Western Highways InvIT NCD 2031"}])
PR["PR-2008"].update(interests=["PD-202", "PD-201"])
PR["PR-2016"].update(interests=["PD-202", "PD-301", "PD-302"])
PR["PR-2012"].update(interests=["PD-107", "PD-401", "PD-105"])
PR["PR-2006"].update(interests=["PD-401", "PD-404"])
PR["PR-2011"].update(interests=["PD-202"])
for p in prospects:
    if p["stage"] != "Closed" and p["interests"]:
        p["suggestions"].append({"from": {"name": "Meera Joshi", "title": "Product Manager, Mutual Funds"} if random.random() < 0.5 else {"name": "Anand Iyer", "title": "Chief Investment Officer"},
                                 "date": d(-random.randint(1, 12)), "product_id": p["interests"][0],
                                 "text": f"Fits the stated need: {p['need'][0].lower() + p['need'][1:]}. Lead with liquidity and tax treatment."})
w("prospects", prospects)

# ---------------------------------------------------------------- model portfolios & RM portfolios
models = [
    {"id": "MP-01", "name": "Capital Shield", "risk": "Conservative", "horizon": "1-3 years",
     "description": "Protect capital and earn above-FD returns with high liquidity.", "expected_return": "7-8%",
     "allocations": [("PD-107", 30), ("PD-108", 20), ("PD-403", 15), ("PD-401", 15), ("PD-110", 10), ("PD-105", 10)]},
    {"id": "MP-02", "name": "Steady Income", "risk": "Moderately conservative", "horizon": "3+ years",
     "description": "Regular income from high-grade debt with a small equity kicker.", "expected_return": "8-9%",
     "allocations": [("PD-401", 20), ("PD-404", 15), ("PD-107", 20), ("PD-105", 20), ("PD-106", 15), ("PD-601", 10)]},
    {"id": "MP-03", "name": "Balanced Compounder", "risk": "Moderate", "horizon": "5+ years",
     "description": "Even split of growth and stability; the default for most families.", "expected_return": "10-11%",
     "allocations": [("PD-101", 20), ("PD-111", 15), ("PD-103", 10), ("PD-106", 10), ("PD-107", 20), ("PD-403", 10), ("PD-114", 7), ("PD-110", 8)]},
    {"id": "MP-04", "name": "Growth Builder", "risk": "Moderately aggressive", "horizon": "7+ years",
     "description": "Equity-led with mid caps and a PMS satellite for larger tickets.", "expected_return": "12-13%",
     "allocations": [("PD-101", 20), ("PD-111", 15), ("PD-103", 15), ("PD-202", 15), ("PD-113", 5), ("PD-107", 15), ("PD-601", 8), ("PD-110", 7)]},
    {"id": "MP-05", "name": "Long Horizon Equity", "risk": "Aggressive", "horizon": "10+ years",
     "description": "Maximum growth for clients who won't need the money for a decade.", "expected_return": "13-15%",
     "allocations": [("PD-101", 20), ("PD-103", 20), ("PD-104", 10), ("PD-201", 20), ("PD-113", 10), ("PD-107", 10), ("PD-114", 10)]},
    {"id": "MP-06", "name": "Liquidity Event Parking", "risk": "Moderately conservative", "horizon": "6-18 months",
     "description": "Park sale proceeds safely, then move into equity in tranches through STP.", "expected_return": "7-8%",
     "allocations": [("PD-110", 35), ("PD-109", 15), ("PD-108", 25), ("PD-107", 15), ("PD-105", 10)]},
]
for m in models:
    m["allocations"] = [{"product_id": a, "weight": b} for a, b in m["allocations"]]
    m["cio_note"] = "Reviewed quarterly by the investment committee."
    m["updated"] = d(-random.randint(5, 40))
    m["kind"] = "model"
w("model_portfolios", models)


def pf(pid, name, amount, status, tag, allocs, created, updated, note=""):
    lines = [{"product_id": a, "amount": round(amount * b / 100, -3)} for a, b in allocs]
    return {"id": pid, "name": name, "amount": amount, "status": status, "tag": tag, "lines": lines,
            "created": t(created, 11), "updated": t(updated, 16), "source": "recommended" if status != "practice" else "scratch",
            "note": note, "history": [{"at": t(created, 11), "event": "Created"}]}


portfolios = [
    pf("PF-2026-000118", "Malhotra liquidity plan", 25000000, "draft", {"kind": "prospect", "id": "PR-2001"},
       [("PD-110", 30), ("PD-108", 20), ("PD-202", 20), ("PD-301", 20), ("PD-101", 10)], -9, -2, "Stake sale closes in Feb; stagger equity."),
    pf("PF-2026-000121", "Desai retirement income", 12600000, "awaiting_approval", {"kind": "client", "id": "CL-1004"},
       [("PD-401", 25), ("PD-404", 20), ("PD-107", 25), ("PD-105", 20), ("PD-601", 10)], -6, -4),
    pf("PF-2026-000109", "Iyer growth rebalance", 5400000, "approved", {"kind": "client", "id": "CL-1007"},
       [("PD-101", 25), ("PD-103", 20), ("PD-113", 10), ("PD-111", 20), ("PD-107", 15), ("PD-114", 10)], -30, -21),
    pf("PF-2026-000124", "Bond ladder template", 10000000, "practice", None,
       [("PD-403", 25), ("PD-401", 25), ("PD-404", 20), ("PD-402", 10), ("PD-107", 20)], -3, -1),
    pf("PF-2026-000125", "Venkatesh simple income", 9000000, "draft", {"kind": "prospect", "id": "PR-2009"},
       [("PD-401", 30), ("PD-501", 20), ("PD-107", 30), ("PD-105", 20)], -2, -1),
    pf("PF-2026-000102", "Shah SGB switch", 23500000, "changes_requested", {"kind": "client", "id": "CL-1009"},
       [("PD-601", 20), ("PD-101", 20), ("PD-202", 20), ("PD-107", 25), ("PD-401", 15)], -18, -7, "CIO asked to cap PMS at 15%."),
]
w("portfolios", portfolios)

# ---------------------------------------------------------------- meetings
mt_types = ["Review", "Proposal", "First meeting", "Service", "Family meeting"]
meetings = []
mid = 501


def mtg(with_kind, with_id, title, mtype, day, hh, mm, dur, status, location="Client's office", attendees=None, agenda=None, mom=None, promises=None):
    global mid
    m = {"id": f"MT-{mid}", "title": title, "type": mtype, "with": {"kind": with_kind, "id": with_id},
         "start": t(day, hh, mm), "end": (dt.datetime.fromisoformat(t(day, hh, mm)) + dt.timedelta(minutes=dur)).isoformat(timespec="minutes"),
         "status": status, "location": location, "attendees": attendees or [], "agenda": agenda or [], "mom": mom, "promises": promises or [],
         "created_by": "rm"}
    mid += 1
    meetings.append(m)
    return m


mtg("client", "CL-1001", "Quarterly review: Mehta family", "Family meeting", 0, 11, 0, 60, "scheduled", "Mehta Textiles office, Andheri",
    [{"name": "Rohan Kapoor", "title": "Branch Head"}], ["Rebalance after equity drift", "Rhea's wedding corpus", "PMS fee question"])
mtg("prospect", "PR-2001", "Proposal walk-through", "Proposal", 0, 16, 30, 45, "scheduled", "Kova office, Bandra", [], ["Liquidity plan for stake sale", "Private credit fund intro"])
mtg("client", "CL-1004", "Retirement income plan", "Review", 1, 12, 0, 60, "scheduled", "Desai residence, Juhu", [], ["Income ladder", "Sunita's dormant account"])
mtg("prospect", "PR-2016", "Family office conversation", "First meeting", 2, 10, 0, 60, "scheduled", "Saraf Group office, Lower Parel", [{"name": "Anand Iyer", "title": "CIO"}], ["Kova approach", "Reporting and governance"])
mtg("client", "CL-1009", "SGB switch discussion", "Proposal", 3, 15, 0, 45, "scheduled", "Shah residence, Santacruz", [], ["Gold outside Kova", "SGB secondary"])
mtg("client", "CL-1016", "Parking strategy for property sale", "Proposal", 4, 11, 30, 60, "scheduled", "Wadia Hotels, Colaba", [], ["Liquidity Event Parking model", "STP plan"])
mtg("prospect", "PR-2006", "First bond purchase", "Service", 1, 17, 0, 30, "scheduled", "Phone", [], ["Western Highways NCD allotment"])
mtg("client", "CL-1014", "Annual review", "Review", 7, 11, 0, 60, "scheduled", "Bhatt residence, Vile Parle", [], ["Nominee update", "FD maturities"])
mtg("prospect", "PR-2012", "Retirement workshop follow-up", "First meeting", 8, 18, 0, 45, "scheduled", "Kova office, Bandra")
mtg("client", "CL-1007", "ESOP concentration", "Review", 10, 19, 0, 45, "scheduled", "Video call")
# past
mtg("client", "CL-1006", "Children's education plan", "Review", -2, 17, 0, 60, "needs_mom", "Kapadia & Co., Bandra", [], ["Overseas education corpus", "Tax on international funds"])
mtg("prospect", "PR-2003", "Clinic surplus discussion", "First meeting", -1, 13, 0, 45, "needs_mom", "Qureshi Clinic, Malad")
mtg("client", "CL-1012", "Bond maturity reinvestment", "Service", -3, 12, 0, 30, "needs_mom", "Phone")
mtg("client", "CL-1001", "Mehta: PMS fee concerns", "Service", -12, 18, 0, 30, "completed", "Phone", [],
    ["PMS fee explanation"], mom={"summary": "Rajesh feels the 1.75% fixed fee is high. Agreed to share a fee-vs-return comparison against the flexi cap fund. No switch for now.",
                                 "feedback": "Wants fee transparency up front.", "portfolio_reaction": "Keeps current PMS.", "changes_asked": [], "personal": "Rhea's wedding likely December 2027.", "approved_at": t(-12, 19, 0)},
    promises=[{"text": "Send PMS fee vs return comparison", "due": d(-5), "done": False}])
mtg("client", "CL-1018", "Nair family review", "Family meeting", -20, 11, 0, 60, "completed", "Nair residence, Malad", [],
    [], mom={"summary": "Reviewed SIPs; increased by Rs 25,000. Discussed term insurance gap.", "feedback": "Happy with returns.", "portfolio_reaction": "Positive", "changes_asked": ["Add ELSS for Radhika"], "personal": "Planning a Kerala trip in December.", "approved_at": t(-20, 13, 0)},
    promises=[{"text": "Share ELSS options for Radhika", "due": d(-10), "done": True}, {"text": "Intro to insurance partner", "due": d(3), "done": False}])
mtg("prospect", "PR-2002", "Bond ladder walk-through", "Proposal", -6, 16, 0, 45, "completed", "Kova office, Bandra", [],
    [], mom={"summary": "Ritu liked the 5-rung ladder. KYC started. Wants to keep 20% in her bank FD.", "feedback": "Clear explanation helped.", "portfolio_reaction": "Liked it", "changes_asked": ["Keep 20% in FD"], "personal": "", "approved_at": t(-6, 18, 0)},
    promises=[{"text": "Send revised ladder with 20% FD", "due": d(1), "done": False}])
mtg("client", "CL-1005", "Check-in call", "Service", -40, 11, 0, 20, "cancelled", "Phone")
w("meetings", meetings)

# ---------------------------------------------------------------- requests
requests_ = [
    {"id": "RQ-3101", "type": "reimbursement", "title": "Client lunch: Mehta review", "team": "Accounts", "direction": "waiting_on_others",
     "status": "in_review", "priority": "normal", "created": t(-4, 15, 0), "due": d(3), "link": {"kind": "client", "id": "CL-1001"},
     "payload": {"category": "Client meeting meals", "amount": 4280, "merchant": "Global Fusion, Andheri", "bill_date": d(-5), "gst": "27AAACG1234F1Z5"},
     "trail": [{"at": t(-4, 15, 0), "by": "Priya Sharma", "text": "Submitted with bill"}, {"at": t(-3, 10, 20), "by": "Accounts (Kiran)", "text": "Picked up for verification"}]},
    {"id": "RQ-3102", "type": "product_feedback", "title": "Small cap fund: clients asking about the review", "team": "Product: Mutual Funds", "direction": "waiting_on_others",
     "status": "sent", "priority": "high", "created": t(-2, 12, 0), "due": d(2), "link": {"kind": "product", "id": "PD-104"},
     "payload": {"feedback": "Three clients asked whether to stop SIPs in Indus Peak Small Cap. Need a client-ready note on the CIO review."},
     "trail": [{"at": t(-2, 12, 0), "by": "Priya Sharma", "text": "Sent to Meera Joshi"}]},
    {"id": "RQ-3103", "type": "service_request", "title": "Nominee update for Bhatt folios", "team": "Client Experience", "direction": "waiting_on_others",
     "status": "in_review", "priority": "high", "created": t(-6, 11, 0), "due": d(-1), "link": {"kind": "client", "id": "CL-1014"},
     "payload": {"request": "Register Leena Bhatt as nominee on all folios. Signed form collected."},
     "trail": [{"at": t(-6, 11, 0), "by": "Priya Sharma", "text": "Raised"}, {"at": t(-5, 9, 30), "by": "CX (Asha)", "text": "Form received; sent to registrar"}]},
    {"id": "RQ-3104", "type": "mom_ack", "title": "MoM acknowledgement: Nair family review", "team": "Client", "direction": "waiting_on_others",
     "status": "done", "priority": "normal", "created": t(-20, 13, 0), "due": None, "link": {"kind": "client", "id": "CL-1018"},
     "payload": {"meeting_id": "MT-515"}, "trail": [{"at": t(-20, 13, 0), "by": "Priya Sharma", "text": "MoM sent"}, {"at": t(-19, 21, 0), "by": "Deepak Nair", "text": "Acknowledged in Kova Client"}]},
    {"id": "RQ-3105", "type": "portfolio_approval", "title": "Desai retirement income", "team": "CIO Office", "direction": "waiting_on_others",
     "status": "in_review", "priority": "normal", "created": t(-4, 16, 0), "due": d(1), "link": {"kind": "portfolio", "id": "PF-2026-000121"},
     "payload": {"portfolio_id": "PF-2026-000121", "amount": 12600000},
     "trail": [{"at": t(-4, 16, 0), "by": "Priya Sharma", "text": "Sent for approval"}, {"at": t(-3, 12, 0), "by": "CIO Office (Anand Iyer)", "text": "Under review"}]},
    {"id": "RQ-3106", "type": "portfolio_approval", "title": "Shah SGB switch", "team": "CIO Office", "direction": "waiting_on_me",
     "status": "changes_requested", "priority": "high", "created": t(-10, 11, 0), "due": d(0), "link": {"kind": "portfolio", "id": "PF-2026-000102"},
     "payload": {"portfolio_id": "PF-2026-000102", "comment": "Cap PMS at 15% for a moderate profile; move the 5% to the corporate bond fund."},
     "trail": [{"at": t(-10, 11, 0), "by": "Priya Sharma", "text": "Sent for approval"}, {"at": t(-7, 15, 0), "by": "CIO Office (Anand Iyer)", "text": "Changes requested: cap PMS at 15%"}]},
    {"id": "RQ-3107", "type": "ticket", "title": "Wrong address on Wadia consolidated statement", "team": "Operations", "direction": "waiting_on_others",
     "status": "in_review", "priority": "normal", "created": t(-8, 10, 0), "due": d(-2), "link": {"kind": "client", "id": "CL-1016"},
     "payload": {"summary": "Statement shows the old Colaba address. Client updated address in KYC in August.", "assignee": "Operations team lead (Vinod)"},
     "trail": [{"at": t(-8, 10, 0), "by": "Priya Sharma", "text": "Ticket raised"}, {"at": t(-7, 11, 0), "by": "Ops (Vinod)", "text": "Assigned to Sameer"}], "escalations": 0, "reminders": True},
    {"id": "RQ-3108", "type": "ticket", "title": "SIP failed: Iyer, Banyan Flexi Cap", "team": "Operations", "direction": "waiting_on_me",
     "status": "needs_info", "priority": "high", "created": t(-3, 9, 0), "due": d(1), "link": {"kind": "client", "id": "CL-1007"},
     "payload": {"summary": "October SIP bounced. Ops needs the new bank mandate form signed by the client.", "assignee": "Operations team lead (Vinod)"},
     "trail": [{"at": t(-3, 9, 0), "by": "Ops (Sameer)", "text": "Raised on RM: mandate expired"}, {"at": t(-2, 18, 0), "by": "Ops (Sameer)", "text": "Waiting on signed mandate from RM"}], "escalations": 0, "reminders": True},
    {"id": "RQ-3109", "type": "reimbursement", "title": "Cab: bond seminar, Nariman Point", "team": "Accounts", "direction": "completed",
     "status": "done", "priority": "normal", "created": t(-25, 18, 0), "due": None, "link": None,
     "payload": {"category": "Local travel", "amount": 860, "merchant": "Uber", "bill_date": d(-25)},
     "trail": [{"at": t(-25, 18, 0), "by": "Priya Sharma", "text": "Submitted"}, {"at": t(-22, 11, 0), "by": "Accounts (Kiran)", "text": "Verified"}, {"at": t(-15, 10, 0), "by": "Accounts", "text": "Paid in October cycle"}]},
    {"id": "RQ-3110", "type": "portfolio_approval", "title": "Iyer growth rebalance", "team": "CIO Office", "direction": "completed",
     "status": "approved", "priority": "normal", "created": t(-30, 12, 0), "due": None, "link": {"kind": "portfolio", "id": "PF-2026-000109"},
     "payload": {"portfolio_id": "PF-2026-000109"}, "trail": [{"at": t(-30, 12, 0), "by": "Priya Sharma", "text": "Sent for approval"}, {"at": t(-21, 17, 0), "by": "CIO Office (Anand Iyer)", "text": "Approved"}]},
]
w("requests", requests_)

# ---------------------------------------------------------------- growth
growth = {
    "period": {"name": "Q3 FY27", "start": d(-26), "end": d(65)},
    "goals": [
        {"id": "G1", "text": "Bring Rs 15 Cr of fresh money this quarter", "by": "self", "achieved": False, "created": d(-20), "progress": 0.46},
        {"id": "G2", "text": "Get every family above Rs 1 Cr a written plan", "by": "self", "achieved": False, "created": d(-60), "progress": 0.6},
        {"id": "G3", "text": "Convert Vivek Malhotra and Aditya Saraf", "by": "self", "achieved": False, "created": d(-15), "progress": None},
        {"id": "G4", "text": "Finish L&D for all PMS and AIF products", "by": "self", "achieved": False, "created": d(-30), "progress": 0.4},
        {"id": "G5", "text": "Re-engage every dormant client before Diwali", "by": "manager", "set_by": "Rohan Kapoor", "achieved": False, "created": d(-35), "progress": 0.33},
    ],
    "achieved_goals": [{"id": "G0", "text": "Clear all pending nominee updates", "achieved_on": d(-12), "by": "self"}],
    "points": {"total": 1840, "this_quarter": 612, "slabs": [{"name": "Bronze", "from": 0, "payout_pct": 0}, {"name": "Silver", "from": 500, "payout_pct": 6}, {"name": "Gold", "from": 800, "payout_pct": 10}, {"name": "Platinum", "from": 1200, "payout_pct": 14}],
               "projected_quarter": 870, "projected_payout": 186000, "payout_basis": "Projected at current pace; final after compliance checks."},
    "kpis": [
        {"name": "Net new money", "weight": 35, "target": 150000000, "actual": 69000000, "unit": "inr"},
        {"name": "Revenue", "weight": 25, "target": 4200000, "actual": 2310000, "unit": "inr"},
        {"name": "Meetings with written MoM", "weight": 15, "target": 40, "actual": 27, "unit": "count"},
        {"name": "Client retention", "weight": 15, "target": 98, "actual": 96, "unit": "pct"},
        {"name": "L&D completion", "weight": 10, "target": 100, "actual": 62, "unit": "pct"},
    ],
    "points_history": [{"month": m, "points": v} for m, v in [("May", 180), ("Jun", 210), ("Jul", 195), ("Aug", 240), ("Sep", 268), ("Oct", 344)]],
    "contests": [
        {"id": "CT-01", "name": "Hybrid Harvest", "rule": "Net inflows into balanced advantage and multi asset funds", "ends": d(18), "prize": "Rs 25,000 voucher for the top 3",
         "my_rank": 4, "my_value": 21000000, "leaderboard": [{"name": "Arjun N.", "value": 34000000}, {"name": "Sneha P.", "value": 28500000}, {"name": "Rahul V.", "value": 22000000}, {"name": "Priya Sharma", "value": 21000000, "me": True}, {"name": "Faisal K.", "value": 15600000}]},
        {"id": "CT-02", "name": "Fixed Income Fortnight", "rule": "Bond and corporate bond fund inflows", "ends": d(6), "prize": "Team dinner for the winning branch",
         "my_rank": 2, "my_value": 18000000, "leaderboard": [{"name": "Mumbai South", "value": 41000000}, {"name": "Mumbai West (you)", "value": 38000000, "me": True}, {"name": "Pune", "value": 26000000}]},
        {"id": "CT-03", "name": "PMS Pathfinder", "rule": "New PMS clients (count)", "ends": d(45), "prize": "Kova Leaders offsite", "my_rank": 7, "my_value": 1,
         "leaderboard": [{"name": "Kabir S.", "value": 4}, {"name": "Arjun N.", "value": 3}, {"name": "Sneha P.", "value": 3}, {"name": "Priya Sharma", "value": 1, "me": True}]},
    ],
    "suggestions": [
        {"text": "Sanjay Desai's retirement income plan is awaiting CIO approval. Once approved it adds about Rs 1.26 Cr of reallocation.", "link": {"kind": "portfolio", "id": "PF-2026-000121"}},
        {"text": "4 completed meetings have no MoM. Writing them takes you to 31 of 40.", "link": {"kind": "page", "id": "/meetings"}},
        {"text": "Zubin Wadia's property sale proceeds need a parking plan; the Liquidity Event Parking model fits his stated horizon.", "link": {"kind": "client", "id": "CL-1016"}},
    ],
    "guardrail": "Suggestions come only from suitable client-product matches. They are never ranked by points.",
}
w("growth", growth)

# ---------------------------------------------------------------- updates (fixed panel)
updates = [
    {"id": "UP-01", "kind": "meeting", "priority": 1, "title": "Mehta family review at 11:00", "body": "Prep pack ready: equity drift, wedding corpus, PMS fee question.", "due": t(0, 11, 0), "link": {"kind": "meeting", "id": "MT-501"}, "source": "Meetings"},
    {"id": "UP-02", "kind": "approval", "priority": 1, "title": "CIO asked for changes: Shah SGB switch", "body": "Cap PMS at 15%. Due today.", "due": t(0, 18, 0), "link": {"kind": "portfolio", "id": "PF-2026-000102"}, "source": "Requests"},
    {"id": "UP-03", "kind": "nudge", "priority": 2, "title": "3 meetings still need a MoM", "body": "Kapadia, Qureshi and Fernandes. Complete MoMs count toward your KPIs.", "due": t(0, 20, 0), "link": {"kind": "page", "id": "/meetings"}, "source": "Meetings"},
    {"id": "UP-04", "kind": "client", "priority": 2, "title": "Dr. Imran Qureshi viewed Meridian Multi Asset 3 times", "body": "Registered prospect. Good moment for a short note.", "due": None, "link": {"kind": "prospect", "id": "PR-2003"}, "source": "Prospects"},
    {"id": "UP-05", "kind": "company", "priority": 3, "title": "CIO note: small cap review", "body": "Pause fresh lumpsums into Indus Peak Small Cap until the review closes on 6 Nov.", "due": None, "link": {"kind": "product", "id": "PD-104"}, "source": "CIO Office"},
    {"id": "UP-06", "kind": "contest", "priority": 3, "title": "Fixed Income Fortnight ends in 6 days", "body": "Mumbai West is 2nd, Rs 3 Cr behind Mumbai South.", "due": t(6, 18, 0), "link": {"kind": "page", "id": "/growth"}, "source": "Growth"},
    {"id": "UP-07", "kind": "deadline", "priority": 2, "title": "Meridian Private Credit Fund III final close", "body": "Commitments due before final close. 4 clients are eligible.", "due": t(52, 17, 0), "link": {"kind": "product", "id": "PD-301"}, "source": "Products"},
    {"id": "UP-08", "kind": "cash", "priority": 2, "title": "Rs 38 L FD maturity for Mahesh Patil", "body": "Matures this week. Reinvestment plan not yet discussed.", "due": t(4, 10, 0), "link": {"kind": "client", "id": "CL-1012"}, "source": "Clients"},
    {"id": "UP-09", "kind": "personal", "priority": 3, "title": "Kavita Mehta's birthday on Thursday", "body": "Consent covers personal greetings.", "due": t(3, 9, 0), "link": {"kind": "client", "id": "CL-1002"}, "source": "Clients"},
    {"id": "UP-10", "kind": "task", "priority": 2, "title": "Send PMS fee comparison to Rajesh Mehta", "body": "Promised on the last call. Overdue by 5 days.", "due": t(-5, 18, 0), "link": {"kind": "client", "id": "CL-1001"}, "source": "Meetings: promises"},
    {"id": "UP-11", "kind": "company", "priority": 4, "title": "New on the shelf: Coastal Housing Finance NCD", "body": "AA+, 8.85% monthly payout. L&D module is live.", "due": None, "link": {"kind": "product", "id": "PD-402"}, "source": "Products"},
    {"id": "UP-12", "kind": "task", "priority": 2, "title": "Signed SIP mandate for Arvind Iyer", "body": "Ops is waiting on you. SIP bounced in October.", "due": t(1, 18, 0), "link": {"kind": "request", "id": "RQ-3108"}, "source": "Requests"},
]
for u in updates:
    u.update({"done": False, "snoozed_until": None})
w("updates", updates)

# ---------------------------------------------------------------- research
research = [
    {"id": "RS-01", "kind": "House view", "title": "Equity: neutral weight, prefer large and flexi caps", "date": d(-4), "author": "Anand Iyer", "body": "Valuations in mid and small caps are above long-run averages. Add through STP over six months."},
    {"id": "RS-02", "kind": "House view", "title": "Debt: lock in 3-5 year AAA yields", "date": d(-4), "author": "Anand Iyer", "body": "With the rate cycle near its end, extend duration modestly using corporate bond funds and AAA NCDs."},
    {"id": "RS-03", "kind": "Market event", "title": "RBI keeps repo rate at 5.25%", "date": d(-11), "author": "Research desk", "body": "Stance unchanged. Short-term yields eased 8 bps."},
    {"id": "RS-04", "kind": "Market event", "title": "Gold at a record high in rupee terms", "date": d(-2), "author": "Research desk", "body": "Up 24% in a year. Review clients above 10% gold."},
    {"id": "RS-05", "kind": "Daily note", "title": "Nifty closes at 26,410, up 0.6%", "date": d(-1), "author": "Research desk", "body": "Banks and IT led. FPIs net buyers for the fifth session."},
]
w("research", research)

# ---------------------------------------------------------------- L&D progress, outbox, sessions
ld_progress = {
    "PD-101": ["m1", "m2", "m3", "m4", "m5"], "PD-105": ["m1", "m2", "m3", "m4", "m5"], "PD-107": ["m1", "m2", "m3", "m4", "m5"],
    "PD-111": ["m1", "m2", "m3", "m4", "m5"], "PD-401": ["m1", "m2", "m3", "m4", "m5"], "PD-202": ["m1", "m2", "m3"],
    "PD-201": ["m1"], "PD-106": ["m1", "m2"], "PD-301": ["m1", "m2", "m3"], "PD-110": ["m1", "m2", "m3", "m4", "m5"],
    "PD-403": ["m1", "m2", "m3", "m4", "m5"], "PD-109": ["m1", "m2", "m3", "m4", "m5"], "PD-102": ["m1", "m2", "m3", "m4"],
}
w("ld_progress", [{"id": k, "product_id": k, "completed": v} for k, v in ld_progress.items()])

outbox = [
    {"id": "OB-9001", "at": t(-12, 19, 5), "action": "send_mom", "channel": "Email", "to": {"name": "Rajesh Mehta", "address": "rajesh.mehta@gmail.com"},
     "subject": "Notes from our call on PMS fees", "body": "Hi Rajesh,\n\nThank you for your time today. Summary:\n- You feel the 1.75% fixed fee on the Coastline PMS is high.\n- I'll send a fee-versus-return comparison against Banyan Flexi Cap by Friday.\n- No change to the portfolio for now.\n\nRegards,\nPriya",
     "source": {"session_id": "AS-3999", "card_id": "CD-6999", "kind": "client", "id": "CL-1001", "said": "Log the MoM for the Mehta call about PMS fees and email it to him."},
     "review": "correct", "edited": False},
]
w("outbox", outbox)
w("agent_sessions", [])

# ---------------------------------------------------------------- handbook (designed only)
w("handbook", [
    {"id": "HB-1", "title": "Your day in Kova Work", "minutes": 4},
    {"id": "HB-2", "title": "Talking to the client agent", "minutes": 6},
    {"id": "HB-3", "title": "Building a portfolio in the Studio", "minutes": 8},
    {"id": "HB-4", "title": "What every status means", "minutes": 3},
    {"id": "HB-5", "title": "Consent and what it allows", "minutes": 5},
])

print("clients", len(clients), "aum Cr", round(sum(c["aum"] for c in clients) / 1e7, 1), "prospects", len(prospects), "products", len(products))

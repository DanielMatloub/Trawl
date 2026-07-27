from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import psycopg2
import stripe
import requests
from dotenv import load_dotenv
import os
import json
from datetime import date

load_dotenv()

app = FastAPI()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FREE_LIMIT = 10

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(host="localhost", dbname="trawl", user="postgres", password="pass")

def get_ip_usage(ip: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT scan_count, last_reset, paid FROM trawl_rate_limits WHERE ip = %s", (ip,))
    row = cur.fetchone()
    conn.close()
    return row if row else (0, date.today(), False)

def increment_ip_usage(ip: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO trawl_rate_limits (ip, scan_count, last_reset)
        VALUES (%s, 1, CURRENT_DATE)
        ON CONFLICT (ip) DO UPDATE
        SET scan_count = CASE
            WHEN trawl_rate_limits.last_reset < CURRENT_DATE THEN 1
            ELSE trawl_rate_limits.scan_count + 1
        END,
        last_reset = CURRENT_DATE
    """, (ip,))
    conn.commit()
    conn.close()

def get_cached_product(barcode: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT product_name, brand, species, origin_country, fishing_method,
               sustainability_score, environmental_impact, certifications, confidence, last_updated
        FROM trawl_products WHERE barcode = %s
    """, (barcode,))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE trawl_products SET scan_count = scan_count + 1 WHERE barcode = %s", (barcode,))
        conn.commit()
    conn.close()
    return row

def cache_product(barcode: str, data: dict):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO trawl_products (barcode, product_name, brand, species, origin_country,
            fishing_method, sustainability_score, environmental_impact, certifications, confidence)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (barcode) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            brand = EXCLUDED.brand,
            species = EXCLUDED.species,
            origin_country = EXCLUDED.origin_country,
            fishing_method = EXCLUDED.fishing_method,
            sustainability_score = EXCLUDED.sustainability_score,
            environmental_impact = EXCLUDED.environmental_impact,
            certifications = EXCLUDED.certifications,
            confidence = EXCLUDED.confidence,
            last_updated = NOW()
    """, (barcode, data.get("product_name"), data.get("brand"), data.get("species"),
          data.get("origin_country"), data.get("fishing_method"), data.get("sustainability_score"),
          data.get("environmental_impact"), data.get("certifications"), data.get("confidence")))
    conn.commit()
    conn.close()

def lookup_barcode(barcode: str) -> dict:
    product_info = {}

    # Try UPC Item DB first
    try:
        res = requests.get(f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}", timeout=5)
        data = res.json()
        if data.get("items"):
            item = data["items"][0]
            product_info["product_name"] = item.get("title", "")
            product_info["brand"] = item.get("brand", "")
            product_info["description"] = item.get("description", "")
    except Exception as e:
        print(f"UPC Item DB error: {e}")

    # Try Open Food Facts
    try:
        res = requests.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json", timeout=5)
        data = res.json()
        if data.get("status") == 1:
            p = data["product"]
            if not product_info.get("product_name"):
                product_info["product_name"] = p.get("product_name", "")
            if not product_info.get("brand"):
                product_info["brand"] = p.get("brands", "")
            product_info["origin_country"] = p.get("countries", "")
            product_info["ingredients"] = p.get("ingredients_text", "")
    except Exception as e:
        print(f"Open Food Facts error: {e}")

    return product_info

def analyze_with_claude(barcode: str, product_info: dict) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are a seafood sustainability expert. Analyze this seafood product and provide an environmental impact assessment.

Product info:
- Name: {product_info.get('product_name', 'Unknown')}
- Brand: {product_info.get('brand', 'Unknown')}
- Origin: {product_info.get('origin_country', 'Unknown')}
- Description: {product_info.get('description', '')}
- Ingredients: {product_info.get('ingredients', '')}

Respond with ONLY a JSON object, no markdown:
{{
  "species": "common name of the fish species",
  "origin_country": "country or region of origin",
  "fishing_method": "most likely fishing method (e.g. purse seine, longline, trawl, pole and line)",
  "sustainability_score": "A, B, C, D, or F",
  "environmental_impact": "3-4 sentence plain English assessment of the environmental impact",
  "certifications": "any known certifications for this brand/product (MSC, ASC, Friend of the Sea, etc.) or 'None known'",
  "confidence": "high, medium, or low - how confident you are in this assessment"
}}"""
            }
        ]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())

@app.get("/scan/{barcode}")
def scan_barcode(barcode: str, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host)

    scan_count, last_reset, paid = get_ip_usage(ip)
    if last_reset < date.today():
        scan_count = 0
    if scan_count >= FREE_LIMIT and not paid:
        return {
            "error": "limit_reached",
            "message": f"You've used all {FREE_LIMIT} free scans today. Unlock unlimited for $5."
        }

    # Check cache first
    cached = get_cached_product(barcode)
    if cached:
        increment_ip_usage(ip)
        return {
            "product_name": cached[0],
            "brand": cached[1],
            "species": cached[2],
            "origin_country": cached[3],
            "fishing_method": cached[4],
            "sustainability_score": cached[5],
            "environmental_impact": cached[6],
            "certifications": cached[7],
            "confidence": cached[8],
            "last_updated": str(cached[9]),
            "cached": True,
            "scans_remaining": FREE_LIMIT - scan_count - 1
        }

    # Cache miss — look up and analyze
    product_info = lookup_barcode(barcode)
    if not product_info.get("product_name"):
        return {"error": "not_found", "message": "Product not found. Try entering the species manually."}

    analysis = analyze_with_claude(barcode, product_info)
    merged = {**product_info, **analysis}
    cache_product(barcode, merged)
    increment_ip_usage(ip)

    return {
        **merged,
        "cached": False,
        "scans_remaining": FREE_LIMIT - scan_count - 1
    }

@app.post("/create-checkout-session")
async def create_checkout_session(request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host)
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": "Trawl — Unlimited Scans"},
                "unit_amount": 500,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url="https://trawl.vercel.app?payment=success",
        cancel_url="https://trawl.vercel.app?payment=cancelled",
    )
    return {"url": session.url}
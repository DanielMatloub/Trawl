# Trawl

Scan a seafood barcode to instantly understand the environmental impact of its fishing practices.

**Live demo:** https://trawl-two.vercel.app

## What it does

Point your camera at any seafood barcode to get an instant sustainability assessment powered by Claude AI. Trawl identifies the species, infers the fishing method, and explains the environmental impact in plain English — all in seconds.

If a product isn't in our database, Trawl prompts you to photograph the label. Claude reads it directly and saves the result permanently, building our database with every scan.

## Features

- Continuous barcode scanning via camera — no button needed
- Multi-database lookup (UPC Item DB + Open Food Facts)
- Claude-generated environmental impact assessment
- Sustainability score (A–F)
- Label photo fallback for unknown products
- Proprietary database that caches every scan for instant future lookups
- Daily rate limiting — 10 free scans per day, $5 for unlimited via Stripe
- Label images stored in Supabase for future agent review

## Tech stack

- **Frontend:** React, @zxing/library (barcode scanning)
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL (Supabase)
- **Storage:** Supabase Storage (label images)
- **AI:** Anthropic Claude API (text + vision)
- **Payments:** Stripe
- **Deployment:** Railway (backend), Vercel (frontend)

## How it works

1. User taps "Scan a barcode" — camera activates with viewfinder overlay
2. Barcode is detected automatically and sent to the FastAPI backend
3. Backend checks the Trawl database for a cached result — if found, returns instantly
4. On cache miss, UPC Item DB and Open Food Facts are queried for product info
5. If product not found, user is prompted to photograph the label
6. Claude analyzes the product (or label image) and returns species, fishing method, sustainability score, and environmental impact
7. Result is cached permanently for future scans

## Running locally

**Prerequisites:** Python 3.11+, Node.js

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm start
```

Add a `.env` file in `backend/` with:
```bash
ANTHROPIC_API_KEY=your-key-here
STRIPE_SECRET_KEY=your-key-here
DATABASE_URL=your-supabase-url-here
SUPABASE_URL=your-supabase-url-here
SUPABASE_SERVICE_KEY=your-service-key-here
```

## Roadmap

- Staleness-checking agent — periodically reviews cached entries and refreshes stale sustainability data
- Expand barcode database coverage
- Species-level sustainability trends over time
- Location-aware disposal rules
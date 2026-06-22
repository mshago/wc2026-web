"""
DROP-IN REPLACEMENT for app.py in your wc2026-api repo.

Security change: CORS origins now come from the ALLOWED_ORIGINS env var
instead of being hard-coded to "*".

On Railway, set a service variable:
    ALLOWED_ORIGINS = https://your-frontend.vercel.app
(comma-separate multiple origins). If unset, it falls back to "*" so local
dev keeps working — but set it in production.
"""
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import predict as P

app = FastAPI(title="WC2026 Poisson Predictor", version="1.1.0",
              description="Bayesian hierarchical Poisson (Dixon-Coles) match predictor.")

# Lock CORS to your frontend origin(s) in production.
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins or ["*"],
                   allow_methods=["GET"], allow_headers=["*"])


@app.get("/")
def root():
    return {"status": "ok", "model": "bayesian-poisson-dixon-coles",
            "teams_available": len(P.TEAMS),
            "usage": "/predict?home=France&away=Iraq&neutral=true"}


@app.get("/teams")
def teams():
    return {"count": len(P.TEAMS), "teams": P.TEAMS}


@app.get("/predict")
def predict_match(home: str = Query(..., max_length=60),
                  away: str = Query(..., max_length=60),
                  neutral: bool = Query(True)):
    try:
        return P.predict(home, away, neutral)
    except KeyError as e:
        raise HTTPException(status_code=404,
                            detail=f"Unknown team {e}. Check /teams for valid names.")

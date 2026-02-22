import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from contextlib import asynccontextmanager
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from pipelines.rag_pipeline import ask
from ingestion.news_fetcher import run as fetch_news
from pipelines.embedding_pipeline import embed_articles
from agents.digest_agent import get_users_for_digest, get_user_email, get_recent_articles_for_topics, generate_digest, send_digest
from agents.watchlist_digest_agent import run_watchlist_digest
from supabase import create_client

limiter = Limiter(key_func=get_remote_address)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def run_ingestion():
    fetch_news()
    embed_articles()

def run_digest_for_current_hour():
    current_hour_sgt = (datetime.utcnow().hour + 8) % 24
    current_time = f"{current_hour_sgt:02d}:00"
    print(f"Running digest check for SGT {current_time}")
    users = get_users_for_digest()
    for prefs in users:
        if prefs.get("digest_time", "07:00") == current_time:
            try:
                email = get_user_email(prefs["user_id"])
                if not email:
                    continue
                topics = prefs.get("topics") or ["global markets", "Singapore economy"]
                articles = get_recent_articles_for_topics(topics)
                digest = generate_digest(articles, topics)
                send_digest(email, digest, topics)
            except Exception as e:
                print(f"Error sending digest to user {prefs['user_id']}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_ingestion, "cron", hour="0,6,12,18")
    scheduler.add_job(run_digest_for_current_hour, "cron", minute=0)
    scheduler.add_job(run_watchlist_digest, "cron", day_of_week="sun", hour=0, minute=0)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class Question(BaseModel):
    question: str
    user_id: str | None = None

@app.get("/")
def root():
    return {"status": "Finclaro API running"}

@app.post("/ask")
@limiter.limit("10/minute")
def ask_question(request: Request, body: Question):
    result = ask(body.question)
    if body.user_id:
        supabase.table("chat_history").insert({
            "user_id": body.user_id,
            "question": body.question,
            "answer": result["answer"],
            "sources": result["sources"]
        }).execute()
    return result

@app.post("/ingest")
@limiter.limit("5/minute")
def ingest(request: Request):
    run_ingestion()
    return {"status": "Ingestion and embedding complete"}

@app.post("/digest")
def digest():
    run_digest_for_current_hour()
    return {"status": "Digest check complete"}

@app.get("/history/{user_id}")
def get_history(user_id: str, limit: int = 20):
    response = supabase.table("chat_history")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
    return response.data

@app.get("/watchlist/{user_id}")
def get_watchlist(user_id: str):
    response = supabase.table("watchlist")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    return response.data

@app.post("/watchlist")
@limiter.limit("30/minute")
def add_to_watchlist(request: Request, item: dict):
    try:
        response = supabase.table("watchlist").insert(item).execute()
        return response.data
    except Exception as e:
        if "23505" in str(e):
            raise HTTPException(status_code=409, detail="Symbol already in watchlist")
        raise HTTPException(status_code=500, detail="Something went wrong")

@app.delete("/watchlist/{item_id}")
def remove_from_watchlist(item_id: str):
    supabase.table("watchlist").delete().eq("id", item_id).execute()
    return {"status": "deleted"}

@app.post("/watchlist-digest")
def watchlist_digest():
    run_watchlist_digest()
    return {"status": "Watchlist digests sent"}

@app.get("/preferences/{user_id}")
def get_preferences(user_id: str):
    response = supabase.table("user_preferences")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    if response.data:
        return response.data[0]
    return {
        "digest_enabled": True,
        "digest_time": "07:00",
        "digest_frequency": "daily",
        "topics": ["global markets", "Singapore economy", "Federal Reserve", "inflation"]
    }

@app.post("/preferences")
def save_preferences(prefs: dict):
    existing = supabase.table("user_preferences")\
        .select("id")\
        .eq("user_id", prefs["user_id"])\
        .execute()
    if existing.data:
        supabase.table("user_preferences")\
            .update({**prefs, "updated_at": datetime.utcnow().isoformat()})\
            .eq("user_id", prefs["user_id"])\
            .execute()
    else:
        supabase.table("user_preferences").insert(prefs).execute()
    return {"status": "saved"}

@app.get("/debug-time")
def debug_time():
    current_hour_sgt = (datetime.utcnow().hour + 8) % 24
    current_time = f"{current_hour_sgt:02d}:00"
    return {
        "utc_hour": datetime.utcnow().hour,
        "sgt_hour": current_hour_sgt,
        "current_time_sgt": current_time,
        "utc_now": datetime.utcnow().isoformat()
    }
"""
db.py — MongoDB connection and data fetching for the forecaster.
Reads food listing history from the same MongoDB Atlas cluster
that the Node server uses.
"""

import os
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient
from dotenv import load_dotenv

# Load server/.env so we reuse the same MONGO_URI
_env_path = os.path.join(os.path.dirname(__file__), "..", "server", ".env")
load_dotenv(_env_path)

MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not found. Make sure server/.env exists.")

_client = None


def get_db():
    """Return a cached MongoClient database handle."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    # derive DB name from URI or fall back to 'test'
    db_name = MONGO_URI.rstrip("/").split("/")[-1].split("?")[0] or "test"
    return _client[db_name]


def fetch_donation_history(days: int = 60):
    """
    Return a list of dicts with keys: date (str YYYY-MM-DD), donations (int), quantity (int).
    Aggregates Food documents by creation date over the last `days` days.
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {"$match": {"createdAt": {"$gte": cutoff}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}
                },
                "donations": {"$sum": 1},
                "quantity":  {"$sum": "$quantity"},
            }
        },
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "date": "$_id", "donations": 1, "quantity": 1}},
    ]

    return list(db["foods"].aggregate(pipeline))


def fetch_ngo_activity(days: int = 60):
    """
    Return per-NGO delivery counts over the last `days` days,
    used to predict which NGOs will be most active next week.
    """
    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {
            "$match": {
                "status":     "delivered",
                "deliveredAt": {"$gte": cutoff},
                "reservedBy":  {"$ne": None},
            }
        },
        {
            "$group": {
                "_id":       "$reservedBy",
                "deliveries": {"$sum": 1},
                "quantity":   {"$sum": "$quantity"},
            }
        },
        {"$sort": {"deliveries": -1}},
        {"$limit": 10},
    ]

    results = list(db["foods"].aggregate(pipeline))

    # Enrich with NGO names
    ngo_ids = [r["_id"] for r in results]
    users   = {
        str(u["_id"]): u.get("name", "Unknown NGO")
        for u in db["users"].find({"_id": {"$in": ngo_ids}}, {"name": 1})
    }

    return [
        {
            "ngoId":      str(r["_id"]),
            "ngoName":    users.get(str(r["_id"]), "Unknown NGO"),
            "deliveries": r["deliveries"],
            "quantity":   r["quantity"],
        }
        for r in results
    ]
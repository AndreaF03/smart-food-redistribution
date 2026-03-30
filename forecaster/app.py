"""
app.py — Flask microservice for FoodBridge demand forecasting.

Endpoints:
  GET /health          — liveness check
  GET /predict         — 7-day donation demand forecast
  GET /ngo-activity    — top NGOs by historical delivery volume
"""

from flask import Flask, jsonify, request
from flask_cors import CORS

from db    import fetch_donation_history, fetch_ngo_activity
from model import forecast_donations

app = Flask(__name__)

# Allow requests from the Node server and the React dev server
CORS(app, origins=[
    "http://localhost:5000",   # Node API
    "http://localhost:3000",   # React dev
])


# ─────────────────────────────────────────
#  HEALTH CHECK
# ─────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "foodbridge-forecaster"}), 200


# ─────────────────────────────────────────
#  DEMAND FORECAST
#  GET /predict?days=30&horizon=7
# ─────────────────────────────────────────
@app.route("/predict", methods=["GET"])
def predict():
    try:
        # How many days of history to train on (default 30, max 90)
        days    = min(90,  max(7,  int(request.args.get("days",    30))))
        # How many days ahead to forecast (default 7, max 14)
        horizon = min(14,  max(1,  int(request.args.get("horizon",  7))))

        history  = fetch_donation_history(days=days)
        forecast = forecast_donations(history, horizon=horizon)

        return jsonify({
            "ok":            True,
            "trainingDays":  days,
            "horizon":       horizon,
            "historicalData": history,
            "forecast":      forecast,
            "summary": {
                "avgPredictedDonations": round(
                    sum(f["predicted_donations"] for f in forecast) / len(forecast), 1
                ) if forecast else 0,
                "avgPredictedQuantity": round(
                    sum(f["predicted_quantity"] for f in forecast) / len(forecast), 1
                ) if forecast else 0,
                "peakDay": max(forecast, key=lambda x: x["predicted_donations"])["date"]
                           if forecast else None,
                "method": forecast[0]["method"] if forecast else "none",
            },
        }), 200

    except Exception as e:
        app.logger.error(f"PREDICT ERROR: {e}", exc_info=True)
        return jsonify({"ok": False, "error": str(e)}), 500


# ─────────────────────────────────────────
#  NGO ACTIVITY HISTORY
#  GET /ngo-activity?days=30
# ─────────────────────────────────────────
@app.route("/ngo-activity", methods=["GET"])
def ngo_activity():
    try:
        days     = min(90, max(7, int(request.args.get("days", 30))))
        activity = fetch_ngo_activity(days=days)
        return jsonify({"ok": True, "data": activity}), 200

    except Exception as e:
        app.logger.error(f"NGO ACTIVITY ERROR: {e}", exc_info=True)
        return jsonify({"ok": False, "error": str(e)}), 500


# ─────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("Starting FoodBridge Forecaster on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
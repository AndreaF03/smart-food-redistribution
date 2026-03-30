"""
model.py — Time-series forecasting using Facebook Prophet.

Two forecasts are produced:
  1. donation_forecast  — how many food listings will be created per day
  2. quantity_forecast  — how many total food units will be available per day

If there are fewer than 7 data points (not enough history), falls back
to a simple 7-day rolling average so the endpoint never returns empty.
"""

import pandas as pd
from prophet import Prophet
import logging

# Silence Prophet's verbose Stan output
logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)


def _build_prophet_df(history: list, value_col: str) -> pd.DataFrame:
    """Convert history list-of-dicts to a Prophet-compatible DataFrame."""
    df = pd.DataFrame(history)
    df["ds"] = pd.to_datetime(df["date"])
    df["y"]  = pd.to_numeric(df[value_col], errors="coerce").fillna(0)
    return df[["ds", "y"]].sort_values("ds")


def _rolling_average_forecast(series: pd.Series, horizon: int = 7) -> list:
    """Fallback: repeat the mean of the last 7 values for `horizon` days."""
    mean_val = round(series.tail(7).mean(), 2) if len(series) >= 1 else 0
    return [max(0, mean_val)] * horizon


def forecast_donations(history: list, horizon: int = 7) -> list:
    """
    Forecast daily donation counts for the next `horizon` days.

    Returns a list of dicts:
      { date: str, predicted_donations: float, predicted_quantity: float,
        lower_donations: float, upper_donations: float,
        lower_quantity: float,  upper_quantity: float }
    """
    if not history:
        return []

    # Fill any missing dates in the range so Prophet sees a continuous series
    df_don = _build_prophet_df(history, "donations")
    df_qty = _build_prophet_df(history, "quantity")

    # Reindex to fill missing dates with 0
    if len(df_don) > 1:
        full_range = pd.date_range(df_don["ds"].min(), df_don["ds"].max(), freq="D")
        df_don = df_don.set_index("ds").reindex(full_range, fill_value=0).reset_index()
        df_don.columns = ["ds", "y"]
        df_qty = df_qty.set_index("ds").reindex(full_range, fill_value=0).reset_index()
        df_qty.columns = ["ds", "y"]

    # Need at least 7 points for Prophet to fit weekly seasonality
    MIN_POINTS = 7

    if len(df_don) < MIN_POINTS:
        # Fallback: rolling average
        future_dates = pd.date_range(
            start=pd.Timestamp.now().normalize() + pd.Timedelta(days=1),
            periods=horizon,
            freq="D",
        )
        don_vals = _rolling_average_forecast(df_don["y"], horizon)
        qty_vals = _rolling_average_forecast(df_qty["y"], horizon)

        return [
            {
                "date":                 d.strftime("%Y-%m-%d"),
                "predicted_donations":  round(don_vals[i], 1),
                "predicted_quantity":   round(qty_vals[i], 1),
                "lower_donations":      round(max(0, don_vals[i] * 0.7), 1),
                "upper_donations":      round(don_vals[i] * 1.3, 1),
                "lower_quantity":       round(max(0, qty_vals[i] * 0.7), 1),
                "upper_quantity":       round(qty_vals[i] * 1.3, 1),
                "method":               "rolling_average",
            }
            for i, d in enumerate(future_dates)
        ]

    # Prophet forecast — donations
    m_don = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        changepoint_prior_scale=0.05,   # conservative — avoids overfitting sparse data
        interval_width=0.80,
    )
    m_don.fit(df_don)
    future_don  = m_don.make_future_dataframe(periods=horizon)
    fc_don      = m_don.predict(future_don).tail(horizon)

    # Prophet forecast — quantity
    m_qty = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        changepoint_prior_scale=0.05,
        interval_width=0.80,
    )
    m_qty.fit(df_qty)
    future_qty  = m_qty.make_future_dataframe(periods=horizon)
    fc_qty      = m_qty.predict(future_qty).tail(horizon)

    results = []
    for don_row, qty_row in zip(fc_don.itertuples(), fc_qty.itertuples()):
        results.append({
            "date":                don_row.ds.strftime("%Y-%m-%d"),
            "predicted_donations": round(max(0, don_row.yhat),       1),
            "predicted_quantity":  round(max(0, qty_row.yhat),       1),
            "lower_donations":     round(max(0, don_row.yhat_lower), 1),
            "upper_donations":     round(max(0, don_row.yhat_upper), 1),
            "lower_quantity":      round(max(0, qty_row.yhat_lower), 1),
            "upper_quantity":      round(max(0, qty_row.yhat_upper), 1),
            "method":              "prophet",
        })

    return results
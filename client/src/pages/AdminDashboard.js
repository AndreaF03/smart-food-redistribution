import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts";

/* ============================================================
   MODULE-LEVEL CONSTANTS & HELPERS
   (outside component — not recreated on every render)
============================================================ */

const PIE_COLORS = ["#16a34a", "#2563eb", "#ca8a04", "#dc2626", "#94a3b8"];

const fmtDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
};

// FIX #4 & #5: Tooltip components moved to module level
// — no longer remounted on every render
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <p style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6, fontSize: 13 }}>
        {fmtDate(label)}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, margin: "2px 0" }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <p style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6, fontSize: 13 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, margin: "2px 0" }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ============================================================
   COMPONENT
============================================================ */

function AdminDashboard() {

  const navigate = useNavigate();

  const [analytics, setAnalytics]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false); // FIX #13: soft refresh
  const [error, setError]             = useState("");
  const [activeChart, setActiveChart] = useState("donations");
  const [ngoLeaderboard, setNgoLeaderboard] = useState([]);
  const [leaderboardSort, setLeaderboardSort] = useState("rating");
  const pollRef = useRef(null);

  /* ----------------------------------------------------------
     FIX #11: Apply body background via useEffect, not inline
     <style> tag — cleans up on unmount
  ---------------------------------------------------------- */
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#f1f5f9";
    return () => { document.body.style.background = prev; };
  }, []);

  /* ----------------------------------------------------------
     FIX #1: No manual Authorization header — axios interceptor
             handles it automatically.
     FIX #2: No duplicate 401 handling — interceptor handles it.
     FIX #13: Soft refresh (keeps stale data visible) vs hard
              load (first mount, shows spinner).
  ---------------------------------------------------------- */
  const fetchAnalytics = useCallback(async (soft = false) => {
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const res = await axios.get("/food/admin/analytics");
      setAnalytics(res.data);
      const lbRes = await axios.get("/ratings/leaderboard");
      setNgoLeaderboard(lbRes.data);
    } catch (err) {
      // FIX #2: Interceptor handles 401 — only handle other errors here
      if (err.response?.status !== 401) {
        setError("Failed to load analytics. Please try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* ----------------------------------------------------------
     FIX #10: Auto-refresh every 60 seconds
  ---------------------------------------------------------- */
  useEffect(() => {
    fetchAnalytics(false);
    pollRef.current = setInterval(() => fetchAnalytics(true), 60 * 1000);
    return () => clearInterval(pollRef.current);
  }, [fetchAnalytics]);

  /* ----------------------------------------------------------
     FIX #9: logout wrapped in useCallback
  ---------------------------------------------------------- */
  const logout = useCallback(() => {
    clearInterval(pollRef.current);
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

  /* ----------------------------------------------------------
     FIX #7: Memoized derived values — not recalculated every render
  ---------------------------------------------------------- */
  const statusPieData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Active",    value: analytics.activeCount    || 0 },
      { name: "Reserved",  value: analytics.reservedCount  || 0 },
      { name: "Delivered", value: analytics.deliveredCount || 0 },
      { name: "Expired",   value: analytics.expiredCount   || 0 },
    ].filter(d => d.value > 0);
  }, [analytics]);

  const deliveryRate = useMemo(() => (
    analytics?.totalListings
      ? Math.round((analytics.deliveredCount / analytics.totalListings) * 100)
      : 0
  ), [analytics]);

  const wasteRate = useMemo(() => (
    analytics?.totalListings
      ? Math.round((analytics.expiredCount / analytics.totalListings) * 100)
      : 0
  ), [analytics]);

  /* ----------------------------------------------------------
     FIX #12: Fill missing dates so chart has no misleading gaps
  ---------------------------------------------------------- */
  const filledDonationsPerDay = useMemo(() => {
    if (!analytics?.donationsPerDay) return [];
    const map = Object.fromEntries(
      analytics.donationsPerDay.map(d => [d.date, d])
    );
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return map[key] || { date: key, donations: 0, quantity: 0 };
    });
  }, [analytics]);
  const sortedLeaderboard = useMemo(() => {
  const arr = [...ngoLeaderboard];

  if (leaderboardSort === "rating") {
    return arr.sort((a, b) => b.avgRating - a.avgRating);
  }
  if (leaderboardSort === "deliveries") {
    return arr.sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  }
  if (leaderboardSort === "response") {
    return arr.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
  }

  return arr;
}, [ngoLeaderboard, leaderboardSort]);

  /* ----------------------------------------------------------
     Loading / Error / Null states
     FIX #3: Null guard before accessing analytics fields
  ---------------------------------------------------------- */
  if (loading) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", minHeight: "100vh",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid #e2e8f0", borderTopColor: "#6366f1",
        borderRadius: "50%", animation: "spin 0.7s linear infinite"
      }} />
      <p style={{ color: "#64748b", marginTop: 16 }}>Loading analytics…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error && !analytics) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", minHeight: "100vh",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>
      <button onClick={() => fetchAnalytics(false)} style={{
        padding: "9px 20px", background: "#6366f1", color: "#fff",
        border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600,
        fontFamily: "DM Sans, sans-serif"
      }}>Retry</button>
    </div>
  );

  // FIX #3: Hard null guard — analytics must exist before rendering charts
  if (!analytics) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse    { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .admin { max-width: 1100px; margin: 0 auto; padding: 28px 20px 80px; animation: fadeIn 0.3s ease; font-family: 'DM Sans', sans-serif; }

        /* HEADER */
        .admin-header {
          display: flex; justify-content: space-between; align-items: center;
          background: #fff; border-radius: 16px; padding: 18px 24px;
          margin-bottom: 24px; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .admin-header-left  { display: flex; align-items: center; gap: 12px; }
        .admin-header-logo  {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #818cf8, #6366f1);
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 20px;
        }
        .admin-header-title    { font-size: 20px; font-weight: 700; color: #0f172a; }
        .admin-header-subtitle { font-size: 13px; color: #94a3b8; margin-top: 1px; }
        .admin-header-actions  { display: flex; gap: 10px; align-items: center; }

        /* REFRESH INDICATOR */
        .refresh-dot {
          width: 8px; height: 8px; background: #6366f1; border-radius: 50%;
          animation: pulse 1s ease infinite;
        }

        /* KPI GRID */
        .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }
        @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 560px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

        .kpi-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
          padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .kpi-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .kpi-icon   { font-size: 22px; margin-bottom: 8px; }
        .kpi-value  { font-size: 28px; font-weight: 700; line-height: 1; }
        .kpi-label  { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; }
        .kpi-sub    { font-size: 12px; margin-top: 6px; font-weight: 500; }

        /* SECTION TITLE */
        .section-title {
          font-size: 15px; font-weight: 700; color: #0f172a;
          margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
        }
        .section-title span { font-size: 18px; }

        /* CHART CARD */
        .chart-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
          padding: 22px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          margin-bottom: 20px;
        }
        .chart-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px;
        }
        .chart-toggle {
          display: flex; gap: 4px; background: #f1f5f9;
          border-radius: 8px; padding: 3px;
        }
        .chart-toggle-btn {
          padding: 5px 12px; border: none; border-radius: 6px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
          color: #64748b; background: transparent; transition: all 0.15s;
        }
        .chart-toggle-btn.active {
          background: #fff; color: #0f172a; font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        /* TWO COLUMN CHARTS */
        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        @media (max-width: 720px) { .charts-row { grid-template-columns: 1fr; } }

        /* LEADERBOARD */
        .leaderboard { display: flex; flex-direction: column; gap: 10px; }
        .leaderboard-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 10px;
          transition: background 0.15s;
        }
        .leaderboard-item:hover { background: #f1f5f9; }
        .leaderboard-rank {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .rank-1     { background: #fef9c3; color: #ca8a04; }
        .rank-2     { background: #f1f5f9; color: #64748b; }
        .rank-3     { background: #fff7ed; color: #c2410c; }
        .rank-other { background: #f8fafc; color: #94a3b8; }
        .leaderboard-name  { flex: 1; font-size: 14px; font-weight: 600; color: #0f172a; }
        .leaderboard-meta  { font-size: 12px; color: #64748b; margin-top: 2px; }
        .leaderboard-value {
          font-size: 18px; font-weight: 700; color: #16a34a;
          font-family: 'DM Mono', monospace;
        }
        .leaderboard-unit { font-size: 11px; color: #94a3b8; font-weight: 400; }

        /* BAR PROGRESS */
        .bar-track { height: 6px; background: #e2e8f0; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .bar-fill  { height: 100%; border-radius: 3px; transition: width 0.6s ease; }

        /* EMPTY */
        .empty-chart {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 200px; color: #94a3b8; font-size: 14px;
        }
        .empty-chart-icon { font-size: 32px; margin-bottom: 10px; }

        /* ERROR BANNER */
        .error-banner {
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
          padding: 10px 16px; font-size: 13px; color: #dc2626;
          margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;
        }

        /* BUTTONS */
        .btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border: none; border-radius: 9px;
          font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 600;
          cursor: pointer; line-height: 1; white-space: nowrap;
          transition: background 0.16s, box-shadow 0.16s, transform 0.1s;
        }
        .btn:active { transform: scale(0.96); }
        .btn-ghost  { background: #fff; color: #475569; border: 1.5px solid #cbd5e1; }
        .btn-ghost:hover  { background: #f8fafc; border-color: #94a3b8; color: #1e293b; }
        .btn-danger { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
        .btn-danger:hover { background: #ffe4e6; border-color: #fda4af; }
        .btn-sm     { padding: 7px 13px; font-size: 12.5px; border-radius: 7px; }
        .btn-icon   { padding: 9px 10px; }
      `}</style>

      <div className="admin">

        {/* HEADER */}
        <div className="admin-header">
          <div className="admin-header-left">
            <div className="admin-header-logo">📊</div>
            <div>
              <div className="admin-header-title">Admin Dashboard</div>
              <div className="admin-header-subtitle">Platform Analytics Overview</div>
            </div>
          </div>
          <div className="admin-header-actions">
            {/* FIX #13: Show subtle pulse dot during soft refresh instead of spinner */}
            {refreshing && <div className="refresh-dot" title="Refreshing…" />}
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => fetchAnalytics(true)}
              title="Refresh"
              disabled={refreshing}
            >↻</button>
            <button className="btn btn-danger btn-sm" onClick={logout}>
              ⎋ Logout
            </button>
          </div>
        </div>

        {/* Error banner — shown over stale data, not instead of it */}
        {error && analytics && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button
              onClick={() => fetchAnalytics(true)}
              style={{
                background: "none", border: "none", color: "#dc2626",
                cursor: "pointer", fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                fontSize: 13
              }}
            >Retry</button>
          </div>
        )}

        {/* ── KPI CARDS ── */}
        <div className="kpi-grid">

          <div className="kpi-card">
            <div className="kpi-icon">🍱</div>
            <div className="kpi-value" style={{ color: "#0f172a" }}>
              {analytics.totalListings}
            </div>
            <div className="kpi-label">Total Listings</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">✅</div>
            <div className="kpi-value" style={{ color: "#16a34a" }}>
              {analytics.deliveredCount}
            </div>
            <div className="kpi-label">Delivered</div>
            <div className="kpi-sub" style={{ color: "#16a34a" }}>
              {deliveryRate}% success rate
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">🟡</div>
            <div className="kpi-value" style={{ color: "#2563eb" }}>
              {analytics.activeCount}
            </div>
            <div className="kpi-label">Active Now</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">📦</div>
            <div className="kpi-value" style={{ color: "#ca8a04" }}>
              {analytics.reservedCount}
            </div>
            <div className="kpi-label">Reserved</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">⏰</div>
            <div className="kpi-value" style={{ color: "#dc2626" }}>
              {analytics.expiredCount}
            </div>
            <div className="kpi-label">Expired</div>
            <div className="kpi-sub" style={{ color: "#dc2626" }}>
              {wasteRate}% waste rate
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">⚖️</div>
            <div className="kpi-value" style={{ color: "#6366f1" }}>
              {analytics.totalQuantityRedistributed}
            </div>
            <div className="kpi-label">Units Redistributed</div>
          </div>

        </div>

        {/* ── AREA CHART — Donations over last 14 days ── */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <span>📈</span> Activity — Last 14 Days
            </div>
            <div className="chart-toggle">
              <button
                className={`chart-toggle-btn${activeChart === "donations" ? " active" : ""}`}
                onClick={() => setActiveChart("donations")}
              >Donations</button>
              <button
                className={`chart-toggle-btn${activeChart === "quantity" ? " active" : ""}`}
                onClick={() => setActiveChart("quantity")}
              >Quantity</button>
            </div>
          </div>

          {/* FIX #12: filledDonationsPerDay fills missing dates with 0 */}
          {filledDonationsPerDay.length > 0 ? (
            // FIX #14: minWidth prevents collapse on narrow viewports
            <ResponsiveContainer width="100%" height={240} minWidth={200}>
              <AreaChart
                data={filledDonationsPerDay}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorDonations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {activeChart === "donations" ? (
                  <Area
                    type="monotone" dataKey="donations" name="Donations"
                    stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#colorDonations)" dot={false} activeDot={{ r: 5 }}
                  />
                ) : (
                  <Area
                    type="monotone" dataKey="quantity" name="Quantity"
                    stroke="#16a34a" strokeWidth={2.5}
                    fill="url(#colorQuantity)" dot={false} activeDot={{ r: 5 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">
              <div className="empty-chart-icon">📭</div>
              <p>No activity data yet</p>
            </div>
          )}
        </div>

        {/* ── TWO COLUMN ROW ── */}
        <div className="charts-row">

          {/* PIE CHART — Status breakdown */}
          <div className="chart-card" style={{ marginBottom: 0 }}>
            <div className="section-title">
              <span>🥧</span> Food Status Breakdown
            </div>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220} minWidth={200}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      // FIX #8: use entry.name not index as key — stable across re-renders
                      <Cell key={entry.name} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={{
                      borderRadius: 10, border: "1px solid #e2e8f0",
                      fontFamily: "DM Sans, sans-serif", fontSize: 13
                    }}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(val) => (
                      <span style={{ fontSize: 12, color: "#475569" }}>{val}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <div className="empty-chart-icon">📭</div>
                <p>No data yet</p>
              </div>
            )}
          </div>

          {/* BAR CHART — NGO Activity */}
          <div className="chart-card" style={{ marginBottom: 0 }}>
            <div className="section-title">
              <span>🤝</span> Top NGOs by Deliveries
            </div>
            {analytics.ngoActivity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220} minWidth={200}>
                <BarChart
                  data={analytics.ngoActivity}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number" allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="ngoName" width={90}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Bar
                    dataKey="deliveriesCompleted" name="Deliveries"
                    fill="#2563eb" radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <div className="empty-chart-icon">📭</div>
                <p>No NGO activity yet</p>
              </div>
            )}
          </div>

        </div>

        {/* ── TOP RESTAURANTS LEADERBOARD ── */}
        <div className="chart-card">
          <div className="section-title">
            <span>🏆</span> Top Restaurants by Delivered Quantity
          </div>

          {analytics.topRestaurants?.length > 0 ? (
            <div className="leaderboard">
              {(() => {
                const maxVal = Math.max(
                  ...analytics.topRestaurants.map(r => r.totalDelivered)
                );
                return analytics.topRestaurants.map((r, i) => (
                  // FIX #8: stable key — use restaurantName, fall back to index
                  <div key={r.restaurantName || i} className="leaderboard-item">
                    <div className={`leaderboard-rank rank-${i < 3 ? i + 1 : "other"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="leaderboard-name">
                        {r.restaurantName || "Unknown Restaurant"}
                      </div>
                      <div className="leaderboard-meta">
                        {r.donationCount} donation{r.totalDonations !== 1 ? "s" : ""}
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: maxVal > 0 ? `${(r.totalDelivered / maxVal) * 100}%` : "0%",
                            background: i === 0
                              ? "#ca8a04" : i === 1
                              ? "#94a3b8" : i === 2
                              ? "#c2410c" : "#6366f1"
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="leaderboard-value">{r.totalDelivered}</div>
                      <div className="leaderboard-unit">units</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="empty-chart">
              <div className="empty-chart-icon">🏆</div>
              <p>No delivery data yet</p>
            </div>
          )}
        </div>
{/* ── NGO PERFORMANCE LEADERBOARD ── */}
<div className="chart-card">
  <div className="section-title">
    <span>🏅</span> NGO Performance Leaderboard
  </div>

  {/* SORT DROPDOWN */}
  <div style={{ marginBottom: "12px" }}>
    <select
      value={leaderboardSort}
      onChange={(e) => setLeaderboardSort(e.target.value)}
      style={{
        padding: "6px 10px",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
        fontFamily: "DM Sans"
      }}
    >
      <option value="rating">Sort by Rating</option>
      <option value="deliveries">Sort by Deliveries</option>
      <option value="response">Sort by Response Time</option>
    </select>
  </div>

  {sortedLeaderboard.length > 0 ? (
    <div className="leaderboard">
      {sortedLeaderboard.map((ngo, i) => (
        <div key={ngo.ngoId} className="leaderboard-item">
          
          <div className={`leaderboard-rank rank-${i < 3 ? i + 1 : "other"}`}>
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
          </div>

          <div style={{ flex: 1 }}>
            <div className="leaderboard-name">
              {ngo.ngoName}
            </div>

            <div className="leaderboard-meta">
              ⭐ {ngo.avgRating || 0} | 📦 {ngo.totalDeliveries || 0} deliveries
            </div>

            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.min(ngo.avgRating * 20, 100)}%`,
                  background: "#16a34a"
                }}
              />
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="leaderboard-value">
              {ngo.avgResponseTime || "-"}
            </div>
            <div className="leaderboard-unit">min</div>
          </div>

        </div>
      ))}
    </div>
  ) : (
    <div className="empty-chart">
      <div className="empty-chart-icon">🏅</div>
      <p>No NGO data yet</p>
    </div>
  )}
</div>
      </div>
    </>
  );
}

export default AdminDashboard;
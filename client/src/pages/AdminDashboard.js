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
   CONSTANTS & HELPERS
============================================================ */
const PIE_COLORS = ["#5fd475", "#60b4f0", "#f0b429", "#f05252", "#7a8c7e"];

const fmtDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });

const downloadCSV = (data, filename = "admin_report.csv") => {
  if (!data || data.length === 0) { alert("No data to export"); return; }
  const headers = ["Restaurant", "Food Type", "Quantity", "Status", "Freshness (%)", "Storage", "Created At", "Delivered At"];
  const rows = data.map(item => [
    item.restaurant?.name || "—", item.foodType || "—", item.quantity || 0,
    item.status || "—", item.freshnessScore || 0, item.storageType || "—",
    item.createdAt ? new Date(item.createdAt).toLocaleString() : "—",
    item.deliveredAt ? new Date(item.deliveredAt).toLocaleString() : "—",
  ]);
  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.setAttribute("download", filename);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

/* ── Tooltip components at module level (no remount) ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6, fontSize: 12 }}>{fmtDate(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: "2px 0" }}>
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
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6, fontSize: 12 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: "2px 0" }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
function AdminDashboard() {
  const navigate = useNavigate();

  const [analytics, setAnalytics]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState("");
  const [activeChart, setActiveChart]   = useState("donations");
  const [ngoLeaderboard, setNgoLeaderboard] = useState([]);
  const [leaderboardSort, setLeaderboardSort] = useState("rating");
  const [users, setUsers]               = useState([]);
  const [activeTab, setActiveTab]       = useState("analytics");
  const pollRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#0e100f";
    return () => { document.body.style.background = prev; };
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get("/auth/users");
      setUsers(res.data);
    } catch { setError("Failed to load users"); }
  }, []);

  const fetchAnalytics = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [res, lbRes] = await Promise.all([
        axios.get("/food/admin/analytics"),
        axios.get("/ratings/leaderboard"),
      ]);
      setAnalytics(res.data);
      setNgoLeaderboard(lbRes.data);
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to load analytics.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchAnalytics(false);
    pollRef.current = setInterval(() => fetchAnalytics(true), 60 * 1000);
    return () => clearInterval(pollRef.current);
  }, [fetchAnalytics]);

  const logout = useCallback(() => {
    clearInterval(pollRef.current);
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

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
      ? Math.round((analytics.deliveredCount / analytics.totalListings) * 100) : 0
  ), [analytics]);

  const wasteRate = useMemo(() => (
    analytics?.totalListings
      ? Math.round((analytics.expiredCount / analytics.totalListings) * 100) : 0
  ), [analytics]);

  const filledDonationsPerDay = useMemo(() => {
    if (!analytics?.donationsPerDay) return [];
    const map = Object.fromEntries(analytics.donationsPerDay.map(d => [d.date, d]));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return map[key] || { date: key, donations: 0, quantity: 0 };
    });
  }, [analytics]);

  const sortedLeaderboard = useMemo(() => {
    const arr = [...ngoLeaderboard];
    if (leaderboardSort === "rating")     return arr.sort((a, b) => b.avgRating - a.avgRating);
    if (leaderboardSort === "deliveries") return arr.sort((a, b) => b.totalDeliveries - a.totalDeliveries);
    if (leaderboardSort === "response")   return arr.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
    return arr;
  }, [ngoLeaderboard, leaderboardSort]);

  /* ── KPI config ── */
  const kpis = analytics ? [
    { icon: "🍱", value: analytics.totalListings,              label: "Total Listings",     sub: null,                       color: "var(--text)" },
    { icon: "✅", value: analytics.deliveredCount,             label: "Delivered",           sub: `${deliveryRate}% success`, color: "var(--fresh)" },
    { icon: "📍", value: analytics.activeCount,                label: "Active Now",          sub: null,                       color: "var(--info)" },
    { icon: "📦", value: analytics.reservedCount,              label: "Reserved",            sub: null,                       color: "var(--warn)" },
    { icon: "⏰", value: analytics.expiredCount,               label: "Expired",             sub: `${wasteRate}% waste`,      color: "var(--danger)" },
    { icon: "⚖️", value: analytics.totalQuantityRedistributed, label: "Units Redistributed", sub: null,                       color: "var(--accent)" },
  ] : [];

  /* ── States ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Loading analytics…</p>
      </div>
    </>
  );

  if (error && !analytics) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>{error}</p>
        <button className="adm-btn primary" onClick={() => fetchAnalytics(false)}>↻ Retry</button>
      </div>
    </>
  );

  if (!analytics) return null;

  return (
    <>
      <style>{CSS}</style>
      <div className="adm-root">

        {/* ── HEADER ── */}
        <header className="adm-header">
          <div className="adm-brand">
            <div className="adm-logo">📊</div>
            <div>
              <h1 className="adm-title">Admin Dashboard</h1>
              <p className="adm-sub">Platform analytics overview · Bengaluru</p>
            </div>
            {refreshing && <span className="live-dot" title="Syncing…" />}
          </div>

          <div className="adm-actions">
            {/* Tab switcher */}
            <div className="tab-toggle">
              <button
                className={`tab-toggle-btn ${activeTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >📈 Analytics</button>
              <button
                className={`tab-toggle-btn ${activeTab === "users" ? "active" : ""}`}
                onClick={() => { setActiveTab("users"); fetchUsers(); }}
              >👥 Users</button>
            </div>

            <button
              className="adm-btn export"
              onClick={() => downloadCSV(analytics?.topRestaurants || [], `admin_report_${new Date().toISOString().slice(0, 10)}.csv`)}
            >⬇ Export</button>
            <button className="adm-btn icon" onClick={() => fetchAnalytics(true)} disabled={refreshing} title="Refresh">↻</button>
            <button className="adm-btn danger" onClick={logout}>⎋ Logout</button>
          </div>
        </header>

        {/* ── ERROR BANNER ── */}
        {error && analytics && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button onClick={() => fetchAnalytics(true)}>Retry</button>
          </div>
        )}

        {/* ═══════════════════ ANALYTICS TAB ═══════════════════ */}
        {activeTab === "analytics" && (
          <>
            {/* ── KPI GRID ── */}
            <div className="kpi-grid">
              {kpis.map((k, i) => (
                <div key={i} className="kpi-card" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="kpi-icon">{k.icon}</div>
                  <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                  <div className="kpi-label">{k.label}</div>
                  {k.sub && <div className="kpi-sub" style={{ color: k.color }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* ── AREA CHART ── */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="section-title">📈 Activity — Last 14 Days</div>
                <div className="chart-toggle">
                  <button
                    className={`toggle-btn ${activeChart === "donations" ? "active" : ""}`}
                    onClick={() => setActiveChart("donations")}
                  >Donations</button>
                  <button
                    className={`toggle-btn ${activeChart === "quantity" ? "active" : ""}`}
                    onClick={() => setActiveChart("quantity")}
                  >Quantity</button>
                </div>
              </div>
              {filledDonationsPerDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={240} minWidth={200}>
                  <AreaChart data={filledDonationsPerDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDonations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#5fd475" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#5fd475" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gQuantity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60b4f0" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#60b4f0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3028" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: "#7a8c7e" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7a8c7e" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {activeChart === "donations" ? (
                      <Area type="monotone" dataKey="donations" name="Donations" stroke="#5fd475" strokeWidth={2.5} fill="url(#gDonations)" dot={false} activeDot={{ r: 5 }} />
                    ) : (
                      <Area type="monotone" dataKey="quantity" name="Quantity" stroke="#60b4f0" strokeWidth={2.5} fill="url(#gQuantity)" dot={false} activeDot={{ r: 5 }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart icon="📭" text="No activity data yet" />}
            </div>

            {/* ── TWO-COL ROW ── */}
            <div className="charts-row">

              {/* PIE */}
              <div className="chart-card">
                <div className="section-title">🥧 Food Status Breakdown</div>
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} minWidth={200}>
                    <PieChart>
                      <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {statusPieData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "'Instrument Sans',sans-serif", fontSize: 13 }}
                      />
                      <Legend iconType="circle" iconSize={8} formatter={val => <span style={{ fontSize: 12, color: "var(--muted)" }}>{val}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart icon="📭" text="No data yet" />}
              </div>

              {/* BAR */}
              <div className="chart-card">
                <div className="section-title">🤝 Top NGOs by Deliveries</div>
                {analytics.ngoActivity?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220} minWidth={200}>
                    <BarChart data={analytics.ngoActivity} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3028" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#7a8c7e" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="ngoName" width={90} tick={{ fontSize: 11, fill: "#e8ede9" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<BarTooltip />} />
                      <Bar dataKey="deliveriesCompleted" name="Deliveries" fill="#60b4f0" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart icon="📭" text="No NGO activity yet" />}
              </div>

            </div>

            {/* ── RESTAURANT LEADERBOARD ── */}
            <div className="chart-card">
              <div className="section-title">🏆 Top Restaurants by Delivered Quantity</div>
              {analytics.topRestaurants?.length > 0 ? (
                <div className="leaderboard">
                  {(() => {
                    const maxVal = Math.max(...analytics.topRestaurants.map(r => r.totalDelivered));
                    return analytics.topRestaurants.map((r, i) => (
                      <div key={r.restaurantName || i} className="lb-row">
                        <div className={`lb-rank rank-${i < 3 ? i + 1 : "x"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </div>
                        <div className="lb-info">
                          <div className="lb-name">{r.restaurantName || "Unknown"}</div>
                          <div className="lb-meta">{r.donationCount} donation{r.donationCount !== 1 ? "s" : ""}</div>
                          <div className="lb-track">
                            <div className="lb-fill" style={{
                              width: maxVal > 0 ? `${(r.totalDelivered / maxVal) * 100}%` : "0%",
                              background: ["#f0b429", "#7a8c7e", "#c2410c"][i] || "var(--accent)",
                            }} />
                          </div>
                        </div>
                        <div className="lb-stat">
                          <div className="lb-value">{r.totalDelivered}</div>
                          <div className="lb-unit">units</div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : <EmptyChart icon="🏆" text="No delivery data yet" />}
            </div>

            {/* ── NGO PERFORMANCE LEADERBOARD ── */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="section-title">🏅 NGO Performance</div>
                <select
                  className="sort-select"
                  value={leaderboardSort}
                  onChange={e => setLeaderboardSort(e.target.value)}
                >
                  <option value="rating">By Rating</option>
                  <option value="deliveries">By Deliveries</option>
                  <option value="response">By Response Time</option>
                </select>
              </div>
              {sortedLeaderboard.length > 0 ? (
                <div className="leaderboard">
                  {sortedLeaderboard.map((ngo, i) => (
                    <div key={ngo.ngoId} className="lb-row">
                      <div className={`lb-rank rank-${i < 3 ? i + 1 : "x"}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </div>
                      <div className="lb-info">
                        <div className="lb-name">{ngo.ngoName}</div>
                        <div className="lb-meta">⭐ {ngo.avgRating || 0} · 📦 {ngo.totalDeliveries || 0} deliveries</div>
                        <div className="lb-track">
                          <div className="lb-fill" style={{ width: `${Math.min((ngo.avgRating || 0) * 20, 100)}%`, background: "var(--fresh)" }} />
                        </div>
                      </div>
                      <div className="lb-stat">
                        <div className="lb-value" style={{ color: "var(--info)" }}>{ngo.avgResponseTime || "—"}</div>
                        <div className="lb-unit">min</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart icon="🏅" text="No NGO data yet" />}
            </div>
          </>
        )}

        {/* ═══════════════════ USERS TAB ═══════════════════ */}
        {activeTab === "users" && (
          <div className="chart-card">
            <div className="section-title">👥 User Management</div>
            {users.length === 0 ? (
              <EmptyChart icon="👤" text="No users found" />
            ) : (
              <div className="user-list">
                {users.map((user, i) => (
                  <div key={user._id} className="user-row" style={{ animationDelay: `${i * 0.03}s` }}>
                    <div className="user-avatar">
                      {(user.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.name}</div>
                      <div className="user-email">{user.email}</div>
                    </div>
                    <div className="user-actions">
                      <select
                        className="role-select"
                        value={user.role}
                        onChange={async (e) => {
                          await axios.patch(`/auth/users/${user._id}/role`, { role: e.target.value });
                          fetchUsers();
                        }}
                      >
                        <option value="ngo">NGO</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        className="deactivate-btn"
                        onClick={async () => {
                          await axios.patch(`/auth/users/${user._id}/deactivate`);
                          fetchUsers();
                        }}
                      >Deactivate</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */
function EmptyChart({ icon, text }) {
  return (
    <div className="empty-chart">
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <p>{text}</p>
    </div>
  );
}

/* ============================================================
   CSS
============================================================ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0e100f;
    --surface:  #161a18;
    --surface2: #1e2420;
    --border:   #2a3028;
    --text:     #e8ede9;
    --muted:    #7a8c7e;
    --accent:   #5fd475;
    --accent2:  #a8f0b4;
    --fresh:    #5fd475;
    --warn:     #f0b429;
    --danger:   #f05252;
    --info:     #60b4f0;
    --radius:   14px;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  /* ── LOADING ── */
  .loading-screen {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    background: var(--bg);
  }
  .loading-spinner {
    width: 32px; height: 32px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  .loading-text { font-family: var(--font-mono); color: var(--muted); font-size: 13px; letter-spacing: .08em; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── ROOT ── */
  .adm-root { max-width: 1100px; margin: 0 auto; padding: 28px 20px 80px; }

  /* ── HEADER ── */
  .adm-header {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 24px; margin-bottom: 24px;
    gap: 16px; flex-wrap: wrap;
  }
  .adm-brand { display: flex; align-items: center; gap: 14px; }
  .adm-logo {
    width: 44px; height: 44px; border-radius: 12px; font-size: 22px;
    background: linear-gradient(135deg, rgba(95,212,117,.2), rgba(96,180,240,.2));
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .adm-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
  .adm-sub   { font-size: 12px; color: var(--muted); font-family: var(--font-mono); margin-top: 2px; }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(95,212,117,.5); } 50% { box-shadow: 0 0 0 8px rgba(95,212,117,0); } }

  .adm-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* Tab toggle in header */
  .tab-toggle { display: flex; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 3px; gap: 3px; }
  .tab-toggle-btn {
    padding: 6px 13px; border: none; border-radius: 7px; cursor: pointer;
    font-family: var(--font-body); font-size: 12.5px; font-weight: 500;
    color: var(--muted); background: transparent; transition: .15s;
  }
  .tab-toggle-btn.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.3); }

  .adm-btn {
    padding: 9px 15px; border-radius: 9px; border: 1px solid var(--border);
    background: var(--surface2); color: var(--muted);
    font-family: var(--font-body); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: .15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
  }
  .adm-btn:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }
  .adm-btn:disabled { opacity: .5; cursor: not-allowed; }
  .adm-btn.primary { background: var(--accent); color: #0a120b; border-color: transparent; font-weight: 600; }
  .adm-btn.export  { background: rgba(96,180,240,.1); color: var(--info); border-color: rgba(96,180,240,.25); }
  .adm-btn.export:hover { background: rgba(96,180,240,.18); }
  .adm-btn.danger  { background: rgba(240,82,82,.1); color: var(--danger); border-color: rgba(240,82,82,.2); }
  .adm-btn.danger:hover { background: rgba(240,82,82,.18); }
  .adm-btn.icon    { padding: 9px 11px; }

  /* ── ERROR BANNER ── */
  .error-banner {
    background: rgba(240,82,82,.08); border: 1px solid rgba(240,82,82,.25);
    border-radius: 10px; padding: 10px 16px; font-size: 13px; color: var(--danger);
    margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;
  }
  .error-banner button { background: none; border: none; color: var(--danger); cursor: pointer; font-weight: 600; font-family: var(--font-body); font-size: 13px; }

  /* ── KPI GRID ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }
  @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 560px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

  .kpi-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px 18px;
    animation: fadeUp .3s ease both; transition: transform .15s, border-color .15s;
  }
  .kpi-card:hover { transform: translateY(-2px); border-color: #3a4438; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .kpi-icon  { font-size: 20px; margin-bottom: 8px; }
  .kpi-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; line-height: 1; }
  .kpi-label { font-size: 10px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .08em; font-family: var(--font-mono); }
  .kpi-sub   { font-size: 11px; margin-top: 5px; font-weight: 500; font-family: var(--font-mono); }

  /* ── SECTION TITLE ── */
  .section-title { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 0; }

  /* ── CHART CARD ── */
  .chart-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px 24px; margin-bottom: 20px;
    animation: fadeUp .3s ease both;
  }
  .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

  .chart-toggle { display: flex; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; gap: 3px; }
  .toggle-btn {
    padding: 5px 12px; border: none; border-radius: 6px; cursor: pointer;
    font-family: var(--font-body); font-size: 12px; font-weight: 500;
    color: var(--muted); background: transparent; transition: .15s;
  }
  .toggle-btn.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.3); }

  /* ── TWO-COL CHARTS ── */
  .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .charts-row .chart-card { margin-bottom: 0; }
  @media (max-width: 720px) { .charts-row { grid-template-columns: 1fr; } }

  /* ── SORT SELECT ── */
  .sort-select {
    padding: 7px 12px; border-radius: 9px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-body); font-size: 12.5px;
    outline: none; cursor: pointer; transition: border-color .15s;
  }
  .sort-select:focus { border-color: var(--accent); }
  .sort-select option { background: var(--surface2); }

  /* ── LEADERBOARD ── */
  .leaderboard { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .lb-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 10px;
    transition: border-color .15s;
  }
  .lb-row:hover { border-color: #3a4438; }

  .lb-rank {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .rank-1 { background: rgba(240,180,41,.15); color: var(--warn); }
  .rank-2 { background: rgba(122,140,126,.15); color: var(--muted); }
  .rank-3 { background: rgba(194,65,12,.15); color: #c2410c; }
  .rank-x { background: var(--surface); color: var(--muted); font-size: 12px; }

  .lb-info { flex: 1; min-width: 0; }
  .lb-name { font-family: var(--font-display); font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb-meta { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: var(--font-mono); }
  .lb-track { height: 4px; background: var(--border); border-radius: 99px; margin-top: 6px; overflow: hidden; }
  .lb-fill  { height: 100%; border-radius: 99px; transition: width .6s ease; }

  .lb-stat { text-align: right; flex-shrink: 0; }
  .lb-value { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--accent); }
  .lb-unit  { font-size: 10px; color: var(--muted); font-family: var(--font-mono); margin-top: 1px; }

  /* ── USER LIST ── */
  .user-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .user-row {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 10px;
    animation: fadeUp .3s ease both; transition: border-color .15s;
  }
  .user-row:hover { border-color: #3a4438; }

  .user-avatar {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(95,212,117,.2), rgba(96,180,240,.2));
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--accent);
  }
  .user-info { flex: 1; min-width: 0; }
  .user-name  { font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--text); }
  .user-email { font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .user-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  .role-select {
    padding: 7px 11px; border-radius: 8px;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-body); font-size: 12.5px;
    outline: none; cursor: pointer; transition: border-color .15s;
  }
  .role-select:focus { border-color: var(--accent); }
  .role-select option { background: var(--surface2); }

  .deactivate-btn {
    padding: 7px 13px; border-radius: 8px; border: 1px solid rgba(240,82,82,.25);
    background: rgba(240,82,82,.1); color: var(--danger);
    font-family: var(--font-body); font-size: 12.5px; font-weight: 500;
    cursor: pointer; transition: .15s;
  }
  .deactivate-btn:hover { background: rgba(240,82,82,.2); }

  /* ── EMPTY CHART ── */
  .empty-chart {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 180px; color: var(--muted); font-size: 13px; font-family: var(--font-mono);
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 640px) {
    .adm-header { flex-direction: column; align-items: flex-start; }
    .kpi-grid   { grid-template-columns: repeat(2, 1fr); }
    .user-row   { flex-wrap: wrap; }
    .user-actions { width: 100%; }
  }
`;

export default AdminDashboard;
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

/* ============================================================
   HELPERS
============================================================ */
const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getFreshnessColor = (score) => {
  const s = score ?? 0;
  if (s >= 70) return "var(--fresh)";
  if (s >= 40) return "var(--warn)";
  return "var(--danger)";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const computeCountdown = (predictedExpiry, nowMs) => {
  if (!predictedExpiry) return null;
  const diffMs = new Date(predictedExpiry).getTime() - nowMs;
  if (diffMs <= 0) return { label: "Expired", urgent: true, expired: true };
  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const urgent = diffMs < 30 * 60 * 1000;
  if (hours > 0) return { label: `${hours}h ${mins}m`, urgent, expired: false };
  return { label: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`, urgent, expired: false };
};

/* ============================================================
   SUB-COMPONENTS
============================================================ */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ExpiryCountdown = ({ predictedExpiry, now }) => {
  const cd = computeCountdown(predictedExpiry, now);
  if (!cd) return null;
  if (cd.expired)
    return <span className="expiry-pill expired">⚠ Expired</span>;
  return (
    <span className={`expiry-pill ${cd.urgent ? "urgent" : ""}`}>
      <span className="expiry-icon">⏱</span>
      {cd.label}
    </span>
  );
};

/* FIX 3: ChangeView now uses useEffect so it only fires when
   center actually changes — previously ran on every render
   which fought the user every time they panned or zoomed */
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */
function NGODashboard() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const fetchDataRef = useRef(null);
  const notifRef = useRef(null);
  const now = useNow();

  const [nearbyFood, setNearbyFood] = useState([]);
  const [myFood, setMyFood] = useState({ reserved: [], picked: [], delivered: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("nearby");
  const [actionLoading, setActionLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  /* FIX 1: food type filter options now match Food model enum exactly:
     ["cooked", "raw", "packaged", "beverages", "other"]
     Previous options "veg" / "non-veg" never matched anything */
  const [foodTypeFilter, setFoodTypeFilter] = useState("all");
  const [storageFilter, setStorageFilter] = useState("all");
  const [freshnessFilter, setFreshnessFilter] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  /* FIX 2: map center starts as Bengaluru fallback but updates
     to the NGO's actual area once food listings are loaded */
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]);

  const userId = localStorage.getItem("userId") || "guest";
  const storageKey = `notifications_${userId}_ngo`;

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_unread`);
    return saved ? JSON.parse(saved) : 0;
  });

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      setError("");
      const [nearbyRes, myRes] = await Promise.all([
        axios.get("/food/nearby"),
        axios.get("/food/ngo/dashboard"),
      ]);
      const food = nearbyRes.data || [];
      setNearbyFood(food);
      setMyFood(myRes.data || { reserved: [], picked: [], delivered: [] });

      /* FIX 2: derive map center from first listing's coordinates
         so the map is always centered on the NGO's actual area */
      if (food.length > 0 && food[0].location?.coordinates) {
        const [lng, lat] = food[0].location.coordinates;
        setMapCenter([lat, lng]); // Leaflet expects [lat, lng]
      }
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to refresh dashboard.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDataRef.current = fetchData; fetchData(); }, [fetchData]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_unread`, JSON.stringify(unreadCount));
  }, [unreadCount, storageKey]);

  /* Socket.io */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    socketRef.current = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    const handleNotification = (data) => {
      setNotifications(prev => [
        { ...data, id: Date.now(), read: false, timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 50));
      setUnreadCount(c => c + 1);
      if (fetchDataRef.current) fetchDataRef.current(true);
    };
    socketRef.current.on("food_reserved", handleNotification);
    socketRef.current.on("food_picked", handleNotification);
    socketRef.current.on("food_delivered", handleNotification);
    return () => {
      socketRef.current?.off("food_reserved");
      socketRef.current?.off("food_picked");
      socketRef.current?.off("food_delivered");
      socketRef.current?.disconnect();
    };
  }, []);

  /* FIX 5: click-outside closes notification panel */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const downloadCSV = (data, filename = "export.csv") => {
    if (!data || data.length === 0) { alert("No data to export"); return; }
    const headers = ["Food Type", "Quantity", "Status", "Freshness (%)", "Storage", "Restaurant", "Created At", "Delivered At"];
    const rows = data.map(item => [
      item.foodType, item.quantity, item.status, item.freshnessScore,
      item.storageType, item.restaurant?.name || "—",
      new Date(item.createdAt).toLocaleString(),
      item.deliveredAt ? new Date(item.deliveredAt).toLocaleString() : "—",
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reserveFood = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await axios.patch(`/food/reserve/${id}`);
      setSuccess("Reserved successfully! 📦");
      fetchData(true);
    } catch (err) { setError(err.response?.data?.message || "Reservation failed."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const markDelivered = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await axios.patch(`/food/deliver/${id}`);
      setSuccess("Marked as delivered! ✅");
      fetchData(true);
    } catch (err) { setError("Failed to update status."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const tabs = useMemo(() => [
    { id: "nearby",   label: "Available", icon: "📍", count: nearbyFood.length },
    { id: "reserved", label: "Reserved",  icon: "📦", count: myFood.reserved.length },
    { id: "picked",   label: "Ready",     icon: "🚚", count: myFood.picked.length },
    { id: "delivered",label: "History",   icon: "✅", count: myFood.delivered.length },
  ], [nearbyFood.length, myFood]);

  const filteredNearbyFood = useMemo(() => {
    return nearbyFood.filter(item => {
      const matchesSearch =
        item.foodType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.restaurant?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      /* FIX 1: compare against model enum values, not "veg"/"non-veg" */
      const matchesFoodType = foodTypeFilter === "all" || item.foodType === foodTypeFilter;
      const matchesStorage  = storageFilter === "all"  || item.storageType === storageFilter;
      const matchesFreshness = item.freshnessScore >= freshnessFilter;
      return matchesSearch && matchesFoodType && matchesStorage && matchesFreshness;
    });
  }, [nearbyFood, searchTerm, foodTypeFilter, storageFilter, freshnessFilter]);

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="loading-screen">
          <div className="loading-leaf">🌱</div>
          <p className="loading-text">Loading Dashboard…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="ngo-root">

        {/* ── SIDEBAR ─────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="brand-icon">🌿</span>
            <span className="brand-name">FoodBridge</span>
          </div>

          <nav className="sidebar-nav">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`nav-item ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                <span className="nav-icon">{t.icon}</span>
                <span className="nav-label">{t.label}</span>
                <span className="nav-count">{t.count}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="sidebar-btn"
              onClick={() => navigate("/profile")}
            >
              <span>👤</span> Profile
            </button>
            <button
              className="sidebar-btn logout"
              onClick={() => { localStorage.clear(); navigate("/login"); }}
            >
              <span>⎋</span> Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────── */}
        <div className="main-area">

          {/* ── TOPBAR ── */}
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="page-title">
                {tabs.find(t => t.id === activeTab)?.label}
                {refreshing && <span className="live-dot" title="Syncing…" />}
              </h1>
              <p className="page-sub">Smart food redistribution · Bengaluru</p>
            </div>
            <div className="topbar-actions">
              <button
                className="action-btn export"
                onClick={() => downloadCSV(nearbyFood, `ngo_food_${new Date().toISOString().slice(0, 10)}.csv`)}
              >
                ⬇ Export
              </button>
              <button
                className="action-btn"
                onClick={() => fetchData(true)}
                disabled={refreshing}
              >
                ↻ Refresh
              </button>

              {/* FIX 5: notifRef wired to wrapper div for click-outside */}
              <div className="notif-wrap" ref={notifRef}>
                <button
                  className="notif-btn"
                  onClick={() => {
                    setShowNotifications(s => !s);
                    setUnreadCount(0);
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }}
                >
                  🔔
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                {showNotifications && (
                  <div className="notif-panel">
                    <div className="notif-header">
                      <span>Notifications</span>
                      <button className="notif-close" onClick={() => setShowNotifications(false)}>×</button>
                    </div>
                    <div className="notif-list">
                      {notifications.length === 0
                        ? <div className="notif-empty">All clear — no alerts</div>
                        : notifications.map(n => (
                          <div key={n.id} className={`notif-item ${n.read ? "" : "unread"}`}>
                            <span className="notif-msg">🚚 {n.message}</span>
                            <span className="notif-time">{formatTime(n.timestamp)}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── ALERTS ── */}
          {success && (
            <div className="flash success">
              <span>{success}</span>
              <button onClick={() => setSuccess("")}>×</button>
            </div>
          )}
          {error && (
            <div className="flash error">
              <span>{error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {/* ── CONTENT ── */}
          <main className="content">

            {/* ══ NEARBY TAB ══ */}
            {activeTab === "nearby" && (
              <div className="tab-panel">

                {/* Filter bar */}
                <div className="filter-bar">
                  <div className="search-wrap">
                    <span className="search-icon">⌕</span>
                    <input
                      className="search-input"
                      type="text"
                      placeholder="Search food or restaurant…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="filter-selects">
                    {/* FIX 1: options now match Food model enum exactly */}
                    <select
                      className="filter-select"
                      value={foodTypeFilter}
                      onChange={e => setFoodTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      <option value="cooked">🍳 Cooked</option>
                      <option value="raw">🥦 Raw</option>
                      <option value="packaged">📦 Packaged</option>
                      <option value="beverages">🥤 Beverages</option>
                      <option value="other">🍱 Other</option>
                    </select>
                    <select
                      className="filter-select"
                      value={storageFilter}
                      onChange={e => setStorageFilter(e.target.value)}
                    >
                      <option value="all">All Storage</option>
                      <option value="room">🌡 Room Temp</option>
                      <option value="refrigerated">❄ Refrigerated</option>
                    </select>
                    <select
                      className="filter-select"
                      value={freshnessFilter}
                      onChange={e => setFreshnessFilter(Number(e.target.value))}
                    >
                      <option value={0}>Any Freshness</option>
                      <option value={70}>70%+ Fresh</option>
                      <option value={50}>50%+ Fresh</option>
                      <option value={30}>30%+ Fresh</option>
                    </select>
                  </div>
                </div>

                {/* Map — FIX 2: center derived from real data, FIX 3: ChangeView uses useEffect */}
                <div className="map-shell">
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ChangeView center={mapCenter} />
                    {filteredNearbyFood.map(item =>
                      item.location?.coordinates && (
                        <Marker
                          key={item._id}
                          position={[
                            item.location.coordinates[1],
                            item.location.coordinates[0],
                          ]}
                        >
                          <Popup>
                            <strong>{item.foodType}</strong><br />
                            🏪 {item.restaurant?.name}<br />
                            🌿 {item.freshnessScore}% Fresh<br />
                            📦 {item.quantity} units<br />
                            <button
                              onClick={() => reserveFood(item._id)}
                              disabled={actionLoading[item._id]}
                              style={{ marginTop: 8, cursor: "pointer", width: "100%" }}
                            >
                              {actionLoading[item._id] ? "Reserving…" : "Reserve"}
                            </button>
                          </Popup>
                        </Marker>
                      )
                    )}
                  </MapContainer>
                </div>

                {/* Cards */}
                <div className="result-meta">
                  {filteredNearbyFood.length} listing{filteredNearbyFood.length !== 1 ? "s" : ""}
                </div>
                {filteredNearbyFood.length === 0
                  ? <EmptyState icon="🍽" message="No food matches your filters." />
                  : (
                    <div className="card-grid">
                      {filteredNearbyFood.map((item, i) => (
                        <FoodCard
                          key={item._id}
                          item={item}
                          now={now}
                          actionLoading={actionLoading}
                          onReserve={reserveFood}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        />
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ══ RESERVED TAB ══ */}
            {activeTab === "reserved" && (
              <div className="tab-panel">
                {myFood.reserved.length === 0
                  ? <EmptyState icon="📦" message="Nothing reserved yet." />
                  : (
                    <div className="card-grid">
                      {myFood.reserved.map(item => (
                        <div key={item._id} className="card status-card">
                          <div className="card-type">{item.foodType}</div>
                          <div className="pending-banner">
                            <span className="pending-dot" />
                            Awaiting restaurant pickup confirmation
                          </div>
                          <div className="card-meta-row">
                            <span>📦 {item.quantity} units</span>
                            <span>🏪 {item.restaurant?.name || "Partner"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ══ PICKED TAB ══ */}
            {activeTab === "picked" && (
              <div className="tab-panel">
                {myFood.picked.length === 0
                  ? <EmptyState icon="🚚" message="No items ready to deliver." />
                  : (
                    <div className="card-grid">
                      {myFood.picked.map(item => (
                        <div key={item._id} className="card status-card">
                          <div className="card-type">{item.foodType}</div>
                          <div className="card-meta-row">
                            <span>📦 {item.quantity} units</span>
                            <span>🏪 {item.restaurant?.name || "Partner"}</span>
                          </div>
                          <button
                            className="cta-btn deliver"
                            onClick={() => markDelivered(item._id)}
                            disabled={actionLoading[item._id]}
                          >
                            {actionLoading[item._id] ? "Updating…" : "✓ Mark Delivered"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            {/* ══ HISTORY TAB ══ */}
            {activeTab === "delivered" && (
              <div className="tab-panel">
                {myFood.delivered.length === 0
                  ? <EmptyState icon="✅" message="No deliveries yet." />
                  : (
                    <div className="history-list">
                      {myFood.delivered.map((item, i) => (
                        <div
                          key={item._id}
                          className="history-row"
                          style={{ animationDelay: `${i * 0.04}s` }}
                        >
                          <div className="history-check">✓</div>
                          <div className="history-info">
                            <span className="history-type">{item.foodType}</span>
                            <span className="history-qty">· {item.quantity} units</span>
                          </div>
                          <div className="history-date">{formatDate(item.deliveredAt)}</div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   FOOD CARD SUB-COMPONENT
============================================================ */
function FoodCard({ item, now, actionLoading, onReserve, style }) {
  const score = item.freshnessScore ?? 0;
  const color = getFreshnessColor(score);
  return (
    <div className="card food-card" style={style}>
      {item.image
        ? (
          <div className="card-img-wrap">
            <img src={item.image} alt={item.foodType} className="card-img" />
            <ExpiryCountdown predictedExpiry={item.predictedExpiry} now={now} />
          </div>
        ) : (
          <div className="card-no-img">
            <ExpiryCountdown predictedExpiry={item.predictedExpiry} now={now} />
          </div>
        )
      }

      <div className="card-body">
        <div className="card-title-row">
          <h3 className="card-type">{item.foodType}</h3>
          <span className="freshness-label" style={{ color }}>{score}%</span>
        </div>

        <div className="freshness-track">
          <div
            className="freshness-fill"
            style={{ width: `${score}%`, background: color }}
          />
        </div>

        <div className="card-meta-row">
          <span>📦 {item.quantity} units</span>
          <span>🏪 {item.restaurant?.name || "Partner"}</span>
          {item.storageType && (
            <span>{item.storageType === "refrigerated" ? "❄" : "🌡"} {item.storageType}</span>
          )}
        </div>

        <button
          className="cta-btn reserve"
          onClick={() => onReserve(item._id)}
          disabled={actionLoading[item._id]}
        >
          {actionLoading[item._id]
            ? <span className="btn-spinner" />
            : "＋ Reserve Food"
          }
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */
function EmptyState({ icon, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p>{message}</p>
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
    --sidebar-w: 220px;
    --radius:   14px;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  /* ── LOADING ── */
  .loading-screen {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; background: var(--bg); gap: 16px;
  }
  .loading-leaf { font-size: 48px; animation: spin 2s linear infinite; }
  .loading-text { font-family: var(--font-mono); color: var(--muted); font-size: 14px; letter-spacing: .1em; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── ROOT LAYOUT ── */
  .ngo-root { display: flex; min-height: 100vh; }

  /* ── SIDEBAR ── */
  .sidebar {
    width: var(--sidebar-w);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    padding: 24px 0;
    position: fixed; top: 0; left: 0; height: 100vh;
    z-index: 100;
  }
  .sidebar-brand {
    display: flex; align-items: center; gap: 10px;
    padding: 0 20px 28px;
    border-bottom: 1px solid var(--border);
  }
  .brand-icon { font-size: 22px; }
  .brand-name {
    font-family: var(--font-display); font-weight: 800; font-size: 17px;
    letter-spacing: -.01em; color: var(--accent2);
  }

  .sidebar-nav { display: flex; flex-direction: column; gap: 4px; padding: 20px 12px; flex: 1; }

  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 12px; border-radius: 10px;
    background: none; border: none; color: var(--muted);
    cursor: pointer; font-family: var(--font-body); font-size: 14px; font-weight: 500;
    transition: background .15s, color .15s;
    text-align: left; width: 100%;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: var(--accent); color: #0a120b; font-weight: 600; }
  .nav-item.active .nav-count { background: rgba(0,0,0,.15); color: #0a120b; }
  .nav-icon  { font-size: 16px; flex-shrink: 0; }
  .nav-label { flex: 1; }
  .nav-count {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    background: var(--surface2); color: var(--muted);
    padding: 2px 7px; border-radius: 20px;
  }

  .sidebar-footer {
    padding: 16px 12px 0; border-top: 1px solid var(--border);
    margin-top: auto; display: flex; flex-direction: column; gap: 6px;
  }
  .sidebar-btn {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    border: 1px solid var(--border); background: none;
    color: var(--muted); font-family: var(--font-body); font-size: 13px;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: .15s;
  }
  .sidebar-btn:hover { background: var(--surface2); color: var(--text); }
  .sidebar-btn.logout:hover { background: rgba(240,82,82,.12); color: var(--danger); border-color: var(--danger); }

  /* ── MAIN AREA ── */
  .main-area { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-width: 0; }

  /* ── TOPBAR ── */
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 22px 32px; background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 50;
  }
  .page-title {
    font-family: var(--font-display); font-size: 22px; font-weight: 700;
    display: flex; align-items: center; gap: 10px; color: var(--text);
  }
  .page-sub { font-size: 12px; color: var(--muted); margin-top: 2px; font-family: var(--font-mono); letter-spacing: .04em; }

  .live-dot {
    display: inline-block; width: 8px; height: 8px;
    background: var(--accent); border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(95,212,117,.5); }
    50%      { box-shadow: 0 0 0 8px rgba(95,212,117,0); }
  }

  .topbar-actions { display: flex; align-items: center; gap: 10px; }
  .action-btn {
    padding: 9px 16px; border-radius: 9px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--muted); font-family: var(--font-body); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: .15s;
  }
  .action-btn:hover { color: var(--text); border-color: var(--muted); }
  .action-btn:disabled { opacity: .5; cursor: not-allowed; }
  .action-btn.export { background: rgba(95,212,117,.12); color: var(--accent); border-color: rgba(95,212,117,.3); }
  .action-btn.export:hover { background: rgba(95,212,117,.2); }

  /* ── NOTIFICATIONS ── */
  .notif-wrap { position: relative; }
  .notif-btn {
    position: relative; width: 40px; height: 40px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; cursor: pointer; font-size: 18px;
    display: flex; align-items: center; justify-content: center; transition: .15s;
  }
  .notif-btn:hover { border-color: var(--muted); }
  .notif-badge {
    position: absolute; top: -5px; right: -5px;
    background: var(--danger); color: #fff;
    font-size: 9px; font-weight: 700; font-family: var(--font-mono);
    width: 17px; height: 17px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%; border: 2px solid var(--surface);
  }
  .notif-panel {
    position: absolute; top: 50px; right: 0;
    width: 300px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0,0,0,.5);
    overflow: hidden; z-index: 200;
    animation: slideDown .15s ease;
  }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  .notif-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 16px; font-family: var(--font-display); font-weight: 700; font-size: 13px;
    border-bottom: 1px solid var(--border);
  }
  .notif-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 18px; }
  .notif-list { max-height: 280px; overflow-y: auto; }
  .notif-item {
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 3px;
  }
  .notif-item.unread { background: rgba(95,212,117,.05); }
  .notif-msg  { font-size: 13px; color: var(--text); }
  .notif-time { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
  .notif-empty { padding: 28px 16px; text-align: center; color: var(--muted); font-size: 13px; font-family: var(--font-mono); }

  /* ── FLASH ── */
  .flash {
    margin: 16px 32px 0; padding: 12px 16px; border-radius: 10px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; font-weight: 500; animation: slideDown .2s ease;
  }
  .flash button { background: none; border: none; cursor: pointer; font-size: 18px; opacity: .7; }
  .flash.success { background: rgba(95,212,117,.12); color: var(--accent); border: 1px solid rgba(95,212,117,.25); }
  .flash.error   { background: rgba(240,82,82,.12);  color: var(--danger); border: 1px solid rgba(240,82,82,.25); }

  /* ── CONTENT ── */
  .content { padding: 28px 32px; flex: 1; }
  .tab-panel { animation: fadeUp .2s ease both; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  /* ── FILTERS ── */
  .filter-bar {
    display: flex; gap: 12px; align-items: center;
    flex-wrap: wrap; margin-bottom: 18px;
  }
  .search-wrap {
    flex: 1; min-width: 200px;
    display: flex; align-items: center;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 0 14px; gap: 8px;
    transition: border-color .15s;
  }
  .search-wrap:focus-within { border-color: var(--accent); }
  .search-icon { color: var(--muted); font-size: 18px; }
  .search-input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 11px 0;
  }
  .search-input::placeholder { color: var(--muted); }
  .filter-selects { display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-select {
    padding: 10px 14px; border-radius: 10px;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-body); font-size: 13px;
    cursor: pointer; outline: none; transition: .15s;
  }
  .filter-select:focus { border-color: var(--accent); }

  /* ── MAP ── */
  .map-shell {
    height: 300px; border-radius: var(--radius);
    overflow: hidden; border: 1px solid var(--border); margin-bottom: 20px;
  }

  /* ── RESULT META ── */
  .result-meta {
    font-family: var(--font-mono); font-size: 12px; color: var(--muted);
    margin-bottom: 14px; letter-spacing: .04em;
  }

  /* ── CARD GRID ── */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  /* ── CARD ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    animation: fadeUp .3s ease both;
    transition: border-color .2s, transform .2s;
  }
  .card:hover { transform: translateY(-2px); border-color: #3a4438; }

  .card-img-wrap { position: relative; }
  .card-img { width: 100%; height: 160px; object-fit: cover; display: block; }
  .card-no-img { padding: 16px 16px 0; display: flex; justify-content: flex-end; }
  .card-img-wrap .expiry-pill { position: absolute; top: 10px; right: 10px; }

  .card-body { padding: 14px 16px 16px; }
  .card-title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .card-type { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text); }
  .freshness-label { font-family: var(--font-mono); font-size: 13px; font-weight: 500; }

  .freshness-track {
    height: 4px; background: var(--surface2); border-radius: 99px;
    margin-bottom: 12px; overflow: hidden;
  }
  .freshness-fill { height: 100%; border-radius: 99px; transition: width .5s ease; }

  .card-meta-row {
    display: flex; gap: 12px; flex-wrap: wrap;
    font-size: 12px; color: var(--muted); margin-bottom: 14px;
    font-family: var(--font-mono);
  }

  /* status cards */
  .status-card { padding: 18px 20px; }
  .pending-banner {
    margin: 10px 0 12px; padding: 10px 14px; border-radius: 9px;
    background: rgba(240,180,41,.08); color: var(--warn);
    border: 1px solid rgba(240,180,41,.2);
    font-size: 13px; display: flex; align-items: center; gap: 8px;
  }
  .pending-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--warn); flex-shrink: 0;
    animation: pulse 1.5s infinite;
  }

  /* ── CTA BUTTONS ── */
  .cta-btn {
    width: 100%; padding: 11px; border-radius: 9px;
    border: none; cursor: pointer; font-family: var(--font-body);
    font-size: 13.5px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    transition: .15s; gap: 6px;
  }
  .cta-btn:disabled { opacity: .55; cursor: not-allowed; }
  .cta-btn.reserve { background: var(--accent); color: #0a120b; }
  .cta-btn.reserve:hover:not(:disabled) { background: var(--accent2); }
  .cta-btn.deliver { background: rgba(95,212,117,.12); color: var(--accent); border: 1px solid rgba(95,212,117,.25); }
  .cta-btn.deliver:hover:not(:disabled) { background: rgba(95,212,117,.2); }

  .btn-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,.3); border-top-color: #0a120b;
    animation: spin .6s linear infinite; display: inline-block;
  }

  /* ── EXPIRY PILL ── */
  .expiry-pill {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    padding: 4px 10px; border-radius: 20px;
    background: rgba(95,212,117,.12); color: var(--accent);
    border: 1px solid rgba(95,212,117,.25);
    display: inline-flex; align-items: center; gap: 5px;
  }
  .expiry-pill.urgent {
    background: rgba(240,82,82,.1); color: var(--danger);
    border-color: rgba(240,82,82,.3); animation: blink 1s infinite;
  }
  .expiry-pill.expired {
    background: rgba(240,82,82,.1); color: var(--danger); border-color: rgba(240,82,82,.3);
  }
  @keyframes blink { 50% { opacity: .55; } }

  /* ── HISTORY ── */
  .history-list { display: flex; flex-direction: column; gap: 8px; }
  .history-row {
    display: flex; align-items: center; gap: 14px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 18px;
    animation: fadeUp .3s ease both;
  }
  .history-check {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(95,212,117,.12); color: var(--accent);
    border: 1px solid rgba(95,212,117,.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; flex-shrink: 0;
  }
  .history-info { flex: 1; display: flex; align-items: baseline; gap: 6px; }
  .history-type { font-family: var(--font-display); font-weight: 600; font-size: 14px; }
  .history-qty  { font-size: 12px; color: var(--muted); font-family: var(--font-mono); }
  .history-date { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }

  /* ── EMPTY STATE ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    padding: 60px 20px; gap: 14px; color: var(--muted);
  }
  .empty-icon { font-size: 40px; }
  .empty-state p { font-size: 14px; font-family: var(--font-mono); }

  /* ── RESPONSIVE ── */
  @media (max-width: 700px) {
    .sidebar { width: 60px; }
    .brand-name, .nav-label, .sidebar-btn span:last-child { display: none; }
    .main-area { margin-left: 60px; }
    .content { padding: 20px 16px; }
    .topbar { padding: 16px; }
  }
`;

export default NGODashboard;
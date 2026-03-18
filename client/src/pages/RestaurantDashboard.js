import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

/* ============================================================
   HELPERS
============================================================ */
const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getStatusMeta = (status) =>
  ({
    available: { label: "Available", color: "var(--fresh)",  bg: "rgba(95,212,117,.1)",  border: "rgba(95,212,117,.25)" },
    reserved:  { label: "Reserved",  color: "var(--info)",   bg: "rgba(96,180,240,.1)",  border: "rgba(96,180,240,.25)" },
    picked:    { label: "Picked",    color: "var(--warn)",   bg: "rgba(240,180,41,.1)",  border: "rgba(240,180,41,.25)" },
    delivered: { label: "Delivered", color: "var(--muted)",  bg: "rgba(120,140,125,.1)", border: "rgba(120,140,125,.2)" },
    expired:   { label: "Expired",   color: "var(--danger)", bg: "rgba(240,82,82,.1)",   border: "rgba(240,82,82,.25)" },
  })[status] || { label: status, color: "var(--muted)", bg: "var(--surface2)", border: "var(--border)" };

const getNotifIcon = (type) =>
  ({ food_reserved: "📦", food_delivered: "✅" })[type] || "🔔";

const getFreshnessColor = (score) => {
  const s = score ?? 0;
  if (s >= 70) return "var(--fresh)";
  if (s >= 40) return "var(--warn)";
  return "var(--danger)";
};

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

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
  return {
    label: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    urgent,
    expired: false,
  };
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
  if (cd.expired) return <span className="expiry-pill expired">⚠ Expired</span>;
  return (
    <span className={`expiry-pill ${cd.urgent ? "urgent" : ""}`}>
      <span>⏱</span> {cd.label}
    </span>
  );
};

const StarRating = ({ value, hover, onRate, onHover, onLeave }) => (
  <div style={{ display: "flex", gap: 6 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onRate(star)}
        onMouseEnter={() => onHover(star)}
        onMouseLeave={onLeave}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 30,
          color: star <= (hover || value) ? "#f0b429" : "var(--border)",
          transform: star <= (hover || value) ? "scale(1.15)" : "scale(1)",
          transition: "0.12s", lineHeight: 1,
        }}
      >★</button>
    ))}
  </div>
);

/* ============================================================
   MAIN COMPONENT
============================================================ */
function RestaurantDashboard() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const fetchDataRef = useRef(null);
  const notifRef = useRef(null);
  const now = useNow();

  const [food, setFood] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const userId = localStorage.getItem("userId") || "guest";
  const storageKey = `notifications_${userId}`;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_unread`);
    return saved ? JSON.parse(saved) : 0;
  });

  const [ratedFoodIds, setRatedFoodIds] = useState(new Set());
  const [ratingModal, setRatingModal] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editData, setEditData] = useState({ quantity: "", storageType: "", cookedTime: "" });
  const [editLoading, setEditLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchFood = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [foodRes, ratingsRes] = await Promise.all([
        axios.get("/food/restaurant/dashboard"),
        axios.get("/ratings/my"),
      ]);
      setFood(foodRes.data || []);
      setRatedFoodIds(new Set((ratingsRes.data.ratedFoodIds || []).map(String)));
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to refresh data.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDataRef.current = fetchFood; fetchFood(); }, [fetchFood]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}_unread`, JSON.stringify(unreadCount));
  }, [unreadCount, storageKey]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (socketRef.current?.connected) return;
    socketRef.current = io(SOCKET_URL, {
      auth: { token }, transports: ["websocket", "polling"], reconnection: true,
    });
    const addNotif = (data) => {
      setNotifications(prev => [
        { ...data, id: Date.now(), read: false, timestamp: new Date().toISOString() },
        ...prev,
      ].slice(0, 50));
      setUnreadCount(p => p + 1);
      if (fetchDataRef.current) fetchDataRef.current(true);
    };
    socketRef.current.on("food_reserved", addNotif);
    socketRef.current.on("food_delivered", addNotif);
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const handleMarkPicked = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await axios.patch(`/food/pick/${id}`);
      setSuccess("Pickup confirmed! ✅");
      fetchFood(true);
    } catch { setError("Failed to update status."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const handleDelete = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    setDeleteConfirm(null);
    try {
      await axios.delete(`/food/${id}`);
      setSuccess("Listing removed.");
      fetchFood(true);
    } catch { setError("Error deleting."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const handleEdit = (item) => {
    setEditModal(item);
    setEditData({ quantity: item.quantity, storageType: item.storageType, cookedTime: item.cookedTime?.slice(0, 16) });
  };

  const submitEdit = async () => {
    setEditLoading(true);
    try {
      await axios.patch(`/food/${editModal._id}`, editData);
      setSuccess("Updated successfully ✏️");
      setEditModal(null);
      fetchFood(true);
    } catch { setError("Failed to update"); }
    finally { setEditLoading(false); }
  };

  const submitRating = async () => {
    if (ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
      await axios.post("/ratings", { foodId: ratingModal.foodId, rating: ratingValue, comment: ratingComment });
      setRatedFoodIds(prev => new Set([...prev, String(ratingModal.foodId)]));
      setSuccess("Rating submitted! ⭐");
      setRatingModal(null);
    } catch { setError("Failed to submit rating."); }
    finally { setRatingSubmitting(false); }
  };

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
    link.href = url; link.setAttribute("download", filename);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const stats = useMemo(() => ({
    all:       food.length,
    available: food.filter(f => f.status === "available").length,
    reserved:  food.filter(f => f.status === "reserved").length,
    picked:    food.filter(f => f.status === "picked").length,
    delivered: food.filter(f => f.status === "delivered").length,
  }), [food]);

  const filteredFood = useMemo(() =>
    activeFilter === "all" ? food : food.filter(f => f.status === activeFilter),
    [food, activeFilter]
  );

  const STAT_TABS = [
    { key: "all",       label: "All",       icon: "◎" },
    { key: "available", label: "Available", icon: "📍" },
    { key: "reserved",  label: "Reserved",  icon: "📦" },
    { key: "picked",    label: "Picked",    icon: "🚚" },
    { key: "delivered", label: "Delivered", icon: "✅" },
  ];

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="loading-screen">
          <div className="loading-leaf">🍽</div>
          <p className="loading-text">Loading Dashboard…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="r-root">

        {/* ── TOPBAR ── */}
        <header className="r-topbar">
          <div className="topbar-brand">
            <span className="brand-icon">🍴</span>
            <div>
              <h1 className="brand-title">Restaurant Dashboard</h1>
              <p className="brand-sub">Food donation management</p>
            </div>
            {refreshing && <span className="live-dot" title="Syncing…" />}
          </div>

          <div className="topbar-actions">
            <button
              className="action-btn primary"
              onClick={() => navigate("/add-donation")}
            >＋ Add Food</button>
            <button
              className="action-btn export"
              onClick={() => downloadCSV(filteredFood, "restaurant_data.csv")}
            >⬇ Export CSV</button>

            {/* Notifications */}
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
                          <span className="notif-msg">{getNotifIcon(n.type)} {n.message}</span>
                          <span className="notif-time">{formatTime(n.timestamp)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            <button
              className="action-btn danger"
              onClick={() => { localStorage.clear(); navigate("/login"); }}
            >⎋ Logout</button>
          </div>
        </header>

        {/* ── ALERTS ── */}
        <div className="alert-area">
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
        </div>

        {/* ── STAT TABS ── */}
        <div className="stat-tabs">
          {STAT_TABS.map(t => (
            <button
              key={t.key}
              className={`stat-tab ${activeFilter === t.key ? "active" : ""}`}
              onClick={() => setActiveFilter(t.key)}
            >
              <span className="stat-icon">{t.icon}</span>
              <span className="stat-count">{stats[t.key]}</span>
              <span className="stat-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── FOOD LIST ── */}
        <main className="r-content">
          {filteredFood.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🍽</div>
              <p>No {activeFilter === "all" ? "" : activeFilter} listings found.</p>
            </div>
          ) : (
            <div className="food-list">
              {filteredFood.map((item, i) => {
                const sm = getStatusMeta(item.status);
                const score = item.freshnessScore ?? 0;
                return (
                  <div
                    key={item._id}
                    className="food-card"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    {/* Image */}
                    {item.image && (
                      <div className="food-img-wrap">
                        <img src={item.image} alt={item.foodType} className="food-img" />
                      </div>
                    )}

                    <div className="food-body">
                      {/* Title row */}
                      <div className="food-title-row">
                        <h3 className="food-type">{item.foodType}</h3>
                        <div className="food-badges">
                          <ExpiryCountdown predictedExpiry={item.predictedExpiry} now={now} />
                          <span
                            className="status-badge"
                            style={{ color: sm.color, background: sm.bg, border: `1px solid ${sm.border}` }}
                          >
                            ● {sm.label}
                          </span>
                        </div>
                      </div>

                      {/* Freshness bar */}
                      <div className="freshness-track">
                        <div
                          className="freshness-fill"
                          style={{ width: `${score}%`, background: getFreshnessColor(score) }}
                        />
                      </div>

                      {/* Meta */}
                      <div className="food-meta">
                        <span>📦 {item.quantity} units</span>
                        <span
                          className="freshness-pct"
                          style={{ color: getFreshnessColor(score) }}
                        >
                          🌿 {score}% fresh
                        </span>
                        {item.storageType && (
                          <span>{item.storageType === "refrigerated" ? "❄" : "🌡"} {item.storageType}</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="food-actions">
                        {item.status === "reserved" && (
                          <button
                            className="food-btn confirm"
                            onClick={() => handleMarkPicked(item._id)}
                            disabled={actionLoading[item._id]}
                          >
                            {actionLoading[item._id] ? <span className="btn-spinner" /> : "✓ Confirm Pickup"}
                          </button>
                        )}
                        {item.status === "delivered" && !ratedFoodIds.has(String(item._id)) && (
                          <button
                            className="food-btn rate"
                            onClick={() => { setRatingModal({ foodId: item._id, ngoName: item.reservedBy?.name }); setRatingValue(0); setRatingComment(""); }}
                          >
                            ⭐ Rate NGO
                          </button>
                        )}
                        {item.status === "available" && (
                          <>
                            <button className="food-btn edit" onClick={() => handleEdit(item)}>✏ Edit</button>
                            <button
                              className="food-btn remove"
                              onClick={() => setDeleteConfirm(item._id)}
                              disabled={actionLoading[item._id]}
                            >
                              {actionLoading[item._id] ? <span className="btn-spinner" /> : "✕ Remove"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── RATING MODAL ── */}
      {ratingModal && (
        <div className="modal-backdrop" onClick={() => setRatingModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Rate {ratingModal.ngoName || "NGO"}</h2>
            <StarRating
              value={ratingValue} hover={ratingHover}
              onRate={setRatingValue} onHover={setRatingHover} onLeave={() => setRatingHover(0)}
            />
            {(ratingValue || ratingHover) > 0 && (
              <p className="rating-label">{RATING_LABELS[ratingHover || ratingValue]}</p>
            )}
            <textarea
              className="modal-textarea"
              rows="3"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              placeholder="Share your experience…"
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setRatingModal(null)}>Cancel</button>
              <button className="modal-btn submit" onClick={submitRating} disabled={ratingSubmitting || ratingValue === 0}>
                {ratingSubmitting ? <span className="btn-spinner" /> : "Submit Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Edit Donation</h2>
            <label className="modal-label">Quantity</label>
            <input
              className="modal-input"
              type="number"
              value={editData.quantity}
              onChange={e => setEditData({ ...editData, quantity: e.target.value })}
              placeholder="Quantity"
            />
            <label className="modal-label">Storage Type</label>
            <select
              className="modal-input"
              value={editData.storageType}
              onChange={e => setEditData({ ...editData, storageType: e.target.value })}
            >
              <option value="room">🌡 Room Temperature</option>
              <option value="refrigerated">❄ Refrigerated</option>
            </select>
            <label className="modal-label">Cooked Time</label>
            <input
              className="modal-input"
              type="datetime-local"
              value={editData.cookedTime}
              onChange={e => setEditData({ ...editData, cookedTime: e.target.value })}
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="modal-btn submit" onClick={submitEdit} disabled={editLoading}>
                {editLoading ? <span className="btn-spinner" /> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="delete-icon">🗑</div>
            <h2 className="modal-title">Remove Listing?</h2>
            <p className="modal-desc">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setDeleteConfirm(null)}>Keep It</button>
              <button className="modal-btn danger" onClick={() => handleDelete(deleteConfirm)}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </>
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
  }
  .loading-leaf { font-size: 48px; animation: spin 2s linear infinite; }
  .loading-text { font-family: var(--font-mono); color: var(--muted); font-size: 13px; letter-spacing: .1em; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── ROOT ── */
  .r-root { max-width: 860px; margin: 0 auto; padding: 28px 20px; min-height: 100vh; }

  /* ── TOPBAR ── */
  .r-topbar {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 24px; margin-bottom: 20px;
  }
  .topbar-brand { display: flex; align-items: center; gap: 14px; }
  .brand-icon { font-size: 24px; }
  .brand-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
  .brand-sub { font-size: 12px; color: var(--muted); font-family: var(--font-mono); margin-top: 2px; }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(95,212,117,.5); } 50% { box-shadow: 0 0 0 8px rgba(95,212,117,0); } }

  .topbar-actions { display: flex; align-items: center; gap: 10px; }
  .action-btn {
    padding: 9px 15px; border-radius: 9px; border: 1px solid var(--border);
    background: var(--surface2); color: var(--muted);
    font-family: var(--font-body); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: .15s; white-space: nowrap;
  }
  .action-btn:hover { color: var(--text); border-color: var(--muted); }
  .action-btn.primary { background: var(--accent); color: #0a120b; border-color: transparent; font-weight: 600; }
  .action-btn.primary:hover { background: var(--accent2); }
  .action-btn.export { background: rgba(96,180,240,.1); color: var(--info); border-color: rgba(96,180,240,.25); }
  .action-btn.export:hover { background: rgba(96,180,240,.18); }
  .action-btn.danger { background: rgba(240,82,82,.1); color: var(--danger); border-color: rgba(240,82,82,.2); }
  .action-btn.danger:hover { background: rgba(240,82,82,.18); }

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
    width: 17px; height: 17px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--surface);
  }
  .notif-panel {
    position: absolute; top: 50px; right: 0; width: 300px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: 0 20px 50px rgba(0,0,0,.5);
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
  .notif-item { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
  .notif-item.unread { background: rgba(95,212,117,.05); }
  .notif-msg { font-size: 13px; color: var(--text); }
  .notif-time { font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
  .notif-empty { padding: 28px 16px; text-align: center; color: var(--muted); font-size: 13px; font-family: var(--font-mono); }

  /* ── ALERTS ── */
  .alert-area { margin-bottom: 4px; }
  .flash {
    padding: 12px 16px; border-radius: 10px; margin-bottom: 12px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; font-weight: 500;
    animation: slideDown .2s ease;
  }
  .flash button { background: none; border: none; cursor: pointer; font-size: 18px; opacity: .6; color: inherit; }
  .flash.success { background: rgba(95,212,117,.1); color: var(--accent); border: 1px solid rgba(95,212,117,.25); }
  .flash.error   { background: rgba(240,82,82,.1);  color: var(--danger); border: 1px solid rgba(240,82,82,.25); }

  /* ── STAT TABS ── */
  .stat-tabs {
    display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .stat-tab {
    flex: 1; min-width: 90px; padding: 14px 10px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    transition: .15s; font-family: var(--font-body);
  }
  .stat-tab:hover { border-color: var(--muted); }
  .stat-tab.active { border-color: var(--accent); background: rgba(95,212,117,.08); }
  .stat-icon { font-size: 18px; }
  .stat-count { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
  .stat-label { font-size: 11px; color: var(--muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .04em; }
  .stat-tab.active .stat-label { color: var(--accent); }

  /* ── CONTENT ── */
  .r-content { }
  .food-list { display: flex; flex-direction: column; gap: 14px; }

  /* ── FOOD CARD ── */
  .food-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    display: flex; flex-direction: column;
    animation: fadeUp .3s ease both;
    transition: border-color .2s, transform .2s;
  }
  .food-card:hover { border-color: #3a4438; transform: translateY(-1px); }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .food-img-wrap { }
  .food-img { width: 100%; height: 180px; object-fit: cover; display: block; }

  .food-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }

  .food-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .food-type { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--text); }
  .food-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

  .status-badge {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    padding: 4px 10px; border-radius: 20px;
  }

  .freshness-track {
    height: 4px; background: var(--surface2); border-radius: 99px; overflow: hidden;
  }
  .freshness-fill { height: 100%; border-radius: 99px; transition: width .5s ease; }

  .food-meta {
    display: flex; gap: 14px; flex-wrap: wrap;
    font-size: 12px; color: var(--muted); font-family: var(--font-mono);
  }
  .freshness-pct { font-weight: 500; }

  .food-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }

  .food-btn {
    padding: 9px 16px; border-radius: 9px; border: none;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: .15s;
    display: flex; align-items: center; gap: 6px;
  }
  .food-btn:disabled { opacity: .5; cursor: not-allowed; }
  .food-btn.confirm { background: var(--accent); color: #0a120b; }
  .food-btn.confirm:hover:not(:disabled) { background: var(--accent2); }
  .food-btn.rate { background: rgba(240,180,41,.1); color: var(--warn); border: 1px solid rgba(240,180,41,.25); }
  .food-btn.rate:hover { background: rgba(240,180,41,.18); }
  .food-btn.edit { background: rgba(96,180,240,.1); color: var(--info); border: 1px solid rgba(96,180,240,.25); }
  .food-btn.edit:hover { background: rgba(96,180,240,.18); }
  .food-btn.remove { background: rgba(240,82,82,.1); color: var(--danger); border: 1px solid rgba(240,82,82,.2); }
  .food-btn.remove:hover:not(:disabled) { background: rgba(240,82,82,.18); }

  /* ── EXPIRY PILL ── */
  .expiry-pill {
    font-family: var(--font-mono); font-size: 11px; font-weight: 500;
    padding: 4px 10px; border-radius: 20px;
    background: rgba(95,212,117,.1); color: var(--accent);
    border: 1px solid rgba(95,212,117,.2);
    display: inline-flex; align-items: center; gap: 5px;
  }
  .expiry-pill.urgent { background: rgba(240,82,82,.1); color: var(--danger); border-color: rgba(240,82,82,.25); animation: blink 1s infinite; }
  .expiry-pill.expired { background: rgba(240,82,82,.1); color: var(--danger); border-color: rgba(240,82,82,.25); }
  @keyframes blink { 50% { opacity: .55; } }

  /* ── BTN SPINNER ── */
  .btn-spinner {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.2); border-top-color: currentColor;
    animation: spin .6s linear infinite; display: inline-block;
  }

  /* ── EMPTY STATE ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    padding: 60px 20px; gap: 14px; color: var(--muted);
  }
  .empty-icon { font-size: 40px; }
  .empty-state p { font-size: 14px; font-family: var(--font-mono); }

  /* ── MODALS ── */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 500; backdrop-filter: blur(4px);
    animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 32px; width: 420px; max-width: 95vw;
    animation: slideDown .2s ease;
    display: flex; flex-direction: column; gap: 16px;
  }
  .modal-sm { width: 340px; text-align: center; align-items: center; }
  .modal-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
  .modal-desc { font-size: 13px; color: var(--muted); }
  .delete-icon { font-size: 36px; }

  .rating-label { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--warn); }

  .modal-label { font-size: 12px; color: var(--muted); font-family: var(--font-mono); letter-spacing: .04em; margin-bottom: -8px; }

  .modal-input {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-body); font-size: 14px;
    outline: none; transition: border-color .15s;
  }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input option { background: var(--surface2); }

  .modal-textarea {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text); font-family: var(--font-body); font-size: 14px;
    outline: none; resize: vertical; transition: border-color .15s;
  }
  .modal-textarea:focus { border-color: var(--accent); }
  .modal-textarea::placeholder { color: var(--muted); }

  .modal-actions { display: flex; gap: 10px; margin-top: 4px; }
  .modal-btn {
    flex: 1; padding: 11px; border-radius: 10px; border: none;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .modal-btn:disabled { opacity: .5; cursor: not-allowed; }
  .modal-btn.cancel { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }
  .modal-btn.cancel:hover:not(:disabled) { color: var(--text); }
  .modal-btn.submit { background: var(--accent); color: #0a120b; }
  .modal-btn.submit:hover:not(:disabled) { background: var(--accent2); }
  .modal-btn.danger { background: rgba(240,82,82,.15); color: var(--danger); border: 1px solid rgba(240,82,82,.3); }
  .modal-btn.danger:hover { background: rgba(240,82,82,.25); }

  /* ── RESPONSIVE ── */
  @media (max-width: 600px) {
    .r-topbar { flex-direction: column; gap: 14px; align-items: flex-start; }
    .topbar-actions { flex-wrap: wrap; }
    .stat-tabs { gap: 6px; }
    .stat-tab { min-width: 70px; }
  }
`;

export default RestaurantDashboard;
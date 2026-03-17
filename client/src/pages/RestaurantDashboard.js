import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

/* ============================================================
   STABLE MODULE HELPERS
============================================================ */
const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getStatusColor = (status) => ({
  available: "#16a34a",
  reserved: "#2563eb",
  picked: "#ca8a04",
  delivered: "#64748b",
  expired: "#dc2626",
})[status] || "#64748b";

const getNotifIcon = (type) => ({
  food_reserved: "📦",
  food_delivered: "✅",
})[type] || "🔔";

const getFreshnessColor = (score) => {
  const s = score ?? 0;
  if (s >= 70) return "#16a34a";
  if (s >= 40) return "#ca8a04";
  return "#dc2626";
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
  return { label: `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`, urgent, expired: false };
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
  return (
    <span className={`expiry-pill ${cd.urgent ? "expiry-urgent" : ""} ${cd.expired ? "expiry-expired" : ""}`}>
      {cd.expired ? "⚠ Expired" : `⏱ ${cd.label}`}
    </span>
  );
};

const StarRating = ({ value, hover, onRate, onHover, onLeave }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        onClick={() => onRate(star)}
        onMouseEnter={() => onHover(star)}
        onMouseLeave={onLeave}
        style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 28,
          color: star <= (hover || value) ? "#f59e0b" : "#e2e8f0",
          transform: star <= (hover || value) ? "scale(1.1)" : "scale(1)",
          transition: "0.1s"
        }}
      >★</button>
    ))}
  </div>
);

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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ratedFoodIds, setRatedFoodIds] = useState(new Set());
  const [ratingModal, setRatingModal] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

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
    const token = localStorage.getItem("token");
    if (!token) return;

    if (socketRef.current?.connected) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Restaurant Connected:", socketRef.current.id);
    });

    socketRef.current.on("food_reserved", (data) => {
      console.log("📦 Food reserved event received:", data);
      setNotifications(prev => [{ ...data, id: Date.now(), read: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      if (fetchDataRef.current) fetchDataRef.current(true); 
    });

    socketRef.current.on("food_delivered", (data) => {
      setNotifications(prev => [{ ...data, id: Date.now(), read: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      if (fetchDataRef.current) fetchDataRef.current(true);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleMarkPicked = async (id) => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await axios.patch(`/food/pick/${id}`);
      setSuccess("Pickup confirmed! ✅");
      fetchFood(true);
    } catch (err) { setError("Failed to update status."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await axios.delete(`/food/${id}`);
      setSuccess("Listing removed 🗑️");
      fetchFood(true);
    } catch (err) { setError("Error deleting."); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const submitRating = async () => {
    if (ratingValue === 0) return;
    setRatingSubmitting(true);
    try {
      await axios.post("/ratings", { foodId: ratingModal.foodId, rating: ratingValue, comment: ratingComment });
      setRatedFoodIds(prev => new Set([...prev, String(ratingModal.foodId)]));
      setSuccess("Rating sent! ✅");
      setRatingModal(null);
    } catch (err) { setError("Failed to submit rating."); }
    finally { setRatingSubmitting(false); }
  };

  const stats = useMemo(() => ({
    total: food.length,
    available: food.filter(f => f.status === "available").length,
    reserved: food.filter(f => f.status === "reserved").length,
    picked: food.filter(f => f.status === "picked").length,
    delivered: food.filter(f => f.status === "delivered").length,
  }), [food]);

  const filteredFood = useMemo(() => activeFilter === "all" ? food : food.filter(f => f.status === activeFilter), [food, activeFilter]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Dashboard...</div>;

  return (
    <>
      <style>{`
        .r-dashboard { max-width: 960px; margin: 0 auto; padding: 20px; font-family: 'DM Sans', sans-serif; background: #f1f5f9; min-height: 100vh; }
        .r-header { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 18px 24px; border-radius: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        .alert { padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: flex; justify-content: space-between; }
        .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .alert-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .notif-bell { position: relative; width: 42px; height: 42px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-size: 20px; }
        .notif-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #fff; }
        .notif-dropdown { position: absolute; top: 55px; right: 0; width: 300px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden; }
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: capitalize; }
        .expiry-pill { font-family: 'DM Mono'; font-size: 12px; padding: 4px 10px; border-radius: 20px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-weight: 600; }
        .expiry-urgent { background: #fff1f2; color: #e11d48; border-color: #fecdd3; animation: blink 1s infinite; }
        .btn { padding: 9px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 13px; transition: 0.2s; }
        .btn-orange { background: #f97316; color: #fff; }
        .btn-danger { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; }
        @keyframes blink { 50% { opacity: 0.6; } }
      `}</style>

      <div className="r-dashboard">
        {success && <div className="alert alert-success">{success} <button onClick={() => setSuccess("")} style={{border:'none', background:'none', cursor:'pointer'}}>×</button></div>}
        {error && <div className="alert alert-error">{error} <button onClick={() => setError("")} style={{border:'none', background:'none', cursor:'pointer'}}>×</button></div>}

        <header className="r-header">
          <div>
            <h1 style={{fontSize: '20px'}}>Restaurant Dashboard {refreshing && "..."}</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            <button className="btn" style={{ background: '#16a34a', color: '#fff' }} onClick={() => navigate("/add-donation")}>+ Add Food</button>
            <div ref={notifRef}>
              <button className="notif-bell" onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0); }}>
                🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div style={{ padding: '12px', fontWeight: '700', borderBottom: '1px solid #f1f5f9' }}>Notifications</div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No alerts</div> : 
                      notifications.map(n => (
                        <div key={n.id} style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{getNotifIcon(n.type)} {n.message}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatTime(n.timestamp)}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn-danger" onClick={() => { localStorage.clear(); navigate("/login"); }}>Logout</button>
          </div>
        </header>

        <section className="r-stats">
          {["total", "available", "reserved", "picked", "delivered"].map(k => (
            <div key={k} className={`r-stat-card ${activeFilter === k ? 'active' : ''}`} onClick={() => setActiveFilter(k)}>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats[k]}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{k}</div>
            </div>
          ))}
        </section>

        <main>
          {filteredFood.map(item => (
            <div key={item._id} className="r-card" style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{fontSize: '16px', fontWeight: '700'}}>{item.foodType}</h3>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <ExpiryCountdown predictedExpiry={item.predictedExpiry} now={now} />
                  <span className="status-badge" style={{ border: `1px solid ${getStatusColor(item.status)}`, color: getStatusColor(item.status) }}>
                    ● {item.status}
                  </span>
                </div>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', margin: '10px 0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${item.freshnessScore}%`, background: getFreshnessColor(item.freshnessScore) }} />
              </div>
              <p style={{ fontSize: '13px', color: '#475569' }}>📦 {item.quantity} units | 🌿 {item.freshnessScore}% Fresh</p>
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                {item.status === "reserved" && (
                  <button className="btn btn-orange" onClick={() => handleMarkPicked(item._id)} disabled={actionLoading[item._id]}>Confirm Pickup</button>
                )}
                {item.status === "delivered" && !ratedFoodIds.has(String(item._id)) && (
                  <button className="btn" style={{ background: '#fefce8', color: '#ca8a04', border: '1px solid #fde68a' }} onClick={() => setRatingModal({ foodId: item._id, ngoName: item.reservedBy?.name })}>⭐ Rate NGO</button>
                )}
                <button className="btn btn-danger" onClick={() => handleDelete(item._id)} disabled={actionLoading[item._id]}>Remove</button>
              </div>
            </div>
          ))}
        </main>
      </div>

      {ratingModal && (
        <div className="modal-overlay" onClick={() => setRatingModal(null)}>
          <div className="modal" style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '400px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Rate {ratingModal.ngoName || "NGO"}</h2>
            <StarRating value={ratingValue} hover={ratingHover} onRate={setRatingValue} onHover={setRatingHover} onLeave={() => setRatingHover(0)} />
            <p style={{ color: "#f59e0b", fontWeight: "700", marginTop: '10px' }}>{RATING_LABELS[ratingValue || ratingHover]}</p>
            <textarea style={{ width: '100%', marginTop: '20px', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }} rows="3" value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="Experience..." />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setRatingModal(null)}>Cancel</button>
              <button className="btn btn-orange" style={{ flex: 1 }} onClick={submitRating} disabled={ratingSubmitting}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RestaurantDashboard;
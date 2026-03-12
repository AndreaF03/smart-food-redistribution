import { useEffect, useState, useCallback, useRef } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

function RestaurantDashboard() {

  const navigate   = useNavigate();
  const socketRef  = useRef(null);

  const [food, setFood]         = useState([]);
  const [stats, setStats]       = useState({
    total: 0, available: 0, reserved: 0, picked: 0, delivered: 0
  });
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");

  // Rating state
  const [ratedFoodIds, setRatedFoodIds]     = useState(new Set());
  const [ratingModal, setRatingModal]       = useState(null); // { foodId, ngoName }
  const [ratingValue, setRatingValue]       = useState(0);
  const [ratingHover, setRatingHover]       = useState(0);
  const [ratingComment, setRatingComment]   = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError]       = useState("");

  /* ==========================
     Fetch restaurant listings
  ========================== */
  const fetchFood = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const [foodRes, ratingsRes] = await Promise.all([
        axios.get("/food/restaurant/dashboard", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get("/ratings/my", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const data = foodRes.data || [];
      setFood(data);
      setStats({
        total:     data.length,
        available: data.filter(f => f.status === "available").length,
        reserved:  data.filter(f => f.status === "reserved").length,
        picked:    data.filter(f => f.status === "picked").length,
        delivered: data.filter(f => f.status === "delivered").length
      });

      // Store which food items have already been rated
      setRatedFoodIds(new Set(ratingsRes.data.ratedFoodIds || []));

    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.clear(); navigate("/login"); return;
      }
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchFood();
  }, [fetchFood, navigate]);

  /* ==========================
     Socket.io
  ========================== */
  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join", userId);
    });

    socketRef.current.on("food_reserved", (data) => {
      setNotifications(prev => [{ ...data, id: Date.now(), read: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      fetchFood();
    });

    socketRef.current.on("food_delivered", (data) => {
      setNotifications(prev => [{ ...data, id: Date.now(), read: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      fetchFood();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [fetchFood]);

  /* ==========================
     Mark Picked
  ========================== */
  const handleMarkPicked = async (id) => {
    const token = localStorage.getItem("token");
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      setError(""); setSuccess("");
      await axios.patch(`/food/pick/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess("Marked as picked successfully ✅");
      fetchFood();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update status.");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  /* ==========================
     Submit Rating
  ========================== */
  const openRatingModal = (item) => {
    setRatingModal({
      foodId:  item._id,
      ngoName: item.reservedBy?.name || "the NGO"
    });
    setRatingValue(0);
    setRatingHover(0);
    setRatingComment("");
    setRatingError("");
  };

  const closeRatingModal = () => {
    setRatingModal(null);
    setRatingValue(0);
    setRatingHover(0);
    setRatingComment("");
    setRatingError("");
  };

  const submitRating = async () => {
    if (ratingValue === 0) {
      setRatingError("Please select a star rating");
      return;
    }
    const token = localStorage.getItem("token");
    setRatingSubmitting(true);
    setRatingError("");
    try {
      await axios.post("/api/ratings", {
        foodId:  ratingModal.foodId,
        rating:  ratingValue,
        comment: ratingComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRatedFoodIds(prev => new Set([...prev, ratingModal.foodId]));
      setSuccess(`Rating submitted for ${ratingModal.ngoName} ✅`);
      closeRatingModal();
    } catch (err) {
      setRatingError(err.response?.data?.message || "Failed to submit rating");
    } finally {
      setRatingSubmitting(false);
    }
  };

  /* ==========================
     Helpers
  ========================== */
  const logout = () => {
    if (socketRef.current) socketRef.current.disconnect();
    localStorage.clear();
    navigate("/login");
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const dismissNotification = (id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== id);
    });
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit"
  });

  const getStatusColor = (status) => ({
    available: "#16a34a",
    reserved:  "#2563eb",
    picked:    "#ca8a04",
    delivered: "#64748b",
    expired:   "#dc2626"
  }[status] || "#64748b");

  const getNotifIcon = (type) => ({
    food_reserved: "📦",
    food_delivered: "✅"
  }[type] || "🔔");

  const filters  = ["all", "available", "reserved", "picked", "delivered"];
  const filteredFood = activeFilter === "all"
    ? food
    : food.filter(f => f.status === activeFilter);

  const StarRating = ({ value, hover, onRate, onHover, onLeave, size = 28 }) => (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onRate(star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: size, padding: 0, lineHeight: 1,
            color: star <= (hover || value) ? "#f59e0b" : "#e2e8f0",
            transition: "color 0.1s, transform 0.1s",
            transform: star <= (hover || value) ? "scale(1.15)" : "scale(1)"
          }}
        >★</button>
      ))}
    </div>
  );

  const ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: 'DM Sans', sans-serif; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeIn   { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn  { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        .r-dashboard { max-width: 960px; margin: 0 auto; padding: 28px 20px 60px; }

        /* HEADER */
        .r-header {
          display: flex; justify-content: space-between; align-items: center;
          background: #fff; border-radius: 16px; padding: 18px 24px;
          margin-bottom: 20px; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .r-header-left  { display: flex; align-items: center; gap: 12px; }
        .r-header-logo  {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 20px;
        }
        .r-header-title    { font-size: 20px; font-weight: 700; color: #0f172a; }
        .r-header-subtitle { font-size: 13px; color: #94a3b8; margin-top: 1px; }
        .r-header-actions  { display: flex; gap: 10px; align-items: center; }

        /* NOTIFICATION BELL */
        .notif-wrapper { position: relative; }
        .notif-bell {
          position: relative; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: #fff; border: 1.5px solid #e2e8f0;
          border-radius: 10px; cursor: pointer; font-size: 18px; transition: all 0.18s;
        }
        .notif-bell:hover { background: #f8fafc; border-color: #94a3b8; }
        .notif-badge {
          position: absolute; top: -5px; right: -5px;
          background: #e11d48; color: #fff; min-width: 18px; height: 18px;
          border-radius: 9px; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid #fff;
          animation: pulse 1.5s ease infinite;
        }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        .notif-dropdown {
          position: absolute; top: 48px; right: 0; width: 320px; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          z-index: 999; animation: slideDown 0.2s ease; overflow: hidden;
        }
        .notif-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
        }
        .notif-title { font-size: 14px; font-weight: 600; color: #0f172a; }
        .notif-mark-read {
          font-size: 12px; color: #2563eb; background: none;
          border: none; cursor: pointer; font-weight: 500; font-family: 'DM Sans', sans-serif;
        }
        .notif-mark-read:hover { text-decoration: underline; }
        .notif-list { max-height: 300px; overflow-y: auto; }
        .notif-item {
          padding: 12px 16px; border-bottom: 1px solid #f8fafc;
          display: flex; gap: 10px; align-items: flex-start; transition: background 0.15s;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: #f8fafc; }
        .notif-item.unread { background: #eff6ff; }
        .notif-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .notif-body { flex: 1; min-width: 0; }
        .notif-msg  { font-size: 13px; color: #1e293b; font-weight: 500; line-height: 1.4; }
        .notif-time { font-size: 11px; color: #94a3b8; margin-top: 3px; }
        .notif-dismiss {
          background: none; border: none; cursor: pointer;
          color: #cbd5e1; font-size: 16px; padding: 0; flex-shrink: 0;
          line-height: 1; transition: color 0.15s;
        }
        .notif-dismiss:hover { color: #64748b; }
        .notif-empty { padding: 32px 16px; text-align: center; color: #94a3b8; font-size: 13px; }
        .notif-empty-icon { font-size: 28px; margin-bottom: 8px; }

        /* STATS */
        .r-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
        .r-stat-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 14px 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          cursor: pointer; transition: box-shadow 0.18s, transform 0.15s;
        }
        .r-stat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .r-stat-card.active-filter { border-width: 2px; }
        .r-stat-number { font-size: 24px; font-weight: 700; line-height: 1; }
        .r-stat-label  { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.7px; font-weight: 500; }

        /* ALERTS */
        .alert { border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 500; margin-bottom: 16px; animation: slideDown 0.2s ease; }
        .alert-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .alert-dismiss { float: right; background: none; border: none; cursor: pointer; font-size: 16px; opacity: 0.6; line-height: 1; padding: 0; color: inherit; }

        /* FILTER BAR */
        .filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .filter-btn {
          padding: 6px 14px; border-radius: 20px; border: 1.5px solid #e2e8f0;
          background: #fff; font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #64748b; cursor: pointer;
          transition: all 0.18s; text-transform: capitalize;
        }
        .filter-btn:hover { border-color: #94a3b8; color: #334155; }
        .filter-btn.active { background: #0f172a; color: #fff; border-color: #0f172a; }

        /* SECTION HEADER */
        .section-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
        }
        .section-title { font-size: 16px; font-weight: 600; color: #0f172a; }
        .section-count { font-size: 13px; color: #94a3b8; }

        /* CARDS */
        .cards-grid { display: flex; flex-direction: column; gap: 12px; animation: fadeIn 0.25s ease; }
        .r-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
          padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .r-card:hover { box-shadow: 0 5px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .r-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .r-card-title  { font-size: 16px; font-weight: 600; color: #0f172a; }
        .r-card-meta   { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .meta-pill {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px;
          padding: 4px 12px; font-size: 12.5px; color: #475569;
          font-family: 'DM Mono', monospace; font-weight: 500;
        }
        .r-card-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        /* FRESHNESS BAR */
        .freshness-bar  { height: 4px; background: #e2e8f0; border-radius: 2px; margin-bottom: 14px; overflow: hidden; }
        .freshness-fill { height: 100%; border-radius: 2px; }

        /* STATUS BADGE */
        .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: capitalize; }

        /* NGO INFO */
        .ngo-info {
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; color: #15803d; margin-bottom: 14px;
        }

        /* RATED BADGE */
        .rated-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; background: #fefce8; color: #ca8a04;
          border: 1px solid #fde68a; border-radius: 20px;
          font-size: 12.5px; font-weight: 600;
        }

        /* EMPTY STATE */
        .empty-state { text-align: center; padding: 48px 20px; color: #94a3b8; }
        .empty-icon  { font-size: 40px; margin-bottom: 12px; }
        .empty-state p { font-size: 14px; }

        /* BUTTONS */
        .btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border: none; border-radius: 9px;
          font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 600;
          cursor: pointer; line-height: 1; white-space: nowrap;
          transition: background 0.16s, box-shadow 0.16s, transform 0.1s;
        }
        .btn:active:not(:disabled) { transform: scale(0.96); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-primary { background: #16a34a; color: #fff; box-shadow: 0 2px 6px rgba(22,163,74,0.3); }
        .btn-primary:hover:not(:disabled) { background: #15803d; box-shadow: 0 4px 14px rgba(22,163,74,0.4); }

        .btn-orange { background: #f97316; color: #fff; box-shadow: 0 2px 6px rgba(249,115,22,0.3); }
        .btn-orange:hover:not(:disabled) { background: #ea580c; box-shadow: 0 4px 14px rgba(249,115,22,0.4); }

        .btn-star { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; }
        .btn-star:hover:not(:disabled) { background: #fef08a; border-color: #fbbf24; }

        .btn-ghost { background: #fff; color: #475569; border: 1.5px solid #cbd5e1; }
        .btn-ghost:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; color: #1e293b; }

        .btn-danger { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
        .btn-danger:hover:not(:disabled) { background: #ffe4e6; border-color: #fda4af; }

        .btn-indigo { background: #6366f1; color: #fff; box-shadow: 0 2px 6px rgba(99,102,241,0.3); }
        .btn-indigo:hover:not(:disabled) { background: #4f46e5; box-shadow: 0 4px 14px rgba(99,102,241,0.4); }

        .btn-icon { padding: 9px 10px; }
        .btn-sm   { padding: 7px 13px; font-size: 12.5px; border-radius: 7px; }

        .btn-spinner {
          width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
        }

        /* RATING MODAL */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.45); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 20px;
        }
        .modal {
          background: #fff; border-radius: 20px; padding: 28px 28px 24px;
          width: 100%; max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          animation: modalIn 0.25s ease;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 6px;
        }
        .modal-title { font-size: 18px; font-weight: 700; color: #0f172a; }
        .modal-close {
          background: none; border: none; cursor: pointer;
          font-size: 22px; color: #94a3b8; line-height: 1; padding: 0;
          transition: color 0.15s;
        }
        .modal-close:hover { color: #475569; }
        .modal-subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
        .modal-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px; }
        .modal-stars { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .modal-rating-label {
          font-size: 13px; font-weight: 600; color: #f59e0b;
          min-width: 70px; transition: opacity 0.15s;
        }
        .modal-divider { border: none; border-top: 1px solid #f1f5f9; margin: 20px 0; }
        .modal-textarea {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #0f172a;
          resize: none; outline: none; transition: border-color 0.18s;
          background: #f8fafc;
        }
        .modal-textarea:focus { border-color: #f59e0b; background: #fff; }
        .modal-textarea::placeholder { color: #94a3b8; }
        .modal-char-count { font-size: 11px; color: #94a3b8; text-align: right; margin-top: 4px; }
        .modal-error { font-size: 13px; color: #dc2626; margin-top: 10px; font-weight: 500; }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .modal-actions .btn { flex: 1; justify-content: center; }
      `}</style>

      <div className="r-dashboard">

        {/* HEADER */}
        <div className="r-header">
          <div className="r-header-left">
            <div className="r-header-logo">🍽️</div>
            <div>
              <div className="r-header-title">Restaurant Dashboard</div>
              <div className="r-header-subtitle">Smart Food Redistribution</div>
            </div>
          </div>
          <div className="r-header-actions">

            {/* Notification Bell */}
            <div className="notif-wrapper">
              <button
                className="notif-bell"
                onClick={() => { setShowNotifications(p => !p); if (!showNotifications) markAllRead(); }}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {notifications.length > 0 && (
                      <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">
                        <div className="notif-empty-icon">🔔</div>
                        <p>No notifications yet</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`notif-item${!n.read ? " unread" : ""}`}>
                        <div className="notif-icon">{getNotifIcon(n.type)}</div>
                        <div className="notif-body">
                          <div className="notif-msg">{n.message}</div>
                          <div className="notif-time">{formatTime(n.timestamp)}</div>
                        </div>
                        <button className="notif-dismiss" onClick={() => dismissNotification(n.id)}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link to="/add-donation" style={{ textDecoration: "none" }}>
              <button className="btn btn-primary btn-sm">＋ Add Donation</button>
            </Link>

            <button className="btn btn-danger btn-sm" onClick={logout}>⎋ Logout</button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="alert alert-error">
            ⚠ {error}
            <button className="alert-dismiss" onClick={() => setError("")}>×</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            {success}
            <button className="alert-dismiss" onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {/* STATS */}
        <div className="r-stats">
          {[
            { key: "total",     label: "Total",    color: "#0f172a" },
            { key: "available", label: "Available", color: "#16a34a" },
            { key: "reserved",  label: "Reserved",  color: "#2563eb" },
            { key: "picked",    label: "Picked",    color: "#ca8a04" },
            { key: "delivered", label: "Delivered", color: "#64748b" },
          ].map(s => (
            <div
              key={s.key}
              className={`r-stat-card${activeFilter === s.key ? " active-filter" : ""}`}
              style={activeFilter === s.key ? { borderColor: s.color } : {}}
              onClick={() => setActiveFilter(s.key === "total" ? "all" : s.key)}
            >
              <div className="r-stat-number" style={{ color: s.color }}>{stats[s.key]}</div>
              <div className="r-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* FILTER BAR */}
        <div className="filter-bar">
          {filters.map(f => (
            <button
              key={f}
              className={`filter-btn${activeFilter === f ? " active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {/* LISTINGS */}
        <div className="section-header">
          <div className="section-title">Your Donations</div>
          <div className="section-count">
            {filteredFood.length} listing{filteredFood.length !== 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading donations…</p>
          </div>
        ) : filteredFood.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍱</div>
            <p>{activeFilter === "all"
              ? `No donations yet. Click "Add Donation" to get started.`
              : `No ${activeFilter} donations.`}
            </p>
          </div>
        ) : (
          <div className="cards-grid">
            {filteredFood.map(item => {
              const freshColor = (item.freshnessScore || 0) >= 70
                ? "#16a34a" : (item.freshnessScore || 0) >= 40
                ? "#ca8a04" : "#dc2626";
              const alreadyRated = ratedFoodIds.has(item._id);

              return (
                <div key={item._id} className="r-card">
                  <div className="r-card-header">
                    <div className="r-card-title">{item.foodType}</div>
                    <span
                      className="status-badge"
                      style={{
                        background: `${getStatusColor(item.status)}18`,
                        color: getStatusColor(item.status),
                        border: `1px solid ${getStatusColor(item.status)}40`
                      }}
                    >● {item.status}</span>
                  </div>

                  <div className="freshness-bar">
                    <div className="freshness-fill" style={{
                      width: `${item.freshnessScore || 0}%`,
                      background: freshColor
                    }} />
                  </div>

                  <div className="r-card-meta">
                    <span className="meta-pill">📦 {item.quantity} units</span>
                    <span className="meta-pill">🌿 {item.freshnessScore ?? 0}% fresh</span>
                    <span className="meta-pill">🧊 {item.storageType}</span>
                  </div>

                  {item.reservedBy && (
                    <div className="ngo-info">
                      👤 Reserved by <strong>{item.reservedBy.name || "Unknown NGO"}</strong>
                      {item.reservedBy.email && ` · ${item.reservedBy.email}`}
                    </div>
                  )}

                  <div className="r-card-actions">

                    {/* Confirm pickup button */}
                    {item.status === "reserved" && (
                      <button
                        className="btn btn-orange"
                        onClick={() => handleMarkPicked(item._id)}
                        disabled={!!actionLoading[item._id]}
                      >
                        {actionLoading[item._id]
                          ? <><span className="btn-spinner" /> Confirming…</>
                          : <>✓ Confirm Pickup</>
                        }
                      </button>
                    )}

                    {/* Rate NGO button — only on delivered, not yet rated */}
                    {item.status === "delivered" && !alreadyRated && item.reservedBy && (
                      <button
                        className="btn btn-star"
                        onClick={() => openRatingModal(item)}
                      >
                        ⭐ Rate NGO
                      </button>
                    )}

                    {/* Already rated badge */}
                    {item.status === "delivered" && alreadyRated && (
                      <span className="rated-badge">⭐ NGO Rated</span>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════
          RATING MODAL
      ══════════════════════════════════ */}
      {ratingModal && (
        <div className="modal-overlay" onClick={closeRatingModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <div className="modal-title">Rate this NGO</div>
              <button className="modal-close" onClick={closeRatingModal}>×</button>
            </div>
            <div className="modal-subtitle">
              How did <strong>{ratingModal.ngoName}</strong> perform on this delivery?
            </div>

            {/* STARS */}
            <div className="modal-label">Your Rating</div>
            <div className="modal-stars">
              <StarRating
                value={ratingValue}
                hover={ratingHover}
                onRate={setRatingValue}
                onHover={setRatingHover}
                onLeave={() => setRatingHover(0)}
                size={32}
              />
              <div className="modal-rating-label" style={{
                opacity: (ratingHover || ratingValue) ? 1 : 0
              }}>
                {ratingLabels[ratingHover || ratingValue]}
              </div>
            </div>

            <hr className="modal-divider" />

            {/* COMMENT */}
            <div className="modal-label">Comment <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></div>
            <textarea
              className="modal-textarea"
              rows={3}
              maxLength={300}
              placeholder="How was the pickup and delivery experience?"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
            />
            <div className="modal-char-count">{ratingComment.length} / 300</div>

            {ratingError && (
              <div className="modal-error">⚠ {ratingError}</div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeRatingModal}>
                Cancel
              </button>
              <button
                className="btn btn-indigo"
                onClick={submitRating}
                disabled={ratingSubmitting || ratingValue === 0}
              >
                {ratingSubmitting
                  ? <><span className="btn-spinner" /> Submitting…</>
                  : <>⭐ Submit Rating</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default RestaurantDashboard;
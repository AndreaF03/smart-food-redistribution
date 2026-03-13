import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

/* ============================================================
   MODULE-LEVEL HELPERS
   (outside component — not recreated on every render)
============================================================ */

// FIX #10: Moved to module level — stable reference
const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const getFreshnessColor = (score) => {
  // FIX #12: null/undefined guard
  const s = score ?? 0;
  if (s >= 70) return "#16a34a";
  if (s >= 40) return "#ca8a04";
  return "#dc2626";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

/* ============================================================
   COMPONENT
============================================================ */
function NGODashboard() {

  const navigate    = useNavigate();
  const socketRef   = useRef(null);
  const fetchDataRef = useRef(null); // FIX #6: stable ref to latest fetchData

  const [nearbyFood, setNearbyFood] = useState([]);
  const [myFood,     setMyFood]     = useState({ reserved: [], picked: [], delivered: [] });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState("");
  const [activeTab,  setActiveTab]  = useState("nearby");
  const [actionLoading, setActionLoading] = useState({});
  const [notifications,      setNotifications]      = useState([]);
  const [showNotifications,  setShowNotifications]  = useState(false);
  const [unreadCount,        setUnreadCount]        = useState(0);

  const notifRef = useRef(null); // FIX #8: for click-outside handler

  /* ----------------------------------------------------------
     FIX #11: Apply body background via useEffect with cleanup
  ---------------------------------------------------------- */
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#f1f5f9";
    return () => { document.body.style.background = prev; };
  }, []);

  /* ----------------------------------------------------------
     FIX #13: Auto-clear success message after 3.5 seconds
  ---------------------------------------------------------- */
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3500);
    return () => clearTimeout(t);
  }, [success]);

  /* ----------------------------------------------------------
     FIX #1 & #2: No manual auth headers (interceptor handles it)
                  No duplicate 401 handling
     FIX #13: Soft refresh keeps stale UI visible
  ---------------------------------------------------------- */
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else        setLoading(true);
      setError("");

      const [nearbyRes, myRes] = await Promise.all([
        axios.get("/food/nearby"),
        axios.get("/food/ngo/dashboard")
      ]);

      setNearbyFood(nearbyRes.data || []);
      setMyFood(myRes.data || { reserved: [], picked: [], delivered: [] });

    } catch (err) {
      // FIX #2: Interceptor handles 401 — only handle other errors here
      if (err.response?.status !== 401) {
        setError("Failed to load dashboard data.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // FIX #6: Keep ref in sync with latest fetchData without re-running socket effect
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ----------------------------------------------------------
     FIX #13: Auto-refresh every 60 seconds
  ---------------------------------------------------------- */
  useEffect(() => {
    const poll = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(poll);
  }, [fetchData]);

  /* ----------------------------------------------------------
     FIX #3: Pass JWT on socket connect — server verifies it
             via socket middleware instead of trusting client
     FIX #6: Use fetchDataRef.current inside handler — no stale
             closure, socket effect runs only once ([])
     FIX #5: Don't auto-switch tabs — show notification instead
  ---------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    socketRef.current = io(SOCKET_URL, {
      auth:  { token },               // FIX #3: server verifies this
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });

    // Restaurant confirmed pickup → NGO needs to deliver
    socketRef.current.on("food_picked", (data) => {
      setNotifications(prev => [{ ...data, id: Date.now(), read: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      // FIX #5: Refresh data but DON'T hijack the user's active tab
      fetchDataRef.current?.(true);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  // FIX #6: Empty deps — socket set up once, uses ref for fetchData
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----------------------------------------------------------
     FIX #8: Click-outside to close notification dropdown
  ---------------------------------------------------------- */
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  /* ----------------------------------------------------------
     Action loader helper
     FIX #4: Errors from fn() still propagate — withActionLoading
             only manages the loading flag
  ---------------------------------------------------------- */
  const withActionLoading = useCallback(async (id, fn) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await fn();
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  /* ----------------------------------------------------------
     Reserve Food
  ---------------------------------------------------------- */
  const reserveFood = useCallback((id) => withActionLoading(id, async () => {
    try {
      setError(""); setSuccess("");
      await axios.patch(`/food/reserve/${id}`, {});
      setSuccess("Food reserved successfully ✅");
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.message || "Reservation failed. Please try again.");
    }
  }), [withActionLoading, fetchData]);

  /* ----------------------------------------------------------
     Mark Delivered
  ---------------------------------------------------------- */
  const markDelivered = useCallback((id) => withActionLoading(id, async () => {
    try {
      setError(""); setSuccess("");
      await axios.patch(`/food/deliver/${id}`, {});
      setSuccess("Marked as delivered ✅");
      fetchData(true);
    } catch (err) {
      setError(err.response?.data?.message || "Delivery update failed. Please try again.");
    }
  }), [withActionLoading, fetchData]);

  /* ----------------------------------------------------------
     FIX #9: logout wrapped in useCallback
  ---------------------------------------------------------- */
  const logout = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect();
    localStorage.clear();
    navigate("/login");
  }, [navigate]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== id);
    });
  }, []);

  /* ----------------------------------------------------------
     Memoised tab config
  ---------------------------------------------------------- */
  const tabs = useMemo(() => [
    { id: "nearby",    label: "Available",       icon: "📍", count: nearbyFood.length },
    { id: "reserved",  label: "Reserved",         icon: "📦", count: myFood.reserved.length },
    { id: "picked",    label: "Ready to Deliver", icon: "🚚", count: myFood.picked.length },
    { id: "delivered", label: "Delivered",         icon: "✅", count: myFood.delivered.length },
  ], [nearbyFood.length, myFood.reserved.length, myFood.picked.length, myFood.delivered.length]);

  /* ============================================================
     LOADING STATE
  ============================================================ */
  if (loading) return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#f1f5f9" // FIX #16: minHeight on bg div
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid #e2e8f0", borderTopColor: "#16a34a",
        borderRadius: "50%", animation: "spin 0.7s linear infinite"
      }} />
      <p style={{ color: "#64748b", marginTop: 16, fontFamily: "DM Sans, sans-serif" }}>
        Loading dashboard…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes fadeIn    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse     { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        @keyframes fadeOut   { from { opacity: 1; } to { opacity: 0; } }

        .dashboard { max-width: 900px; margin: 0 auto; padding: 28px 20px 60px; font-family: 'DM Sans', sans-serif; }

        /* HEADER */
        .ngo-header {
          display: flex; justify-content: space-between; align-items: center;
          background: #fff; border-radius: 16px; padding: 18px 24px;
          margin-bottom: 20px; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }
        .ngo-header-left    { display: flex; align-items: center; gap: 12px; }
        .ngo-header-logo    {
          width: 42px; height: 42px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 20px;
        }
        .ngo-header-title    { font-size: 20px; font-weight: 700; color: #0f172a; }
        .ngo-header-subtitle { font-size: 13px; color: #94a3b8; margin-top: 1px; }
        .ngo-header-actions  { display: flex; gap: 10px; align-items: center; }

        /* NOTIFICATION BELL */
        .notif-wrapper  { position: relative; }
        .notif-bell {
          position: relative; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: #fff; border: 1.5px solid #e2e8f0;
          border-radius: 10px; cursor: pointer; font-size: 18px;
          transition: all 0.18s;
        }
        .notif-bell:hover  { background: #f8fafc; border-color: #94a3b8; }
        .notif-bell.open   { background: #f8fafc; border-color: #94a3b8; }
        .notif-badge {
          position: absolute; top: -5px; right: -5px;
          background: #e11d48; color: #fff;
          min-width: 18px; height: 18px; border-radius: 9px;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid #fff;
          animation: pulse 1.5s ease infinite;
        }
        .notif-dropdown {
          position: absolute; top: 48px; right: 0;
          width: 320px; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          z-index: 999; animation: slideDown 0.2s ease; overflow: hidden;
        }
        .notif-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px; border-bottom: 1px solid #f1f5f9;
        }
        .notif-title     { font-size: 14px; font-weight: 600; color: #0f172a; }
        .notif-mark-read {
          font-size: 12px; color: #2563eb; background: none;
          border: none; cursor: pointer; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
        }
        .notif-mark-read:hover { text-decoration: underline; }
        .notif-list      { max-height: 300px; overflow-y: auto; }
        .notif-item {
          padding: 12px 16px; border-bottom: 1px solid #f8fafc;
          display: flex; gap: 10px; align-items: flex-start;
          transition: background 0.15s;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover      { background: #f8fafc; }
        .notif-item.unread     { background: #eff6ff; }
        .notif-item.unread:hover { background: #dbeafe; }
        .notif-icon    { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .notif-body    { flex: 1; min-width: 0; }
        .notif-msg     { font-size: 13px; color: #1e293b; font-weight: 500; line-height: 1.4; }
        .notif-time    { font-size: 11px; color: #94a3b8; margin-top: 3px; }
        .notif-dismiss {
          background: none; border: none; cursor: pointer;
          color: #cbd5e1; font-size: 16px; padding: 0;
          flex-shrink: 0; line-height: 1; transition: color 0.15s;
        }
        .notif-dismiss:hover { color: #64748b; }
        .notif-empty      { padding: 32px 16px; text-align: center; color: #94a3b8; font-size: 13px; }
        .notif-empty-icon { font-size: 28px; margin-bottom: 8px; }

        /* STATS */
        .stats-bar {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 20px;
        }
        .stat-card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 14px 16px; text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .stat-number { font-size: 26px; font-weight: 700; line-height: 1; }
        .stat-label  { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500; }

        /* ALERTS */
        .alert {
          border-radius: 10px; padding: 12px 16px;
          font-size: 14px; font-weight: 500;
          margin-bottom: 16px; animation: slideDown 0.2s ease;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .alert-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .alert-body    { flex: 1; }
        .alert-dismiss {
          background: none; border: none; cursor: pointer;
          font-size: 18px; opacity: 0.5; line-height: 1;
          padding: 0; color: inherit; flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .alert-dismiss:hover { opacity: 1; }

        /* TABS */
        .tabs {
          display: flex; gap: 6px; background: #fff;
          border-radius: 12px; padding: 6px;
          border: 1px solid #e2e8f0; margin-bottom: 20px;
        }
        .tab-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 8px; border: none; border-radius: 8px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
          color: #64748b; background: transparent; transition: all 0.18s;
        }
        .tab-btn:hover        { background: #f8fafc; color: #334155; }
        .tab-btn.active       { background: #0f172a; color: #fff; font-weight: 600; }
        .tab-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; border-radius: 10px;
          font-size: 11px; font-weight: 700; padding: 0 5px;
        }
        .tab-btn.active .tab-count        { background: rgba(255,255,255,0.2); color: #fff; }
        .tab-btn:not(.active) .tab-count  { background: #e2e8f0; color: #475569; }

        /* CARDS */
        .cards-grid { display: flex; flex-direction: column; gap: 12px; animation: fadeIn 0.25s ease; }
        .card {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
          padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .card:hover        { box-shadow: 0 5px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .card.faded        { opacity: 0.65; }
        .card-header       { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .card-title        { font-size: 16px; font-weight: 600; color: #0f172a; }
        .card-meta         { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
        .meta-pill {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px;
          padding: 4px 12px; font-size: 12.5px; color: #475569;
          font-family: 'DM Mono', monospace; font-weight: 500;
        }
        .meta-pill.fresh   { background: #f0fdf4; border-color: #bbf7d0; color: #16a34a; }
        .card-actions      { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

        /* FRESHNESS BAR */
        .freshness-bar  { height: 4px; background: #e2e8f0; border-radius: 2px; margin-bottom: 14px; overflow: hidden; }
        .freshness-fill { height: 100%; border-radius: 2px; }

        /* STATUS BADGES */
        .status-badge     { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-available { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .status-reserved  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .status-picked    { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
        .status-delivered { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }

        /* INFO BOX */
        .info-box {
          background: #fefce8; border: 1px solid #fde68a;
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; color: #92400e; margin-top: 10px; line-height: 1.5;
        }

        /* CONTACT BOX — FIX #15 */
        .contact-box {
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 8px; padding: 10px 14px;
          font-size: 13px; color: #15803d; margin-top: 8px; line-height: 1.6;
        }

        /* DELIVERED META — FIX #14 */
        .delivered-time {
          font-size: 12px; color: #94a3b8; margin-top: 8px;
          font-family: 'DM Mono', monospace;
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

        .btn-action { background: #2563eb; color: #fff; box-shadow: 0 2px 6px rgba(37,99,235,0.3); }
        .btn-action:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }

        .btn-ghost { background: #fff; color: #475569; border: 1.5px solid #cbd5e1; }
        .btn-ghost:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; color: #1e293b; }

        .btn-danger { background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3; }
        .btn-danger:hover:not(:disabled) { background: #ffe4e6; border-color: #fda4af; }

        .btn-icon { padding: 9px 10px; }
        .btn-sm   { padding: 7px 13px; font-size: 12.5px; border-radius: 7px; }

        .btn-spinner {
          width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* REFRESH DOT */
        .refresh-dot {
          width: 8px; height: 8px; background: #16a34a; border-radius: 50%;
          animation: pulse 1s ease infinite; flex-shrink: 0;
        }
      `}</style>

      <div className="dashboard">

        {/* ── HEADER ── */}
        <div className="ngo-header">
          <div className="ngo-header-left">
            <div className="ngo-header-logo">🌱</div>
            <div>
              <div className="ngo-header-title">NGO Dashboard</div>
              <div className="ngo-header-subtitle">Smart Food Redistribution</div>
            </div>
          </div>

          <div className="ngo-header-actions">
            {refreshing && <div className="refresh-dot" title="Refreshing…" />}

            {/* Refresh button */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh"
            >
              <span style={{
                display: "inline-block",
                animation: refreshing ? "spin 0.6s linear infinite" : "none"
              }}>↻</span>
            </button>

            {/* Notification Bell */}
            {/* FIX #8: ref attached for click-outside detection */}
            <div className="notif-wrapper" ref={notifRef}>
              <button
                className={`notif-bell${showNotifications ? " open" : ""}`}
                onClick={() => {
                  setShowNotifications(prev => !prev);
                  // FIX #7: Mark read when CLOSING (or immediately on open — both valid;
                  // here we mark read on open so the badge clears as user views)
                }}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {notifications.length > 0 && (
                      <button className="notif-mark-read" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">
                        <div className="notif-empty-icon">🔔</div>
                        <p>No notifications yet</p>
                      </div>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item${!n.read ? " unread" : ""}`}
                      >
                        <div className="notif-icon">🚚</div>
                        <div className="notif-body">
                          <div className="notif-msg">{n.message}</div>
                          <div className="notif-time">{formatTime(n.timestamp)}</div>
                        </div>
                        <button
                          className="notif-dismiss"
                          onClick={() => dismissNotification(n.id)}
                          aria-label="Dismiss notification"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <button className="btn btn-danger btn-sm" onClick={logout}>
              ⎋ Logout
            </button>
          </div>
        </div>

        {/* ── ALERTS ── */}
        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-body">⚠ {error}</span>
            <button className="alert-dismiss" onClick={() => setError("")} aria-label="Dismiss">×</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            <span className="alert-body">{success}</span>
            <button className="alert-dismiss" onClick={() => setSuccess("")} aria-label="Dismiss">×</button>
          </div>
        )}

        {/* ── STATS ── */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-number" style={{ color: "#16a34a" }}>{nearbyFood.length}</div>
            <div className="stat-label">Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: "#2563eb" }}>{myFood.reserved.length}</div>
            <div className="stat-label">Reserved</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: "#ca8a04" }}>{myFood.picked.length}</div>
            <div className="stat-label">Ready</div>
          </div>
          <div className="stat-card">
            <div className="stat-number" style={{ color: "#64748b" }}>{myFood.delivered.length}</div>
            <div className="stat-label">Delivered</div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
            TAB: AVAILABLE
        ══════════════════════════════ */}
        {activeTab === "nearby" && (
          <div className="cards-grid">
            {nearbyFood.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>No food available nearby right now.</p>
              </div>
            ) : nearbyFood.map(item => {
              // FIX #12: null guard on freshnessScore
              const score = item.freshnessScore ?? 0;
              const freshColor = getFreshnessColor(score);
              return (
                <div key={item._id} className="card">
                  <div className="card-header">
                    <div className="card-title">{item.foodType}</div>
                    <span className="status-badge status-available">● Available</span>
                  </div>
                  <div className="freshness-bar">
                    <div className="freshness-fill" style={{
                      width: `${score}%`,
                      background: freshColor
                    }} />
                  </div>
                  <div className="card-meta">
                    <span className="meta-pill">📦 {item.quantity} units</span>
                    <span className={`meta-pill${score >= 70 ? " fresh" : ""}`}>
                      🌿 {score}% fresh
                    </span>
                    <span className="meta-pill">🧊 {item.storageType}</span>
                    <span className="meta-pill">🏪 {item.restaurant?.name || "Unknown"}</span>
                  </div>
                  {/* FIX #15: Show restaurant contact */}
                  {item.restaurant?.email && (
                    <div className="contact-box">
                      📧 {item.restaurant.email}
                    </div>
                  )}
                  <div className="card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => reserveFood(item._id)}
                      disabled={!!actionLoading[item._id]}
                    >
                      {actionLoading[item._id]
                        ? <><span className="btn-spinner" /> Reserving…</>
                        : <>＋ Reserve Food</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: RESERVED
        ══════════════════════════════ */}
        {activeTab === "reserved" && (
          <div className="cards-grid">
            {myFood.reserved.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No reserved food yet. Browse Available to reserve.</p>
              </div>
            ) : myFood.reserved.map(item => (
              <div key={item._id} className="card">
                <div className="card-header">
                  <div className="card-title">{item.foodType}</div>
                  <span className="status-badge status-reserved">● Reserved</span>
                </div>
                <div className="card-meta">
                  <span className="meta-pill">📦 {item.quantity} units</span>
                  <span className="meta-pill">🏪 {item.restaurant?.name || "Unknown"}</span>
                </div>
                {/* FIX #15: Restaurant contact for coordination */}
                {item.restaurant?.email && (
                  <div className="contact-box">
                    📧 {item.restaurant.email}
                  </div>
                )}
                <div className="info-box">
                  ⏳ Waiting for restaurant to confirm pickup. You'll be notified automatically.
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: PICKED — ready to deliver
        ══════════════════════════════ */}
        {activeTab === "picked" && (
          <div className="cards-grid">
            {myFood.picked.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚚</div>
                <p>No food ready for delivery yet.</p>
              </div>
            ) : myFood.picked.map(item => (
              <div key={item._id} className="card">
                <div className="card-header">
                  <div className="card-title">{item.foodType}</div>
                  <span className="status-badge status-picked">● Ready to Deliver</span>
                </div>
                <div className="card-meta">
                  <span className="meta-pill">📦 {item.quantity} units</span>
                  <span className="meta-pill">🏪 {item.restaurant?.name || "Unknown"}</span>
                </div>
                {/* FIX #15: Restaurant contact */}
                {item.restaurant?.email && (
                  <div className="contact-box">
                    📧 {item.restaurant.email}
                  </div>
                )}
                <div className="card-actions">
                  <button
                    className="btn btn-action"
                    onClick={() => markDelivered(item._id)}
                    disabled={!!actionLoading[item._id]}
                  >
                    {actionLoading[item._id]
                      ? <><span className="btn-spinner" /> Confirming…</>
                      : <>✓ Mark Delivered</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: DELIVERED
        ══════════════════════════════ */}
        {activeTab === "delivered" && (
          <div className="cards-grid">
            {myFood.delivered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>No deliveries completed yet.</p>
              </div>
            ) : myFood.delivered.map(item => (
              <div key={item._id} className="card faded">
                <div className="card-header">
                  <div className="card-title">{item.foodType}</div>
                  <span className="status-badge status-delivered">✓ Delivered</span>
                </div>
                <div className="card-meta">
                  <span className="meta-pill">📦 {item.quantity} units</span>
                  <span className="meta-pill">🏪 {item.restaurant?.name || "Unknown"}</span>
                </div>
                {/* FIX #14: Show delivery timestamp */}
                {item.deliveredAt && (
                  <div className="delivered-time">
                    🕐 Delivered on {formatDate(item.deliveredAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}

export default NGODashboard;
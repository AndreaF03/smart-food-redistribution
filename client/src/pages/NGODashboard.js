import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet Marker Icons
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
   MODULE-LEVEL HELPERS
============================================================ */
const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// FIXED: Now being used in the UI
const getFreshnessColor = (score) => {
  const s = score ?? 0;
  if (s >= 70) return "#16a34a";
  if (s >= 40) return "#ca8a04";
  return "#dc2626";
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
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

function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 13);
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const mapCenter = useMemo(() => [12.9716, 77.5946], []);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      setError("");
      const [nearbyRes, myRes] = await Promise.all([
        axios.get("/food/nearby"),
        axios.get("/food/ngo/dashboard"),
      ]);
      setNearbyFood(nearbyRes.data || []);
      setMyFood(myRes.data || { reserved: [], picked: [], delivered: [] });
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to refresh dashboard.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDataRef.current = fetchData; fetchData(); }, [fetchData]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    socketRef.current = io(SOCKET_URL, { auth: { token }, transports: ["websocket"] });
    const handleNotification = (data) => {
  setNotifications(prev => [
    { ...data, id: Date.now(), read: false },
    ...prev
  ]);
  setUnreadCount(c => c + 1);

  if (fetchDataRef.current) {
    fetchDataRef.current(true);
  }
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
    { id: "nearby", label: "Available", icon: "📍", count: nearbyFood.length },
    { id: "reserved", label: "Reserved", icon: "📦", count: myFood.reserved.length },
    { id: "picked", label: "Ready", icon: "🚚", count: myFood.picked.length },
    { id: "delivered", label: "History", icon: "✅", count: myFood.delivered.length },
  ], [nearbyFood.length, myFood]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading NGO Dashboard...</div>;

  return (
    <>
      <style>{`
        .ngo-dashboard { max-width: 900px; margin: 0 auto; padding: 20px; font-family: 'DM Sans', sans-serif; background: #f1f5f9; min-height: 100vh; }
        .ngo-header { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 18px 24px; border-radius: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        .refresh-dot { display: inline-block; width: 8px; height: 8px; background-color: #22c55e; border-radius: 50%; margin-left: 10px; animation: pulse-green 2s infinite; }
        .notif-bell { position: relative; width: 42px; height: 42px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; font-size: 20px; }
        .notif-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #fff; }
        .notif-dropdown { position: absolute; top: 55px; right: 0; width: 300px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 1000; overflow: hidden; }
        .tab-bar { display: flex; gap: 8px; background: #fff; padding: 8px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 10px; border: none; border-radius: 8px; cursor: pointer; background: none; color: #64748b; font-weight: 500; font-size: 13px; transition: 0.2s; }
        .tab-btn.active { background: #0f172a; color: #fff; }
        .card { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 12px; border: 1px solid #e2e8f0; }
        .freshness-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin: 10px 0; overflow: hidden; }
        .freshness-fill { height: 100%; transition: width 0.5s ease; }
        .expiry-pill { font-family: 'DM Mono'; font-size: 12px; padding: 4px 10px; border-radius: 20px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-weight: 600; }
        .expiry-urgent { background: #fff1f2; color: #e11d48; border-color: #fecdd3; animation: blink 1s infinite; }
        .btn { padding: 9px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 13.5px; transition: 0.2s; }
        .map-container { height: 350px; width: 100%; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px; }
        .alert { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; display: flex; justify-content: space-between; }
        @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        @keyframes blink { 50% { opacity: 0.6; } }
      `}</style>

      <div className="ngo-dashboard">
        {success && <div className="alert" style={{background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0'}}>{success} <button onClick={() => setSuccess("")} style={{background:'none', border:'none'}}>×</button></div>}
        {error && <div className="alert" style={{background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'}}>{error} <button onClick={() => setError("")} style={{background:'none', border:'none'}}>×</button></div>}

        <header className="ngo-header">
          <div>
            <h1 style={{ fontSize: '20px' }}>NGO Dashboard 🌱 {refreshing && <span className="refresh-dot" />}</h1>
            <p style={{ color: '#64748b', fontSize: '13px' }}>Smart Food Redistribution</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }} onClick={() => fetchData(true)} disabled={refreshing}>↻ Refresh</button>
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="notif-bell" onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0); }}>
                🔔 {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div style={{ padding: '12px', fontWeight: '700', borderBottom: '1px solid #f1f5f9' }}>Notifications</div>
                  {notifications.length === 0 ? <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No alerts</div> :
                    notifications.map(n => (
                      <div key={n.id} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                        <div>🚚 {n.message}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{formatTime(n.timestamp)}</div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <button className="btn" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={() => { localStorage.clear(); navigate("/login"); }}>Logout</button>
          </div>
        </header>

        <nav className="tab-bar">
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} {t.label} ({t.count})
            </button>
          ))}
        </nav>

        <main>
          {activeTab === "nearby" && (
            <>
              <div className="map-container">
                <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ChangeView center={mapCenter} />
                  {nearbyFood.map(item => (
                    item.location?.coordinates && (
                      <Marker key={item._id} position={[item.location.coordinates[1], item.location.coordinates[0]]}>
                        <Popup>
                          <strong>{item.foodType}</strong><br />
                          🏪 {item.restaurant?.name}<br />
                          🌿 {item.freshnessScore}% Fresh<br />
                          <button onClick={() => reserveFood(item._id)} style={{ marginTop: '8px', cursor:'pointer' }}>Reserve</button>
                        </Popup>
                      </Marker>
                    )
                  ))}
                </MapContainer>
              </div>

              {nearbyFood.length === 0 ? <p style={{textAlign:'center', padding:'40px'}}>No food nearby.</p> : 
                nearbyFood.map(item => (
                  <div key={item._id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '16px' }}>{item.foodType}</h3>
                      <ExpiryCountdown predictedExpiry={item.predictedExpiry} now={now} />
                    </div>
                    {/* FIXED: Now using getFreshnessColor here */}
                    <div className="freshness-bar">
                        <div 
                          className="freshness-fill" 
                          style={{ 
                            width: `${item.freshnessScore}%`, 
                            background: getFreshnessColor(item.freshnessScore) 
                          }} 
                        />
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', marginBottom: '15px' }}>
                        📦 {item.quantity} units | 🌿 {item.freshnessScore}% Fresh | 🏪 {item.restaurant?.name || "Partner"}
                    </p>
                    <button className="btn btn-primary" onClick={() => reserveFood(item._id)} disabled={actionLoading[item._id]}>
                        {actionLoading[item._id] ? "Reserving..." : "＋ Reserve Food"}
                    </button>
                  </div>
                ))
              }
            </>
          )}

          {activeTab === "reserved" && (
            myFood.reserved.map(item => (
              <div key={item._id} className="card">
                <h3 style={{ fontSize: '16px' }}>{item.foodType}</h3>
                <div style={{ background: '#fff7ed', padding: '12px', borderRadius: '10px', marginTop: '15px', fontSize: '13px', color: '#c2410c' }}>
                    ⏳ Waiting for Restaurant pickup confirmation...
                </div>
              </div>
            ))
          )}

          {activeTab === "picked" && (
            myFood.picked.map(item => (
              <div key={item._id} className="card">
                <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>{item.foodType}</h3>
                <button className="btn btn-action" onClick={() => markDelivered(item._id)} disabled={actionLoading[item._id]}>✓ Mark Delivered</button>
              </div>
            ))
          )}

          {activeTab === "delivered" && (
            myFood.delivered.map(item => (
              <div key={item._id} className="card" style={{ opacity: 0.8 }}>
                <h3 style={{ fontSize: '15px' }}>{item.foodType}</h3>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Completed: {formatDate(item.deliveredAt)}</p>
              </div>
            ))
          )}
        </main>
      </div>
    </>
  );
}

export default NGODashboard;
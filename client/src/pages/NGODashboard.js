import { useEffect, useState, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function NGODashboard() {

  const [nearbyFood, setNearbyFood] = useState([]);
  const [myFood, setMyFood] = useState({ reserved: [], delivered: [] });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("nearby");
  const [actionLoading, setActionLoading] = useState({});

  const navigate = useNavigate();

  const fetchData = useCallback(async (silent = false) => {

    const token = localStorage.getItem("token");

    try {

      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [nearbyRes, myRes] = await Promise.all([
        axios.get("/food/nearby", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get("/food/ngo/dashboard", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setNearbyFood(nearbyRes.data || []);
      setMyFood(myRes.data || { reserved: [], delivered: [] });

    } catch (err) {

      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      setError("Failed to load data. Please try again.");

    } finally {

      setLoading(false);
      setRefreshing(false);

    }

  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const withActionLoading = async (id, fn) => {

    setActionLoading(prev => ({
      ...prev,
      [id]: true
    }));

    try {
      await fn();
    } finally {

      setActionLoading(prev => ({
        ...prev,
        [id]: false
      }));

    }

  };

  const reserveFood = (id) => withActionLoading(id, async () => {

    const token = localStorage.getItem("token");

    try {

      setSuccess("");
      setError("");

      await axios.patch(`/food/reserve/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess("Food reserved successfully ✅");

      fetchData(true);

    } catch (err) {

      setError(err.response?.data?.message || "Reservation failed.");

    }

  });

  const markDelivered = (id) => withActionLoading(id, async () => {

    const token = localStorage.getItem("token");

    try {

      setSuccess("");
      setError("");

      await axios.patch(`/food/deliver/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess("Delivery confirmed successfully ✅");

      fetchData(true);

    } catch (err) {

      setError(err.response?.data?.message || "Delivery failed.");

    }

  });

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const totalActive = myFood.reserved.length;

  const tabs = [
    { id: "nearby", label: "Available", icon: "📍", count: nearbyFood.length },
    { id: "reserved", label: "Reserved", icon: "📦", count: myFood.reserved.length },
    { id: "delivered", label: "Delivered", icon: "✅", count: myFood.delivered.length }
  ];

  if (loading) return (

    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh"
    }}>

      <div style={{
        width: 32,
        height: 32,
        border: "3px solid #e2e8f0",
        borderTopColor: "#16a34a",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite"
      }} />

      <p style={{
        color: "#64748b",
        marginTop: 16
      }}>
        Loading dashboard…
      </p>

    </div>

  );

  return (

    <div className="dashboard">

      {/* HEADER */}

      <div className="header">

        <div className="header-left">

          <div className="header-logo">🌱</div>

          <div>

            <h2>NGO Dashboard</h2>
            <div className="header-subtitle">
              Smart Food Redistribution
            </div>

          </div>

        </div>

        <div className="header-actions">

          <button
            className="btn btn-ghost btn-icon"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            ↻
          </button>

          <button
            className="btn btn-danger btn-sm"
            onClick={logout}
          >
            ⎋ Logout
          </button>

        </div>

      </div>

      {/* ALERTS */}

      {error && (

        <div className="alert alert-error">
          ⚠ {error}
        </div>

      )}

      {success && (

        <div className="alert alert-success">
          {success}
        </div>

      )}

      {/* STATS */}

      <div className="stats-bar">

        <div className="stat-card">
          <div className="stat-number">{nearbyFood.length}</div>
          <div className="stat-label">Available Nearby</div>
        </div>

        <div className="stat-card">
          <div className="stat-number">{totalActive}</div>
          <div className="stat-label">Active Claims</div>
        </div>

        <div className="stat-card">
          <div className="stat-number">{myFood.delivered.length}</div>
          <div className="stat-label">Delivered Total</div>
        </div>

      </div>

      {/* TABS */}

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

      {/* AVAILABLE */}

      {activeTab === "nearby" && (

        <div className="cards-grid">

          {nearbyFood.map(item => (

            <div key={item._id} className="card">

              <div className="card-header">

                <div className="card-title">
                  {item.foodType}
                </div>

              </div>

              <div className="card-meta">

                <span className="meta-pill">
                  📦 {item.quantity} units
                </span>

                <span className="meta-pill">
                  🏪 {item.restaurant?.name || "Unknown"}
                </span>

              </div>

              <div className="card-actions">

                <button
                  className="btn btn-primary"
                  onClick={() => reserveFood(item._id)}
                  disabled={!!actionLoading[item._id]}
                >

                  {actionLoading[item._id]
                    ? "Reserving..."
                    : "Reserve Food"}

                </button>

              </div>

            </div>

          ))}

        </div>

      )}

      {/* RESERVED */}

      {activeTab === "reserved" && (

        <div className="cards-grid">

          {myFood.reserved.map(item => (

            <div key={item._id} className="card">

              <div className="card-title">
                {item.foodType}
              </div>

              <div className="card-meta">

                <span className="meta-pill">
                  📦 {item.quantity}
                </span>

                <span className="meta-pill">
                  🏪 {item.restaurant?.name}
                </span>

              </div>

              <p>
                Waiting for delivery
              </p>

              <button
                className="btn btn-action"
                onClick={() => markDelivered(item._id)}
                disabled={!!actionLoading[item._id]}
              >

                {actionLoading[item._id]
                  ? "Confirming..."
                  : "Confirm Delivery"}

              </button>

            </div>

          ))}

        </div>

      )}

      {/* DELIVERED */}

      {activeTab === "delivered" && (

        <div className="cards-grid">

          {myFood.delivered.map(item => (

            <div key={item._id} className="card faded">

              <div className="card-title">
                {item.foodType}
              </div>

              <div className="card-meta">

                <span className="meta-pill">
                  📦 {item.quantity}
                </span>

                <span className="meta-pill">
                  🏪 {item.restaurant?.name}
                </span>

              </div>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}

export default NGODashboard;
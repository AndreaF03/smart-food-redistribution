import { useEffect, useState, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function NGODashboard() {

  const navigate = useNavigate();

  const [nearbyFood, setNearbyFood] = useState([]);
  const [myFood, setMyFood] = useState({
    reserved: [],
    picked: [],
    delivered: []
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState("nearby");
  const [actionLoading, setActionLoading] = useState({});

  /* ==========================
     Fetch Dashboard Data
  ========================== */

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
      setMyFood(myRes.data || { reserved: [], picked: [], delivered: [] });

    } catch (err) {

      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      setError("Failed to load dashboard data");

    } finally {

      setLoading(false);
      setRefreshing(false);

    }

  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ==========================
     Action Loader Helper
  ========================== */

  const withActionLoading = async (id, fn) => {

    setActionLoading(prev => ({ ...prev, [id]: true }));

    try {
      await fn();
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }

  };

  /* ==========================
     Reserve Food
  ========================== */

  const reserveFood = (id) => withActionLoading(id, async () => {

    const token = localStorage.getItem("token");

    try {

      setError("");
      setSuccess("");

      await axios.patch(`/food/reserve/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess("Food reserved successfully ✅");
      fetchData(true);

    } catch (err) {

      setError(err.response?.data?.message || "Reservation failed");

    }

  });

  /* ==========================
     Mark Delivered
  ========================== */

  const markDelivered = (id) => withActionLoading(id, async () => {

    const token = localStorage.getItem("token");

    try {

      setError("");
      setSuccess("");

      await axios.patch(`/food/deliver/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess("Food delivered successfully ✅");
      fetchData(true);

    } catch (err) {

      setError(err.response?.data?.message || "Delivery failed");

    }

  });

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const tabs = [
    { id: "nearby", label: "Available", count: nearbyFood.length },
    { id: "reserved", label: "Reserved", count: myFood.reserved.length },
    { id: "picked", label: "Ready for Delivery", count: myFood.picked.length },
    { id: "delivered", label: "Delivered", count: myFood.delivered.length }
  ];

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        Loading NGO dashboard...
      </div>
    );
  }

  return (

    <div style={{ padding: 30, maxWidth: 1000, margin: "auto" }}>

      {/* HEADER */}

      <div style={{ display: "flex", justifyContent: "space-between" }}>

        <h2>NGO Dashboard</h2>

        <div>

          <button onClick={() => fetchData(true)}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button onClick={logout} style={{ marginLeft: 10 }}>
            Logout
          </button>

        </div>

      </div>

      {/* ALERTS */}

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      {/* TABS */}

      <div style={{ marginTop: 20 }}>

        {tabs.map(tab => (

          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              marginRight: 10,
              padding: "6px 14px",
              background: activeTab === tab.id ? "#16a34a" : "#eee",
              color: activeTab === tab.id ? "white" : "black"
            }}
          >
            {tab.label} ({tab.count})
          </button>

        ))}

      </div>

      {/* AVAILABLE FOOD */}

      {activeTab === "nearby" && (

        <div style={{ marginTop: 20 }}>

          {nearbyFood.length === 0 && (
            <p style={{ color: "#777" }}>
              No food available nearby right now.
            </p>
          )}

          {nearbyFood.map(item => (

            <div key={item._id} style={cardStyle}>

              <h4>{item.foodType}</h4>

              <p>Quantity: {item.quantity}</p>
              <p>Restaurant: {item.restaurant?.name}</p>

              <button
                onClick={() => reserveFood(item._id)}
                disabled={actionLoading[item._id]}
              >
                {actionLoading[item._id] ? "Reserving..." : "Reserve Food"}
              </button>

            </div>

          ))}

        </div>

      )}

      {/* RESERVED */}

      {activeTab === "reserved" && (

        <div style={{ marginTop: 20 }}>

          {myFood.reserved.length === 0 && (
            <p style={{ color: "#777" }}>
              No reserved food yet.
            </p>
          )}

          {myFood.reserved.map(item => (

            <div key={item._id} style={cardStyle}>

              <h4>{item.foodType}</h4>

              <p>Quantity: {item.quantity}</p>
              <p>Restaurant: {item.restaurant?.name}</p>

              <p style={{ color: "#f59e0b" }}>
                Waiting for restaurant pickup confirmation
              </p>

            </div>

          ))}

        </div>

      )}

      {/* PICKED */}

      {activeTab === "picked" && (

        <div style={{ marginTop: 20 }}>

          {myFood.picked.length === 0 && (
            <p style={{ color: "#777" }}>
              No food ready for delivery yet.
            </p>
          )}

          {myFood.picked.map(item => (

            <div key={item._id} style={cardStyle}>

              <h4>{item.foodType}</h4>

              <p>Quantity: {item.quantity}</p>
              <p>Restaurant: {item.restaurant?.name}</p>

              <button
                onClick={() => markDelivered(item._id)}
                disabled={actionLoading[item._id]}
              >
                {actionLoading[item._id]
                  ? "Confirming..."
                  : "Mark Delivered"}
              </button>

            </div>

          ))}

        </div>

      )}

      {/* DELIVERED */}

      {activeTab === "delivered" && (

        <div style={{ marginTop: 20 }}>

          {myFood.delivered.length === 0 && (
            <p style={{ color: "#777" }}>
              No deliveries completed yet.
            </p>
          )}

          {myFood.delivered.map(item => (

            <div key={item._id} style={{ ...cardStyle, opacity: 0.7 }}>

              <h4>{item.foodType}</h4>

              <p>Quantity: {item.quantity}</p>
              <p>Restaurant: {item.restaurant?.name}</p>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}

const cardStyle = {
  border: "1px solid #ddd",
  padding: 15,
  borderRadius: 8,
  marginBottom: 10,
  background: "#fafafa"
};

export default NGODashboard;
import { useEffect, useState, useCallback } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

function RestaurantDashboard() {

  const navigate = useNavigate();

  const [food, setFood] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    reserved: 0,
    picked: 0,
    delivered: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ==========================
     Fetch restaurant listings
  ========================== */

  const fetchFood = useCallback(async () => {
    const token = localStorage.getItem("token");

    try {
      setLoading(true);

      const res = await axios.get("/food/restaurant/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = res.data || [];
      setFood(data);

      /* calculate stats */
      const newStats = {
        total: data.length,
        available: data.filter(f => f.status === "available").length,
        reserved: data.filter(f => f.status === "reserved").length,
        picked: data.filter(f => f.status === "picked").length,
        delivered: data.filter(f => f.status === "delivered").length
      };

      setStats(newStats);

    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  /* ==========================
     Load dashboard
  ========================== */

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
    } else {
      fetchFood();
    }
  }, [fetchFood, navigate]);

  /* ==========================
     Mark food picked
  ========================== */

  const handleMarkPicked = async (id) => {
    const token = localStorage.getItem("token");

    try {
      setError("");
      setSuccess("");

      await axios.patch(`/food/pick/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess("Marked as picked successfully ✅");
      fetchFood();

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update status.");
    }
  };

  /* ==========================
     Logout
  ========================== */

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  /* ==========================
     Status color helper
  ========================== */

  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return "green";
      case "reserved":
        return "orange";
      case "picked":
        return "blue";
      case "delivered":
        return "gray";
      default:
        return "black";
    }
  };

  return (
    <div style={styles.container}>

      {/* Header */}

      <div style={styles.header}>
        <h2>Restaurant Dashboard</h2>
        <button style={styles.logout} onClick={logout}>Logout</button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      {/* Add Donation */}

      <Link to="/add-donation">
        <button style={styles.addButton}>+ Add Food Donation</button>
      </Link>

      {/* Stats */}

      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <h3>{stats.total}</h3>
          <p>Total Donations</p>
        </div>

        <div style={styles.statCard}>
          <h3>{stats.available}</h3>
          <p>Available</p>
        </div>

        <div style={styles.statCard}>
          <h3>{stats.reserved}</h3>
          <p>Reserved</p>
        </div>

        <div style={styles.statCard}>
          <h3>{stats.picked}</h3>
          <p>Picked</p>
        </div>

        <div style={styles.statCard}>
          <h3>{stats.delivered}</h3>
          <p>Delivered</p>
        </div>
      </div>

      <hr />

      {/* Listings */}

      <h3>Your Donations</h3>

      {loading ? (
        <p>Loading donations...</p>
      ) : food.length === 0 ? (
        <p style={{ color: "#777" }}>
          No donations yet. Click "Add Food Donation" to donate food.
        </p>
      ) : (
        food.map((item) => (
          <div key={item._id} style={styles.card}>

            <h4>{item.foodType}</h4>

            <p>Quantity: {item.quantity}</p>

            <p>
              Status:{" "}
              <span style={{ color: getStatusColor(item.status) }}>
                {item.status}
              </span>
            </p>

            <p>Freshness: {item.freshnessScore ?? 0}%</p>

            {item.reservedBy && (
              <p>Reserved By: {item.reservedBy.name || "Unknown NGO"}</p>
            )}

            {item.status === "reserved" && (
              <button
                style={styles.pickButton}
                onClick={() => handleMarkPicked(item._id)}
              >
                Mark Picked
              </button>
            )}

          </div>
        ))
      )}

    </div>
  );
}

const styles = {

  container: {
    maxWidth: "900px",
    margin: "auto",
    padding: "30px"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  logout: {
    background: "#e53935",
    color: "white",
    border: "none",
    padding: "8px 14px",
    cursor: "pointer"
  },

  addButton: {
    marginTop: "20px",
    marginBottom: "20px",
    background: "#1976d2",
    color: "white",
    border: "none",
    padding: "10px 16px",
    cursor: "pointer"
  },

  statsContainer: {
    display: "flex",
    gap: "15px",
    flexWrap: "wrap",
    marginBottom: "20px"
  },

  statCard: {
    flex: "1",
    minWidth: "120px",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    textAlign: "center",
    background: "#fafafa"
  },

  card: {
    border: "1px solid #ddd",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "12px",
    background: "#fafafa"
  },

  pickButton: {
    marginTop: "10px",
    background: "#43a047",
    color: "white",
    border: "none",
    padding: "8px 14px",
    cursor: "pointer"
  },

  error: {
    color: "red"
  },

  success: {
    color: "green"
  }

};

export default RestaurantDashboard;
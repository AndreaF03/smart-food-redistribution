import { useEffect, useState } from "react";
import axios from "../api/axios";

function NGODashboard() {
  const [nearbyFood, setNearbyFood] = useState([]);
  const [myFood, setMyFood] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  const fetchData = async () => {
    try {
      setLoading(true);

      const nearbyRes = await axios.get("/food/nearby", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const myRes = await axios.get("/food/ngo/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNearbyFood(nearbyRes.data || []);
      setMyFood(myRes.data || []);

    } catch (err) {
      console.error(err);
      setMessage("Failed to load data ❌");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reserveFood = async (id) => {
    try {
      await axios.put(`/food/reserve/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage("Food reserved successfully ✅");
      fetchData();

    } catch (err) {
      console.error(err);
      setMessage("Reservation failed ❌");
    }
  };

  const markDelivered = async (id) => {
    try {
      await axios.put(`/food/deliver/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage("Food delivered successfully ✅");
      fetchData();

    } catch (err) {
      console.error(err);
      setMessage("Delivery failed ❌");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
      <h2>NGO Dashboard</h2>
      <button onClick={logout}>Logout</button>

      {message && <p style={{ color: "green" }}>{message}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* SECTION 1 */}
          <h3>Nearby Available Food</h3>

          {nearbyFood.length === 0 ? (
            <p>No available food nearby.</p>
          ) : (
            nearbyFood.map((item) => (
              <div key={item._id} style={styles.card}>
                <strong>{item.foodType}</strong>
                <p>Quantity: {item.quantity}</p>
                <p>Freshness: {item.freshnessScore}%</p>
                <p>Restaurant: {item.restaurant?.name || "Unknown"}</p>

                <button
                  style={styles.reserveButton}
                  onClick={() => reserveFood(item._id)}
                >
                  Reserve
                </button>
              </div>
            ))
          )}

          <hr />

          {/* SECTION 2 */}
          <h3>My Reserved Food</h3>

          {myFood.length === 0 ? (
            <p>No reserved food.</p>
          ) : (
            myFood.map((item) => (
              <div key={item._id} style={styles.card}>
                <strong>{item.foodType}</strong>
                <p>Quantity: {item.quantity}</p>
                <p>Status: {item.status}</p>

                {item.status === "picked" && (
                  <button
                    style={styles.deliverButton}
                    onClick={() => markDelivered(item._id)}
                  >
                    Confirm Delivery
                  </button>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid #ccc",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "15px",
    backgroundColor: "#fafafa"
  },
  reserveButton: {
    marginTop: "10px",
    padding: "8px 14px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  },
  deliverButton: {
    marginTop: "10px",
    padding: "8px 14px",
    backgroundColor: "#2196F3",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  }
};

export default NGODashboard;
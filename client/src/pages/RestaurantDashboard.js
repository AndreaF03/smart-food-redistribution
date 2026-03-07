import { useEffect, useState } from "react";
import axios from "../api/axios";

function RestaurantDashboard() {
  const [food, setFood] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    foodType: "",
    quantity: "",
    cookedTime: "",
    storageType: "room"
  });

  const token = localStorage.getItem("token");

  const fetchFood = async () => {
    try {
      setLoading(true);

      const res = await axios.get("/food/restaurant/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFood(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load listings ❌");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFood();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.foodType || !form.quantity || !form.cookedTime) {
      return setMessage("All fields are required");
    }

    try {
      setSubmitting(true);
      setMessage("");

      await axios.post("/food", form, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setForm({
        foodType: "",
        quantity: "",
        cookedTime: "",
        storageType: "room"
      });

      setMessage("Food uploaded successfully ✅");
      fetchFood();

    } catch (err) {
      console.error(err);
      setMessage("Upload failed ❌");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPicked = async (id) => {
    try {
      await axios.put(`/food/pick/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage("Marked as picked ✅");
      fetchFood();

    } catch (err) {
      console.error(err);
      setMessage("Failed to mark as picked ❌");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div style={styles.container}>
      <h2>Restaurant Dashboard</h2>

      <button style={styles.logout} onClick={logout}>
        Logout
      </button>

      {message && <p style={styles.message}>{message}</p>}

      <h3>Add Surplus Food</h3>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          placeholder="Food Type"
          value={form.foodType}
          onChange={(e) =>
            setForm({ ...form, foodType: e.target.value })
          }
        />

        <input
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) =>
            setForm({ ...form, quantity: e.target.value })
          }
        />

        <input
          type="datetime-local"
          value={form.cookedTime}
          onChange={(e) =>
            setForm({ ...form, cookedTime: e.target.value })
          }
        />

        <select
          value={form.storageType}
          onChange={(e) =>
            setForm({ ...form, storageType: e.target.value })
          }
        >
          <option value="room">Room</option>
          <option value="refrigerated">Refrigerated</option>
        </select>

        <button type="submit" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload"}
        </button>
      </form>

      <hr />

      <h3>Your Listings</h3>

      {loading ? (
        <p>Loading...</p>
      ) : food.length === 0 ? (
        <p>No food listings yet.</p>
      ) : (
        food.map((item) => (
          <div key={item._id} style={styles.card}>
            <strong>{item.foodType}</strong>

            <p>Quantity: {item.quantity}</p>
            <p>Status: {item.status}</p>
            <p>Freshness: {item.freshnessScore || 0}%</p>

            {item.reservedBy && (
              <p>Reserved By: {item.reservedBy.name}</p>
            )}

            {item.status === "reserved" && (
              <button
                onClick={() => handleMarkPicked(item._id)}
                style={styles.pickButton}
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
    padding: "30px",
    maxWidth: "700px",
    margin: "auto"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "400px"
  },
  card: {
    border: "1px solid #ccc",
    padding: "15px",
    borderRadius: "8px",
    marginBottom: "10px",
    backgroundColor: "#fafafa"
  },
  logout: {
    marginBottom: "20px",
    padding: "8px 14px",
    background: "red",
    color: "white",
    border: "none",
    cursor: "pointer"
  },
  pickButton: {
    marginTop: "10px",
    padding: "8px 14px",
    background: "#4CAF50",
    color: "white",
    border: "none",
    cursor: "pointer"
  },
  message: {
    color: "green"
  }
};

export default RestaurantDashboard;
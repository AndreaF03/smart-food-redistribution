import { useEffect, useState } from "react";
import axios from "../api/axios";

function RestaurantDashboard() {
  const [food, setFood] = useState([]);
  const [form, setForm] = useState({
    foodType: "",
    quantity: "",
    cookedTime: "",
    storageType: "room"
  });

  const token = localStorage.getItem("token");

  const fetchFood = async () => {
    const res = await axios.get("/food/restaurant/dashboard", {
      headers: { Authorization: `Bearer ${token}` }
    });
    setFood(res.data);
  };

  useEffect(() => {
    fetchFood();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    await axios.post("/food", form, {
      headers: { Authorization: `Bearer ${token}` }
    });

    setForm({
      foodType: "",
      quantity: "",
      cookedTime: "",
      storageType: "room"
    });

    fetchFood(); // refresh list
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Restaurant Dashboard</h2>

      <h3>Add Surplus Food</h3>
      <form onSubmit={handleSubmit}>
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

        <button type="submit">Upload Food</button>
      </form>

      <hr />

      <h3>Your Listings</h3>
      {food.map((item) => (
        <div key={item._id} style={{ marginBottom: "10px" }}>
          <strong>{item.foodType}</strong> | Qty: {item.quantity} |
          Status: {item.status} | Freshness: {item.freshnessScore}%
        </div>
      ))}
    </div>
  );
}

export default RestaurantDashboard;
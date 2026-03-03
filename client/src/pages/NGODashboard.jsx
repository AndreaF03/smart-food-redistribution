import { useEffect, useState } from "react";
import axios from "../api/axios";

function NGODashboard() {
  const [food, setFood] = useState([]);
  const token = localStorage.getItem("token");

  const fetchNearbyFood = async () => {
    const res = await axios.get("/food/nearby", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    setFood(res.data);
  };

  useEffect(() => {
    fetchNearbyFood();
  }, []);

  const handleReserve = async (id) => {
    await axios.put(`/food/reserve/${id}`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    fetchNearbyFood(); // refresh after reservation
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>NGO Dashboard</h2>

      <h3>Nearby Available Food</h3>

      {food.length === 0 && <p>No available food nearby</p>}

      {food.map(item => (
        <div key={item._id} style={{ marginBottom: "15px" }}>
          <strong>{item.foodType}</strong><br />
          Quantity: {item.quantity} <br />
          Freshness: {item.freshnessScore}% <br />
          Restaurant: {item.restaurant?.name} <br />

          <button onClick={() => handleReserve(item._id)}>
            Reserve
          </button>
        </div>
      ))}
    </div>
  );
}

export default NGODashboard;
import { useEffect, useState } from "react";
import axios from "../api/axios";

function NGODashboard() {
  const [food, setFood] = useState([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await axios.get("/food/ngo/dashboard", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
        setFood(res.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div>
      <h2>NGO Dashboard</h2>

      {food.length === 0 ? (
        <p>No reservations yet</p>
      ) : (
        food.map(item => (
          <div key={item._id} style={{border: "1px solid gray", margin: "10px", padding: "10px"}}>
            <h4>{item.foodType}</h4>
            <p>Status: {item.status}</p>
            <p>Restaurant: {item.restaurant?.name}</p>
            <p>Quantity: {item.quantity}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default NGODashboard;
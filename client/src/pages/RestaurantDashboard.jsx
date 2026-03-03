import { useEffect, useState } from "react";
import axios from "../api/axios";

function RestaurantDashboard() {
  const [food, setFood] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await axios.get("/food/restaurant/dashboard", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      setFood(res.data);
    };

    fetchData();
  }, []);

  return (
    <div>
      <h2>Restaurant Dashboard</h2>
      {food.map(item => (
        <div key={item._id}>
          <p>{item.foodType} - {item.status}</p>
        </div>
      ))}
    </div>
  );
}

export default RestaurantDashboard;
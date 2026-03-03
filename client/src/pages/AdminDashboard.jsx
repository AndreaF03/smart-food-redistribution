import { useEffect, useState } from "react";
import axios from "../api/axios";

function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get("/food/admin/analytics", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
        setStats(res.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchAnalytics();
  }, []);

  if (!stats) return <p>Loading...</p>;

  return (
    <div>
      <h2>Admin Analytics</h2>

      <div style={{margin: "10px 0"}}>
        <p>Total Listings: {stats.totalListings}</p>
        <p>Delivered: {stats.deliveredCount}</p>
        <p>Expired: {stats.expiredCount}</p>
        <p>Active: {stats.activeCount}</p>
        <p>Reserved: {stats.reservedCount}</p>
        <p>Total Quantity Redistributed: {stats.totalQuantityRedistributed}</p>
      </div>

      <h3>Top Restaurants</h3>
      {stats.topRestaurants.map((item, index) => (
        <div key={index}>
          <p>Restaurant ID: {item._id}</p>
          <p>Total Delivered: {item.totalDelivered}</p>
        </div>
      ))}
    </div>
  );
}

export default AdminDashboard;
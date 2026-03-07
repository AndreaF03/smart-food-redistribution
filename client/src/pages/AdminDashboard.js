import { useEffect, useState } from "react";
import axios from "../api/axios";

function AdminDashboard() {
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get("/food/admin/analytics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAnalytics(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading) {
    return <h2 style={{ padding: "20px" }}>Loading Dashboard...</h2>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Admin Dashboard</h2>
      <button onClick={logout}>Logout</button>

      <h3>Impact Metrics</h3>

      <p>Total Listings: {analytics.totalListings || 0}</p>
      <p>Delivered: {analytics.deliveredCount || 0}</p>
      <p>Expired: {analytics.expiredCount || 0}</p>
      <p>Active: {analytics.activeCount || 0}</p>
      <p>Reserved: {analytics.reservedCount || 0}</p>

      <p>
        Total Quantity Redistributed:{" "}
        {analytics.totalQuantityRedistributed || 0}
      </p>
    </div>
  );
}

export default AdminDashboard;
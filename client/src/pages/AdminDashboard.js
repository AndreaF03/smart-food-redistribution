import { useEffect, useState, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const fetchAnalytics = useCallback(async () => {
    // Fixed: read token inside the function, not on every render
    const token = localStorage.getItem("token");

    try {
      const res = await axios.get("/food/admin/analytics", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setAnalytics(res.data);

    } catch (err) {
      console.error("Error fetching analytics:", err);

      // Fixed: redirect to login on 401
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }

      setError("Failed to load analytics. Please try again.");

    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fixed: fetchAnalytics included in dependency array
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const logout = () => {
    localStorage.clear();
    // Fixed: use navigate instead of window.location.href
    navigate("/login");
  };

  if (loading) {
    return <h2 style={{ padding: "20px" }}>Loading Dashboard...</h2>;
  }

  // Fixed: show error state instead of silent zeros
  if (error) {
    return (
      <div style={{ padding: "20px" }}>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>Admin Dashboard</h2>
        <button onClick={logout}>Logout</button>
      </div>

      <h3>Impact Metrics</h3>
      <p>Total Listings: {analytics.totalListings || 0}</p>
      <p>Delivered: {analytics.deliveredCount || 0}</p>
      <p>Expired: {analytics.expiredCount || 0}</p>
      <p>Active: {analytics.activeCount || 0}</p>
      <p>Reserved: {analytics.reservedCount || 0}</p>
      <p>Total Quantity Redistributed: {analytics.totalQuantityRedistributed || 0}</p>

      {/* Fixed: topRestaurants was fetched but never displayed */}
      <h3>Top Restaurants by Delivery</h3>
      {analytics.topRestaurants?.length > 0 ? (
        <ol>
          {analytics.topRestaurants.map((r) => (
            <li key={r.restaurantName}>
              {r.restaurantName} — {r.totalDelivered} units delivered
            </li>
          ))}
        </ol>
      ) : (
        <p>No delivery data yet.</p>
      )}

    </div>
  );
}

export default AdminDashboard;
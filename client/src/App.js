import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Register from "./pages/Register";
import Login from "./pages/Login";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import NGODashboard from "./pages/NGODashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AddDonation from "./pages/AddDonation";
import ProtectedRoute from "./components/ProtectedRoute";

/* ==========================
   Simple fallback pages
========================== */
const Unauthorized = () => (
  <div style={{ textAlign: "center", marginTop: "100px" }}>
    <h2>403 — Access Denied</h2>
    <p>You don't have permission to view this page.</p>
    <a href="/login">Back to Login</a>
  </div>
);

const NotFound = () => (
  <div style={{ textAlign: "center", marginTop: "100px" }}>
    <h2>404 — Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/login">Back to Login</a>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Fixed: unauthorized page for wrong-role redirects */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Restaurant Routes */}
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute role="restaurant">
              <RestaurantDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/add-donation"
          element={
            <ProtectedRoute role="restaurant">
              <AddDonation />
            </ProtectedRoute>
          }
        />

        {/* NGO Dashboard */}
        <Route
          path="/ngo"
          element={
            <ProtectedRoute role="ngo">
              <NGODashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Fixed: 404 page instead of silent redirect to /login */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Router>
  );
}

export default App;
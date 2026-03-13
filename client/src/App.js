import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate
} from "react-router-dom";

import { lazy, Suspense, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

import Register from "./pages/Register";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

/* ==========================
   Lazy-loaded dashboards
========================== */
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));
const NGODashboard = lazy(() => import("./pages/NGODashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AddDonation = lazy(() => import("./pages/AddDonation"));

/* ==========================
   PublicRoute
   Prevent logged-in users
   from seeing login/register
========================== */
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      const { role, exp } = jwtDecode(token);

      if (exp * 1000 > Date.now()) {
        return <Navigate to={`/${role}`} replace />;
      }
    } catch {
      localStorage.clear();
    }
  }

  return children;
};

/* ==========================
   Unauthorized Page
========================== */
const Unauthorized = () => (
  <div style={{ textAlign: "center", marginTop: "100px" }}>
    <h2>403 — Access Denied</h2>
    <p>You don't have permission to view this page.</p>
    <Link to="/login">Back to Login</Link>
  </div>
);

/* ==========================
   404 Page
========================== */
const NotFound = () => (
  <div style={{ textAlign: "center", marginTop: "100px" }}>
    <h2>404 — Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
    <Link to="/login">Back to Login</Link>
  </div>
);

/* ==========================
   Main App Component
========================== */
function AppRoutes() {
  const navigate = useNavigate();

  /* Listen for axios auth logout events */
  useEffect(() => {
    const handleLogout = () => {
      navigate("/login", { replace: true });
    };

    window.addEventListener("auth:logout", handleLogout);

    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [navigate]);

  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", marginTop: "100px" }}>
          Loading...
        </div>
      }
    >
      <Routes>

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Unauthorized */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Restaurant */}
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

        {/* NGO */}
        <Route
          path="/ngo"
          element={
            <ProtectedRoute role="ngo">
              <NGODashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Suspense>
  );
}

/* ==========================
   Root Router
========================== */
function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
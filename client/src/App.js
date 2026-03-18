import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";

import { lazy, Suspense, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

import Register      from "./pages/Register";
import Login         from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile       from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";

/* ============================================================
   LAZY-LOADED PAGES
============================================================ */
const RestaurantDashboard = lazy(() => import("./pages/RestaurantDashboard"));
const NGODashboard        = lazy(() => import("./pages/NGODashboard"));
const AdminDashboard      = lazy(() => import("./pages/AdminDashboard"));
const AddDonation         = lazy(() => import("./pages/AddDonation"));

/* ============================================================
   SHARED STYLES (injected once)
============================================================ */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');

  :root {
    --bg:       #0e100f;
    --surface:  #161a18;
    --border:   #2a3028;
    --text:     #e8ede9;
    --muted:    #7a8c7e;
    --accent:   #5fd475;
    --danger:   #f05252;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes drift   { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,-15px); } }

  .utility-page {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; position: relative; overflow: hidden;
  }
  .utility-orb {
    position: fixed; border-radius: 50%; filter: blur(90px); opacity: .12;
    pointer-events: none; animation: drift 14s ease-in-out infinite;
  }

  .utility-card {
    position: relative; z-index: 1;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 44px 40px;
    text-align: center; max-width: 400px; width: 100%;
    animation: fadeUp .3s ease;
    box-shadow: 0 24px 60px rgba(0,0,0,.4);
  }

  .utility-code {
    font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em;
    color: var(--muted); margin-bottom: 10px;
  }
  .utility-title {
    font-family: var(--font-display); font-size: 26px; font-weight: 800;
    color: var(--text); margin-bottom: 10px;
  }
  .utility-msg {
    font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 28px;
  }
  .utility-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 22px; border-radius: 10px;
    background: var(--accent); color: #0a120b;
    font-family: var(--font-display); font-size: 14px; font-weight: 700;
    text-decoration: none; transition: .15s;
    box-shadow: 0 2px 12px rgba(95,212,117,.25);
  }
  .utility-btn:hover { background: #a8f0b4; box-shadow: 0 4px 18px rgba(95,212,117,.35); }

  .suspense-wrap {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
  }
  .suspense-spinner {
    width: 30px; height: 30px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  .suspense-label { font-family: var(--font-mono); font-size: 12px; color: var(--muted); letter-spacing: .08em; }
`;

/* ============================================================
   PUBLIC ROUTE — redirect logged-in users to their dashboard
============================================================ */
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const { role, exp } = jwtDecode(token);
      if (exp * 1000 > Date.now()) return <Navigate to={`/${role}`} replace />;
    } catch { localStorage.clear(); }
  }
  return children;
};

/* ============================================================
   UTILITY PAGES
============================================================ */
const Unauthorized = () => (
  <>
    <style>{GLOBAL_CSS}</style>
    <div className="utility-page">
      <div className="utility-orb" style={{ width: 360, height: 360, background: "#f05252", top: -80, right: -80 }} />
      <div className="utility-card">
        <div style={{ fontSize: 42, marginBottom: 16 }}>🚫</div>
        <div className="utility-code">ERROR 403</div>
        <h1 className="utility-title">Access Denied</h1>
        <p className="utility-msg">You don't have permission to view this page. Please sign in with an authorised account.</p>
        <Link to="/login" className="utility-btn">← Back to Login</Link>
      </div>
    </div>
  </>
);

const NotFound = () => (
  <>
    <style>{GLOBAL_CSS}</style>
    <div className="utility-page">
      <div className="utility-orb" style={{ width: 400, height: 400, background: "#5fd475", top: -100, left: -100 }} />
      <div className="utility-orb" style={{ width: 280, height: 280, background: "#60b4f0", bottom: -60, right: -60, animationDelay: "7s" }} />
      <div className="utility-card">
        <div style={{ fontSize: 42, marginBottom: 16 }}>🍽</div>
        <div className="utility-code">ERROR 404</div>
        <h1 className="utility-title">Page Not Found</h1>
        <p className="utility-msg">Looks like this page got redistributed. The route you're looking for doesn't exist.</p>
        <Link to="/login" className="utility-btn">← Back to Login</Link>
      </div>
    </div>
  </>
);

const SuspenseFallback = () => (
  <>
    <style>{GLOBAL_CSS}</style>
    <div className="suspense-wrap">
      <div className="suspense-spinner" />
      <p className="suspense-label">Loading…</p>
    </div>
  </>
);

/* ============================================================
   APP ROUTES
============================================================ */
function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = () => navigate("/login", { replace: true });
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [navigate]);

  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Utility */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Restaurant */}
        <Route path="/restaurant"  element={<ProtectedRoute role="restaurant"><RestaurantDashboard /></ProtectedRoute>} />
        <Route path="/add-donation" element={<ProtectedRoute role="restaurant"><AddDonation /></ProtectedRoute>} />

        {/* NGO */}
        <Route path="/ngo" element={<ProtectedRoute role="ngo"><NGODashboard /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

        {/* Profile — accessible to any authenticated user */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Reset password — public (token in URL, no auth needed) */}
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Suspense>
  );
}

/* ============================================================
   ROOT
============================================================ */
function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
import { Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import PropTypes from "prop-types";

const VALID_ROLES = ["restaurant", "ngo", "admin"];

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  // No token → redirect to login
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  let decoded;

  try {
    decoded = jwtDecode(token);
  } catch (err) {
    // Malformed or tampered token
    if (localStorage.getItem("token")) {
      localStorage.clear();
    }
    return <Navigate to="/login" replace />;
  }

  // NOTE:
  // This is ONLY a UX check.
  // Real authentication validation must happen on the server
  // using authMiddleware that verifies the JWT signature.
  if (decoded.exp * 1000 < Date.now()) {
    if (localStorage.getItem("token")) {
      localStorage.clear();
    }
    return <Navigate to="/login" replace />;
  }

  const userRole = decoded.role;

  // Developer mistake protection
  if (role && !VALID_ROLES.includes(role)) {
    console.error(
      `ProtectedRoute: invalid role "${role}". Must be one of: ${VALID_ROLES.join(
        ", "
      )}`
    );
  }

  // Logged in but wrong role
  if (role && userRole !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.string,
};

export default ProtectedRoute;
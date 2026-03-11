import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import PropTypes from "prop-types";

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem("token");

  // No token at all — redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  let decoded;
  try {
    decoded = jwtDecode(token);
  } catch (err) {
    // Token is malformed/fake — clear storage and redirect
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  // Token is expired — clear storage and redirect
  if (decoded.exp * 1000 < Date.now()) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  // Read role from signed token payload, not localStorage
  const userRole = decoded.role;

  // Logged in but wrong role — redirect to unauthorized page
  if (role && userRole !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.string
};

export default ProtectedRoute;
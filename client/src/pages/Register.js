import { useState } from "react";
import axios from "../api/axios";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "ngo",
    latitude: "",
    longitude: ""
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    // Client-side password match check
    if (formData.password !== formData.confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match");
      return;
    }

    // Client-side password length check
    if (formData.password.length < 8) {
      setIsError(true);
      setMessage("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      // Fixed: destructure out confirmPassword and role — don't send to backend
      const { confirmPassword, role, latitude, longitude, ...rest } = formData;

      const res = await axios.post("/auth/register", {
        ...rest,
        // Fixed: send as GeoJSON — coordinates are [longitude, latitude]
        location: {
          type: "Point",
          coordinates: [Number(longitude), Number(latitude)]
        }
      });

      setIsError(false);
      setMessage(res.data.message || "Registered successfully!");

      setTimeout(() => navigate("/login"), 1500);

    } catch (error) {
      setIsError(true);
      setMessage(
        error.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Register</h2>

      <form onSubmit={handleSubmit} style={styles.form}>

        <input
          type="text"
          name="name"
          placeholder="Name"
          required
          value={formData.name}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          value={formData.email}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          type="password"
          name="password"
          placeholder="Password (min 8 characters)"
          required
          minLength={8}
          value={formData.password}
          onChange={handleChange}
          style={styles.input}
        />

        {/* Fixed: added confirm password field */}
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          style={styles.input}
        />

        {/* Fixed: removed "admin" option */}
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          style={styles.input}
        >
          <option value="ngo">NGO</option>
          <option value="restaurant">Restaurant</option>
        </select>

        <input
          type="number"
          name="latitude"
          placeholder="Latitude (e.g. 12.9716)"
          step="any"
          min="-90"
          max="90"
          required
          value={formData.latitude}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          type="number"
          name="longitude"
          placeholder="Longitude (e.g. 77.5946)"
          step="any"
          min="-180"
          max="180"
          required
          value={formData.longitude}
          onChange={handleChange}
          style={styles.input}
        />

        <button
          type="submit"
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer"
          }}
          disabled={loading}
        >
          {loading ? "Registering..." : "Register"}
        </button>

      </form>

      {message && (
        <p style={{ color: isError ? "red" : "green", marginTop: "10px" }}>
          {message}
        </p>
      )}

      {/* Fixed: link back to login */}
      <p style={{ marginTop: "15px" }}>
        Already have an account?{" "}
        <Link to="/login">Login here</Link>
      </p>

    </div>
  );
};

const styles = {
  container: {
    width: "400px",
    margin: "80px auto",
    padding: "30px",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
    borderRadius: "10px",
    textAlign: "center"
  },
  form: {
    display: "flex",
    flexDirection: "column"
  },
  input: {
    margin: "10px 0",
    padding: "10px",
    fontSize: "14px"
  },
  button: {
    padding: "10px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none"
  }
};

export default Register;
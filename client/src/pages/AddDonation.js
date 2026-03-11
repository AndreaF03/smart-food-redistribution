import { useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function AddDonation() {

  const navigate = useNavigate();

  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [expiryTime, setExpiryTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Client-side expiry validation
    if (new Date(expiryTime) <= new Date()) {
      setError("Expiry time must be in the future");
      return;
    }

    try {
      setLoading(true);

      // Fixed: correct endpoint /donations, quantity cast to Number
      await axios.post("/donations", {
        foodName,
        quantity: Number(quantity),
        pickupLocation,
        expiryTime
      });

      setSuccess("Donation added successfully ✅");

      setFoodName("");
      setQuantity("");
      setPickupLocation("");
      setExpiryTime("");

      setTimeout(() => navigate("/restaurant"), 1500);

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Donation failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>

      <h2>Add Food Donation</h2>

      {/* Inline feedback instead of alert() */}
      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      <form onSubmit={handleSubmit} style={styles.form}>

        <input
          type="text"
          placeholder="Food Name"
          required
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
        />

        {/* Fixed: min=1 to prevent 0 or negative */}
        <input
          type="number"
          placeholder="Quantity"
          required
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <input
          type="text"
          placeholder="Pickup Location"
          required
          value={pickupLocation}
          onChange={(e) => setPickupLocation(e.target.value)}
        />

        {/* Fixed: added required */}
        <input
          type="datetime-local"
          required
          value={expiryTime}
          onChange={(e) => setExpiryTime(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Add Donation"}
        </button>

      </form>

    </div>
  );
}

const styles = {
  container: {
    maxWidth: "500px",
    margin: "100px auto",
    padding: "30px",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
    borderRadius: "10px",
    textAlign: "center"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  error: {
    color: "red",
    fontSize: "14px"
  },
  success: {
    color: "green",
    fontSize: "14px"
  }
};

export default AddDonation;
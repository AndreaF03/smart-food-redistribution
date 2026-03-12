import { useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function AddDonation() {

  const navigate = useNavigate();

  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [expiryTime, setExpiryTime] = useState("");
  const [image, setImage] = useState(null); // ✅ added image state

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (new Date(expiryTime) <= new Date()) {
      setError("Expiry time must be in the future");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("foodName", foodName);
      formData.append("quantity", Number(quantity));
      formData.append("pickupLocation", pickupLocation);
      formData.append("expiryTime", expiryTime);

      if (image) {
        formData.append("image", image);
      }

      await axios.post("/donations", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setSuccess("Donation added successfully ✅");

      setFoodName("");
      setQuantity("");
      setPickupLocation("");
      setExpiryTime("");
      setImage(null);

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

        <input
          type="datetime-local"
          required
          value={expiryTime}
          onChange={(e) => setExpiryTime(e.target.value)}
        />

        {/* ✅ Fixed image upload */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files[0])}
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
import { useState } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

function AddDonation() {

  const navigate = useNavigate();

  const [foodType, setFoodType] = useState("cooked");
  const [quantity, setQuantity] = useState("");
  const [cookedTime, setCookedTime] = useState("");
  const [storageType, setStorageType] = useState("room");
  const [image, setImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {

    e.preventDefault();
    setError("");
    setSuccess("");

    try {

      setLoading(true);

      const formData = new FormData();

      formData.append("foodType", foodType);
      formData.append("quantity", Number(quantity));
      formData.append("cookedTime", cookedTime);
      formData.append("storageType", storageType);

      if (image) {
        formData.append("image", image);
      }

      await axios.post("/food", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setSuccess("Food donation added successfully ✅");

      setQuantity("");
      setCookedTime("");
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

        {/* Food Type */}
        <select
          value={foodType}
          onChange={(e) => setFoodType(e.target.value)}
        >
          <option value="cooked">Cooked Food</option>
          <option value="raw">Raw Food</option>
          <option value="packaged">Packaged</option>
          <option value="beverages">Beverages</option>
          <option value="other">Other</option>
        </select>

        {/* Quantity */}
        <input
          type="number"
          placeholder="Quantity"
          required
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        {/* Cooked Time */}
        <input
          type="datetime-local"
          required
          value={cookedTime}
          onChange={(e) => setCookedTime(e.target.value)}
        />

        {/* Storage Type */}
        <select
          value={storageType}
          onChange={(e) => setStorageType(e.target.value)}
        >
          <option value="room">Room Temperature</option>
          <option value="refrigerated">Refrigerated</option>
        </select>

        {/* Image Upload */}
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
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

/* ============================================================
   CONSTANTS
============================================================ */
const FOOD_TYPES = [
  { value: "cooked",    label: "Cooked Food" },
  { value: "raw",       label: "Raw Food" },
  { value: "packaged",  label: "Packaged" },
  { value: "beverages", label: "Beverages" },
  { value: "other",     label: "Other" },
];

const STORAGE_TYPES = [
  { value: "room",         label: "Room Temperature" },
  { value: "refrigerated", label: "Refrigerated" },
];

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_FILE_SIZE_MB   = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/* ============================================================
   HELPER — get max datetime string for the datetime-local input
   (now minus 1 minute, formatted as "YYYY-MM-DDTHH:MM")
============================================================ */
const getNowMinus1Min = () =>
  new Date(Date.now() - 60000).toISOString().slice(0, 16);

/* ============================================================
   COMPONENT
============================================================ */
function AddDonation() {

  const navigate    = useNavigate();
  const timerRef    = useRef(null);      // FIX #1: track timeout for cleanup
  const fileInputRef = useRef(null);     // FIX #8: reset file input UI on success

  /* -- Form state -- */
  const [foodType,    setFoodType]    = useState("cooked");
  const [quantity,    setQuantity]    = useState("");
  const [cookedTime,  setCookedTime]  = useState("");
  const [storageType, setStorageType] = useState("room");
  const [image,       setImage]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null); // FIX #9: preview

  /* -- UI state -- */
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [maxTime,  setMaxTime]  = useState(getNowMinus1Min()); // FIX #2: live max

  /* ----------------------------------------------------------
     FIX #1: Clear timeout on unmount so stale navigate()
     never fires after the component is gone
  ---------------------------------------------------------- */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /* ----------------------------------------------------------
     FIX #2: Tick the max datetime every minute so the "now"
     ceiling stays current while the user has the form open
  ---------------------------------------------------------- */
  useEffect(() => {
    const tick = setInterval(() => setMaxTime(getNowMinus1Min()), 60000);
    return () => clearInterval(tick);
  }, []);

  /* ----------------------------------------------------------
     FIX #9: Revoke object URL on unmount to prevent memory leak
  ---------------------------------------------------------- */
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  /* ----------------------------------------------------------
     Image selection handler
     FIX #3: Validate file size and type client-side BEFORE
             letting it reach the server / Cloudinary
     FIX #9: Generate preview URL
  ---------------------------------------------------------- */
  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    setError("");

    if (!file) {
      setImage(null);
      setImagePreview(null);
      return;
    }

    // Type check
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG and WebP images are allowed.");
      e.target.value = "";
      setImage(null);
      setImagePreview(null);
      return;
    }

    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Image must be under ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      e.target.value = "";
      setImage(null);
      setImagePreview(null);
      return;
    }

    // Revoke previous preview URL before creating a new one
    if (imagePreview) URL.revokeObjectURL(imagePreview);

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }, [imagePreview]);

  /* ----------------------------------------------------------
     Reset all form fields (called after successful submit)
  ---------------------------------------------------------- */
  const resetForm = useCallback(() => {
    // FIX #7: Reset ALL fields including selects
    setFoodType("cooked");
    setQuantity("");
    setCookedTime("");
    setStorageType("room");
    setImage(null);
    setImagePreview(null);
    // FIX #8: Reset the file input DOM element itself
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ----------------------------------------------------------
     Submit handler
  ---------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    /* ---- Client-side validation ---- */

    // FIX #5: Validate quantity as a real positive integer
    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty < 1 || !Number.isFinite(parsedQty)) {
      setError("Please enter a valid quantity of at least 1.");
      return;
    }

    // FIX #6: Validate cookedTime is present and a real date
    if (!cookedTime) {
      setError("Please select when the food was cooked.");
      return;
    }
    const cookedDate = new Date(cookedTime);
    if (isNaN(cookedDate.getTime())) {
      setError("Invalid cooked time. Please select a valid date and time.");
      return;
    }
    if (cookedDate > new Date()) {
      setError("Cooked time cannot be in the future.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("foodType",    foodType);
      formData.append("quantity",    parsedQty);

      // FIX #2: Convert local datetime to ISO string so the server
      // always receives UTC regardless of the user's timezone
      formData.append("cookedTime",  cookedDate.toISOString());
      formData.append("storageType", storageType);

      if (image) {
        formData.append("image", image);
      }

      // FIX #4: No Content-Type header — let browser set it automatically
      // with the correct multipart boundary. Setting it manually strips
      // the boundary and breaks multer's form parsing.
      await axios.post("/food", formData);

      setSuccess("Food donation added successfully ✅");
      resetForm();

      // FIX #1: Store timer ref so it can be cancelled if user navigates away
      timerRef.current = setTimeout(() => navigate("/restaurant"), 1500);

    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Submission failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; font-family: 'DM Sans', sans-serif; }

        @keyframes fadeIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 40px 20px 60px;
          background: #f1f5f9;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          overflow: hidden;
          animation: fadeIn 0.3s ease;
        }

        /* CARD HEADER */
        .card-header {
          padding: 22px 28px 20px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .card-header-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; flex-shrink: 0;
        }
        .card-header-title    { font-size: 19px; font-weight: 700; color: #0f172a; }
        .card-header-subtitle { font-size: 13px; color: #94a3b8; margin-top: 2px; }

        /* CARD BODY */
        .card-body { padding: 24px 28px 28px; }

        /* ALERTS */
        .alert {
          border-radius: 10px; padding: 12px 16px;
          font-size: 13.5px; font-weight: 500;
          margin-bottom: 20px;
          display: flex; align-items: flex-start; gap: 10px;
          animation: slideDown 0.2s ease;
        }
        .alert-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .alert-icon    { flex-shrink: 0; font-size: 16px; line-height: 1.4; }

        /* FORM */
        .form { display: flex; flex-direction: column; gap: 18px; }

        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label {
          font-size: 13px; font-weight: 600; color: #374151;
          display: flex; align-items: center; gap: 6px;
        }
        .field-label-icon { font-size: 15px; }
        .field-hint { font-size: 11.5px; color: #94a3b8; font-weight: 400; }

        .input, .select {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          appearance: none;
        }
        .input:focus, .select:focus {
          border-color: #f97316;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }
        .input::placeholder { color: #94a3b8; }

        /* SELECT WRAPPER (for custom arrow) */
        .select-wrapper { position: relative; }
        .select-arrow {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          font-size: 11px; color: #94a3b8;
          pointer-events: none;
        }

        /* FILE INPUT */
        .file-label {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px;
          border: 1.5px dashed #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          cursor: pointer;
          font-size: 13.5px; color: #64748b;
          transition: border-color 0.18s, background 0.18s;
        }
        .file-label:hover { border-color: #f97316; background: #fff7ed; color: #f97316; }
        .file-label-icon { font-size: 18px; }
        .file-input { display: none; }

        /* IMAGE PREVIEW */
        .preview-wrapper {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          border: 1.5px solid #e2e8f0;
          margin-top: 6px;
        }
        .preview-img {
          width: 100%; max-height: 200px;
          object-fit: cover; display: block;
        }
        .preview-remove {
          position: absolute; top: 8px; right: 8px;
          background: rgba(0,0,0,0.55); color: #fff;
          border: none; border-radius: 50%;
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; cursor: pointer; line-height: 1;
          transition: background 0.15s;
        }
        .preview-remove:hover { background: rgba(220,38,38,0.85); }
        .preview-meta {
          padding: 8px 12px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          font-size: 12px; color: #64748b;
          display: flex; justify-content: space-between;
        }

        /* FRESHNESS HINT */
        .freshness-hint {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12.5px;
          color: #15803d;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* DIVIDER */
        .divider { border: none; border-top: 1px solid #f1f5f9; }

        /* ACTIONS */
        .actions { display: flex; gap: 10px; }

        /* BUTTONS */
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 20px;
          border: none; border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 600;
          cursor: pointer; line-height: 1; white-space: nowrap;
          transition: background 0.16s, box-shadow 0.16s, transform 0.1s;
        }
        .btn:active:not(:disabled) { transform: scale(0.97); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-primary {
          flex: 1;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: #fff;
          box-shadow: 0 2px 8px rgba(249,115,22,0.35);
        }
        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(249,115,22,0.45);
        }

        .btn-ghost {
          background: #fff; color: #475569;
          border: 1.5px solid #e2e8f0;
        }
        .btn-ghost:hover:not(:disabled) {
          background: #f8fafc; border-color: #94a3b8; color: #0f172a;
        }

        .btn-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
      `}</style>

      <div className="page">
        <div className="card">

          {/* HEADER */}
          <div className="card-header">
            <div className="card-header-icon">🍱</div>
            <div>
              <div className="card-header-title">Add Food Donation</div>
              <div className="card-header-subtitle">List surplus food for NGOs to collect</div>
            </div>
          </div>

          <div className="card-body">

            {/* ALERTS */}
            {error && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert alert-success" role="status">
                <span className="alert-icon">✅</span>
                <span>{success} Redirecting…</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="form" noValidate>

              {/* FOOD TYPE */}
              <div className="field">
                <label className="field-label" htmlFor="foodType">
                  <span className="field-label-icon">🍽️</span>
                  Food Type
                </label>
                <div className="select-wrapper">
                  <select
                    id="foodType"
                    className="select"
                    value={foodType}
                    onChange={(e) => setFoodType(e.target.value)}
                  >
                    {FOOD_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span className="select-arrow">▼</span>
                </div>
              </div>

              {/* QUANTITY */}
              <div className="field">
                <label className="field-label" htmlFor="quantity">
                  <span className="field-label-icon">📦</span>
                  Quantity
                  <span className="field-hint">(number of servings / units)</span>
                </label>
                <input
                  id="quantity"
                  className="input"
                  type="number"
                  placeholder="e.g. 50"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {/* COOKED TIME */}
              <div className="field">
                <label className="field-label" htmlFor="cookedTime">
                  <span className="field-label-icon">🕐</span>
                  When was it cooked?
                </label>
                {/* FIX #2: max keeps the ceiling current; prevents future dates */}
                <input
                  id="cookedTime"
                  className="input"
                  type="datetime-local"
                  required
                  max={maxTime}
                  value={cookedTime}
                  onChange={(e) => setCookedTime(e.target.value)}
                />
                {/* Live freshness hint */}
                {cookedTime && !isNaN(new Date(cookedTime).getTime()) && (() => {
                  const hrs = (Date.now() - new Date(cookedTime)) / 3_600_000;
                  const maxHrs = storageType === "refrigerated" ? 12 : 6;
                  const score = Math.max(0, Math.round(100 - (hrs / maxHrs) * 100));
                  const color = score >= 70 ? "#15803d" : score >= 40 ? "#b45309" : "#dc2626";
                  const bg    = score >= 70 ? "#f0fdf4" : score >= 40 ? "#fffbeb" : "#fef2f2";
                  const border = score >= 70 ? "#bbf7d0" : score >= 40 ? "#fde68a" : "#fecaca";
                  return (
                    <div className="freshness-hint" style={{ background: bg, borderColor: border, color }}>
                      <span>🌿</span>
                      <span>Estimated freshness score: <strong>{score}%</strong> — expires in ~{Math.max(0, (maxHrs - hrs)).toFixed(1)}h</span>
                    </div>
                  );
                })()}
              </div>

              {/* STORAGE TYPE */}
              <div className="field">
                <label className="field-label" htmlFor="storageType">
                  <span className="field-label-icon">🧊</span>
                  Storage Type
                </label>
                <div className="select-wrapper">
                  <select
                    id="storageType"
                    className="select"
                    value={storageType}
                    onChange={(e) => setStorageType(e.target.value)}
                  >
                    {STORAGE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span className="select-arrow">▼</span>
                </div>
              </div>

              {/* IMAGE UPLOAD */}
              <div className="field">
                <label className="field-label">
                  <span className="field-label-icon">📷</span>
                  Photo
                  <span className="field-hint">(optional · max {MAX_FILE_SIZE_MB}MB · JPEG / PNG / WebP)</span>
                </label>

                {/* FIX #9: Show preview if image selected, else show upload button */}
                {imagePreview ? (
                  <div className="preview-wrapper">
                    <img src={imagePreview} alt="Food preview" className="preview-img" />
                    <button
                      type="button"
                      className="preview-remove"
                      title="Remove image"
                      onClick={() => {
                        setImage(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >×</button>
                    <div className="preview-meta">
                      <span>{image?.name}</span>
                      <span>{image ? (image.size / 1024).toFixed(0) + " KB" : ""}</span>
                    </div>
                  </div>
                ) : (
                  <label className="file-label" htmlFor="image">
                    <span className="file-label-icon">📎</span>
                    <span>Click to attach a photo…</span>
                  </label>
                )}

                {/* FIX #8: ref attached so we can reset the value after submit */}
                <input
                  id="image"
                  ref={fileInputRef}
                  className="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleImageChange}
                />
              </div>

              <hr className="divider" />

              {/* FIX #11 (back button) + submit */}
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate("/restaurant")}
                  disabled={loading}
                >
                  ← Back
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? <><span className="btn-spinner" /> Submitting…</>
                    : <>🍱 Add Donation</>
                  }
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default AddDonation;
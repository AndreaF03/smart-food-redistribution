import { useState, useEffect, useRef, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

/* ============================================================
   CONSTANTS
============================================================ */
const FOOD_TYPES = [
  { value: "cooked",    label: "Cooked Food",  icon: "🍛" },
  { value: "raw",       label: "Raw Food",     icon: "🥦" },
  { value: "packaged",  label: "Packaged",     icon: "📦" },
  { value: "beverages", label: "Beverages",    icon: "🥤" },
  { value: "other",     label: "Other",        icon: "🍽" },
];

const STORAGE_TYPES = [
  { value: "room",         label: "Room Temperature", icon: "🌡" },
  { value: "refrigerated", label: "Refrigerated",     icon: "❄" },
];

const ALLOWED_MIME_TYPES  = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_FILE_SIZE_MB    = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const getNowMinus1Min = () =>
  new Date(Date.now() - 60000).toISOString().slice(0, 16);

/* ============================================================
   COMPONENT
============================================================ */
function AddDonation() {
  const navigate     = useNavigate();
  const timerRef     = useRef(null);
  const fileInputRef = useRef(null);

  const [foodType,     setFoodType]     = useState("cooked");
  const [quantity,     setQuantity]     = useState("");
  const [cookedTime,   setCookedTime]   = useState("");
  const [storageType,  setStorageType]  = useState("room");
  const [image,        setImage]        = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");
  const [maxTime,      setMaxTime]      = useState(getNowMinus1Min());

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    const tick = setInterval(() => setMaxTime(getNowMinus1Min()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0];
    setError("");
    if (!file) { setImage(null); setImagePreview(null); return; }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG and WebP images are allowed.");
      e.target.value = ""; setImage(null); setImagePreview(null); return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Image must be under ${MAX_FILE_SIZE_MB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      e.target.value = ""; setImage(null); setImagePreview(null); return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }, [imagePreview]);

  const resetForm = useCallback(() => {
    setFoodType("cooked"); setQuantity(""); setCookedTime("");
    setStorageType("room"); setImage(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    const parsedQty = parseInt(quantity, 10);
    if (!parsedQty || parsedQty < 1 || !Number.isFinite(parsedQty)) {
      setError("Please enter a valid quantity of at least 1."); return;
    }
    if (!cookedTime) { setError("Please select when the food was cooked."); return; }
    const cookedDate = new Date(cookedTime);
    if (isNaN(cookedDate.getTime())) { setError("Invalid cooked time."); return; }
    if (cookedDate > new Date()) { setError("Cooked time cannot be in the future."); return; }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("foodType",   foodType);
      formData.append("quantity",   parsedQty);
      formData.append("cookedTime", cookedDate.toISOString());
      formData.append("storageType", storageType);
      if (image) formData.append("image", image);
      await axios.post("/food", formData);
      setSuccess("Donation added successfully!");
      resetForm();
      timerRef.current = setTimeout(() => navigate("/restaurant"), 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Freshness preview ── */
  const freshnessInfo = (() => {
    if (!cookedTime || isNaN(new Date(cookedTime).getTime())) return null;
    const hrs    = (Date.now() - new Date(cookedTime)) / 3_600_000;
    const maxHrs = storageType === "refrigerated" ? 12 : 6;
    const score  = Math.max(0, Math.round(100 - (hrs / maxHrs) * 100));
    const remaining = Math.max(0, maxHrs - hrs);
    const color = score >= 70 ? "var(--fresh)" : score >= 40 ? "var(--warn)" : "var(--danger)";
    return { score, remaining, color };
  })();

  return (
    <>
      <style>{CSS}</style>
      <div className="page">
        <div className="shell">

          {/* ── BACK ── */}
          <button className="back-btn" onClick={() => navigate("/restaurant")} disabled={loading}>
            ← Back to Dashboard
          </button>

          <div className="card">

            {/* ── HEADER ── */}
            <div className="card-header">
              <div className="card-icon">🍱</div>
              <div>
                <h1 className="card-title">Add Food Donation</h1>
                <p className="card-sub">List surplus food for NGOs to collect</p>
              </div>
            </div>

            <div className="card-body">

              {/* ── ALERTS ── */}
              {error && (
                <div className="flash error" role="alert">
                  <span>⚠</span>
                  <span>{error}</span>
                  <button onClick={() => setError("")}>×</button>
                </div>
              )}
              {success && (
                <div className="flash success" role="status">
                  <span>✅</span>
                  <span>{success} Redirecting…</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>

                {/* ── FOOD TYPE ── */}
                <div className="field">
                  <label className="field-label">🍽 Food Type</label>
                  <div className="type-grid">
                    {FOOD_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`type-chip ${foodType === t.value ? "active" : ""}`}
                        onClick={() => setFoodType(t.value)}
                      >
                        <span className="chip-icon">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── QUANTITY ── */}
                <div className="field">
                  <label className="field-label" htmlFor="quantity">
                    📦 Quantity
                    <span className="field-hint">servings / units</span>
                  </label>
                  <input
                    id="quantity"
                    className="field-input"
                    type="number"
                    placeholder="e.g. 50"
                    min="1" step="1" required
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>

                {/* ── COOKED TIME ── */}
                <div className="field">
                  <label className="field-label" htmlFor="cookedTime">
                    🕐 When was it cooked?
                  </label>
                  <input
                    id="cookedTime"
                    className="field-input"
                    type="datetime-local"
                    required max={maxTime}
                    value={cookedTime}
                    onChange={e => setCookedTime(e.target.value)}
                  />
                  {freshnessInfo && (
                    <div className="freshness-bar-wrap">
                      <div className="freshness-bar-row">
                        <span style={{ color: freshnessInfo.color, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>
                          🌿 {freshnessInfo.score}% fresh
                        </span>
                        <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          ~{freshnessInfo.remaining.toFixed(1)}h remaining
                        </span>
                      </div>
                      <div className="freshness-track">
                        <div className="freshness-fill" style={{ width: `${freshnessInfo.score}%`, background: freshnessInfo.color }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── STORAGE TYPE ── */}
                <div className="field">
                  <label className="field-label">🧊 Storage Type</label>
                  <div className="storage-row">
                    {STORAGE_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`storage-chip ${storageType === t.value ? "active" : ""}`}
                        onClick={() => setStorageType(t.value)}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── IMAGE UPLOAD ── */}
                <div className="field">
                  <label className="field-label">
                    📷 Photo
                    <span className="field-hint">optional · max {MAX_FILE_SIZE_MB}MB · JPEG / PNG / WebP</span>
                  </label>

                  {imagePreview ? (
                    <div className="preview-wrap">
                      <img src={imagePreview} alt="Food preview" className="preview-img" />
                      <button
                        type="button"
                        className="preview-remove"
                        title="Remove image"
                        onClick={() => {
                          setImage(null); setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >×</button>
                      <div className="preview-meta">
                        <span>{image?.name}</span>
                        <span>{image ? `${(image.size / 1024).toFixed(0)} KB` : ""}</span>
                      </div>
                    </div>
                  ) : (
                    <label className="upload-zone" htmlFor="image">
                      <span className="upload-icon">📎</span>
                      <span className="upload-text">Click to attach a photo…</span>
                      <span className="upload-sub">drag & drop or browse</span>
                    </label>
                  )}

                  <input
                    id="image" ref={fileInputRef} type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp"
                    style={{ display: "none" }}
                    onChange={handleImageChange}
                  />
                </div>

                <hr className="divider" />

                {/* ── ACTIONS ── */}
                <div className="actions">
                  <button
                    type="button" className="btn ghost"
                    onClick={() => navigate("/restaurant")} disabled={loading}
                  >← Back</button>
                  <button type="submit" className="btn primary" disabled={loading}>
                    {loading
                      ? <><span className="spinner" /> Submitting…</>
                      : <>🍱 Add Donation</>
                    }
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   CSS
============================================================ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0e100f;
    --surface:  #161a18;
    --surface2: #1e2420;
    --border:   #2a3028;
    --text:     #e8ede9;
    --muted:    #7a8c7e;
    --accent:   #5fd475;
    --accent2:  #a8f0b4;
    --fresh:    #5fd475;
    --warn:     #f0b429;
    --danger:   #f05252;
    --radius:   14px;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  @keyframes fadeUp   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes spin     { to { transform: rotate(360deg); } }

  /* ── PAGE ── */
  .page {
    min-height: 100vh;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px 80px;
    background: var(--bg);
  }

  .shell { width: 100%; max-width: 520px; animation: fadeUp .3s ease; }

  /* ── BACK BTN ── */
  .back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-family: var(--font-mono); font-size: 12px;
    margin-bottom: 18px; padding: 0; transition: color .15s;
    letter-spacing: .04em;
  }
  .back-btn:hover { color: var(--text); }

  /* ── CARD ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; overflow: hidden;
  }

  .card-header {
    padding: 22px 28px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px;
  }
  .card-icon {
    width: 46px; height: 46px; border-radius: 13px; font-size: 24px; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(95,212,117,.2), rgba(96,180,240,.15));
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
  }
  .card-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
  .card-sub   { font-size: 12px; color: var(--muted); font-family: var(--font-mono); margin-top: 3px; }

  .card-body { padding: 26px 28px 30px; }

  /* ── FLASH ── */
  .flash {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
    font-size: 13.5px; font-weight: 500; margin-bottom: 22px;
    animation: slideDown .2s ease;
  }
  .flash button { background: none; border: none; cursor: pointer; font-size: 18px; opacity: .6; color: inherit; margin-left: auto; }
  .flash.error   { background: rgba(240,82,82,.1);  color: var(--danger); border: 1px solid rgba(240,82,82,.25); }
  .flash.success { background: rgba(95,212,117,.1); color: var(--accent); border: 1px solid rgba(95,212,117,.25); }

  /* ── FIELD ── */
  .field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
  .field-label {
    font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 8px;
  }
  .field-hint { font-size: 11px; color: var(--muted); font-weight: 400; font-family: var(--font-mono); }

  /* ── INPUTS ── */
  .field-input {
    width: 100%; padding: 11px 14px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text);
    font-family: var(--font-body); font-size: 14px;
    outline: none; transition: border-color .15s, box-shadow .15s;
    appearance: none;
  }
  .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(95,212,117,.12); }
  .field-input::placeholder { color: var(--muted); }
  /* datetime-local icon color */
  .field-input::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }

  /* ── FOOD TYPE CHIPS ── */
  .type-grid { display: flex; gap: 8px; flex-wrap: wrap; }
  .type-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 9px 14px; border-radius: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--muted); font-family: var(--font-body); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: .15s;
  }
  .type-chip:hover { color: var(--text); border-color: var(--muted); }
  .type-chip.active { background: rgba(95,212,117,.12); color: var(--accent); border-color: rgba(95,212,117,.35); font-weight: 600; }
  .chip-icon { font-size: 16px; }

  /* ── STORAGE CHIPS ── */
  .storage-row { display: flex; gap: 10px; }
  .storage-chip {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px; border-radius: 10px;
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--muted); font-family: var(--font-body); font-size: 13.5px; font-weight: 500;
    cursor: pointer; transition: .15s;
  }
  .storage-chip:hover { color: var(--text); border-color: var(--muted); }
  .storage-chip.active { background: rgba(95,212,117,.12); color: var(--accent); border-color: rgba(95,212,117,.35); font-weight: 600; }

  /* ── FRESHNESS PREVIEW ── */
  .freshness-bar-wrap {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px;
    display: flex; flex-direction: column; gap: 8px;
    animation: slideDown .2s ease;
  }
  .freshness-bar-row { display: flex; justify-content: space-between; align-items: center; }
  .freshness-track { height: 4px; background: var(--border); border-radius: 99px; overflow: hidden; }
  .freshness-fill  { height: 100%; border-radius: 99px; transition: width .5s ease; }

  /* ── IMAGE UPLOAD ── */
  .upload-zone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; padding: 24px 16px;
    background: var(--surface2); border: 1.5px dashed var(--border);
    border-radius: 12px; cursor: pointer; transition: .15s;
  }
  .upload-zone:hover { border-color: var(--accent); background: rgba(95,212,117,.04); }
  .upload-icon { font-size: 26px; }
  .upload-text { font-size: 13.5px; font-weight: 500; color: var(--muted); }
  .upload-sub  { font-size: 11px; color: var(--border); font-family: var(--font-mono); }
  .upload-zone:hover .upload-text { color: var(--accent); }

  /* ── PREVIEW ── */
  .preview-wrap {
    border-radius: 12px; overflow: hidden;
    border: 1px solid var(--border); position: relative;
  }
  .preview-img { width: 100%; max-height: 200px; object-fit: cover; display: block; }
  .preview-remove {
    position: absolute; top: 8px; right: 8px;
    background: rgba(0,0,0,.6); color: #fff;
    border: none; border-radius: 50%;
    width: 26px; height: 26px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; cursor: pointer; transition: background .15s;
  }
  .preview-remove:hover { background: rgba(240,82,82,.8); }
  .preview-meta {
    padding: 8px 12px; background: var(--surface2); border-top: 1px solid var(--border);
    font-size: 11px; color: var(--muted); font-family: var(--font-mono);
    display: flex; justify-content: space-between;
  }

  /* ── DIVIDER ── */
  .divider { border: none; border-top: 1px solid var(--border); margin: 6px 0 22px; }

  /* ── ACTIONS ── */
  .actions { display: flex; gap: 10px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 11px 20px; border-radius: 10px; border: none;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: .15s; white-space: nowrap;
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn.primary {
    flex: 1; background: var(--accent); color: #0a120b;
    box-shadow: 0 2px 12px rgba(95,212,117,.25);
  }
  .btn.primary:hover:not(:disabled) { background: var(--accent2); box-shadow: 0 4px 18px rgba(95,212,117,.35); }
  .btn.ghost {
    background: var(--surface2); color: var(--muted); border: 1px solid var(--border);
  }
  .btn.ghost:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }

  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,.2); border-top-color: #0a120b;
    animation: spin .6s linear infinite; display: inline-block;
  }
`;

export default AddDonation;
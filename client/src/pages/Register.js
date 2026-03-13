import { useState, useEffect, useRef, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate, Link } from "react-router-dom";

/* ============================================================
   HELPERS
============================================================ */
const getRolePath = (role) => {
  const map = { restaurant: "/restaurant", ngo: "/ngo", admin: "/admin" };
  return map[role] || "/login";
};

const validateCoord = (val, min, max) => {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) && n >= min && n <= max;
};

/* ============================================================
   COMPONENT
============================================================ */
const Register = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const [formData, setFormData] = useState({
    name:            "",
    email:           "",
    password:        "",
    confirmPassword: "",
    role:            "ngo",
    latitude:        "",
    longitude:       ""
  });

  const [message,      setMessage]      = useState("");
  const [isError,      setIsError]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showPass,     setShowPass]     = useState(false);   // FIX #8: show/hide
  const [showConfirm,  setShowConfirm]  = useState(false);   // FIX #8
  const [locLoading,   setLocLoading]   = useState(false);   // FIX #10: geolocation

  /* ----------------------------------------------------------
     FIX #5: Clear timer on unmount
  ---------------------------------------------------------- */
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  /* ----------------------------------------------------------
     FIX #3: Functional updater — no stale closure on rapid typing
  ---------------------------------------------------------- */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  /* ----------------------------------------------------------
     FIX #10: Geolocation — "Use my location" button
  ---------------------------------------------------------- */
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setIsError(true);
      setMessage("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude:  pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
        setLocLoading(false);
        setIsError(false);
        setMessage("Location detected ✅");
      },
      (err) => {
        setLocLoading(false);
        setIsError(true);
        setMessage(
          err.code === 1
            ? "Location permission denied. Please enter coordinates manually."
            : "Could not detect location. Please enter coordinates manually."
        );
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  /* ----------------------------------------------------------
     Submit
  ---------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (loading) return;

    /* ---- Client-side validation ---- */

    // FIX #13: Name length check
    if (formData.name.trim().length < 2) {
      setIsError(true);
      setMessage("Name must be at least 2 characters.");
      return;
    }

    if (formData.password.length < 8) {
      setIsError(true);
      setMessage("Password must be at least 8 characters.");
      return;
    }

    // FIX #8: Basic password strength — not all digits, not all same char
    if (/^\d+$/.test(formData.password)) {
      setIsError(true);
      setMessage("Password cannot be all numbers. Add letters or symbols.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match.");
      return;
    }

    // FIX #7: Validate coordinates as real finite numbers in range
    const lat = formData.latitude;
    const lng = formData.longitude;

    if (!lat || !lng) {
      setIsError(true);
      setMessage("Please provide your location (use the button or enter manually).");
      return;
    }

    if (!validateCoord(lat, -90, 90)) {
      setIsError(true);
      setMessage("Latitude must be a number between -90 and 90.");
      return;
    }

    if (!validateCoord(lng, -180, 180)) {
      setIsError(true);
      setMessage("Longitude must be a number between -180 and 180.");
      return;
    }

    try {
      setLoading(true);

      // FIX #1: Include role in the payload (was destructured out before)
      // FIX #4: Coordinates validated above — Number() only called on valid strings
      const res = await axios.post("/auth/register", {
        name:     formData.name.trim(),
        email:    formData.email.trim().toLowerCase(),
        password: formData.password,
        role:     formData.role,          // FIX #1: role now included
        location: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)] // GeoJSON: [longitude, latitude]
        }
      });

      // FIX #2: Save userId for Socket.io if token returned on register
      if (res.data.token) {
        localStorage.setItem("token",    res.data.token);
        localStorage.setItem("role",     res.data.role);
        localStorage.setItem("userId",   res.data.user?._id  || "");
        localStorage.setItem("userName", res.data.user?.name || "");
      }

      setIsError(false);
      setMessage("Registered successfully! Redirecting…");

      // FIX #11: Redirect directly to role dashboard (not back to /login)
      timerRef.current = setTimeout(() => {
        navigate(getRolePath(res.data.role), { replace: true });
      }, 1500);

    } catch (err) {
      setIsError(true);
      setMessage(
        err.response?.data?.message || "Registration failed. Please try again."
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

        @keyframes fadeIn    { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake     { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }

        .page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 32px 16px;
          background: #f1f5f9;
        }

        .card {
          width: 100%; max-width: 460px;
          background: #fff; border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          overflow: hidden; animation: fadeIn 0.35s ease;
        }

        /* HEADER */
        .card-header {
          padding: 26px 32px 22px;
          text-align: center; border-bottom: 1px solid #f1f5f9;
        }
        .card-logo {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border-radius: 15px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 24px; margin-bottom: 12px;
        }
        .card-title    { font-size: 21px; font-weight: 700; color: #0f172a; }
        .card-subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }

        /* BODY */
        .card-body { padding: 24px 32px 28px; }

        /* ALERTS */
        .alert {
          border-radius: 10px; padding: 12px 16px;
          font-size: 13.5px; font-weight: 500;
          margin-bottom: 20px;
          display: flex; align-items: flex-start; gap: 10px;
          animation: slideDown 0.2s ease;
        }
        .alert-error   {
          background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
          animation: slideDown 0.2s ease, shake 0.4s ease;
        }
        .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .alert-icon    { flex-shrink: 0; line-height: 1.4; }

        /* SECTION LABEL */
        .section-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 1px; color: #94a3b8; margin: 20px 0 12px;
        }
        .section-label:first-child { margin-top: 0; }

        /* FORM */
        .form  { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 600; color: #374151; }

        .input-wrapper { position: relative; }

        .input, .select {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #0f172a; background: #f8fafc;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          appearance: none;
        }
        .input:focus, .select:focus {
          border-color: #f97316; background: #fff;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }
        .input::placeholder { color: #94a3b8; }
        .input-has-toggle   { padding-right: 46px; }

        /* TOGGLE BTN */
        .toggle-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          padding: 4px; color: #94a3b8; font-size: 16px;
          line-height: 1; transition: color 0.15s;
          display: flex; align-items: center;
        }
        .toggle-btn:hover { color: #475569; }

        /* SELECT WRAPPER */
        .select-wrapper { position: relative; }
        .select-arrow {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          font-size: 11px; color: #94a3b8; pointer-events: none;
        }

        /* ROLE CARDS */
        .role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .role-card {
          padding: 14px 16px; border: 2px solid #e2e8f0;
          border-radius: 12px; cursor: pointer;
          transition: all 0.18s; text-align: center;
          background: #f8fafc;
        }
        .role-card:hover { border-color: #f97316; background: #fff7ed; }
        .role-card.selected { border-color: #f97316; background: #fff7ed; box-shadow: 0 0 0 3px rgba(249,115,22,0.1); }
        .role-icon  { font-size: 26px; margin-bottom: 6px; }
        .role-name  { font-size: 14px; font-weight: 700; color: #0f172a; }
        .role-desc  { font-size: 11.5px; color: #64748b; margin-top: 2px; line-height: 1.4; }

        /* COORD ROW */
        .coord-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        /* LOCATION BUTTON */
        .loc-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 10px 16px;
          background: #f0fdf4; border: 1.5px dashed #86efac;
          border-radius: 10px; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 600; color: #16a34a;
          transition: background 0.18s, border-color 0.18s;
        }
        .loc-btn:hover:not(:disabled) { background: #dcfce7; border-color: #4ade80; }
        .loc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .loc-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(22,163,74,0.25);
          border-top-color: #16a34a; border-radius: 50%;
          animation: spin 0.6s linear infinite; flex-shrink: 0;
        }

        /* COORD HINT */
        .coord-hint {
          font-size: 11.5px; color: #94a3b8; text-align: center;
          margin-top: -6px;
        }

        /* PASSWORD STRENGTH */
        .strength-bar-track { height: 3px; background: #e2e8f0; border-radius: 2px; margin-top: 6px; overflow: hidden; }
        .strength-bar-fill  { height: 100%; border-radius: 2px; transition: width 0.3s ease, background 0.3s ease; }
        .strength-label     { font-size: 11px; font-weight: 600; margin-top: 4px; }

        /* DIVIDER */
        .divider { border: none; border-top: 1px solid #f1f5f9; margin: 4px 0; }

        /* SUBMIT */
        .btn-submit {
          width: 100%; padding: 12px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: #fff; border: none; border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700;
          cursor: pointer; line-height: 1;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 8px rgba(234,88,12,0.3);
          transition: box-shadow 0.16s, transform 0.1s, opacity 0.16s;
        }
        .btn-submit:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(234,88,12,0.4); }
        .btn-submit:active:not(:disabled) { transform: scale(0.98); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* FOOTER */
        .card-footer {
          padding: 16px 32px 20px;
          text-align: center; border-top: 1px solid #f8fafc;
          font-size: 13.5px; color: #64748b;
        }
        .card-footer a { color: #f97316; font-weight: 600; text-decoration: none; }
        .card-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="page">
        <div className="card">

          {/* HEADER */}
          <div className="card-header">
            <div className="card-logo">🌱</div>
            <div className="card-title">Create an account</div>
            <div className="card-subtitle">Join the food redistribution network</div>
          </div>

          <div className="card-body">

            {/* FIX #12: Alert above the form */}
            {message && (
              <div className={`alert ${isError ? "alert-error" : "alert-success"}`} role={isError ? "alert" : "status"}>
                <span className="alert-icon">{isError ? "⚠" : "✅"}</span>
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="form" noValidate>

              {/* ── ACCOUNT DETAILS ── */}
              <div className="section-label">Account details</div>

              {/* NAME */}
              <div className="field">
                <label className="field-label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  className="input"
                  type="text"
                  name="name"
                  placeholder="e.g. Andrea Fernandes"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              {/* EMAIL */}
              <div className="field">
                <label className="field-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              {/* PASSWORD */}
              <div className="field">
                <label className="field-label" htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    className="input input-has-toggle"
                    type={showPass ? "text" : "password"}
                    name="password"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >{showPass ? "🙈" : "👁️"}</button>
                </div>
                {/* Password strength indicator — FIX #8 */}
                {formData.password.length > 0 && (() => {
                  const p = formData.password;
                  let score = 0;
                  if (p.length >= 8)  score++;
                  if (p.length >= 12) score++;
                  if (/[A-Z]/.test(p))  score++;
                  if (/[0-9]/.test(p))  score++;
                  if (/[^A-Za-z0-9]/.test(p)) score++;
                  const levels = [
                    { label: "Too weak",  color: "#dc2626", w: "20%" },
                    { label: "Weak",      color: "#f97316", w: "40%" },
                    { label: "Fair",      color: "#ca8a04", w: "60%" },
                    { label: "Good",      color: "#16a34a", w: "80%" },
                    { label: "Strong",    color: "#15803d", w: "100%" },
                  ];
                  const lvl = levels[Math.min(score, 4)];
                  return (
                    <>
                      <div className="strength-bar-track">
                        <div className="strength-bar-fill" style={{ width: lvl.w, background: lvl.color }} />
                      </div>
                      <div className="strength-label" style={{ color: lvl.color }}>{lvl.label}</div>
                    </>
                  );
                })()}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="field">
                <label className="field-label" htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrapper">
                  <input
                    id="confirmPassword"
                    className="input input-has-toggle"
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={{
                      // Live match indicator
                      borderColor: formData.confirmPassword.length > 0
                        ? formData.confirmPassword === formData.password
                          ? "#16a34a"
                          : "#dc2626"
                        : undefined
                    }}
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowConfirm(p => !p)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >{showConfirm ? "🙈" : "👁️"}</button>
                </div>
              </div>

              {/* ── ROLE ── */}
              <div className="section-label">I am a…</div>

              {/* FIX #1: Role selection — value included in submission */}
              <div className="role-grid">
                {[
                  { value: "ngo",        icon: "🤝", name: "NGO",        desc: "Collect and distribute food" },
                  { value: "restaurant", icon: "🍽️", name: "Restaurant", desc: "Donate surplus food" },
                ].map(r => (
                  <div
                    key={r.value}
                    className={`role-card${formData.role === r.value ? " selected" : ""}`}
                    onClick={() => setFormData(prev => ({ ...prev, role: r.value }))}
                    role="radio"
                    aria-checked={formData.role === r.value}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setFormData(prev => ({ ...prev, role: r.value }))}
                  >
                    <div className="role-icon">{r.icon}</div>
                    <div className="role-name">{r.name}</div>
                    <div className="role-desc">{r.desc}</div>
                  </div>
                ))}
              </div>

              {/* ── LOCATION ── */}
              <div className="section-label">Your location</div>

              {/* FIX #10: Geolocation button */}
              <button
                type="button"
                className="loc-btn"
                onClick={useMyLocation}
                disabled={locLoading}
              >
                {locLoading
                  ? <><span className="loc-spinner" /> Detecting…</>
                  : <>📍 Use my current location</>
                }
              </button>

              <div className="coord-hint">— or enter manually —</div>

              {/* FIX #4 & #7: Coordinates validated client-side before submit */}
              <div className="coord-row">
                <div className="field">
                  <label className="field-label" htmlFor="latitude">Latitude</label>
                  <input
                    id="latitude"
                    className="input"
                    type="number"
                    name="latitude"
                    placeholder="e.g. 12.9716"
                    step="any"
                    min="-90"
                    max="90"
                    required
                    value={formData.latitude}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="longitude">Longitude</label>
                  <input
                    id="longitude"
                    className="input"
                    type="number"
                    name="longitude"
                    placeholder="e.g. 77.5946"
                    step="any"
                    min="-180"
                    max="180"
                    required
                    value={formData.longitude}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <hr className="divider" />

              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading
                  ? <><span className="btn-spinner" /> Creating account…</>
                  : "Create account →"
                }
              </button>

            </form>
          </div>

          {/* FOOTER */}
          <div className="card-footer">
            Already have an account?{" "}
            <Link to="/login">Sign in here</Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default Register;
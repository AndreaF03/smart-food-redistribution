import { useState, useEffect, useRef, useCallback } from "react";
import axios from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate  = useNavigate();
  const timerRef  = useRef(null);

  const [form, setForm] = useState({ name: "", email: "", location: "", password: "" });
  const [original, setOriginal] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get("/auth/me");
        const data = {
          name:     res.data.name     || "",
          email:    res.data.email    || "",
          location: res.data.location || "",
          password: "",
        };
        setForm(data);
        setOriginal(data);
      } catch { setError("Failed to load profile."); }
      finally   { setLoading(false); }
    };
    fetchProfile();
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const isDirty = form.name !== original.name ||
                  form.email !== original.email ||
                  form.location !== original.location ||
                  form.password !== "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name.trim())  { setError("Name cannot be empty.");         return; }
    if (!form.email.trim()) { setError("Email cannot be empty.");        return; }
    if (form.password && form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    try {
      setSaving(true);
      await axios.put("/auth/me", form);
      setSuccess("Profile updated successfully!");
      setOriginal({ ...form, password: "" });
      setForm(prev => ({ ...prev, password: "" }));
      timerRef.current = setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally { setSaving(false); }
  };

  const roleMeta = {
    restaurant: { icon: "🍴", label: "Restaurant" },
    ngo:        { icon: "🌱", label: "NGO" },
    admin:      { icon: "📊", label: "Admin" },
  };
  const role     = localStorage.getItem("role") || "";
  const userName = localStorage.getItem("userName") || form.name || "—";
  const rm       = roleMeta[role] || { icon: "👤", label: role };

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Loading profile…</p>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="page">

        <div className="shell">

          {/* ── BACK ── */}
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>

          {/* ── AVATAR CARD ── */}
          <div className="avatar-card">
            <div className="avatar">{(userName[0] || "?").toUpperCase()}</div>
            <div className="avatar-info">
              <div className="avatar-name">{userName}</div>
              <div className="avatar-role">
                <span>{rm.icon}</span>
                <span>{rm.label}</span>
              </div>
            </div>
          </div>

          {/* ── FORM CARD ── */}
          <div className="card">
            <div className="card-header">
              <h1 className="card-title">Profile Settings</h1>
              <p className="card-sub">Manage your account details</p>
            </div>

            <div className="card-body">

              {error && (
                <div className="flash error" role="alert">
                  <span>⚠</span><span>{error}</span>
                  <button onClick={() => setError("")}>×</button>
                </div>
              )}
              {success && (
                <div className="flash success" role="status">
                  <span>✅</span><span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>

                <div className="field-grid">

                  {/* NAME */}
                  <div className="field">
                    <label className="field-label" htmlFor="name">👤 Full Name</label>
                    <input
                      id="name" name="name" type="text"
                      className="field-input"
                      placeholder="Your name"
                      autoComplete="name"
                      value={form.name}
                      onChange={handleChange}
                    />
                  </div>

                  {/* EMAIL */}
                  <div className="field">
                    <label className="field-label" htmlFor="email">✉ Email Address</label>
                    <input
                      id="email" name="email" type="email"
                      className="field-input"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                    />
                  </div>

                  {/* LOCATION */}
                  <div className="field full">
                    <label className="field-label" htmlFor="location">📍 Location</label>
                    <input
                      id="location" name="location" type="text"
                      className="field-input"
                      placeholder="e.g. Bengaluru, Karnataka"
                      value={form.location}
                      onChange={handleChange}
                    />
                  </div>

                </div>

                {/* PASSWORD SECTION */}
                <div className="section-divider">
                  <span>Change Password</span>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="password">
                    🔒 New Password
                    <span className="field-hint">leave blank to keep current</span>
                  </label>
                  <div className="input-wrap">
                    <input
                      id="password" name="password"
                      type={showPass ? "text" : "password"}
                      className="field-input has-toggle"
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button" className="toggle-btn"
                      onClick={() => setShowPass(p => !p)}
                      aria-label={showPass ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >{showPass ? "🙈" : "👁"}</button>
                  </div>
                  {form.password && form.password.length < 6 && (
                    <div className="field-warn">⚠ At least 6 characters required</div>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="actions">
                  <button
                    type="button" className="btn ghost"
                    onClick={() => { setForm({ ...original, password: "" }); setError(""); }}
                    disabled={!isDirty || saving}
                  >↺ Reset</button>
                  <button
                    type="submit" className="btn primary"
                    disabled={!isDirty || saving}
                  >
                    {saving
                      ? <><span className="spinner" /> Saving…</>
                      : "Save Changes"
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
    --danger:   #f05252;
    --warn:     #f0b429;
    --radius:   14px;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  @keyframes fadeUp    { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes spin      { to { transform: rotate(360deg); } }

  /* ── LOADING ── */
  .loading-screen {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
  }
  .loading-spinner {
    width: 30px; height: 30px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  .loading-text { font-family: var(--font-mono); font-size: 12px; color: var(--muted); letter-spacing: .08em; }

  /* ── PAGE ── */
  .page {
    min-height: 100vh; display: flex;
    align-items: flex-start; justify-content: center;
    padding: 36px 20px 80px;
    background: var(--bg);
  }
  .shell { width: 100%; max-width: 540px; animation: fadeUp .3s ease; }

  /* ── BACK ── */
  .back-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-family: var(--font-mono); font-size: 12px;
    margin-bottom: 20px; padding: 0; transition: color .15s; letter-spacing: .04em;
  }
  .back-btn:hover { color: var(--text); }

  /* ── AVATAR CARD ── */
  .avatar-card {
    display: flex; align-items: center; gap: 16px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 22px;
    margin-bottom: 16px;
  }
  .avatar {
    width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(95,212,117,.25), rgba(96,180,240,.2));
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 20px; font-weight: 800; color: var(--accent);
  }
  .avatar-name { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
  .avatar-role {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 5px; padding: 3px 10px; border-radius: 20px;
    background: rgba(95,212,117,.1); border: 1px solid rgba(95,212,117,.2);
    font-family: var(--font-mono); font-size: 11px; color: var(--accent);
  }

  /* ── CARD ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; overflow: hidden;
  }
  .card-header {
    padding: 22px 28px 20px; border-bottom: 1px solid var(--border);
  }
  .card-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; }
  .card-sub   { font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-top: 4px; }
  .card-body  { padding: 24px 28px 28px; }

  /* ── FLASH ── */
  .flash {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
    font-size: 13.5px; font-weight: 500; margin-bottom: 20px;
    animation: slideDown .2s ease;
  }
  .flash button { background: none; border: none; cursor: pointer; font-size: 18px; opacity: .6; color: inherit; margin-left: auto; line-height: 1; }
  .flash.error   { background: rgba(240,82,82,.1);  color: var(--danger); border: 1px solid rgba(240,82,82,.25); }
  .flash.success { background: rgba(95,212,117,.1); color: var(--accent); border: 1px solid rgba(95,212,117,.25); }

  /* ── FIELD GRID ── */
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 0; }
  .field-grid .full { grid-column: 1 / -1; }
  @media (max-width: 480px) { .field-grid { grid-template-columns: 1fr; } }

  /* ── FIELD ── */
  .field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
  .field-grid .field { margin-bottom: 0; }

  .field-label {
    font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 7px;
  }
  .field-hint { font-family: var(--font-mono); font-size: 11px; color: var(--muted); font-weight: 400; }
  .field-warn { font-family: var(--font-mono); font-size: 11px; color: var(--warn); margin-top: -2px; }

  /* ── INPUTS ── */
  .input-wrap { position: relative; }
  .field-input {
    width: 100%; padding: 11px 14px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text);
    font-family: var(--font-body); font-size: 14px;
    outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(95,212,117,.1); }
  .field-input::placeholder { color: var(--muted); }
  .field-input.has-toggle { padding-right: 46px; }

  .toggle-btn {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--muted); font-size: 15px; line-height: 1;
    display: flex; align-items: center; transition: color .15s;
  }
  .toggle-btn:hover { color: var(--text); }

  /* ── SECTION DIVIDER ── */
  .section-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 24px 0 18px; color: var(--muted);
    font-family: var(--font-mono); font-size: 11px; letter-spacing: .06em;
    text-transform: uppercase;
  }
  .section-divider::before,
  .section-divider::after {
    content: ""; flex: 1; height: 1px; background: var(--border);
  }

  /* ── ACTIONS ── */
  .actions { display: flex; gap: 10px; margin-top: 8px; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 20px; border-radius: 10px; border: none;
    font-family: var(--font-body); font-size: 14px; font-weight: 600;
    cursor: pointer; transition: .15s; white-space: nowrap;
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn.primary {
    flex: 1; background: var(--accent); color: #0a120b;
    box-shadow: 0 2px 12px rgba(95,212,117,.25);
  }
  .btn.primary:hover:not(:disabled) { background: var(--accent2); }
  .btn.ghost {
    background: var(--surface2); color: var(--muted); border: 1px solid var(--border);
  }
  .btn.ghost:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }

  .spinner {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,.2); border-top-color: #0a120b;
    animation: spin .6s linear infinite; display: inline-block;
  }
`;
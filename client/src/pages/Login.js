import { useState, useEffect, useCallback, useRef } from "react";
import axios from "../api/axios";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

/* ============================================================
   HELPERS
============================================================ */
const getRolePath = (role) =>
  ({ restaurant: "/restaurant", ngo: "/ngo", admin: "/admin" })[role] || "/login";

/* ============================================================
   COMPONENT
============================================================ */
const Login = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Auto-redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) { localStorage.clear(); return; }
      navigate(getRolePath(decoded.role), { replace: true });
    } catch { localStorage.clear(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (loading) return;

    const email    = formData.email.trim().toLowerCase();
    const password = formData.password;
    if (!email || !password) { setError("Please enter your email and password."); return; }

    try {
      setLoading(true);
      const res = await axios.post("/auth/login", { email, password });
      const { token, role, user } = res.data;
      localStorage.setItem("token",    token);
      localStorage.setItem("role",     role);
      localStorage.setItem("userId",   user._id);
      localStorage.setItem("userName", user.name);
      setSuccess("Login successful! Redirecting…");
      timerRef.current = setTimeout(() => navigate(getRolePath(role), { replace: true }), 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="page">

        {/* ── AMBIENT ── */}
        <div className="ambient" aria-hidden="true">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
        </div>

        <div className="card">

          {/* ── HEADER ── */}
          <div className="card-header">
            <div className="brand">
              <div className="brand-icon">🌿</div>
              <span className="brand-name">FoodBridge</span>
            </div>
            <h1 className="card-title">Welcome back</h1>
            <p className="card-sub">Sign in to your account</p>
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
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* ── EMAIL ── */}
              <div className="field">
                <label className="field-label" htmlFor="email">Email address</label>
                <input
                  id="email" name="email" type="email"
                  className="field-input"
                  placeholder="you@example.com"
                  autoComplete="email" required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              {/* ── PASSWORD ── */}
              <div className="field">
                <div className="label-row">
                  <label className="field-label" htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                </div>
                <div className="input-wrap">
                  <input
                    id="password" name="password"
                    type={showPass ? "text" : "password"}
                    className="field-input has-toggle"
                    placeholder="••••••••"
                    autoComplete="current-password" required
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button" className="toggle-btn"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? <><span className="spinner" /> Signing in…</>
                  : "Sign in →"
                }
              </button>

            </form>
          </div>

          {/* ── FOOTER ── */}
          <div className="card-footer">
            Don't have an account? <Link to="/register" className="footer-link">Create one here</Link>
          </div>

        </div>
      </div>
    </>
  );
};

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
    --radius:   14px;
    --font-display: 'Syne', sans-serif;
    --font-body:    'Instrument Sans', sans-serif;
    --font-mono:    'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  @keyframes fadeUp    { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes shake     { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-5px); } 40%,80% { transform: translateX(5px); } }
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes drift     { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px, -20px) scale(1.05); } }

  /* ── PAGE ── */
  .page {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 24px 16px;
    background: var(--bg);
    position: relative; overflow: hidden;
  }

  /* ── AMBIENT ORBS ── */
  .ambient { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
  .ambient-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); opacity: .18;
    animation: drift 12s ease-in-out infinite;
  }
  .orb-1 { width: 400px; height: 400px; background: var(--accent); top: -100px; left: -100px; animation-delay: 0s; }
  .orb-2 { width: 300px; height: 300px; background: #60b4f0; bottom: -80px; right: -80px; animation-delay: 6s; }

  /* ── CARD ── */
  .card {
    position: relative; z-index: 1;
    width: 100%; max-width: 420px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 22px; overflow: hidden;
    animation: fadeUp .35s ease;
    box-shadow: 0 24px 60px rgba(0,0,0,.4);
  }

  /* ── HEADER ── */
  .card-header {
    padding: 30px 32px 24px;
    border-bottom: 1px solid var(--border);
    text-align: center;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 8px;
    margin-bottom: 18px;
  }
  .brand-icon { font-size: 20px; }
  .brand-name { font-family: var(--font-display); font-size: 15px; font-weight: 800; color: var(--accent); letter-spacing: -.01em; }
  .card-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--text); }
  .card-sub   { font-family: var(--font-mono); font-size: 12px; color: var(--muted); margin-top: 5px; letter-spacing: .04em; }

  /* ── BODY ── */
  .card-body { padding: 26px 32px 28px; }

  /* ── FLASH ── */
  .flash {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
    font-size: 13.5px; font-weight: 500; margin-bottom: 20px;
  }
  .flash button { background: none; border: none; cursor: pointer; font-size: 18px; opacity: .6; color: inherit; margin-left: auto; line-height: 1; }
  .flash.error   { background: rgba(240,82,82,.1); color: var(--danger); border: 1px solid rgba(240,82,82,.25); animation: slideDown .2s ease, shake .4s ease; }
  .flash.success { background: rgba(95,212,117,.1); color: var(--accent); border: 1px solid rgba(95,212,117,.25); animation: slideDown .2s ease; }

  /* ── FIELDS ── */
  .field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px; }
  .field-label { font-size: 13px; font-weight: 600; color: var(--text); }

  .label-row { display: flex; justify-content: space-between; align-items: center; }
  .forgot-link { font-family: var(--font-mono); font-size: 11px; color: var(--accent); text-decoration: none; letter-spacing: .03em; transition: color .15s; }
  .forgot-link:hover { color: var(--accent2); text-decoration: underline; }

  .input-wrap { position: relative; }

  .field-input {
    width: 100%; padding: 12px 14px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; color: var(--text);
    font-family: var(--font-body); font-size: 14px;
    outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(95,212,117,.12); }
  .field-input::placeholder { color: var(--muted); }
  .field-input.has-toggle { padding-right: 46px; }

  /* ── PASSWORD TOGGLE ── */
  .toggle-btn {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 4px;
    color: var(--muted); font-size: 15px; line-height: 1;
    display: flex; align-items: center; transition: color .15s;
  }
  .toggle-btn:hover { color: var(--text); }

  /* ── SUBMIT ── */
  .submit-btn {
    width: 100%; margin-top: 6px;
    padding: 13px;
    background: var(--accent); color: #0a120b;
    border: none; border-radius: 11px;
    font-family: var(--font-display); font-size: 15px; font-weight: 700;
    cursor: pointer; transition: .15s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 2px 14px rgba(95,212,117,.3);
  }
  .submit-btn:hover:not(:disabled) { background: var(--accent2); box-shadow: 0 4px 20px rgba(95,212,117,.4); }
  .submit-btn:active:not(:disabled) { transform: scale(0.98); }
  .submit-btn:disabled { opacity: .55; cursor: not-allowed; }

  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(0,0,0,.2); border-top-color: #0a120b;
    animation: spin .6s linear infinite; display: inline-block;
  }

  /* ── FOOTER ── */
  .card-footer {
    padding: 16px 32px 20px; text-align: center;
    border-top: 1px solid var(--border);
    font-size: 13px; color: var(--muted); font-family: var(--font-mono);
  }
  .footer-link { color: var(--accent); font-weight: 600; text-decoration: none; }
  .footer-link:hover { text-decoration: underline; color: var(--accent2); }
`;

export default Login;
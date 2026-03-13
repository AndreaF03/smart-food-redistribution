import { useState, useEffect, useCallback, useRef } from "react";
import axios from "../api/axios";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

/* ============================================================
   HELPERS
============================================================ */
const getRolePath = (role) => {
  const map = { restaurant: "/restaurant", ngo: "/ngo", admin: "/admin" };
  return map[role] || "/login";
};

/* ============================================================
   COMPONENT
============================================================ */
const Login = () => {
  const navigate  = useNavigate();
  const timerRef  = useRef(null); // FIX #2: track timeout for cleanup

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false); // FIX #8: show/hide password

  /* ----------------------------------------------------------
     FIX #2: Clear timeout on unmount
  ---------------------------------------------------------- */
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  /* ----------------------------------------------------------
     Auto-redirect if already logged in
     FIX #4: Run only on mount ([]) — no dependency on navigate
             or redirectByRole to avoid infinite loop risk
  ---------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.clear();
        return;
      }
      navigate(getRolePath(decoded.role), { replace: true });
    } catch {
      localStorage.clear();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------------
     FIX #3: Functional updater form — no stale closure issue
  ---------------------------------------------------------- */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  /* ----------------------------------------------------------
     Submit
  ---------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // FIX #10: Guard against double-submit
    if (loading) return;

    // FIX #6: Trim email before sending (not password — spaces can be intentional)
    const email    = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post("/auth/login", { email, password });

      const { token, role, user } = res.data;

      // FIX #1: Save userId and userName — required for Socket.io room joins
      localStorage.setItem("token",    token);
      localStorage.setItem("role",     role);
      localStorage.setItem("userId",   user._id);
      localStorage.setItem("userName", user.name);

      setSuccess("Login successful! Redirecting…");

      // FIX #2: Store ref so it can be cancelled on unmount
      timerRef.current = setTimeout(() => {
        navigate(getRolePath(role), { replace: true });
      }, 1000);

    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
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
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background: #f1f5f9;
        }

        .card {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          overflow: hidden;
          animation: fadeIn 0.35s ease;
        }

        /* HEADER */
        .card-header {
          padding: 28px 32px 24px;
          text-align: center;
          border-bottom: 1px solid #f1f5f9;
        }
        .card-logo {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          border-radius: 16px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 26px; margin-bottom: 14px;
        }
        .card-title    { font-size: 22px; font-weight: 700; color: #0f172a; }
        .card-subtitle { font-size: 13.5px; color: #94a3b8; margin-top: 4px; }

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

        /* FORM */
        .form  { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }

        .field-label {
          font-size: 13px; font-weight: 600; color: #374151;
        }

        .input-wrapper { position: relative; }

        .input {
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
        }
        .input:focus {
          border-color: #22c55e;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
        }
        .input::placeholder { color: #94a3b8; }
        .input-has-toggle   { padding-right: 46px; }

        /* SHOW PASSWORD TOGGLE */
        .toggle-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; padding: 4px;
          color: #94a3b8; font-size: 16px;
          line-height: 1; transition: color 0.15s;
          display: flex; align-items: center;
        }
        .toggle-btn:hover { color: #475569; }

        /* FORGOT PASSWORD */
        .forgot-row {
          display: flex; justify-content: flex-end;
          margin-top: -6px;
        }
        .forgot-link {
          font-size: 12.5px; color: #22c55e; font-weight: 500;
          text-decoration: none;
        }
        .forgot-link:hover { text-decoration: underline; }

        /* DIVIDER */
        .divider { border: none; border-top: 1px solid #f1f5f9; margin: 4px 0; }

        /* SUBMIT BUTTON */
        .btn-submit {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
          border: none; border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700;
          cursor: pointer; line-height: 1;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 2px 8px rgba(22,163,74,0.3);
          transition: box-shadow 0.16s, transform 0.1s, opacity 0.16s;
        }
        .btn-submit:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(22,163,74,0.4);
        }
        .btn-submit:active:not(:disabled) { transform: scale(0.98); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* FOOTER */
        .card-footer {
          padding: 16px 32px 20px;
          text-align: center;
          border-top: 1px solid #f8fafc;
          font-size: 13.5px; color: #64748b;
        }
        .card-footer a {
          color: #16a34a; font-weight: 600; text-decoration: none;
        }
        .card-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="page">
        <div className="card">

          {/* HEADER */}
          <div className="card-header">
            <div className="card-logo">🍽️</div>
            <div className="card-title">Welcome back</div>
            <div className="card-subtitle">Sign in to your account</div>
          </div>

          <div className="card-body">

            {/* FIX #7: Alerts above the form */}
            {error && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="alert alert-success" role="status">
                <span className="alert-icon">✅</span>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="form" noValidate>

              {/* EMAIL */}
              <div className="field">
                <label className="field-label" htmlFor="email">Email address</label>
                <div className="input-wrapper">
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
              </div>

              {/* PASSWORD */}
              <div className="field">
                <label className="field-label" htmlFor="password">Password</label>
                {/* FIX #8: Show/hide password toggle */}
                <div className="input-wrapper">
                  <input
                    id="password"
                    className="input input-has-toggle"
                    type={showPass ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
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
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* FIX #11: Forgot password link */}
              <div className="forgot-row">
                <Link to="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>

              <hr className="divider" />

              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading
                  ? <><span className="btn-spinner" /> Signing in…</>
                  : "Sign in →"
                }
              </button>

            </form>
          </div>

          {/* FOOTER */}
          <div className="card-footer">
            Don't have an account?{" "}
            <Link to="/register">Create one here</Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default Login;
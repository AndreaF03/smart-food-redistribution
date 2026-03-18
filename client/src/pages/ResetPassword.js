import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "../api/axios";

export default function ResetPassword() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const timerRef   = useRef(null);

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /* Auto-redirect countdown after success */
  useEffect(() => {
    if (!success) return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); navigate("/login", { replace: true }); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [success, navigate]);

  /* Password strength */
  const strength = (() => {
    if (!password) return null;
    if (password.length < 6)  return { label: "Too short",  color: "var(--danger)", w: "20%" };
    if (password.length < 8)  return { label: "Weak",       color: "var(--warn)",   w: "45%" };
    if (password.length < 12) return { label: "Good",       color: "#60b4f0",       w: "70%" };
    return                           { label: "Strong",      color: "var(--accent)", w: "100%" };
  })();

  const mismatch = confirm && password !== confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match.");                  return; }
    if (!token)                { setError("Invalid reset link.");                      return; }
    try {
      setLoading(true);
      await axios.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="page">

        <div className="ambient" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
        </div>

        <div className="shell">
          <div className="card">

            {/* HEADER */}
            <div className="card-header">
              <div className="brand">
                <span>🌿</span>
                <span className="brand-name">FoodBridge</span>
              </div>
              <div className="header-icon">{success ? "✅" : "🔑"}</div>
              <h1 className="card-title">{success ? "Password Reset!" : "Set New Password"}</h1>
              <p className="card-sub">
                {success
                  ? `Redirecting to login in ${countdown}s…`
                  : "Choose a strong password for your account"}
              </p>
            </div>

            <div className="card-body">

              {/* SUCCESS */}
              {success ? (
                <div className="success-state">
                  <div className="success-ring">✓</div>
                  <p className="success-msg">Your password has been updated successfully.</p>
                  <div className="countdown-bar">
                    <div className="countdown-fill" style={{ animationDuration: "3s" }} />
                  </div>
                  <Link to="/login" className="btn primary" style={{ textDecoration: "none", marginTop: 4 }}>
                    Go to Login →
                  </Link>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="flash error" role="alert">
                      <span>⚠</span>
                      <span>{error}</span>
                      <button onClick={() => setError("")}>×</button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate>

                    {/* NEW PASSWORD */}
                    <div className="field">
                      <label className="field-label" htmlFor="password">🔒 New Password</label>
                      <div className="input-wrap">
                        <input
                          id="password"
                          type={showPass ? "text" : "password"}
                          className="field-input has-toggle"
                          placeholder="Min. 6 characters"
                          autoComplete="new-password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                        <button type="button" className="toggle-btn"
                          onClick={() => setShowPass(p => !p)}
                          aria-label={showPass ? "Hide" : "Show"} tabIndex={-1}>
                          {showPass ? "🙈" : "👁"}
                        </button>
                      </div>
                      {strength && (
                        <div className="strength-wrap">
                          <div className="strength-track">
                            <div className="strength-fill" style={{ width: strength.w, background: strength.color }} />
                          </div>
                          <span className="strength-label" style={{ color: strength.color }}>{strength.label}</span>
                        </div>
                      )}
                    </div>

                    {/* CONFIRM PASSWORD */}
                    <div className="field">
                      <label className="field-label" htmlFor="confirm">🔒 Confirm Password</label>
                      <div className="input-wrap">
                        <input
                          id="confirm"
                          type={showConf ? "text" : "password"}
                          className={`field-input has-toggle ${mismatch ? "input-error" : ""}`}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          value={confirm}
                          onChange={e => setConfirm(e.target.value)}
                        />
                        <button type="button" className="toggle-btn"
                          onClick={() => setShowConf(p => !p)}
                          aria-label={showConf ? "Hide" : "Show"} tabIndex={-1}>
                          {showConf ? "🙈" : "👁"}
                        </button>
                      </div>
                      {mismatch && <span className="field-warn">⚠ Passwords do not match</span>}
                      {confirm && !mismatch && password.length >= 6 && (
                        <span className="field-ok">✓ Passwords match</span>
                      )}
                    </div>

                    <button
                      type="submit" className="btn primary"
                      disabled={loading || !!mismatch || password.length < 6}
                    >
                      {loading ? <><span className="spinner" /> Resetting…</> : "Reset Password →"}
                    </button>

                  </form>
                </>
              )}
            </div>

            {!success && (
              <div className="card-footer">
                Remembered it? <Link to="/login" className="footer-link">Back to Login</Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0e100f; --surface: #161a18; --surface2: #1e2420; --border: #2a3028;
    --text: #e8ede9; --muted: #7a8c7e; --accent: #5fd475; --accent2: #a8f0b4;
    --danger: #f05252; --warn: #f0b429;
    --font-display: 'Syne', sans-serif;
    --font-body: 'Instrument Sans', sans-serif;
    --font-mono: 'DM Mono', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--font-body); }

  @keyframes fadeUp    { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
  @keyframes spin      { to { transform:rotate(360deg); } }
  @keyframes drift     { 0%,100%{transform:translate(0,0);} 50%{transform:translate(20px,-15px);} }
  @keyframes popIn     { 0%{transform:scale(.6);opacity:0;} 80%{transform:scale(1.08);} 100%{transform:scale(1);opacity:1;} }
  @keyframes shrink    { from{width:100%;} to{width:0%;} }

  .page {
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px 16px; position:relative; overflow:hidden;
  }
  .ambient { position:fixed; inset:0; pointer-events:none; z-index:0; }
  .orb {
    position:absolute; border-radius:50%; filter:blur(90px); opacity:.14;
    animation:drift 14s ease-in-out infinite;
  }
  .orb-1 { width:380px; height:380px; background:var(--accent); top:-100px; left:-100px; }
  .orb-2 { width:280px; height:280px; background:#60b4f0; bottom:-70px; right:-70px; animation-delay:7s; }

  .shell { position:relative; z-index:1; width:100%; max-width:420px; animation:fadeUp .35s ease; }
  .card {
    background:var(--surface); border:1px solid var(--border);
    border-radius:22px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.4);
  }

  .card-header { padding:28px 32px 22px; border-bottom:1px solid var(--border); text-align:center; }
  .brand { display:inline-flex; align-items:center; gap:7px; margin-bottom:16px; font-size:18px; }
  .brand-name { font-family:var(--font-display); font-size:14px; font-weight:800; color:var(--accent); }
  .header-icon { font-size:36px; margin-bottom:10px; display:block; }
  .card-title { font-family:var(--font-display); font-size:21px; font-weight:700; }
  .card-sub { font-family:var(--font-mono); font-size:12px; color:var(--muted); margin-top:5px; }

  .card-body { padding:26px 32px 28px; }

  .flash {
    display:flex; align-items:flex-start; gap:10px;
    padding:12px 14px; border-radius:10px;
    font-size:13.5px; font-weight:500; margin-bottom:20px;
    animation:slideDown .2s ease;
  }
  .flash button { background:none; border:none; cursor:pointer; font-size:18px; opacity:.6; color:inherit; margin-left:auto; line-height:1; }
  .flash.error { background:rgba(240,82,82,.1); color:var(--danger); border:1px solid rgba(240,82,82,.25); }

  .field { display:flex; flex-direction:column; gap:7px; margin-bottom:18px; }
  .field-label { font-size:13px; font-weight:600; color:var(--text); }
  .input-wrap { position:relative; }
  .field-input {
    width:100%; padding:12px 14px;
    background:var(--surface2); border:1px solid var(--border);
    border-radius:10px; color:var(--text);
    font-family:var(--font-body); font-size:14px;
    outline:none; transition:border-color .15s, box-shadow .15s;
  }
  .field-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(95,212,117,.1); }
  .field-input::placeholder { color:var(--muted); }
  .field-input.has-toggle { padding-right:46px; }
  .field-input.input-error { border-color:var(--danger)!important; box-shadow:0 0 0 3px rgba(240,82,82,.1)!important; }

  .toggle-btn {
    position:absolute; right:12px; top:50%; transform:translateY(-50%);
    background:none; border:none; cursor:pointer; padding:4px;
    color:var(--muted); font-size:15px; line-height:1;
    display:flex; align-items:center; transition:color .15s;
  }
  .toggle-btn:hover { color:var(--text); }

  .field-warn { font-family:var(--font-mono); font-size:11px; color:var(--danger); }
  .field-ok   { font-family:var(--font-mono); font-size:11px; color:var(--accent); }

  .strength-wrap { display:flex; align-items:center; gap:10px; }
  .strength-track { flex:1; height:4px; background:var(--border); border-radius:99px; overflow:hidden; }
  .strength-fill { height:100%; border-radius:99px; transition:width .4s ease, background .3s ease; }
  .strength-label { font-family:var(--font-mono); font-size:11px; font-weight:500; white-space:nowrap; }

  .btn {
    width:100%; padding:13px; display:flex; align-items:center; justify-content:center; gap:8px;
    border:none; border-radius:11px;
    font-family:var(--font-display); font-size:15px; font-weight:700;
    cursor:pointer; transition:.15s;
  }
  .btn:active:not(:disabled) { transform:scale(0.98); }
  .btn:disabled { opacity:.45; cursor:not-allowed; }
  .btn.primary { background:var(--accent); color:#0a120b; box-shadow:0 2px 14px rgba(95,212,117,.3); }
  .btn.primary:hover:not(:disabled) { background:var(--accent2); box-shadow:0 4px 20px rgba(95,212,117,.4); }

  .spinner {
    width:14px; height:14px; border-radius:50%;
    border:2px solid rgba(0,0,0,.2); border-top-color:#0a120b;
    animation:spin .6s linear infinite; display:inline-block;
  }

  .success-state { display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; padding:8px 0 4px; }
  .success-ring {
    width:64px; height:64px; border-radius:50%;
    background:rgba(95,212,117,.15); border:2px solid rgba(95,212,117,.4);
    display:flex; align-items:center; justify-content:center;
    font-size:26px; color:var(--accent);
    animation:popIn .4s cubic-bezier(.34,1.56,.64,1) both;
  }
  .success-msg { font-size:14px; color:var(--muted); max-width:280px; line-height:1.6; }
  .countdown-bar { width:100%; height:3px; background:var(--border); border-radius:99px; overflow:hidden; }
  .countdown-fill { height:100%; background:var(--accent); border-radius:99px; animation:shrink linear forwards; }

  .card-footer {
    padding:15px 32px 18px; border-top:1px solid var(--border);
    text-align:center; font-family:var(--font-mono); font-size:12px; color:var(--muted);
  }
  .footer-link { color:var(--accent); text-decoration:none; font-weight:600; }
  .footer-link:hover { text-decoration:underline; color:var(--accent2); }
`;
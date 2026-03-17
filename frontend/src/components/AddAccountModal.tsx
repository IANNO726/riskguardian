import { useState, useEffect, useRef } from "react";

// ─── Deriv server patterns (mirrors accounts_multi.py) ───────
const DERIV_SERVERS = [
  "deriv-demo","deriv-server","deriv-real",
  "derivsvg-server","derivsvg-demo",
  "derivmx-server","derivmx-demo","deriv.com",
];
const isDerivServer = (s) => DERIV_SERVERS.some(p => s.toLowerCase().includes(p));
const isDerivBroker = (b) => b.toLowerCase().includes("deriv");
const isDerivAccount = (broker, server) => isDerivBroker(broker) || isDerivServer(server);

// ─── Steps for Deriv token guide ─────────────────────────────
const DERIV_STEPS = [
  {
    icon: "🌐",
    title: "Open Deriv",
    desc: "Go to app.deriv.com and make sure you're logged in",
    action: { label: "Open Deriv →", url: "https://app.deriv.com/account/api-token" },
  },
  {
    icon: "👤",
    title: "Go to API Token",
    desc: 'Click your profile icon → Settings → "Security & privacy" → API Token',
  },
  {
    icon: "✏️",
    title: "Create a token",
    desc: 'Name it "RiskGuardian", enable Read + Trading information scopes, click Create',
  },
  {
    icon: "📋",
    title: "Copy & paste here",
    desc: "Copy the token and paste it in the Password field below",
  },
];

export default function AddAccountModal({ onClose, onSuccess }) {
  const [platform, setPlatform] = useState("MT5");
  const [broker, setBroker]     = useState("");
  const [server, setServer]     = useState("");
  const [login, setLogin]       = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [guideStep, setGuideStep] = useState(0);
  const [guideVisible, setGuideVisible] = useState(false);
  const [pulsing, setPulsing]   = useState(false);
  const intervalRef = useRef(null);

  const isDerivMode = isDerivAccount(broker, server);

  // Auto-show guide when Deriv is detected
  useEffect(() => {
    if (isDerivMode) {
      setGuideVisible(true);
      setPulsing(true);
      setTimeout(() => setPulsing(false), 1200);
    } else {
      setGuideVisible(false);
    }
  }, [isDerivMode]);

  // Auto-cycle guide steps
  useEffect(() => {
    if (guideVisible) {
      intervalRef.current = setInterval(() => {
        setGuideStep(s => (s + 1) % DERIV_STEPS.length);
      }, 3500);
    }
    return () => clearInterval(intervalRef.current);
  }, [guideVisible]);

  const handleSubmit = async () => {
    if (!login || !server || !broker || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";
      const res = await fetch("/api/v1/accounts-multi/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform,
          account_number: login,
          broker_name: broker,
          server,
          password,
          account_name: nickname || `${broker} - ${login}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to connect account");
      onSuccess && onSuccess(data);
      onClose && onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const step = DERIV_STEPS[guideStep];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .aam-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(5,8,20,0.85);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: aam-fade-in 0.25s ease;
        }
        @keyframes aam-fade-in { from { opacity:0 } to { opacity:1 } }

        .aam-card {
          width: 100%; max-width: 520px;
          background: linear-gradient(145deg, #0d1117 0%, #111827 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          font-family: 'DM Sans', sans-serif;
          animation: aam-slide-up 0.3s cubic-bezier(.16,1,.3,1);
        }
        @keyframes aam-slide-up {
          from { transform: translateY(32px); opacity:0 }
          to   { transform: translateY(0);    opacity:1 }
        }

        /* Header */
        .aam-header {
          padding: 28px 28px 0;
          display: flex; justify-content: space-between; align-items: flex-start;
        }
        .aam-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: #fff; letter-spacing: -0.5px;
          margin: 0 0 4px;
        }
        .aam-subtitle { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; }
        .aam-close {
          background: rgba(255,255,255,0.06); border: none;
          color: rgba(255,255,255,0.5); font-size: 18px;
          width: 36px; height: 36px; border-radius: 10px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .aam-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

        /* Platform tabs */
        .aam-tabs {
          display: flex; gap: 8px;
          margin: 20px 28px 0;
          background: rgba(255,255,255,0.04);
          padding: 4px; border-radius: 12px;
        }
        .aam-tab {
          flex: 1; padding: 9px;
          border: none; border-radius: 9px;
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px;
          color: rgba(255,255,255,0.4); background: transparent;
        }
        .aam-tab.active {
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          color: #fff;
          box-shadow: 0 4px 12px rgba(99,102,241,0.4);
        }

        /* Body */
        .aam-body { padding: 20px 28px 28px; }

        /* Deriv guide banner */
        .aam-guide {
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 20px;
          border: 1px solid rgba(251,191,36,0.2);
          background: linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(245,158,11,0.03) 100%);
          animation: aam-guide-in 0.4s cubic-bezier(.16,1,.3,1);
        }
        @keyframes aam-guide-in {
          from { opacity:0; transform: translateY(-8px) scale(0.98) }
          to   { opacity:1; transform: translateY(0) scale(1) }
        }
        .aam-guide.pulsing {
          animation: aam-guide-in 0.4s cubic-bezier(.16,1,.3,1), aam-pulse 0.6s ease 0.4s;
        }
        @keyframes aam-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0) }
          50%      { box-shadow: 0 0 0 6px rgba(251,191,36,0.15) }
        }

        .aam-guide-header {
          padding: 12px 16px;
          background: rgba(251,191,36,0.1);
          display: flex; align-items: center; gap: 8px;
          border-bottom: 1px solid rgba(251,191,36,0.12);
        }
        .aam-guide-badge {
          background: linear-gradient(135deg, #f59e0b, #fbbf24);
          color: #000; font-family: 'Syne', sans-serif;
          font-size: 10px; font-weight: 800; letter-spacing: 1px;
          padding: 2px 8px; border-radius: 20px;
        }
        .aam-guide-header-text {
          font-size: 12px; color: rgba(251,191,36,0.9); font-weight: 500;
        }

        .aam-guide-body { padding: 16px; }
        .aam-guide-step {
          display: flex; gap: 14px; align-items: flex-start;
          animation: aam-step-in 0.35s cubic-bezier(.16,1,.3,1);
        }
        @keyframes aam-step-in {
          from { opacity:0; transform: translateX(8px) }
          to   { opacity:1; transform: translateX(0) }
        }
        .aam-step-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(251,191,36,0.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .aam-step-num {
          font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 800;
          color: rgba(251,191,36,0.5); letter-spacing: 1px; margin-bottom: 2px;
        }
        .aam-step-title {
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          color: #fff; margin-bottom: 3px;
        }
        .aam-step-desc { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.5; }
        .aam-step-action {
          display: inline-flex; align-items: center; gap: 4px;
          margin-top: 8px; padding: 5px 12px;
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.3);
          border-radius: 20px; color: #fbbf24;
          font-size: 12px; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
        }
        .aam-step-action:hover { background: rgba(251,191,36,0.25); color: #fde68a; }

        .aam-guide-dots {
          display: flex; justify-content: center; gap: 6px; padding: 12px 16px 14px;
          border-top: 1px solid rgba(255,255,255,0.04);
        }
        .aam-dot {
          width: 6px; height: 6px; border-radius: 3px;
          background: rgba(255,255,255,0.15);
          transition: all 0.3s; cursor: pointer;
        }
        .aam-dot.active { width: 18px; background: #fbbf24; }

        /* Fields */
        .aam-field { margin-bottom: 14px; }
        .aam-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
          color: rgba(255,255,255,0.35); text-transform: uppercase;
          margin-bottom: 6px;
        }
        .aam-label-badge {
          background: rgba(99,102,241,0.2); color: #818cf8;
          font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
          padding: 1px 6px; border-radius: 4px; text-transform: uppercase;
        }
        .aam-label-badge.deriv { background: rgba(251,191,36,0.15); color: #fbbf24; }

        .aam-input-wrap { position: relative; }
        .aam-input {
          width: 100%; padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; color: #fff;
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          outline: none; transition: all 0.2s; box-sizing: border-box;
        }
        .aam-input::placeholder { color: rgba(255,255,255,0.2); }
        .aam-input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .aam-input.deriv-token:focus {
          border-color: rgba(251,191,36,0.4);
          background: rgba(251,191,36,0.04);
          box-shadow: 0 0 0 3px rgba(251,191,36,0.08);
        }
        .aam-input.has-right { padding-right: 44px; }

        .aam-input-right {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.3); font-size: 16px; padding: 4px;
          transition: color 0.2s;
        }
        .aam-input-right:hover { color: rgba(255,255,255,0.7); }

        /* Token hint */
        .aam-token-hint {
          margin-top: 8px; padding: 10px 12px;
          background: rgba(251,191,36,0.06);
          border: 1px dashed rgba(251,191,36,0.2);
          border-radius: 10px;
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: rgba(251,191,36,0.7);
          animation: aam-guide-in 0.3s ease;
        }
        .aam-token-hint a { color: #fbbf24; font-weight: 600; text-decoration: none; }
        .aam-token-hint a:hover { text-decoration: underline; }

        /* Row */
        .aam-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* Error */
        .aam-error {
          padding: 10px 14px; border-radius: 10px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
          color: #fca5a5; font-size: 13px; margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }

        /* Submit */
        .aam-submit {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          border: none; border-radius: 14px;
          color: #fff; font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700; letter-spacing: 0.3px;
          cursor: pointer; transition: all 0.25s;
          box-shadow: 0 8px 24px rgba(99,102,241,0.35);
          position: relative; overflow: hidden;
        }
        .aam-submit.deriv-mode {
          background: linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%);
          box-shadow: 0 8px 24px rgba(251,191,36,0.3);
          color: #000;
        }
        .aam-submit:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
        .aam-submit:active:not(:disabled) { transform: translateY(0); }
        .aam-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .aam-submit-inner {
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .aam-spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }
        .aam-spinner.dark { border-color: rgba(0,0,0,0.2); border-top-color: #000; }
        @keyframes spin { to { transform: rotate(360deg) } }

        /* Security note */
        .aam-security {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          margin-top: 14px; font-size: 11px; color: rgba(255,255,255,0.25);
        }

        /* Detected badge */
        .aam-detected {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          background: rgba(251,191,36,0.12);
          border: 1px solid rgba(251,191,36,0.25);
          color: #fbbf24; font-size: 11px; font-weight: 600;
          margin-left: 8px;
          animation: aam-guide-in 0.3s ease;
        }
        .aam-detected-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #fbbf24;
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <div className="aam-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
        <div className="aam-card">

          {/* Header */}
          <div className="aam-header">
            <div>
              <p className="aam-title">
                Connect Account
                {isDerivMode && (
                  <span className="aam-detected">
                    <span className="aam-detected-dot" />
                    Deriv detected
                  </span>
                )}
              </p>
              <p className="aam-subtitle">
                {isDerivMode
                  ? "We'll connect via Deriv's secure WebSocket API"
                  : "Live verified before saving — your data stays encrypted"}
              </p>
            </div>
            <button className="aam-close" onClick={onClose}>✕</button>
          </div>

          {/* Platform tabs */}
          <div className="aam-tabs">
            {["MT5","MT4"].map(p => (
              <button
                key={p}
                className={`aam-tab${platform === p ? " active" : ""}`}
                onClick={() => setPlatform(p)}
              >
                {p === "MT5" ? "⑤ MT5" : "④ MT4"}
              </button>
            ))}
          </div>

          <div className="aam-body">

            {/* ── Deriv guide ─────────────────────────────── */}
            {guideVisible && (
              <div className={`aam-guide${pulsing ? " pulsing" : ""}`}>
                <div className="aam-guide-header">
                  <span className="aam-guide-badge">DERIV DETECTED</span>
                  <span className="aam-guide-header-text">
                    Use an API token instead of your MT5 password
                  </span>
                </div>
                <div className="aam-guide-body">
                  <div className="aam-guide-step" key={guideStep}>
                    <div className="aam-step-icon">{step.icon}</div>
                    <div>
                      <div className="aam-step-num">STEP {guideStep + 1} OF {DERIV_STEPS.length}</div>
                      <div className="aam-step-title">{step.title}</div>
                      <div className="aam-step-desc">{step.desc}</div>
                      {step.action && (
                        <a
                          className="aam-step-action"
                          href={step.action.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {step.action.label}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="aam-guide-dots">
                  {DERIV_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`aam-dot${i === guideStep ? " active" : ""}`}
                      onClick={() => { setGuideStep(i); clearInterval(intervalRef.current); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Fields */}
            <div className="aam-row">
              <div className="aam-field">
                <label className="aam-label">Account Number</label>
                <input
                  className="aam-input"
                  placeholder="e.g. 40979584"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                />
              </div>
              <div className="aam-field">
                <label className="aam-label">Broker Server</label>
                <input
                  className="aam-input"
                  placeholder="e.g. Deriv-Demo"
                  value={server}
                  onChange={e => setServer(e.target.value)}
                />
              </div>
            </div>

            <div className="aam-row">
              <div className="aam-field">
                <label className="aam-label">Broker Name</label>
                <input
                  className="aam-input"
                  placeholder="e.g. Deriv, FTMO"
                  value={broker}
                  onChange={e => setBroker(e.target.value)}
                />
              </div>
              <div className="aam-field">
                <label className="aam-label">Nickname <span style={{color:"rgba(255,255,255,0.2)",fontWeight:400}}>(optional)</span></label>
                <input
                  className="aam-input"
                  placeholder="e.g. My Demo"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                />
              </div>
            </div>

            <div className="aam-field">
              <label className="aam-label">
                {isDerivMode ? (
                  <>
                    Deriv API Token
                    <span className="aam-label-badge deriv">⚡ Required for Deriv</span>
                  </>
                ) : (
                  <>Password <span className="aam-label-badge">MT5 main or investor</span></>
                )}
              </label>
              <div className="aam-input-wrap">
                <input
                  className={`aam-input has-right${isDerivMode ? " deriv-token" : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder={
                    isDerivMode
                      ? "Paste your Deriv API token here..."
                      : "Your MT5 main or investor password"
                  }
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button className="aam-input-right" onClick={() => setShowPass(v => !v)}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>

              {isDerivMode && (
                <div className="aam-token-hint">
                  <span>🔑</span>
                  <span>
                    Get your token at{" "}
                    <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noreferrer">
                      app.deriv.com → API Token
                    </a>
                    {" "}— enable <strong>Read</strong> + <strong>Trading information</strong> scopes
                  </span>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="aam-error">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              className={`aam-submit${isDerivMode ? " deriv-mode" : ""}`}
              onClick={handleSubmit}
              disabled={loading}
            >
              <div className="aam-submit-inner">
                {loading ? (
                  <>
                    <div className={`aam-spinner${isDerivMode ? " dark" : ""}`} />
                    {isDerivMode ? "Connecting via WebSocket..." : "Verifying with MT5..."}
                  </>
                ) : (
                  <>
                    {isDerivMode ? "⚡ Connect Deriv Account →" : "🔒 Connect & Verify →"}
                  </>
                )}
              </div>
            </button>

            <div className="aam-security">
              🔐 Encrypted end-to-end · Never stored in plain text · Read-only access
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
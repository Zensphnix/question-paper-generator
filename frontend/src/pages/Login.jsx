import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { ShieldCheck, KeyRound, Lock } from "lucide-react";
import BloomPyramid from "../components/BloomPyramid.jsx";
import SealMark from "../components/SealMark.jsx";
import {
  login, register, verifyOtp, resendOtp, googleAuth, requestLoginOtp,
  forgotPassword, resetPassword,
} from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login({ onAuth }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("login");                    // "login" | "register"
  const [loginMethod, setLoginMethod] = useState("password");   // "password" | "otp"
  const [step, setStep] = useState("form");                     // "form" | "otp" | "forgot"
  const [forgotStage, setForgotStage] = useState("request");    // "request" | "reset"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  function finishAuth(result) {
    // The session itself now lives in an HttpOnly cookie the server just set
    // on this response — nothing sensitive to store here. We only cache the
    // display-only user object so the UI has something to show immediately.
    localStorage.setItem("authUser:v1", JSON.stringify(result.user));
    onAuth(result.user);
  }

  // Memoized so the effect below can safely list it as a dependency without
  // re-running (and restarting the retry timer) on every unrelated render.
  const handleGoogleCredential = useCallback(async (response) => {
    setError(""); setLoading(true);
    try {
      const result = await googleAuth(response.credential);
      finishAuth(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== "form" || !GOOGLE_CLIENT_ID) return;

    function renderButton() {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", width: 320, text: "continue_with",
      });
    }

    // Common case: Google's script (loaded via a <script defer> in index.html)
    // is usually already available by the time this mounts — check once
    // immediately so there's no artificial delay before the button appears.
    if (window.google?.accounts?.id && googleBtnRef.current) {
      renderButton();
      return;
    }

    // Fallback: script hasn't loaded yet, poll briefly until it has.
    // setInterval (not a recursive setTimeout) so the timer handle lives
    // directly in this effect's scope — the cleanup below references it in
    // one obvious line instead of threading a flag through a nested helper.
    let attempts = 0;
    const intervalId = setInterval(() => {
      attempts += 1;
      if (window.google?.accounts?.id && googleBtnRef.current) {
        clearInterval(intervalId);
        renderButton();
      } else if (attempts >= 25) {
        clearInterval(intervalId);
      }
    }, 150);

    return () => clearInterval(intervalId);
  }, [step, mode, handleGoogleCredential]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo("");
    setLoading(true);
    try {
      let result;
      if (mode === "register") {
        result = await register(name, email, password);
      } else if (loginMethod === "otp") {
        result = await requestLoginOtp(email);
      } else {
        result = await login(email, password);
      }

      if (result.otp_required) {
        setInfo(result.message);
        setStep("otp");
      } else {
        finishAuth(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await verifyOtp(email, otp);
      finishAuth(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(""); setInfo("");
    try {
      const result = loginMethod === "otp" && mode === "login"
        ? await requestLoginOtp(email)
        : await resendOtp(email);
      setInfo(result.message);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleForgotRequest(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const result = await forgotPassword(email);
      setInfo(result.message);
      setForgotStage("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotReset(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await resetPassword(email, otp, newPassword);
      finishAuth(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function backToLogin() {
    setStep("form"); setForgotStage("request"); setError(""); setInfo("");
    setOtp(""); setNewPassword("");
  }

  const submitLabel = loading
    ? t("pleaseWait")
    : mode === "register"
      ? t("createAccount")
      : loginMethod === "otp"
        ? t("sendCode")
        : t("logIn");

  const inputClass = "w-full box-border px-4 py-3.5 rounded-[10px] border text-[15px] outline-none transition-colors";
  const inputStyle = { borderColor: "#e2dbc8", background: "#fdfcf9", color: "#1c1a17" };

  return (
    <div className="min-h-screen grid md:grid-cols-[1.05fr_1fr] bg-cream">
      {/* Left — brand panel */}
      <div className="hidden md:flex relative flex-col overflow-hidden px-16 py-[72px]"
        style={{ background: "linear-gradient(160deg,#0b0f16 0%,#141b26 55%,#0d1218 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 20% 0%, rgba(184,147,76,0.10), transparent 55%)" }} />

        <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex items-center gap-3.5 relative">
          <SealMark size={44} radius={13} />
          <span className="font-serif text-xl" style={{ color: "#f3ede2" }}>
            QPaper <em className="not-italic italic" style={{ color: "#d4b876" }}>AI</em>
          </span>
        </m.div>

        <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-auto relative">
          <div className="font-sans text-[11px] uppercase mb-[22px]" style={{ letterSpacing: "0.18em", color: "#8a8f9a" }}>
            Assessment intelligence
          </div>
          <h1 className="font-serif font-normal text-[56px] leading-[1.12] mb-7" style={{ color: "#f3ede2" }}>
            Every question,<br /><em className="italic" style={{ color: "#d4b876" }}>a measure of thought.</em>
          </h1>
          <p className="font-sans text-base leading-[1.7] max-w-[420px] mb-12" style={{ color: "#a9aebb" }}>
            Built on Bloom's Taxonomy — the six-level framework examiners have relied on
            for seventy years to test understanding, not memory.
          </p>
          <BloomPyramid width={280} />
        </m.div>
      </div>

      {/* Right — form panel */}
      <div className="flex items-center justify-center px-4 py-12 bg-cream relative">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          <div className="flex items-center gap-3 justify-center mb-8 md:hidden">
            <SealMark size={36} radius={11} />
            <span className="font-serif text-lg" style={{ color: "#1c1a17" }}>
              QPaper <em className="italic" style={{ color: "#b8934c" }}>AI</em>
            </span>
          </div>

          <div className="bg-white rounded-[20px] p-9"
            style={{
              borderTop: "2px solid #b8934c",
              boxShadow: "0 1px 2px rgba(28,26,23,0.04), 0 24px 48px -12px rgba(28,26,23,0.12)",
            }}>
            <AnimatePresence mode="wait">
              {step === "form" && (
                <m.div key="form" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                  <div className="flex rounded-xl p-1 mb-8" style={{ background: "#efe8da" }}>
                    <button type="button"
                      onClick={() => { setMode("login"); setError(""); }}
                      className="flex-1 py-[11px] rounded-lg font-sans text-sm font-semibold transition-all"
                      style={mode === "login"
                        ? { background: "#fff", color: "#1c1a17", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                        : { background: "transparent", color: "#8a8474" }}
                    >
                      {t("logIn")}
                    </button>
                    <button type="button"
                      onClick={() => { setMode("register"); setError(""); }}
                      className="flex-1 py-[11px] rounded-lg font-sans text-sm font-semibold transition-all"
                      style={mode === "register"
                        ? { background: "#fff", color: "#1c1a17", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                        : { background: "transparent", color: "#8a8474" }}
                    >
                      {t("register")}
                    </button>
                  </div>

                  <form onSubmit={handleSubmit}>
                    {mode === "register" && (
                      <div className="mb-[22px]">
                        <label htmlFor="login-name" className="block font-sans text-xs font-semibold uppercase mb-2"
                          style={{ letterSpacing: "0.06em", color: "#75705f" }}>{t("nameLabel")}</label>
                        <input id="login-name" required value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Shashi Kumar" className={inputClass} style={inputStyle}
                          onFocus={(e) => { e.target.style.borderColor = "#b8934c"; e.target.style.boxShadow = "0 0 0 3px rgba(184,147,76,0.15)"; e.target.style.background = "#fff"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#e2dbc8"; e.target.style.boxShadow = "none"; e.target.style.background = "#fdfcf9"; }}
                        />
                      </div>
                    )}

                    <div className="mb-[22px]">
                      <label htmlFor="login-email" className="block font-sans text-xs font-semibold uppercase mb-2"
                        style={{ letterSpacing: "0.06em", color: "#75705f" }}>{t("emailLabel")}</label>
                      <input id="login-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@college.edu" className={inputClass} style={{ ...inputStyle, paddingRight: 44 }}
                        onFocus={(e) => { e.target.style.borderColor = "#b8934c"; e.target.style.boxShadow = "0 0 0 3px rgba(184,147,76,0.15)"; e.target.style.background = "#fff"; }}
                        onBlur={(e) => { e.target.style.borderColor = "#e2dbc8"; e.target.style.boxShadow = "none"; e.target.style.background = "#fdfcf9"; }}
                      />
                    </div>

                    {!(mode === "login" && loginMethod === "otp") && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center gap-3 mb-2">
                          <label htmlFor="login-password" className="font-sans text-xs font-semibold uppercase whitespace-nowrap"
                            style={{ letterSpacing: "0.06em", color: "#75705f" }}>{t("passwordLabel")}</label>
                          {mode === "login" && loginMethod === "password" && (
                            <button type="button"
                              onClick={() => { setStep("forgot"); setError(""); setInfo(""); }}
                              className="font-sans text-[12.5px] whitespace-nowrap hover:underline" style={{ color: "#7a3340" }}
                            >
                              {t("forgotPassword")}
                            </button>
                          )}
                        </div>
                        <input id="login-password" required type="password" minLength={6} value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••" className={inputClass} style={{ ...inputStyle, paddingRight: 44 }}
                          onFocus={(e) => { e.target.style.borderColor = "#b8934c"; e.target.style.boxShadow = "0 0 0 3px rgba(184,147,76,0.15)"; e.target.style.background = "#fff"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#e2dbc8"; e.target.style.boxShadow = "none"; e.target.style.background = "#fdfcf9"; }}
                        />
                      </div>
                    )}

                    {mode === "login" && (
                      <button type="button"
                        onClick={() => { setLoginMethod((m) => (m === "password" ? "otp" : "password")); setError(""); }}
                        className="flex items-center gap-1.5 font-sans text-[13px] mb-2 hover:underline" style={{ color: "#7a3340" }}
                      >
                        <KeyRound size={12} />
                        {loginMethod === "password" ? t("useOtpInstead") : t("usePasswordInstead")}
                      </button>
                    )}

                    {error && <p className="text-sm mb-2" style={{ color: "#7a3340" }}>{error}</p>}

                    <m.button
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}
                      type="submit" disabled={loading}
                      className="w-full py-4 rounded-[10px] font-serif italic text-base disabled:opacity-50 mt-1"
                      style={{
                        background: "linear-gradient(180deg,#2a1c20,#180f12)", color: "#f3ede2",
                        boxShadow: "0 8px 20px rgba(24,15,18,0.25)", letterSpacing: "0.02em",
                      }}
                    >
                      {submitLabel}
                    </m.button>
                  </form>

                  {GOOGLE_CLIENT_ID && (
                    <>
                      <div className="flex items-center gap-3.5 my-[26px]">
                        <div className="flex-1 h-px" style={{ background: "#e2dbc8" }} />
                        <span className="font-sans text-xs" style={{ color: "#a39c86" }}>{t("or")}</span>
                        <div className="flex-1 h-px" style={{ background: "#e2dbc8" }} />
                      </div>
                      <div ref={googleBtnRef} className="flex justify-center" />
                    </>
                  )}
                </m.div>
              )}

              {step === "otp" && (
                <m.div key="otp" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={18} style={{ color: "#b8934c" }} />
                    <h2 className="font-serif text-lg" style={{ color: "#1c1a17" }}>{t("verifyYourEmail")}</h2>
                  </div>
                  <p className="font-sans text-sm mb-1" style={{ color: "#8a8474" }}>
                    Enter the 6-digit code for <span className="font-semibold" style={{ color: "#1c1a17" }}>{email}</span>.
                  </p>
                  <p className="font-sans text-xs mb-5" style={{ color: "#8a6d1f" }}>
                    Didn't get an email? Check your spam folder, or check the backend logs if this is a fresh setup.
                  </p>

                  <form onSubmit={handleVerify} className="space-y-4">
                    <input
                      required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric" maxLength={6}
                      className={inputClass + " text-center text-lg font-mono"}
                      style={{ ...inputStyle, letterSpacing: "0.5em", paddingLeft: 8, paddingRight: 8 }}
                      placeholder="000000"
                    />
                    {info && <p className="text-sm" style={{ color: "#2f6b4c" }}>{info}</p>}
                    {error && <p className="text-sm" style={{ color: "#7a3340" }}>{error}</p>}

                    <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading || otp.length !== 6}
                      className="w-full py-4 rounded-[10px] font-serif italic text-base disabled:opacity-50"
                      style={{ background: "linear-gradient(180deg,#2a1c20,#180f12)", color: "#f3ede2", boxShadow: "0 8px 20px rgba(24,15,18,0.25)" }}>
                      {loading ? t("pleaseWait") : "Verify & continue"}
                    </m.button>

                    <div className="flex justify-between text-xs">
                      <button type="button" onClick={backToLogin} className="hover:underline" style={{ color: "#a39c86" }}>Back</button>
                      <button type="button" onClick={handleResend} className="hover:underline" style={{ color: "#7a3340" }}>Resend code</button>
                    </div>
                  </form>
                </m.div>
              )}

              {step === "forgot" && (
                <m.div key="forgot" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={18} style={{ color: "#b8934c" }} />
                    <h2 className="font-serif text-lg" style={{ color: "#1c1a17" }}>{t("resetYourPassword")}</h2>
                  </div>

                  {forgotStage === "request" ? (
                    <>
                      <p className="font-sans text-sm mb-5" style={{ color: "#8a8474" }}>
                        Enter your account email — we'll send a code to reset your password.
                      </p>
                      <form onSubmit={handleForgotRequest} className="space-y-4">
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                          className={inputClass} style={inputStyle} placeholder="you@college.edu" />
                        {error && <p className="text-sm" style={{ color: "#7a3340" }}>{error}</p>}
                        <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
                          className="w-full py-4 rounded-[10px] font-serif italic text-base disabled:opacity-50"
                          style={{ background: "linear-gradient(180deg,#2a1c20,#180f12)", color: "#f3ede2", boxShadow: "0 8px 20px rgba(24,15,18,0.25)" }}>
                          {loading ? t("pleaseWait") : t("sendResetCode")}
                        </m.button>
                        <button type="button" onClick={backToLogin} className="text-xs hover:underline" style={{ color: "#a39c86" }}>
                          {t("backToLogin")}
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <p className="font-sans text-sm mb-5" style={{ color: "#8a8474" }}>
                        Enter the code sent to <span className="font-semibold" style={{ color: "#1c1a17" }}>{email}</span> and choose a new password.
                      </p>
                      <form onSubmit={handleForgotReset} className="space-y-4">
                        <input required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric" maxLength={6}
                          className={inputClass + " text-center text-lg font-mono"}
                          style={{ ...inputStyle, letterSpacing: "0.5em" }} placeholder="000000" />
                        <input required type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          className={inputClass} style={inputStyle} placeholder="New password" />
                        {info && <p className="text-sm" style={{ color: "#2f6b4c" }}>{info}</p>}
                        {error && <p className="text-sm" style={{ color: "#7a3340" }}>{error}</p>}
                        <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} type="submit" disabled={loading || otp.length !== 6}
                          className="w-full py-4 rounded-[10px] font-serif italic text-base disabled:opacity-50"
                          style={{ background: "linear-gradient(180deg,#2a1c20,#180f12)", color: "#f3ede2", boxShadow: "0 8px 20px rgba(24,15,18,0.25)" }}>
                          {loading ? t("pleaseWait") : t("resetPasswordAndLogin")}
                        </m.button>
                        <button type="button" onClick={backToLogin} className="text-xs hover:underline" style={{ color: "#a39c86" }}>
                          {t("backToLogin")}
                        </button>
                      </form>
                    </>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center font-sans text-xs mt-[26px] leading-relaxed" style={{ color: "#a39c86" }}>
            {t("agreeToTerms")}{" "}
            <Link to="/terms" className="hover:underline" style={{ color: "#7a3340" }}>{t("terms")}</Link> {t("and")}{" "}
            <Link to="/privacy" className="hover:underline" style={{ color: "#7a3340" }}>{t("privacyPolicy")}</Link>.
          </p>
        </m.div>
      </div>
    </div>
  );
}

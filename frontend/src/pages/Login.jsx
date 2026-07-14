import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, KeyRound } from "lucide-react";
import { login, register, verifyOtp, resendOtp, googleAuth, requestLoginOtp } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login({ onAuth }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("login");         // "login" | "register"
  const [loginMethod, setLoginMethod] = useState("password"); // "password" | "otp" (login mode only)
  const [step, setStep] = useState("form");           // "form" | "otp"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  function finishAuth(result) {
    localStorage.setItem("authToken", result.access_token);
    localStorage.setItem("authUser", JSON.stringify(result.user));
    onAuth(result.user);
  }

  async function handleGoogleCredential(response) {
    setError(""); setLoading(true);
    try {
      const result = await googleAuth(response.credential);
      finishAuth(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Render Google's own button once its script + our client ID are ready.
  useEffect(() => {
    if (step !== "form" || !GOOGLE_CLIENT_ID) return;
    let attempts = 0;

    function tryRender() {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline", size: "large", width: 320, text: "continue_with",
        });
      } else if (attempts < 25) {
        attempts += 1;
        setTimeout(tryRender, 150);
      }
    }
    tryRender();
  }, [step, mode]);

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

  const submitLabel = loading
    ? "Please wait..."
    : mode === "register"
      ? "Create account"
      : loginMethod === "otp"
        ? t("sendCode")
        : "Log in";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, type: "spring" }}
          className="flex items-center gap-3 justify-center mb-8"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white leading-tight">QPaper AI</p>
            <p className="text-xs text-slate-400">Premium Workspace</p>
          </div>
        </motion.div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-7">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div key="form" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg mb-6">
                  <button
                    onClick={() => { setMode("login"); setError(""); }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                      mode === "login" ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"
                    }`}
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => { setMode("register"); setError(""); }}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                      mode === "register" ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"
                    }`}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "register" && (
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Name</label>
                      <input
                        required value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm"
                        placeholder="Shashi Kumar"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t("emailLabel")}</label>
                    <input
                      required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm"
                      placeholder="you@college.edu"
                    />
                  </div>

                  {!(mode === "login" && loginMethod === "otp") && (
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t("passwordLabel")}</label>
                      <input
                        required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  )}

                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setLoginMethod((m) => (m === "password" ? "otp" : "password")); setError(""); }}
                      className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline"
                    >
                      <KeyRound size={12} />
                      {loginMethod === "password" ? t("useOtpInstead") : t("usePasswordInstead")}
                    </button>
                  )}

                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
                    {submitLabel}
                  </motion.button>
                </form>

                {GOOGLE_CLIENT_ID && (
                  <>
                    <div className="flex items-center gap-3 my-5">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      <span className="text-xs text-slate-400">or</span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    </div>
                    <div ref={googleBtnRef} className="flex justify-center" />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={18} className="text-violet-500" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">{t("verifyYourEmail")}</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Enter the 6-digit code for <span className="font-medium">{email}</span>.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-5">
                  If email isn't set up on the backend yet, check the <strong>backend terminal</strong> for the code instead.
                </p>

                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" maxLength={6}
                    className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2.5 text-center text-lg tracking-[0.5em] font-mono"
                    placeholder="000000"
                  />

                  {info && <p className="text-emerald-600 text-sm">{info}</p>}
                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={loading || otp.length !== 6}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
                    {loading ? "Verifying..." : "Verify & continue"}
                  </motion.button>

                  <div className="flex justify-between text-xs">
                    <button type="button" onClick={() => setStep("form")} className="text-slate-400 hover:underline">
                      Back
                    </button>
                    <button type="button" onClick={handleResend} className="text-violet-600 hover:underline">
                      Resend code
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Single-user demo project — your data stays on your own machine.
        </p>
      </motion.div>
    </div>
  );
}

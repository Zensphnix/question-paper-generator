import { useEffect, useState, useRef } from "react";
import { AlertCircle, X, Mail } from "lucide-react";
import { subscribeToErrors } from "../services/errorBus.js";

const SUPPORT_EMAIL = "zensphnix@gmail.com";

/**
 * Mount once near the app root. Covers the error categories ErrorBoundary
 * structurally can't: errors thrown in event handlers (onClick, onChange),
 * errors in setTimeout/async code, unhandled promise rejections, and network
 * failures reported by the api.js fetch wrapper (e.g. "Failed to fetch" when
 * the backend is unreachable — the exact error users have hit repeatedly).
 */
export default function GlobalErrorHandler() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    function show(detail) {
      setToast(detail);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), 9000);
    }

    function onWindowError(event) {
      show({ message: event.message || "An unexpected error occurred", source: "runtime" });
    }
    function onUnhandledRejection(event) {
      const msg = event.reason?.message || String(event.reason) || "An unexpected error occurred";
      show({ message: msg, source: "promise" });
    }
    const unsubscribe = subscribeToErrors(show);

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  const mailBody = encodeURIComponent(
    `I ran into an error on QPaper AI.\n\nWhat I was doing: \n\nError details: ${toast.message}`
  );

  return (
    <div className="fixed bottom-5 right-5 z-[100] max-w-sm w-full bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl shadow-paper-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="text-burgundy shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-inkscale-800 dark:text-white">Something went wrong</p>
          <p className="text-xs text-inkscale-400 mt-0.5 truncate">{toast.message}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("QPaper AI — error report")}&body=${mailBody}`}
            className="inline-flex items-center gap-1.5 text-xs text-burgundy hover:underline mt-2"
          >
            <Mail size={12} /> Contact support about this
          </a>
        </div>
        <button type="button" onClick={() => setToast(null)} className="text-inkscale-300 hover:text-inkscale-500 shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

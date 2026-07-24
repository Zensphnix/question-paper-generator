import { Component } from "react";
import { AlertTriangle, RefreshCw, Mail, ChevronDown } from "lucide-react";

const SUPPORT_EMAIL = "zensphnix@gmail.com";

/**
 * Catches JavaScript errors anywhere in the component tree below it during
 * rendering, lifecycle methods, and constructors — this is what turns a
 * crashed component into the blank white screen users have hit before,
 * instead of a page that just stops updating with no explanation.
 *
 * Note: error boundaries do NOT catch errors in event handlers or async code
 * (that's what GlobalErrorHandler.jsx is for) — React's own limitation, not
 * an oversight here.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Kept local (console) rather than auto-sent anywhere — no telemetry
    // pipeline exists in this app, and it shouldn't silently phone home.
    console.error("Caught by ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const errorText = this.state.error?.message || "Unknown error";
    const mailBody = encodeURIComponent(
      `I ran into an error on QPaper AI.\n\nWhat I was doing: \n\nError details: ${errorText}`
    );

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream-soft dark:bg-inkscale-900">
        <div className="max-w-md w-full bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-2xl shadow-paper-lg p-7 text-center">
          <div className="w-12 h-12 rounded-full bg-burgundy/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} className="text-burgundy" />
          </div>
          <h1 className="font-serif text-xl text-inkscale-800 dark:text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-inkscale-500 dark:text-inkscale-300 mb-6">
            This page hit an unexpected error. Your data is safe — try reloading, and if it keeps happening,
            let us know and we'll take a look.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button" onClick={this.handleReload}
              className="flex items-center justify-center gap-2 bg-inkscale-800 dark:bg-white dark:text-inkscale-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              <RefreshCw size={15} /> Reload the app
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("QPaper AI — error report")}&body=${mailBody}`}
              className="flex items-center justify-center gap-2 border border-inkscale-200 dark:border-white/10 text-inkscale-700 dark:text-inkscale-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-inkscale-50 dark:hover:bg-white/5 transition"
            >
              <Mail size={15} /> Contact support about this
            </a>
          </div>

          <button
            type="button"
            onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
            className="flex items-center gap-1 text-xs text-inkscale-300 hover:text-inkscale-500 mx-auto mt-5"
          >
            <ChevronDown size={12} className={this.state.showDetails ? "rotate-180" : ""} />
            Technical details
          </button>
          {this.state.showDetails && (
            <pre className="mt-2 text-left text-[11px] text-inkscale-400 bg-inkscale-50 dark:bg-white/5 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {errorText}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, domMax, MotionConfig } from "framer-motion";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import GlobalErrorHandler from "./components/GlobalErrorHandler.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import "./index.css";

// LazyMotion + domMax: loads Framer Motion's animation engine as one shared
// chunk instead of every file that imports `motion` bundling its own copy —
// this is why every component below uses `m.div` etc. instead of `motion.div`.
// domMax (not the smaller domAnimation) because GeneratePaper's question list
// uses the `layout` prop, which needs domMax's layout-projection support.
//
// MotionConfig reducedMotion="user": automatically respects the OS-level
// "reduce motion" accessibility setting (macOS/Windows/iOS/Android all have
// one). Without this, every animation in the app — page transitions, dropdowns,
// the dashboard's staggered cards — plays at full motion even for people who've
// explicitly told their device they get dizzy/disoriented from it. This is a
// real WCAG 2.3.3 requirement, not just a nice-to-have.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <LanguageProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <GlobalErrorHandler />
          </LanguageProvider>
        </BrowserRouter>
      </MotionConfig>
    </LazyMotion>
  </React.StrictMode>
);

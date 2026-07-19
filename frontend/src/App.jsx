import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, m } from "framer-motion";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Footer from "./components/Footer.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import UploadNotes from "./pages/UploadNotes.jsx";
import GeneratePaper from "./pages/GeneratePaper.jsx";
import GeneratedPapers from "./pages/GeneratedPapers.jsx";
import QuestionBank from "./pages/QuestionBank.jsx";
import Support from "./pages/Support.jsx";
import Admin from "./pages/Admin.jsx";
import Settings from "./pages/Settings.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import { getMe, logout } from "./services/api.js";
import { useLanguage } from "./context/useLanguage.js";

function Page({ children }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
    >
      {children}
    </m.div>
  );
}

function AuthenticatedApp({ user, darkMode, setDarkMode, handleLogout, handleUserUpdate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  const pageMeta = {
    "/": { title: t("dashboard") },
    "/upload": { title: t("uploadNotes") },
    "/generate": { title: t("generatePaper") },
    "/questions": { title: t("questionBank") },
    "/papers": { title: t("generatedPapers") },
    "/support": { title: t("support") },
    "/admin": { title: "Owner Dashboard" },
    "/settings": { title: t("settings") },
  };

  useEffect(() => {
    setSidebarOpen(false); // close mobile drawer on every navigation
  }, [location.pathname]);

  const meta = pageMeta[location.pathname] || pageMeta["/"];

  return (
    <div className="flex bg-cream-soft dark:bg-inkscale-900 min-h-screen">
      <Sidebar
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={meta.title}
          subtitle={location.pathname === "/" ? `${t("welcomeBack")}, ${user.name.split(" ")[0]}` : undefined}
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="p-4 sm:p-8 flex-1">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><Dashboard /></Page>} />
              <Route path="/upload" element={<Page><UploadNotes /></Page>} />
              <Route path="/generate" element={<Page><GeneratePaper /></Page>} />
              <Route path="/questions" element={<Page><QuestionBank /></Page>} />
              <Route path="/papers" element={<Page><GeneratedPapers /></Page>} />
              <Route path="/support" element={<Page><Support /></Page>} />
              <Route path="/admin" element={<Page><Admin /></Page>} />
              <Route path="/settings" element={<Page><Settings user={user} onUserUpdate={handleUserUpdate} /></Page>} />
            </Routes>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    // No token to check in localStorage anymore — the HttpOnly cookie (if any)
    // is sent automatically by the browser, so we just try getMe() and let a
    // 401 mean "not logged in" rather than pre-checking a token ourselves.
    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("authUser:v1");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // even if the network call fails, clear local UI state so the user
      // isn't stuck looking logged-in
    }
    setUser(null);
  }

  function handleUserUpdate(updatedUser) {
    localStorage.setItem("authUser:v1", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  return (
    <Routes>
      {/* Public, always accessible regardless of login state */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Everything else requires auth */}
      <Route
        path="/*"
        element={
          checkingSession ? (
            <div className="min-h-screen flex items-center justify-center bg-inkscale-50 dark:bg-inkscale-900">
              <p className="text-sm text-inkscale-300">Loading...</p>
            </div>
          ) : !user ? (
            <Login onAuth={setUser} />
          ) : (
            <AuthenticatedApp
              user={user}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              handleLogout={handleLogout}
              handleUserUpdate={handleUserUpdate}
            />
          )
        }
      />
    </Routes>
  );
}

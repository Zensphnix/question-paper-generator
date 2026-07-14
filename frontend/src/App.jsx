import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import UploadNotes from "./pages/UploadNotes.jsx";
import GeneratePaper from "./pages/GeneratePaper.jsx";
import GeneratedPapers from "./pages/GeneratedPapers.jsx";
import QuestionBank from "./pages/QuestionBank.jsx";
import Support from "./pages/Support.jsx";
import Admin from "./pages/Admin.jsx";
import Settings from "./pages/Settings.jsx";
import { getMe } from "./services/api.js";
import { useLanguage } from "./context/LanguageContext.jsx";

function Page({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
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
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    setSidebarOpen(false); // close mobile drawer on every navigation
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setCheckingSession(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLogout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    setUser(null);
  }

  function handleUserUpdate(updatedUser) {
    localStorage.setItem("authUser", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onAuth={setUser} />;
  }

  const meta = pageMeta[location.pathname] || pageMeta["/"];

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 min-h-screen">
      <Sidebar
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0">
        <Topbar
          title={meta.title}
          subtitle={location.pathname === "/" ? `${t("welcomeBack")}, ${user.name.split(" ")[0]}` : undefined}
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="p-4 sm:p-8">
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
      </div>
    </div>
  );
}

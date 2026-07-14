import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Bell, Settings, LogOut, FileText, FolderPlus, FileQuestion, Menu, CornerDownRight } from "lucide-react";
import { getActivity, searchQuestions, listPapers, resolveAvatarUrl } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const dropdownMotion = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.15, ease: "easeOut" },
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function Topbar({ title, subtitle, user, onLogout, onMenuClick }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // ---- Global search ----
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matchedQuestions, setMatchedQuestions] = useState([]);
  const [matchedPapers, setMatchedPapers] = useState([]);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Ctrl/Cmd+K focuses the search box, like the hint on screen suggests
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setMatchedQuestions([]);
      setMatchedPapers([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [questions, papers] = await Promise.all([
          searchQuestions({ search: query }),
          listPapers(),
        ]);
        setMatchedQuestions(questions.slice(0, 5));
        setMatchedPapers(
          papers.filter((p) => p.paper_name.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
        );
      } catch {
        setMatchedQuestions([]);
        setMatchedPapers([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  function goToQuestions() {
    setSearchOpen(false);
    navigate(`/questions?q=${encodeURIComponent(query)}`);
  }

  function goToPapers() {
    setSearchOpen(false);
    navigate("/papers");
  }

  function openNotifications() {
    setNotifOpen((v) => !v);
    setProfileOpen(false);
    if (!notifOpen) getActivity().then(setActivity).catch(() => setActivity([]));
  }

  const hasResults = matchedQuestions.length > 0 || matchedPapers.length > 0;

  return (
    <header className="relative flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="md:hidden shrink-0 text-slate-500 dark:text-slate-300 p-1">
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white truncate">{title}</h1>
          {subtitle && <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 text-sm w-64">
            <Search size={15} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            <span className="text-[10px] border border-slate-300 dark:border-white/10 rounded px-1.5 py-0.5">Ctrl K</span>
          </div>

          <AnimatePresence>
            {searchOpen && query.trim().length >= 2 && (
              <motion.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                {searching && <p className="text-sm text-slate-400 px-4 py-4 text-center">{t("searching")}</p>}

                {!searching && !hasResults && (
                  <p className="text-sm text-slate-400 px-4 py-4 text-center">{t("noResults")}</p>
                )}

                {!searching && matchedQuestions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase px-4 pt-3 pb-1">{t("questionsMatch")}</p>
                    {matchedQuestions.map((q) => (
                      <button key={q.id} onClick={goToQuestions}
                        className="w-full flex items-start gap-2.5 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5">
                        <FileQuestion size={14} className="text-violet-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">{q.question}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && matchedPapers.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-white/10">
                    <p className="text-[11px] font-medium text-slate-400 uppercase px-4 pt-3 pb-1">{t("papersMatch")}</p>
                    {matchedPapers.map((p) => (
                      <button key={p.id} onClick={goToPapers}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5">
                        <FolderPlus size={14} className="text-fuchsia-500 shrink-0" />
                        <span className="text-xs text-slate-700 dark:text-slate-300">{p.paper_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={openNotifications}
            className="relative w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-300">
            <Bell size={16} />
            {activity.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-fuchsia-500 text-[10px] text-white flex items-center justify-center">
                {activity.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{t("recentActivity")}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {activity.length === 0 && (
                    <p className="text-sm text-slate-400 px-4 py-6 text-center">{t("nothingYet")}</p>
                  )}
                  {activity.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 ${a.type === "reply" ? "bg-violet-50/60 dark:bg-violet-500/5" : ""}`}>
                      {a.type === "reply" ? (
                        <CornerDownRight size={15} className="text-violet-500 mt-0.5 shrink-0" />
                      ) : a.type === "paper" ? (
                        <FolderPlus size={15} className="text-violet-500 mt-0.5 shrink-0" />
                      ) : (
                        <FileText size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{a.text}</p>
                        <p className="text-[11px] text-slate-400">{timeAgo(a.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {resolveAvatarUrl(user?.avatar_url) ? (
              <img src={resolveAvatarUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              initials(user?.name)
            )}
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <button onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                  <Settings size={15} /> {t("settings")}
                </button>
                <button onClick={() => { setProfileOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <LogOut size={15} /> {t("logOut")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "framer-motion";
import { Search, Bell, Settings, LogOut, FileText, FolderPlus, FileQuestion, Menu, CornerDownRight } from "lucide-react";
import { getActivity, searchQuestions, listPapers, resolveAvatarUrl } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

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
    <header className="relative flex items-center justify-between px-4 sm:px-11 py-4 sm:py-9" style={{ background: "var(--page-bg)" }}>
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={onMenuClick} aria-label="Open menu" className="md:hidden shrink-0 text-inkscale-400 dark:text-inkscale-200 p-1">
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-[26px] truncate" style={{ color: "var(--text-primary)" }}>{title}</h1>
          {subtitle && <p className="hidden sm:block font-sans text-sm mt-1" style={{ color: "var(--text-faint)" }}>{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3.5">
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] text-sm w-[260px]"
            style={{ background: "var(--surface)", border: "1px solid var(--surface-border)" }}>
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              aria-label={t("searchPlaceholder")}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            <span className="font-sans text-[10.5px] rounded px-1.5 py-0.5 shrink-0" style={{ color: "#c2bba8", border: "1px solid #e6e0d1" }}>⌘K</span>
          </div>

          <AnimatePresence>
            {searchOpen && query.trim().length >= 2 && (
              <m.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                {searching && <p className="text-sm text-inkscale-300 px-4 py-4 text-center">{t("searching")}</p>}

                {!searching && !hasResults && (
                  <p className="text-sm text-inkscale-300 px-4 py-4 text-center">{t("noResults")}</p>
                )}

                {!searching && matchedQuestions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-inkscale-300 uppercase px-4 pt-3 pb-1">{t("questionsMatch")}</p>
                    {matchedQuestions.map((q) => (
                      <button type="button" key={q.id} onClick={goToQuestions}
                        className="w-full flex items-start gap-2.5 px-4 py-2 text-left hover:bg-inkscale-50 dark:hover:bg-white/5">
                        <FileQuestion size={14} className="text-burgundy mt-0.5 shrink-0" />
                        <span className="text-xs text-inkscale-600 dark:text-inkscale-200 line-clamp-2">{q.question}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!searching && matchedPapers.length > 0 && (
                  <div className="border-t border-inkscale-50 dark:border-white/10">
                    <p className="text-[11px] font-medium text-inkscale-300 uppercase px-4 pt-3 pb-1">{t("papersMatch")}</p>
                    {matchedPapers.map((p) => (
                      <button type="button" key={p.id} onClick={goToPapers}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-inkscale-50 dark:hover:bg-white/5">
                        <FolderPlus size={14} className="text-gold shrink-0" />
                        <span className="text-xs text-inkscale-600 dark:text-inkscale-200">{p.paper_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button type="button" onClick={openNotifications}
            className="relative w-9 h-9 rounded-lg bg-inkscale-50 dark:bg-white/5 flex items-center justify-center text-inkscale-400 dark:text-inkscale-200">
            <Bell size={16} />
            {activity.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-[10px] text-white flex items-center justify-center">
                {activity.length}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <m.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-inkscale-50 dark:border-white/10">
                  <p className="text-sm font-medium text-inkscale-800 dark:text-white">{t("recentActivity")}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {activity.length === 0 && (
                    <p className="text-sm text-inkscale-300 px-4 py-6 text-center">{t("nothingYet")}</p>
                  )}
                  {activity.map((a) => (
                    <div key={a.id} className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-inkscale-50 dark:hover:bg-white/5 ${a.type === "reply" ? "bg-burgundy/5/60 dark:bg-burgundy/5" : ""}`}>
                      {a.type === "reply" ? (
                        <CornerDownRight size={15} className="text-burgundy mt-0.5 shrink-0" />
                      ) : a.type === "paper" ? (
                        <FolderPlus size={15} className="text-burgundy mt-0.5 shrink-0" />
                      ) : (
                        <FileText size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-inkscale-600 dark:text-inkscale-200 truncate">{a.text}</p>
                        <p className="text-[11px] text-inkscale-300">{timeAgo(a.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button type="button" onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="w-9 h-9 rounded-full p-[1.5px] shrink-0" style={{ background: "linear-gradient(135deg,#e8cd93,#7a3340)" }}>
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold"
              style={{ background: "#3a2b1c", color: "#f3ede2" }}>
              {resolveAvatarUrl(user?.avatar_url) ? (
                <img src={resolveAvatarUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </div>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <m.div {...dropdownMotion}
                className="absolute right-0 mt-2 w-52 bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-inkscale-50 dark:border-white/10">
                  <p className="text-sm font-medium text-inkscale-800 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-inkscale-300">{user?.email}</p>
                </div>
                <button type="button" onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-inkscale-500 dark:text-inkscale-200 hover:bg-inkscale-50 dark:hover:bg-white/5">
                  <Settings size={15} /> {t("settings")}
                </button>
                <button type="button" onClick={() => { setProfileOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <LogOut size={15} /> {t("logOut")}
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

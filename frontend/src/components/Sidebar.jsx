import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  FolderOpen,
  BookOpen,
  LifeBuoy,
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  Sparkles,
  X,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { resolveAvatarUrl } from "../services/api.js";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ user, size = "w-8 h-8" }) {
  const src = resolveAvatarUrl(user?.avatar_url);
  if (src) {
    return <img src={src} alt="" className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-xs font-semibold text-white shrink-0`}>
      {initials(user?.name)}
    </div>
  );
}

export default function Sidebar({ darkMode, onToggleDark, user, isOpen, onClose }) {
  const { t } = useLanguage();

  const navItems = [
    { to: "/", label: t("dashboard"), icon: LayoutDashboard, end: true },
    { to: "/upload", label: t("uploadNotes"), icon: UploadCloud },
    { to: "/generate", label: t("generatePaper"), icon: FileText },
    { to: "/questions", label: t("questionBank"), icon: BookOpen },
    { to: "/papers", label: t("generatedPapers"), icon: FolderOpen },
    { to: "/support", label: t("support"), icon: LifeBuoy },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Owner", icon: ShieldCheck }] : []),
    { to: "/settings", label: t("settings"), icon: Settings },
  ];

  const content = (
    <>
      {/* Brand */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-white font-semibold text-sm">QPaper AI</p>
            <p className="text-[11px] text-slate-500">Premium Workspace</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* User */}
      <div className="mx-4 mt-4 mb-2 px-3 py-3 rounded-xl bg-white/5 flex items-center gap-3">
        <Avatar user={user} />
        <div className="leading-tight min-w-0">
          <p className="text-white text-sm font-medium truncate">{user?.name || "..."}</p>
          <p className="text-[11px] text-slate-500 capitalize">{user?.role || ""}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <motion.div key={to} whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }}>
            <NavLink
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-3 border-t border-white/10">
        <button
          onClick={onToggleDark}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10 transition"
        >
          <span className="flex items-center gap-2">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? t("lightMode") : t("darkMode")}
          </span>
        </button>

        <div className="px-3 py-3 rounded-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs font-medium text-white">{t("aiReady")}</p>
          </div>
          <p className="text-[11px] text-slate-400">Online · v1.3.0</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: static, always visible */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-950 text-slate-300 flex-col h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile: off-canvas drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-slate-950 text-slate-300 flex flex-col z-50"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

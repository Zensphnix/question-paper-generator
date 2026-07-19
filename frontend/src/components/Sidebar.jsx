import { NavLink } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, UploadCloud, FileText, FolderOpen, BookOpen,
  LifeBuoy, ShieldCheck, Settings, Moon, Sun, X, ChevronDown,
} from "lucide-react";
import { useLanguage } from "../context/useLanguage.js";
import { resolveAvatarUrl } from "../services/api.js";
import SealMark from "./SealMark.jsx";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ user }) {
  const src = resolveAvatarUrl(user?.avatar_url);
  return (
    <div className="relative shrink-0">
      <div className="w-[34px] h-[34px] rounded-full p-[1.5px]" style={{ background: "linear-gradient(135deg,#e8cd93,#7a3340)" }}>
        {src ? (
          <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center font-sans text-[12.5px] font-bold"
            style={{ background: "#3a2b1c", color: "#f3ede2" }}>
            {initials(user?.name)}
          </div>
        )}
      </div>
      <div className="absolute -bottom-px -right-px w-[9px] h-[9px] rounded-full" style={{ background: "#5ab98a", border: "2px solid #0e131b" }} />
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
    <div className="flex flex-col h-full px-5 py-7" style={{ background: "#0e131b" }}>
      {/* Brand */}
      <div className="flex items-center justify-between gap-3 mb-8 px-1.5">
        <div className="flex items-center gap-3">
          <SealMark size={36} radius={11} />
          <span className="font-serif text-base" style={{ color: "#f3ede2" }}>
            QPaper <em className="italic" style={{ color: "#d4b876" }}>AI</em>
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close menu" className="md:hidden p-1" style={{ color: "#9aa0ac" }}>
          <X size={20} />
        </button>
      </div>

      {/* Account card */}
      <div className="flex items-center gap-3 rounded-xl px-3 py-[11px] mb-[26px] cursor-pointer transition-all"
        style={{ background: "linear-gradient(135deg,rgba(184,147,76,0.08),rgba(255,255,255,0.03))", border: "1px solid rgba(184,147,76,0.18)" }}
      >
        <Avatar user={user} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="font-sans text-[13.5px] font-semibold truncate" style={{ color: "#f3ede2" }}>{user?.name || "..."}</p>
          <p className="font-sans text-[11.5px] truncate capitalize" style={{ color: "#8a8f9a" }}>{user?.role || ""}</p>
        </div>
        <ChevronDown size={13} className="shrink-0" style={{ color: "#6d7280" }} />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onClose}>
            {({ isActive }) => (
              <m.div
                whileHover={!isActive ? { backgroundColor: "rgba(255,255,255,0.04)" } : {}}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 pl-[13px] pr-3.5 py-[11px] rounded-[9px] font-sans text-sm cursor-pointer"
                style={{
                  borderLeft: isActive ? "2px solid #b8934c" : "2px solid transparent",
                  background: isActive ? "rgba(184,147,76,0.12)" : "transparent",
                  color: isActive ? "#f3ede2" : "#9aa0ac",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <Icon size={16} style={{ color: isActive ? "#d4b876" : "currentColor" }} />
                {label}
              </m.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-2.5 mt-auto pt-4">
        <button type="button" onClick={onToggleDark}
          className="flex items-center justify-between px-3.5 py-[11px] rounded-[9px] font-sans text-[13px] transition"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#9aa0ac" }}
        >
          <span className="flex items-center gap-2">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            {darkMode ? t("lightMode") : t("darkMode")}
          </span>
        </button>

        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-[9px]"
          style={{ background: "rgba(184,147,76,0.08)", border: "1px solid rgba(184,147,76,0.2)" }}>
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: "#5ab98a" }} />
          <div>
            <p className="font-sans text-[12.5px] font-semibold" style={{ color: "#f3ede2" }}>{t("aiReady")}</p>
            <p className="font-sans text-[11px]" style={{ color: "#7d8290" }}>Online · v1.3.0</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex shrink-0 flex-col h-screen sticky top-0" style={{ width: 260, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {content}
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
            />
            <m.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[80vw] flex flex-col z-50"
            >
              {content}
            </m.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

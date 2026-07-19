import { Link } from "react-router-dom";
import { useLanguage } from "../context/useLanguage.js";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-inkscale-100 dark:border-white/10 px-4 sm:px-8 py-4 mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-inkscale-300">
        <p>© {year} QPaper AI</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/support" className="hover:text-burgundy transition">{t("helpCenter")}</Link>
          <span>|</span>
          <Link to="/support" className="hover:text-burgundy transition">{t("reportABug")}</Link>
          <span>|</span>
          <Link to="/terms" className="hover:text-burgundy transition">{t("terms")}</Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-burgundy transition">{t("privacyPolicy")}</Link>
        </div>
      </div>
    </footer>
  );
}

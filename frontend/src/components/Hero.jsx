import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, FolderOpen } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Hero() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-600 p-8 text-white relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-fuchsia-400/20 blur-2xl" />

      <p className="text-violet-100 text-sm mb-2 relative">{t("heroGreeting")} 👋</p>
      <h2 className="text-3xl font-bold mb-3 relative max-w-lg">
        {t("heroTitle")}
      </h2>
      <p className="text-violet-100 text-sm mb-6 relative max-w-md">
        {t("heroSubtitle")}
      </p>

      <div className="flex flex-wrap gap-3 relative">
        <button
          onClick={() => navigate("/upload")}
          className="flex items-center gap-2 bg-white text-violet-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-50 transition"
        >
          <UploadCloud size={16} /> {t("uploadNotes")}
        </button>
        <button
          onClick={() => navigate("/generate")}
          className="flex items-center gap-2 bg-white/10 border border-white/30 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/20 transition"
        >
          <FileText size={16} /> {t("generatePaper")}
        </button>
        <button
          onClick={() => navigate("/papers")}
          className="flex items-center gap-2 bg-white/10 border border-white/30 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/20 transition"
        >
          <FolderOpen size={16} /> {t("generatedPapers")}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { FolderOpen, Download } from "lucide-react";
import { listPapers, downloadPaperUrl } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import ShareMenu from "../components/ShareMenu.jsx";

export default function GeneratedPapers() {
  const { t } = useLanguage();
  const [papers, setPapers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listPapers().then(setPapers).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
      <h2 className="font-semibold text-slate-900 dark:text-white mb-1">{t("generatedPapers")}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("everyPaper")}</p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!papers.length && !error && (
        <div className="text-center py-16 text-slate-400">
          <FolderOpen className="mx-auto mb-3" size={32} />
          <p className="text-sm">{t("noPapersYet")}</p>
        </div>
      )}

      <div className="space-y-2">
        {papers.map((p) => (
          <div
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100 dark:border-white/10 rounded-lg px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {p.paper_name}
                </p>
                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 uppercase">
                  {p.file_type || "pdf"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {new Date(p.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ShareMenu paperId={p.id} paperName={p.paper_name} fileType={p.file_type} />
              <a
                href={downloadPaperUrl(p.id)}
                className="flex items-center gap-1.5 text-violet-600 hover:text-violet-700 text-sm font-medium"
              >
                <Download size={15} /> {t("download")}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

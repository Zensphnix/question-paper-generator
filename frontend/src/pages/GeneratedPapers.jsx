import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Download, RefreshCw, Eye } from "lucide-react";
import { listPapers, downloadPaperUrl, previewPaperUrl } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";
import ShareMenu from "../components/ShareMenu.jsx";

export default function GeneratedPapers() {
  const { t } = useLanguage();
  const [papers, setPapers] = useState([]);
  const [error, setError] = useState("");
  const [previewingId, setPreviewingId] = useState(null);

  useEffect(() => {
    listPapers().then(setPapers).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
      <h2 className="font-semibold text-inkscale-800 dark:text-white mb-1">{t("generatedPapers")}</h2>
      <p className="text-sm text-inkscale-400 dark:text-inkscale-300 mb-6">{t("everyPaper")}</p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!papers.length && !error && (
        <div className="text-center py-16 text-inkscale-300">
          <FolderOpen className="mx-auto mb-3" size={32} />
          <p className="text-sm">{t("noPapersYet")}</p>
        </div>
      )}

      <div className="space-y-2">
        {papers.map((p) => (
          <div key={p.id} className="border border-inkscale-50 dark:border-white/10 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-inkscale-700 dark:text-inkscale-100 truncate">
                    {p.paper_name}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300 uppercase">
                    {p.file_type || "pdf"}
                  </span>
                  {p.version > 1 && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300">
                      v{p.version}
                    </span>
                  )}
                  {p.parent_paper_id && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-burgundy/50">
                      Rebuilt from #{p.parent_paper_id}
                    </span>
                  )}
                </div>
                <p className="text-xs text-inkscale-300">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {p.file_type !== "docx" && (
                  <button
                    type="button"
                    onClick={() => setPreviewingId(previewingId === p.id ? null : p.id)}
                    className="flex items-center gap-1.5 text-inkscale-400 dark:text-inkscale-300 hover:text-burgundy text-sm font-medium"
                  >
                    <Eye size={15} /> {previewingId === p.id ? "Hide" : "Preview"}
                  </button>
                )}
                <Link
                  to={`/generate?rebuild=${p.id}`}
                  className="flex items-center gap-1.5 text-inkscale-400 dark:text-inkscale-300 hover:text-burgundy text-sm font-medium"
                  title="Reload this paper's questions (with any edits) to build a new version"
                >
                  <RefreshCw size={14} /> Rebuild
                </Link>
                <ShareMenu paperId={p.id} paperName={p.paper_name} fileType={p.file_type} />
                <a
                  href={downloadPaperUrl(p.id)}
                  className="flex items-center gap-1.5 text-burgundy hover:text-burgundy-dark text-sm font-medium"
                >
                  <Download size={15} /> {t("download")}
                </a>
              </div>
            </div>
            {previewingId === p.id && (
              <iframe
                src={previewPaperUrl(p.id)}
                title={`Preview of ${p.paper_name}`}
                className="w-full h-[500px] border-t border-inkscale-50 dark:border-white/10"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

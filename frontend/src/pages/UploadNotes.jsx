import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UploadCloud, FileCheck2, FileText, ChevronRight, Clock } from "lucide-react";
import { uploadFile, listUploads } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function UploadNotes() {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listUploads()
      .then(setUploads)
      .catch(() => setUploads([]))
      .finally(() => setUploadsLoading(false));
  }, []);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const result = await uploadFile(file);
      localStorage.setItem("topics", JSON.stringify(result.topics));
      localStorage.setItem("filename", result.filename);
      navigate("/generate");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useTopicsFrom(upload) {
    localStorage.setItem("topics", JSON.stringify(upload.topics));
    localStorage.setItem("filename", upload.filename);
    navigate("/generate");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {t("uploadStudyMaterial")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t("uploadHint")}
        </p>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl py-14 cursor-pointer hover:border-violet-400 transition">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0])}
          />
          {file ? (
            <FileCheck2 className="text-violet-500 mb-2" size={28} />
          ) : (
            <UploadCloud className="text-slate-300 dark:text-slate-600 mb-2" size={28} />
          )}
          <span className="text-slate-600 dark:text-slate-300 text-sm">
            {file ? file.name : t("clickToChoose")}
          </span>
        </label>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="mt-6 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition"
        >
          {loading ? t("extracting") : t("uploadExtract")}
        </button>
      </div>

      {/* Previously uploaded notes */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{t("yourUploads")}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t("yourUploadsHint")}
        </p>

        {uploadsLoading && <p className="text-sm text-slate-400">{t("loading")}</p>}

        {!uploadsLoading && uploads.length === 0 && (
          <p className="text-sm text-slate-400">{t("noUploadsYet")}</p>
        )}

        <div className="space-y-2">
          {uploads.map((u, i) => (
            <motion.button
              key={u.id}
              onClick={() => useTopicsFrom(u)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="w-full flex items-center gap-3 border border-slate-100 dark:border-white/10 rounded-lg p-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-violet-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{u.filename}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock size={11} /> {new Date(u.created_at).toLocaleDateString()} · {u.topics.length} {t("topicsFound")}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

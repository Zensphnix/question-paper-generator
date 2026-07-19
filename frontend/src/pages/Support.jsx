import { useState, useEffect } from "react";
import { m } from "framer-motion";
import { LifeBuoy, Send, Mail, CheckCircle2, MessageSquare, Bug, Sparkles, CornerDownRight } from "lucide-react";
import { submitFeedback, listFeedback } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

const categoryIcon = { bug: Bug, feature: Sparkles, general: MessageSquare };
const categoryColor = {
  bug: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  feature: "bg-burgundy/10 text-burgundy-dark dark:bg-burgundy/10 dark:text-burgundy/50",
  general: "bg-inkscale-50 text-inkscale-500 dark:bg-white/10 dark:text-inkscale-200",
};

export default function Support() {
  const { t } = useLanguage();
  const CATEGORIES = [
    { value: "bug", label: t("bugReport") },
    { value: "feature", label: t("featureRequest") },
    { value: "general", label: t("generalFeedback") },
  ];

  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  function loadHistory() {
    listFeedback().then(setHistory).catch(() => setHistory([])).finally(() => setHistoryLoading(false));
  }

  useEffect(() => { loadHistory(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true); setError("");
    try {
      await submitFeedback(category, message);
      setSent(true);
      setMessage("");
      loadHistory(); // refresh list so the new one shows up immediately
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy size={17} className="text-burgundy" />
          <h2 className="font-semibold text-inkscale-800 dark:text-white">{t("feedbackSupport")}</h2>
        </div>
        <p className="text-sm text-inkscale-400 dark:text-inkscale-300 mb-5">
          {t("feedbackHint")}
        </p>

        {sent ? (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg px-4 py-3"
          >
            <CheckCircle2 size={18} />
            <div>
              <p className="text-sm font-medium">{t("thanksSaved")}</p>
              <button type="button" onClick={() => setSent(false)} className="text-xs underline">{t("sendAnother")}</button>
            </div>
          </m.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    category === c.value
                      ? "bg-burgundy text-white"
                      : "bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={t("describeIssue")}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm resize-none"
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <m.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || !message.trim()}
              className="flex items-center justify-center gap-2 w-full bg-burgundy hover:bg-burgundy-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
            >
              <Send size={15} /> {loading ? t("sending") : t("sendFeedback")}
            </m.button>
          </form>
        )}
      </div>

      {/* Feedback history */}
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <h3 className="font-semibold text-inkscale-800 dark:text-white mb-4">{t("yourFeedback")}</h3>

        {historyLoading && <p className="text-sm text-inkscale-300">{t("loading")}</p>}
        {!historyLoading && history.length === 0 && (
          <p className="text-sm text-inkscale-300">{t("noFeedbackYet")}</p>
        )}

        <div className="space-y-2">
          {history.map((f, i) => {
            const Icon = categoryIcon[f.category] || MessageSquare;
            return (
              <m.div
                key={f.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="border border-inkscale-50 dark:border-white/10 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryColor[f.category] || categoryColor.general}`}>
                    <Icon size={11} /> {f.category}
                  </span>
                  <span className="text-[11px] text-inkscale-300">
                    {new Date(f.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-inkscale-600 dark:text-inkscale-200">{f.message}</p>

                {f.reply && (
                  <div className="mt-2 flex items-start gap-2 bg-burgundy/5 dark:bg-burgundy/10 rounded-lg p-2.5">
                    <CornerDownRight size={13} className="text-burgundy mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-burgundy-dark dark:text-burgundy/50">Owner replied</p>
                      <p className="text-xs text-inkscale-600 dark:text-inkscale-200 mt-0.5">{f.reply}</p>
                      <p className="text-[10px] text-inkscale-300 mt-1">{new Date(f.reply_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </m.div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <h3 className="font-semibold text-inkscale-800 dark:text-white mb-3">{t("otherWaysToReach")}</h3>
        <a href="mailto:zensphnix@gmail.com" className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200 hover:text-burgundy">
          <Mail size={15} /> zensphnix@gmail.com
        </a>
      </div>
    </div>
  );
}

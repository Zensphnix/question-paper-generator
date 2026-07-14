import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { searchQuestions } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

const bloomColor = {
  Remember: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  Understand: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Apply: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Analyze: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Evaluate: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  Create: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
};

export default function QuestionBank() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [bloomLevel, setBloomLevel] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    searchQuestions({ search, bloomLevel })
      .then(setQuestions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(load, 350); // debounce search typing
    return () => clearTimeout(t);
  }, [search, bloomLevel]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchQuestions")}
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200"
          />
        </div>
        <select
          value={bloomLevel}
          onChange={(e) => setBloomLevel(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200"
        >
          <option value="">{t("allBloomLevels")}</option>
          {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading && <p className="text-sm text-slate-400 px-6 py-8 text-center">{t("loading")}</p>}
        {error && <p className="text-sm text-red-600 px-6 py-8 text-center">{error}</p>}

        {!loading && !error && questions.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <BookOpen className="mx-auto mb-3" size={32} />
            <p className="text-sm">{t("noQuestionsMatch")}</p>
          </div>
        )}

        {questions.map((q) => (
          <div key={q.id} className="border-b border-slate-100 dark:border-white/10 last:border-0">
            <button
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              className="w-full flex items-start gap-3 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-slate-200">{q.question}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${bloomColor[q.bloom_level] || ""}`}>
                    {q.bloom_level}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                    {q.topic}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                    {q.marks} marks · {q.difficulty}
                  </span>
                </div>
              </div>
              {expanded === q.id ? <ChevronUp size={16} className="text-slate-400 mt-1" /> : <ChevronDown size={16} className="text-slate-400 mt-1" />}
            </button>
            {expanded === q.id && (
              <div className="px-6 pb-4 -mt-1">
                <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{t("modelAnswer")} </span>
                  {q.answer || t("noAnswerGenerated")}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

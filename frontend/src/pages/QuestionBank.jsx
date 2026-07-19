import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, ChevronDown, ChevronUp, BookOpen, Copy, X } from "lucide-react";
import { searchQuestions, checkSimilarity, listSharedWithMe } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

const bloomColor = {
  Remember: "bg-inkscale-50 text-inkscale-500 dark:bg-white/10 dark:text-inkscale-200",
  Understand: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Apply: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Analyze: "bg-gold/15 text-burgundy-dark dark:bg-gold/10 dark:text-gold-light",
  Evaluate: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  Create: "bg-gold/15 text-burgundy-dark dark:bg-gold/10 dark:text-gold-light",
};

function SimilarityPanel({ onClose }) {
  const [pairs, setPairs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkSimilarity(0.75)
      .then((res) => setPairs(res.similar_pairs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Copy size={16} className="text-burgundy" />
          <h3 className="font-semibold text-inkscale-800 dark:text-white">Similar / near-duplicate questions</h3>
        </div>
        <button type="button" onClick={onClose} className="text-inkscale-300 hover:text-inkscale-500"><X size={16} /></button>
      </div>

      {loading && <p className="text-sm text-inkscale-300">Checking your question bank...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && pairs && pairs.length === 0 && (
        <p className="text-sm text-emerald-600">No near-duplicates found — your question bank looks distinct within each topic.</p>
      )}

      {!loading && !error && pairs && pairs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-inkscale-300">
            Found {pairs.length} pair(s) worded similarly enough that one might be redundant. Wording
            similarity, not verbatim duplicates — worth a quick human check, not necessarily wrong.
          </p>
          {pairs.map((pair, i) => (
            <div key={i} className="border border-inkscale-50 dark:border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300">
                  {pair.topic}
                </span>
                <span className="text-[11px] font-medium text-gold">
                  {Math.round(pair.similarity * 100)}% similar
                </span>
              </div>
              <p className="text-sm text-inkscale-600 dark:text-inkscale-200 mb-1">• {pair.question_a.text}</p>
              <p className="text-sm text-inkscale-600 dark:text-inkscale-200">• {pair.question_b.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuestionBank() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [bloomLevel, setBloomLevel] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSimilarity, setShowSimilarity] = useState(false);
  const [sharedBanks, setSharedBanks] = useState([]);
  const [ownerId, setOwnerId] = useState(null);

  useEffect(() => { listSharedWithMe().then(setSharedBanks).catch(() => {}); }, []);

  function load() {
    setLoading(true);
    searchQuestions({ search, bloomLevel, ownerId })
      .then(setQuestions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(load, 350); // debounce search typing
    return () => clearTimeout(t);
  }, [search, bloomLevel, ownerId]); // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10">
          <Search size={16} className="text-inkscale-300" />
          <input
            aria-label={t("searchQuestions")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchQuestions")}
            className="flex-1 bg-transparent outline-none text-sm text-inkscale-600 dark:text-inkscale-100"
          />
        </div>
        <select
          aria-label="Filter by Bloom's level"
          value={bloomLevel}
          onChange={(e) => setBloomLevel(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 text-sm text-inkscale-600 dark:text-inkscale-100"
        >
          <option value="">{t("allBloomLevels")}</option>
          {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {sharedBanks.length > 0 && (
          <select value={ownerId || ""} onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2.5 rounded-lg bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 text-sm text-inkscale-500 dark:text-inkscale-200">
            <option value="">My bank</option>
            {sharedBanks.map((b) => <option key={b.owner_id} value={b.owner_id}>{b.owner_name}'s bank</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => setShowSimilarity((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 text-sm text-inkscale-500 dark:text-inkscale-200 hover:text-burgundy hover:border-burgundy/50"
        >
          <Copy size={15} /> Check similarity
        </button>
      </div>

      {showSimilarity && <SimilarityPanel onClose={() => setShowSimilarity(false)} />}

      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper overflow-hidden">
        {loading && <p className="text-sm text-inkscale-300 px-6 py-8 text-center">{t("loading")}</p>}
        {error && <p className="text-sm text-red-600 px-6 py-8 text-center">{error}</p>}

        {!loading && !error && questions.length === 0 && (
          <div className="text-center py-16 text-inkscale-300">
            <BookOpen className="mx-auto mb-3" size={32} />
            <p className="text-sm">{t("noQuestionsMatch")}</p>
          </div>
        )}

        {questions.map((q) => (
          <div key={q.id} className="border-b border-inkscale-50 dark:border-white/10 last:border-0">
            <button type="button"
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              className="w-full flex items-start gap-3 px-6 py-4 text-left hover:bg-inkscale-50 dark:hover:bg-white/5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-inkscale-700 dark:text-inkscale-100">{q.question}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${bloomColor[q.bloom_level] || ""}`}>
                    {q.bloom_level}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300">
                    {q.topic}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300">
                    {q.marks} marks · {q.difficulty}
                  </span>
                </div>
              </div>
              {expanded === q.id ? <ChevronUp size={16} className="text-inkscale-300 mt-1" /> : <ChevronDown size={16} className="text-inkscale-300 mt-1" />}
            </button>
            {expanded === q.id && (
              <div className="px-6 pb-4 -mt-1">
                <div className="bg-inkscale-50 dark:bg-white/5 rounded-lg p-3 text-sm text-inkscale-500 dark:text-inkscale-200">
                  <span className="font-medium text-inkscale-700 dark:text-inkscale-50">{t("modelAnswer")} </span>
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

import { BrainCircuit } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

function Bar({ label, pct, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-sm font-medium text-slate-900 dark:text-white">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AIUsage({ bloomCoveragePct, questionsCount, papersCount }) {
  const { t } = useLanguage();
  // Real, derived metrics — not fabricated numbers
  const generationActivity = Math.min(100, questionsCount * 2);
  const paperCompletion = Math.min(100, papersCount * 10);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <BrainCircuit size={18} className="text-violet-500" />
        <h3 className="font-semibold text-slate-900 dark:text-white">{t("aiUsage")}</h3>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">{t("currentSession")}</p>

      <div className="space-y-5">
        <Bar label={t("bloomTaxonomyCoverage")} pct={bloomCoveragePct} color="bg-emerald-500" />
        <Bar label={t("questionGenerationActivity")} pct={generationActivity} color="bg-violet-500" />
        <Bar label={t("paperCompletion")} pct={paperCompletion} color="bg-fuchsia-500" />
      </div>
    </div>
  );
}

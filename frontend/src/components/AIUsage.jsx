import { BrainCircuit } from "lucide-react";
import { useLanguage } from "../context/useLanguage.js";

function Bar({ label, pct, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-inkscale-500 dark:text-inkscale-200">{label}</span>
        <span className="text-sm font-medium text-inkscale-800 dark:text-white">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-inkscale-50 dark:bg-white/10 overflow-hidden">
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
    <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
      <div className="flex items-center gap-2 mb-1">
        <BrainCircuit size={18} className="text-burgundy" />
        <h3 className="font-semibold text-inkscale-800 dark:text-white">{t("aiUsage")}</h3>
      </div>
      <p className="text-xs text-inkscale-300 dark:text-inkscale-400 mb-5">{t("currentSession")}</p>

      <div className="space-y-5">
        <Bar label={t("bloomTaxonomyCoverage")} pct={bloomCoveragePct} color="bg-emerald-500" />
        <Bar label={t("questionGenerationActivity")} pct={generationActivity} color="bg-burgundy" />
        <Bar label={t("paperCompletion")} pct={paperCompletion} color="bg-gold" />
      </div>
    </div>
  );
}

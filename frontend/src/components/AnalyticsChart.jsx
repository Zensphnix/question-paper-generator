import { lazy, Suspense } from "react";
import { useLanguage } from "../context/useLanguage.js";

// recharts is a genuinely heavy library, and this chart is below-the-fold
// content on the Dashboard — lazy-loading it means people don't pay for it
// in their initial page load, only once this card actually renders.
const AnalyticsChartInner = lazy(() => import("./AnalyticsChartInner.jsx"));

function ChartSkeleton() {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-inkscale-200 dark:text-inkscale-500">
      Loading chart...
    </div>
  );
}

export default function AnalyticsChart({ data }) {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-inkscale-800 dark:text-white">{t("weeklyAnalytics")}</h3>
          <p className="text-xs text-inkscale-300 dark:text-inkscale-400">
            {t("questionsThisWeek")}
          </p>
        </div>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <AnalyticsChartInner data={data} />
      </Suspense>
    </div>
  );
}

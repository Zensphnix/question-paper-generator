import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { UploadCloud, FileText, FolderOpen, Cpu } from "lucide-react";
import Hero from "../components/Hero.jsx";
import StatCard from "../components/StatCard.jsx";
import RecentPapers from "../components/RecentPapers.jsx";
import AnalyticsChart from "../components/AnalyticsChart.jsx";
import AIUsage from "../components/AIUsage.jsx";
import { getStats } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export default function Dashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const sparkline = stats ? stats.daily_counts.map((d) => d.count) : [];

  return (
    <div className="space-y-7">
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Hero bloomCounts={stats?.bloom_counts} coveragePct={stats?.bloom_coverage_pct} />
      </m.div>

      {error && (
        <p className="text-sm" style={{ color: "#7a3340" }}>
          Couldn't load stats — make sure your backend is running. ({error})
        </p>
      )}

      <m.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        <m.div variants={item}>
          <StatCard icon={UploadCloud} label={t("topicsCovered")} value={stats?.total_topics ?? "—"} swatch="amber" />
        </m.div>
        <m.div variants={item}>
          <StatCard icon={FileText} label={t("questionsGenerated")} value={stats?.total_questions ?? "—"} swatch="burgundy" />
        </m.div>
        <m.div variants={item}>
          <StatCard icon={FolderOpen} label={t("papersBuilt")} value={stats?.total_papers ?? "—"} swatch="gold" />
        </m.div>
        <m.div variants={item}>
          <StatCard icon={Cpu} label={t("bloomCoverage")} value={stats ? `${stats.bloom_coverage_pct}%` : "—"} swatch="green" />
        </m.div>
      </m.div>

      <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <RecentPapers />
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2">
          <AnalyticsChart data={stats?.daily_counts ?? []} />
        </div>
        <AIUsage
          bloomCoveragePct={stats?.bloom_coverage_pct ?? 0}
          questionsCount={stats?.total_questions ?? 0}
          papersCount={stats?.total_papers ?? 0}
        />
      </m.div>
    </div>
  );
}

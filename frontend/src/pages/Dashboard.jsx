import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, FolderOpen, Cpu } from "lucide-react";
import Hero from "../components/Hero.jsx";
import StatCard from "../components/StatCard.jsx";
import AnalyticsChart from "../components/AnalyticsChart.jsx";
import AIUsage from "../components/AIUsage.jsx";
import { getStats } from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";

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
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Hero />
      </motion.div>

      {error && (
        <p className="text-sm text-red-600">
          Couldn't load stats — make sure your backend is running. ({error})
        </p>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={item}>
          <StatCard icon={UploadCloud} label={t("topicsCovered")} value={stats?.total_topics ?? "—"}
            accent="bg-blue-500" sparkline={sparkline} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard icon={FileText} label={t("questionsGenerated")} value={stats?.total_questions ?? "—"}
            accent="bg-violet-500" sparkline={sparkline} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard icon={FolderOpen} label={t("papersBuilt")} value={stats?.total_papers ?? "—"}
            accent="bg-fuchsia-500" sparkline={sparkline} />
        </motion.div>
        <motion.div variants={item}>
          <StatCard icon={Cpu} label={t("bloomCoverage")} value={stats ? `${stats.bloom_coverage_pct}%` : "—"}
            accent="bg-emerald-500" sparkline={sparkline} />
        </motion.div>
      </motion.div>

      <motion.div
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
      </motion.div>
    </div>
  );
}

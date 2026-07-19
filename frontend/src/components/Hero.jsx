import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { UploadCloud, FileText, FolderOpen } from "lucide-react";
import { useLanguage } from "../context/useLanguage.js";
import BloomPyramid from "./BloomPyramid.jsx";

export default function Hero({ bloomCounts, coveragePct }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden grid md:grid-cols-[1fr_260px] items-center rounded-[20px] p-6 sm:p-8 md:p-11"
      style={{
        background: "linear-gradient(150deg,#12181f,#1a2230)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 48px -16px rgba(10,8,6,0.35)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 90% 20%, rgba(184,147,76,0.10), transparent 55%)" }} />

      <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative">
        <div className="inline-flex items-center gap-2 font-sans text-xs uppercase mb-3.5" style={{ letterSpacing: "0.12em", color: "#d4b876" }}>
          <span className="w-[5px] h-[5px] rounded-full" style={{ background: "#d4b876" }} />
          {t("heroGreeting")}
        </div>
        <h2 className="font-serif font-normal text-4xl leading-[1.2] mb-4" style={{ color: "#f3ede2" }}>
          {t("heroTitle")}
        </h2>
        <p className="font-sans text-[14.5px] leading-[1.7] max-w-[460px] mb-6" style={{ color: "#a9aebb" }}>
          {t("heroSubtitle")}
        </p>

        <div className="flex flex-wrap gap-3">
          <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button"
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-[22px] py-[13px] rounded-[9px] font-sans text-[13.5px] font-bold"
            style={{ background: "#f3ede2", color: "#1c1a17" }}
          >
            <UploadCloud size={16} /> {t("uploadNotes")}
          </m.button>
          <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button"
            onClick={() => navigate("/generate")}
            className="flex items-center gap-2 px-[22px] py-[13px] rounded-[9px] font-sans text-[13.5px] font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "#f3ede2" }}
          >
            <FileText size={16} /> {t("generatePaper")}
          </m.button>
          <m.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} type="button"
            onClick={() => navigate("/papers")}
            className="flex items-center gap-2 px-[22px] py-[13px] rounded-[9px] font-sans text-[13.5px] font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", color: "#f3ede2" }}
          >
            <FolderOpen size={16} /> {t("generatedPapers")}
          </m.button>
        </div>
      </m.div>

      <div className="relative hidden md:flex flex-col items-center pl-6" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
        <BloomPyramid counts={bloomCounts} width={220} height={22} showCaption={false} />
        <p className="font-sans text-[10.5px] uppercase mt-3.5 text-center whitespace-nowrap" style={{ letterSpacing: "0.1em", color: "#7d8290" }}>
          {t("bloomCoverage")}
        </p>
        {coveragePct != null && (
          <p className="font-serif text-[22px] mt-1.5" style={{ color: "#d4b876" }}>{coveragePct}%</p>
        )}
      </div>
    </div>
  );
}

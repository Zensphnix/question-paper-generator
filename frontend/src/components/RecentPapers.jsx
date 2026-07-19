import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPapers } from "../services/api.js";

export default function RecentPapers() {
  const [papers, setPapers] = useState(null);

  useEffect(() => {
    listPapers().then((all) => setPapers(all.slice(0, 3))).catch(() => setPapers([]));
  }, []);

  return (
    <div className="rounded-2xl p-7" style={{ background: "var(--surface)", border: "1px solid var(--surface-border)", boxShadow: "0 1px 2px rgba(28,26,23,0.03)" }}>
      <div className="flex items-center justify-between mb-[18px]">
        <h3 className="font-serif text-lg" style={{ color: "var(--text-primary)" }}>Recent papers</h3>
        <Link to="/papers" className="font-sans text-[13px] hover:underline" style={{ color: "#b8934c" }}>View all</Link>
      </div>

      {papers === null && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>}
      {papers?.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
          No papers yet — build your first one from Generate Paper.
        </p>
      )}

      {papers?.map((p) => {
        const isReady = p.file_type === "pdf" || p.file_type === "docx";
        const statusBg = isReady ? "#dcece2" : "#f0e4c9";
        const statusColor = isReady ? "#2f6b4c" : "#8a6d1f";
        const statusLabel = isReady ? "Ready" : "Draft";
        return (
          <div key={p.id}
            className="grid items-center py-4 px-1 rounded-lg transition-colors"
            style={{ gridTemplateColumns: "1fr 140px 100px", borderTop: "1px solid var(--surface-border-soft)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--row-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div className="min-w-0">
              <p className="font-sans text-[14.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.paper_name}</p>
              <p className="font-sans text-[12.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {p.version > 1 ? `v${p.version} · ` : ""}{p.file_type?.toUpperCase()}
              </p>
            </div>
            <div className="font-sans text-[13px]" style={{ color: "var(--text-faint)" }}>
              {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
            </div>
            <div className="justify-self-start">
              <span className="font-sans text-[11.5px] font-semibold px-3 py-[5px] rounded-full"
                style={{ background: statusBg, color: statusColor }}>
                {statusLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

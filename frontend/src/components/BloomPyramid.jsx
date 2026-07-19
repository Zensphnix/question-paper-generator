import { m } from "framer-motion";

// Exact bands from the design spec: clip-path polygon + horizontal gradient,
// gold at the apex (Create) down through burgundy to navy/teal at the base
// (Remember) — six bands, 2px gaps, each a trapezoid via CSS clip-path.
const BANDS = [
  { label: "Create", clip: "polygon(42% 0,58% 0,64% 100%,36% 100%)", from: "#d4b876", to: "#b8934c" },
  { label: "Evaluate", clip: "polygon(36% 0,64% 0,70% 100%,30% 100%)", from: "#c2a05e", to: "#a67f3d" },
  { label: "Analyze", clip: "polygon(30% 0,70% 0,76% 100%,24% 100%)", from: "#8c6a45", to: "#6f5236" },
  { label: "Apply", clip: "polygon(24% 0,76% 0,82% 100%,18% 100%)", from: "#7a3340", to: "#602531" },
  { label: "Understand", clip: "polygon(18% 0,82% 0,90% 100%,10% 100%)", from: "#4d3441", to: "#3a2733" },
  { label: "Remember", clip: "polygon(10% 0,90% 0,100% 100%,0 100%)", from: "#24414a", to: "#1b323a" },
];

/**
 * The Bloom's Taxonomy pyramid — QPaper AI's brand graphic. Matches the
 * design spec exactly (clip-path trapezoids, gold-to-navy gradient). Grows
 * in top-to-bottom on mount; when `counts` is supplied each band's opacity
 * reflects whether you actually have questions at that level yet.
 */
export default function BloomPyramid({ counts, width = 280, height = 26, showCaption = true, className = "" }) {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className={className} style={{ width }}>
      <div className="flex flex-col">
        {BANDS.map((band, i) => {
          const count = counts?.[band.label] || 0;
          const dim = counts && total > 0 && count === 0;
          return (
            <m.div
              key={band.label}
              initial={{ opacity: 0, scaleX: 0.7 }}
              animate={{ opacity: dim ? 0.35 : 1, scaleX: 1 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              style={{
                clipPath: band.clip,
                height,
                marginTop: i === 0 ? 0 : 2,
                background: `linear-gradient(90deg, ${band.from}, ${band.to})`,
              }}
              title={counts ? `${band.label}: ${count} question${count === 1 ? "" : "s"}` : band.label}
            />
          );
        })}
      </div>
      {showCaption && (
        <div className="flex justify-between mt-3.5 font-sans text-[10px] tracking-[0.14em] uppercase" style={{ color: "#6d7280" }}>
          <span>Remember</span><span>Create</span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { m } from "framer-motion";

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const numericTarget = Number(target) || 0;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(numericTarget * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// icon swatch background/color per stat, taken directly from the spec
const SWATCHES = {
  gold: { bg: "#e9e2d2", color: "#8a6d1f" },
  burgundy: { bg: "#f0e0e2", color: "#7a3340" },
  amber: { bg: "#efe4c9", color: "#8a6d1f" },
  green: { bg: "#dcece2", color: "#2f6b4c" },
};

export default function StatCard({ icon: Icon, label, value, swatch = "gold" }) {
  const isNumeric = !isNaN(parseFloat(value));
  const displayValue = useCountUp(isNumeric ? value : 0);
  const colors = SWATCHES[swatch] || SWATCHES.gold;

  return (
    <m.div
      whileHover={{ y: -3, boxShadow: "0 16px 32px -12px rgba(28,26,23,0.14)" }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="rounded-2xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--surface-border)", boxShadow: "0 1px 2px rgba(28,26,23,0.03)" }}
    >
      <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center mb-5"
        style={{ background: colors.bg, color: colors.color }}>
        <Icon size={17} />
      </div>
      <p className="font-sans text-[11px] uppercase mb-1.5" style={{ letterSpacing: "0.1em", color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="font-serif text-[32px]" style={{ color: "var(--text-primary)" }}>
        {isNumeric ? displayValue : value}
      </p>
    </m.div>
  );
}

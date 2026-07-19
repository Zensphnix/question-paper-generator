/**
 * Brand badge — exact spec from the design handoff: a rounded-square with a
 * gold-to-burgundy diagonal gradient, a glossy top-half highlight, and a
 * centered cream CSS-triangle (border trick, no SVG/image needed).
 */
export default function SealMark({ size = 44, radius = 13 }) {
  const triW = size * 0.18;   // half-width of the triangle's base
  const triH = size * 0.32;   // triangle height

  return (
    <div
      className="relative flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        width: size, height: size, borderRadius: radius,
        background: "linear-gradient(150deg,#f0d9a8 0%,#b8934c 32%,#7a3340 68%,#241019 100%)",
        boxShadow: `0 ${size * 0.14}px ${size * 0.4}px rgba(122,51,64,0.4), inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -${size * 0.18}px ${size * 0.32}px rgba(0,0,0,0.18)`,
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-1/2"
        style={{ background: "linear-gradient(rgba(255,255,255,0.22),rgba(255,255,255,0))" }} />
      <div
        style={{
          width: 0, height: 0,
          borderLeft: `${triW}px solid transparent`,
          borderRight: `${triW}px solid transparent`,
          borderBottom: `${triH}px solid #faf7f1`,
          marginTop: -triH * 0.15,
        }}
      />
    </div>
  );
}

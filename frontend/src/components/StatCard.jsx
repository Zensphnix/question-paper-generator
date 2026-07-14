export default function StatCard({ icon: Icon, label, value, accent, sparkline = [] }) {
  const max = Math.max(...sparkline, 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>

      {sparkline.length > 0 && (
        <div className="flex items-end gap-1 mt-4 h-8">
          {sparkline.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-violet-200 dark:bg-violet-500/30"
              style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

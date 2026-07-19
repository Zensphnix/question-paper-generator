import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Pencil, Check, X, GitBranch, ListChecks } from "lucide-react";
import { updateQuestion } from "../services/api.js";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function QuestionCard({ question, index, selected, onToggleSelect }) {
  const [q, setQ] = useState(question);
  const [editing, setEditing] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState(question.answer || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const updated = await updateQuestion(q.id, { answer: draftAnswer });
      setQ((prev) => ({ ...prev, answer: updated.answer }));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraftAnswer(q.answer || "");
    setEditing(false);
    setError("");
  }

  const isMcq = q.question_type === "mcq" && Array.isArray(q.options);
  const hasDiagram = Boolean(q.diagram_type);

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
      className="border border-inkscale-50 dark:border-white/10 rounded-lg p-3"
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox" checked={selected} onChange={() => onToggleSelect(q.id)}
          aria-label={`Select question: ${q.question}`} className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-inkscale-700 dark:text-inkscale-100">{q.question}</p>

          {isMcq && (
            <div className="mt-2 space-y-1">
              {q.options.map((opt, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                  OPTION_LETTERS[i] === q.correct_option
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                    : "text-inkscale-400 dark:text-inkscale-300"
                }`}>
                  <span className="font-mono">{OPTION_LETTERS[i]})</span> {opt}
                  {OPTION_LETTERS[i] === q.correct_option && <Check size={12} className="ml-auto shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {hasDiagram && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-burgundy dark:text-burgundy/70 bg-burgundy/5 dark:bg-burgundy/10 rounded px-2 py-1 w-fit">
              <GitBranch size={12} /> Includes diagram — renders in the built PDF
            </div>
          )}

          <p className="text-xs text-inkscale-300 mt-1">
            {q.set ? `${q.set} · ` : ""}{q.unit ? `${q.unit} · ` : ""}
            {isMcq ? "MCQ" : q.bloom_level} · {q.topic} · {q.marks} marks · {q.difficulty}
          </p>
        </div>
        {!isMcq && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setEditing((v) => !v); }}
            className="shrink-0 text-inkscale-200 hover:text-burgundy p-1"
            aria-label="Edit model answer"
          >
            <Pencil size={13} />
          </button>
        )}
      </label>

      <AnimatePresence>
        {editing && (
          <m.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-2 pl-7 space-y-2">
            <textarea
              value={draftAnswer}
              onChange={(e) => setDraftAnswer(e.target.value)}
              rows={3}
              placeholder="Model answer..."
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-xs resize-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 text-xs font-medium bg-burgundy hover:bg-burgundy-dark text-white px-3 py-1.5 rounded-lg disabled:opacity-40">
                <Check size={12} /> {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={handleCancel}
                className="flex items-center gap-1 text-xs text-inkscale-300 px-3 py-1.5">
                <X size={12} /> Cancel
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

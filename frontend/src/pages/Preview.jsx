import { useEffect, useState } from "react";
import { buildPaper, downloadPaperUrl } from "../services/api";
import { Link } from "react-router-dom";

export default function Preview() {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [paperName, setPaperName] = useState("Semester Exam Paper");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("generatedQuestions") || "[]");
    setQuestions(stored);
  }, []);

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleBuildPaper() {
    if (!selected.length) return;
    setLoading(true);
    setError("");
    try {
      const result = await buildPaper({
        paper_name: paperName,
        course: "Sample Course",
        duration: "3 Hours",
        max_marks: questions
          .filter((q) => selected.includes(q.id))
          .reduce((sum, q) => sum + q.marks, 0),
        instructions: ["Answer all questions.", "Each question carries the marks indicated."],
        sections: [
          {
            name: "Section A",
            question_ids: selected,
          },
        ],
      });
      setDownloadUrl(downloadPaperUrl(result.paper_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!questions.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No questions generated yet.{" "}
        <Link to="/configure" className="text-slate-900 underline">
          Go generate some
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
      <h2 className="text-lg font-medium">Preview & select questions</h2>

      <div className="space-y-3">
        {questions.map((q) => (
          <label
            key={q.id}
            className="flex items-start gap-3 border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(q.id)}
              onChange={() => toggleSelect(q.id)}
              className="mt-1"
            />
            <div>
              <p className="text-sm text-slate-800">{q.question}</p>
              <p className="text-xs text-slate-500 mt-1">
                {q.bloom_level} · {q.marks} marks · {q.difficulty}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <input
          value={paperName}
          onChange={(e) => setPaperName(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 flex-1"
          placeholder="Paper name"
        />
        <button
          onClick={handleBuildPaper}
          disabled={!selected.length || loading}
          className="bg-slate-900 text-white px-5 py-2 rounded-lg disabled:opacity-40"
        >
          {loading ? "Building..." : "Build paper"}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {downloadUrl && (
        <a
          href={downloadUrl}
          className="inline-block bg-green-700 text-white px-5 py-2 rounded-lg"
        >
          Download PDF
        </a>
      )}
    </div>
  );
}

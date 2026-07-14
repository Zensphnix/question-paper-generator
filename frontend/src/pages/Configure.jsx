import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateQuestions } from "../services/api";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function Configure() {
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState("");
  const [bloomLevel, setBloomLevel] = useState("Understand");
  const [marks, setMarks] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("topics") || "[]");
    setTopics(stored);
    if (stored.length) setTopic(stored[0]);
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const result = await generateQuestions({
        topic,
        bloom_level: bloomLevel,
        marks: Number(marks),
        difficulty,
        count: Number(count),
      });
      const existing = JSON.parse(localStorage.getItem("generatedQuestions") || "[]");
      localStorage.setItem(
        "generatedQuestions",
        JSON.stringify([...existing, ...result.questions])
      );
      navigate("/preview");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-5">
      <h2 className="text-lg font-medium">Configure question generation</h2>

      <div>
        <label className="block text-sm text-slate-600 mb-1">Topic</label>
        {topics.length ? (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Type a topic manually"
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Bloom's level</label>
          <select
            value={bloomLevel}
            onChange={(e) => setBloomLevel(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Marks per question</label>
          <input
            type="number"
            min="1"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Number of questions</label>
          <input
            type="number"
            min="1"
            max="20"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!topic || loading}
        className="bg-slate-900 text-white px-5 py-2 rounded-lg disabled:opacity-40"
      >
        {loading ? "Generating..." : "Generate questions"}
      </button>
    </div>
  );
}

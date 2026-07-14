import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../services/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const result = await uploadFile(file);
      localStorage.setItem("topics", JSON.stringify(result.topics));
      localStorage.setItem("filename", result.filename);
      navigate("/configure");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8">
      <h2 className="text-lg font-medium mb-1">Upload study material</h2>
      <p className="text-sm text-slate-500 mb-6">
        PDF, DOCX, or TXT. We'll extract topics automatically.
      </p>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg py-12 cursor-pointer hover:border-slate-400 transition">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <span className="text-slate-600">
          {file ? file.name : "Click to choose a file"}
        </span>
      </label>

      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="mt-6 bg-slate-900 text-white px-5 py-2 rounded-lg disabled:opacity-40"
      >
        {loading ? "Extracting..." : "Upload & extract topics"}
      </button>
    </div>
  );
}

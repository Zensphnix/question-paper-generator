import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ListChecks, Image as ImageIcon, FileUp, Check, RotateCcw } from "lucide-react";
import {
  generateQuestions, generateAuto, buildPaper, buildPaperFromTemplate,
  uploadLogo, uploadTemplate, downloadPaperUrl,
} from "../services/api.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import ShareMenu from "../components/ShareMenu.jsx";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const MODES = { SINGLE: "single", AUTO: "auto" };
const OUTPUT_MODES = { STANDARD: "standard", TEMPLATE: "template" };

export default function GeneratePaper() {
  const { generationLanguage, t } = useLanguage();
  const [mode, setMode] = useState(MODES.SINGLE);
  const [topics, setTopics] = useState([]);

  const [topic, setTopic] = useState("");
  const [bloomLevel, setBloomLevel] = useState("Understand");
  const [count, setCount] = useState(5);

  const [selectedTopics, setSelectedTopics] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(30);
  const [autoProgress, setAutoProgress] = useState("");

  const [marks, setMarks] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [numSets, setNumSets] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeSet, setActiveSet] = useState("all");

  const [outputMode, setOutputMode] = useState(OUTPUT_MODES.STANDARD);
  const [paperName, setPaperName] = useState("Semester Exam Paper");
  const [includeAnswers, setIncludeAnswers] = useState(true);

  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [duration, setDuration] = useState("3 Hours");
  const [maxMarksOverride, setMaxMarksOverride] = useState("");

  const [logoFilename, setLogoFilename] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const [templateFilename, setTemplateFilename] = useState("");
  const [templateHasPlaceholder, setTemplateHasPlaceholder] = useState(null);
  const [templateUploading, setTemplateUploading] = useState(false);

  const [downloadUrl, setDownloadUrl] = useState("");
  const [builtPaperId, setBuiltPaperId] = useState(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [justBuilt, setJustBuilt] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("topics") || "[]");
    setTopics(stored);
    if (stored.length) {
      setTopic(stored[0]);
      setSelectedTopics(stored.slice(0, Math.min(6, stored.length)));
    }
  }, []);

  function resetWorkspace() {
    setQuestions([]);
    setSelected([]);
    setActiveSet("all");
    setDownloadUrl("");
    setBuiltPaperId(null);
    setJustBuilt(false);
    setPaperName("Semester Exam Paper");
    setError("");
    setAutoProgress("");
  }

  async function handleGenerateSingle() {
    if (!topic) return;
    setLoading(true); setError(""); setDownloadUrl(""); setJustBuilt(false);
    try {
      const allNew = [];
      for (let s = 0; s < numSets; s++) {
        const setLabel = numSets > 1 ? `Set ${String.fromCharCode(65 + s)}` : null;
        const result = await generateQuestions({
          topic, bloom_level: bloomLevel, marks: Number(marks), difficulty, count: Number(count),
          language: generationLanguage, set_label: setLabel,
        });
        allNew.push(...result.questions);
      }
      setQuestions((prev) => [...prev, ...allNew]);
      if (!course) setCourse(topic);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleGenerateAuto() {
    if (!selectedTopics.length) return;
    setLoading(true); setError(""); setDownloadUrl(""); setJustBuilt(false);
    const allNew = [];
    let totalFailed = 0;
    try {
      for (let s = 0; s < numSets; s++) {
        const setLabel = numSets > 1 ? `Set ${String.fromCharCode(65 + s)}` : null;
        setAutoProgress(
          numSets > 1
            ? `Generating ${setLabel} across ${selectedTopics.length} topics...`
            : `Generating across ${selectedTopics.length} topics...`
        );
        const result = await generateAuto({
          topics: selectedTopics, total_questions: Number(totalQuestions),
          marks: Number(marks), difficulty, language: generationLanguage, set_label: setLabel,
        });
        allNew.push(...result.questions);
        totalFailed += result.topics_failed.length;
      }
      setQuestions((prev) => [...prev, ...allNew]);
      setAutoProgress(
        `Generated ${allNew.length} questions` + (numSets > 1 ? ` across ${numSets} sets` : "") +
        (totalFailed ? ` (${totalFailed} topic(s) yielded nothing new — try again)` : "")
      );
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function toggleTopicSelect(tp) {
    setSelectedTopics((prev) => prev.includes(tp) ? prev.filter((x) => x !== tp) : [...prev, tp]);
  }
  function toggleSelect(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleLogoUpload(file) {
    if (!file) return;
    setLogoUploading(true); setError("");
    try {
      const result = await uploadLogo(file);
      setLogoFilename(result.logo_filename);
    } catch (err) { setError(err.message); }
    finally { setLogoUploading(false); }
  }

  async function handleTemplateUpload(file) {
    if (!file) return;
    setTemplateUploading(true); setError("");
    try {
      const result = await uploadTemplate(file);
      setTemplateFilename(result.template_filename);
      setTemplateHasPlaceholder(result.has_placeholder);
    } catch (err) { setError(err.message); }
    finally { setTemplateUploading(false); }
  }

  async function handleBuildPaper() {
    if (!selected.length) return;
    setBuildLoading(true); setError("");
    const selectedQs = questions.filter((q) => selected.includes(q.id));
    const calculatedMarks = selectedQs.reduce((sum, q) => sum + q.marks, 0);

    try {
      let result;
      if (outputMode === OUTPUT_MODES.TEMPLATE) {
        if (!templateFilename) throw new Error("Upload a .docx template first");
        result = await buildPaperFromTemplate({
          paper_name: paperName,
          template_filename: templateFilename,
          sections: [{ name: "Section A", question_ids: selected }],
          include_answers: includeAnswers,
        });
      } else {
        result = await buildPaper({
          paper_name: paperName,
          institution: institution || "ABC University",
          course: course || topic || "Multiple Topics",
          duration,
          max_marks: maxMarksOverride ? Number(maxMarksOverride) : calculatedMarks,
          instructions: ["Answer all questions.", "Each question carries the marks indicated."],
          sections: [{ name: "Section A", question_ids: selected }],
          include_answers: includeAnswers,
          logo_filename: logoFilename || null,
        });
      }
      setDownloadUrl(downloadPaperUrl(result.paper_id));
      setBuiltPaperId(result.paper_id);
      setSelected([]);       // clear selection so it can't accidentally leak into the next paper
      setJustBuilt(true);
    } catch (err) { setError(err.message); }
    finally { setBuildLoading(false); }
  }

  const setLabels = [...new Set(questions.map((q) => q.set).filter(Boolean))];
  const visibleQuestions = activeSet === "all" ? questions : questions.filter((q) => q.set === activeSet);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: generation config */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5 h-fit">
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg">
          <button onClick={() => setMode(MODES.SINGLE)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition ${
              mode === MODES.SINGLE ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}>
            <ListChecks size={15} /> {t("singleTopic")}
          </button>
          <button onClick={() => setMode(MODES.AUTO)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition ${
              mode === MODES.AUTO ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}>
            <Wand2 size={15} /> {t("autoFullPaper")}
          </button>
        </div>

        {mode === MODES.SINGLE ? (
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t("topic")}</label>
            {topics.length ? (
              <select value={topic} onChange={(e) => setTopic(e.target.value)}
                className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm">
                {topics.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            ) : (
              <input value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder={t("noTopicTyped")}
                className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
            )}
            <label className="block text-sm text-slate-500 dark:text-slate-400 mt-4 mb-1">{t("bloomLevel")}</label>
            <select value={bloomLevel} onChange={(e) => setBloomLevel(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm">
              {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mt-4 mb-1">{t("numQuestions")}</label>
            <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-slate-500 dark:text-slate-400">{t("topicsSelected")} ({selectedTopics.length} {t("selected")})</label>
              {topics.length > 0 && (
                <button onClick={() => setSelectedTopics(selectedTopics.length === topics.length ? [] : topics)}
                  className="text-xs text-violet-600 hover:underline">
                  {selectedTopics.length === topics.length ? t("deselectAll") : t("selectAll")}
                </button>
              )}
            </div>
            {!topics.length ? (
              <p className="text-xs text-slate-400">
                {t("noTopicsFound")} — <Link to="/upload" className="text-violet-600 underline">{t("uploadNotesFirst")}</Link> {t("firstSuffix")}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-lg p-2 space-y-1">
                {topics.map((tp) => (
                  <label key={tp} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={selectedTopics.includes(tp)} onChange={() => toggleTopicSelect(tp)} />
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{tp}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="block text-sm text-slate-500 dark:text-slate-400 mt-4 mb-1">{t("targetQuestions")}</label>
            <input type="number" min="6" max="200" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-slate-400 mt-1">{t("targetHint")}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t("difficulty")}</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm">
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">{t("marksPerQuestion")}</label>
            <input type="number" min="1" value={marks} onChange={(e) => setMarks(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
              {t("numberOfSets")} <span className="text-slate-400">{t("numberOfSetsHint")}</span>
            </label>
            <select value={numSets} onChange={(e) => setNumSets(Number(e.target.value))}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm">
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n === 1 ? t("oneSetDefault") : `${n} sets (Set A – Set ${String.fromCharCode(64 + n)})`}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {autoProgress && !error && <p className="text-violet-600 text-sm">{autoProgress}</p>}

        <p className="text-xs text-slate-400">
          {t("generatingIn")} <span className="font-medium text-slate-600 dark:text-slate-300">{generationLanguage}</span>
          {" — "}<Link to="/settings" className="text-violet-600 underline">{t("changeInSettings")}</Link>.
        </p>

        <button
          onClick={mode === MODES.SINGLE ? handleGenerateSingle : handleGenerateAuto}
          disabled={loading || (mode === MODES.SINGLE ? !topic : !selectedTopics.length)}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition">
          {loading
            ? t("generating")
            : mode === MODES.SINGLE
              ? `${t("generateQuestions")}${numSets > 1 ? ` (${numSets} sets)` : ""}`
              : `${t("autoGenerate")} ~${totalQuestions}${numSets > 1 ? ` × ${numSets}` : ""}`}
        </button>
      </div>

      {/* Right: results + build */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t("questionsLabel")} ({questions.length})</h2>
            <div className="flex items-center gap-3 shrink-0">
              {questions.length > 0 && (
                <button onClick={resetWorkspace} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500">
                  <RotateCcw size={12} /> {t("startNewPaper")}
                </button>
              )}
              {visibleQuestions.length > 0 && (
                <button
                  onClick={() => {
                    const ids = visibleQuestions.map((q) => q.id);
                    const allSelected = ids.every((id) => selected.includes(id));
                    setSelected((prev) =>
                      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
                    );
                  }}
                  className="text-xs text-violet-600 hover:underline"
                >
                  {visibleQuestions.every((q) => selected.includes(q.id)) ? t("deselectVisible") : t("selectAllVisible")}
                </button>
              )}
            </div>
          </div>

          {setLabels.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setActiveSet("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  activeSet === "all" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-100 dark:bg-white/10 text-slate-500"}`}>
                All ({questions.length})
              </button>
              {setLabels.map((label) => (
                <button key={label} onClick={() => {
                  setActiveSet(label);
                  if (paperName === "Semester Exam Paper" || setLabels.some((l) => paperName.endsWith(l))) {
                    setPaperName(`Semester Exam Paper - ${label}`);
                  }
                }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    activeSet === label ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500"}`}>
                  {label} ({questions.filter((q) => q.set === label).length})
                </button>
              ))}
            </div>
          )}

          {!questions.length && <p className="text-sm text-slate-400">{t("questionsWillAppear")}</p>}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {visibleQuestions.map((q, i) => (
                <motion.label
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                  className="flex items-start gap-3 border border-slate-100 dark:border-white/10 rounded-lg p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleSelect(q.id)} className="mt-1" />
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">{q.question}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {q.set ? `${q.set} · ` : ""}{q.bloom_level} · {q.topic} · {q.marks} marks · {q.difficulty}
                    </p>
                  </div>
                </motion.label>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t("buildPaper")} ({selected.length} {t("selected")})</h2>

            {justBuilt && downloadUrl && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg px-3 py-2 text-xs">
                Paper built! Selection cleared — pick more questions for another paper, or{" "}
                <button onClick={resetWorkspace} className="underline font-medium">start fresh</button>.
              </div>
            )}

            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg">
              <button onClick={() => setOutputMode(OUTPUT_MODES.STANDARD)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  outputMode === OUTPUT_MODES.STANDARD ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}>
                {t("standardPdf")}
              </button>
              <button onClick={() => setOutputMode(OUTPUT_MODES.TEMPLATE)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  outputMode === OUTPUT_MODES.TEMPLATE ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"}`}>
                {t("useCollegeTemplate")}
              </button>
            </div>

            <input value={paperName} onChange={(e) => setPaperName(e.target.value)} placeholder={t("paperNamePlaceholder")}
              className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />

            {outputMode === OUTPUT_MODES.STANDARD ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={institution} onChange={(e) => setInstitution(e.target.value)}
                    placeholder={t("institutionPlaceholder")}
                    className="col-span-2 w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder={t("coursePlaceholder")}
                    className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t("durationPlaceholder")}
                    className="w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input type="number" value={maxMarksOverride} onChange={(e) => setMaxMarksOverride(e.target.value)}
                    placeholder={t("maxMarksPlaceholder")}
                    className="col-span-2 w-full border border-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-white rounded-lg px-3 py-2 text-sm" />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 border border-dashed border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:border-violet-400">
                  <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files[0])} />
                  {logoUploading ? <span className="text-slate-400">{t("uploadingLogo")}</span> : logoFilename ? (
                    <><Check size={15} className="text-emerald-500" /> {logoFilename}</>
                  ) : (
                    <><ImageIcon size={15} /> {t("uploadLogoOptional")}</>
                  )}
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 border border-dashed border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:border-violet-400">
                  <input type="file" accept=".docx" className="hidden"
                    onChange={(e) => handleTemplateUpload(e.target.files[0])} />
                  {templateUploading ? <span className="text-slate-400">{t("uploadingTemplate")}</span> : templateFilename ? (
                    <><Check size={15} className="text-emerald-500" /> {templateFilename}</>
                  ) : (
                    <><FileUp size={15} /> {t("uploadTemplateLabel")}</>
                  )}
                </label>
                {templateFilename && (
                  <p className="text-xs text-slate-400">
                    {templateHasPlaceholder ? t("templatePlaceholderFound") : t("templatePlaceholderMissing")}
                  </p>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} />
              {t("includeAnswerKey")}
            </label>

            <button
              onClick={handleBuildPaper}
              disabled={!selected.length || buildLoading}
              className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition">
              {buildLoading ? t("building") : t("buildPaper")}
            </button>

            {downloadUrl && (
              <div className="space-y-2">
                <a href={downloadUrl}
                  className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition">
                  {t("download")} {outputMode === OUTPUT_MODES.TEMPLATE ? "DOCX" : "PDF"}
                </a>
                {builtPaperId && (
                  <div className="flex justify-center">
                    <ShareMenu
                      paperId={builtPaperId}
                      paperName={paperName}
                      fileType={outputMode === OUTPUT_MODES.TEMPLATE ? "docx" : "pdf"}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

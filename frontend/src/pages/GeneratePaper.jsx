import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { Wand2, ListChecks, Image as ImageIcon, FileUp, Check, RotateCcw, Layers, Trash2, GitBranch, ListTodo, Building2, Eye, BookmarkPlus, Download as DownloadIcon, Sheet } from "lucide-react";
import {
  generateQuestions, generateAuto, generateDiagramQuestion, buildPaper, buildPaperFromTemplate,
  buildUniversityPaper, uploadLogo, uploadTemplate, downloadPaperUrl, previewPaperUrl, getPaperDetail,
  listPaperTemplates, savePaperTemplate, deletePaperTemplate, exportMcqCsvUrl,
} from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";
import ShareMenu from "../components/ShareMenu.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import UniversityFormatFields from "../components/UniversityFormatFields.jsx";

const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const MODES = { SINGLE: "single", AUTO: "auto" };
const OUTPUT_MODES = { STANDARD: "standard", TEMPLATE: "template", UNIVERSITY: "university" };
const QUESTION_TYPES = { SHORT: "short_answer", MCQ: "mcq", DIAGRAM: "diagram" };
const DIAGRAM_TYPES = [
  { value: "graph_dfs", label: "Graph — DFS Traversal" },
  { value: "graph_bfs", label: "Graph — BFS Traversal" },
  { value: "tree_inorder", label: "Binary Tree — In-order" },
  { value: "tree_preorder", label: "Binary Tree — Pre-order" },
  { value: "tree_postorder", label: "Binary Tree — Post-order" },
];

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
  const [unit, setUnit] = useState("");
  const [questionType, setQuestionType] = useState(QUESTION_TYPES.SHORT);
  const [diagramType, setDiagramType] = useState(DIAGRAM_TYPES[0].value);
  const [diagramNumNodes, setDiagramNumNodes] = useState(6);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeSet, setActiveSet] = useState("all");

  const [paperSections, setPaperSections] = useState([]); // [{name, questionIds}] — unit-wise sections
  const [sectionNameDraft, setSectionNameDraft] = useState("");

  const [outputMode, setOutputMode] = useState(OUTPUT_MODES.STANDARD);
  const [paperName, setPaperName] = useState("Semester Exam Paper");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [qrContent, setQrContent] = useState("");

  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [duration, setDuration] = useState("3 Hours");
  const [maxMarksOverride, setMaxMarksOverride] = useState("");

  const [logoFilename, setLogoFilename] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const [universityMeta, setUniversityMeta] = useState({
    universityName: "", examTitle: "MID TERM EXAMINATION", semesterLabel: "Odd Semester 2024-25",
    school: "", programme: "", courseCode: "", courseName: "", semester: "",
    timeStr: "1 Hr", maxMarks: 20, instructions: "All questions are compulsory.",
  });

  const [templateFilename, setTemplateFilename] = useState("");
  const [templateHasPlaceholder, setTemplateHasPlaceholder] = useState(null);
  const [templateUploading, setTemplateUploading] = useState(false);

  const [downloadUrl, setDownloadUrl] = useState("");
  const [builtPaperId, setBuiltPaperId] = useState(null);
  const [buildLoading, setBuildLoading] = useState(false);
  const [justBuilt, setJustBuilt] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [searchParams] = useSearchParams();
  const [parentPaperId, setParentPaperId] = useState(null);
  const [rebuildBanner, setRebuildBanner] = useState("");

  const [templates, setTemplates] = useState([]);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("topics:v1") || "[]");
    setTopics(stored);
    if (stored.length) {
      setTopic(stored[0]);
      setSelectedTopics(stored.slice(0, Math.min(6, stored.length)));
    }
  }, []);

  // Rebuild flow: /generate?rebuild=<paperId> loads that paper's questions
  // (reflecting any answer edits since it was first built) back into the
  // workspace so they can be reviewed/adjusted before building a new version.
  useEffect(() => {
    const rebuildId = searchParams.get("rebuild");
    if (!rebuildId) return;
    getPaperDetail(Number(rebuildId))
      .then((paper) => {
        setQuestions(paper.questions);
        setSelected(paper.questions.map((q) => q.id));
        setParentPaperId(paper.id);
        setPaperName(`${paper.paper_name} (rebuilt)`);
        setRebuildBanner(`Loaded "${paper.paper_name}" — all its questions are pre-selected, reflecting any edits you've made since. Adjust selection if needed, then build.`);
      })
      .catch((err) => setError(err.message));
  }, [searchParams]);

  useEffect(() => {
    listPaperTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  function resetWorkspace() {
    setQuestions([]);
    setSelected([]);
    setActiveSet("all");
    setPaperSections([]);
    setSectionNameDraft("");
    setDownloadUrl("");
    setBuiltPaperId(null);
    setJustBuilt(false);
    setPaperName("Semester Exam Paper");
    setError("");
    setAutoProgress("");
    setParentPaperId(null);
    setRebuildBanner("");
    setShowPreview(false);
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
          language: generationLanguage, set_label: setLabel, unit: unit || null,
          question_type: questionType,
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
          marks: Number(marks), difficulty, language: generationLanguage, set_label: setLabel, unit: unit || null,
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

  async function handleGenerateDiagram() {
    setDiagramLoading(true); setError(""); setDownloadUrl(""); setJustBuilt(false);
    try {
      const result = await generateDiagramQuestion({
        diagram_type: diagramType, marks: Number(marks), num_nodes: Number(diagramNumNodes),
        unit: unit || null, topic: topic || "Data Structures",
      });
      setQuestions((prev) => [...prev, ...result.questions]);
    } catch (err) { setError(err.message); }
    finally { setDiagramLoading(false); }
  }

  function applyTemplate(templateId) {
    const tpl = templates.find((t) => t.id === Number(templateId));
    if (!tpl) return;
    setOutputMode(tpl.output_mode === "university" ? OUTPUT_MODES.UNIVERSITY : OUTPUT_MODES.STANDARD);
    if (tpl.output_mode === "university") {
      setUniversityMeta({
        universityName: tpl.university_name || "", examTitle: tpl.exam_title || "MID TERM EXAMINATION",
        semesterLabel: tpl.semester_label || "", school: tpl.school || "", programme: tpl.programme || "",
        courseCode: tpl.course_code || "", courseName: tpl.course_name || "", semester: tpl.semester || "",
        timeStr: tpl.time_str || "1 Hr", maxMarks: tpl.max_marks || 20,
        instructions: tpl.instructions || "All questions are compulsory.",
      });
    } else {
      setInstitution(tpl.institution || "");
      setCourse(tpl.course || "");
      setDuration(tpl.duration || "3 Hours");
    }
    if (tpl.logo_filename) setLogoFilename(tpl.logo_filename);
  }

  async function handleSaveTemplate() {
    if (!templateNameDraft.trim()) return;
    setSavingTemplate(true); setError("");
    try {
      const payload = outputMode === OUTPUT_MODES.UNIVERSITY
        ? {
            name: templateNameDraft.trim(), output_mode: "university",
            university_name: universityMeta.universityName, exam_title: universityMeta.examTitle,
            semester_label: universityMeta.semesterLabel, school: universityMeta.school,
            programme: universityMeta.programme, course_code: universityMeta.courseCode,
            course_name: universityMeta.courseName, semester: universityMeta.semester,
            time_str: universityMeta.timeStr, max_marks: Number(universityMeta.maxMarks),
            instructions: universityMeta.instructions, logo_filename: logoFilename || null,
          }
        : {
            name: templateNameDraft.trim(), output_mode: "standard",
            institution, course, duration, logo_filename: logoFilename || null,
          };
      const saved = await savePaperTemplate(payload);
      setTemplates((prev) => [saved, ...prev]);
      setTemplateNameDraft("");
    } catch (err) { setError(err.message); }
    finally { setSavingTemplate(false); }
  }

  async function handleDeleteTemplate(id) {
    try {
      await deletePaperTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) { setError(err.message); }
  }

  function handleApplyTemplate(tpl) {
    if (tpl.output_mode === "university") {
      setOutputMode(OUTPUT_MODES.UNIVERSITY);
      setUniversityMeta({
        universityName: tpl.university_name || "", examTitle: tpl.exam_title || "MID TERM EXAMINATION",
        semesterLabel: tpl.semester_label || "", school: tpl.school || "", programme: tpl.programme || "",
        courseCode: tpl.course_code || "", courseName: tpl.course_name || "", semester: tpl.semester || "",
        timeStr: tpl.time_str || "1 Hr", maxMarks: tpl.max_marks || 20,
        instructions: tpl.instructions || "All questions are compulsory.",
      });
    } else {
      setOutputMode(OUTPUT_MODES.STANDARD);
      setInstitution(tpl.institution || "");
      setCourse(tpl.course || "");
      setDuration(tpl.duration || "3 Hours");
    }
    if (tpl.logo_filename) setLogoFilename(tpl.logo_filename);
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
    // If unit-wise sections were built, use those; otherwise fall back to the
    // simple case — everything currently selected becomes one "Section A".
    const sections = paperSections.length > 0
      ? paperSections.map((s) => ({ name: s.name, question_ids: s.questionIds }))
      : [{ name: "Section A", question_ids: selected }];

    const allQuestionIds = sections.flatMap((s) => s.question_ids);
    if (!allQuestionIds.length) return;

    setBuildLoading(true); setError("");
    const selectedQs = questions.filter((q) => new Set(allQuestionIds).has(q.id));
    const calculatedMarks = selectedQs.reduce((sum, q) => sum + q.marks, 0);

    try {
      let result;
      if (outputMode === OUTPUT_MODES.TEMPLATE) {
        if (!templateFilename) throw new Error("Upload a .docx template first");
        result = await buildPaperFromTemplate({
          paper_name: paperName,
          template_filename: templateFilename,
          sections,
          include_answers: includeAnswers,
          parent_paper_id: parentPaperId,
          shuffle, watermark_text: watermarkText || null, qr_content: qrContent || null,
        });
      } else if (outputMode === OUTPUT_MODES.UNIVERSITY) {
        result = await buildUniversityPaper({
          paper_name: paperName,
          university_name: universityMeta.universityName || "ABC University",
          exam_title: universityMeta.examTitle,
          semester_label: universityMeta.semesterLabel,
          school: universityMeta.school,
          programme: universityMeta.programme,
          course_code: universityMeta.courseCode,
          course_name: universityMeta.courseName,
          semester: universityMeta.semester,
          time_str: universityMeta.timeStr,
          max_marks: Number(universityMeta.maxMarks) || calculatedMarks,
          instructions: universityMeta.instructions,
          sections,
          logo_filename: logoFilename || null,
          parent_paper_id: parentPaperId,
          shuffle, watermark_text: watermarkText || null, qr_content: qrContent || null,
        });
      } else {
        result = await buildPaper({
          paper_name: paperName,
          institution: institution || "ABC University",
          course: course || topic || "Multiple Topics",
          duration,
          max_marks: maxMarksOverride ? Number(maxMarksOverride) : calculatedMarks,
          instructions: ["Answer all questions.", "Each question carries the marks indicated."],
          sections,
          include_answers: includeAnswers,
          logo_filename: logoFilename || null,
          parent_paper_id: parentPaperId,
          shuffle, watermark_text: watermarkText || null, qr_content: qrContent || null,
        });
      }
      setDownloadUrl(downloadPaperUrl(result.paper_id));
      setBuiltPaperId(result.paper_id);
      setSelected([]);       // clear selection so it can't accidentally leak into the next paper
      setPaperSections([]);  // sections are consumed once built
      setJustBuilt(true);
      setParentPaperId(null);
      setRebuildBanner("");
    } catch (err) { setError(err.message); }
    finally { setBuildLoading(false); }
  }

  // O(1) membership checks instead of re-scanning the whole array on every
  // row during render — matters once these lists have more than a handful
  // of items (a full class's worth of topics/questions, for example).
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedTopicsSet = useMemo(() => new Set(selectedTopics), [selectedTopics]);

  const setLabels = [...new Set(questions.flatMap((q) => (q.set ? [q.set] : [])))];
  const visibleQuestions = activeSet === "all" ? questions : questions.filter((q) => q.set === activeSet);

  return (
    <div className="space-y-4">
      {rebuildBanner && (
        <div className="flex items-start justify-between gap-3 bg-burgundy/5 dark:bg-burgundy/10 text-burgundy-dark dark:text-burgundy/50 rounded-xl px-4 py-3 text-sm">
          <p>{rebuildBanner}</p>
          <button type="button" onClick={() => setRebuildBanner("")} className="shrink-0 text-burgundy/70 hover:text-burgundy">✕</button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: generation config */}
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 space-y-5 h-fit">
        <div>
          <label className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1.5">Question type</label>
          <div className="flex gap-2 p-1 bg-inkscale-50 dark:bg-white/5 rounded-lg">
            <button type="button" onClick={() => setQuestionType(QUESTION_TYPES.SHORT)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                questionType === QUESTION_TYPES.SHORT ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
              Short Answer
            </button>
            <button type="button" onClick={() => { setQuestionType(QUESTION_TYPES.MCQ); setMode(MODES.SINGLE); }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition ${
                questionType === QUESTION_TYPES.MCQ ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
              <ListTodo size={12} /> MCQ
            </button>
            <button type="button" onClick={() => { setQuestionType(QUESTION_TYPES.DIAGRAM); setMode(MODES.SINGLE); }}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition ${
                questionType === QUESTION_TYPES.DIAGRAM ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
              <GitBranch size={12} /> Diagram
            </button>
          </div>
          {questionType === QUESTION_TYPES.DIAGRAM && (
            <p className="text-xs text-inkscale-300 mt-1.5">
              Graph/tree questions for Data Structures topics — the diagram and the correct
              answer are both computed by a real algorithm, not guessed by the AI.
            </p>
          )}
        </div>

        {questionType === QUESTION_TYPES.DIAGRAM ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="gp-diagram-type" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">Diagram type</label>
              <select id="gp-diagram-type" value={diagramType} onChange={(e) => setDiagramType(e.target.value)}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
                {DIAGRAM_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="gp-diagram-nodes" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">
                Number of nodes ({diagramNumNodes})
              </label>
              <input id="gp-diagram-nodes" type="range" min="4" max="8" value={diagramNumNodes}
                onChange={(e) => setDiagramNumNodes(e.target.value)} className="w-full" />
            </div>
            <div>
              <label htmlFor="gp-diagram-marks" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">{t("marksPerQuestion")}</label>
              <input id="gp-diagram-marks" type="number" min="1" value={marks} onChange={(e) => setMarks(e.target.value)}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="button" onClick={handleGenerateDiagram} disabled={diagramLoading}
              className="w-full bg-burgundy hover:bg-burgundy-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition">
              {diagramLoading ? t("generating") : "Generate diagram question"}
            </button>
          </div>
        ) : (
          <>
        <div className="flex gap-2 p-1 bg-inkscale-50 dark:bg-white/5 rounded-lg">
          <button type="button" onClick={() => setMode(MODES.SINGLE)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition ${
              mode === MODES.SINGLE ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
            <ListChecks size={15} /> {t("singleTopic")}
          </button>
          <button type="button" onClick={() => setMode(MODES.AUTO)} disabled={questionType === QUESTION_TYPES.MCQ}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
              mode === MODES.AUTO ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
            <Wand2 size={15} /> {t("autoFullPaper")}
          </button>
        </div>

        {mode === MODES.SINGLE ? (
          <div>
            <label htmlFor="gp-topic" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">{t("topic")}</label>
            {topics.length ? (
              <select id="gp-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
                {topics.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            ) : (
              <input id="gp-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder={t("noTopicTyped")}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            )}
            {questionType !== QUESTION_TYPES.MCQ && (
              <>
                <label htmlFor="gp-bloom" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mt-4 mb-1">{t("bloomLevel")}</label>
                <select id="gp-bloom" value={bloomLevel} onChange={(e) => setBloomLevel(e.target.value)}
                  className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
                  {BLOOM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </>
            )}
            <label htmlFor="gp-count" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mt-4 mb-1">{t("numQuestions")}</label>
            <input id="gp-count" type="number" min="1" max="20" value={count} onChange={(e) => setCount(e.target.value)}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-inkscale-400 dark:text-inkscale-300">{t("topicsSelected")} ({selectedTopics.length} {t("selected")})</span>
              {topics.length > 0 && (
                <button type="button" onClick={() => setSelectedTopics(selectedTopics.length === topics.length ? [] : topics)}
                  className="text-xs text-burgundy hover:underline">
                  {selectedTopics.length === topics.length ? t("deselectAll") : t("selectAll")}
                </button>
              )}
            </div>
            {!topics.length ? (
              <p className="text-xs text-inkscale-300">
                {t("noTopicsFound")} — <Link to="/upload" className="text-burgundy underline">{t("uploadNotesFirst")}</Link> {t("firstSuffix")}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-inkscale-100 dark:border-white/10 rounded-lg p-2 space-y-1">
                {topics.map((tp) => (
                  <label key={tp} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-inkscale-50 dark:hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={selectedTopicsSet.has(tp)} onChange={() => toggleTopicSelect(tp)} />
                    <span className="text-sm text-inkscale-600 dark:text-inkscale-100 truncate">{tp}</span>
                  </label>
                ))}
              </div>
            )}
            <label htmlFor="gp-target" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mt-4 mb-1">{t("targetQuestions")}</label>
            <input id="gp-target" type="number" min="6" max="200" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-inkscale-300 mt-1">{t("targetHint")}</p>
          </div>
        )}

        <div>
          <label htmlFor="gp-unit" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">
            Unit <span className="text-inkscale-300">(optional — for unit-wise papers, e.g. "Unit 1")</span>
          </label>
          <input id="gp-unit" value={unit} onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. Unit 1"
            className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="gp-difficulty" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">{t("difficulty")}</label>
            <select id="gp-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="gp-marks" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">{t("marksPerQuestion")}</label>
            <input id="gp-marks" type="number" min="1" value={marks} onChange={(e) => setMarks(e.target.value)}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label htmlFor="gp-sets" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">
              {t("numberOfSets")} <span className="text-inkscale-300">{t("numberOfSetsHint")}</span>
            </label>
            <select id="gp-sets" value={numSets} onChange={(e) => setNumSets(Number(e.target.value))}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n === 1 ? t("oneSetDefault") : `${n} sets (Set A – Set ${String.fromCharCode(64 + n)})`}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {autoProgress && !error && <p className="text-burgundy text-sm">{autoProgress}</p>}

        <p className="text-xs text-inkscale-300">
          {t("generatingIn")} <span className="font-medium text-inkscale-500 dark:text-inkscale-200">{generationLanguage}</span>
          {" — "}<Link to="/settings" className="text-burgundy underline">{t("changeInSettings")}</Link>.
        </p>

        <button type="button"
          onClick={mode === MODES.SINGLE ? handleGenerateSingle : handleGenerateAuto}
          disabled={loading || (mode === MODES.SINGLE ? !topic : !selectedTopics.length)}
          className="w-full bg-burgundy hover:bg-burgundy-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition">
          {loading
            ? t("generating")
            : mode === MODES.SINGLE
              ? `${t("generateQuestions")}${numSets > 1 ? ` (${numSets} sets)` : ""}`
              : `${t("autoGenerate")} ~${totalQuestions}${numSets > 1 ? ` × ${numSets}` : ""}`}
        </button>
          </>
        )}
      </div>

      {/* Right: results + build */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-inkscale-800 dark:text-white">{t("questionsLabel")} ({questions.length})</h2>
            <div className="flex items-center gap-3 shrink-0">
              {questions.some((q) => q.question_type === "mcq") && (
                <a
                  href={exportMcqCsvUrl(questions.filter((q) => q.question_type === "mcq").map((q) => q.id))}
                  className="flex items-center gap-1 text-xs text-inkscale-300 hover:text-burgundy"
                  title="CSV formatted for Google Forms bulk-import add-ons (Form Builder, Formswrite, etc.) — Google Forms itself has no native import"
                >
                  <Sheet size={12} /> Export MCQs (CSV)
                </a>
              )}
              {questions.length > 0 && (
                <button type="button" onClick={resetWorkspace} className="flex items-center gap-1 text-xs text-inkscale-300 hover:text-red-500">
                  <RotateCcw size={12} /> {t("startNewPaper")}
                </button>
              )}
              {visibleQuestions.length > 0 && (
                <button type="button"
                  onClick={() => {
                    const ids = visibleQuestions.map((q) => q.id);
                    const idsSet = new Set(ids);
                    const allSelected = ids.every((id) => selectedSet.has(id));
                    setSelected((prev) =>
                      allSelected ? prev.filter((id) => !idsSet.has(id)) : [...new Set([...prev, ...ids])]
                    );
                  }}
                  className="text-xs text-burgundy hover:underline"
                >
                  {visibleQuestions.every((q) => selectedSet.has(q.id)) ? t("deselectVisible") : t("selectAllVisible")}
                </button>
              )}
            </div>
          </div>

          {setLabels.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setActiveSet("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  activeSet === "all" ? "bg-inkscale-800 dark:bg-white text-white dark:text-inkscale-800" : "bg-inkscale-50 dark:bg-white/10 text-inkscale-400"}`}>
                All ({questions.length})
              </button>
              {setLabels.map((label) => (
                <button type="button" key={label} onClick={() => {
                  setActiveSet(label);
                  if (paperName === "Semester Exam Paper" || setLabels.some((l) => paperName.endsWith(l))) {
                    setPaperName(`Semester Exam Paper - ${label}`);
                  }
                }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    activeSet === label ? "bg-burgundy text-white" : "bg-inkscale-50 dark:bg-white/10 text-inkscale-400"}`}>
                  {label} ({questions.filter((q) => q.set === label).length})
                </button>
              ))}
            </div>
          )}

          {!questions.length && <p className="text-sm text-inkscale-300">{t("questionsWillAppear")}</p>}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {visibleQuestions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  selected={selectedSet.has(q.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Unit-wise section builder — optional, only shows once questions exist */}
        {questions.length > 0 && (
          <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-burgundy" />
              <h2 className="font-semibold text-inkscale-800 dark:text-white">Unit-wise sections</h2>
              <span className="text-xs text-inkscale-300">(optional)</span>
            </div>
            <p className="text-xs text-inkscale-300">
              Select questions above for one unit, name it, and add it as a section. Repeat per unit — the
              final paper will have Section A, Section B, etc., each with its own subtotal.
            </p>

            <div className="flex gap-2">
              <input
                value={sectionNameDraft}
                onChange={(e) => setSectionNameDraft(e.target.value)}
                placeholder={`e.g. Section ${String.fromCharCode(65 + paperSections.length)} — Unit ${paperSections.length + 1}`}
                className="flex-1 border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!selected.length || !sectionNameDraft.trim()}
                onClick={() => {
                  setPaperSections((prev) => [...prev, { name: sectionNameDraft.trim(), questionIds: [...selected] }]);
                  setSelected([]);
                  setSectionNameDraft("");
                }}
                className="shrink-0 bg-burgundy hover:bg-burgundy-dark text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition"
              >
                Add as section ({selected.length})
              </button>
            </div>

            {paperSections.length > 0 && (
              <div className="space-y-2 pt-2">
                {paperSections.map((section, idx) => {
                  const sectionMarks = section.questionIds.reduce((sum, id) => {
                    const q = questions.find((qq) => qq.id === id);
                    return sum + (q ? q.marks : 0);
                  }, 0);
                  return (
                    <div key={idx} className="flex items-center justify-between border border-inkscale-50 dark:border-white/10 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-inkscale-700 dark:text-inkscale-100">{section.name}</p>
                        <p className="text-xs text-inkscale-300">{section.questionIds.length} questions · {sectionMarks} marks</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaperSections((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-inkscale-200 hover:text-red-500 p-1"
                        aria-label={`Remove section ${section.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {questions.length > 0 && (
          <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 space-y-4">
            <h2 className="font-semibold text-inkscale-800 dark:text-white">
              {t("buildPaper")} ({paperSections.length > 0
                ? `${paperSections.length} sections, ${paperSections.reduce((s, sec) => s + sec.questionIds.length, 0)} questions`
                : `${selected.length} ${t("selected")}`})
            </h2>

            {justBuilt && downloadUrl && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg px-3 py-2 text-xs">
                Paper built! Selection cleared — pick more questions for another paper, or{" "}
                <button type="button" onClick={resetWorkspace} className="underline font-medium">start fresh</button>.
              </div>
            )}

            <div className="flex gap-2 p-1 bg-inkscale-50 dark:bg-white/5 rounded-lg">
              <button type="button" onClick={() => setOutputMode(OUTPUT_MODES.STANDARD)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition ${
                  outputMode === OUTPUT_MODES.STANDARD ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
                {t("standardPdf")}
              </button>
              <button type="button" onClick={() => setOutputMode(OUTPUT_MODES.UNIVERSITY)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition ${
                  outputMode === OUTPUT_MODES.UNIVERSITY ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
                <Building2 size={12} /> University
              </button>
              <button type="button" onClick={() => setOutputMode(OUTPUT_MODES.TEMPLATE)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition ${
                  outputMode === OUTPUT_MODES.TEMPLATE ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
                {t("useCollegeTemplate")}
              </button>
            </div>

            {templates.length > 0 && (
              <div>
                <label htmlFor="gp-template" className="block text-sm text-inkscale-400 dark:text-inkscale-300 mb-1">Load a saved template</label>
                <div className="flex gap-2">
                  <select id="gp-template" defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                    className="flex-1 border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm">
                    <option value="">Choose a template...</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.output_mode})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <input value={paperName} onChange={(e) => setPaperName(e.target.value)} placeholder={t("paperNamePlaceholder")}
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />

            {outputMode === OUTPUT_MODES.STANDARD && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={institution} onChange={(e) => setInstitution(e.target.value)}
                    placeholder={t("institutionPlaceholder")}
                    className="col-span-2 w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder={t("coursePlaceholder")}
                    className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t("durationPlaceholder")}
                    className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
                  <input type="number" value={maxMarksOverride} onChange={(e) => setMaxMarksOverride(e.target.value)}
                    placeholder={t("maxMarksPlaceholder")}
                    className="col-span-2 w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
                </div>

                <label className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200 border border-dashed border-inkscale-100 dark:border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:border-burgundy/70">
                  <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files[0])} />
                  {logoUploading ? <span className="text-inkscale-300">{t("uploadingLogo")}</span> : logoFilename ? (
                    <><Check size={15} className="text-emerald-500" /> {logoFilename}</>
                  ) : (
                    <><ImageIcon size={15} /> {t("uploadLogoOptional")}</>
                  )}
                </label>
              </div>
            )}

            {outputMode === OUTPUT_MODES.UNIVERSITY && (
              <div className="space-y-3">
                <UniversityFormatFields meta={universityMeta} onChange={setUniversityMeta} />
                <label className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200 border border-dashed border-inkscale-100 dark:border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:border-burgundy/70">
                  <input type="file" accept=".png,.jpg,.jpeg" className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files[0])} />
                  {logoUploading ? <span className="text-inkscale-300">{t("uploadingLogo")}</span> : logoFilename ? (
                    <><Check size={15} className="text-emerald-500" /> {logoFilename}</>
                  ) : (
                    <><ImageIcon size={15} /> University logo (optional)</>
                  )}
                </label>
                <p className="text-xs text-inkscale-300">
                  Marks and CO/L columns are filled in automatically from each question's marks and
                  Bloom's level — CO number comes from the Unit you tagged when generating.
                </p>
              </div>
            )}

            {outputMode !== OUTPUT_MODES.TEMPLATE && (
              <div className="flex gap-2">
                <input value={templateNameDraft} onChange={(e) => setTemplateNameDraft(e.target.value)}
                  placeholder="Template name (e.g. Java Mid Term)"
                  className="flex-1 border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
                <button type="button" onClick={handleSaveTemplate} disabled={savingTemplate || !templateNameDraft.trim()}
                  className="shrink-0 flex items-center gap-1.5 text-sm text-burgundy hover:text-burgundy-dark border border-burgundy/25 dark:border-burgundy/30 rounded-lg px-3 py-2 disabled:opacity-40">
                  <BookmarkPlus size={14} /> Save
                </button>
              </div>
            )}
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] text-inkscale-300 self-center">Load:</span>
                {templates.map((tpl) => (
                  <span key={tpl.id} className="flex items-center gap-1 text-[11px] bg-inkscale-50 dark:bg-white/10 text-inkscale-400 dark:text-inkscale-300 rounded-full pl-1 pr-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-1.5 py-0.5 rounded-full hover:bg-white dark:hover:bg-inkscale-700 hover:text-burgundy transition"
                      title={`Load "${tpl.name}" into the form below`}
                    >
                      {tpl.name}
                    </button>
                    <button type="button" onClick={() => handleDeleteTemplate(tpl.id)} className="hover:text-red-500 px-1">✕</button>
                  </span>
                ))}
              </div>
            )}

            {outputMode === OUTPUT_MODES.TEMPLATE && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200 border border-dashed border-inkscale-100 dark:border-white/10 rounded-lg px-3 py-2.5 cursor-pointer hover:border-burgundy/70">
                  <input type="file" accept=".docx" className="hidden"
                    onChange={(e) => handleTemplateUpload(e.target.files[0])} />
                  {templateUploading ? <span className="text-inkscale-300">{t("uploadingTemplate")}</span> : templateFilename ? (
                    <><Check size={15} className="text-emerald-500" /> {templateFilename}</>
                  ) : (
                    <><FileUp size={15} /> {t("uploadTemplateLabel")}</>
                  )}
                </label>
                {templateFilename && (
                  <p className="text-xs text-inkscale-300">
                    {templateHasPlaceholder ? t("templatePlaceholderFound") : t("templatePlaceholderMissing")}
                  </p>
                )}
              </div>
            )}

            {outputMode !== OUTPUT_MODES.UNIVERSITY && (
            <label className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200">
              <input type="checkbox" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} />
              {t("includeAnswerKey")}
            </label>
            )}

            <label className="flex items-center gap-2 text-sm text-inkscale-500 dark:text-inkscale-200">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              Shuffle question order (anti-cheating)
            </label>
            <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="Watermark text (e.g. CONFIDENTIAL) — optional"
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
            <input value={qrContent} onChange={(e) => setQrContent(e.target.value)}
              placeholder="QR code content (URL/text) — optional"
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />

            <button type="button"
              onClick={handleBuildPaper}
              disabled={(paperSections.length === 0 && !selected.length) || buildLoading}
              className="w-full bg-inkscale-800 dark:bg-white dark:text-inkscale-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition">
              {buildLoading ? t("building") : t("buildPaper")}
            </button>

            {downloadUrl && (
              <div className="space-y-2">
                <a href={downloadUrl}
                  className="block text-center bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition">
                  {t("download")} {outputMode === OUTPUT_MODES.TEMPLATE ? "DOCX" : "PDF"}
                </a>
                <button type="button" onClick={() => setShowPreview((v) => !v)}
                  disabled={outputMode === OUTPUT_MODES.TEMPLATE}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-inkscale-400 dark:text-inkscale-300 hover:text-burgundy border border-inkscale-100 dark:border-white/10 rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  <Eye size={14} /> {showPreview ? "Hide preview" : "Preview in browser"}
                </button>
                {showPreview && outputMode !== OUTPUT_MODES.TEMPLATE && builtPaperId && (
                  <iframe
                    src={previewPaperUrl(builtPaperId)}
                    title="Paper preview"
                    className="w-full h-[500px] rounded-lg border border-inkscale-100 dark:border-white/10"
                  />
                )}
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
    </div>
  );
}

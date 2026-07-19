export default function UniversityFormatFields({ meta, onChange }) {
  function set(key) {
    return (e) => onChange({ ...meta, [key]: e.target.value });
  }

  const inputClass = "w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm";

  return (
    <div className="space-y-2">
      <input value={meta.universityName} onChange={set("universityName")} placeholder="University name"
        className={inputClass} />
      <div className="grid grid-cols-2 gap-2">
        <select value={meta.examTitle} onChange={set("examTitle")} className={inputClass}>
          <option value="MID TERM EXAMINATION">Mid Term Examination</option>
          <option value="END SEMESTER EXAMINATION">End Semester Examination</option>
        </select>
        <input value={meta.semesterLabel} onChange={set("semesterLabel")} placeholder="e.g. Odd Semester 2024-25"
          className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={meta.school} onChange={set("school")} placeholder="School (e.g. SOET)" className={inputClass} />
        <input value={meta.programme} onChange={set("programme")} placeholder="Programme (e.g. BCA)" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={meta.courseCode} onChange={set("courseCode")} placeholder="Course code" className={inputClass} />
        <input value={meta.courseName} onChange={set("courseName")} placeholder="Course name" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input value={meta.semester} onChange={set("semester")} placeholder="Semester" className={inputClass} />
        <input value={meta.timeStr} onChange={set("timeStr")} placeholder="Time (e.g. 1 Hr)" className={inputClass} />
        <input type="number" value={meta.maxMarks} onChange={set("maxMarks")} placeholder="Max marks" className={inputClass} />
      </div>
      <textarea value={meta.instructions} onChange={set("instructions")} rows={2}
        placeholder="Instructions (e.g. All questions are compulsory.)"
        className={`${inputClass} resize-none`} />
    </div>
  );
}

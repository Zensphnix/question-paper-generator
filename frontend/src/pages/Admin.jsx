import { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ShieldCheck, Mail, Users, MessageSquare, Bug, Sparkles, CheckCircle2, XCircle, Reply, Send, CornerDownRight } from "lucide-react";
import { adminListFeedback, adminListUsers, adminReplyFeedback } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

const categoryIcon = { bug: Bug, feature: Sparkles, general: MessageSquare };
const categoryColor = {
  bug: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  feature: "bg-burgundy/10 text-burgundy-dark dark:bg-burgundy/10 dark:text-burgundy/50",
  general: "bg-inkscale-50 text-inkscale-500 dark:bg-white/10 dark:text-inkscale-200",
};

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// Uses no component state — building it fresh inside FeedbackItem on every
// render was wasted work (and would've defeated React.memo if we ever
// wrapped this component in one later).
function mailtoFor(email, name, category) {
  const subject = encodeURIComponent(`Re: your ${category || "feedback"} on QPaper AI`);
  const body = encodeURIComponent(`Hi ${name || ""},\n\nThanks for your feedback — `);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function FeedbackItem({ f, index, onReplied }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(f.reply || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const Icon = categoryIcon[f.category] || MessageSquare;

  async function handleSendReply() {
    if (!replyText.trim()) return;
    setSending(true); setError("");
    try {
      const result = await adminReplyFeedback(f.id, replyText);
      onReplied(f.id, result.reply, result.reply_at);
      setReplyOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryColor[f.category] || categoryColor.general}`}>
              <Icon size={11} /> {f.category}
            </span>
            <span className="text-xs font-medium text-inkscale-600 dark:text-inkscale-200">{f.user_name}</span>
            <span className="text-[11px] text-inkscale-300">{new Date(f.created_at).toLocaleString()}</span>
          </div>
          <p className="text-sm text-inkscale-600 dark:text-inkscale-200">{f.message}</p>

          {f.reply && !replyOpen && (
            <div className="mt-3 flex items-start gap-2 bg-burgundy/5 dark:bg-burgundy/10 rounded-lg p-2.5">
              <CornerDownRight size={13} className="text-burgundy mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-inkscale-600 dark:text-inkscale-200">{f.reply}</p>
                <p className="text-[10px] text-inkscale-300 mt-1">Replied {new Date(f.reply_at).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button type="button" onClick={() => setReplyOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-burgundy hover:text-burgundy-dark font-medium border border-burgundy/25 dark:border-burgundy/30 rounded-lg px-3 py-1.5">
            <Reply size={13} /> {f.reply ? "Edit reply" : "Reply"}
          </button>
          {f.user_email && (
            <a href={mailtoFor(f.user_email, f.user_name, f.category)}
              className="flex items-center gap-1.5 text-xs text-inkscale-400 hover:text-inkscale-600 dark:hover:text-inkscale-200 font-medium border border-inkscale-100 dark:border-white/10 rounded-lg px-3 py-1.5">
              <Mail size={13} /> Email
            </a>
          )}
        </div>
      </div>

      <AnimatePresence>
        {replyOpen && (
          <m.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-3 overflow-hidden">
            <textarea
              value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2}
              placeholder="Type your reply — it'll show up in their notification bell..."
              className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm resize-none"
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => setReplyOpen(false)} className="text-xs text-inkscale-300 px-3 py-1.5">Cancel</button>
              <button type="button" onClick={handleSendReply} disabled={sending || !replyText.trim()}
                className="flex items-center gap-1.5 text-xs font-medium bg-burgundy hover:bg-burgundy-dark text-white px-3 py-1.5 rounded-lg disabled:opacity-40">
                <Send size={12} /> {sending ? "Sending..." : "Send reply"}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export default function Admin() {
  const { t } = useLanguage();
  const [tab, setTab] = useState("feedback");
  const [feedback, setFeedback] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminListFeedback(), adminListUsers()])
      .then(([fb, u]) => { setFeedback(fb); setUsers(u); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleReplied(feedbackId, reply, replyAt) {
    setFeedback((prev) => prev.map((f) => f.id === feedbackId ? { ...f, reply, reply_at: replyAt } : f));
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-inkscale-300 mt-2">Only the first registered account (the owner) can see this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-burgundy" />
        <h2 className="text-lg font-semibold text-inkscale-800 dark:text-white">Owner dashboard</h2>
      </div>

      <div className="flex gap-2 p-1 bg-inkscale-50 dark:bg-white/5 rounded-lg w-fit">
        <button type="button" onClick={() => setTab("feedback")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "feedback" ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
          <MessageSquare size={14} /> Feedback ({feedback.length})
        </button>
        <button type="button" onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "users" ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"}`}>
          <Users size={14} /> Users ({users.length})
        </button>
      </div>

      {loading && <p className="text-sm text-inkscale-300">{t("loading")}</p>}

      {!loading && tab === "feedback" && (
        <div className="space-y-2">
          {feedback.length === 0 && (
            <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-8 text-center text-inkscale-300 text-sm">
              No feedback submitted by anyone yet.
            </div>
          )}
          {feedback.map((f, i) => (
            <FeedbackItem key={f.id} f={f} index={i} onReplied={handleReplied} />
          ))}
        </div>
      )}

      {!loading && tab === "users" && (
        <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-inkscale-50 dark:border-white/10 last:border-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-burgundy/70 to-gold/70 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initials(u.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-inkscale-700 dark:text-inkscale-100">
                  {u.name} {u.role === "admin" && <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-burgundy/50">owner</span>}
                </p>
                <p className="text-xs text-inkscale-300">{u.email}</p>
              </div>
              {u.is_verified ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              ) : (
                <XCircle size={16} className="text-inkscale-200 shrink-0" />
              )}
              <a href={`mailto:${u.email}`} aria-label={`Email ${u.name}`} className="shrink-0 text-inkscale-300 hover:text-burgundy">
                <Mail size={16} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

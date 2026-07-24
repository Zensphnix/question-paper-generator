import { useState, useEffect, useRef } from "react";
import {
  Users, FileText, Zap, Activity, Search, MoreVertical,
  ShieldCheck, ShieldAlert, ServerCog, Database, TrendingUp,
  CircleDot, Ban, Crown, LayoutGrid, Settings as SettingsIcon,
  Eye, Trash2, Sliders, Globe, Save, MessageSquareText,
  Send, CheckCircle2, Circle, Sparkles, X, Megaphone,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  adminOverview, adminListUsers, adminToggleUserSuspension, adminListPapers,
  adminDeletePaper, adminListFeedback, adminReplyFeedback, adminUpdateFeedbackStatus,
  adminGetSettings, adminUpdateSettings, adminCreateAnnouncement, adminListAnnouncements,
} from "../services/api.js";

// Matches the app's established design tokens exactly (navy / gold / burgundy / cream).
const NAVY = "#1F2B40";
const GOLD = "#B8934C";
const BURGUNDY = "#7A3340";
const CREAM = "#FAF7F1";
const GREEN = "#3F6B4F";

const AVATAR_PALETTE = [GOLD, BURGUNDY, NAVY, "#5B6472", GREEN];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "?").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function Avatar({ name, size = 32 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{ backgroundColor: avatarColor(name), width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function StatCard({ icon: Icon, label, value, sublabel, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-semibold tracking-wider uppercase text-inkscale-400">{label}</p>
        <p className="text-3xl font-semibold text-inkscale-800 mt-2">{value}</p>
        {sublabel && <p className="text-xs text-inkscale-400 mt-1">{sublabel}</p>}
      </div>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${accent}25, ${accent}10)`, color: accent }}
      >
        <Icon size={18} />
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const isOwner = role === "admin";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: isOwner ? GOLD + "20" : "#E2E8F0", color: isOwner ? "#7A5F1F" : "#475569" }}>
      {isOwner && <Crown size={11} />}
      {isOwner ? "Owner" : "Teacher"}
    </span>
  );
}

function StatusDot({ suspended }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: suspended ? BURGUNDY : GREEN }}>
      <CircleDot size={10} className={suspended ? "opacity-70" : ""} />
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white shadow-lg ring-1 ring-black/10 rounded-xl px-4 py-3 flex items-center gap-2.5">
      <CheckCircle2 size={16} style={{ color: GREEN }} />
      <span className="text-sm text-inkscale-700">{toast}</span>
      <button onClick={onClose} className="text-inkscale-300 hover:text-inkscale-500 ml-2">
        <X size={14} />
      </button>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "users", label: "Users", icon: Users },
  { id: "papers", label: "Papers", icon: FileText },
  { id: "feedback", label: "Feedback", icon: MessageSquareText },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [papers, setPapers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [settings, setSettings] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    Promise.all([adminOverview(), adminListUsers(), adminListPapers(), adminListFeedback(), adminGetSettings(), adminListAnnouncements()])
      .then(([ov, us, pp, fb, st, an]) => {
        setOverview(ov);
        setUsers(us);
        setPapers(pp);
        setFeedback(fb);
        setSettings(st);
        setAnnouncements(an);
        if (fb.length) setSelectedTicketId(fb[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function sendAnnouncement() {
    if (!announcementDraft.trim()) return;
    setSendingAnnouncement(true);
    try {
      const created = await adminCreateAnnouncement(announcementDraft.trim());
      setAnnouncements((prev) => [created, ...prev]);
      setAnnouncementDraft("");
      showToast("Announcement sent to all users");
    } catch (e) { showToast(e.message); }
    finally { setSendingAnnouncement(false); }
  }

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
  );

  async function toggleUserStatus(id) {
    const u = users.find((x) => x.id === id);
    try {
      await adminToggleUserSuspension(id, !u.is_suspended);
      setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, is_suspended: !x.is_suspended } : x)));
      showToast(u.is_suspended ? `${u.name} reinstated` : `${u.name} suspended`);
    } catch (e) { showToast(e.message); }
    setOpenMenuId(null);
  }

  async function deletePaper(id) {
    const p = papers.find((x) => x.id === id);
    try {
      await adminDeletePaper(id);
      setPapers((prev) => prev.filter((x) => x.id !== id));
      showToast(`Deleted "${p.title}"`);
    } catch (e) { showToast(e.message); }
  }

  async function saveSettings() {
    try {
      const updated = await adminUpdateSettings(settings);
      setSettings(updated);
      showToast("Settings saved");
    } catch (e) { showToast(e.message); }
  }

  const selectedTicket = feedback.find((f) => f.id === selectedTicketId);
  const openCount = feedback.filter((f) => f.status !== "resolved").length;

  async function sendReply() {
    if (!replyText.trim() || !selectedTicket) return;
    try {
      await adminReplyFeedback(selectedTicket.id, replyText.trim());
      setFeedback((prev) => prev.map((f) => (
        f.id === selectedTicketId ? { ...f, reply: replyText.trim(), reply_at: new Date().toISOString() } : f
      )));
      setReplyText("");
      showToast("Reply sent");
    } catch (e) { showToast(e.message); }
  }

  async function toggleResolved(id) {
    const f = feedback.find((x) => x.id === id);
    const newStatus = f.status === "resolved" ? "open" : "resolved";
    try {
      await adminUpdateFeedbackStatus(id, newStatus);
      setFeedback((prev) => prev.map((x) => (x.id === id ? { ...x, status: newStatus } : x)));
      showToast("Ticket updated");
    } catch (e) { showToast(e.message); }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM }}>
      <p className="text-inkscale-400 text-sm">Loading admin panel...</p>
    </div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM }}>
      <p className="text-burgundy text-sm">{error}</p>
    </div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl flex items-center gap-2 font-serif" style={{ color: NAVY }}>
              Admin Panel <Sparkles size={20} style={{ color: GOLD }} />
            </h1>
            <p className="text-inkscale-400 text-sm mt-1">Platform overview, users, papers, feedback, and settings.</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm ring-1 ring-black/5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors relative"
                style={{ color: active ? "#fff" : "#64748B", backgroundColor: active ? NAVY : "transparent" }}
              >
                <Icon size={14} /> {t.label}
                {t.id === "feedback" && openCount > 0 && (
                  <span className="ml-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                    style={{ backgroundColor: active ? GOLD : BURGUNDY, color: "#fff" }}>
                    {openCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ---------------- OVERVIEW ---------------- */}
        {tab === "overview" && overview && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Users} label="Total Users" value={overview.total_users} sublabel={`${overview.active_teachers} active teachers`} accent={GOLD} />
              <StatCard icon={FileText} label="Papers Generated" value={overview.total_papers} sublabel="All time" accent={BURGUNDY} />
              <StatCard icon={Zap} label="Questions Today" value={overview.questions_generated_today} sublabel="Generated today" accent={NAVY} />
              <StatCard icon={Activity} label="Active Teachers" value={overview.active_teachers} sublabel="Not suspended" accent={GREEN} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
                <h2 className="font-semibold text-inkscale-700 mb-1">Papers Generated — Last 7 Days</h2>
                <p className="text-xs text-inkscale-400 mb-4">Platform-wide, across all teachers</p>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={overview.papers_trend} margin={{ left: -20, top: 5, right: 10 }}>
                      <defs>
                        <linearGradient id="papersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEE8DA" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #EEE8DA" }} />
                      <Area type="monotone" dataKey="papers" stroke={GOLD} strokeWidth={2} fill="url(#papersGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
                <h2 className="font-semibold text-inkscale-700 mb-1">Bloom's Coverage</h2>
                <p className="text-xs text-inkscale-400 mb-4">Platform-wide question distribution</p>
                <div className="space-y-2.5">
                  {overview.bloom_coverage.map((b) => (
                    <div key={b.level}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-inkscale-600">{b.level}</span>
                        <span className="text-inkscale-400">{b.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-inkscale-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: BURGUNDY }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
                <h2 className="font-semibold text-inkscale-700 mb-4 flex items-center gap-2">
                  <ServerCog size={16} style={{ color: GOLD }} /> System
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-inkscale-500">Frontend (Vercel)</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-inkscale-500 flex items-center gap-1.5"><Database size={13} /> Backend (Render)</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                    </span>
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-black/5">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-inkscale-500">Daily Gemini rate limit</span>
                    <span className="font-medium text-inkscale-700">{settings?.daily_rate_limit}</span>
                  </div>
                  <p className="text-xs text-inkscale-400 mt-1.5">Adjust this in Settings</p>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
                <h2 className="font-semibold text-inkscale-700 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: BURGUNDY }} /> Recent Activity
                </h2>
                {overview.activity.length === 0 ? (
                  <p className="text-sm text-inkscale-400">No activity yet.</p>
                ) : (
                  <ul className="space-y-3.5">
                    {overview.activity.map((a, i) => (
                      <li key={i} className="text-sm border-l-2 pl-3" style={{ borderColor: GOLD + "60" }}>
                        <p className="text-inkscale-700">
                          <span className="font-medium">{a.who}</span> <span className="text-inkscale-500">{a.what}</span>{" "}
                          <span className="font-medium">{a.where}</span>
                        </p>
                        <p className="text-xs text-inkscale-400 mt-0.5">{timeAgo(a.when)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        {/* ---------------- USERS ---------------- */}
        {tab === "users" && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
              <h2 className="font-semibold text-inkscale-700">Users</h2>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-inkscale-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-inkscale-200 focus:outline-none focus:ring-2 w-48"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-inkscale-400 border-b border-black/5">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium">Papers</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-black/5 last:border-0 hover:bg-inkscale-50/80 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} />
                        <div>
                          <p className="font-medium text-inkscale-800">{u.name}</p>
                          <p className="text-xs text-inkscale-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-5 py-3 text-inkscale-600">{u.papers}</td>
                    <td className="px-5 py-3"><StatusDot suspended={u.is_suspended} /></td>
                    <td className="px-5 py-3 text-right relative">
                      <button onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)} className="p-1.5 rounded-md hover:bg-inkscale-100 text-inkscale-400">
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === u.id && (
                        <div className="absolute right-5 top-9 z-10 bg-white ring-1 ring-black/10 rounded-lg shadow-lg py-1 w-48 text-left">
                          {u.role !== "admin" && (
                            u.is_suspended ? (
                              <button onClick={() => toggleUserStatus(u.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-inkscale-50">
                                <ShieldAlert size={13} /> Reinstate account
                              </button>
                            ) : (
                              <button onClick={() => toggleUserStatus(u.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-inkscale-50" style={{ color: BURGUNDY }}>
                                <Ban size={13} /> Suspend account
                              </button>
                            )
                          )}
                          {u.role === "admin" && (
                            <p className="px-3 py-2 text-xs text-inkscale-400 flex items-center gap-2"><ShieldCheck size={13} /> Owner account</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-inkscale-400 text-sm">No users match "{query}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------- PAPERS ---------------- */}
        {tab === "papers" && (
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-black/5">
              <h2 className="font-semibold text-inkscale-700">All Papers</h2>
              <p className="text-xs text-inkscale-400 mt-0.5">Platform-wide, across every teacher — for moderation and support.</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-inkscale-400 border-b border-black/5">
                  <th className="px-5 py-2.5 font-medium">Title</th>
                  <th className="px-5 py-2.5 font-medium">Author</th>
                  <th className="px-5 py-2.5 font-medium">Questions</th>
                  <th className="px-5 py-2.5 font-medium">Marks</th>
                  <th className="px-5 py-2.5 font-medium">Created</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-inkscale-50/80 transition-colors">
                    <td className="px-5 py-3"><p className="font-medium text-inkscale-800">{p.title}</p></td>
                    <td className="px-5 py-3 text-inkscale-600">{p.author}</td>
                    <td className="px-5 py-3 text-inkscale-600">{p.questions}</td>
                    <td className="px-5 py-3 text-inkscale-600">{p.marks}</td>
                    <td className="px-5 py-3 text-inkscale-400 text-xs">{timeAgo(p.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => deletePaper(p.id)} className="p-1.5 rounded-md hover:bg-inkscale-100" style={{ color: BURGUNDY }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {papers.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-inkscale-400 text-sm">No papers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------- FEEDBACK ---------------- */}
        {tab === "feedback" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 480 }}>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden flex flex-col">
              <div className="px-4 py-3.5 border-b border-black/5">
                <h2 className="font-semibold text-inkscale-700 text-sm">Support Inbox</h2>
                <p className="text-xs text-inkscale-400 mt-0.5">{openCount} open · {feedback.length} total</p>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-black/5">
                {feedback.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedTicketId(f.id)}
                    className="w-full text-left px-4 py-3.5 flex gap-2.5 hover:bg-inkscale-50/80 transition-colors"
                    style={{ backgroundColor: selectedTicketId === f.id ? CREAM : "transparent" }}
                  >
                    <Avatar name={f.user_name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-inkscale-800 truncate">{f.user_name}</p>
                        {!f.reply && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BURGUNDY }} />}
                      </div>
                      <p className="text-xs text-inkscale-500 truncate mt-0.5">{f.message}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium mt-1.5 px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: f.status === "resolved" ? GREEN + "15" : BURGUNDY + "15",
                          color: f.status === "resolved" ? GREEN : BURGUNDY,
                        }}>
                        {f.status === "resolved" ? <CheckCircle2 size={9} /> : <Circle size={8} />}
                        {f.status === "resolved" ? "Resolved" : "Open"}
                      </span>
                    </div>
                  </button>
                ))}
                {feedback.length === 0 && <p className="px-4 py-8 text-center text-inkscale-400 text-sm">No feedback yet.</p>}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-black/5 flex flex-col overflow-hidden">
              {selectedTicket ? (
                <>
                  <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedTicket.user_name} size={36} />
                      <div>
                        <p className="font-medium text-inkscale-800">{selectedTicket.user_name}</p>
                        <p className="text-xs text-inkscale-400">{selectedTicket.user_email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleResolved(selectedTicket.id)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      style={{
                        backgroundColor: selectedTicket.status !== "resolved" ? GREEN + "15" : "#E2E8F0",
                        color: selectedTicket.status !== "resolved" ? GREEN : "#475569",
                      }}
                    >
                      <CheckCircle2 size={13} />
                      {selectedTicket.status !== "resolved" ? "Mark resolved" : "Reopen"}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm bg-inkscale-100 text-inkscale-700"
                        style={{ borderBottomLeftRadius: 4 }}>
                        <p>{selectedTicket.message}</p>
                        <p className="text-[10px] mt-1 opacity-60">{timeAgo(selectedTicket.created_at)}</p>
                      </div>
                    </div>
                    {selectedTicket.reply && (
                      <div className="flex justify-end">
                        <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm text-white"
                          style={{ backgroundColor: NAVY, borderBottomRightRadius: 4 }}>
                          <p>{selectedTicket.reply}</p>
                          <p className="text-[10px] mt-1 opacity-60">{timeAgo(selectedTicket.reply_at)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-black/5 flex items-center gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendReply()}
                      placeholder="Type a reply..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-inkscale-200 text-sm focus:outline-none focus:ring-2"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim()}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                      style={{ backgroundColor: NAVY }}
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-inkscale-400 text-sm">Select a ticket to view</div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- SETTINGS ---------------- */}
        {tab === "settings" && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 lg:col-span-2">
              <h2 className="font-semibold text-inkscale-700 mb-4 flex items-center gap-2">
                <Megaphone size={16} style={{ color: GOLD }} /> Broadcast Announcement
              </h2>
              <p className="text-xs text-inkscale-400 mb-3">
                Sent instantly to every user's notification bell — no email, shows up next time they check.
              </p>
              <textarea
                value={announcementDraft}
                onChange={(e) => setAnnouncementDraft(e.target.value)}
                rows={3}
                placeholder="e.g. Scheduled maintenance tonight 11 PM–12 AM IST — generation will be paused briefly."
                className="w-full px-3 py-2.5 rounded-lg border border-inkscale-200 text-sm focus:outline-none focus:ring-2 resize-none"
              />
              <button
                onClick={sendAnnouncement}
                disabled={!announcementDraft.trim() || sendingAnnouncement}
                className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: NAVY }}
              >
                <Send size={14} /> {sendingAnnouncement ? "Sending..." : "Send to all users"}
              </button>

              {announcements.length > 0 && (
                <div className="mt-5 pt-4 border-t border-black/5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-inkscale-400 mb-2.5">Past announcements</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {announcements.map((a) => (
                      <div key={a.id} className="text-sm bg-inkscale-50 rounded-lg px-3 py-2">
                        <p className="text-inkscale-700">{a.message}</p>
                        <p className="text-[11px] text-inkscale-400 mt-0.5">{timeAgo(a.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
              <h2 className="font-semibold text-inkscale-700 mb-4 flex items-center gap-2">
                <Sliders size={16} style={{ color: GOLD }} /> Rate Limits
              </h2>
              <label className="block text-sm text-inkscale-600 mb-1.5">Daily Gemini API call limit (platform-wide)</label>
              <input
                type="number"
                value={settings.daily_rate_limit}
                onChange={(e) => setSettings({ ...settings, daily_rate_limit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-inkscale-200 text-sm focus:outline-none focus:ring-2"
              />
              <p className="text-xs text-inkscale-400 mt-1.5">For reference/display — actual per-endpoint limits are enforced separately.</p>

              <div className="flex items-center justify-between mt-6 pt-5 border-t border-black/5">
                <div>
                  <p className="text-sm font-medium text-inkscale-700">Maintenance mode</p>
                  <p className="text-xs text-inkscale-400">Blocks question generation for everyone except admins</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })}
                  className="w-11 h-6 rounded-full relative transition-colors"
                  style={{ backgroundColor: settings.maintenance_mode ? BURGUNDY : "#E2E8F0" }}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: settings.maintenance_mode ? "22px" : "2px" }} />
                </button>
              </div>

              <button
                onClick={saveSettings}
                className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: NAVY }}
              >
                <Save size={14} /> Save changes
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
              <h2 className="font-semibold text-inkscale-700 mb-4 flex items-center gap-2">
                <Globe size={16} style={{ color: BURGUNDY }} /> Platform Features
              </h2>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-inkscale-700">Allow self sign-up</p>
                    <p className="text-xs text-inkscale-400">New teachers can register without an invite</p>
                  </div>
                  <button onClick={() => setSettings({ ...settings, allow_self_signup: !settings.allow_self_signup })}
                    className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: settings.allow_self_signup ? GREEN : "#E2E8F0" }}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: settings.allow_self_signup ? "22px" : "2px" }} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-inkscale-700">Bilingual generation (EN/HI)</p>
                    <p className="text-xs text-inkscale-400">Show Hindi option in Generate Paper</p>
                  </div>
                  <button onClick={() => setSettings({ ...settings, bilingual_enabled: !settings.bilingual_enabled })}
                    className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: settings.bilingual_enabled ? GREEN : "#E2E8F0" }}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: settings.bilingual_enabled ? "22px" : "2px" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

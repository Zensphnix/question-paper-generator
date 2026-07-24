import { reportError } from "./errorBus.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Auth now lives in an HttpOnly cookie the browser manages automatically —
// `credentials: "include"` tells fetch to send it (and accept new ones) even
// though the frontend (Vercel) and backend (Render) are different domains.
// Nothing here ever touches localStorage for the token; JavaScript literally
// cannot read an HttpOnly cookie, which is the whole point (blocks XSS token theft).

async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { ...(options.headers || {}) },
    });
  } catch (networkErr) {
    // fetch() itself throws (not a 4xx/5xx response) when the server can't
    // be reached at all — backend not running, DNS failure, CORS block, etc.
    // This is exactly the "Failed to fetch" error hit repeatedly during
    // local development when the backend terminal wasn't running.
    reportError({
      message: "Couldn't reach the server. Check your connection, or the backend may be down.",
      source: "network",
    });
    throw new Error("Couldn't reach the server. Check your connection, or the backend may be down.");
  }

  if (res.status === 401) {
    localStorage.removeItem("authUser:v1");
    if (window.location.pathname !== "/") window.location.href = "/";
    throw new Error("Session expired — please log in again");
  }
  return res;
}

async function parseOrThrow(res, fallbackMsg) {
  if (!res.ok) {
    let detail = fallbackMsg;
    try { detail = (await res.json()).detail || fallbackMsg; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// ---------- Auth ----------
export async function register(name, email, password) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return parseOrThrow(res, "Registration failed");
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseOrThrow(res, "Login failed");
}

export async function requestLoginOtp(email) {
  const res = await fetch(`${BASE_URL}/auth/request-login-otp`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not send code");
}

export async function forgotPassword(email) {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not send reset code");
}

export async function resetPassword(email, otp, newPassword) {
  const res = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, new_password: newPassword }),
  });
  return parseOrThrow(res, "Could not reset password");
}

export async function verifyOtp(email, otp) {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  return parseOrThrow(res, "Verification failed");
}

export async function resendOtp(email) {
  const res = await fetch(`${BASE_URL}/auth/resend-otp`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not resend code");
}

export async function googleAuth(credential) {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  return parseOrThrow(res, "Google sign-in failed");
}

export async function logout() {
  const res = await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  localStorage.removeItem("authUser:v1");
  return parseOrThrow(res, "Logout failed");
}

export async function getMe() {
  const res = await apiFetch("/auth/me");
  return parseOrThrow(res, "Could not verify session");
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/profile/avatar", { method: "POST", body: formData });
  return parseOrThrow(res, "Could not upload profile picture");
}

export async function removeAvatar() {
  const res = await apiFetch("/profile/avatar", { method: "DELETE" });
  return parseOrThrow(res, "Could not remove profile picture");
}

// avatar_url from the backend is either a filename (needs our server prefix)
// or a full external URL (e.g. a Google account photo) — resolve either case.
export function resolveAvatarUrl(avatarUrl) {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http")) return avatarUrl;
  return `${BASE_URL}/avatars/${avatarUrl}`;
}

// ---------- Uploads ----------
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/upload", { method: "POST", body: formData });
  return parseOrThrow(res, "Upload failed");
}

export async function listUploads() {
  const res = await apiFetch("/uploads");
  return parseOrThrow(res, "Could not load uploads");
}

// ---------- Generation ----------
export async function generateQuestions(payload) {
  const res = await apiFetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Generation failed");
}

export async function generateAuto(payload) {
  const res = await apiFetch("/generate/auto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Auto-generation failed");
}

export async function generateDiagramQuestion(payload) {
  const res = await apiFetch("/generate/diagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Diagram question generation failed");
}

// ---------- Papers ----------
export async function buildPaper(payload) {
  const res = await apiFetch("/paper/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Paper build failed");
}

export async function buildPaperFromTemplate(payload) {
  const res = await apiFetch("/paper/build-from-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Template-based paper build failed");
}

export async function buildUniversityPaper(payload) {
  const res = await apiFetch("/paper/build-university", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "University-format paper build failed");
}

export async function listPapers() {
  const res = await apiFetch("/papers");
  return parseOrThrow(res, "Could not load papers");
}

export function downloadPaperUrl(paperId) {
  // Plain <a href> browser navigation — the download route stays intentionally
  // unauthenticated (no cookie needed) so a direct link always works.
  return `${BASE_URL}/paper/${paperId}/download`;
}

export function previewPaperUrl(paperId) {
  return `${BASE_URL}/paper/${paperId}/preview`;
}

export async function getPaperDetail(paperId) {
  const res = await apiFetch(`/papers/${paperId}`);
  return parseOrThrow(res, "Could not load paper details");
}

// ---------- Paper templates ----------
export async function listPaperTemplates() {
  const res = await apiFetch("/paper-templates");
  return parseOrThrow(res, "Could not load templates");
}

export async function savePaperTemplate(payload) {
  const res = await apiFetch("/paper-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Could not save template");
}

export async function deletePaperTemplate(id) {
  const res = await apiFetch(`/paper-templates/${id}`, { method: "DELETE" });
  return parseOrThrow(res, "Could not delete template");
}

// ---------- Similarity check ----------
export async function checkSimilarity(threshold = 0.75) {
  const res = await apiFetch(`/questions/similarity?threshold=${threshold}`);
  return parseOrThrow(res, "Could not check similarity");
}

// ---------- MCQ export ----------
export function exportMcqCsvUrl(ids) {
  const params = ids && ids.length ? `?ids=${ids.join(",")}` : "";
  return `${BASE_URL}/questions/export-mcq-csv${params}`;
}

export async function sharePaperEmail(paperId, to, message) {
  const res = await apiFetch(`/paper/${paperId}/share-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message }),
  });
  return parseOrThrow(res, "Could not share paper");
}

// ---------- Dashboard ----------
export async function getStats() {
  const res = await apiFetch("/stats");
  return parseOrThrow(res, "Could not load stats");
}

export async function getActivity() {
  const res = await apiFetch("/activity");
  return parseOrThrow(res, "Could not load activity");
}

export async function searchQuestions({ topic, bloomLevel, search, ownerId } = {}) {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (bloomLevel) params.set("bloom_level", bloomLevel);
  if (search) params.set("search", search);
  if (ownerId) params.set("owner_id", ownerId);
  const res = await apiFetch(`/questions?${params.toString()}`);
  return parseOrThrow(res, "Could not load questions");
}

export async function updateQuestion(id, { question, answer }) {
  const res = await apiFetch(`/questions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });
  return parseOrThrow(res, "Could not save changes");
}

// ---------- Logo / template ----------
export async function uploadLogo(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/logo/upload", { method: "POST", body: formData });
  return parseOrThrow(res, "Logo upload failed");
}

export async function uploadTemplate(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/template/upload", { method: "POST", body: formData });
  return parseOrThrow(res, "Template upload failed");
}

// ---------- Feedback ----------
export async function submitFeedback(category, message) {
  const res = await apiFetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, message }),
  });
  return parseOrThrow(res, "Could not send feedback");
}

export async function listFeedback() {
  const res = await apiFetch("/feedback");
  return parseOrThrow(res, "Could not load feedback history");
}

// ---------- Admin (owner only) ----------
export async function adminListFeedback() {
  const res = await apiFetch("/admin/feedback");
  return parseOrThrow(res, "Could not load feedback — admin access required");
}

export async function adminListUsers() {
  const res = await apiFetch("/admin/users");
  return parseOrThrow(res, "Could not load users — admin access required");
}

export async function adminToggleUserSuspension(userId, isSuspended) {
  const res = await apiFetch(`/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_suspended: isSuspended }),
  });
  return parseOrThrow(res, "Could not update user");
}

export async function adminListPapers() {
  const res = await apiFetch("/admin/papers");
  return parseOrThrow(res, "Could not load papers — admin access required");
}

export async function adminDeletePaper(paperId) {
  const res = await apiFetch(`/admin/papers/${paperId}`, { method: "DELETE" });
  return parseOrThrow(res, "Could not delete paper");
}

export async function adminGetSettings() {
  const res = await apiFetch("/admin/settings");
  return parseOrThrow(res, "Could not load settings — admin access required");
}

export async function adminUpdateSettings(payload) {
  const res = await apiFetch("/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(res, "Could not save settings");
}

export async function adminOverview() {
  const res = await apiFetch("/admin/overview");
  return parseOrThrow(res, "Could not load overview — admin access required");
}

export async function adminCreateAnnouncement(message) {
  const res = await apiFetch("/admin/announcements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return parseOrThrow(res, "Could not send announcement");
}

export async function adminListAnnouncements() {
  const res = await apiFetch("/admin/announcements");
  return parseOrThrow(res, "Could not load announcements");
}

export async function adminUpdateFeedbackStatus(feedbackId, status) {
  const res = await apiFetch(`/admin/feedback/${feedbackId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return parseOrThrow(res, "Could not update ticket status");
}

// ---------- Co-teacher sharing ----------
export async function inviteCoTeacher(email) {
  const res = await apiFetch("/share/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not invite");
}

export async function listMyShares() {
  const res = await apiFetch("/share/my-shares");
  return parseOrThrow(res, "Could not load shares");
}

export async function revokeShare(id) {
  const res = await apiFetch(`/share/${id}`, { method: "DELETE" });
  return parseOrThrow(res, "Could not revoke");
}

export async function listSharedWithMe() {
  const res = await apiFetch("/share/shared-with-me");
  return parseOrThrow(res, "Could not load shared banks");
}

export async function adminReplyFeedback(feedbackId, message) {
  const res = await apiFetch(`/admin/feedback/${feedbackId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return parseOrThrow(res, "Could not send reply");
}

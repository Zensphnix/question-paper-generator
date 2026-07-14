const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() },
  });

  if (res.status === 401) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    window.location.href = "/";
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return parseOrThrow(res, "Registration failed");
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseOrThrow(res, "Login failed");
}

export async function requestLoginOtp(email) {
  const res = await fetch(`${BASE_URL}/auth/request-login-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not send code");
}

export async function verifyOtp(email, otp) {
  const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  return parseOrThrow(res, "Verification failed");
}

export async function resendOtp(email) {
  const res = await fetch(`${BASE_URL}/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return parseOrThrow(res, "Could not resend code");
}

export async function googleAuth(credential) {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  return parseOrThrow(res, "Google sign-in failed");
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

export async function getMe() {
  const res = await apiFetch("/auth/me");
  return parseOrThrow(res, "Could not verify session");
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

export async function listPapers() {
  const res = await apiFetch("/papers");
  return parseOrThrow(res, "Could not load papers");
}

export function downloadPaperUrl(paperId) {
  // Plain <a href> browser navigation, no auth header — backend leaves this route open.
  return `${BASE_URL}/paper/${paperId}/download`;
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

export async function searchQuestions({ topic, bloomLevel, search } = {}) {
  const params = new URLSearchParams();
  if (topic) params.set("topic", topic);
  if (bloomLevel) params.set("bloom_level", bloomLevel);
  if (search) params.set("search", search);
  const res = await apiFetch(`/questions?${params.toString()}`);
  return parseOrThrow(res, "Could not load questions");
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

export async function adminReplyFeedback(feedbackId, message) {
  const res = await apiFetch(`/admin/feedback/${feedbackId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return parseOrThrow(res, "Could not send reply");
}

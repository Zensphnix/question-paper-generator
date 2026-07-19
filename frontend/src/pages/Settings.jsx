import { useState, useRef, useEffect } from "react";
import { Info, Languages, Camera, X, Users, UserPlus } from "lucide-react";
import { useLanguage } from "../context/useLanguage.js";
import { uploadAvatar, removeAvatar, resolveAvatarUrl, inviteCoTeacher, listMyShares, revokeShare } from "../services/api.js";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function Settings({ user, onUserUpdate }) {
  const { lang, setLang, t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const [shares, setShares] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => { listMyShares().then(setShares).catch(() => {}); }, []);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true); setInviteError("");
    try {
      await inviteCoTeacher(inviteEmail);
      setInviteEmail("");
      setShares(await listMyShares());
    } catch (err) { setInviteError(err.message); }
    finally { setInviting(false); }
  }

  async function handleRevoke(id) {
    try {
      await revokeShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch (err) { setInviteError(err.message); }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const result = await uploadAvatar(file);
      onUserUpdate(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true); setError("");
    try {
      const result = await removeAvatar();
      onUserUpdate(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const avatarSrc = resolveAvatarUrl(user?.avatar_url);

  return (
    <div className="max-w-xl space-y-4">
      {/* Profile picture */}
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <div className="flex items-center gap-2 mb-1">
          <Camera size={17} className="text-burgundy" />
          <h2 className="font-semibold text-inkscale-800 dark:text-white">{t("profilePicture")}</h2>
        </div>
        <p className="text-sm text-inkscale-400 dark:text-inkscale-300 mb-4">{t("profilePictureHint")}</p>

        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-burgundy/70 to-gold/70 flex items-center justify-center text-lg font-semibold text-white">
                {initials(user?.name)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-burgundy hover:bg-burgundy-dark text-white disabled:opacity-40 transition"
              >
                {uploading ? t("uploadingPhoto") : t("changePhoto")}
              </button>
              {avatarSrc && (
                <button type="button"
                  onClick={handleRemove}
                  disabled={uploading}
                  className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg bg-inkscale-50 dark:bg-white/10 text-inkscale-500 dark:text-inkscale-200 hover:bg-inkscale-100 dark:hover:bg-white/20 disabled:opacity-40 transition"
                >
                  <X size={14} /> {t("removePhoto")}
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Language */}
      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <div className="flex items-center gap-2 mb-1">
          <Languages size={17} className="text-burgundy" />
          <h2 className="font-semibold text-inkscale-800 dark:text-white">{t("language")}</h2>
        </div>
        <p className="text-sm text-inkscale-400 dark:text-inkscale-300 mb-4">{t("languageDesc")}</p>

        <div className="flex gap-2 p-1 bg-inkscale-50 dark:bg-white/5 rounded-lg w-fit">
          <button type="button"
            onClick={() => setLang("en")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              lang === "en" ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"
            }`}
          >
            {t("english")}
          </button>
          <button type="button"
            onClick={() => setLang("hi")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              lang === "hi" ? "bg-white dark:bg-inkscale-700 shadow text-inkscale-800 dark:text-white" : "text-inkscale-400"
            }`}
          >
            {t("hindi")}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 flex gap-3">
        <Info size={17} className="text-inkscale-300 mt-0.5 shrink-0" />
        <p className="text-sm text-inkscale-400 dark:text-inkscale-300">
          {t("languageInfoBox")}
        </p>
      </div>

      <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6">
        <div className="flex items-center gap-2 mb-1">
          <Users size={17} className="text-burgundy" />
          <h2 className="font-semibold text-inkscale-800 dark:text-white">Share my question bank</h2>
        </div>
        <p className="text-sm text-inkscale-400 dark:text-inkscale-300 mb-4">
          Give a colleague view access to your generated questions — they'll be able to pick your bank when building their own papers.
        </p>
        <form onSubmit={handleInvite} className="flex gap-2 mb-3">
          <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@college.edu"
            className="flex-1 border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={inviting}
            className="flex items-center gap-1.5 bg-burgundy hover:bg-burgundy-dark text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
            <UserPlus size={14} /> {inviting ? "Sharing..." : "Share"}
          </button>
        </form>
        {inviteError && <p className="text-xs text-red-600 mb-3">{inviteError}</p>}
        {shares.length > 0 && (
          <div className="space-y-1.5">
            {shares.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-inkscale-50 dark:bg-white/5 rounded-lg px-3 py-2">
                <span className="text-inkscale-600 dark:text-inkscale-200">{s.shared_with_email}</span>
                <button onClick={() => handleRevoke(s.id)} className="text-xs text-red-500 hover:underline">Revoke</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

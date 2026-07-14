import { useState, useRef } from "react";
import { Info, Languages, Camera, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { uploadAvatar, removeAvatar, resolveAvatarUrl } from "../services/api.js";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function Settings({ user, onUserUpdate }) {
  const { lang, setLang, t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Camera size={17} className="text-violet-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">{t("profilePicture")}</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("profilePictureHint")}</p>

        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-lg font-semibold text-white">
                {initials(user?.name)}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 transition"
              >
                {uploading ? t("uploadingPhoto") : t("changePhoto")}
              </button>
              {avatarSrc && (
                <button
                  onClick={handleRemove}
                  disabled={uploading}
                  className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 disabled:opacity-40 transition"
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Languages size={17} className="text-violet-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">{t("language")}</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t("languageDesc")}</p>

        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg w-fit">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              lang === "en" ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"
            }`}
          >
            {t("english")}
          </button>
          <button
            onClick={() => setLang("hi")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              lang === "hi" ? "bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white" : "text-slate-500"
            }`}
          >
            {t("hindi")}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex gap-3">
        <Info size={17} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("languageInfoBox")}
        </p>
      </div>
    </div>
  );
}

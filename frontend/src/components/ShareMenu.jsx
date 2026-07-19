import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Send, Mail, MessageCircle, X } from "lucide-react";
import { sharePaperEmail, downloadPaperUrl } from "../services/api.js";
import { useLanguage } from "../context/useLanguage.js";

export default function ShareMenu({ paperId, paperName, fileType }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [waPreparing, setWaPreparing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSendEmail() {
    const to = emails.split(",").map((e) => e.trim()).filter(Boolean);
    if (!to.length) { setError("Add at least one email"); return; }
    setSending(true); setError(""); setResult(null);
    try {
      const res = await sharePaperEmail(paperId, to, message);
      setResult(res);
      if (res.sent_to.length) setEmails("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleWhatsApp() {
    setError(""); setWaPreparing(true);
    try {
      const ext = fileType === "docx" ? "docx" : "pdf";
      const res = await fetch(downloadPaperUrl(paperId));
      const blob = await res.blob();
      const file = new File([blob], `${paperName}.${ext}`, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: paperName, text: `Question paper: ${paperName}` });
      } else {
        // This browser can't attach a real file to a share — fall back to a
        // text-only WhatsApp message (file attachment via web link isn't possible).
        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            `Sharing "${paperName}" — downloaded from QPaper AI. (Your browser doesn't support direct file sharing, so please attach the downloaded file manually.)`
          )}`,
          "_blank"
        );
      }
    } catch {
      setError("Could not prepare the file for sharing");
    } finally {
      setWaPreparing(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-inkscale-400 dark:text-inkscale-300 hover:text-burgundy border border-inkscale-100 dark:border-white/10 rounded-lg px-3 py-1.5 transition"
      >
        <Send size={13} /> {t("share")}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 bg-white dark:bg-inkscale-800 border border-inkscale-100 dark:border-white/10 rounded-xl shadow-xl z-50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-inkscale-800 dark:text-white">{t("sharePaper")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={14} className="text-inkscale-300" /></button>
            </div>

            <button type="button"
              onClick={handleWhatsApp}
              disabled={waPreparing}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg disabled:opacity-40 transition"
            >
              <MessageCircle size={15} /> {waPreparing ? "..." : t("shareViaWhatsApp")}
            </button>

            <div className="h-px bg-inkscale-50 dark:bg-white/10" />

            <div className="space-y-2">
              <input
                value={emails} onChange={(e) => setEmails(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-xs"
              />
              <textarea
                value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder={t("optionalMessage")} rows={2}
                className="w-full border border-inkscale-100 dark:border-white/10 dark:bg-inkscale-700 dark:text-white rounded-lg px-3 py-2 text-xs resize-none"
              />
              <button type="button"
                onClick={handleSendEmail}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-burgundy hover:bg-burgundy-dark text-white px-3 py-2 rounded-lg disabled:opacity-40 transition"
              >
                <Mail size={15} /> {sending ? t("sending") : t("sendByEmail")}
              </button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {result && (
              <p className="text-xs text-emerald-600">
                {result.sent_to.length > 0 && `Sent to ${result.sent_to.join(", ")}. `}
                {result.failed.length > 0 && `Failed: ${result.failed.join(", ")}.`}
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

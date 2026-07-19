import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SealMark from "../components/SealMark.jsx";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-inkscale-50 dark:bg-inkscale-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <SealMark size={36} tone="ink" />
          <p className="font-semibold text-inkscale-800 dark:text-white">QPaper AI</p>
        </div>

        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-burgundy hover:underline mb-6">
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="bg-white dark:bg-inkscale-800 border border-inkscale-100/70 dark:border-white/10 rounded-2xl shadow-paper p-6 sm:p-8 space-y-6 text-sm text-inkscale-500 dark:text-inkscale-200">
          <div>
            <h1 className="text-xl font-semibold text-inkscale-800 dark:text-white mb-1">Privacy Policy</h1>
            <p className="text-xs text-inkscale-300">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <p>
            This is a student project, not a company — this page exists for transparency
            about what data is collected and why, not as a substitute for formal legal
            counsel.
          </p>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">What's collected</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Account info: your name, email, and a securely hashed password (or your verified email if you use Google Sign-In)</li>
              <li>Files you upload (PDF/DOCX/TXT notes) and generated question papers, stored to power the app's core features</li>
              <li>A profile picture, if you choose to upload one</li>
              <li>Feedback messages you submit through the Support page</li>
            </ul>
          </div>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">Third parties involved</h2>
            <p>
              Uploaded text is sent to Google's Gemini API to generate questions. If you
              sign in with Google, Google verifies your identity. If email delivery is
              configured, Gmail's SMTP service is used to send verification codes. None of
              your data is sold or used for advertising.
            </p>
          </div>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">Who can see your data</h2>
            <p>
              Your questions, papers, and uploads are private to your account — other users
              can't see them. The project owner can see feedback you submit (including your
              name and email, to reply to it) and basic account info (name, email,
              verification status) for maintaining the app.
            </p>
          </div>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">Data retention</h2>
            <p>
              As a free, student-hosted project, data isn't guaranteed to be permanent —
              it may be reset during updates or hosting changes. Don't rely on this app as
              your only copy of anything important.
            </p>
          </div>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">Your choices</h2>
            <p>
              You can remove your profile picture anytime in Settings. To request deletion
              of your account and data, email the address below.
            </p>
          </div>

          <div>
            <h2 className="font-medium text-inkscale-800 dark:text-white mb-1">Contact</h2>
            <p>
              Questions or concerns about your data? Reach out at{" "}
              <a href="mailto:zensphnix@gmail.com" className="text-burgundy hover:underline">
                zensphnix@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

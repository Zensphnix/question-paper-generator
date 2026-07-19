import { createContext } from "react";

// Plain JS file, not a component — this is what makes the split work.
// Fast Refresh can only preserve state correctly in files that export
// EITHER only components OR only non-components, never a mix. Splitting
// the raw context object out here means LanguageContext.jsx can export
// just the LanguageProvider component, and useLanguage.js can export
// just the hook, with neither file mixing the two kinds of export.
const LanguageContext = createContext(null);

export default LanguageContext;

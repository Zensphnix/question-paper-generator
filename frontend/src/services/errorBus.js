// A minimal event bus so errors from anywhere — a crashed component, a failed
// fetch, an unhandled promise rejection — can all surface through the same
// "Something went wrong" contact-support UI, instead of each needing its own
// bespoke handling (or, worse, silently failing into a blank screen).
const listeners = new Set();

export function reportError(detail) {
  // detail: { message, source, stack? }
  listeners.forEach((fn) => fn(detail));
}

export function subscribeToErrors(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

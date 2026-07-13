// Bridge to the shared pure calc logic in core/. Vite bundles the CommonJS
// modules; we default-import and re-export the pieces the wizard needs so the
// client's live split validation is the exact same math the server enforces.
import splitLib from "@core/split.js";

export const toCents = splitLib.toCents;
export const splitEqualCents = splitLib.splitEqualCents;
export const splitPercentCents = splitLib.splitPercentCents;
export const validateExactCents = splitLib.validateExactCents;
export const validatePercents = splitLib.validatePercents;

// The mark as a data URI, for the generated app icon and share card.

export const WALL = "#23272A";
export const CARD = "#EBDDBF";
export const INK = "#221E19";
export const CARBON = "#2A4A9C";
export const SAFETY = "#E8661C";
export const OK = "#2C7639";
export const NO = "#AD261E";
export const AMBER = "#A86E04";

export function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="11" y="7" width="38" height="50" rx="2" fill="${CARD}" stroke="${INK}" stroke-width="3"/><circle cx="19" cy="15" r="3" fill="${INK}"/><path d="M18 27h23M18 34h23M18 41h13" stroke="${CARBON}" stroke-width="3" stroke-linecap="round"/><g transform="rotate(-38 34 38)"><rect x="13" y="34" width="38" height="8" rx="4" fill="${SAFETY}" stroke="${INK}" stroke-width="3"/><path d="M49 30a9 9 0 1 1 0 16l-4-4v-8z" fill="${SAFETY}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M55 34h5v8h-5" fill="${WALL}"/></g></svg>`;
}

export const markDataUri = (): string => `data:image/svg+xml;base64,${Buffer.from(markSvg()).toString("base64")}`;

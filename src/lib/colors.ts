// Deterministic color/gradient resolver based on an entity id string.
// Returns a Tailwind-friendly gradient class string that stays vivid
// across both light and dark themes.

const GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-700",
  "from-cyan-500 to-sky-600",
  "from-fuchsia-500 to-purple-700",
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getGradient(id: string): string {
  const index = hashString(id) % GRADIENTS.length;
  return GRADIENTS[index];
}

// Accent gradients used by FeaturedSection static cards.
export const FEATURED_GRADIENTS: readonly string[] = [
  "from-blue-600 via-blue-500 to-cyan-400",
  "from-violet-600 via-purple-500 to-fuchsia-400",
  "from-emerald-600 via-emerald-500 to-teal-400",
  "from-rose-600 via-rose-500 to-orange-400",
];

/**
 * Fixed palette of label colors (hex) offered when creating/editing a label,
 * mirroring the Trello-style color assignment the backend accepts. The
 * backend also accepts an empty string ("") to mean "no color".
 */
export const LABEL_COLORS: readonly string[] = [
  "#e11941", // red
  "#f4881f", // orange (Trello orange ~#f4881f)
  "#f5c518", // yellow
  "#0cb64e", // green
  "#0ca0d9", // blue
  "#5a67d8", // purple
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
];

/** Represents "no color" — accepted by the backend as an empty color string. */
export const LABEL_NO_COLOR = "";

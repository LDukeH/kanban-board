// Deterministic gradient per entity id; classes stay vivid in light and dark themes.
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

export function hashString(str: string): number {
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

/** Deterministic single-hue identity color per board. */
export const BOARD_COLORS: readonly string[] = [
  "#059669", // emerald
  "#0284c7", // sky
  "#7c3aed", // violet
  "#d97706", // amber
  "#e11d48", // rose
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#c026d3", // fuchsia
];

/** The app's primary blue — used when a board has no id to derive a color from. */
export const BOARD_COLOR_FALLBACK = "#4f46e5";

export function getBoardColor(id?: string | null): string {
  if (!id) return BOARD_COLOR_FALLBACK;
  return BOARD_COLORS[hashString(id) % BOARD_COLORS.length];
}

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

/** YIQ brightness threshold: >= 128 reads better with dark text, below with white text. */
const LABEL_CONTRAST_THRESHOLD = 128;

/** Parses a hex color ("#rgb" or "#rrggbb", with or without "#") into RGB channels. */
function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, "");
  const short = /^[\da-fA-F]{3}$/.exec(hex);
  if (short) {
    const [r, g, b] = hex.split("").map((c) => Number.parseInt(c + c, 16));
    return [r, g, b];
  }
  const full = /^[\da-fA-F]{6}$/.exec(hex);
  if (!full) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Readable text color (white or black) for a label background.
 * Uses YIQ brightness so bright label colors (yellow/orange) get dark text
 * and saturated colors (red/green/blue/purple) keep white text.
 * Falls back to white for empty/invalid input (callers render those without a fill).
 */
export function getLabelContrastText(color: string): string {
  const rgb = parseHexColor(color);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= LABEL_CONTRAST_THRESHOLD ? "#000000" : "#ffffff";
}

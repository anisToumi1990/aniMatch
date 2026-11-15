/**
 * "Aura glow" design tokens (see docs/design/aura-glow.md).
 *
 * The app is dark-only for now. Screens and components should read colors
 * from here (directly or via useThemeColor) instead of hardcoding them.
 */

const palette = {
  ink: '#0E0F13',
  surface: '#17181F',
  surfaceRaised: '#1F2029',
  line: '#2A2C36',
  white: '#F2F2F5',
  grey: '#A6A8B3',
  greyMuted: '#6B6E7A',
  red: '#E5626A',
  green: '#4CC38A',
};

export const Colors = {
  /** Screen background */
  background: palette.ink,
  /** Cards */
  card: palette.surface,
  /** Raised cards, inputs, chips */
  cardRaised: palette.surfaceRaised,
  /** Thin (1px) borders and dividers */
  border: palette.line,

  text: palette.white,
  textSecondary: palette.grey,
  textMuted: palette.greyMuted,

  /** Primary button: light pill */
  primary: palette.white,
  onPrimary: palette.ink,

  /** Errors, destructive actions, notification badge */
  danger: palette.red,
  /** Success messages */
  success: palette.green,

  /** Dimmed backdrop behind popups */
  overlay: 'rgba(5, 6, 8, 0.72)',
  /** Shadow color (iOS) */
  shadow: '#000000',

  // Names used by the navigation / template code.
  tint: palette.white,
  icon: palette.greyMuted,
  tabIconDefault: palette.greyMuted,
  tabIconSelected: palette.white,
};

/** Each animal's aura color, keyed by lowercase animal name. */
export const AuraColors: Record<string, string> = {
  fox: '#D85A30',
  lion: '#EF9F27',
  wolf: '#378ADD',
  owl: '#7F77DD',
  cat: '#D4537E',
  deer: '#1D9E75',
  dolphin: '#3BA3D9',
  eagle: '#C9A55A',
  elephant: '#8A8D99',
  otter: '#B07A4B',
  parrot: '#63A322',
  peacock: '#1E8C9E',
  snake: '#3FB37F',
  unicorn: '#B58CE6',
  bear: '#A0522D',
};

/** The aura color for an animal name (case-insensitive), or a neutral fallback. */
export function getAuraColor(animalName: string | null | undefined): string {
  if (!animalName) return Colors.textMuted;
  return AuraColors[animalName.trim().toLowerCase()] ?? Colors.textMuted;
}

/** Turns a #RRGGBB token into an rgba() string with the given opacity (0–1). */
export function withAlpha(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return hexColor;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

/** Compatibility score levels: 75-100 strong, 50-74 good, under 50 needs effort. */
export const MatchLevelColors = {
  strong: '#4CC38A',
  good: '#EF9F27',
  needsEffort: '#E5626A',
};

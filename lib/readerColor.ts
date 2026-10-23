/**
 * Resolves the reader's text colour against the active theme.
 *
 * The colour is a user preference stored as a hex value, and its default is
 * pure black — which is invisible on a dark ground. Treat the untouched
 * default as "follow the theme" and return undefined so the inherited
 * foreground token applies; an explicitly chosen colour is always honoured.
 */
const THEME_DEFAULTS = new Set(['#000000', '#000', 'black']);

export function resolveReaderColor(fontColor?: string): string | undefined {
  if (!fontColor) return undefined;
  return THEME_DEFAULTS.has(fontColor.trim().toLowerCase()) ? undefined : fontColor;
}

/**
 * Resolves the reading highlight against the active theme.
 *
 * The highlight paints behind the text, so a mid-grey default leaves light
 * text unreadable once the dark theme inverts the type. The shipped defaults
 * were never chosen by anyone, so map them onto a per-theme token; a colour
 * the reader actually picked is left alone.
 */
const DEFAULT_HIGHLIGHTS = new Set(['#a6a6a6', '#ffd700', '#facc15']);

export function resolveHighlightColor(highlightColor?: string): string {
  if (!highlightColor) return 'hsl(var(--reader-highlight))';
  return DEFAULT_HIGHLIGHTS.has(highlightColor.trim().toLowerCase())
    ? 'hsl(var(--reader-highlight))'
    : highlightColor;
}

/** Same, at the given alpha, for the trail behind the highlight. */
export function resolveHighlightColorAlpha(highlightColor: string | undefined, alpha: number): string {
  const resolved = resolveHighlightColor(highlightColor);
  return resolved.startsWith('hsl(var(')
    ? `hsl(var(--reader-highlight) / ${alpha})`
    : resolved + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

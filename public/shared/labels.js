export const LABEL_FONT_FALLBACK = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "PingFang SC", "Noto Sans CJK JP", system-ui, sans-serif';

export function fitNamePlate(measuredWidth, baseFontSize, maxTextWidth) {
  const scale = measuredWidth > 0 ? Math.min(1, maxTextWidth / measuredWidth) : 1;
  const fontSize = Math.max(9, baseFontSize * scale);
  return { fontSize, textWidth: Math.min(measuredWidth * scale, maxTextWidth), plateWidth: Math.min(maxTextWidth + fontSize * 1.5, measuredWidth * scale + fontSize * 1.5) };
}

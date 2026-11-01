export function selectVisibleLamps(lamps) {
  const items = lamps.slice(0, 60).map((lamp) => ({ lamp }));
  const overflow = lamps.length - items.length;
  if (overflow > 0) items.push({ cluster: overflow });
  return items;
}

export function densityTier(totalCount, compact = false) {
  const natural = totalCount <= 12 ? 0 : totalCount <= 30 ? 1 : 2;
  return Math.min(2, natural + (compact ? 1 : 0));
}

export function rowLayout(items, totalCount, width, height, placement = "bottom", compact = false, offsetFor = () => 0) {
  const tier = densityTier(totalCount, compact);
  const nominalSize = [176, 176 * .70, 176 * .50][tier];
  const preferredSpacing = [150, 72, 31][tier];
  const spacing = items.length <= 1 ? 0 : Math.min(preferredSpacing, (width - 160) / (items.length - 1));
  const collisionCap = tier === 0 || items.length <= 1 ? Number.POSITIVE_INFINITY : spacing / .74;
  const size = Math.min(nominalSize, collisionCap);
  const baseline = placement === "top" ? height * .12 : height * .88;
  return items.map((item, index) => ({
    ...item, x: 80 + index * spacing, y: baseline + (item.lamp ? offsetFor(item.lamp) : 0), size, collisionCap, tier
  }));
}

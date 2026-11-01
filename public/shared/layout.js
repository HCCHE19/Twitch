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

export function hueDistance(left, right) {
  const difference = Math.abs(left - right) % 360;
  return Math.min(difference, 360 - difference);
}

function validPosition(row, position, hue, hueFor) {
  const left = row[position - 1]; const right = row[position];
  return (!left || hueDistance(hueFor(left), hue) >= 45) && (!right || hueDistance(hueFor(right), hue) >= 45);
}

function neighbourClearance(row, position, hue, hueFor) {
  const neighbours = [row[position - 1], row[position]].filter(Boolean);
  return neighbours.length ? Math.min(...neighbours.map((item) => hueDistance(hueFor(item), hue))) : 180;
}

function repairHueRow(source, hueFor) {
  for (let start = 0; start < source.length; start += 1) {
    const remaining = source.filter((_, index) => index !== start);
    const repaired = [source[start]];
    while (remaining.length) {
      const previousHue = hueFor(repaired.at(-1));
      const candidates = remaining.map((item, index) => ({ item, index, distance: hueDistance(previousHue, hueFor(item)) })).filter(({ distance }) => distance >= 45);
      if (!candidates.length) break;
      candidates.sort((left, right) => {
        const leftOptions = remaining.filter((item, index) => index !== left.index && hueDistance(hueFor(left.item), hueFor(item)) >= 45).length;
        const rightOptions = remaining.filter((item, index) => index !== right.index && hueDistance(hueFor(right.item), hueFor(item)) >= 45).length;
        return leftOptions - rightOptions || right.distance - left.distance || left.index - right.index;
      });
      repaired.push(candidates[0].item);
      remaining.splice(candidates[0].index, 1);
    }
    if (repaired.length === source.length) return repaired;
  }
  return null;
}

export function separateAdjacentHues(items, hueFor, onImpossible = () => {}) {
  const source = items.filter((item) => item.lamp);
  const trailing = items.filter((item) => !item.lamp);
  const row = [];
  for (const item of source) {
    const hue = hueFor(item);
    const natural = row.length;
    const local = [];
    for (let position = natural; position >= Math.max(0, natural - 3); position -= 1) {
      if (validPosition(row, position, hue, hueFor)) local.push(position);
    }
    const wider = local.length ? [] : Array.from({ length: row.length + 1 }, (_, position) => position).filter((position) => validPosition(row, position, hue, hueFor));
    const candidates = local.length ? local : wider;
    if (!candidates.length) {
      row.push(item);
      continue;
    }
    candidates.sort((left, right) => neighbourClearance(row, right, hue, hueFor) - neighbourClearance(row, left, hue, hueFor) || Math.abs(natural - left) - Math.abs(natural - right));
    row.splice(candidates[0], 0, item);
  }
  const collisions = row.slice(1).filter((item, index) => hueDistance(hueFor(item), hueFor(row[index])) < 45).length;
  if (!collisions) return [...row, ...trailing];
  const repaired = repairHueRow(source, hueFor);
  if (repaired) return [...repaired, ...trailing];
  onImpossible({ rowLength: source.length, collisions });
  return [...row, ...trailing];
}

export function rowLayout(items, totalCount, width, height, placement = "bottom", compact = false, offsetFor = () => 0) {
  const tier = densityTier(totalCount, compact);
  const nominalSize = [176, 176 * .70, 176 * .50][tier];
  const preferredSpacing = [150, 72, 31][tier];
  const spacing = items.length <= 1 ? 0 : Math.min(preferredSpacing, (width - 160) / (items.length - 1));
  const collisionCap = tier === 0 || items.length <= 1 ? Number.POSITIVE_INFINITY : spacing / .74;
  const size = Math.min(nominalSize, collisionCap);
  const baseline = placement === "top" ? height * .12 : height * .88;
  return items.map((item, index) => ({ ...item, x: 80 + index * spacing, y: baseline + (item.lamp ? offsetFor(item.lamp) : 0), size, collisionCap, tier }));
}

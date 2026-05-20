export function headingPxToProgress(
  scrollTop: number,
  headPx: number[],
  totalHeight: number,
): number {
  if (headPx.length === 0 || totalHeight <= 0) {
    return totalHeight > 0 ? scrollTop / totalHeight : 0;
  }
  const n = headPx.length;
  const segments = n + 1;

  if (scrollTop < headPx[0]) {
    return headPx[0] > 0 ? (scrollTop / headPx[0]) / segments : 0;
  }

  for (let i = 0; i < n - 1; i++) {
    if (scrollTop >= headPx[i] && scrollTop < headPx[i + 1]) {
      const segLen = headPx[i + 1] - headPx[i];
      const frac = segLen > 0 ? (scrollTop - headPx[i]) / segLen : 0;
      return (i + 1 + frac) / segments;
    }
  }

  const remaining = totalHeight - headPx[n - 1];
  const frac = remaining > 0 ? (scrollTop - headPx[n - 1]) / remaining : 0;
  return (n + frac) / segments;
}

export function headingProgressToPx(
  progress: number,
  headPx: number[],
  totalHeight: number,
): number {
  if (headPx.length === 0 || totalHeight <= 0) {
    return progress * totalHeight;
  }
  const n = headPx.length;
  const segments = n + 1;
  const scaled = progress * segments;
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx <= 0) {
    return frac * headPx[0];
  }

  if (idx <= n - 1) {
    return headPx[idx - 1] + frac * (headPx[idx] - headPx[idx - 1]);
  }

  return headPx[n - 1] + frac * (totalHeight - headPx[n - 1]);
}

// Locate blue name/title text in the two full-sheet Lightwheel layouts.
// Other aspect ratios or missing color evidence use general OCR instead.
export function findIdentityRegions(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
) {
  if (width / height < 0.76 || width / height > 0.86) return undefined;
  const bands: { top: number; bottom: number; left: number; right: number }[] =
    [];
  let band: (typeof bands)[number] | undefined;
  for (let y = Math.floor(height * 0.19); y < height * 0.34; y++) {
    let left = width,
      right = 0,
      count = 0;
    for (let x = Math.floor(width * 0.04); x < width * 0.8; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = pixels.subarray(i, i + 4);
      if (a > 128 && b > 65 && b > r * 1.4 && b > g * 1.2 && g < 155) {
        left = Math.min(left, x);
        right = x;
        count++;
      }
    }
    if (count > 4) {
      if (!band || y - band.bottom > 5) {
        band = { top: y, bottom: y, left, right };
        bands.push(band);
      } else {
        band.bottom = y;
        band.left = Math.min(band.left, left);
        band.right = Math.max(band.right, right);
      }
    }
  }
  const text = bands.filter((b) => b.bottom - b.top > height * 0.008);
  if (!text.length || text.length > 3) return undefined;
  const pad = Math.ceil(height * 0.008);
  const left = Math.max(0, Math.min(...text.map((b) => b.left)) - pad);
  const top = Math.max(0, text[0].top - pad);
  return text.map((b) => {
    const left = Math.max(0, b.left - pad);
    const top = Math.max(0, b.top - pad);
    return {
      left,
      top,
      width: Math.min(width - left, b.right + pad - left),
      height: b.bottom + pad - top,
    };
  });
}

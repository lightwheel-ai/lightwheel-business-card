export type PathFace = {
  unitsPerEm: number;
  glyphs: Record<string, { path: string; advance: number }>;
};
export type PingFangPaths = { medium: PathFace; regular: PathFace };
let cached: Promise<PingFangPaths> | undefined;
export function loadPingFangPaths(assetUrl: (path: string) => string) {
  cached ||= fetch(assetUrl('/templates/pingfang-paths.json')).then(async (response) => {
    if (!response.ok) throw new Error('Unable to load PingFang outlines.');
    return response.json() as Promise<PingFangPaths>;
  }).catch((error) => { cached = undefined; throw error; });
  return cached;
}

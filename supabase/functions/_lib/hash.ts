export function tieHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) * 16777619;
  }
  return Math.abs(h);
}

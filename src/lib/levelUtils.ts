// Shared level calculation utility
export function calculateLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
  
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  const currentThreshold = thresholds[level - 1] ?? thresholds[thresholds.length - 1];
  const nextThreshold = thresholds[level] ?? thresholds[thresholds.length - 1] + 1000;
  const currentXp = xp - currentThreshold;
  const nextLevelXp = nextThreshold - currentThreshold;
  const progress = Math.min((currentXp / nextLevelXp) * 100, 100);
  
  return { level, currentXp, nextLevelXp, progress };
}

// Kid-friendly level titles
const LEVEL_TITLES: Record<number, string> = {
  1: "Rookie Explorer",
  2: "Rising Star",
  3: "Knowledge Seeker",
  4: "Quiz Warrior",
  5: "Scholar Knight",
  6: "Brain Master",
  7: "Wisdom Wizard",
  8: "Grand Champion",
  9: "Elite Legend",
  10: "Supreme Scholar",
};

export function getLevelTitle(level: number): string {
  if (level >= 10) return LEVEL_TITLES[10];
  return LEVEL_TITLES[level] || LEVEL_TITLES[1];
}

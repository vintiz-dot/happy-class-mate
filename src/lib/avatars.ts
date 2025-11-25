// Avatar image imports
import avatar003 from "@/assets/avatars/avatar-003.png";
import avatar006 from "@/assets/avatars/avatar-006.png";
import avatar007 from "@/assets/avatars/avatar-007.png";
import avatar009 from "@/assets/avatars/avatar-009.png";
import avatar018 from "@/assets/avatars/avatar-018.png";
import avatar025 from "@/assets/avatars/avatar-025.png";
import avatar050 from "@/assets/avatars/avatar-050.png";
import avatar051 from "@/assets/avatars/avatar-051.png";
import avatar054 from "@/assets/avatars/avatar-054.png";
import avatar055 from "@/assets/avatars/avatar-055.png";

// Map database URLs to actual imported images
export const avatarMap: Record<string, string> = {
  "/src/assets/avatars/avatar-003.png": avatar003,
  "/src/assets/avatars/avatar-006.png": avatar006,
  "/src/assets/avatars/avatar-007.png": avatar007,
  "/src/assets/avatars/avatar-009.png": avatar009,
  "/src/assets/avatars/avatar-018.png": avatar018,
  "/src/assets/avatars/avatar-025.png": avatar025,
  "/src/assets/avatars/avatar-050.png": avatar050,
  "/src/assets/avatars/avatar-051.png": avatar051,
  "/src/assets/avatars/avatar-054.png": avatar054,
  "/src/assets/avatars/avatar-055.png": avatar055,
};

// Array of all avatar images for random selection
const avatarArray = [
  avatar003,
  avatar006,
  avatar007,
  avatar009,
  avatar018,
  avatar025,
  avatar050,
  avatar051,
  avatar054,
  avatar055,
];

export function getAvatarUrl(dbUrl: string | null): string {
  if (!dbUrl) return "";
  return avatarMap[dbUrl] || dbUrl;
}

// Get a random avatar URL based on a seed (like student ID)
export function getRandomAvatarUrl(seed?: string): string {
  if (!seed) {
    return avatarArray[Math.floor(Math.random() * avatarArray.length)];
  }
  
  // Use seed to get consistent random avatar for same student
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  
  const index = Math.abs(hash) % avatarArray.length;
  return avatarArray[index];
}

import { 
  MessageSquare, 
  Ear, 
  BookOpen, 
  PenTool, 
  Focus, 
  Users,
  AlertTriangle,
  LucideIcon
} from "lucide-react";

// Point options for skills/behaviors
export const POINT_OPTIONS = [1, 2, 3, 5, 10] as const;

// Deduction options for corrections
export const DEDUCTION_OPTIONS = [-1, -2, -3, -5] as const;

export interface SubTag {
  label: string;
  value: string;
}

export interface SkillConfig {
  icon: LucideIcon;
  label: string;
  subTags: SubTag[];
}

export const SKILL_CONFIG: Record<string, SkillConfig> = {
  speaking: {
    icon: MessageSquare,
    label: "Speaking",
    subTags: [
      { label: "Good Pronunciation", value: "good_pronunciation" },
      { label: "Loud & Clear", value: "loud_clear" },
      { label: "Great Vocabulary", value: "great_vocabulary" },
      { label: "Fluent Response", value: "fluent_response" },
    ],
  },
  listening: {
    icon: Ear,
    label: "Listening",
    subTags: [
      { label: "Followed Instructions", value: "followed_instructions" },
      { label: "Good Comprehension", value: "good_comprehension" },
      { label: "Active Listening", value: "active_listening" },
    ],
  },
  reading: {
    icon: BookOpen,
    label: "Reading",
    subTags: [
      { label: "Good Expression", value: "good_expression" },
      { label: "Accurate Reading", value: "accurate_reading" },
      { label: "Good Pace", value: "good_pace" },
    ],
  },
  writing: {
    icon: PenTool,
    label: "Writing",
    subTags: [
      { label: "Neat Handwriting", value: "neat_handwriting" },
      { label: "Good Grammar", value: "good_grammar" },
      { label: "Creative Writing", value: "creative_writing" },
    ],
  },
};

export const BEHAVIOR_CONFIG: Record<string, SkillConfig> = {
  focus: {
    icon: Focus,
    label: "Focus",
    subTags: [
      { label: "Stayed on Task", value: "stayed_on_task" },
      { label: "No Distractions", value: "no_distractions" },
    ],
  },
  teamwork: {
    icon: Users,
    label: "Teamwork",
    subTags: [
      { label: "Helped Others", value: "helped_others" },
      { label: "Good Collaboration", value: "good_collaboration" },
      { label: "Shared Materials", value: "shared_materials" },
    ],
  },
};

export const CORRECTION_OPTIONS: SubTag[] = [
  { label: "Not Paying Attention", value: "not_paying_attention" },
  { label: "Disrupting Class", value: "disrupting_class" },
  { label: "Missing Homework", value: "missing_homework" },
  { label: "Late to Class", value: "late_to_class" },
  { label: "Other", value: "other" },
];

export const CORRECTION_CONFIG: SkillConfig = {
  icon: AlertTriangle,
  label: "Correction",
  subTags: CORRECTION_OPTIONS,
};

// Skill icons lookup for quick access
export const SKILL_ICONS: Record<string, LucideIcon> = {
  speaking: MessageSquare,
  listening: Ear,
  reading: BookOpen,
  writing: PenTool,
  focus: Focus,
  teamwork: Users,
  correction: AlertTriangle,
};

// Helper to check if a skill is a "skill" type (affects analytics)
export function isSkillType(skill: string): boolean {
  return ["speaking", "listening", "reading", "writing"].includes(skill);
}

// Helper to check if a skill is a "behavior" type
export function isBehaviorType(skill: string): boolean {
  return ["focus", "teamwork"].includes(skill);
}

// Helper to check if it's a correction
export function isCorrectionType(skill: string): boolean {
  return skill === "correction";
}

// Get all skill/behavior options for dropdowns
export function getAllCategories() {
  return [
    { key: "skills", label: "Skills", items: Object.entries(SKILL_CONFIG) },
    { key: "behaviors", label: "Behaviors", items: Object.entries(BEHAVIOR_CONFIG) },
    { key: "correction", label: "Correction", items: [["correction", CORRECTION_CONFIG] as const] },
  ];
}

// Format skill key to display label
export function formatSkillLabel(skill: string, subTag?: string): string {
  const config = SKILL_CONFIG[skill] || BEHAVIOR_CONFIG[skill] || (skill === "correction" ? CORRECTION_CONFIG : null);
  if (!config) return skill;
  
  const base = config.label;
  if (subTag) {
    const tag = config.subTags.find(t => t.value === subTag);
    if (tag) return `${base}: ${tag.label}`;
  }
  return base;
}

import type { GoalSuggestion } from "./types";
import type { SportConfig } from "@/lib/sports/types";

export interface AthleteGoalContext {
  position: string | null;
  existingGoalTitles: string[];
  /** Optional sport config — drives position-specific skill suggestion. */
  sportConfig?: SportConfig | null;
}

const GENERIC_SKILL_FALLBACK: GoalSuggestion = {
  category: "skill",
  title: "Set a position-specific skill goal",
  target: "Coach to define",
  rationale: "Work with your coach to identify the highest-leverage skill for your position",
};

export async function suggestGoals(ctx: AthleteGoalContext): Promise<GoalSuggestion[]> {
  await new Promise((r) => setTimeout(r, 900));

  const pos = ctx.position ?? "";
  const skillGoal: GoalSuggestion =
    (pos && ctx.sportConfig?.goal_templates_by_position[pos]) ?? GENERIC_SKILL_FALLBACK;

  return [
    skillGoal,
    {
      category: "conditioning",
      title: "Complete weekly conditioning program",
      target: "4 sessions per week",
      rationale: "Consistent conditioning reduces injury risk and builds durability",
    },
    {
      category: "mindset",
      title: "Practice visualization before every session",
      target: "5 days per week",
      rationale: "Mental rehearsal improves execution under pressure",
    },
  ];
}

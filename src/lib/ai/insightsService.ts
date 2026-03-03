import type { AIOutput } from "./types";

export interface TeamInsightData {
  totalAthletes: number;
  onTrack: number;
  needsAttention: number;
  activeGoals: number;
  completedGoals: number;
  hasReflections: boolean;
}

export async function generateTeamInsights(data: TeamInsightData): Promise<AIOutput> {
  await new Promise((r) => setTimeout(r, 1500));

  const engagementRate =
    data.totalAthletes > 0 ? Math.round((data.onTrack / data.totalAthletes) * 100) : 0;
  const totalGoals = data.activeGoals + data.completedGoals;
  const completionPct =
    totalGoals > 0 ? Math.round((data.completedGoals / totalGoals) * 100) : 0;

  return {
    summary: `${data.onTrack} of ${data.totalAthletes} athletes are on track this week (${engagementRate}% engagement rate). ${
      data.needsAttention > 0
        ? `${data.needsAttention} athlete${data.needsAttention > 1 ? "s" : ""} need attention.`
        : "No disengagement flags detected."
    }`,
    highlights: [
      `${engagementRate}% team engagement rate this week`,
      totalGoals > 0 ? `Goal completion: ${completionPct}% across ${totalGoals} goals` : "No goals set yet",
      data.hasReflections
        ? "Athletes are submitting weekly reflections — strong self-awareness culture"
        : null,
    ].filter(Boolean) as string[],
    concerns: [
      data.needsAttention > 0
        ? `${data.needsAttention} athlete${data.needsAttention > 1 ? "s" : ""} showing signals of disengagement`
        : null,
      completionPct < 40 && totalGoals > 0
        ? "Goal completion rate is below 40% — consider reviewing target difficulty"
        : null,
      !data.hasReflections && data.totalAthletes > 0
        ? "No reflections submitted this week — prompt athletes to complete theirs"
        : null,
    ].filter(Boolean) as string[],
    recommendations: [
      data.needsAttention > 0
        ? "Reach out to flagged athletes with a quick check-in message"
        : "Maintain current training momentum — team is performing well",
      completionPct < 40 && totalGoals > 0
        ? "Review goal difficulty with athletes and adjust targets if needed"
        : "Goals are well-calibrated — keep tracking progress weekly",
    ],
  };
}

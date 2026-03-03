import type { AIOutput } from "./types";

export interface ReflectionData {
  whatWentWell: string | null;
  needsImprovement: string | null;
  selfRating: number | null;
}

export async function generateReflectionSummary(data: ReflectionData): Promise<AIOutput> {
  await new Promise((r) => setTimeout(r, 1200));

  const rating = data.selfRating ?? 5;
  const mood = rating >= 8 ? "high" : rating >= 5 ? "moderate" : "low";
  const moodLabel = rating >= 8 ? "above average" : rating >= 5 ? "average" : "below average";

  return {
    summary: `Athlete self-rated this week ${rating}/10, indicating ${mood} confidence. ${
      data.whatWentWell ? "Positive momentum noted in key areas." : ""
    } ${data.needsImprovement ? "Improvement areas identified for coaching focus." : ""}`.trim(),
    highlights: [
      data.whatWentWell
        ? `Athlete strength: "${data.whatWentWell.slice(0, 80)}${data.whatWentWell.length > 80 ? "..." : ""}"`
        : "No specific highlights reported",
      `Self-rating ${rating}/10 — ${moodLabel} confidence level`,
    ],
    concerns: [
      data.needsImprovement
        ? `Focus area: "${data.needsImprovement.slice(0, 80)}${data.needsImprovement.length > 80 ? "..." : ""}"`
        : null,
      rating <= 4 ? "Low self-rating may indicate disengagement or frustration — consider a 1-on-1 check-in." : null,
    ].filter(Boolean) as string[],
    recommendations: [
      rating <= 4
        ? "Schedule a 1-on-1 check-in this week to understand root cause"
        : "Maintain current training cadence and acknowledge progress",
      data.needsImprovement
        ? "Address the athlete's identified improvement area in the next session"
        : "Continue building on positive momentum",
    ],
  };
}

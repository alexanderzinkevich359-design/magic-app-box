import type { AIOutput } from "./types";

export interface AthleteReportData {
  name: string;
  position: string | null;
  activeGoals: number;
  totalSessions: number;
  latestNote: string | null;
  reflectionCount: number;
  avgSelfRating: number | null;
}

export async function generateAthleteSummary(data: AthleteReportData): Promise<AIOutput> {
  await new Promise((r) => setTimeout(r, 1800));

  const firstName = data.name.split(" ")[0];
  const ratingNote =
    data.avgSelfRating != null
      ? ` Average weekly self-rating: ${data.avgSelfRating.toFixed(1)}/10.`
      : "";

  return {
    summary: `${firstName} has ${data.activeGoals} active goal${data.activeGoals !== 1 ? "s" : ""} and has logged ${data.totalSessions} training session${data.totalSessions !== 1 ? "s" : ""} on record.${ratingNote}`,
    highlights: [
      `${data.totalSessions} training session${data.totalSessions !== 1 ? "s" : ""} logged`,
      data.activeGoals > 0
        ? `${data.activeGoals} active goal${data.activeGoals !== 1 ? "s" : ""} in progress`
        : "No active goals — good opportunity to set new objectives",
      data.reflectionCount > 0
        ? `${data.reflectionCount} weekly reflection${data.reflectionCount !== 1 ? "s" : ""} submitted — strong self-awareness habit`
        : null,
      data.avgSelfRating != null && data.avgSelfRating >= 7
        ? `High self-confidence (avg ${data.avgSelfRating.toFixed(1)}/10)`
        : null,
    ].filter(Boolean) as string[],
    concerns: [
      data.activeGoals === 0
        ? `${firstName} has no active goals — schedule a goal-setting conversation`
        : null,
      data.avgSelfRating != null && data.avgSelfRating < 5
        ? `Below-average self-ratings (avg ${data.avgSelfRating.toFixed(1)}/10) — may indicate frustration or lack of confidence`
        : null,
      data.reflectionCount === 0
        ? "No reflections submitted — encourage weekly check-ins for better visibility"
        : null,
    ].filter(Boolean) as string[],
    recommendations: [
      data.activeGoals === 0
        ? "Set 1 to 3 focused goals for the upcoming 4 weeks"
        : "Review goal progress together in the next session",
      data.reflectionCount === 0
        ? "Ask the athlete to complete their first weekly reflection"
        : "Continue the reflection habit and respond with a coach comment",
    ],
  };
}

export function formatReportForCopy(athleteName: string, output: AIOutput): string {
  const date = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return [
    `ATHLETE PROGRESS SUMMARY — ${athleteName.toUpperCase()}`,
    `Generated ${date} by ClipMVP AI · Coach review required before sharing`,
    ``,
    `OVERVIEW`,
    output.summary,
    ``,
    `HIGHLIGHTS`,
    ...output.highlights.map((h) => `• ${h}`),
    ``,
    `FOCUS AREAS`,
    ...(output.concerns.length > 0
      ? output.concerns.map((c) => `• ${c}`)
      : ["• No concerns flagged this period"]),
    ``,
    `RECOMMENDATIONS`,
    ...output.recommendations.map((r) => `• ${r}`),
    ``,
    `---`,
    `AI-generated draft. Coach review required.`,
  ].join("\n");
}

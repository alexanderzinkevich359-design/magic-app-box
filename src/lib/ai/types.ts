export interface AIOutput {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

export interface GoalSuggestion {
  category: "skill" | "conditioning" | "mindset";
  title: string;
  target: string;
  rationale: string;
}

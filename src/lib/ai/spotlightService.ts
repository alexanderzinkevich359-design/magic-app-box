// Team Spotlight Studio — Caption generation service
// Template-based, matching the existing AI service pattern in this codebase.
// All templates enforce safety rules: no rankings, no comparisons, no predictions.

export type SpotlightPostType =
  | "athlete_spotlight"
  | "team_development"
  | "tournament_recap"
  | "weekly_progress";

export type SpotlightTone = "professional" | "energetic" | "recruiting";

export type SpotlightProgressStatus = "on_track" | "in_progress" | "completed";

export interface SpotlightContext {
  postType: SpotlightPostType;
  sport: string;
  athleteNames: string[];
  goals: string[];
  progressStatus: SpotlightProgressStatus;
  tone: SpotlightTone;
  useEmoji: boolean;
  coachComment?: string;
  date?: string;
}

export interface SpotlightCaptions {
  instagram: string;
  facebook: string;
  hashtags: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function listNames(names: string[]): string {
  if (names.length === 0) return "our athletes";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function firstNames(names: string[]): string {
  return listNames(names.map(firstName));
}

function progressPhrase(status: SpotlightProgressStatus, tone: SpotlightTone): string {
  const phrases: Record<SpotlightProgressStatus, Record<SpotlightTone, string>> = {
    on_track: {
      professional: "Consistent effort and steady progress.",
      energetic: "Locked in and moving forward!",
      recruiting: "Demonstrating the consistency that coaches at the next level look for.",
    },
    in_progress: {
      professional: "Work in progress — and that's exactly the point.",
      energetic: "Every rep is building something bigger.",
      recruiting: "Putting in the work every single day.",
    },
    completed: {
      professional: "Goal achieved. Time to set the next one.",
      energetic: "Goal down. What's next?",
      recruiting: "Another goal reached. The development never stops.",
    },
  };
  return phrases[status][tone];
}

function goalPhrase(goals: string[], tone: SpotlightTone): string {
  if (goals.length === 0) return "continued development";
  const g = goals[0];
  if (tone === "professional") return `a focus on ${g.toLowerCase()}`;
  if (tone === "energetic") return `the goal of ${g.toLowerCase()}`;
  return `${g.toLowerCase()}`;
}

function emoji(type: SpotlightPostType): { main: string; accent: string } {
  const map: Record<SpotlightPostType, { main: string; accent: string }> = {
    athlete_spotlight: { main: "🌟", accent: "💪" },
    team_development: { main: "🤝", accent: "📈" },
    tournament_recap: { main: "🏆", accent: "💥" },
    weekly_progress: { main: "📅", accent: "✅" },
  };
  return map[type];
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildAthleteSpotlight(ctx: SpotlightContext): { ig: string; fb: string } {
  const { sport, athleteNames, goals, progressStatus, tone, useEmoji, coachComment } = ctx;
  const names = firstNames(athleteNames);
  const goal = goalPhrase(goals, tone);
  const progress = progressPhrase(progressStatus, tone);
  const e = emoji("athlete_spotlight");

  if (tone === "professional") {
    const ig = [
      useEmoji ? `${e.main} Athlete spotlight — ${sport}.` : `Athlete spotlight — ${sport}.`,
      `${names} has been putting in dedicated work toward ${goal}.`,
      progress,
      coachComment ? `Coach's note: "${coachComment}"` : "",
      "Development is a process, and the commitment shows.",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} Athlete Spotlight` : "Athlete Spotlight",
      `We want to recognize the effort and growth that ${names} has been showing in our ${sport} program.`,
      `This week, the focus has been on ${goal}. ${progress}`,
      coachComment ? `A note from the coaching staff: "${coachComment}"` : "",
      "We're proud of the commitment this athlete brings to their development.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  if (tone === "energetic") {
    const ig = [
      useEmoji ? `${e.main} Shoutout to ${names}! ${e.accent}` : `Shoutout to ${names}!`,
      `Working hard toward ${goal} and showing up every day.`,
      progress,
      coachComment ? `"${coachComment}"` : "",
      "The work is happening. Keep watching.",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} Athlete Spotlight! ${e.accent}` : "Athlete Spotlight!",
      `${names} has been bringing serious energy to their ${sport} development.`,
      `Current focus: ${goal}. ${progress}`,
      coachComment ? `Coach says: "${coachComment}"` : "",
      "This is what dedication looks like.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  // recruiting
  const ig = [
    useEmoji ? `${e.main} ${sport} — Athlete Development` : `${sport} — Athlete Development`,
    `${names} continues to develop the skills and habits that translate to the next level.`,
    `Current development area: ${goal}. ${progress}`,
    coachComment ? `"${coachComment}"` : "",
    "Character. Consistency. Development.",
  ].filter(Boolean).join("\n\n");

  const fb = [
    useEmoji ? `${e.main} Athlete Development Spotlight` : "Athlete Development Spotlight",
    `In our ${sport} program, we're proud to highlight the ongoing growth of ${names}.`,
    `Their focus on ${goal} reflects the kind of player they're working to become.`,
    `${progress}`,
    coachComment ? `Coach's observation: "${coachComment}"` : "",
    "We develop athletes who are ready for whatever comes next.",
  ].filter(Boolean).join("\n\n");

  return { ig, fb };
}

function buildTeamDevelopment(ctx: SpotlightContext): { ig: string; fb: string } {
  const { sport, athleteNames, goals, progressStatus, tone, useEmoji, coachComment, date } = ctx;
  const count = athleteNames.length;
  const teamRef = count > 0 ? `${count} athlete${count > 1 ? "s" : ""}` : "our team";
  const goal = goalPhrase(goals, tone);
  const progress = progressPhrase(progressStatus, tone);
  const e = emoji("team_development");
  const dateStr = date ? ` — ${date}` : "";

  if (tone === "professional") {
    const ig = [
      useEmoji ? `${e.main} Team development update${dateStr}` : `Team development update${dateStr}`,
      `${sport} program: ${teamRef} are currently focused on ${goal}.`,
      progress,
      coachComment ? `"${coachComment}"` : "",
      "Improvement is built one session at a time.",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} ${sport} Program — Development Update` : `${sport} Program — Development Update`,
      `Our coaching staff is pleased to share the continued growth happening in our ${sport} program.`,
      `This week, ${teamRef} are working toward ${goal}.`,
      `${progress}`,
      coachComment ? `From the coaches: "${coachComment}"` : "",
      "We believe in the process and trust that the results will follow.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  if (tone === "energetic") {
    const ig = [
      useEmoji ? `${e.main} Team update! ${e.accent}` : "Team update!",
      `${teamRef} putting in work this week — ${sport} development in full swing.`,
      `Focus: ${goal}. ${progress}`,
      coachComment ? `"${coachComment}"` : "",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} What's happening in our ${sport} program? ${e.accent}` : `What's happening in our ${sport} program?`,
      `${teamRef} are locked in on ${goal} and the energy in every session is building.`,
      progress,
      coachComment ? `Coach update: "${coachComment}"` : "",
      "Development doesn't stop. Neither do we.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  // recruiting
  const ig = [
    useEmoji ? `${e.main} ${sport} — Program Development` : `${sport} — Program Development`,
    `Our program is developing athletes who are prepared for the next stage of their careers.`,
    `This week: ${teamRef} working toward ${goal}. ${progress}`,
    coachComment ? `"${coachComment}"` : "",
  ].filter(Boolean).join("\n\n");

  const fb = [
    useEmoji ? `${e.main} ${sport} Development Program Update` : `${sport} Development Program Update`,
    `Our ${sport} program is built on the belief that consistent, intentional development creates opportunities.`,
    `${teamRef} are currently focused on ${goal} — and the work is showing.`,
    `${progress}`,
    coachComment ? `"${coachComment}"` : "",
    "We don't just develop athletes. We develop people who are ready for whatever comes next.",
  ].filter(Boolean).join("\n\n");

  return { ig, fb };
}

function buildTournamentRecap(ctx: SpotlightContext): { ig: string; fb: string } {
  const { sport, athleteNames, goals, tone, useEmoji, coachComment, date } = ctx;
  const names = athleteNames.length > 0 ? firstNames(athleteNames) : "our athletes";
  const e = emoji("tournament_recap");
  const dateStr = date ? ` — ${date}` : "";
  const goalRef = goals.length > 0 ? goals[0].toLowerCase() : "their development goals";

  if (tone === "professional") {
    const ig = [
      useEmoji ? `${e.main} Tournament recap${dateStr} — ${sport}` : `Tournament recap${dateStr} — ${sport}`,
      `A strong showing from ${names}.`,
      `Every competition is a chance to apply what we've been working toward: ${goalRef}.`,
      coachComment ? `"${coachComment}"` : "",
      "We learn. We grow. We come back better.",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} ${sport} Tournament Recap` : `${sport} Tournament Recap`,
      `We're proud of how ${names} competed${dateStr}.`,
      `The focus throughout has been ${goalRef}, and the effort in competition reflected that work.`,
      coachComment ? `Coaching staff notes: "${coachComment}"` : "",
      "Every competition is part of the development process, and we're excited about what's ahead.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  if (tone === "energetic") {
    const ig = [
      useEmoji ? `${e.main} Recap${dateStr}! ${e.accent}` : `Recap${dateStr}!`,
      `${names} showed up and competed in ${sport}${dateStr}.`,
      `The work toward ${goalRef} is showing up in real moments.`,
      coachComment ? `"${coachComment}"` : "",
      "On to the next one.",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} Competition Recap! ${e.accent}` : "Competition Recap!",
      `What a moment for ${names} in ${sport}${dateStr}.`,
      `All that development work — focusing on ${goalRef} — showed up when it counted.`,
      coachComment ? `Coach's take: "${coachComment}"` : "",
      "We're already looking forward to what's next.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  // recruiting
  const ig = [
    useEmoji ? `${e.main} ${sport} — Competition Recap` : `${sport} — Competition Recap`,
    `${names} recently competed and represented the program with the effort and focus we develop every day.`,
    `The work around ${goalRef} continues to translate to competition.`,
    coachComment ? `"${coachComment}"` : "",
  ].filter(Boolean).join("\n\n");

  const fb = [
    useEmoji ? `${e.main} ${sport} Competition Recap` : `${sport} Competition Recap`,
    `We want to take a moment to recognize the compete level that ${names} brought to the table${dateStr}.`,
    `Our program focuses on developing athletes with the habits and skills to succeed at the next level — and moments like this show that development in action.`,
    `The focus area: ${goalRef}. The result: growth.`,
    coachComment ? `"${coachComment}"` : "",
  ].filter(Boolean).join("\n\n");

  return { ig, fb };
}

function buildWeeklyProgress(ctx: SpotlightContext): { ig: string; fb: string } {
  const { sport, athleteNames, goals, progressStatus, tone, useEmoji, coachComment, date } = ctx;
  const count = athleteNames.length;
  const teamRef = count > 0 ? `${count} athlete${count > 1 ? "s" : ""}` : "our group";
  const goal = goalPhrase(goals, tone);
  const progress = progressPhrase(progressStatus, tone);
  const e = emoji("weekly_progress");
  const dateStr = date ? ` — Week of ${date}` : "";

  if (tone === "professional") {
    const ig = [
      useEmoji ? `${e.main} Weekly progress${dateStr} — ${sport}` : `Weekly progress${dateStr} — ${sport}`,
      `${teamRef} continue to work toward ${goal}.`,
      progress,
      coachComment ? `"${coachComment}"` : "",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} ${sport} — Weekly Progress Update` : `${sport} — Weekly Progress Update`,
      `Another week of development in our ${sport} program.`,
      `${teamRef} are currently working toward ${goal}, and the week brought meaningful progress.`,
      progress,
      coachComment ? `A note from our staff: "${coachComment}"` : "",
      "The work continues.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  if (tone === "energetic") {
    const ig = [
      useEmoji ? `${e.accent} Week recap${dateStr}!` : `Week recap${dateStr}!`,
      `${teamRef} putting in the work — ${sport} development keeps moving.`,
      `Goal: ${goal}. ${progress}`,
      coachComment ? `"${coachComment}"` : "",
    ].filter(Boolean).join("\n\n");

    const fb = [
      useEmoji ? `${e.main} Weekly Progress Highlight! ${e.accent}` : "Weekly Progress Highlight!",
      `Another strong week in the ${sport} program.`,
      `${teamRef} focused on ${goal} this week and the reps are adding up.`,
      progress,
      coachComment ? `Coach's note: "${coachComment}"` : "",
      "Big things are built one week at a time.",
    ].filter(Boolean).join("\n\n");

    return { ig, fb };
  }

  // recruiting
  const ig = [
    useEmoji ? `${e.main} ${sport} — Weekly Development Highlight` : `${sport} — Weekly Development Highlight`,
    `${teamRef} continue to put in the focused work that creates opportunities.`,
    `This week's focus: ${goal}. ${progress}`,
    coachComment ? `"${coachComment}"` : "",
  ].filter(Boolean).join("\n\n");

  const fb = [
    useEmoji ? `${e.main} ${sport} Weekly Development Update` : `${sport} Weekly Development Update`,
    `In our program, development is a weekly commitment — not a seasonal one.`,
    `${teamRef} are working toward ${goal}, and the consistency they're showing${dateStr} is exactly what we build here.`,
    progress,
    coachComment ? `"${coachComment}"` : "",
    "We develop athletes for the long game.",
  ].filter(Boolean).join("\n\n");

  return { ig, fb };
}

// ─── Hashtag builder ──────────────────────────────────────────────────────────

function buildHashtags(ctx: SpotlightContext): string[] {
  const { sport, postType, tone } = ctx;
  const sportSlug = sport.toLowerCase().replace(/\s+/g, "");

  const base = [`#${sportSlug}`, "#athletedevelopment", "#development", "#coaching"];

  const byType: Record<SpotlightPostType, string[]> = {
    athlete_spotlight: ["#athletespotlight", "#growthmindset", "#workinprogress"],
    team_development: ["#teamdevelopment", "#process", "#buildingathletes"],
    tournament_recap: ["#competition", "#compete", "#gameday"],
    weekly_progress: ["#weeklygoals", "#consistency", "#progressnotperfection"],
  };

  const byTone: Record<SpotlightTone, string[]> = {
    professional: ["#coachinglife", "#elitedevelopment"],
    energetic: ["#hustle", "#grind", "#putinthework"],
    recruiting: ["#recruiting", "#nextlevel", "#collegeprep"],
  };

  return [...base, ...byType[postType], ...byTone[tone]];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateSpotlightCaptions(
  ctx: SpotlightContext
): Promise<SpotlightCaptions> {
  // Simulate generation delay (matches existing AI service pattern)
  await new Promise((r) => setTimeout(r, 900));

  let ig: string;
  let fb: string;

  switch (ctx.postType) {
    case "athlete_spotlight": {
      const result = buildAthleteSpotlight(ctx);
      ig = result.ig;
      fb = result.fb;
      break;
    }
    case "team_development": {
      const result = buildTeamDevelopment(ctx);
      ig = result.ig;
      fb = result.fb;
      break;
    }
    case "tournament_recap": {
      const result = buildTournamentRecap(ctx);
      ig = result.ig;
      fb = result.fb;
      break;
    }
    case "weekly_progress": {
      const result = buildWeeklyProgress(ctx);
      ig = result.ig;
      fb = result.fb;
      break;
    }
    default: {
      ig = "Development-focused caption. Edit to personalize.";
      fb = ig;
    }
  }

  const hashtags = buildHashtags(ctx);

  // Instagram: append hashtags inline (≤ 2200 chars total)
  const igWithTags = `${ig}\n\n${hashtags.join(" ")}`;
  const instagram = igWithTags.length <= 2200 ? igWithTags : ig.slice(0, 2180) + "...";

  return { instagram, facebook: fb, hashtags };
}

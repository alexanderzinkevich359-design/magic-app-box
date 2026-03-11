/**
 * Game Insight Service — template-based AI analysis.
 * No external API calls. Simulates async processing with a short delay.
 * All output is development-focused: effort, growth, consistency, process.
 * No rankings, comparisons between athletes, or performance predictions.
 */

export interface RecentGame {
  date: string;
  eventType: string;
  opponent?: string | null;
  stats: Record<string, number>; // { stat_key: value, ... } across all groups
}

export interface GameInsightContext {
  athleteName: string;
  position: string;
  sport: string;
  recentGames: RecentGame[];
}

export interface GameInsight {
  summary: string;
  highlights: string[];
  developmentNotes: string[];
}

/** Compare avg of last 2 games vs avg of previous 2 games for a given key. */
function trend(games: RecentGame[], key: string): "up" | "down" | "stable" | null {
  const vals = games
    .map((g) => g.stats[key])
    .filter((v) => v !== undefined && v !== null) as number[];
  if (vals.length < 3) return null;
  const recent = vals.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(vals.slice(0, 2).length, 2);
  const prior = vals.slice(2, 4).reduce((a, b) => a + b, 0) / Math.min(vals.slice(2, 4).length, 2);
  if (recent > prior * 1.08) return "up";
  if (recent < prior * 0.92) return "down";
  return "stable";
}

/** Safely pick a value from a stats record. */
function stat(game: RecentGame, key: string): number | null {
  const v = game.stats[key];
  return v !== undefined && v !== null ? v : null;
}

/** Average of a stat across games (ignoring nulls). */
function avg(games: RecentGame[], key: string): number | null {
  const vals = games
    .map((g) => stat(g, key))
    .filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Template banks ───────────────────────────────────────────────────────────

const OPENING_TEMPLATES: Record<string, string[]> = {
  baseball: [
    "{name} has shown real dedication at the plate across recent outings.",
    "{name}'s approach at the plate has been something to build on.",
    "{name} is putting in the work on both sides of the ball.",
  ],
  softball: [
    "{name} continues to develop a complete game at both ends of the field.",
    "{name}'s recent outings reflect consistent effort in the circle and at the plate.",
    "{name} is growing their game through steady repetitions.",
  ],
  tennis: [
    "{name} is developing a more complete match game through recent competition.",
    "{name}'s consistency on serve and from the baseline continues to build.",
    "{name} is putting points together with greater purpose.",
  ],
  volleyball: [
    "{name} is contributing across multiple areas of the game.",
    "{name}'s presence on the court continues to grow with each competition.",
    "{name} is developing the all-around skills that make a difference at game speed.",
  ],
  default: [
    "{name} is making consistent strides in their development.",
    "{name} brings effort and focus to each competition.",
    "{name}'s recent performances reflect a commitment to the process.",
  ],
};

const HIGHLIGHT_POOLS: Record<string, Record<string, string[]>> = {
  baseball: {
    ab_up: [
      "Getting more opportunities at the plate reflects growing coach trust.",
      "Increased plate appearances are a sign of consistent presence in the lineup.",
    ],
    h_up: [
      "Hitting the ball with more consistency — making contact and putting pressure on the defense.",
      "The bat is coming alive; solid contact is becoming a reliable part of {name}'s game.",
    ],
    bb_up: [
      "Working deeper counts and earning walks shows improved plate discipline.",
      "The increased walk rate reflects a patient, process-oriented approach at the plate.",
    ],
    k_down: [
      "Reducing strikeouts shows better recognition and adjustment at the plate.",
      "Fewer Ks suggest improved pitch recognition and willingness to adjust mid-at-bat.",
    ],
    ip_up: [
      "Longer outings on the mound demonstrate endurance and command improvements.",
      "Going deeper into games is a result of more efficient pitch usage — a real growth marker.",
    ],
    so_up: [
      "A strong strikeout trend on the mound reflects sharpened stuff and command.",
      "Generating more swings and misses is a direct result of consistent mechanics work.",
    ],
    e_down: [
      "Cleaner defensive work in the field — fewer errors reflect improved footwork and focus.",
      "Tightening up the glove side shows the fundamentals work is translating to games.",
    ],
  },
  softball: {
    h_up: [
      "Making solid contact at the plate consistently — a direct result of reps in the cage.",
      "Hitting the ball hard more often reflects improved timing and bat path.",
    ],
    so_up: [
      "Punching out batters at a higher rate is a sign the pitch mix is working.",
      "Strikeout momentum on the mound reflects improved spin and command.",
    ],
    e_down: [
      "Fewer errors in the field reflect sharper reads and stronger hands.",
      "Cleaner defensive appearances build team confidence and change game momentum.",
    ],
  },
  tennis: {
    aces_up: [
      "More aces signal a more confident, aggressive serve.",
      "A sharper serve is opening up points and adding a new dimension to {name}'s game.",
    ],
    df_down: [
      "Reducing double faults shows improved first-serve rhythm and consistency.",
      "Fewer double faults mean more free points for the team — a key process improvement.",
    ],
    winners_up: [
      "More clean winners reflect better shot selection and ball-striking confidence.",
      "Finding the lines more consistently is the product of disciplined practice.",
    ],
    ue_down: [
      "Cutting unforced errors is one of the most controllable improvements in tennis.",
      "Fewer unforced errors reflect greater composure and better decision-making under pressure.",
    ],
  },
  volleyball: {
    kills_up: [
      "More kills in recent matches reflect improved timing and hitting mechanics.",
      "Generating kills at a higher rate is a direct result of approach and arm-swing work.",
    ],
    aces_up: [
      "More service aces signal that the serve is becoming a genuine weapon.",
      "An aggressive, consistent serve is opening up point-scoring opportunities.",
    ],
    digs_up: [
      "Getting to more balls in the back row reflects sharper read and first-step quickness.",
      "Increased dig numbers show improved defensive positioning and effort.",
    ],
    e_down: [
      "Fewer attack errors reflect better decision-making at the net.",
      "Cleaner hitting approaches are cutting errors and improving offensive efficiency.",
    ],
  },
};

const DEVELOPMENT_NOTES: Record<string, string[]> = {
  baseball: [
    "Continue tracking pitch-to-contact ratio in practice to reinforce the plate approach.",
    "Reps in the cage focused on pitch recognition will carry over directly to at-bats.",
    "Consistent defensive footwork drills remain the foundation of error-free play.",
    "Building arm strength through long-toss progressions will support continued growth.",
    "Keeping a personal game chart to self-scout tendencies is a habit worth developing.",
    "Work on two-strike approach — staying in longer at-bats is a measurable skill.",
  ],
  softball: [
    "Pitch-to-location work in the circle is the clearest path to continued command improvement.",
    "Reps in the cage on pitch recognition will translate directly to better at-bat results.",
    "Defensive footwork and glove work in practice remain the foundation of consistent defense.",
    "Tracking personal game data in a journal builds self-awareness and focus.",
  ],
  tennis: [
    "Serve routine consistency in practice builds the muscle memory that holds up under pressure.",
    "Point construction drills — playing out patterns — build purposeful shot selection.",
    "Mental reset routines between points are as important as physical preparation.",
    "Tracking rally length goals in practice helps develop patience on both sides of the net.",
  ],
  volleyball: [
    "Platform passing mechanics in reps translate directly to dig efficiency in matches.",
    "Approach and arm-swing drills with video feedback accelerate hitting mechanics.",
    "Serve placement practice targeting zones builds the consistency to create aces in matches.",
    "Reading the setter's hands and opponent blockers is a mental skill built through film review.",
  ],
  default: [
    "Consistent daily practice habits remain the strongest driver of performance improvement.",
    "Tracking personal effort and focus goals builds self-awareness over time.",
    "Short-term process goals keep development momentum during both peaks and valleys.",
  ],
};

function pickOpening(sport: string, name: string): string {
  const pool = OPENING_TEMPLATES[sport] ?? OPENING_TEMPLATES.default;
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace("{name}", name);
}

function pickHighlights(ctx: GameInsightContext): string[] {
  const sport = ctx.sport.toLowerCase();
  const pool = HIGHLIGHT_POOLS[sport] ?? {};
  const highlights: string[] = [];

  const keys: Array<[string, string]> = [
    ["ab", "ab_up"], ["h", "h_up"], ["bb", "bb_up"], ["k", "k_down"],
    ["ip", "ip_up"], ["so", "so_up"], ["e", "e_down"],
    ["aces", "aces_up"], ["df", "df_down"], ["winners", "winners_up"], ["ue", "ue_down"],
    ["kills", "kills_up"], ["digs", "digs_up"],
  ];

  for (const [statKey, poolKey] of keys) {
    const t = trend(ctx.recentGames, statKey);
    // "up" or "down" based on pool key suffix
    const positive = poolKey.endsWith("_up") ? t === "up" : t === "down";
    if (positive && pool[poolKey]) {
      const templates = pool[poolKey];
      const text = templates[Math.floor(Math.random() * templates.length)].replace("{name}", ctx.athleteName);
      highlights.push(text);
      if (highlights.length >= 3) break;
    }
  }

  if (!highlights.length) {
    highlights.push(
      `${ctx.athleteName} is building a baseline of game data that will make trends visible over time.`
    );
  }

  return highlights;
}

function pickDevelopmentNotes(sport: string): string[] {
  const pool = DEVELOPMENT_NOTES[sport.toLowerCase()] ?? DEVELOPMENT_NOTES.default;
  // Pick 2 non-repeating notes
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateGameInsight(ctx: GameInsightContext): Promise<GameInsight> {
  // Simulated async delay (like other AI services in codebase)
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const sport = ctx.sport.toLowerCase();
  const gamesPlayed = ctx.recentGames.filter((g) => g.eventType !== "practice").length;
  const hasEnoughData = gamesPlayed >= 2;

  const summary = hasEnoughData
    ? `${pickOpening(sport, ctx.athleteName)} Across ${gamesPlayed} recent game${gamesPlayed !== 1 ? "s" : ""}, the data reflects consistent effort and developing patterns worth reinforcing.`
    : `${ctx.athleteName} is building their game log — more competition data will reveal clearer trends over time. The focus right now is on consistent effort and process.`;

  const highlights = hasEnoughData ? pickHighlights(ctx) : [
    `${ctx.athleteName} is establishing their personal performance baseline — a key first step in data-driven development.`,
  ];

  const developmentNotes = pickDevelopmentNotes(sport);

  return { summary, highlights, developmentNotes };
}

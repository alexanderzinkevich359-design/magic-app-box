import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, Clock, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday, parseISO, addDays,
  isBefore, startOfDay,
} from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type PracticeSession = {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  color: string | null;
};

type Game = {
  id: string;
  athlete_id: string;
  game_date: string;
  opponent: string;
  result: string | null;
  score_us: number | null;
  score_them: number | null;
  at_bats: number | null;
  hits: number | null;
  rbis: number | null;
  runs: number | null;
  walks: number | null;
  strikeouts_batting: number | null;
  home_runs: number | null;
  innings_pitched: number | null;
  strikeouts_pitching: number | null;
  walks_pitching: number | null;
  earned_runs: number | null;
  notes: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRACTICE_COLOR: Record<string, string> = {
  default: "bg-primary/20 border-primary/40 text-primary",
  blue: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  green: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  orange: "bg-orange-500/20 border-orange-500/40 text-orange-400",
  purple: "bg-violet-500/20 border-violet-500/40 text-violet-400",
};
const getPracticeColor = (c: string | null) =>
  PRACTICE_COLOR[c ?? "default"] ?? PRACTICE_COLOR.default;

const RESULT_COLORS: Record<string, string> = {
  W: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  L: "bg-red-500/20 border-red-500/40 text-red-400",
  T: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
};

const batting = (g: Game) => {
  const avg = g.at_bats ? ((g.hits ?? 0) / g.at_bats).toFixed(3).replace(/^0/, "") : null;
  return { avg };
};

// ── Component ─────────────────────────────────────────────────────────────────

const AthleteSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Game form state
  const [showGameDialog, setShowGameDialog] = useState(false);
  const [editGame, setEditGame] = useState<Game | null>(null);
  const [gameDate, setGameDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [result, setResult] = useState("");
  const [scoreUs, setScoreUs] = useState("");
  const [scoreThem, setScoreThem] = useState("");
  const [atBats, setAtBats] = useState("");
  const [hits, setHits] = useState("");
  const [rbis, setRbis] = useState("");
  const [runs, setRuns] = useState("");
  const [walks, setWalks] = useState("");
  const [kBatting, setKBatting] = useState("");
  const [homeRuns, setHomeRuns] = useState("");
  const [ip, setIp] = useState("");
  const [kPitching, setKPitching] = useState("");
  const [bbPitching, setBbPitching] = useState("");
  const [er, setEr] = useState("");
  const [gameNotes, setGameNotes] = useState("");

  // Practice detail
  const [selectedPractice, setSelectedPractice] = useState<PracticeSession | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const today = startOfDay(new Date());

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: practices = [], isLoading: practicesLoading } = useQuery({
    queryKey: ["athlete-practice", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coach_schedule")
        .select("id, title, scheduled_date, start_time, end_time, notes, color")
        .eq("athlete_id", user.id)
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PracticeSession[];
    },
    enabled: !!user,
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ["athlete-games", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("athlete_games")
        .select("*")
        .eq("athlete_id", user.id)
        .gte("game_date", format(monthStart, "yyyy-MM-dd"))
        .lte("game_date", format(monthEnd, "yyyy-MM-dd"))
        .order("game_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Game[];
    },
    enabled: !!user,
  });

  const isLoading = practicesLoading || gamesLoading;

  // ── Calendar maps ──────────────────────────────────────────────────────────

  const practiceByDate = useMemo(() => {
    const map: Record<string, PracticeSession[]> = {};
    practices.forEach((p) => {
      if (!map[p.scheduled_date]) map[p.scheduled_date] = [];
      map[p.scheduled_date].push(p);
    });
    return map;
  }, [practices]);

  const gameByDate = useMemo(() => {
    const map: Record<string, Game[]> = {};
    games.forEach((g) => {
      if (!map[g.game_date]) map[g.game_date] = [];
      map[g.game_date].push(g);
    });
    return map;
  }, [games]);

  const upcomingPractices = useMemo(() => {
    const cutoff = addDays(today, 14);
    return practices
      .filter((p) => {
        const d = parseISO(p.scheduled_date);
        return !isBefore(d, today) && isBefore(d, cutoff);
      })
      .slice(0, 8);
  }, [practices, today]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveGame = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const payload = {
        athlete_id: user.id,
        game_date: gameDate,
        opponent: opponent.trim(),
        result: result || null,
        score_us: scoreUs ? parseInt(scoreUs) : null,
        score_them: scoreThem ? parseInt(scoreThem) : null,
        at_bats: atBats ? parseInt(atBats) : null,
        hits: hits ? parseInt(hits) : null,
        rbis: rbis ? parseInt(rbis) : null,
        runs: runs ? parseInt(runs) : null,
        walks: walks ? parseInt(walks) : null,
        strikeouts_batting: kBatting ? parseInt(kBatting) : null,
        home_runs: homeRuns ? parseInt(homeRuns) : null,
        innings_pitched: ip ? parseFloat(ip) : null,
        strikeouts_pitching: kPitching ? parseInt(kPitching) : null,
        walks_pitching: bbPitching ? parseInt(bbPitching) : null,
        earned_runs: er ? parseInt(er) : null,
        notes: gameNotes.trim() || null,
      };
      if (editGame) {
        const { error } = await (supabase as any)
          .from("athlete_games").update(payload).eq("id", editGame.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("athlete_games").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-games"] });
      closeGameDialog();
      toast({ title: editGame ? "Game updated" : "Game logged!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteGame = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("athlete_games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-games"] });
      closeGameDialog();
      toast({ title: "Game removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Dialog helpers ────────────────────────────────────────────────────────

  const openNewGame = (date: string) => {
    setEditGame(null);
    setGameDate(date);
    setOpponent(""); setResult(""); setScoreUs(""); setScoreThem("");
    setAtBats(""); setHits(""); setRbis(""); setRuns(""); setWalks("");
    setKBatting(""); setHomeRuns(""); setIp(""); setKPitching("");
    setBbPitching(""); setEr(""); setGameNotes("");
    setShowGameDialog(true);
  };

  const openEditGame = (g: Game) => {
    setEditGame(g);
    setGameDate(g.game_date);
    setOpponent(g.opponent);
    setResult(g.result ?? "");
    setScoreUs(g.score_us != null ? String(g.score_us) : "");
    setScoreThem(g.score_them != null ? String(g.score_them) : "");
    setAtBats(g.at_bats != null ? String(g.at_bats) : "");
    setHits(g.hits != null ? String(g.hits) : "");
    setRbis(g.rbis != null ? String(g.rbis) : "");
    setRuns(g.runs != null ? String(g.runs) : "");
    setWalks(g.walks != null ? String(g.walks) : "");
    setKBatting(g.strikeouts_batting != null ? String(g.strikeouts_batting) : "");
    setHomeRuns(g.home_runs != null ? String(g.home_runs) : "");
    setIp(g.innings_pitched != null ? String(g.innings_pitched) : "");
    setKPitching(g.strikeouts_pitching != null ? String(g.strikeouts_pitching) : "");
    setBbPitching(g.walks_pitching != null ? String(g.walks_pitching) : "");
    setEr(g.earned_runs != null ? String(g.earned_runs) : "");
    setGameNotes(g.notes ?? "");
    setShowGameDialog(true);
  };

  const closeGameDialog = () => { setShowGameDialog(false); setEditGame(null); };

  const isThisMonth = format(currentMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="athlete">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Schedule</h1>
          <p className="text-muted-foreground mt-1">Practice from your coach · Log your own games</p>
        </div>
        <Button onClick={() => openNewGame(format(new Date(), "yyyy-MM-dd"))}>
          <Plus className="h-4 w-4 mr-2" /> Log Game
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-['Space_Grotesk']">{format(currentMonth, "MMMM yyyy")}</h2>
          {!isThisMonth && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/40" /> Practice (coach)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" /> Game
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar grid */}
        <Card>
          <CardContent className="p-2 sm:p-4">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[minmax(80px,1fr)] border-t border-l">
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-r border-b bg-secondary/20" />
                  ))}
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const todayDay = isToday(day);
                    const dayPractices = practiceByDate[dateKey] ?? [];
                    const dayGames = gameByDate[dateKey] ?? [];
                    return (
                      <div
                        key={dateKey}
                        className={`border-r border-b p-1 relative group cursor-pointer transition-colors hover:bg-secondary/30 ${todayDay ? "bg-primary/5" : ""}`}
                        onClick={() => openNewGame(dateKey)}
                      >
                        <span className={`text-xs font-medium ${todayDay ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-0.5 space-y-0.5 overflow-hidden">
                          {dayPractices.slice(0, 2).map((p) => (
                            <div
                              key={p.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedPractice(p); }}
                              className={`text-[10px] truncate rounded px-1 py-0.5 border cursor-pointer ${getPracticeColor(p.color)}`}
                              title={p.title}
                            >
                              {p.start_time && <span className="font-medium">{p.start_time.slice(0, 5)} </span>}
                              {p.title || "Practice"}
                            </div>
                          ))}
                          {dayGames.map((g) => (
                            <div
                              key={g.id}
                              onClick={(e) => { e.stopPropagation(); openEditGame(g); }}
                              className={`text-[10px] truncate rounded px-1 py-0.5 border cursor-pointer ${g.result ? RESULT_COLORS[g.result] : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"}`}
                              title={`vs. ${g.opponent}`}
                            >
                              {g.result && <span className="font-bold mr-0.5">{g.result}</span>}
                              vs. {g.opponent}
                            </div>
                          ))}
                          {(dayPractices.length > 2) && (
                            <div className="text-[10px] text-muted-foreground px-1">+{dayPractices.length - 2} more</div>
                          )}
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Upcoming practice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-['Space_Grotesk'] flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Upcoming Practice (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {upcomingPractices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No practice sessions scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingPractices.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPractice(p)}
                      className="w-full text-left rounded-lg border p-2.5 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getPracticeColor(p.color).split(" ")[0]}`} />
                        <p className="text-xs font-medium truncate">{p.title || "Practice"}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">
                        {format(parseISO(p.scheduled_date), "EEE, MMM d")}
                        {p.start_time && ` · ${p.start_time.slice(0, 5)}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* This month games */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-['Space_Grotesk'] flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" /> Games This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {games.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No games logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {games.map((g) => {
                    const { avg } = batting(g);
                    return (
                      <button
                        key={g.id}
                        onClick={() => openEditGame(g)}
                        className="w-full text-left rounded-lg border p-2.5 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">vs. {g.opponent}</p>
                          {g.result && (
                            <Badge className={`text-[10px] px-1.5 py-0 h-5 ${RESULT_COLORS[g.result]}`} variant="outline">
                              {g.result}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(g.game_date), "MMM d")}
                          {g.score_us != null && g.score_them != null && ` · ${g.score_us}–${g.score_them}`}
                          {avg && ` · ${avg} AVG`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Practice detail dialog */}
      <Dialog open={!!selectedPractice} onOpenChange={(o) => !o && setSelectedPractice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">{selectedPractice?.title || "Practice"}</DialogTitle>
          </DialogHeader>
          {selectedPractice && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  {format(parseISO(selectedPractice.scheduled_date), "EEEE, MMMM d")}
                  {selectedPractice.start_time && ` · ${selectedPractice.start_time.slice(0, 5)}`}
                  {selectedPractice.end_time && ` – ${selectedPractice.end_time.slice(0, 5)}`}
                </span>
              </div>
              {selectedPractice.notes && (
                <p className="text-sm text-muted-foreground rounded-lg bg-secondary/30 p-3">{selectedPractice.notes}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedPractice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log / Edit Game dialog */}
      <Dialog open={showGameDialog} onOpenChange={(o) => { if (!o) closeGameDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">
              {editGame ? "Edit Game" : "Log Game"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Game info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Opponent</Label>
                <Input placeholder="Team name" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Result</Label>
                <Select value={result || "none"} onValueChange={(v) => setResult(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No result</SelectItem>
                    <SelectItem value="W">Win</SelectItem>
                    <SelectItem value="L">Loss</SelectItem>
                    <SelectItem value="T">Tie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Our Score</Label>
                <Input type="number" min={0} placeholder="0" value={scoreUs} onChange={(e) => setScoreUs(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Their Score</Label>
                <Input type="number" min={0} placeholder="0" value={scoreThem} onChange={(e) => setScoreThem(e.target.value)} className="h-9" />
              </div>
            </div>

            {/* Batting stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Batting</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "AB", state: atBats, set: setAtBats },
                  { label: "H", state: hits, set: setHits },
                  { label: "RBI", state: rbis, set: setRbis },
                  { label: "R", state: runs, set: setRuns },
                  { label: "BB", state: walks, set: setWalks },
                  { label: "K", state: kBatting, set: setKBatting },
                  { label: "HR", state: homeRuns, set: setHomeRuns },
                ].map(({ label, state, set }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      type="number" min={0} placeholder="0"
                      value={state} onChange={(e) => set(e.target.value)}
                      className="h-8 text-xs px-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pitching stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pitching <span className="normal-case font-normal">(optional)</span></p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "IP", state: ip, set: setIp, step: "0.1" },
                  { label: "K", state: kPitching, set: setKPitching },
                  { label: "BB", state: bbPitching, set: setBbPitching },
                  { label: "ER", state: er, set: setEr },
                ].map(({ label, state, set, step }) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      type="number" min={0} step={step ?? "1"} placeholder="0"
                      value={state} onChange={(e) => set(e.target.value)}
                      className="h-8 text-xs px-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="How did it go? Anything to remember..."
                value={gameNotes}
                onChange={(e) => setGameNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            {editGame && (
              <Button
                variant="destructive" size="sm"
                onClick={() => deleteGame.mutate(editGame.id)}
                disabled={deleteGame.isPending}
                className="mr-auto"
              >
                {deleteGame.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={closeGameDialog}>Cancel</Button>
            <Button
              onClick={() => saveGame.mutate()}
              disabled={!gameDate || !opponent.trim() || saveGame.isPending}
            >
              {saveGame.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editGame ? "Update" : "Log Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AthleteSchedule;

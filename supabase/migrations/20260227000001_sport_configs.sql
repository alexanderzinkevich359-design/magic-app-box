-- 1. Add JSONB config columns to sports table (additive, safe on live DB)
ALTER TABLE public.sports
  ADD COLUMN IF NOT EXISTS positions                  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS skills                     JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS metrics_by_position        JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goal_templates_by_position JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS schedule_presets           JSONB NOT NULL DEFAULT '{"inSeason":[],"offSeason":[]}',
  ADD COLUMN IF NOT EXISTS session_config             JSONB NOT NULL DEFAULT '{}';

-- 2. Add session_extras to training_sessions for future sport-specific session data
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS session_extras JSONB;

-- 3. Ensure Baseball row exists before updating it
INSERT INTO public.sports (name, slug, icon, is_active)
SELECT 'Baseball', 'baseball', '⚾', true
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE slug = 'baseball');

-- 4. Seed Baseball with full config (preserves existing UUID via UPDATE)
UPDATE public.sports SET
  icon = '⚾', is_active = true,
  positions = '["Pitcher","Catcher","Infielder","Outfielder","Hitter"]',
  skills = '["Hitting","Pitching","Fielding","Baserunning"]',
  metrics_by_position = '{
    "Pitcher":   [{"type":"fastball_velocity","label":"Fastball Velocity","unit":"mph","category":"velocity"},{"type":"changeup_velocity","label":"Changeup Velocity","unit":"mph","category":"velocity"},{"type":"spin_rate","label":"Spin Rate","unit":"rpm","category":"mechanics"},{"type":"strike_percentage","label":"Strike %","unit":"%","category":"accuracy"},{"type":"whip","label":"WHIP","unit":"","category":"performance"}],
    "Catcher":   [{"type":"pop_time","label":"Pop Time","unit":"sec","category":"speed"},{"type":"blocking_percentage","label":"Blocking %","unit":"%","category":"defense"},{"type":"framing_rate","label":"Framing Rate","unit":"%","category":"defense"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"}],
    "Infielder": [{"type":"fielding_percentage","label":"Fielding %","unit":"%","category":"defense"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"},{"type":"reaction_time","label":"Reaction Time","unit":"sec","category":"speed"},{"type":"double_play_time","label":"Double Play Turn","unit":"sec","category":"speed"}],
    "Outfielder":[{"type":"sprint_speed","label":"Sprint Speed","unit":"mph","category":"speed"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"},{"type":"route_efficiency","label":"Route Efficiency","unit":"%","category":"defense"},{"type":"fly_ball_catch_rate","label":"Fly Ball Catch %","unit":"%","category":"defense"}],
    "Hitter":    [{"type":"exit_velocity","label":"Exit Velocity","unit":"mph","category":"power"},{"type":"launch_angle","label":"Launch Angle","unit":"°","category":"mechanics"},{"type":"bat_speed","label":"Bat Speed","unit":"mph","category":"power"},{"type":"hard_hit_rate","label":"Hard Hit %","unit":"%","category":"performance"},{"type":"batting_average","label":"Batting Avg","unit":"","category":"performance"}]
  }',
  goal_templates_by_position = '{
    "Pitcher":   {"category":"skill","title":"Improve fastball command","target":"70% strike rate","rationale":"Command is the foundation of pitching success at every level"},
    "Catcher":   {"category":"skill","title":"Reduce pop time to 2nd base","target":"Sub 2.0 sec","rationale":"Pop time directly impacts your ability to manage the running game"},
    "Infielder": {"category":"skill","title":"Improve fielding percentage","target":"95%+","rationale":"Consistent defense builds coach trust and playing time"},
    "Outfielder":{"category":"skill","title":"Improve route efficiency on fly balls","target":"90%+","rationale":"Better routes reduce errors and range limitations"},
    "Hitter":    {"category":"skill","title":"Increase exit velocity","target":"88 mph","rationale":"Exit velocity is one of the strongest predictors of offensive output"}
  }',
  schedule_presets = '{"inSeason":[{"label":"Team Practice","color":"default"},{"label":"Pre-Game Warmup","color":"orange"},{"label":"Game Day","color":"blue"},{"label":"Bullpen Session","color":"blue"},{"label":"Batting Practice","color":"orange"},{"label":"Film Session","color":"purple"}],"offSeason":[{"label":"Weight Room","color":"purple"},{"label":"Conditioning","color":"green"},{"label":"Speed & Agility","color":"green"},{"label":"Skills Session","color":"orange"},{"label":"Film Session","color":"purple"}]}',
  session_config = '{"pitchCountPositions":["Pitcher"],"pitchTypes":["Fastball","Curveball","Slider","Changeup","Cutter","Sinker","Splitter","Knuckleball"],"hasHandTracking":true,"throwLabel":"Throws","throwLabelByPosition":{"Pitcher":"Throw Count (warmup)","Catcher":"Throws to 2B","Infielder":"Throw Count","Outfielder":"Throws","Hitter":"Throw Count"},"repsLabelByPosition":{"Hitter":"Swings / At-Bats","Catcher":"Blocking Reps","Infielder":"Fielding Reps","Outfielder":"Fly Ball Reps","Pitcher":"Drill Reps"}}'
WHERE slug = 'baseball';

-- 5. Insert Tennis
INSERT INTO public.sports (name, slug, icon, is_active, positions, skills,
  metrics_by_position, goal_templates_by_position, schedule_presets, session_config)
SELECT 'Tennis','tennis','🎾',true,
  '["Singles","Doubles"]',
  '["Serve","Forehand","Backhand","Footwork","Mental Toughness"]',
  '{"Singles":[{"type":"first_serve_pct","label":"First Serve %","unit":"%","category":"accuracy"},{"type":"ace_count","label":"Aces","unit":"","category":"power"},{"type":"double_fault_count","label":"Double Faults","unit":"","category":"accuracy"},{"type":"rally_win_pct","label":"Rally Win %","unit":"%","category":"performance"}],"Doubles":[{"type":"first_serve_pct","label":"First Serve %","unit":"%","category":"accuracy"},{"type":"volley_win_pct","label":"Volley Win %","unit":"%","category":"performance"}]}',
  '{"Singles":{"category":"skill","title":"Increase first-serve percentage under pressure","target":"65%","rationale":"Consistent first serves reduce double fault pressure and set up points"},"Doubles":{"category":"skill","title":"Improve net volley win rate","target":"70%","rationale":"Net proficiency is the key differentiator in doubles"}}',
  '{"inSeason":[{"label":"Match Day","color":"blue"},{"label":"Match Prep","color":"orange"},{"label":"Serve Practice","color":"orange"},{"label":"Team Practice","color":"default"},{"label":"Film Session","color":"purple"}],"offSeason":[{"label":"Conditioning","color":"green"},{"label":"Speed & Agility","color":"green"},{"label":"Skills Session","color":"orange"},{"label":"Film Session","color":"purple"},{"label":"Weight Room","color":"purple"}]}',
  '{"pitchCountPositions":[],"pitchTypes":[],"hasHandTracking":false,"throwLabel":null,"throwLabelByPosition":{},"repsLabelByPosition":{}}'
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE slug = 'tennis');

-- 6. Insert Softball
INSERT INTO public.sports (name, slug, icon, is_active, positions, skills,
  metrics_by_position, goal_templates_by_position, schedule_presets, session_config)
SELECT 'Softball','softball','🥎',true,
  '["Pitcher","Catcher","Infielder","Outfielder","Utility"]',
  '["Hitting","Pitching","Fielding","Throwing Mechanics"]',
  '{"Pitcher":[{"type":"spin_rate","label":"Spin Rate","unit":"rpm","category":"mechanics"},{"type":"rise_ball_break","label":"Rise Ball Break","unit":"in","category":"mechanics"},{"type":"drop_ball_accuracy","label":"Drop Ball Accuracy","unit":"%","category":"accuracy"},{"type":"strike_percentage","label":"Strike %","unit":"%","category":"accuracy"},{"type":"pitch_velocity","label":"Pitch Velocity","unit":"mph","category":"velocity"}],"Catcher":[{"type":"pop_time","label":"Pop Time to 2B","unit":"sec","category":"speed"},{"type":"blocking_percentage","label":"Blocking %","unit":"%","category":"defense"},{"type":"framing_rate","label":"Framing Rate","unit":"%","category":"defense"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"}],"Infielder":[{"type":"fielding_percentage","label":"Fielding %","unit":"%","category":"defense"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"},{"type":"reaction_time","label":"Reaction Time","unit":"sec","category":"speed"},{"type":"double_play_time","label":"Double Play Turn","unit":"sec","category":"speed"}],"Outfielder":[{"type":"sprint_speed","label":"Sprint Speed","unit":"mph","category":"speed"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"},{"type":"route_efficiency","label":"Route Efficiency","unit":"%","category":"defense"},{"type":"fly_ball_catch_rate","label":"Fly Ball Catch %","unit":"%","category":"defense"}],"Utility":[{"type":"fielding_percentage","label":"Fielding %","unit":"%","category":"defense"},{"type":"exit_velocity","label":"Exit Velocity","unit":"mph","category":"power"},{"type":"throw_velocity","label":"Throw Velocity","unit":"mph","category":"velocity"},{"type":"sprint_speed","label":"Sprint Speed","unit":"mph","category":"speed"}]}',
  '{"Pitcher":{"category":"skill","title":"Improve drop-ball accuracy","target":"60% zone rate","rationale":"Drop-ball command is the primary out pitch in softball"},"Catcher":{"category":"skill","title":"Improve throw accuracy to second","target":"Sub 2.2 sec","rationale":"Quick accurate throws control the running game"},"Infielder":{"category":"skill","title":"Improve throw accuracy from shortstop","target":"95%","rationale":"Accurate throws prevent errors on the left side"},"Outfielder":{"category":"skill","title":"Improve route efficiency","target":"90%+","rationale":"Better routes reduce errors and range limitations"},"Utility":{"category":"skill","title":"Develop consistency at multiple positions","target":"Error-free in 80% of appearances","rationale":"Versatility requires equal proficiency across positions"}}',
  '{"inSeason":[{"label":"Team Practice","color":"default"},{"label":"Pre-Game Warmup","color":"orange"},{"label":"Game Day","color":"blue"},{"label":"Circle Work","color":"blue"},{"label":"Batting Practice","color":"orange"},{"label":"Film Session","color":"purple"}],"offSeason":[{"label":"Weight Room","color":"purple"},{"label":"Conditioning","color":"green"},{"label":"Speed & Agility","color":"green"},{"label":"Skills Session","color":"orange"},{"label":"Film Session","color":"purple"}]}',
  '{"pitchCountPositions":["Pitcher"],"pitchTypes":["Fastball","Changeup","Drop Ball","Rise Ball","Curveball","Screwball"],"hasHandTracking":true,"throwLabel":"Throws","throwLabelByPosition":{"Pitcher":"Throw Count (warmup)","Catcher":"Throws to 2B","Infielder":"Throw Count","Outfielder":"Throws","Utility":"Throw Count"},"repsLabelByPosition":{"Pitcher":"Drill Reps","Catcher":"Blocking Reps","Infielder":"Fielding Reps","Outfielder":"Fly Ball Reps","Utility":"Drill Reps"}}'
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE slug = 'softball');

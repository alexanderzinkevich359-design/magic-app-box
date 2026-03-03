-- Volleyball sport config
INSERT INTO public.sports (name, slug, icon, is_active, positions, skills,
  metrics_by_position, goal_templates_by_position, schedule_presets, session_config)
SELECT 'Volleyball','volleyball','🏐',true,
  '["Setter","Outside Hitter","Opposite Hitter","Middle Blocker","Libero","Defensive Specialist"]',
  '["Serving","Passing","Setting","Attacking","Blocking","Defense"]',
  '{
    "Setter":[
      {"type":"setting_accuracy","label":"Setting Accuracy","unit":"%","category":"accuracy"},
      {"type":"assists_per_set","label":"Assists / Set","unit":"","category":"performance"},
      {"type":"serve_receive_error_rate","label":"Serve Receive Errors","unit":"","category":"accuracy"},
      {"type":"dump_kill_rate","label":"Dump Kill %","unit":"%","category":"performance"}
    ],
    "Outside Hitter":[
      {"type":"kill_percentage","label":"Kill %","unit":"%","category":"performance"},
      {"type":"attack_efficiency","label":"Attack Efficiency","unit":"","category":"performance"},
      {"type":"serve_ace_rate","label":"Ace Rate","unit":"%","category":"power"},
      {"type":"passing_rating","label":"Passing Rating","unit":"/3","category":"accuracy"}
    ],
    "Opposite Hitter":[
      {"type":"kill_percentage","label":"Kill %","unit":"%","category":"performance"},
      {"type":"attack_efficiency","label":"Attack Efficiency","unit":"","category":"performance"},
      {"type":"blocks_per_set","label":"Blocks / Set","unit":"","category":"defense"},
      {"type":"serve_ace_rate","label":"Ace Rate","unit":"%","category":"power"}
    ],
    "Middle Blocker":[
      {"type":"blocks_per_set","label":"Blocks / Set","unit":"","category":"defense"},
      {"type":"block_percentage","label":"Block %","unit":"%","category":"defense"},
      {"type":"attack_efficiency","label":"Attack Efficiency","unit":"","category":"performance"},
      {"type":"kill_percentage","label":"Kill %","unit":"%","category":"performance"}
    ],
    "Libero":[
      {"type":"passing_rating","label":"Passing Rating","unit":"/3","category":"accuracy"},
      {"type":"dig_percentage","label":"Dig %","unit":"%","category":"defense"},
      {"type":"serve_receive_error_rate","label":"Reception Errors","unit":"","category":"accuracy"},
      {"type":"defensive_rating","label":"Defensive Rating","unit":"/5","category":"defense"}
    ],
    "Defensive Specialist":[
      {"type":"passing_rating","label":"Passing Rating","unit":"/3","category":"accuracy"},
      {"type":"dig_percentage","label":"Dig %","unit":"%","category":"defense"},
      {"type":"serve_ace_rate","label":"Ace Rate","unit":"%","category":"power"},
      {"type":"serve_receive_error_rate","label":"Reception Errors","unit":"","category":"accuracy"}
    ]
  }',
  '{
    "Setter":{"category":"skill","title":"Improve setting accuracy to outside","target":"85%+","rationale":"Consistent location setting allows hitters to develop rhythm and timing"},
    "Outside Hitter":{"category":"skill","title":"Increase attack efficiency","target":".250+","rationale":"Attack efficiency measures true offensive contribution and separates average from elite hitters"},
    "Opposite Hitter":{"category":"skill","title":"Improve kill percentage from back row","target":"40%+","rationale":"Back-row attack is the defining skill that separates opposite hitters at higher levels"},
    "Middle Blocker":{"category":"skill","title":"Increase solo and assisted blocks per set","target":"1.0+ per set","rationale":"Blocking presence changes opposing setter decisions and creates defensive momentum"},
    "Libero":{"category":"skill","title":"Maintain passing rating above 2.2","target":"2.2/3.0","rationale":"A 2.2+ passing average gives setters the platform to run any offensive system"},
    "Defensive Specialist":{"category":"skill","title":"Reduce serve reception errors","target":"Less than 2 per match","rationale":"Clean reception in rotation is the primary job; errors directly cost points"}
  }',
  '{"inSeason":[{"label":"Team Practice","color":"default"},{"label":"Serve & Pass","color":"orange"},{"label":"Match Day","color":"blue"},{"label":"Scrimmage","color":"blue"},{"label":"Film Session","color":"purple"},{"label":"Scouting Prep","color":"purple"}],"offSeason":[{"label":"Weight Room","color":"purple"},{"label":"Conditioning","color":"green"},{"label":"Speed & Agility","color":"green"},{"label":"Skills Session","color":"orange"},{"label":"Open Gym","color":"default"},{"label":"Film Session","color":"purple"}]}',
  '{"pitchCountPositions":[],"pitchTypes":[],"hasHandTracking":false,"throwLabel":null,"throwLabelByPosition":{},"repsLabelByPosition":{"Setter":"Setting Reps","Outside Hitter":"Attack Reps","Opposite Hitter":"Attack Reps","Middle Blocker":"Block Reps","Libero":"Passing Reps","Defensive Specialist":"Passing Reps"}}'
WHERE NOT EXISTS (SELECT 1 FROM public.sports WHERE slug = 'volleyball');

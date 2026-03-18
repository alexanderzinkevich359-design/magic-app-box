-- Add service points to serving group and new passing chart (0-3) for volleyball

UPDATE public.sports
SET game_stat_groups = '{
  "attacking": [
    {"key":"kills",   "label":"K",    "full":"Kills",             "sortOrder":1},
    {"key":"att",     "label":"Att",  "full":"Attempts",          "sortOrder":2},
    {"key":"errors",  "label":"E",    "full":"Attack Errors",     "sortOrder":3}
  ],
  "serving": [
    {"key":"aces",    "label":"Ace",  "full":"Service Aces",      "sortOrder":1},
    {"key":"svc_e",   "label":"SE",   "full":"Service Errors",    "sortOrder":2},
    {"key":"svc_pts", "label":"SP",   "full":"Service Points",    "sortOrder":3}
  ],
  "passing": [
    {"key":"pass_3",  "label":"3",    "full":"Perfect Pass (3)",  "sortOrder":1},
    {"key":"pass_2",  "label":"2",    "full":"Good Pass (2)",     "sortOrder":2},
    {"key":"pass_1",  "label":"1",    "full":"Poor Pass (1)",     "sortOrder":3},
    {"key":"pass_0",  "label":"0",    "full":"Overpass / Error (0)", "sortOrder":4}
  ],
  "defense": [
    {"key":"digs",    "label":"Dig",  "full":"Digs",              "sortOrder":1},
    {"key":"blocks",  "label":"Blk",  "full":"Block Solos+Assists","sortOrder":2},
    {"key":"ast",     "label":"Ast",  "full":"Assists",           "sortOrder":3}
  ],
  "derived": [
    {"key":"hit_pct",  "label":"Hit%",     "formula":"(kills-errors)/att",                              "precision":3},
    {"key":"pass_avg", "label":"Pass Avg", "formula":"(pass_3*3+pass_2*2+pass_1)/(pass_3+pass_2+pass_1+pass_0)", "precision":2}
  ]
}'::jsonb
WHERE slug = 'volleyball';

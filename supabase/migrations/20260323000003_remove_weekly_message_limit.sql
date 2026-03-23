-- Remove the 1-per-week limit on parent messages so a full conversation is possible
ALTER TABLE public.parent_support_questions
  DROP CONSTRAINT IF EXISTS parent_support_questions_parent_user_id_week_start_key;

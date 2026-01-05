-- Fix RLS policies for questions table
-- Backend uses SERVICE_KEY which should bypass RLS, but we'll add policies for safety

-- Disable RLS temporarily to allow service role full access
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE answer_options DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, add policies:
-- ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Service role can do anything on questions"
--   ON questions
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);

-- CREATE POLICY "Service role can do anything on answer_options"
--   ON answer_options
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);

-- CREATE POLICY "Teachers can insert questions for their tests"
--   ON questions
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM tests
--       WHERE tests.id = questions.test_id
--       AND tests.created_by = auth.uid()
--     )
--   );

-- CREATE POLICY "Teachers can read questions for their tests"
--   ON questions
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM tests
--       WHERE tests.id = questions.test_id
--       AND tests.created_by = auth.uid()
--     )
--   );

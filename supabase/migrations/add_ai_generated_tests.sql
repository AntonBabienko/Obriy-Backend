-- Додаємо поля для AI-генерованих тестів
ALTER TABLE public.tests 
ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN generation_topics TEXT[], -- масив тем для генерації
ADD COLUMN questions_per_student INTEGER DEFAULT 10,
ADD COLUMN generation_prompt TEXT; -- додатковий промпт від викладача

-- Таблиця для збереження згенерованих варіантів тестів для студентів
CREATE TABLE public.student_test_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  questions_data JSONB NOT NULL, -- зберігаємо згенеровані питання
  UNIQUE(test_id, student_id)
);

-- Індекс для швидкого пошуку варіантів
CREATE INDEX idx_student_test_variants_test ON public.student_test_variants(test_id);
CREATE INDEX idx_student_test_variants_student ON public.student_test_variants(student_id);

-- RLS політики
ALTER TABLE public.student_test_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own test variants" ON public.student_test_variants
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view test variants for their tests" ON public.student_test_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tests
      WHERE tests.id = student_test_variants.test_id
      AND tests.created_by = auth.uid()
    )
  );

-- Функція для автоматичного видалення старих варіантів при видаленні тесту
CREATE OR REPLACE FUNCTION cleanup_test_variants()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.student_test_variants WHERE test_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_test_variants
BEFORE DELETE ON public.tests
FOR EACH ROW
EXECUTE FUNCTION cleanup_test_variants();

COMMENT ON TABLE public.student_test_variants IS 'Зберігає унікальні варіанти AI-генерованих тестів для кожного студента';
COMMENT ON COLUMN public.tests.is_ai_generated IS 'Чи є тест AI-генерованим (унікальний для кожного студента)';
COMMENT ON COLUMN public.tests.generation_topics IS 'Теми для генерації питань AI';
COMMENT ON COLUMN public.tests.questions_per_student IS 'Кількість питань для кожного студента';

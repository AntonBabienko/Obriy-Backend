-- Таблиця для запису студентів на курси
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    UNIQUE(course_id, student_id)
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON course_enrollments(status);

-- RLS (Row Level Security)
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Студенти можуть бачити тільки свої записи
CREATE POLICY "Students can view their own enrollments"
    ON course_enrollments FOR SELECT
    USING (auth.uid() = student_id);

-- Викладачі можуть бачити записи на свої курси
CREATE POLICY "Teachers can view enrollments for their courses"
    ON course_enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Викладачі можуть додавати студентів на свої курси
CREATE POLICY "Teachers can enroll students in their courses"
    ON course_enrollments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Викладачі можуть видаляти студентів зі своїх курсів
CREATE POLICY "Teachers can remove students from their courses"
    ON course_enrollments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Студенти можуть оновлювати свій прогрес
CREATE POLICY "Students can update their own progress"
    ON course_enrollments FOR UPDATE
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Коментар
COMMENT ON TABLE course_enrollments IS 'Записи студентів на курси';
COMMENT ON COLUMN course_enrollments.status IS 'Статус: active (активний), completed (завершений), dropped (відрахований)';
COMMENT ON COLUMN course_enrollments.progress IS 'Прогрес проходження курсу (0-100%)';

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  user_name TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lectures table
CREATE TABLE public.lectures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  embeddings_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lecture embeddings for RAG
CREATE TABLE public.lecture_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  content_chunk TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcards (карточки пам'яті)
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tests table
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES public.lectures(id),
  title TEXT NOT NULL,
  description TEXT,
  duration INTEGER, -- minutes
  deadline TIMESTAMP WITH TIME ZONE,
  max_attempts INTEGER DEFAULT 1,
  test_type TEXT NOT NULL CHECK (test_type IN ('official', 'self_quiz')),
  group_id UUID REFERENCES public.groups(id),
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false')),
  points INTEGER DEFAULT 1,
  explanation TEXT,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Answer options
CREATE TABLE public.answer_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER
);

-- Test submissions
CREATE TABLE public.test_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  score INTEGER DEFAULT 0,
  max_score INTEGER,
  percentage DECIMAL(5,2),
  attempt_number INTEGER DEFAULT 1,
  time_spent INTEGER, -- seconds
  UNIQUE(test_id, student_id, attempt_number)
);

-- Student answers
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES public.test_submissions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.answer_options(id),
  is_correct BOOLEAN DEFAULT FALSE
);

-- Student progress
CREATE TABLE public.student_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, lecture_id)
);

-- Chat history with AI
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) NOT NULL,
  lecture_id UUID REFERENCES public.lectures(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Groups: Teachers can manage their groups
CREATE POLICY "Teachers can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can view their groups" ON public.groups
  FOR SELECT USING (auth.uid() = teacher_id);

-- Courses: Teachers can manage their courses, students can view
CREATE POLICY "Teachers can manage their courses" ON public.courses
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view courses" ON public.courses
  FOR SELECT USING (true);

-- Lectures: Teachers can manage, students can view
CREATE POLICY "Teachers can manage lectures" ON public.lectures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.courses 
      WHERE courses.id = lectures.course_id 
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view lectures" ON public.lectures
  FOR SELECT USING (true);

-- Tests: Teachers create, students can view assigned tests
CREATE POLICY "Teachers can manage tests" ON public.tests
  FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Students can view their tests" ON public.tests
  FOR SELECT USING (
    test_type = 'self_quiz' OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tests.group_id
      AND group_members.student_id = auth.uid()
    )
  );

-- Test submissions: Students can manage their own
CREATE POLICY "Students can manage their submissions" ON public.test_submissions
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view submissions" ON public.test_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tests
      WHERE tests.id = test_submissions.test_id
      AND tests.created_by = auth.uid()
    )
  );

-- Chat messages: Students can manage their own
CREATE POLICY "Students can manage their chat" ON public.chat_messages
  FOR ALL USING (auth.uid() = student_id);

-- Create indexes for performance
CREATE INDEX idx_lectures_course ON public.lectures(course_id);
CREATE INDEX idx_tests_course ON public.tests(course_id);
CREATE INDEX idx_tests_group ON public.tests(group_id);
CREATE INDEX idx_submissions_test ON public.test_submissions(test_id);
CREATE INDEX idx_submissions_student ON public.test_submissions(student_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_student ON public.group_members(student_id);
CREATE INDEX idx_chat_messages_lecture ON public.chat_messages(lecture_id);
CREATE INDEX idx_student_progress_student ON public.student_progress(student_id);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_lecture_chunks(
  query_embedding vector(1536),
  p_lecture_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  lecture_id uuid,
  content_chunk text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lecture_embeddings.id,
    lecture_embeddings.lecture_id,
    lecture_embeddings.content_chunk,
    1 - (lecture_embeddings.embedding <=> query_embedding) as similarity
  FROM lecture_embeddings
  WHERE lecture_embeddings.lecture_id = p_lecture_id
    AND 1 - (lecture_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY lecture_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

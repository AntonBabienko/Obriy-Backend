-- Додати статус обробки лекцій для асинхронної обробки
-- Це дозволить відстежувати прогрес обробки PDF файлів

-- Додати колонки для статусу обробки
ALTER TABLE public.lectures 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;

-- Додати коментарі
COMMENT ON COLUMN public.lectures.processing_status IS 'Статус обробки: pending, processing, completed, failed';
COMMENT ON COLUMN public.lectures.processing_error IS 'Повідомлення про помилку якщо обробка не вдалася';
COMMENT ON COLUMN public.lectures.chunks_count IS 'Кількість чанків створених для embeddings';

-- Індекс для швидкого пошуку лекцій в обробці
CREATE INDEX IF NOT EXISTS idx_lectures_processing_status 
ON public.lectures(processing_status);

-- Оновити існуючі записи
UPDATE public.lectures 
SET processing_status = 'completed'
WHERE processing_status IS NULL;

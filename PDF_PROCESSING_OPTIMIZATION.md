# План оптимізації обробки PDF

## Поточний стан

### ✅ Що працює:
- Завантаження PDF файлів (до 10MB)
- Витягування тексту з PDF
- Очищення null bytes та контрольних символів
- Збереження в базу даних

### ❌ Проблеми:

#### 1. **Якість витягнутого тексту**
**Проблема:** PDF 3.58 MB → 4.9 млн символів (занадто багато)
- Можливо витягуються приховані шари
- Дублювання тексту (хедери/футери на кожній сторінці)
- Зайві пробіли та форматування

**Рішення:**
- [x] Додати етап "Cleaning" після витягування ✅
- [x] Видаляти повторювані пробіли (`\s+` → ` `) ✅
- [x] Видаляти хедери/футери сторінок ✅
- [x] Нормалізувати переноси рядків ✅

**Статус:** ✅ ВПРОВАДЖЕНО - `backend/src/services/textCleaner.ts`

#### 2. **Embeddings вимкнені**
**Проблема:** 4.9 млн символів ≈ 1.5 млн токенів
- OpenAI `text-embedding-3-small` приймає max 8192 токени
- Неможливо векторизувати весь текст одразу

**Рішення (CRITICAL):**
- [x] Впровадити **Chunking** (розбиття на шматки) ✅
  - Розмір чанку: 3000 символів (~750 токенів) ✅
  - Overlap: 500 символів (для контексту) ✅
  - Зберігати метадані: індекс чанку, позиція в документі ✅

**Статус:** ✅ ВПРОВАДЖЕНО - `backend/src/services/textChunker.ts`

#### 3. **Синхронна обробка блокує сервер**
**Проблема:** 
- Обробка PDF займає 3-4 секунди
- Користувач чекає
- Сервер заблокований на час обробки

**Рішення (CRITICAL):**
- [ ] Асинхронна обробка через чергу
  1. Клієнт завантажує файл
  2. Сервер одразу відповідає: "Файл прийнято в обробку"
  3. Задача падає в чергу (Redis або просто in-memory)
  4. Worker обробляє файл у фоні
  5. Оновлює статус у базі коли готово

#### 4. **Споживання пам'яті**
**Проблема:** 
- PDF 3.58 MB → +56 MB heap (16x розмір файлу)
- При багатьох одночасних завантаженнях може бути OOM

**Рішення:**
- [ ] Обробка у Worker Thread (Node.js Worker Threads)
- [ ] Streaming обробка замість завантаження всього файлу в пам'ять
- [ ] Обмеження кількості одночасних обробок

---

## Архітектура рішення

### Фаза 1: Покращення якості тексту (Quick Win)

```typescript
// backend/src/services/textCleaner.ts
export function cleanExtractedText(text: string): string {
  let cleaned = text;
  
  // 1. Видалити null bytes та контрольні символи (вже є)
  cleaned = cleaned.replace(/\u0000/g, '');
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // 2. Нормалізувати пробіли
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Множинні пробіли → один
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Множинні переноси → подвійний
  
  // 3. Видалити типові хедери/футери (евристика)
  // Якщо рядок повторюється на багатьох сторінках - це хедер/футер
  
  // 4. Trim кожного рядка
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
  
  return cleaned.trim();
}
```

**Очікуваний результат:** 4.9 млн → ~2-3 млн символів

---

### Фаза 2: Chunking для Embeddings (Critical)

```typescript
// backend/src/services/textChunker.ts
interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  tokens: number; // приблизно
}

export function chunkText(text: string, options = {
  chunkSize: 3000,    // символів (~750 токенів)
  overlap: 500,       // символів overlap
}): TextChunk[] {
  const chunks: TextChunk[] = [];
  let startChar = 0;
  let index = 0;
  
  while (startChar < text.length) {
    const endChar = Math.min(startChar + options.chunkSize, text.length);
    const chunkText = text.slice(startChar, endChar);
    
    chunks.push({
      text: chunkText,
      index,
      startChar,
      endChar,
      tokens: Math.ceil(chunkText.length / 4), // приблизно
    });
    
    startChar += options.chunkSize - options.overlap;
    index++;
  }
  
  return chunks;
}
```

**Приклад:** 3 млн символів → ~1000 чанків по 3000 символів

---

### Фаза 3: Асинхронна обробка (Critical)

```typescript
// backend/src/services/lectureQueue.ts
import { EventEmitter } from 'events';

interface LectureJob {
  lectureId: string;
  filePath: string;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

class LectureQueue extends EventEmitter {
  private queue: LectureJob[] = [];
  private processing = false;
  
  async addJob(job: LectureJob) {
    this.queue.push(job);
    this.processNext();
  }
  
  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const job = this.queue.shift()!;
    
    try {
      await this.processLecture(job);
    } catch (error) {
      console.error('[Queue] Job failed:', error);
      job.status = 'failed';
    } finally {
      this.processing = false;
      this.processNext();
    }
  }
  
  private async processLecture(job: LectureJob) {
    // 1. Витягнути текст
    // 2. Очистити текст
    // 3. Розбити на чанки
    // 4. Згенерувати embeddings
    // 5. Оновити статус у БД
  }
}

export const lectureQueue = new LectureQueue();
```

**Зміни в API:**
```typescript
// backend/src/routes/lecture.routes.ts
router.post('/', async (req, res) => {
  // ... upload file ...
  
  // Створити запис у БД зі статусом "processing"
  const lecture = await supabase.from('lectures').insert({
    ...data,
    processing_status: 'pending'
  });
  
  // Додати в чергу
  lectureQueue.addJob({
    lectureId: lecture.id,
    filePath: file.path,
    mimeType: file.mimetype,
    status: 'pending'
  });
  
  // Одразу повернути відповідь
  res.status(202).json({ 
    message: 'Файл прийнято в обробку',
    lectureId: lecture.id,
    status: 'processing'
  });
});
```

---

## Міграція БД

```sql
-- Додати статус обробки
ALTER TABLE public.lectures 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;

-- Індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_lectures_processing_status 
ON public.lectures(processing_status);
```

---

## Пріоритети

### ✅ Виконано:
1. **Text Cleaning** - покращує якість тексту (зменшення на 40-50%)
2. **Chunking** - дозволяє embeddings працювати
3. **Database Migration** - додано колонки для статусу обробки

### 🔴 Критично (наступний крок):
1. **Застосувати міграцію БД** - додати колонки processing_status, chunks_count
2. **Протестувати на великих файлах** - перевірити покращення

### 🟡 Важливо (майбутнє):
3. **Асинхронна обробка** - покращить UX
4. **Worker Threads** - зменшить навантаження

### 🟢 Опціонально:
5. Streaming обробка
6. Redis для черги (замість in-memory)
7. Progress tracking для користувача

---

## Наступні кроки

1. Впровадити Text Cleaning (швидко, покращить якість)
2. Впровадити Chunking (критично для embeddings)
3. Впровадити асинхронну обробку (покращить UX)
4. Увімкнути embeddings generation
5. Протестувати на великих файлах

---

## Метрики для моніторингу

- Розмір витягнутого тексту (до/після cleaning)
- Кількість чанків на файл
- Час обробки (parsing, cleaning, chunking, embeddings)
- Споживання пам'яті
- Кількість помилок


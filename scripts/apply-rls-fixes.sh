#!/bin/bash

# Скрипт для застосування виправлень RLS політик
# Використовуйте цей скрипт для оновлення політик безпеки в Supabase

echo "🔧 Застосування виправлень RLS політик..."

# Перевірка наявності змінних оточення
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Помилка: SUPABASE_URL та SUPABASE_SERVICE_KEY повинні бути встановлені"
    echo "Додайте їх у файл .env"
    exit 1
fi

# Функція для виконання SQL файлу
apply_migration() {
    local file=$1
    echo "📝 Застосування: $file"
    
    # Читаємо SQL файл та виконуємо через Supabase REST API
    SQL_CONTENT=$(cat "$file")
    
    curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $(jq -Rs . <<< "$SQL_CONTENT")}"
    
    if [ $? -eq 0 ]; then
        echo "✅ Успішно застосовано: $file"
    else
        echo "❌ Помилка при застосуванні: $file"
        return 1
    fi
}

# Застосовуємо міграції в правильному порядку
echo ""
echo "1️⃣ Виправлення RLS для profiles..."
apply_migration "backend/supabase/migrations/fix_profiles_rls.sql"

echo ""
echo "2️⃣ Виправлення RLS для courses..."
apply_migration "backend/supabase/migrations/fix_courses_rls.sql"

echo ""
echo "3️⃣ Виправлення RLS для course_enrollments..."
apply_migration "backend/supabase/migrations/fix_course_enrollments_rls.sql"

echo ""
echo "✨ Всі міграції застосовано!"
echo ""
echo "Тепер ви можете:"
echo "  - Записувати студентів на курси"
echo "  - Створювати та оновлювати курси"
echo "  - Управляти профілями користувачів"
echo ""
echo "Service role має повний доступ до всіх операцій."

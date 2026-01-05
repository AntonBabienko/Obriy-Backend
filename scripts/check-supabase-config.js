#!/usr/bin/env node

// Скрипт для перевірки конфігурації Supabase
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Завантажуємо змінні оточення
dotenv.config();

console.log('🔍 Перевірка конфігурації Supabase...\n');

// Перевіряємо змінні оточення
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('📋 Змінні оточення:');
console.log(`SUPABASE_URL: ${supabaseUrl ? '✅ Встановлено' : '❌ Відсутня'}`);
console.log(`SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? '✅ Встановлено' : '❌ Відсутня'}`);
console.log(`SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Встановлено' : '❌ Відсутня'}`);

if (!supabaseUrl || !supabaseServiceKey) {
    console.log('\n❌ Критичні змінні відсутні!');
    console.log('Додайте їх у файл .env:');
    console.log('SUPABASE_URL=https://your-project.supabase.co');
    console.log('SUPABASE_SERVICE_KEY=your-service-key');
    process.exit(1);
}

// Перевіряємо формат URL
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    console.log('\n⚠️  SUPABASE_URL має неправильний формат');
    console.log('Правильний формат: https://your-project.supabase.co');
}

// Перевіряємо довжину ключів
console.log('\n🔑 Аналіз ключів:');
console.log(`Service Key довжина: ${supabaseServiceKey.length} символів`);
if (supabaseAnonKey) {
    console.log(`Anon Key довжина: ${supabaseAnonKey.length} символів`);
}

// Створюємо клієнт та тестуємо підключення
console.log('\n🔌 Тестування підключення...');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function testConnection() {
    try {
        // Тестуємо простий запит
        const { data, error } = await supabase
            .from('profiles')
            .select('count')
            .limit(1);

        if (error) {
            console.log(`❌ Помилка підключення: ${error.message}`);

            if (error.message.includes('JWT')) {
                console.log('💡 Можливо, використовується неправильний ключ');
                console.log('   Переконайтеся, що використовуєте SERVICE_KEY, а не ANON_KEY');
            }

            if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.log('💡 Таблиця profiles не існує');
                console.log('   Виконайте міграції для створення таблиць');
            }
        } else {
            console.log('✅ Підключення успішне!');
            console.log('✅ Service key працює правильно');
        }
    } catch (err) {
        console.log(`❌ Помилка мережі: ${err.message}`);
    }
}

// Перевіряємо RLS статус
async function checkRLS() {
    try {
        console.log('\n🛡️  Перевірка RLS статусу...');

        const { data, error } = await supabase.rpc('exec_sql', {
            query: `
                SELECT tablename, rowsecurity 
                FROM pg_tables 
                WHERE tablename IN ('profiles', 'courses', 'course_enrollments')
                ORDER BY tablename;
            `
        });

        if (error) {
            console.log('⚠️  Не вдалося перевірити RLS статус');
            console.log('   Можливо, функція exec_sql недоступна');
        } else if (data) {
            console.log('RLS статус:');
            data.forEach(table => {
                const status = table.rowsecurity ? '🔐 Увімкнено' : '🔓 Відключено';
                console.log(`  ${table.tablename}: ${status}`);
            });
        }
    } catch (err) {
        console.log('⚠️  Помилка при перевірці RLS');
    }
}

// Виконуємо тести
testConnection().then(() => {
    checkRLS().then(() => {
        console.log('\n📝 Рекомендації:');
        console.log('1. Якщо підключення неуспішне - перевірте ключі');
        console.log('2. Якщо RLS увімкнено - виконайте RLS міграції');
        console.log('3. Для розробки можна відключити RLS');
        console.log('\n🚀 Готово!');
    });
});
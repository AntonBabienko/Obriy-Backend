import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Створюємо клієнт з service key для обходу RLS
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    // Важливо: service key автоматично обходить RLS
    // але тільки якщо політики правильно налаштовані
});

// Експортуємо також як admin клієнт
export const supabaseAdmin = supabase;

// Функція для перевірки, чи використовується service key
export const isServiceRole = () => {
    return supabaseServiceKey && supabaseServiceKey.length > 100; // Service key довший за anon key
};

// Логування для діагностики
if (process.env.NODE_ENV !== 'production') {
    console.log('[Supabase Config]');
    console.log('URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
    console.log('Key Length:', supabaseServiceKey?.length || 0);
    console.log('Is Service Role:', isServiceRole() ? '✅ Yes' : '❌ No');
}

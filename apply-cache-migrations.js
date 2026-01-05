const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const migrations = [
    'add_ai_response_cache.sql',
    'add_lecture_content_hashes.sql',
    'add_ai_cache_stats.sql'
];

async function runMigration(filename) {
    try {
        console.log(`\n📄 Running migration: ${filename}`);
        console.log('─'.repeat(60));

        const sqlPath = path.join(__dirname, 'supabase', 'migrations', filename);

        if (!fs.existsSync(sqlPath)) {
            console.error(`❌ Migration file not found: ${sqlPath}`);
            return false;
        }

        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('\n⚠️  This migration needs to be run manually in Supabase SQL Editor');
        console.log('📋 Copy the SQL below and paste it into your Supabase SQL Editor:\n');
        console.log('─'.repeat(60));
        console.log(sql);
        console.log('─'.repeat(60));

        return true;
    } catch (error) {
        console.error(`❌ Error reading migration:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 AI Response Cache Migration Instructions');
    console.log('═'.repeat(60));
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log('═'.repeat(60));
    console.log('\n⚠️  IMPORTANT: These migrations must be run manually in Supabase SQL Editor');
    console.log('\n📝 Steps:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste each migration SQL below');
    console.log('4. Run each migration one by one');
    console.log('\n═'.repeat(60));

    for (const migration of migrations) {
        await runMigration(migration);
    }

    console.log('\n═'.repeat(60));
    console.log('✅ All migration SQL has been displayed above');
    console.log('📌 Please run them manually in Supabase SQL Editor');
    console.log('═'.repeat(60));
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

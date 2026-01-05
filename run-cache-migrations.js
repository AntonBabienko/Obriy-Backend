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

const supabase = createClient(supabaseUrl, supabaseKey);

const migrations = [
    'add_ai_response_cache.sql',
    'add_lecture_content_hashes.sql',
    'add_ai_cache_stats.sql'
];

async function executeSql(sql) {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    return { data, error };
}

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

        // Split by semicolons but keep them for execution
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < commands.length; i++) {
            const command = commands[i] + ';';

            // Skip comments
            if (command.trim().startsWith('--')) continue;

            const preview = command.substring(0, 80).replace(/\n/g, ' ');
            console.log(`\n[${i + 1}/${commands.length}] ${preview}...`);

            const { data, error } = await executeSql(command);

            if (error) {
                console.error(`❌ Error:`, error.message);
                errorCount++;

                // Continue with other commands unless it's a critical error
                if (error.message.includes('already exists')) {
                    console.log('⚠️  Object already exists, continuing...');
                } else if (error.message.includes('does not exist')) {
                    console.log('⚠️  Dependency missing, this might cause issues');
                }
            } else {
                console.log('✅ Success');
                successCount++;
            }
        }

        console.log('\n' + '─'.repeat(60));
        console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`);

        return errorCount === 0;
    } catch (error) {
        console.error(`❌ Migration failed:`, error.message);
        return false;
    }
}

async function verifyTables() {
    console.log('\n🔍 Verifying tables...');
    console.log('─'.repeat(60));

    const tables = [
        'ai_response_cache',
        'lecture_content_hashes',
        'ai_cache_stats'
    ];

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(0);

        if (error) {
            console.log(`❌ ${table}: NOT FOUND`);
            console.error(`   Error: ${error.message}`);
        } else {
            console.log(`✅ ${table}: EXISTS`);
        }
    }
}

async function main() {
    console.log('🚀 AI Response Cache Migration Runner');
    console.log('═'.repeat(60));
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    console.log('═'.repeat(60));

    let allSuccess = true;

    for (const migration of migrations) {
        const success = await runMigration(migration);
        if (!success) {
            allSuccess = false;
        }
    }

    console.log('\n' + '═'.repeat(60));

    if (allSuccess) {
        console.log('✅ All migrations completed successfully!');
    } else {
        console.log('⚠️  Some migrations had errors. Check the output above.');
    }

    await verifyTables();

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Migration process complete!');
    console.log('═'.repeat(60));
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('Please check SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    try {
        console.log('📄 Reading migration: add_lecture_content_hashes.sql');

        const migrationPath = path.join(__dirname, 'supabase', 'migrations', 'add_lecture_content_hashes.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔄 Applying migration...');

        // Split SQL by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`);

                const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

                if (error) {
                    console.error('❌ Error executing statement:', error);
                    // Don't throw on table already exists errors
                    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
                        console.log('⚠️  Already exists, continuing...');
                        continue;
                    } else {
                        throw error;
                    }
                } else {
                    console.log('✅ Success');
                }
            }
        }

        console.log('✅ Migration applied successfully!');

        // Test if table exists
        console.log('🔍 Testing table access...');
        const { data, error } = await supabase
            .from('lecture_content_hashes')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Table test failed:', error);
        } else {
            console.log('✅ Table is accessible!');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyMigration();
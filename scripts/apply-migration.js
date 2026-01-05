const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    console.error('Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFile) {
    try {
        console.log(`📄 Reading migration: ${migrationFile}`);

        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('🔄 Applying migration...');

        // Split SQL by semicolons and execute each statement
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                console.log(`Executing: ${statement.substring(0, 50)}...`);
                const { error } = await supabase.rpc('exec_sql', { sql: statement });

                if (error) {
                    console.error('❌ Error executing statement:', error);
                    throw error;
                }
            }
        }

        console.log('✅ Migration applied successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Apply the lecture_content_hashes migration
applyMigration('add_lecture_content_hashes.sql');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('Running migration: add_lecture_metadata.sql');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', 'add_lecture_metadata.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('SQL:', sql);

        // Execute SQL commands one by one
        const commands = sql.split(';').filter(cmd => cmd.trim());

        for (const command of commands) {
            if (command.trim()) {
                console.log('\nExecuting:', command.trim().substring(0, 100) + '...');
                const { data, error } = await supabase.rpc('exec_sql', { sql: command.trim() + ';' });

                if (error) {
                    console.error('Error:', error);
                } else {
                    console.log('Success!');
                }
            }
        }

        console.log('\nMigration completed!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();

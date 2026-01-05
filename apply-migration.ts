import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    try {
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', 'add_lecture_metadata.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('Applying migration: add_lecture_metadata.sql');
        console.log('SQL:', sql);

        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }

        console.log('Migration applied successfully!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

applyMigration();

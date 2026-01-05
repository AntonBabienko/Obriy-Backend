const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
    try {
        console.log('🔄 Creating lecture_content_hashes table...');

        // First, let's check if the table already exists
        const { data: existingTables, error: checkError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'lecture_content_hashes');

        if (checkError) {
            console.log('Could not check existing tables, proceeding with creation...');
        } else if (existingTables && existingTables.length > 0) {
            console.log('✅ Table lecture_content_hashes already exists!');
            return;
        }

        // Create the table using a simple approach
        console.log('Creating table...');

        // We'll use the SQL editor approach by creating a simple table first
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS public.lecture_content_hashes (
                lecture_id UUID PRIMARY KEY REFERENCES public.lectures(id) ON DELETE CASCADE,
                content_hash VARCHAR(64) NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;

        // Try to create via direct query (this might not work, but let's try)
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey
                },
                body: JSON.stringify({ sql: createTableSQL })
            });

            if (response.ok) {
                console.log('✅ Table created successfully via direct SQL!');
            } else {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
        } catch (directError) {
            console.log('Direct SQL failed, trying alternative approach...');

            // Alternative: Try to insert a test record to see if table exists
            const { error: testError } = await supabase
                .from('lecture_content_hashes')
                .select('*')
                .limit(1);

            if (testError) {
                console.error('❌ Table does not exist and could not be created automatically.');
                console.log('📝 Please create the table manually in Supabase SQL Editor:');
                console.log(createTableSQL);
                console.log('\nThen add the index:');
                console.log('CREATE INDEX IF NOT EXISTS idx_lecture_content_hash ON public.lecture_content_hashes(content_hash);');
                console.log('\nAnd enable RLS:');
                console.log('ALTER TABLE public.lecture_content_hashes ENABLE ROW LEVEL SECURITY;');
            } else {
                console.log('✅ Table exists and is accessible!');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);

        console.log('\n📝 Manual SQL to run in Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS public.lecture_content_hashes (
    lecture_id UUID PRIMARY KEY REFERENCES public.lectures(id) ON DELETE CASCADE,
    content_hash VARCHAR(64) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecture_content_hash ON public.lecture_content_hashes(content_hash);

ALTER TABLE public.lecture_content_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage lecture hashes" ON public.lecture_content_hashes
FOR ALL USING (auth.role() = 'service_role');
        `);
    }
}

createTable();
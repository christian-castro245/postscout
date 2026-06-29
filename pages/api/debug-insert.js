import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const results = {};

  // Test 1: Service Role Insert
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: d1, error: e1 } = await admin
    .from('dokumente')
    .insert({
      user_id: '04281a77-ea3b-4407-9e16-6596db3df763',
      dateiname: 'debug_test.jpg',
      bild_url: 'https://via.placeholder.com/100',
      bild_urls: ['https://via.placeholder.com/100'],
      analysiert: false,
      dringlichkeit: 'Zur Kenntnis',
    })
    .select('id')
    .single();

  results.serviceRoleInsert = {
    id: d1?.id,
    error: e1 ? { msg: e1.message, code: e1.code, details: e1.details, hint: e1.hint } : null,
  };

  // Test 2: Check env vars
  results.envVars = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
  };

  // Test 3: Storage bucket check
  const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
  results.storageBuckets = buckets?.map(b => ({ id: b.id, public: b.public })) || bucketErr?.message;

  // Test 4: Can we select from dokumente?
  const { data: rows, error: selErr } = await admin
    .from('dokumente')
    .select('id, dateiname')
    .limit(3);
  results.selectTest = { rows, error: selErr?.message };

  console.log('DEBUG RESULT:', JSON.stringify(results));
  res.json(results);
}

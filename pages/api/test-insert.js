import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Service role bypasses RLS
);

export default async function handler(req, res) {
  // Test 1: Direkt mit service role
  const { data: dok, error: insertErr } = await supabase
    .from('dokumente')
    .insert({
      user_id: '04281a77-ea3b-4407-9e16-6596db3df763',
      dateiname: 'api_test.jpg',
      bild_url: 'https://example.com/test.jpg',
      bild_urls: ['https://example.com/test.jpg'],
      analysiert: false,
      dringlichkeit: 'Zur Kenntnis',
    })
    .select('id')
    .single();

  res.json({
    success: !insertErr,
    id: dok?.id,
    error: insertErr?.message,
    errorCode: insertErr?.code,
    errorDetails: insertErr?.details,
    errorHint: insertErr?.hint,
  });
}

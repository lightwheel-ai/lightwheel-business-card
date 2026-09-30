import { createClient } from '@supabase/supabase-js';

// Publishable browser key: access is enforced by database grants and RLS.
// Never put a service-role key or SMTP credential in this client.
export const supabase = createClient(
  'https://scspbaukujbzjwfsiagg.supabase.co',
  'sb_publishable_avX8r5HO3Jji66ycGPiAOQ_OuDA_KDz',
  { auth: { flowType: 'pkce', detectSessionInUrl: false } },
);

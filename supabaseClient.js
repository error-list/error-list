import { initSupabase } from './api.js';

// TODO: paste your Project URL here (Settings → API → Data API)
// It looks like: https://xxxxxxxxxxxx.supabase.co
const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL_HERE';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZKPFfYPeYw3J4WW6mHZQ3A_1weL-bi4';

initSupabase(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Now import from api.js anywhere else in your app — it's already connected.
// e.g.  import { getDemonList, signIn, submitRecord } from './api.js';

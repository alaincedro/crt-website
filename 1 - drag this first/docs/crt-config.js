/* CRT site + admin dashboard settings.
   Paste the two values from Supabase → Project Settings → API.
   The "anon public" key is safe to publish: the database rules only let
   the website ADD enquiries and READ prices. Never paste the service_role key here.
   While these are empty, the website works as before and the dashboard runs in demo mode. */
window.CRT_CONFIG = {
  // Supabase project "crt-website" (West EU, Ireland)
  SUPABASE_URL: 'https://xwymonxbaokdjhywqydu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3eW1vbnhiYW9rZGpoeXdxeWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwOTA5MDEsImV4cCI6MjEwOTY2NjkwMX0.dKuVjQSx8FcxjdIbF2DQAGsWT0ThhG_x1uOPAKgDxK4'
};

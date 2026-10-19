/**
 * Cloud sync & push server (Supabase project "parcel-pals"). The anon key is public by design: the database is locked
 * (RLS, no policies) and the only callable functions check the user's secret sync key. See supabase/README.md.
 */
export const SUPABASE_URL = 'https://wbevtynfofwyhwjzhwpz.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZXZ0eW5mb2Z3eWh3anpod3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0Mzg3OTgsImV4cCI6MjEwODAxNDc5OH0.J7pKCH60zrB-PnrJ0CAWDXxYk9tqG1HOtL1J_hx7Ah0';

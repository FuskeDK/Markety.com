import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wbazlgmvfiwhhvssefsp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXpsZ212Zml3aGh2c3NlZnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Njk0NDMsImV4cCI6MjA5NDQ0NTQ0M30.hNv_xSRkh-fTUfMBsBeBhhaYajayiFnLHwX5SFukH-w";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ContentApproval = {
  id: string;
  type: "linkedin_post" | "linkedin_dm" | "email";
  content: string;
  recipient: string | null;
  status: "pending" | "approved" | "rejected" | "posted";
  scheduled_for: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

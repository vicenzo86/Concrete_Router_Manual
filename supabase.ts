
import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://pyrrcfbgwpncljxyyozd.supabase.co';
const defaultSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnJjZmJnd3BuY2xqeHl5b3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDYxOTIsImV4cCI6MjA4MTIyMjE5Mn0._0Hxke_9Pu9TT8QkAIcvtWlSAV1BocCdGzowGb_cGug';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || defaultSupabaseUrl, import.meta.env.VITE_SUPABASE_ANON_KEY || defaultSupabaseAnonKey);

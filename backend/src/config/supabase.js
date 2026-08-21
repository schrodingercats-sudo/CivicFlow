import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://enrrsnbfushieufmqmuq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucnJzbmJmdXNoaWV1Zm1xbXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTEyODEsImV4cCI6MjEwMDM4NzI4MX0.HzPvX-FXkGia2Ij53_Jnw_2Nrpzm212qy1HDiWUPUYU';

export const supabase = createClient(supabaseUrl, supabaseKey);

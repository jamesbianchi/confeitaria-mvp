// ===== CONEXÃO COM O SUPABASE =====
// Este arquivo é importado por todos os outros módulos

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Substitua pelos seus dados reais do Supabase
const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'



export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
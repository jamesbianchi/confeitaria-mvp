// ===== CONEXÃO COM O SUPABASE =====
// Este arquivo é importado por todos os outros módulos

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Substitua pelos seus dados reais do Supabase
const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'

// Validação simples para melhorar mensagens de erro em runtime
if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) {
	console.error('Supabase: SUPABASE_URL inválida. Defina o endpoint correto, ex: https://<projeto>.supabase.co')
}
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 10) {
	console.error('Supabase: SUPABASE_ANON_KEY parece inválida. Cole a chave pública anon do painel do Supabase.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
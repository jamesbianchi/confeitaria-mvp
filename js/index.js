import { supabase } from './supabase.js'

// ===== UTILITÁRIOS =====

// Formata valor em reais: 150.5 → "R$ 150,50"
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

// Formata data: "2024-12-25" → "25/12/2024"
function formatarData(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

// Badge colorido de status
function badgeStatus(status) {
  const labels = {
    recebido:    'Recebido',
    confirmado:  'Confirmado',
    em_producao: 'Em produção',
    pronto:      'Pronto',
    entregue:    'Entregue',
    cancelado:   'Cancelado'
  }
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`
}

// ===== CARREGAR RESUMO DO PAINEL =====
async function carregarResumo() {
  const hoje = new Date().toISOString().split('T')[0]

  // Início e fim do mês atual
  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    .toISOString().split('T')[0]
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  // Pedidos com entrega hoje
  const { data: pedidosHoje } = await supabase
    .from('pedidos')
    .select('id')
    .eq('data_entrega', hoje)
    .neq('status', 'cancelado')

  // Entregas desta semana
  const fimSemana = new Date()
  fimSemana.setDate(fimSemana.getDate() + 7)
  const fimSemanaStr = fimSemana.toISOString().split('T')[0]

  const { data: entregasSemana } = await supabase
    .from('pedidos')
    .select('id')
    .gte('data_entrega', hoje)
    .lte('data_entrega', fimSemanaStr)
    .neq('status', 'cancelado')

  // Financeiro do mês
  const { data: pedidosMes } = await supabase
    .from('pedidos')
    .select('valor_total, sinal_pago, status_pagamento')
    .gte('data_entrega', inicioMes)
    .lte('data_entrega', fimMes)
    .neq('status', 'cancelado')

  const faturado = pedidosMes?.reduce((acc, p) => acc + Number(p.valor_total), 0) || 0
  const recebido = pedidosMes?.reduce((acc, p) => acc + Number(p.sinal_pago), 0) || 0
  const aReceber = faturado - recebido

  // Atualiza os cards
  document.getElementById('pedidos-hoje').textContent = pedidosHoje?.length || 0
  document.getElementById('entregas-semana').textContent = entregasSemana?.length || 0
  document.getElementById('a-receber').textContent = formatarMoeda(aReceber)
  document.getElementById('faturado-mes').textContent = formatarMoeda(faturado)
}

// ===== CARREGAR PRÓXIMAS ENTREGAS =====
async function carregarProximasEntregas() {
  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      data_entrega,
      status,
      status_pagamento,
      valor_total,
      clientes ( nome )
    `)
    .gte('data_entrega', hoje)
    .neq('status', 'cancelado')
    .order('data_entrega', { ascending: true })
    .limit(10)

  const tbody = document.getElementById('proximas-entregas')

  if (error || !data?.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma entrega próxima</td></tr>`
    return
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${p.clientes?.nome || '—'}</td>
      <td>${formatarData(p.data_entrega)}</td>
      <td>${formatarMoeda(p.valor_total)}</td>
      <td>${badgeStatus(p.status)}</td>
      <td>${p.status_pagamento === 'pago' ? '✅ Pago' :
           p.status_pagamento === 'sinal_recebido' ? '⚠️ Sinal' : '❌ Pendente'}</td>
    </tr>
  `).join('')
}

// ===== INICIALIZAR =====
carregarResumo()
carregarProximasEntregas()
import { supabase } from './supabase.js'

let anoAtual = new Date().getFullYear()
let mesAtual = new Date().getMonth() // 0-11
let pedidosMes   = []
let capacidades  = []

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function pad(n) { return String(n).padStart(2, '0') }

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast')
  toast.textContent = mensagem
  toast.className = `toast ${tipo} show`
  setTimeout(() => toast.className = 'toast', 3000)
}

function badgeStatus(status) {
  const labels = {
    recebido:    'Recebido',    confirmado:  'Confirmado',
    em_producao: 'Em produção', pronto:      'Pronto',
    entregue:    'Entregue',    cancelado:   'Cancelado'
  }
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`
}

// ===== CARREGAR DADOS DO MÊS =====

async function carregarMes() {
  const inicio = `${anoAtual}-${pad(mesAtual + 1)}-01`
  const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const fim    = `${anoAtual}-${pad(mesAtual + 1)}-${pad(ultimoDia)}`

  const [resPedidos, resCap] = await Promise.all([
    supabase
      .from('pedidos')
      .select(`
        id, data_entrega, status, valor_total, tipo_entrega,
        clientes ( nome ),
        itens_pedido ( id )
      `)
      .gte('data_entrega', inicio)
      .lte('data_entrega', fim)
      .neq('status', 'cancelado'),
    supabase
      .from('capacidade_dia')
      .select('data, limite_pedidos')
      .gte('data', inicio)
      .lte('data', fim)
  ])

  pedidosMes  = resPedidos.data  || []
  capacidades = resCap.data      || []

  renderizarCalendario()
}

// ===== RENDERIZAR CALENDÁRIO =====

function renderizarCalendario() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  document.getElementById('mes-titulo').textContent =
    `${meses[mesAtual]} ${anoAtual}`

  const hoje       = new Date()
  const hojeStr    = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`
  const primeiroDia= new Date(anoAtual, mesAtual, 1).getDay() // 0=Dom
  const totalDias  = new Date(anoAtual, mesAtual + 1, 0).getDate()

  const grid = document.getElementById('calendario-grid')
  grid.innerHTML = ''

  // Células vazias antes do primeiro dia
  for (let i = 0; i < primeiroDia; i++) {
    const vazio = document.createElement('div')
    vazio.className = 'dia-cell vazio'
    grid.appendChild(vazio)
  }

  // Células dos dias
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr = `${anoAtual}-${pad(mesAtual + 1)}-${pad(dia)}`
    const pedidosDia = pedidosMes.filter(p => p.data_entrega === dataStr)
    const cap = capacidades.find(c => c.data === dataStr)
    const limite = cap?.limite_pedidos ?? 3
    const total  = pedidosDia.length

    const cell = document.createElement('div')
    cell.className = 'dia-cell'
    if (dataStr === hojeStr)    cell.classList.add('hoje')
    if (total >= limite)        cell.classList.add('lotado')
    else if (total >= limite-1) cell.classList.add('cheio')

    // Mostra até 2 pedidos, o resto como "+N"
    const visiveis  = pedidosDia.slice(0, 2)
    const restantes = pedidosDia.length - visiveis.length

    cell.innerHTML = `
      <div class="dia-numero">${dia}</div>
      <div class="dia-pedidos">
        ${visiveis.map(p => `
          <div class="dia-tag ${p.status}">
            ${p.clientes?.nome?.split(' ')[0] || '—'}
          </div>
        `).join('')}
        ${restantes > 0 ? `<div class="dia-mais">+${restantes} pedido(s)</div>` : ''}
      </div>
    `

    cell.onclick = () => abrirDetalhe(dataStr, pedidosDia)
    grid.appendChild(cell)
  }
}

// ===== DETALHE DO DIA =====

function abrirDetalhe(dataStr, pedidos) {
  const [ano, mes, dia] = dataStr.split('-')
  document.getElementById('detalhe-titulo').textContent =
    `Pedidos para ${dia}/${mes}/${ano}`

  const tbody = document.getElementById('detalhe-lista')

  if (!pedidos.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
      Nenhum pedido neste dia
    </td></tr>`
  } else {
    tbody.innerHTML = pedidos.map(p => `
      <tr>
        <td><strong>${p.clientes?.nome || '—'}</strong></td>
        <td>${p.itens_pedido?.length || 0} item(s)</td>
        <td>${formatarMoeda(p.valor_total)}</td>
        <td>${badgeStatus(p.status)}</td>
        <td>${p.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retirada'}</td>
      </tr>
    `).join('')
  }

  document.getElementById('detalhe-dia').classList.add('open')
  document.getElementById('detalhe-dia').scrollIntoView({ behavior: 'smooth' })
}

function fecharDetalhe() {
  document.getElementById('detalhe-dia').classList.remove('open')
}

// ===== NAVEGAÇÃO DE MÊS =====

function mudarMes(direcao) {
  mesAtual += direcao
  if (mesAtual > 11) { mesAtual = 0;  anoAtual++ }
  if (mesAtual < 0)  { mesAtual = 11; anoAtual-- }
  fecharDetalhe()
  carregarMes()
}

// ===== CONFIGURAR CAPACIDADE =====

function abrirConfigurarCapacidade() {
  const hoje = new Date().toISOString().split('T')[0]
  document.getElementById('cap-data').value   = hoje
  document.getElementById('cap-limite').value = 3
  document.getElementById('modal-capacidade').classList.add('open')
}

function fecharCapacidade() {
  document.getElementById('modal-capacidade').classList.remove('open')
}

async function salvarCapacidade() {
  const data   = document.getElementById('cap-data').value
  const limite = parseInt(document.getElementById('cap-limite').value)

  if (!data)         { mostrarToast('Informe a data', 'error'); return }
  if (isNaN(limite)) { mostrarToast('Informe o limite', 'error'); return }

  // Upsert: cria ou atualiza o registro para aquela data
  const { error } = await supabase
    .from('capacidade_dia')
    .upsert({ data, limite_pedidos: limite }, { onConflict: 'data' })

  if (error) { mostrarToast('Erro ao salvar capacidade', 'error'); return }

  mostrarToast('Capacidade configurada!')
  fecharCapacidade()
  carregarMes()
}

// ===== EXPOR FUNÇÕES AO HTML =====
window.mudarMes                 = mudarMes
window.fecharDetalhe            = fecharDetalhe
window.abrirConfigurarCapacidade= abrirConfigurarCapacidade
window.fecharCapacidade         = fecharCapacidade
window.salvarCapacidade         = salvarCapacidade

// ===== INICIALIZAR =====
carregarMes()
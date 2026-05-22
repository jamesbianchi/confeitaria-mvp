import { supabase } from './supabase.js'

let anoAtual  = new Date().getFullYear()
let mesAtual  = new Date().getMonth()
let pedidos   = []

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function formatarData(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function pad(n) { return String(n).padStart(2, '0') }

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast')
  toast.textContent = mensagem
  toast.className = `toast ${tipo} show`
  setTimeout(() => toast.className = 'toast', 3000)
}

// ===== CARREGAR DADOS DO MÊS =====

async function carregarMes() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  document.getElementById('mes-titulo').textContent =
    `${meses[mesAtual]} ${anoAtual}`

  const inicio = `${anoAtual}-${pad(mesAtual + 1)}-01`
  const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate()
  const fim = `${anoAtual}-${pad(mesAtual + 1)}-${pad(ultimoDia)}`

  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, data_entrega, valor_total, sinal_pago,
      status_pagamento, status,
      clientes ( nome )
    `)
    .gte('data_entrega', inicio)
    .lte('data_entrega', fim)
    .neq('status', 'cancelado')
    .order('data_entrega', { ascending: true })

  if (error) {
    mostrarToast('Erro ao carregar financeiro', 'error')
    return
  }

  pedidos = data || []
  atualizarResumo()
  renderizarTabela(pedidos)
}

// ===== RESUMO =====

function atualizarResumo() {
  const faturado  = pedidos.reduce((a, p) => a + Number(p.valor_total), 0)
  const recebido  = pedidos.reduce((a, p) => a + Number(p.sinal_pago), 0)
  const aReceber  = faturado - recebido
  const pct       = faturado > 0 ? Math.round((recebido / faturado) * 100) : 0

  document.getElementById('total-faturado').textContent  = formatarMoeda(faturado)
  document.getElementById('total-recebido').textContent  = formatarMoeda(recebido)
  document.getElementById('total-a-receber').textContent = formatarMoeda(aReceber)
  document.getElementById('total-pedidos').textContent   = pedidos.length

  document.getElementById('pct-recebido').textContent    = `${pct}%`
  document.getElementById('barra-fill').style.width      = `${pct}%`
}

// ===== RENDERIZAR TABELA =====

function renderizarTabela(lista) {
  const tbody = document.getElementById('lista-financeiro')

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
      Nenhum pedido encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = lista.map(p => {
    const saldo = Number(p.valor_total) - Number(p.sinal_pago)
    const pago  = p.status_pagamento

    const badgePag = pago === 'pago'
      ? `<span class="pag-badge pag-pago">✅ Pago</span>`
      : pago === 'sinal_recebido'
      ? `<span class="pag-badge pag-sinal">⚠️ Sinal</span>`
      : `<span class="pag-badge pag-pendente">❌ Pendente</span>`

    const btnAcao = pago !== 'pago'
      ? `<button class="btn btn-success"
           onclick="abrirPagamento('${p.id}','${p.clientes?.nome}',
             ${p.valor_total},${p.sinal_pago})">
           Registrar
         </button>`
      : `<span style="font-size:12px;color:#aaa">—</span>`

    return `
      <tr>
        <td><strong>${p.clientes?.nome || '—'}</strong></td>
        <td>${formatarData(p.data_entrega)}</td>
        <td>${formatarMoeda(p.valor_total)}</td>
        <td>${formatarMoeda(p.sinal_pago)}</td>
        <td style="${saldo > 0 ? 'color:#E24B4A;font-weight:500' : ''}">
          ${saldo > 0 ? formatarMoeda(saldo) : '—'}
        </td>
        <td>${badgePag}</td>
        <td>${btnAcao}</td>
      </tr>
    `
  }).join('')
}

// ===== FILTRO =====

function filtrar() {
  const pag    = document.getElementById('filtro-pag').value
  const busca  = document.getElementById('busca-cliente').value.toLowerCase()

  const filtrado = pedidos.filter(p => {
    const pagOk   = pag === 'todos' || p.status_pagamento === pag
    const nomeOk  = p.clientes?.nome?.toLowerCase().includes(busca) ?? true
    return pagOk && nomeOk
  })

  renderizarTabela(filtrado)
}

// ===== MODAL REGISTRAR PAGAMENTO =====

function abrirPagamento(pedidoId, clienteNome, valorTotal, sinalPago) {
  const saldo = Number(valorTotal) - Number(sinalPago)

  document.getElementById('pag-pedido-id').value   = pedidoId
  document.getElementById('pag-valor-total').value = valorTotal
  document.getElementById('pag-info').textContent  =
    `Cliente: ${clienteNome} — Saldo pendente: ${formatarMoeda(saldo)}`
  document.getElementById('pag-valor').value = saldo > 0 ? saldo : valorTotal

  // Sugere o tipo automaticamente
  const select = document.getElementById('pag-tipo')
  if (Number(sinalPago) > 0)  select.value = 'saldo'
  else if (saldo <= 0)        select.value = 'integral'
  else                        select.value = 'sinal'

  document.getElementById('modal-pagamento').classList.add('open')
}

function fecharPagamento() {
  document.getElementById('modal-pagamento').classList.remove('open')
}

async function confirmarPagamento() {
  const pedidoId   = document.getElementById('pag-pedido-id').value
  const valorTotal = parseFloat(document.getElementById('pag-valor-total').value)
  const valor      = parseFloat(document.getElementById('pag-valor').value)
  const forma      = document.getElementById('pag-forma').value
  const tipo       = document.getElementById('pag-tipo').value

  if (!valor || valor <= 0) {
    mostrarToast('Informe o valor recebido', 'error')
    return
  }

  // Registra o pagamento
  const { error: erroPag } = await supabase
    .from('pagamentos')
    .insert({ pedido_id: pedidoId, valor, forma, tipo })

  if (erroPag) {
    mostrarToast('Erro ao registrar pagamento', 'error')
    return
  }

  // Atualiza sinal_pago e status_pagamento no pedido
  const pedido = pedidos.find(p => p.id === pedidoId)
  const novoSinal = Number(pedido?.sinal_pago || 0) + valor
  const novoStatus = novoSinal >= valorTotal ? 'pago' : 'sinal_recebido'

  await supabase
    .from('pedidos')
    .update({ sinal_pago: novoSinal, status_pagamento: novoStatus })
    .eq('id', pedidoId)

  mostrarToast('Pagamento registrado!')
  fecharPagamento()
  carregarMes()
}

// ===== NAVEGAÇÃO DE MÊS =====

function mudarMes(direcao) {
  mesAtual += direcao
  if (mesAtual > 11) { mesAtual = 0;  anoAtual++ }
  if (mesAtual < 0)  { mesAtual = 11; anoAtual-- }
  carregarMes()
}

// ===== EXPOR FUNÇÕES AO HTML =====
window.mudarMes          = mudarMes
window.filtrar           = filtrar
window.abrirPagamento    = abrirPagamento
window.fecharPagamento   = fecharPagamento
window.confirmarPagamento= confirmarPagamento

// ===== INICIALIZAR =====
carregarMes()
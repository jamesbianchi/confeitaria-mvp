import { supabase } from './supabase.js'

let clientes = []

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

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast')
  toast.textContent = mensagem
  toast.className = `toast ${tipo} show`
  setTimeout(() => toast.className = 'toast', 3000)
}

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

// ===== CARREGAR CLIENTES =====

async function carregarClientes() {
  // Busca clientes + contagem de pedidos de cada um
  const { data, error } = await supabase
    .from('clientes')
    .select(`
      *,
      pedidos ( id )
    `)
    .order('nome')

  if (error) {
    mostrarToast('Erro ao carregar clientes', 'error')
    return
  }

  // Adiciona contagem de pedidos em cada cliente
  clientes = data.map(c => ({
    ...c,
    total_pedidos: c.pedidos?.length || 0
  }))

  renderizarTabela(clientes)
}

// ===== RENDERIZAR TABELA =====

function renderizarTabela(lista) {
  const tbody = document.getElementById('lista-clientes')

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
      Nenhum cliente encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = lista.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.telefone}</td>
      <td>${c.endereco || '—'}</td>
      <td>
        <button class="btn btn-outline"
          onclick="verHistorico('${c.id}', '${c.nome.replace(/'/g, "\\'")}')">
          ${c.total_pedidos} pedido${c.total_pedidos !== 1 ? 's' : ''}
        </button>
      </td>
      <td>
        <button class="btn btn-outline" onclick="editarCliente('${c.id}')">
          Editar
        </button>
      </td>
    </tr>
  `).join('')
}

// ===== FILTRO =====

function filtrar() {
  const busca = document.getElementById('busca').value.toLowerCase()

  const filtrado = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca) ||
    c.telefone.includes(busca)
  )

  renderizarTabela(filtrado)
}

// ===== MODAL CADASTRO / EDIÇÃO =====

function abrirModal(cliente = null) {
  document.getElementById('modal-titulo').textContent =
    cliente ? 'Editar cliente' : 'Novo cliente'
  document.getElementById('cliente-id').value       = cliente?.id || ''
  document.getElementById('cliente-nome').value     = cliente?.nome || ''
  document.getElementById('cliente-telefone').value = cliente?.telefone || ''
  document.getElementById('cliente-endereco').value = cliente?.endereco || ''
  document.getElementById('modal-overlay').classList.add('open')
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

function editarCliente(id) {
  const cliente = clientes.find(c => c.id === id)
  if (cliente) abrirModal(cliente)
}

// ===== SALVAR CLIENTE =====

async function salvarCliente() {
  const id       = document.getElementById('cliente-id').value
  const nome     = document.getElementById('cliente-nome').value.trim()
  const telefone = document.getElementById('cliente-telefone').value.trim()
  const endereco = document.getElementById('cliente-endereco').value.trim()

  if (!nome) {
    mostrarToast('Informe o nome do cliente', 'error')
    return
  }
  if (!telefone) {
    mostrarToast('Informe o telefone do cliente', 'error')
    return
  }

  const dados = { nome, telefone, endereco }
  let error

  if (id) {
    const res = await supabase.from('clientes').update(dados).eq('id', id)
    error = res.error
  } else {
    const res = await supabase.from('clientes').insert(dados)
    error = res.error
  }

  if (error) {
    mostrarToast('Erro ao salvar cliente', 'error')
    return
  }

  mostrarToast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!')
  fecharModal()
  carregarClientes()
}

// ===== HISTÓRICO DE PEDIDOS =====

async function verHistorico(clienteId, clienteNome) {
  document.getElementById('historico-titulo').textContent =
    `Pedidos — ${clienteNome}`
  document.getElementById('lista-historico').innerHTML =
    `<tr><td colspan="4" class="empty-state">Carregando...</td></tr>`
  document.getElementById('modal-historico').classList.add('open')

  const { data, error } = await supabase
    .from('pedidos')
    .select('data_entrega, valor_total, status, status_pagamento')
    .eq('cliente_id', clienteId)
    .order('data_entrega', { ascending: false })

  const tbody = document.getElementById('lista-historico')

  if (error || !data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
      Nenhum pedido encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${formatarData(p.data_entrega)}</td>
      <td>${formatarMoeda(p.valor_total)}</td>
      <td>${badgeStatus(p.status)}</td>
      <td>${p.status_pagamento === 'pago' ? '✅ Pago' :
           p.status_pagamento === 'sinal_recebido' ? '⚠️ Sinal' : '❌ Pendente'}</td>
    </tr>
  `).join('')
}

function fecharHistorico() {
  document.getElementById('modal-historico').classList.remove('open')
}

// ===== EXPOR FUNÇÕES AO HTML =====
window.abrirModal     = abrirModal
window.fecharModal    = fecharModal
window.editarCliente  = editarCliente
window.salvarCliente   = salvarCliente
window.filtrar        = filtrar
window.verHistorico   = verHistorico
window.fecharHistorico = fecharHistorico

// ===== INICIALIZAR =====
carregarClientes()
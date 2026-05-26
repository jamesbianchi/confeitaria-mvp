// ===== CONEXAO SUPABASE =====
const { createClient } = window.supabase

const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


// ===== ESTADO =====
let sessao    = null
let pedidos   = []
let abaAtiva  = 'pedidos'

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function formatarData(dataStr) {
  if (!dataStr) return '—'
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${tipo} show`
  setTimeout(() => t.className = 'toast', 3500)
}

function badgeStatus(status) {
  const labels = {
    recebido:    '📬 Recebido',
    confirmado:  '✅ Confirmado',
    em_producao: '👩‍🍳 Em produção',
    pronto:      '📦 Pronto',
    entregue:    '🎉 Entregue',
    cancelado:   '❌ Cancelado'
  }
  return `<span class="status-badge status-${status}">
    ${labels[status] || status}
  </span>`
}

function atualizarBadgeCarrinho() {
  const carrinho = JSON.parse(localStorage.getItem('carrinho') || '[]')
  const total    = carrinho.reduce((a, i) => a + i.quantidade, 0)
  const badge    = document.getElementById('carrinho-badge')
  if (!badge) return
  badge.textContent = total
  badge.classList.toggle('visivel', total > 0)
}

// ===== VERIFICAR SESSÃO =====

async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) {
    window.location.href = 'login.html'
    return
  }
  sessao = session
  await carregarPerfil()
  await carregarPedidos()
}

// ===== CARREGAR PERFIL =====

async function carregarPerfil() {
  const { data: perfil } = await sb
    .from('perfis')
    .select('*')
    .eq('id', sessao.user.id)
    .single()

  // Navbar
  document.getElementById('menu-nome').textContent  =
    perfil?.nome || sessao.user.email
  document.getElementById('menu-email').textContent =
    sessao.user.email

  // Formulário de dados
  document.getElementById('dados-nome').value     = perfil?.nome     || ''
  document.getElementById('dados-telefone').value = perfil?.telefone || ''
  document.getElementById('dados-endereco').value = perfil?.endereco || ''
}

// ===== CARREGAR PEDIDOS =====

async function carregarPedidos() {
  // Busca cliente vinculado ao perfil
  const { data: perfil } = await sb
    .from('perfis')
    .select('telefone')
    .eq('id', sessao.user.id)
    .single()

  // Busca pedidos pelo telefone do perfil
  const { data: cliente } = await sb
    .from('clientes')
    .select('id')
    .eq('telefone', perfil?.telefone || '')
    .maybeSingle()

  if (!cliente) {
    renderizarPedidos([])
    return
  }

  const { data, error } = await sb
    .from('pedidos')
    .select(`
      id, data_entrega, status, valor_total,
      status_pagamento, sinal_pago, criado_em,
      itens_pedido (
        quantidade,
        produtos ( nome )
      )
    `)
    .eq('cliente_id', cliente.id)
    .order('criado_em', { ascending: false })

  if (error) {
    mostrarToast('Erro ao carregar pedidos', 'erro')
    return
  }

  pedidos = data || []
  renderizarPedidos(pedidos)
}

// ===== RENDERIZAR PEDIDOS =====

function renderizarPedidos(lista) {
  const container = document.getElementById('lista-pedidos')

  if (!lista.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-titulo">Nenhum pedido encontrado</div>
        <div class="empty-state-desc" style="margin-bottom:20px">
          Você ainda não fez nenhum pedido
        </div>
        <a href="index.html#cardapio" class="btn btn-primary">
          Ver cardápio
        </a>
      </div>
    `
    return
  }

  container.innerHTML = lista.map(p => {
    const itensTexto = p.itens_pedido
      ?.map(i => `${i.quantidade}x ${i.produtos?.nome}`)
      .join(', ') || '—'

    const saldo = Number(p.valor_total) - Number(p.sinal_pago)

    const pagInfo = p.status_pagamento === 'pago'
      ? `<span style="color:#166534">✅ Pago integralmente</span>`
      : p.status_pagamento === 'sinal_recebido'
      ? `<span style="color:#92400e">⚠️ Sinal pago — saldo: ${formatarMoeda(saldo)}</span>`
      : `<span style="color:#DC2626">❌ Pagamento pendente</span>`

    return `
      <div class="pedido-card">
        <div class="pedido-card-header">
          <div>
            <div class="pedido-numero">
              Pedido • ${new Date(p.criado_em).toLocaleDateString('pt-BR')}
            </div>
            <div class="pedido-data">
              📅 Entrega: ${formatarData(p.data_entrega)}
            </div>
          </div>
          ${badgeStatus(p.status)}
        </div>

        <div class="pedido-itens">🛍️ ${itensTexto}</div>

        <div class="pedido-footer">
          <div>
            <div class="pedido-valor">${formatarMoeda(p.valor_total)}</div>
            <div class="pag-status">${pagInfo}</div>
          </div>
          <button class="btn btn-secondary btn-sm"
            onclick="repetirPedido('${p.id}')">
            🔁 Pedir novamente
          </button>
        </div>
      </div>
    `
  }).join('')
}

// ===== FILTRAR PEDIDOS =====

function filtrarPedidos(status, btn) {
  // Atualiza pills
  document.querySelectorAll('#aba-pedidos .categoria-pill')
    .forEach(p => p.classList.remove('ativa'))
  btn.classList.add('ativa')

  const filtrado = status === 'todos'
    ? pedidos
    : pedidos.filter(p => p.status === status)

  renderizarPedidos(filtrado)
}

// ===== REPETIR PEDIDO =====

async function repetirPedido(pedidoId) {
  const pedido = pedidos.find(p => p.id === pedidoId)
  if (!pedido?.itens_pedido?.length) {
    mostrarToast('Não foi possível repetir este pedido', 'erro')
    return
  }

  // Busca preços atuais dos produtos
  const ids = pedido.itens_pedido.map(i => i.produtos?.nome).filter(Boolean)

  const carrinho = pedido.itens_pedido.map(item => ({
    id:            item.produto_id || '',
    nome:          item.produtos?.nome || '',
    preco:         item.preco_unitario || 0,
    quantidade:    item.quantidade,
    personalizacao:item.personalizacao || ''
  }))

  localStorage.setItem('carrinho', JSON.stringify(carrinho))
  mostrarToast('Itens adicionados ao carrinho! 🛒')
  setTimeout(() => window.location.href = 'carrinho.html', 1500)
}

// ===== TROCAR ABA =====

function trocarAba(aba) {
  abaAtiva = aba

  // Conteúdo
  document.querySelectorAll('.aba-conteudo').forEach(el => {
    el.classList.remove('ativa')
  })
  document.getElementById(`aba-${aba}`).classList.add('ativa')

  // Menu
  document.querySelectorAll('.conta-nav-item').forEach(el => {
    el.classList.remove('ativo')
  })
  event.target.classList.add('ativo')
}

// ===== SALVAR DADOS =====

async function salvarDados() {
  const nome     = document.getElementById('dados-nome').value.trim()
  const telefone = document.getElementById('dados-telefone').value.trim()
  const endereco = document.getElementById('dados-endereco').value.trim()
  const senha    = document.getElementById('dados-senha').value

  const btn = document.getElementById('btn-salvar-dados')
  btn.disabled    = true
  btn.textContent = 'Salvando...'

  // Atualiza perfil
  const { error: erroPerfil } = await sb
    .from('perfis')
    .upsert({ id: sessao.user.id, nome, telefone, endereco })

  if (erroPerfil) {
    mostrarToast('Erro ao salvar dados', 'erro')
    btn.disabled    = false
    btn.textContent = 'Salvar alterações'
    return
  }

  // Atualiza senha se informada
  if (senha && senha.length >= 6) {
    const { error: erroSenha } = await sb.auth.updateUser({ password: senha })
    if (erroSenha) {
      mostrarToast('Dados salvos, mas erro ao atualizar senha', 'erro')
      btn.disabled    = false
      btn.textContent = 'Salvar alterações'
      return
    }
    document.getElementById('dados-senha').value = ''
  }

  // Atualiza nome no menu
  document.getElementById('menu-nome').textContent = nome

  mostrarToast('Dados atualizados com sucesso!')
  btn.disabled    = false
  btn.textContent = 'Salvar alterações'
}

// ===== LOGOUT =====

async function fazerLogout() {
  await sb.auth.signOut()
  window.location.href = 'index.html'
}

// ===== EXPOR AO HTML =====
window.trocarAba      = trocarAba
window.filtrarPedidos = filtrarPedidos
window.repetirPedido  = repetirPedido
window.salvarDados    = salvarDados
window.fazerLogout    = fazerLogout

// ===== INICIALIZAR =====
verificarSessao()
atualizarBadgeCarrinho()
// ===== CONEXÃO SUPABASE =====
const { createClient } = window.supabase
const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===== ESTADO =====
let produtos      = []
let categoriaAtiva = 'todos'
let carrinho      = JSON.parse(localStorage.getItem('carrinho') || '[]')

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${tipo} show`
  setTimeout(() => t.className = 'toast', 3000)
}

function salvarCarrinho() {
  localStorage.setItem('carrinho', JSON.stringify(carrinho))
  atualizarBadge()
}

function atualizarBadge() {
  const total = carrinho.reduce((a, i) => a + i.quantidade, 0)
  const badge = document.getElementById('carrinho-badge')
  if (!badge) return
  badge.textContent = total
  badge.classList.toggle('visivel', total > 0)
}

// ===== CARREGAR PRODUTOS =====

async function carregarProdutos() {
  const { data, error } = await sb
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('nome')

  if (error || !data?.length) {
    document.getElementById('produtos-grid').innerHTML = ''
    document.getElementById('empty-state').style.display = 'block'
    return
  }

  produtos = data
  renderizarProdutos(produtos)
}

// ===== RENDERIZAR GRID =====

function renderizarProdutos(lista) {
  const grid       = document.getElementById('produtos-grid')
  const emptyState = document.getElementById('empty-state')

  if (!lista.length) {
    grid.innerHTML = ''
    emptyState.style.display = 'block'
    return
  }

  emptyState.style.display = 'none'
  grid.innerHTML = lista.map(p => `
    <div class="produto-card" onclick="abrirModal('${p.id}')">
      <div class="produto-img">
        ${p.foto_url
          ? `<img src="${p.foto_url}" alt="${p.nome}"
              style="width:100%;height:100%;object-fit:cover"
              loading="lazy" />`
          : getProdutoEmoji(p.nome)
        }
      </div>
      <div class="produto-body">
        <div class="produto-nome">${p.nome}</div>
        <div class="produto-desc">${p.descricao || 'Produto artesanal'}</div>
        <div class="produto-footer">
          <span class="produto-preco">${formatarMoeda(p.preco_base)}</span>
          <button class="btn-add" onclick="event.stopPropagation(); abrirModal('${p.id}')">
            +
          </button>
        </div>
      </div>
    </div>
  `).join('')
}

// Emoji automático baseado no nome do produto
function getProdutoEmoji(nome) {
  const n = nome.toLowerCase()
  if (n.includes('brigadeiro') || n.includes('doce') || n.includes('bolo'))
    return '🍫'
  if (n.includes('beijinho') || n.includes('coco'))
    return '🍬'
  if (n.includes('coxinha') || n.includes('salgado'))
    return '🥟'
  if (n.includes('empada') || n.includes('torta'))
    return '🥧'
  if (n.includes('brownie') || n.includes('chocolate'))
    return '🍪'
  return '🍰'
}

// ===== FILTROS =====

function filtrarCategoria(categoria) {
  categoriaAtiva = categoria

  // Atualiza pills
  document.querySelectorAll('.categoria-pill').forEach(pill => {
    pill.classList.remove('ativa')
  })
  event.target.classList.add('ativa')

  aplicarFiltros()
}

function buscarProduto() {
  aplicarFiltros()
}

function aplicarFiltros() {
  const busca = document.getElementById('busca-produto').value.toLowerCase()

  let filtrado = produtos

  // Filtro por categoria — agora usa o campo real do banco
  if (categoriaAtiva === 'doces') {
    filtrado = filtrado.filter(p => p.categoria === 'doces')
  } else if (categoriaAtiva === 'salgados') {
    filtrado = filtrado.filter(p => p.categoria === 'salgados')
  }

  // Filtro por busca
  if (busca) {
    filtrado = filtrado.filter(p =>
      p.nome.toLowerCase().includes(busca) ||
      (p.descricao || '').toLowerCase().includes(busca) ||
      (p.categoria || '').toLowerCase().includes(busca)
    )
  }

  renderizarProdutos(filtrado)
}

// ===== MODAL PRODUTO =====

function abrirModal(produtoId) {
  const p = produtos.find(x => x.id === produtoId)
  if (!p) return

  document.getElementById('modal-produto-nome').textContent  = p.nome
  document.getElementById('modal-produto-desc').textContent  = p.descricao || ''
  document.getElementById('modal-produto-preco').textContent = formatarMoeda(p.preco_base)
  document.getElementById('modal-produto-id').value          = p.id
  document.getElementById('modal-produto-preco-val').value   = p.preco_base
  document.getElementById('modal-qtd').textContent           = '1'
  document.getElementById('modal-personalizacao').value      = ''
  document.getElementById('modal-produto').classList.add('aberto')
}

function fecharModal() {
  document.getElementById('modal-produto').classList.remove('aberto')
}

function alterarQtd(delta) {
  const el  = document.getElementById('modal-qtd')
  const qtd = Math.max(1, parseInt(el.textContent) + delta)
  el.textContent = qtd
}

// ===== ADICIONAR AO CARRINHO =====

function adicionarAoCarrinho() {
  const id            = document.getElementById('modal-produto-id').value
  const preco         = parseFloat(document.getElementById('modal-produto-preco-val').value)
  const qtd           = parseInt(document.getElementById('modal-qtd').textContent)
  const personalizacao= document.getElementById('modal-personalizacao').value.trim()
  const produto       = produtos.find(p => p.id === id)
  if (!produto) return

  // Verifica se já existe no carrinho (mesmo id e personalização)
  const idx = carrinho.findIndex(i =>
    i.id === id && i.personalizacao === personalizacao
  )

  if (idx >= 0) {
    carrinho[idx].quantidade += qtd
  } else {
    carrinho.push({
      id,
      nome:          produto.nome,
      preco,
      quantidade:    qtd,
      personalizacao
    })
  }

  salvarCarrinho()
  fecharModal()
  mostrarToast(`${produto.nome} adicionado ao carrinho! 🛒`)
}

// ===== VERIFICAR SESSÃO (navbar) =====

async function verificarSessaoNavbar() {
  const { data: { session } } = await sb.auth.getSession()
  const { data: { user } = {}, error: userError } = await sb.auth.getUser()
  const linkLogin = document.getElementById('link-login')
  const linkConta = document.getElementById('link-conta')

  if (session && !user) {
    console.warn('Sessão inválida detectada; fazendo signOut local')
    await sb.auth.signOut()
  }

  if (user) {
    if (linkLogin) linkLogin.style.display = 'none'
    if (linkConta) linkConta.style.display = 'inline'
    return
  }

  if (linkLogin) linkLogin.style.display = 'inline'
  if (linkConta) linkConta.style.display = 'none'
}

// ===== INICIALIZAR =====
carregarProdutos()
atualizarBadge()
verificarSessaoNavbar()
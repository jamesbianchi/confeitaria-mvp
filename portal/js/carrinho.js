// ===== CONEXÃO SUPABASE =====
const { createClient } = window.supabase
const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===== ESTADO =====
let carrinho = JSON.parse(localStorage.getItem('carrinho') || '[]')

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
}

function getProdutoEmoji(nome) {
  const n = nome.toLowerCase()
  if (n.includes('brigadeiro') || n.includes('doce') || n.includes('bolo'))
    return '🍫'
  if (n.includes('beijinho') || n.includes('coco'))  return '🍬'
  if (n.includes('coxinha') || n.includes('salgado')) return '🥟'
  if (n.includes('empada') || n.includes('torta'))   return '🥧'
  if (n.includes('brownie') || n.includes('chocolate')) return '🍪'
  return '🍰'
}

// ===== CALCULAR TOTAL =====

function calcularTotal() {
  return carrinho.reduce((acc, item) =>
    acc + item.preco * item.quantidade, 0)
}

// ===== RENDERIZAR CARRINHO =====

function renderizarCarrinho() {
  const vazio    = document.getElementById('carrinho-vazio')
  const conteudo = document.getElementById('carrinho-conteudo')

  if (!carrinho.length) {
    vazio.style.display    = 'block'
    conteudo.style.display = 'none'
    return
  }

  vazio.style.display    = 'none'
  conteudo.style.display = 'block'

  // Lista de itens
  document.getElementById('lista-itens').innerHTML = carrinho.map((item, idx) => `
    <div class="item-carrinho">
      <div class="item-emoji">${getProdutoEmoji(item.nome)}</div>
      <div class="item-info">
        <div class="item-nome">${item.nome}</div>
        ${item.personalizacao
          ? `<div class="item-pers">✏️ ${item.personalizacao}</div>`
          : ''}
        <div class="item-controles">
          <button class="btn-qtd" onclick="alterarQuantidade(${idx}, -1)">−</button>
          <span style="font-weight:500; min-width:20px; text-align:center">
            ${item.quantidade}
          </span>
          <button class="btn-qtd" onclick="alterarQuantidade(${idx}, 1)">+</button>
          <span style="font-size:13px; color:var(--cor-texto-leve)">
            ${formatarMoeda(item.preco)} cada
          </span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px">
        <span class="item-preco">
          ${formatarMoeda(item.preco * item.quantidade)}
        </span>
        <button class="btn-remover" onclick="removerItem(${idx})"
          title="Remover item">🗑️</button>
      </div>
    </div>
  `).join('')

  // Resumo lateral
  document.getElementById('resumo-itens').innerHTML = carrinho.map(item => `
    <div style="display:flex; justify-content:space-between;
      font-size:13px; margin-bottom:8px">
      <span style="color:var(--cor-texto-leve)">
        ${item.quantidade}x ${item.nome}
        ${item.personalizacao ? `<br><span style="font-size:11px">
          ✏️ ${item.personalizacao}</span>` : ''}
      </span>
      <span style="font-weight:500">
        ${formatarMoeda(item.preco * item.quantidade)}
      </span>
    </div>
  `).join('')

  document.getElementById('total-geral').textContent =
    formatarMoeda(calcularTotal())
}

// ===== ALTERAR QUANTIDADE =====

function alterarQuantidade(idx, delta) {
  carrinho[idx].quantidade += delta
  if (carrinho[idx].quantidade <= 0) {
    carrinho.splice(idx, 1)
    mostrarToast('Item removido do carrinho')
  }
  salvarCarrinho()
  renderizarCarrinho()
}

// ===== REMOVER ITEM =====

function removerItem(idx) {
  const nome = carrinho[idx].nome
  carrinho.splice(idx, 1)
  salvarCarrinho()
  renderizarCarrinho()
  mostrarToast(`${nome} removido do carrinho`)
}

// ===== IR PARA CHECKOUT =====

async function irParaCheckout() {
  // Verifica se está logado
  const { data: { session } } = await sb.auth.getSession()
  const { data: { user } = {} } = await sb.auth.getUser()

  if (!session || !user) {
    if (session) await sb.auth.signOut()
    sessionStorage.setItem('redirect_apos_login', 'checkout.html')
    mostrarToast('Faça login para continuar', 'erro')
    setTimeout(() => window.location.href = 'login.html', 1500)
    return
  }

  window.location.href = 'checkout.html'
}

// ===== VERIFICAR SESSÃO (navbar) =====

async function verificarSessaoNavbar() {
  const { data: { session } } = await sb.auth.getSession()
  const { data: { user } = {} } = await sb.auth.getUser()
  const linkLogin = document.getElementById('link-login')
  const linkConta = document.getElementById('link-conta')

  if (session && !user) {
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
renderizarCarrinho()
verificarSessaoNavbar()
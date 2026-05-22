import { supabase } from './supabase.js'

// Cache local dos produtos carregados
let produtos = []

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast')
  toast.textContent = mensagem
  toast.className = `toast ${tipo} show`
  setTimeout(() => toast.className = 'toast', 3000)
}

// ===== CARREGAR PRODUTOS =====

async function carregarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome')

  if (error) {
    mostrarToast('Erro ao carregar produtos', 'error')
    return
  }

  produtos = data
  renderizarTabela(produtos)
}

// ===== RENDERIZAR TABELA =====

function renderizarTabela(lista) {
  const tbody = document.getElementById('lista-produtos')

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
      Nenhum produto encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = lista.map(p => `
    <tr style="${!p.ativo ? 'opacity:0.5' : ''}">
      <td><strong>${p.nome}</strong></td>
      <td>${p.descricao || '—'}</td>
      <td>${formatarMoeda(p.preco_base)}</td>
      <td>
        <span class="badge ${p.ativo ? 'badge-confirmado' : 'badge-cancelado'}">
          ${p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <button class="btn btn-outline" onclick="editarProduto('${p.id}')">
          Editar
        </button>
      </td>
    </tr>
  `).join('')
}

// ===== FILTRO =====

function filtrar() {
  const busca = document.getElementById('busca').value.toLowerCase()
  const status = document.getElementById('filtro-status').value

  const filtrado = produtos.filter(p => {
    const nomeOk = p.nome.toLowerCase().includes(busca)
    const statusOk = status === 'todos' ||
      (status === 'ativo' && p.ativo) ||
      (status === 'inativo' && !p.ativo)
    return nomeOk && statusOk
  })

  renderizarTabela(filtrado)
}

// ===== MODAL =====

function abrirModal(produto = null) {
  document.getElementById('modal-titulo').textContent =
    produto ? 'Editar produto' : 'Novo produto'
  document.getElementById('produto-id').value        = produto?.id || ''
  document.getElementById('produto-nome').value      = produto?.nome || ''
  document.getElementById('produto-descricao').value = produto?.descricao || ''
  document.getElementById('produto-preco').value     = produto?.preco_base || ''
  document.getElementById('produto-ativo').value     = produto ? String(produto.ativo) : 'true'
  document.getElementById('modal-overlay').classList.add('open')
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

function editarProduto(id) {
  const produto = produtos.find(p => p.id === id)
  if (produto) abrirModal(produto)
}

// ===== SALVAR (criar ou editar) =====

async function salvarProduto() {
  const id       = document.getElementById('produto-id').value
  const nome     = document.getElementById('produto-nome').value.trim()
  const descricao= document.getElementById('produto-descricao').value.trim()
  const preco    = parseFloat(document.getElementById('produto-preco').value)
  const ativo    = document.getElementById('produto-ativo').value === 'true'

  // Validação
  if (!nome) {
    mostrarToast('Informe o nome do produto', 'error')
    return
  }
  if (!preco || preco <= 0) {
    mostrarToast('Informe um preço válido', 'error')
    return
  }

  const dados = { nome, descricao, preco_base: preco, ativo }

  let error

  if (id) {
    // Editar produto existente
    const res = await supabase.from('produtos').update(dados).eq('id', id)
    error = res.error
  } else {
    // Criar novo produto
    const res = await supabase.from('produtos').insert(dados)
    error = res.error
  }

  if (error) {
    mostrarToast('Erro ao salvar produto', 'error')
    return
  }

  mostrarToast(id ? 'Produto atualizado!' : 'Produto criado!')
  fecharModal()
  carregarProdutos()
}

// ===== EXPOR FUNÇÕES AO HTML =====
// Necessário porque o script é do tipo "module"
window.abrirModal   = abrirModal
window.fecharModal  = fecharModal
window.editarProduto = editarProduto
window.filtrar      = filtrar
window.salvarProduto = salvarProduto

// ===== INICIALIZAR =====
carregarProdutos()
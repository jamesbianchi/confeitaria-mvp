// ===== CONEXÃO SUPABASE =====
const { createClient } = window.supabase
const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'


const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let produtos   = []
let fotoArquivo = null

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

function getProdutoEmoji(nome) {
  const n = (nome || '').toLowerCase()
  if (n.includes('brigadeiro') || n.includes('doce')) return '🍫'
  if (n.includes('beijinho') || n.includes('coco'))   return '🍬'
  if (n.includes('coxinha') || n.includes('salgado')) return '🥟'
  if (n.includes('empada') || n.includes('torta'))    return '🥧'
  return '🍰'
}

// ===== CARREGAR PRODUTOS =====

async function carregarProdutos() {
  const { data, error } = await sb
    .from('produtos')
    .select('*')
    .order('nome')

  if (error) { mostrarToast('Erro ao carregar produtos', 'error'); return }
  produtos = data
  renderizarTabela(produtos)
}

// ===== RENDERIZAR TABELA =====

function renderizarTabela(lista) {
  const tbody = document.getElementById('lista-produtos')

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
      Nenhum produto encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = lista.map(p => `
    <tr style="${!p.ativo ? 'opacity:0.5' : ''}">
      <td>
        ${p.foto_url
          ? `<img src="${p.foto_url}" alt="${p.nome}"
              class="produto-thumb" />`
          : `<div class="produto-thumb-placeholder">
              ${getProdutoEmoji(p.nome)}
             </div>`
        }
      </td>
      <td><strong>${p.nome}</strong></td>
      <td>
        <span class="badge ${p.categoria === 'doces'
          ? 'badge-confirmado' : 'badge-producao'}">
          ${p.categoria === 'doces' ? '🍫 Doces' : '🥟 Salgados'}
        </span>
      </td>
      <td>${p.descricao || '—'}</td>
      <td>${formatarMoeda(p.preco_base)}</td>
      <td>
        <span class="badge ${p.ativo ? 'badge-confirmado' : 'badge-cancelado'}">
          ${p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <button class="btn btn-outline"
          onclick="editarProduto('${p.id}')">Editar</button>
      </td>
    </tr>
  `).join('')
}

// ===== FILTRO =====

function filtrar() {
  const busca  = document.getElementById('busca').value.toLowerCase()
  const status = document.getElementById('filtro-status').value

  const filtrado = produtos.filter(p => {
    const nomeOk   = p.nome.toLowerCase().includes(busca)
    const statusOk = status === 'todos' ||
      (status === 'ativo' && p.ativo) ||
      (status === 'inativo' && !p.ativo)
    return nomeOk && statusOk
  })

  renderizarTabela(filtrado)
}

// ===== FOTO — SELECIONAR =====

function selecionarFoto(event) {
  const arquivo = event.target.files[0]
  if (!arquivo) return
  processarFoto(arquivo)
}

function dragOver(event) {
  event.preventDefault()
  document.getElementById('upload-area').classList.add('dragover')
}

function dragLeave(event) {
  document.getElementById('upload-area').classList.remove('dragover')
}

function dropFoto(event) {
  event.preventDefault()
  document.getElementById('upload-area').classList.remove('dragover')
  const arquivo = event.dataTransfer.files[0]
  if (arquivo && arquivo.type.startsWith('image/')) processarFoto(arquivo)
}

function processarFoto(arquivo) {
  if (arquivo.size > 2 * 1024 * 1024) {
    mostrarToast('Foto muito grande — máximo 2MB', 'error')
    return
  }

  fotoArquivo = arquivo

  // Preview local
  const reader = new FileReader()
  reader.onload = e => {
    const preview = document.getElementById('foto-preview')
    preview.src   = e.target.result
    preview.style.display = 'block'
    document.getElementById('upload-placeholder').style.display = 'none'
    document.getElementById('btn-remover-foto').style.display   = 'flex'
  }
  reader.readAsDataURL(arquivo)
}

function removerFoto() {
  fotoArquivo = null
  document.getElementById('foto-preview').style.display        = 'none'
  document.getElementById('foto-preview').src                  = ''
  document.getElementById('upload-placeholder').style.display  = 'block'
  document.getElementById('btn-remover-foto').style.display    = 'none'
  document.getElementById('produto-foto-atual').value          = ''
  document.getElementById('input-foto').value                  = ''
}

// ===== UPLOAD DA FOTO NO SUPABASE STORAGE =====

async function uploadFoto(arquivo, produtoNome) {
  const ext      = arquivo.name.split('.').pop()
  const nomeArq  = `${Date.now()}_${produtoNome
    .replace(/\s+/g, '_')
    .toLowerCase()}.${ext}`

  // Mostra barra de progresso
  const progressEl = document.getElementById('upload-progress')
  const fillEl     = document.getElementById('progress-fill')
  progressEl.style.display = 'block'
  fillEl.style.width = '30%'

  const { data, error } = await sb.storage
    .from('produtos')
    .upload(nomeArq, arquivo, {
      cacheControl: '3600',
      upsert: false
    })

  fillEl.style.width = '100%'
  setTimeout(() => { progressEl.style.display = 'none' }, 500)

  if (error) {
    mostrarToast('Erro ao enviar foto', 'error')
    return null
  }

  // Retorna URL pública da foto
  const { data: urlData } = sb.storage
    .from('produtos')
    .getPublicUrl(nomeArq)

  return urlData.publicUrl
}

// ===== MODAL =====

function abrirModal(produto = null) {
  fotoArquivo = null

  document.getElementById('modal-titulo').textContent      =
    produto ? 'Editar produto' : 'Novo produto'
  document.getElementById('produto-id').value              = produto?.id || ''
  document.getElementById('produto-nome').value            = produto?.nome || ''
  document.getElementById('produto-descricao').value       = produto?.descricao || ''
  document.getElementById('produto-preco').value           = produto?.preco_base || ''
  document.getElementById('produto-categoria').value       = produto?.categoria || 'doces'
  document.getElementById('produto-ativo').value           = produto ? String(produto.ativo) : 'true'
  document.getElementById('produto-foto-atual').value      = produto?.foto_url || ''
  document.getElementById('input-foto').value              = ''
  document.getElementById('upload-progress').style.display = 'none'

  // Preview da foto existente
  const preview = document.getElementById('foto-preview')
  if (produto?.foto_url) {
    preview.src           = produto.foto_url
    preview.style.display = 'block'
    document.getElementById('upload-placeholder').style.display = 'none'
    document.getElementById('btn-remover-foto').style.display   = 'flex'
  } else {
    preview.style.display = 'none'
    preview.src           = ''
    document.getElementById('upload-placeholder').style.display = 'block'
    document.getElementById('btn-remover-foto').style.display   = 'none'
  }

  document.getElementById('modal-overlay').classList.add('open')
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

function editarProduto(id) {
  const produto = produtos.find(p => p.id === id)
  if (produto) abrirModal(produto)
}

// ===== SALVAR PRODUTO =====

async function salvarProduto() {
  const id      = document.getElementById('produto-id').value
  const nome    = document.getElementById('produto-nome').value.trim()
  const desc    = document.getElementById('produto-descricao').value.trim()
  const preco   = parseFloat(document.getElementById('produto-preco').value)
  const ativo   = document.getElementById('produto-ativo').value === 'true'
  const fotoAtual = document.getElementById('produto-foto-atual').value

  if (!nome)             { mostrarToast('Informe o nome', 'error'); return }
  if (!preco || preco <= 0) { mostrarToast('Informe um preço válido', 'error'); return }

  const btn = document.getElementById('btn-salvar')
  btn.disabled    = true
  btn.textContent = 'Salvando...'

  // Faz upload da foto se houver nova
  let fotoUrl = fotoAtual
  if (fotoArquivo) {
    fotoUrl = await uploadFoto(fotoArquivo, nome)
    if (!fotoUrl) {
      btn.disabled    = false
      btn.textContent = 'Salvar'
      return
    }
  }

  const categoria = document.getElementById('produto-categoria').value

  const dados = {
    nome,
    descricao:  desc,
    preco_base: preco,
    ativo,
    categoria,
    foto_url:   fotoUrl || null
  }

  let error

  if (id) {
    const res = await sb.from('produtos').update(dados).eq('id', id)
    error = res.error
  } else {
    const res = await sb.from('produtos').insert(dados)
    error = res.error
  }

  btn.disabled    = false
  btn.textContent = 'Salvar'

  if (error) { mostrarToast('Erro ao salvar produto', 'error'); return }

  mostrarToast(id ? 'Produto atualizado!' : 'Produto criado!')
  fecharModal()
  carregarProdutos()
}

// ===== EXPOR AO HTML =====
window.abrirModal     = abrirModal
window.fecharModal    = fecharModal
window.editarProduto  = editarProduto
window.salvarProduto  = salvarProduto
window.filtrar        = filtrar
window.selecionarFoto = selecionarFoto
window.removerFoto    = removerFoto
window.dragOver       = dragOver
window.dragLeave      = dragLeave
window.dropFoto       = dropFoto

// ===== INICIALIZAR =====
carregarProdutos()
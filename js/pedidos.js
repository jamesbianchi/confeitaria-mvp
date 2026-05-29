import { supabase } from './supabase.js'

let pedidos   = []
let clientes  = []
let produtos  = []
let itensPedido = [] // itens do formulário atual

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

// ===== CARREGAR DADOS INICIAIS =====

async function carregarDados() {
  // Carrega clientes, produtos e pedidos em paralelo
  const [resClientes, resProdutos, resPedidos] = await Promise.all([
    supabase.from('clientes').select('id, nome').order('nome'),
    supabase.from('produtos').select('id, nome, preco_base').eq('ativo', true).order('nome'),
    supabase.from('pedidos').select(`
      id, data_entrega, tipo_entrega, status,
      valor_total, sinal_pago, status_pagamento, observacoes,
      clientes ( id, nome )
    `).order('data_entrega', { ascending: false })
  ])

  clientes = resClientes.data || []
  produtos = resProdutos.data || []
  pedidos  = resPedidos.data  || []

  preencherSelectClientes()
  renderizarTabela(pedidos)
}

function preencherSelectClientes() {
  const sel = document.getElementById('pedido-cliente')
  sel.innerHTML = '<option value="">Selecione o cliente...</option>' +
    clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')
}

// ===== RENDERIZAR TABELA =====

function renderizarTabela(lista) {
  const tbody = document.getElementById('lista-pedidos')

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">
      Nenhum pedido encontrado
    </td></tr>`
    return
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.clientes?.nome || '—'}</strong></td>
      <td>${formatarData(p.data_entrega)}</td>
      <td>${p.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retirada'}</td>
      <td>${formatarMoeda(p.valor_total)}</td>
      <td>${badgeStatus(p.status)}</td>
      <td>${p.status_pagamento === 'pago'
        ? '✅ Pago'
        : p.status_pagamento === 'sinal_recebido'
        ? `⚠️ Sinal (${formatarMoeda(p.sinal_pago)})`
        : '❌ Pendente'}
      </td>

     
      <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-outline" onclick="editarPedido('${p.id}')">
          Ver / Editar
        </button>
        ${p.status === 'confirmado' ? `
        <button class="btn btn-success"
          onclick="enviarWhatsApp('${p.id}')">
          📲 WhatsApp
        </button>` : ''}
        <button class="btn btn-outline" onclick="gerarRecibo('${p.id}')">
          📄 Recibo
        </button>
        </td>



    </tr>
  `).join('')
}

// ===== FILTRO =====

function filtrar() {
  const busca  = document.getElementById('busca').value.toLowerCase()
  const status = document.getElementById('filtro-status').value
  const data   = document.getElementById('filtro-data').value

  const filtrado = pedidos.filter(p => {
    const nomeOk   = p.clientes?.nome?.toLowerCase().includes(busca)
    const statusOk = status === 'todos' || p.status === status
    const dataOk   = !data || p.data_entrega === data
    return nomeOk && statusOk && dataOk
  })

  renderizarTabela(filtrado)
}

// ===== ITENS DO PEDIDO =====

function adicionarItem(item = null) {
  const novoItem = {
    _id:           Date.now(), // ID temporário para controle no frontend
    produto_id:    item?.produto_id    || '',
    quantidade:    item?.quantidade    || 1,
    personalizacao:item?.personalizacao|| '',
    preco_unitario:item?.preco_unitario|| 0
  }
  itensPedido.push(novoItem)
  renderizarItens()
}

function removerItem(tempId) {
  itensPedido = itensPedido.filter(i => i._id !== tempId)
  renderizarItens()
}

function renderizarItens() {
  const container = document.getElementById('itens-lista')

  if (!itensPedido.length) {
    container.innerHTML = `<div style="font-size:12px;color:#aaa;text-align:center;
      padding:12px">Nenhum item adicionado</div>`
    atualizarTotal()
    return
  }

  container.innerHTML = itensPedido.map(item => `
    <div class="item-row">
      <select onchange="atualizarItem(${item._id}, 'produto_id', this.value)">
        <option value="">Selecione...</option>
        ${produtos.map(p => `
          <option value="${p.id}"
            ${item.produto_id === p.id ? 'selected' : ''}>
            ${p.nome} — ${formatarMoeda(p.preco_base)}
          </option>
        `).join('')}
      </select>
      <input type="number" min="1" value="${item.quantidade}"
        placeholder="Qtd"
        onchange="atualizarItem(${item._id}, 'quantidade', this.value)" />
      <input type="text" value="${item.personalizacao}"
        placeholder="Personalização (opcional)"
        oninput="atualizarItem(${item._id}, 'personalizacao', this.value)" />
      <span class="item-total">
        ${formatarMoeda(item.preco_unitario * item.quantidade)}
      </span>
      <button class="btn btn-danger" onclick="removerItem(${item._id})">×</button>
    </div>
  `).join('')

  atualizarTotal()
}

function atualizarItem(tempId, campo, valor) {
  const item = itensPedido.find(i => i._id === tempId)
  if (!item) return

  if (campo === 'produto_id') {
    const produto = produtos.find(p => p.id === valor)
    item.produto_id     = valor
    item.preco_unitario = produto ? Number(produto.preco_base) : 0
  } else if (campo === 'quantidade') {
    item.quantidade = Math.max(1, parseInt(valor) || 1)
  } else {
    item[campo] = valor
  }

  renderizarItens()
}

function atualizarTotal() {
  const total = itensPedido.reduce((acc, i) =>
    acc + (i.preco_unitario * i.quantidade), 0)
  document.getElementById('valor-total-box').textContent =
    `Total: ${formatarMoeda(total)}`
  return total
}

function atualizarStatusPagamento() {
  const sinal = parseFloat(document.getElementById('pedido-sinal').value) || 0
  const total = itensPedido.reduce((acc, i) =>
    acc + (i.preco_unitario * i.quantidade), 0)

  if (sinal <= 0) return 'pendente'
  if (sinal >= total) return 'pago'
  return 'sinal_recebido'
}



// ===== VALIDAR DIA DA ENTREGA (só sáb e dom) =====
function validarDiaEntrega() {
  const data    = document.getElementById('pedido-data').value
  const aviso   = document.getElementById('aviso-dia-entrega')
  const btnSalvar = document.getElementById('btn-salvar') ||
                    document.querySelector('.btn-primary[onclick="salvarPedido()"]')

  if (!data) return

  const diaSemana = new Date(data + 'T12:00:00').getDay()
  const valido    = diaSemana === 6 || diaSemana === 0

  aviso.style.display = valido ? 'none' : 'block'
  if (btnSalvar) btnSalvar.disabled = !valido

  if (valido) verificarCapacidade()
}



// ===== VERIFICAR CAPACIDADE DA DATA =====

async function verificarCapacidade() {
  const data = document.getElementById('pedido-data').value
  const alertaEl = document.getElementById('alerta-capacidade')

  if (!data) { alertaEl.style.display = 'none'; return }

  // Conta pedidos confirmados para essa data
  const { count } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact' })
    .eq('data_entrega', data)
    .neq('status', 'cancelado')

  // Busca limite configurado para essa data
  const { data: cap } = await supabase
    .from('capacidade_dia')
    .select('limite_pedidos')
    .eq('data', data)
    .single()

  const limite = cap?.limite_pedidos || 3 // padrão: 3

  if (count >= limite) {
    alertaEl.style.display = 'block'
    alertaEl.textContent =
      `⚠️ Atenção: esta data já tem ${count} pedido(s) — limite configurado é ${limite}.`
  } else {
    alertaEl.style.display = 'none'
  }
}

// ===== MODAL =====

async function abrirModal(pedidoId = null) {
  itensPedido = []

  document.getElementById('pedido-id').value    = ''
  document.getElementById('pedido-cliente').value = ''
  document.getElementById('pedido-data').value  = ''
  document.getElementById('pedido-tipo').value  = 'delivery'
  document.getElementById('pedido-status').value= 'recebido'
  document.getElementById('pedido-sinal').value = ''
  document.getElementById('pedido-obs').value   = ''
  document.getElementById('alerta-capacidade').style.display = 'none'
  document.getElementById('modal-titulo').textContent = 'Novo pedido'

  renderizarItens()

  if (pedidoId) {
    // Modo edição: carrega dados do pedido
    document.getElementById('modal-titulo').textContent = 'Editar pedido'

    const { data: pedido } = await supabase
      .from('pedidos')
      .select(`*, itens_pedido(*)`)
      .eq('id', pedidoId)
      .single()

    if (pedido) {
      document.getElementById('pedido-id').value     = pedido.id
      document.getElementById('pedido-cliente').value= pedido.cliente_id
      document.getElementById('pedido-data').value   = pedido.data_entrega
      document.getElementById('pedido-tipo').value   = pedido.tipo_entrega
      document.getElementById('pedido-status').value = pedido.status
      document.getElementById('pedido-sinal').value  = pedido.sinal_pago || ''
      document.getElementById('pedido-obs').value    = pedido.observacoes || ''

      // Carrega os itens existentes
      itensPedido = (pedido.itens_pedido || []).map(i => ({
        _id:            Date.now() + Math.random(),
        id:             i.id, // ID real do banco
        produto_id:     i.produto_id,
        quantidade:     i.quantidade,
        personalizacao: i.personalizacao || '',
        preco_unitario: Number(i.preco_unitario)
      }))

      renderizarItens()
      verificarCapacidade()
    }
  }

  document.getElementById('modal-overlay').classList.add('open')
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

function editarPedido(id) {
  abrirModal(id)
}

// ===== SALVAR PEDIDO =====

async function salvarPedido() {
  const id         = document.getElementById('pedido-id').value
  const clienteId  = document.getElementById('pedido-cliente').value
  const data       = document.getElementById('pedido-data').value
  const tipo       = document.getElementById('pedido-tipo').value
  const status     = document.getElementById('pedido-status').value
  const sinal      = parseFloat(document.getElementById('pedido-sinal').value) || 0
  const obs        = document.getElementById('pedido-obs').value.trim()



// ↓↓↓ ADICIONE AQUI — antes das validações existentes ↓↓↓
  if (data) {
    const diaSemana = new Date(data + 'T12:00:00').getDay()
    if (diaSemana !== 6 && diaSemana !== 0) {
      mostrarToast('Entregas apenas aos sábados e domingos', 'error')
      return
    }
  }
  // ↑↑↑ FIM DA ADIÇÃO ↑↑↑



  // Validações
  if (!clienteId) { mostrarToast('Selecione o cliente', 'error'); return }
  if (!data)      { mostrarToast('Informe a data de entrega', 'error'); return }
  if (!itensPedido.length) {
    mostrarToast('Adicione pelo menos um item', 'error'); return
  }
  if (itensPedido.some(i => !i.produto_id)) {
    mostrarToast('Selecione o produto em todos os itens', 'error'); return
  }

  const valorTotal = itensPedido.reduce((acc, i) =>
    acc + (i.preco_unitario * i.quantidade), 0)

  const statusPagamento = sinal <= 0 ? 'pendente'
    : sinal >= valorTotal ? 'pago'
    : 'sinal_recebido'

  const dadosPedido = {
    cliente_id:       clienteId,
    data_entrega:     data,
    tipo_entrega:     tipo,
    status,
    valor_total:      valorTotal,
    sinal_pago:       sinal,
    status_pagamento: statusPagamento,
    observacoes:      obs
  }

  let pedidoId = id

  if (id) {
    // Atualiza pedido existente
    const { error } = await supabase
      .from('pedidos').update(dadosPedido).eq('id', id)
    if (error) { mostrarToast('Erro ao atualizar pedido', 'error'); return }

    // Remove itens antigos e reinserindo os atuais
    await supabase.from('itens_pedido').delete().eq('pedido_id', id)
  } else {
    // Cria novo pedido
    const { data: novo, error } = await supabase
      .from('pedidos').insert(dadosPedido).select().single()
    if (error) { mostrarToast('Erro ao criar pedido', 'error'); return }
    pedidoId = novo.id
  }

  // Insere os itens
  const itensParaInserir = itensPedido.map(i => ({
    pedido_id:      pedidoId,
    produto_id:     i.produto_id,
    quantidade:     i.quantidade,
    personalizacao: i.personalizacao,
    preco_unitario: i.preco_unitario
  }))

  const { error: erroItens } = await supabase
    .from('itens_pedido').insert(itensParaInserir)
  if (erroItens) { mostrarToast('Erro ao salvar itens', 'error'); return }

  // Registra pagamento do sinal se houver
  if (!id && sinal > 0) {
    await supabase.from('pagamentos').insert({
      pedido_id: pedidoId,
      valor:     sinal,
      tipo:      sinal >= valorTotal ? 'integral' : 'sinal',
      forma:     'pix'
    })
  }

  mostrarToast(id ? 'Pedido atualizado!' : 'Pedido criado!')
  fecharModal()
  carregarDados()
}


// ===== ENVIAR CONFIRMAÇÃO VIA WHATSAPP / Incluído depois do MVP - FASE 2=====

async function enviarWhatsApp(pedidoId) {
  // Busca o pedido completo com cliente e itens
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      *,
      clientes ( nome, telefone ),
      itens_pedido (
        quantidade, personalizacao, preco_unitario,
        produtos ( nome )
      )
    `)
    .eq('id', pedidoId)
    .single()

  if (!pedido) {
    mostrarToast('Pedido não encontrado', 'error')
    return
  }

  const cliente   = pedido.clientes
  const itens     = pedido.itens_pedido || []
  const saldo     = Number(pedido.valor_total) - Number(pedido.sinal_pago)

  // Formata a data: "2024-12-28" → "28/12/2024"
  const [ano, mes, dia] = pedido.data_entrega.split('-')
  const dataFormatada = `${dia}/${mes}/${ano}`

  // Monta a linha de cada item
  const linhasItens = itens.map(i => {
    const subtotal = Number(i.preco_unitario) * Number(i.quantidade)
    const pers = i.personalizacao ? ` (${i.personalizacao})` : ''
    return `• ${i.quantidade}x ${i.produtos?.nome}${pers} — ${formatarMoeda(subtotal)}`
  }).join('\n')

  // Monta a linha de entrega
  const entrega = pedido.tipo_entrega === 'delivery'
    ? '🛵 Entrega em seu endereço'
    : '🏠 Retirada no local'

  // Monta a linha de pagamento
  const pagamento = pedido.sinal_pago > 0
    ? `💵 Sinal pago: ${formatarMoeda(pedido.sinal_pago)}\n💳 Saldo restante: ${formatarMoeda(saldo)}`
    : `💳 Total a pagar na entrega: ${formatarMoeda(pedido.valor_total)}`

  // Monta a mensagem completa
  const mensagem = `Olá ${cliente.nome.split(' ')[0]}! 😊

Seu pedido foi *confirmado*! Aqui estão os detalhes:

🍫 *Itens:*
${linhasItens}

📅 *Entrega:* ${dataFormatada}
${entrega}

💰 *Total:* ${formatarMoeda(pedido.valor_total)}
${pagamento}

${pedido.observacoes ? `📝 *Obs:* ${pedido.observacoes}\n\n` : ''}Qualquer dúvida é só chamar! 🍬`

  // Limpa o telefone: remove tudo que não for número
  // e garante o código do Brasil (+55)
  const telefone = cliente.telefone.replace(/\D/g, '')
  const telefoneFinal = telefone.startsWith('55')
    ? telefone
    : `55${telefone}`

  // Monta o link do WhatsApp e abre em nova aba
  const url = `https://wa.me/${telefoneFinal}?text=${encodeURIComponent(mensagem)}`
  window.open(url, '_blank')
}


// ===== GERAR RECIBO PDF =====

async function gerarRecibo(pedidoId) {
  // Busca pedido completo com cliente e itens
  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      *,
      clientes ( nome, telefone, endereco ),
      itens_pedido (
        quantidade, personalizacao, preco_unitario,
        produtos ( nome )
      )
    `)
    .eq('id', pedidoId)
    .single()

  if (!pedido) { mostrarToast('Pedido não encontrado', 'error'); return }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // ===== CORES E FONTES =====
  const VERDE    = [29, 107, 79]
  const CINZA    = [107, 114, 128]
  const ESCURO   = [26, 26, 24]
  const BORDA    = [229, 231, 235]
  const FUNDO    = [240, 253, 244]

  const largura  = 210
  const margem   = 20
  const conteudo = largura - (margem * 2)
  let y          = 0

  // ===== HELPER — TEXTO =====
  function texto(txt, x, posY, opts = {}) {
    doc.setFontSize(opts.tamanho || 11)
    doc.setTextColor(...(opts.cor || ESCURO))
    if (opts.negrito) doc.setFont('helvetica', 'bold')
    else              doc.setFont('helvetica', 'normal')
    doc.text(String(txt), x, posY, { align: opts.align || 'left' })
  }

  function moeda(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`
  }

  function formatarData(dataStr) {
    if (!dataStr) return '—'
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  // ===== HEADER VERDE =====
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, largura, 42, 'F')

  texto('🍬 Confeitaria', margem, 16, {
    tamanho: 18, cor: [255,255,255], negrito: true
  })
  texto('Doces e Salgados por Encomenda', margem, 24, {
    tamanho: 10, cor: [200,240,220]
  })

  // Badge "RECIBO"
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(largura - margem - 28, 12, 28, 10, 2, 2, 'F')
  texto('RECIBO', largura - margem - 14, 18.5, {
    tamanho: 9, cor: VERDE, negrito: true, align: 'center'
  })

  y = 52

  // ===== NÚMERO DO PEDIDO E DATA =====
  texto(`Pedido #${pedido.id.substring(0,8).toUpperCase()}`, margem, y, {
    tamanho: 13, negrito: true
  })
  texto(
    `Emitido em: ${new Date().toLocaleDateString('pt-BR')}`,
    largura - margem, y,
    { tamanho: 9, cor: CINZA, align: 'right' }
  )

  y += 6
  doc.setDrawColor(...BORDA)
  doc.setLineWidth(0.3)
  doc.line(margem, y, largura - margem, y)
  y += 10

  // ===== BLOCO CLIENTE + ENTREGA =====
  const metade = conteudo / 2

  // Fundo verde claro
  doc.setFillColor(...FUNDO)
  doc.roundedRect(margem, y - 4, conteudo, 34, 3, 3, 'F')

  // Cliente
  texto('CLIENTE', margem + 4, y + 2, {
    tamanho: 8, cor: VERDE, negrito: true
  })
  texto(pedido.clientes?.nome || '—', margem + 4, y + 9, {
    tamanho: 11, negrito: true
  })
  texto(pedido.clientes?.telefone || '', margem + 4, y + 16, {
    tamanho: 9, cor: CINZA
  })
  if (pedido.clientes?.endereco) {
    texto(pedido.clientes.endereco, margem + 4, y + 22, {
      tamanho: 8, cor: CINZA
    })
  }

  // Entrega
  const xEntrega = margem + metade + 4
  texto('ENTREGA', xEntrega, y + 2, {
    tamanho: 8, cor: VERDE, negrito: true
  })
  texto(`📅 ${formatarData(pedido.data_entrega)}`, xEntrega, y + 9, {
    tamanho: 11, negrito: true
  })
  texto(
    pedido.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retirada',
    xEntrega, y + 16,
    { tamanho: 9, cor: CINZA }
  )

  // Status
  const statusLabels = {
    recebido:    'Recebido',    confirmado:  'Confirmado',
    em_producao: 'Em produção', pronto:      'Pronto',
    entregue:    'Entregue',    cancelado:   'Cancelado'
  }
  texto(
    `Status: ${statusLabels[pedido.status] || pedido.status}`,
    xEntrega, y + 22,
    { tamanho: 9, cor: CINZA }
  )

  y += 42

  // ===== TABELA DE ITENS =====
  texto('ITENS DO PEDIDO', margem, y, {
    tamanho: 9, cor: VERDE, negrito: true
  })
  y += 6

  // Cabeçalho da tabela
  doc.setFillColor(...VERDE)
  doc.rect(margem, y, conteudo, 8, 'F')
  texto('Produto', margem + 3, y + 5.5, {
    tamanho: 9, cor: [255,255,255], negrito: true
  })
  texto('Qtd', margem + conteudo * 0.6, y + 5.5, {
    tamanho: 9, cor: [255,255,255], negrito: true
  })
  texto('Unit.', margem + conteudo * 0.75, y + 5.5, {
    tamanho: 9, cor: [255,255,255], negrito: true
  })
  texto('Total', largura - margem - 3, y + 5.5, {
    tamanho: 9, cor: [255,255,255], negrito: true, align: 'right'
  })
  y += 8

  // Linhas dos itens
  const itens = pedido.itens_pedido || []
  itens.forEach((item, idx) => {
    const subtotal = Number(item.preco_unitario) * Number(item.quantidade)
    const bgColor  = idx % 2 === 0 ? [255,255,255] : [249,249,247]

    doc.setFillColor(...bgColor)
    doc.rect(margem, y, conteudo, item.personalizacao ? 12 : 8, 'F')

    texto(item.produtos?.nome || '—', margem + 3, y + 5.5, {
      tamanho: 10
    })

    if (item.personalizacao) {
      texto(`✏️ ${item.personalizacao}`, margem + 3, y + 10, {
        tamanho: 8, cor: CINZA
      })
    }

    texto(String(item.quantidade), margem + conteudo * 0.6, y + 5.5, {
      tamanho: 10
    })
    texto(moeda(item.preco_unitario), margem + conteudo * 0.75, y + 5.5, {
      tamanho: 10
    })
    texto(moeda(subtotal), largura - margem - 3, y + 5.5, {
      tamanho: 10, negrito: true, align: 'right'
    })

    y += item.personalizacao ? 12 : 8
  })

  // Linha de total
  doc.setFillColor(...VERDE)
  doc.rect(margem, y, conteudo, 10, 'F')
  texto('TOTAL', margem + 3, y + 6.5, {
    tamanho: 11, cor: [255,255,255], negrito: true
  })
  texto(moeda(pedido.valor_total), largura - margem - 3, y + 6.5, {
    tamanho: 13, cor: [255,255,255], negrito: true, align: 'right'
  })
  y += 18

  // ===== PAGAMENTO =====
  doc.setFillColor(...FUNDO)
  doc.roundedRect(margem, y, conteudo, 22, 3, 3, 'F')

  texto('PAGAMENTO', margem + 4, y + 7, {
    tamanho: 8, cor: VERDE, negrito: true
  })

  const saldo = Number(pedido.valor_total) - Number(pedido.sinal_pago)
  texto(
    `Sinal pago: ${moeda(pedido.sinal_pago)}`,
    margem + 4, y + 14,
    { tamanho: 10 }
  )
  texto(
    `Saldo restante: ${moeda(saldo)}`,
    largura - margem - 4, y + 14,
    { tamanho: 10, negrito: saldo > 0, align: 'right' }
  )

  const statusPag = {
    pendente:       '❌ Pagamento pendente',
    sinal_recebido: '⚠️ Sinal recebido',
    pago:           '✅ Pago integralmente'
  }
  texto(
    statusPag[pedido.status_pagamento] || '',
    margem + 4, y + 20,
    { tamanho: 9, cor: CINZA }
  )
  y += 30

  // ===== OBSERVAÇÕES =====
  if (pedido.observacoes) {
    texto('OBSERVAÇÕES', margem, y, {
      tamanho: 8, cor: VERDE, negrito: true
    })
    y += 6
    const linhasObs = doc.splitTextToSize(pedido.observacoes, conteudo)
    doc.setFontSize(9)
    doc.setTextColor(...CINZA)
    doc.text(linhasObs, margem, y)
    y += linhasObs.length * 5 + 6
  }

  // ===== RODAPÉ =====
  const alturaRodape = 297 - 20
  doc.setDrawColor(...BORDA)
  doc.line(margem, alturaRodape - 8, largura - margem, alturaRodape - 8)
  texto(
    '🍬 Confeitaria — Doces e Salgados Artesanais por Encomenda',
    largura / 2, alturaRodape - 3,
    { tamanho: 8, cor: CINZA, align: 'center' }
  )
  texto(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')}`,
    largura / 2, alturaRodape + 2,
    { tamanho: 7, cor: BORDA, align: 'center' }
  )

  // ===== SALVAR PDF =====
  const nomeCliente = (pedido.clientes?.nome || 'cliente')
    .replace(/\s+/g, '_').toLowerCase()
  const dataEntrega = pedido.data_entrega?.replace(/-/g, '') || ''
  doc.save(`recibo_${nomeCliente}_${dataEntrega}.pdf`)

  mostrarToast('Recibo gerado com sucesso!')
}




// ===== EXPOR FUNÇÕES AO HTML =====
window.abrirModal            = abrirModal
window.fecharModal           = fecharModal
window.editarPedido          = editarPedido
window.salvarPedido          = salvarPedido
window.filtrar               = filtrar
window.adicionarItem         = adicionarItem
window.removerItem           = removerItem
window.atualizarItem         = atualizarItem
window.atualizarStatusPagamento = atualizarStatusPagamento
window.verificarCapacidade   = verificarCapacidade
window.enviarWhatsApp = enviarWhatsApp   // Adicionado depois do MVP - FASE 2
window.gerarRecibo = gerarRecibo   // Adicionado depois do MVP - FASE 2

// ===== INICIALIZAR =====
carregarDados()
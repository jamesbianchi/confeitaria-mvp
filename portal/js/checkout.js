// ===== CONEXÃO SUPABASE =====
const { createClient } = window.supabase

const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===== ESTADO =====
let carrinho      = JSON.parse(localStorage.getItem('carrinho') || '[]')
let tipoEntrega   = 'delivery'
let dataSelecionada = null
let sessaoUsuario  = null
let calAno        = new Date().getFullYear()
let calMes        = new Date().getMonth()
let capacidades   = []

// ===== UTILITÁRIOS =====

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0)
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '—'
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

function pad(n) { return String(n).padStart(2, '0') }

function calcularTotal() {
  return carrinho.reduce((acc, i) => acc + i.preco * i.quantidade, 0)
}

function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = `toast ${tipo} show`
  setTimeout(() => t.className = 'toast', 3500)
}

// ===== VERIFICAR SESSÃO =====

async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession()
  const { data: { user } = {} } = await sb.auth.getUser()

  if (!session || !user) {
    if (session) await sb.auth.signOut()
    sessionStorage.setItem('redirect_apos_login', 'checkout.html')
    window.location.href = 'login.html'
    return
  }

  sessaoUsuario = session

  // Pré-preenche endereço do perfil
  const { data: perfil } = await sb
    .from('perfis')
    .select('endereco, nome')
    .eq('id', session.user.id)
    .single()

  if (perfil?.endereco) {
    document.getElementById('endereco-entrega').value = perfil.endereco
  }
}

// ===== TIPO DE ENTREGA =====

function selecionarTipo(tipo) {
  tipoEntrega = tipo
  document.getElementById('card-delivery')
    .classList.toggle('selecionado', tipo === 'delivery')
  document.getElementById('card-retirada')
    .classList.toggle('selecionado', tipo === 'retirada')
  document.getElementById('secao-endereco').style.display =
    tipo === 'delivery' ? 'block' : 'none'
}

// ===== CALENDÁRIO =====

async function carregarCalendario() {
  const inicio = `${calAno}-${pad(calMes + 1)}-01`
  const ultimoDia = new Date(calAno, calMes + 1, 0).getDate()
  const fim = `${calAno}-${pad(calMes + 1)}-${pad(ultimoDia)}`

  // Busca pedidos e capacidades do mês
  const [resPedidos, resCap] = await Promise.all([
    sb.from('pedidos')
      .select('data_entrega')
      .gte('data_entrega', inicio)
      .lte('data_entrega', fim)
      .neq('status', 'cancelado'),
    sb.from('capacidade_dia')
      .select('data, limite_pedidos')
      .gte('data', inicio)
      .lte('data', fim)
  ])

  const pedidosPorDia = {}
  resPedidos.data?.forEach(p => {
    pedidosPorDia[p.data_entrega] = (pedidosPorDia[p.data_entrega] || 0) + 1
  })
  capacidades = resCap.data || []

  renderizarCalendario(pedidosPorDia)
}

function renderizarCalendario(pedidosPorDia = {}) {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  document.getElementById('cal-titulo-checkout').textContent =
    `${meses[calMes]} ${calAno}`

  const hoje       = new Date()
  const diaSemana  = hoje.getDay() // 0=Dom, 1=Seg... 4=Qui, 5=Sex, 6=Sáb
  const horaAtual  = hoje.getHours()

  // ===== REGRA DE NEGÓCIO =====
  // Pedidos aceitos: segunda (1) a quinta (4)
  // Após quinta 18h, sexta, sábado e domingo: sem novos pedidos
  const passouCorte =
    (diaSemana === 4 && horaAtual >= 18) ||
    diaSemana === 5 ||
    diaSemana === 6 ||
    diaSemana === 0

  // Próximo sábado disponível
  const proximoSabado = new Date(hoje)
  const diasAteSab = (6 - diaSemana + 7) % 7 || 7
  proximoSabado.setDate(hoje.getDate() + diasAteSab)

  // Próximo domingo disponível
  const proximoDomingo = new Date(hoje)
  const diasAteDom = (7 - diaSemana) % 7 || 7
  proximoDomingo.setDate(hoje.getDate() + diasAteDom)

  // Se passou do corte, pula para o final de semana seguinte
  const semanaOffset = passouCorte ? 7 : 0
  const sabDisp = new Date(proximoSabado)
  sabDisp.setDate(sabDisp.getDate() + semanaOffset)
  const domDisp = new Date(proximoDomingo)
  domDisp.setDate(domDisp.getDate() + semanaOffset)

  const pad = n => String(n).padStart(2, '0')
  const sabStr = `${sabDisp.getFullYear()}-${pad(sabDisp.getMonth()+1)}-${pad(sabDisp.getDate())}`
  const domStr = `${domDisp.getFullYear()}-${pad(domDisp.getMonth()+1)}-${pad(domDisp.getDate())}`

  const primeiroDia = new Date(calAno, calMes, 1).getDay()
  const totalDias   = new Date(calAno, calMes + 1, 0).getDate()
  const grid        = document.getElementById('cal-grid-checkout')
  grid.innerHTML    = ''

  // Células vazias
  for (let i = 0; i < primeiroDia; i++) {
    const div = document.createElement('div')
    div.className = 'cal-dia vazio'
    grid.appendChild(div)
  }

  // Dias do mês
  for (let dia = 1; dia <= totalDias; dia++) {
    const dataStr  = `${calAno}-${pad(calMes + 1)}-${pad(dia)}`
    const dSemana  = new Date(calAno, calMes, dia).getDay()
    const ehFimSem = dSemana === 6 || dSemana === 0 // só sáb e dom

    const cap      = capacidades.find(c => c.data === dataStr)
    const limite   = cap?.limite_pedidos ?? 3
    const ocupados = pedidosPorDia[dataStr] || 0
    const lotado   = ocupados >= limite

    // Disponível apenas se: é sáb ou dom E está no range liberado
    const disponivel = ehFimSem &&
      (dataStr === sabStr || dataStr === domStr ||
       dataStr > domStr)  &&
      !lotado

    const div = document.createElement('div')
    div.textContent = dia

    if (!ehFimSem) {
      // Dias de semana — apenas visual, não clicável
      div.className = 'cal-dia passado'
      div.title = 'Entregas apenas aos sábados e domingos'
    } else if (lotado) {
      div.className = 'cal-dia bloqueado'
      div.title = 'Data lotada'
    } else if (dataStr < sabStr) {
      div.className = 'cal-dia passado'
      div.title = passouCorte
        ? 'Pedidos encerrados para este final de semana'
        : 'Data indisponível'
    } else if (dataStr === dataSelecionada) {
      div.className = 'cal-dia selecionado'
    } else {
      div.className = 'cal-dia'
      div.style.fontWeight = '600'
      div.style.borderColor = 'var(--cor-secundaria)'
    }

    if (disponivel && dataStr !== dataSelecionada) {
      div.onclick = () => selecionarData(dataStr, dia)
    } else if (disponivel && dataStr === dataSelecionada) {
      div.className = 'cal-dia selecionado'
    }

    grid.appendChild(div)
  }
}

function selecionarData(dataStr, dia) {
  dataSelecionada = dataStr

  // Atualiza visual
  document.querySelectorAll('.cal-dia').forEach(el => {
    if (el.classList.contains('selecionado')) {
      el.classList.remove('selecionado')
      el.classList.add('cal-dia')
    }
  })

  // Re-renderiza para atualizar selecionado
  carregarCalendario()

  const info = document.getElementById('data-selecionada-info')
  info.style.display = 'block'
  info.textContent   = `✅ Data selecionada: ${formatarDataBR(dataStr)}`
}

function mudarMesCheckout(dir) {
  calMes += dir
  if (calMes > 11) { calMes = 0;  calAno++ }
  if (calMes < 0)  { calMes = 11; calAno-- }
  carregarCalendario()
}

// ===== RESUMO =====

function renderizarResumo() {
  const html = carrinho.map(item => `
    <div style="display:flex; justify-content:space-between;
      font-size:13px; margin-bottom:8px">
      <span style="color:var(--cor-texto-leve)">
        ${item.quantidade}x ${item.nome}
        ${item.personalizacao
          ? `<br><span style="font-size:11px">✏️ ${item.personalizacao}</span>`
          : ''}
      </span>
      <span style="font-weight:500">
        ${formatarMoeda(item.preco * item.quantidade)}
      </span>
    </div>
  `).join('')

  const total = formatarMoeda(calcularTotal())

  const resumoEl = document.getElementById('resumo-checkout')
  if (resumoEl) resumoEl.innerHTML = html

  const totalEl = document.getElementById('total-checkout')
  if (totalEl) totalEl.textContent = total
}

// ===== IR PARA CONFIRMAÇÃO =====

function irParaConfirmacao() {
  
  // ===== VALIDA SE ESTÁ NO PERÍODO DE PEDIDOS =====
  const hoje      = new Date()
  const diaSemana = hoje.getDay()
  const hora      = hoje.getHours()

  const foraDoPeriodo =
    (diaSemana === 4 && hora >= 18) ||
    diaSemana === 5 ||
    diaSemana === 6 ||
    diaSemana === 0

  if (foraDoPeriodo) {
    mostrarToast(
      'Pedidos encerrados. Aceitamos de segunda a quinta até 18h.',
      'erro'
    )
    return
  }

  // Validações normais
  if (!dataSelecionada) {
    mostrarToast('Selecione a data de entrega', 'erro')
    return
  }

  if (tipoEntrega === 'delivery') {
    const endereco = document.getElementById('endereco-entrega').value.trim()
    if (!endereco) {
      document.getElementById('erro-endereco').textContent =
        'Informe o endereço de entrega'
      document.getElementById('erro-endereco').classList.add('visivel')
      return
    }
  }

  // Monta revisão
  document.getElementById('revisao-itens').innerHTML = carrinho.map(item => `
    <div style="display:flex; justify-content:space-between;
      padding:10px 0; border-bottom:1px solid var(--cor-borda);
      font-size:14px">
      <div>
        <strong>${item.quantidade}x ${item.nome}</strong>
        ${item.personalizacao
          ? `<br><span style="font-size:12px; color:var(--cor-texto-leve)">
              ✏️ ${item.personalizacao}</span>`
          : ''}
      </div>
      <span style="font-weight:600; color:var(--cor-primaria)">
        ${formatarMoeda(item.preco * item.quantidade)}
      </span>
    </div>
  `).join('')

  const endereco = tipoEntrega === 'delivery'
    ? document.getElementById('endereco-entrega').value.trim()
    : 'Retirada no local'

  document.getElementById('revisao-entrega').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px">
      <div>📅 <strong>Data:</strong> ${formatarDataBR(dataSelecionada)}</div>
      <div>${tipoEntrega === 'delivery' ? '🛵' : '🏠'}
        <strong>Entrega:</strong>
        ${tipoEntrega === 'delivery' ? 'Delivery' : 'Retirada'}
      </div>
      <div>📍 <strong>Endereço:</strong> ${endereco}</div>
      ${document.getElementById('obs-pedido').value.trim()
        ? `<div>📝 <strong>Obs:</strong>
            ${document.getElementById('obs-pedido').value.trim()}</div>`
        : ''}
    </div>
  `

  document.getElementById('total-confirmacao').textContent =
    formatarMoeda(calcularTotal())

  // Troca etapa
  document.getElementById('etapa-entrega').style.display      = 'none'
  document.getElementById('etapa-confirmacao').style.display  = 'block'

  // Atualiza stepper
  document.getElementById('step-2').className = 'step concluido'
  document.getElementById('step-2').querySelector('.step-num').textContent = '✓'
  document.getElementById('step-3').className = 'step ativo'
  document.getElementById('linha-2').className = 'step-linha concluida'

  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function voltarParaEntrega() {
  document.getElementById('etapa-confirmacao').style.display = 'none'
  document.getElementById('etapa-entrega').style.display     = 'block'
  document.getElementById('step-2').className = 'step ativo'
  document.getElementById('step-2').querySelector('.step-num').textContent = '2'
  document.getElementById('step-3').className = 'step'
  document.getElementById('linha-2').className = 'step-linha'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ===== CONFIRMAR PEDIDO =====

async function confirmarPedido() {
  const btn = document.getElementById('btn-confirmar')
  btn.disabled    = true
  btn.textContent = 'Confirmando...'

  try {
    // Busca ou cria cliente vinculado ao usuário
    const userId = sessaoUsuario.user.id
    const { data: perfil } = await sb
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()

    // Verifica se já existe cliente com esse userId
    let clienteId = null
    // Busca cliente pelo telefone — agora sempre preenchido
    const { data: clienteExistente } = await sb
      .from('clientes')
      .select('id')
      .eq('telefone', perfil?.telefone)
      .maybeSingle()

    if (clienteExistente) {
      clienteId = clienteExistente.id
    } else {
     // Cria novo cliente — telefone sempre preenchido
      const { data: novoCliente } = await sb
        .from('clientes')
        .insert({
          nome:     perfil?.nome || sessaoUsuario.user.email,
          telefone: perfil?.telefone,
          endereco: document.getElementById('endereco-entrega')?.value || ''
        })
        .select()
        .single()
      clienteId = novoCliente.id
    }

    const valorTotal = calcularTotal()
    const endereco   = tipoEntrega === 'delivery'
      ? document.getElementById('endereco-entrega').value.trim()
      : ''
    const obs = document.getElementById('obs-pedido').value.trim()

    // Cria o pedido
    const { data: pedido, error: erroPedido } = await sb
      .from('pedidos')
      .insert({
        cliente_id:      clienteId,
        data_entrega:    dataSelecionada,
        tipo_entrega:    tipoEntrega,
        status:          'recebido',
        valor_total:     valorTotal,
        sinal_pago:      0,
        status_pagamento:'pendente',
        observacoes:     obs + (endereco ? `\nEndereço: ${endereco}` : '')
      })
      .select()
      .single()

    if (erroPedido) throw erroPedido

    // Insere os itens
    const itens = carrinho.map(item => ({
      pedido_id:     pedido.id,
      produto_id:    item.id,
      quantidade:    item.quantidade,
      personalizacao:item.personalizacao || '',
      preco_unitario:item.preco
    }))

    const { error: erroItens } = await sb
      .from('itens_pedido')
      .insert(itens)

    if (erroItens) throw erroItens

    // Envia e-mail de confirmação
    try {
      const itensEmail = carrinho.map(item => ({
        nome:          item.nome,
        quantidade:    item.quantidade,
        preco:         item.preco,
        personalizacao:item.personalizacao || ''
      }))

      const resEmail = await fetch(
        'https://fnbyxijurnydkqivklcc.supabase.co/functions/v1/enviar-confirmacao',
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${sessaoUsuario?.access_token || SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            cliente: {
              nome:  sessaoUsuario.user.user_metadata?.nome ||
                     sessaoUsuario.user.email,
              email: sessaoUsuario.user.email
            },
            pedido: {
              data_entrega: dataSelecionada,
              tipo_entrega: tipoEntrega,
              observacoes:  document.getElementById('obs-pedido').value.trim()
            },
            itens: itensEmail
          })
        }
      )

      if (!resEmail.ok) {
        const text = await resEmail.text().catch(() => '')
        console.warn('Aviso: e-mail não enviado', resEmail.status, text)
      }
    } catch (errEmail) {
      // E-mail falhou mas pedido já foi salvo — não bloqueia o fluxo
      console.warn('Aviso: e-mail não enviado', errEmail)
    }

    // Limpa o carrinho
    localStorage.removeItem('carrinho')

    // Mostra sucesso
    document.getElementById('etapa-confirmacao').style.display = 'none'
    document.getElementById('etapa-sucesso').style.display     = 'block'
    document.getElementById('sucesso-msg').textContent =
      `Pedido para ${formatarDataBR(dataSelecionada)} confirmado com sucesso!`

    window.scrollTo({ top: 0, behavior: 'smooth' })

  } catch (err) {
    console.error(err)
    mostrarToast('Erro ao confirmar pedido. Tente novamente.', 'erro')
    btn.disabled    = false
    btn.textContent = 'Confirmar pedido 🎉'
  }
}

// ===== INICIALIZAR =====
async function init() {
  await verificarSessao()

  if (!carrinho.length) {
    window.location.href = 'carrinho.html'
    return
  }

  renderizarResumo()
  await carregarCalendario()
}

init()
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
  
const hoje        = new Date()
  const hojeStr     = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`


  // ===== REGRA DE CORTE: quinta-feira às 18h =====
  // Se hoje é quinta após 18h, sexta ou sábado/domingo,
  // bloqueia TODA a semana atual e libera só a partir de segunda-feira
  const diaSemana   = hoje.getDay() // 0=Dom, 1=Seg... 4=Qui, 5=Sex, 6=Sáb
  const horaAtual   = hoje.getHours()

  // Passou do corte se: é quinta após 18h, ou sexta, ou sábado, ou domingo
  const passouCorte =
    (diaSemana === 4 && horaAtual >= 18) || // quinta >= 18h
    diaSemana === 5 ||                       // sexta
    diaSemana === 6 ||                       // sábado
    diaSemana === 0                          // domingo

  // Calcula o início da próxima semana (segunda-feira)
  const proximaSegunda = new Date(hoje)
  const diasAteSegunda = (8 - diaSemana) % 7 || 7
  proximaSegunda.setDate(hoje.getDate() + diasAteSegunda)

  // Calcula o fim da semana atual (domingo)
  const fimSemanaAtual = new Date(hoje)
  fimSemanaAtual.setDate(hoje.getDate() + (7 - diaSemana))

  // Data mínima: mínimo 2 dias de antecedência
  const minData = new Date(hoje)
  minData.setDate(minData.getDate() + 2)

  // Se passou do corte, data mínima é a próxima segunda
  const dataMinFinal = passouCorte && proximaSegunda > minData
    ? proximaSegunda
    : minData

  const minDataStr = `${dataMinFinal.getFullYear()}-${pad(dataMinFinal.getMonth()+1)}-${pad(dataMinFinal.getDate())}`

  // String do fim da semana atual para bloquear
  const fimSemanaStr = `${fimSemanaAtual.getFullYear()}-${pad(fimSemanaAtual.getMonth()+1)}-${pad(fimSemanaAtual.getDate())}`





    
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
    const cap      = capacidades.find(c => c.data === dataStr)
    const limite   = cap?.limite_pedidos ?? 3
    const ocupados = pedidosPorDia[dataStr] || 0
    const lotado   = ocupados >= limite
// Bloqueia se é passado OU se passou do corte e a data é desta semana
    const passado  = dataStr < minDataStr ||
      (passouCorte && dataStr <= fimSemanaStr)

    const div = document.createElement('div')
    div.textContent = dia

    if (passado)                          div.className = 'cal-dia passado'
    else if (lotado)                      div.className = 'cal-dia bloqueado'
    else if (dataStr === dataSelecionada) div.className = 'cal-dia selecionado'
    else if (dataStr === hojeStr)         div.className = 'cal-dia hoje'
    else                                  div.className = 'cal-dia'

    if (!passado && !lotado) {
      div.onclick = () => selecionarData(dataStr, dia)
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
  // Validações
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
    const { data: clienteExistente } = await sb
      .from('clientes')
      .select('id')
      .eq('telefone', perfil?.telefone || userId)
      .maybeSingle()

    if (clienteExistente) {
      clienteId = clienteExistente.id
    } else {
      // Cria novo cliente
      const { data: novoCliente } = await sb
        .from('clientes')
        .insert({
          nome:     perfil?.nome || sessaoUsuario.user.email,
          telefone: perfil?.telefone || '',
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

      await fetch(
        'https://fnbyxijurnydkqivklcc.supabase.co/functions/v1/bright-endpoint/enviar-confirmacao',
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
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
// ===== CONEXÃO SUPABASE =====
// Supabase já carregado via CDN no HTML — disponível como window.supabase
const { createClient } = window.supabase

const SUPABASE_URL = 'https://fnbyxijurnydkqivklcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_v_ySbIAHjAtvUotTmzrH5g_u6V9BK3q'

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


// ===== UTILITÁRIOS =====

function mostrarToast(msg, tipo = 'sucesso') {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.className = `toast ${tipo} show`
  setTimeout(() => t.className = 'toast', 3500)
}

function mostrarErro(id, msg) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.classList.toggle('visivel', !!msg)
}

function limparErros() {
  document.querySelectorAll('.form-erro').forEach(el => {
    el.textContent = ''
    el.classList.remove('visivel')
  })
}

function setBtnLoading(id, loading, textoOriginal) {
  const btn = document.getElementById(id)
  if (!btn) return
  btn.disabled = loading
  btn.textContent = loading ? 'Aguarde...' : textoOriginal
}

// ===== TROCAR ABA =====

function trocarAba(aba) {
  const isLogin = aba === 'login'
  document.getElementById('form-login').style.display    = isLogin ? 'block' : 'none'
  document.getElementById('form-cadastro').style.display = isLogin ? 'none'  : 'block'
  document.getElementById('aba-login').classList.toggle('aba-ativa', isLogin)
  document.getElementById('aba-cadastro').classList.toggle('aba-ativa', !isLogin)
  limparErros()
}

// ===== LOGIN =====

async function fazerLogin() {
  limparErros()
  const email = document.getElementById('login-email').value.trim()
  const senha = document.getElementById('login-senha').value

  if (!email) { mostrarErro('erro-login-email', 'Informe seu e-mail'); return }
  if (!senha)  { mostrarErro('erro-login-senha', 'Informe sua senha'); return }

  setBtnLoading('btn-login', true, 'Entrar')

  if (!sb || !sb.auth) {
    console.error('Supabase client não está inicializado corretamente', sb)
    mostrarErro('erro-login-senha', 'Erro de inicialização do auth')
    setBtnLoading('btn-login', false, 'Entrar')
    return
  }

  const { error } = await sb.auth.signInWithPassword({ email, password: senha })

  if (error) {
    console.error('Erro no signInWithPassword', error)
    setBtnLoading('btn-login', false, 'Entrar')
    if (error.message.includes('Email not confirmed')) {
      mostrarErro('erro-login-senha', 'E-mail precisa ser confirmado. Verifique sua caixa de entrada.')
    } else {
      mostrarErro('erro-login-senha',
        error.message.includes('Invalid') ? 'E-mail ou senha incorretos' : `Erro ao entrar: ${error.message}`)
    }
    return
  }

  const destino = sessionStorage.getItem('redirect_apos_login') || 'index.html'
  sessionStorage.removeItem('redirect_apos_login')
  window.location.href = destino
}

// ===== CADASTRO =====

async function fazerCadastro() {
  limparErros()
  const nome     = document.getElementById('cad-nome').value.trim()
  const email    = document.getElementById('cad-email').value.trim()
  const telefone = document.getElementById('cad-telefone').value.trim()
  const senha    = document.getElementById('cad-senha').value

  if (!nome)            { mostrarErro('erro-cad-nome',     'Informe seu nome'); return }
  if (!email)           { mostrarErro('erro-cad-email',    'Informe seu e-mail'); return }
  if (!telefone)        { mostrarErro('erro-cad-telefone', 'Informe seu WhatsApp'); return }
  if (senha.length < 6) { mostrarErro('erro-cad-senha',   'Mínimo 6 caracteres'); return }
  
  setBtnLoading('btn-cadastro', true, 'Criar conta')

  const { data, error } = await sb.auth.signUp({ email, password: senha })

  if (error) {
    console.error('Erro no signUp', error)
    setBtnLoading('btn-cadastro', false, 'Criar conta')
    mostrarErro('erro-cad-email',
      error.message.includes('already') ? 'E-mail já cadastrado' : `Erro ao criar conta: ${error.message}`)
    return
  }

  // Cria perfil na tabela perfis
  const userId = data?.user?.id || data?.session?.user?.id
  if (userId) {
    await sb.from('perfis').upsert({ id: userId, nome, telefone })
  }

  if (data?.session) {
    mostrarToast('Conta criada com sucesso! Você já está logado. Redirecionando...')
    const destino = sessionStorage.getItem('redirect_apos_login') || 'index.html'
    sessionStorage.removeItem('redirect_apos_login')
    setTimeout(() => window.location.href = destino, 1200)
    return
  }

  mostrarToast('Conta criada! Verifique seu e-mail para confirmar antes de entrar.')
  setBtnLoading('btn-cadastro', false, 'Criar conta')
  trocarAba('login')
}

async function reenviarConfirmacao() {
  limparErros()
  const email = document.getElementById('login-email').value.trim()
  if (!email) { mostrarErro('erro-login-email', 'Informe seu e-mail primeiro'); return }

  if (!sb.auth?.resendVerificationEmail) {
    mostrarToast('Reenvio não disponível. Verifique o painel do Supabase.', 'erro')
    return
  }

  const { error } = await sb.auth.resendVerificationEmail({ email })
  if (error) {
    console.error('Erro ao reenviar e-mail de confirmação', error)
    mostrarToast(error.message.includes('User not found')
      ? 'Usuário não encontrado para este e-mail' : 'Erro ao reenviar e-mail de confirmação', 'erro')
    return
  }

  mostrarToast('E-mail de confirmação reenviado! Verifique sua caixa de entrada.')
}

// ===== ESQUECI MINHA SENHA =====

async function esqueceuSenha() {
  const email = document.getElementById('login-email').value.trim()
  if (!email) { mostrarErro('erro-login-email', 'Informe seu e-mail primeiro'); return }

  const { error } = await sb.auth.resetPasswordForEmail(email)
  mostrarToast(error ? 'Erro ao enviar e-mail' : 'E-mail de recuperação enviado!',
               error ? 'erro' : 'sucesso')
}

// ===== LOGOUT (chamado por outras páginas) =====

async function fazerLogout() {
  await sb.auth.signOut()
  window.location.href = 'index.html'
}

// ===== VERIFICAR SESSÃO AO CARREGAR =====

async function verificarSessao() {
  const { data: { session }, error: sessionError } = await sb.auth.getSession()
  if (session) {
    const { data: { user }, error: userError } = await sb.auth.getUser()
    if (userError) {
      console.error('Erro ao verificar usuário atual', userError)
    }

    if (!user) {
      // Se a sessão existe no navegador mas o usuário foi removido ou inválido,
      // limpa a sessão local antes de continuar na página de login.
      await sb.auth.signOut()
      return
    }

    const destino = sessionStorage.getItem('redirect_apos_login') || 'index.html'
    sessionStorage.removeItem('redirect_apos_login')
    window.location.href = destino
  }

  // Abre na aba correta se vier com ?aba=cadastro
  const params = new URLSearchParams(window.location.search)
  if (params.get('aba') === 'cadastro') trocarAba('cadastro')
}

verificarSessao()
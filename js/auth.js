/**
 * Belga Hub - Sistema de Autenticação
 * Implementação robusta para login, cadastro e recuperação de senha
 * Integrado com Supabase como backend
 */

// Classe AuthAPI - implementação completa para Supabase
class AuthAPI {
  /**
   * Realiza login com email e senha
   * @param {Object} credentials - Credenciais de login
   * @returns {Promise} - Resultado da autenticação
   */
  static async signIn({ email, password }) {
    try {
      // Implementar o cache para sessão após login bem-sucedido
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Salvar dados não-sensíveis no cache local
      if (data?.user) {
        localStorage.setItem('belgahub_user_cache', JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          timestamp: Date.now(),
          // TTL: 30 minutos
          expiration: Date.now() + (30 * 60 * 1000)
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Realiza cadastro de novo usuário
   * @param {Object} userData - Dados para cadastro
   * @returns {Promise} - Resultado do cadastro
   */
  static async signUp({ email, password, fullName, role, companyName = '', whatsapp = '' }) {
    try {
      // 1. Criar usuário na autenticação
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            company_name: companyName,
            whatsapp: whatsapp
          }
        }
      });
      
      if (error) throw error;
      
      // 2. Criar perfil na tabela profiles 
      if (data?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            role: role,
            company_name: companyName,
            whatsapp: whatsapp
          });
          
        if (profileError) {
          // Tentar reverter o cadastro se falhar ao criar perfil
          try {
            await supabase.auth.admin.deleteUser(data.user.id);
          } catch (deleteError) {
            console.error('Erro ao reverter cadastro:', deleteError);
          }
          throw profileError;
        }
      }
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Realiza logout
   * @returns {Promise} - Resultado do logout
   */
  static async signOut() {
    try {
      // Limpar cache local
      localStorage.removeItem('belgahub_user_cache');
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Verifica sessão atual
   * @returns {Promise} - Dados da sessão
   */
  static async getSession() {
    try {
      // Verificar cache primeiro para performance
      const userCache = localStorage.getItem('belgahub_user_cache');
      if (userCache) {
        const userData = JSON.parse(userCache);
        // Verificar se o cache ainda é válido
        if (userData.expiration > Date.now()) {
          return {
            data: {
              session: {
                user: {
                  id: userData.id,
                  email: userData.email
                }
              }
            }
          };
        }
      }
      
      return await supabase.auth.getSession();
    } catch (error) {
      console.error('Session error:', error);
      return { data: { session: null } };
    }
  }

  /**
   * Obtém dados do usuário atual
   * @returns {Promise} - Dados do usuário
   */
  static async getUser() {
    try {
      return await supabase.auth.getUser();
    } catch (error) {
      console.error('Get user error:', error);
      return { data: { user: null } };
    }
  }

  /**
   * Envia email para recuperação de senha
   * @param {string} email - Email do usuário
   * @returns {Promise} - Resultado do envio
   */
  static async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html',
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Atualiza senha do usuário
   * @param {string} newPassword - Nova senha
   * @returns {Promise} - Resultado da atualização
   */
  static async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  }
}

/**
 * Inicialização do Supabase
 * Verifica se o cliente Supabase está disponível
 */
const initSupabase = () => {
  // Se estiver em ambiente de desenvolvimento ou teste, criar um mock
  if (typeof supabase === 'undefined') {
    console.warn('Supabase não encontrado, usando implementação mock para testes');
    window.supabase = {
      auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'test-user', email: 'test@example.com' } } }),
        signUp: async () => ({ data: { user: { id: 'new-user', email: 'new@example.com' } } }),
        signOut: async () => ({}),
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: null } }),
        resetPasswordForEmail: async () => ({}),
        updateUser: async () => ({})
      },
      from: () => ({
        insert: async () => ({}),
        select: async () => ({}),
        update: async () => ({}),
        delete: async () => ({})
      })
    };
  }
};

// Funções para UI
/**
 * Alterna entre as abas de login, cadastro e recuperação
 * @param {string} tab - Nome da aba a ser exibida
 */
const switchTab = (tab) => {
  // Atualizar estado das abas
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (tab !== 'recovery') {
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  }
  
  // Esconder todos os formulários e mensagens
  document.querySelectorAll('.auth-form, #success-message').forEach(form => {
    form.style.display = 'none';
  });
  
  // Exibir formulário desejado
  document.getElementById(`${tab}-form`).style.display = 'block';
};

/**
 * Exibe uma mensagem de erro no formulário
 * @param {string} inputId - ID do campo com erro
 * @param {string} message - Mensagem de erro
 */
const showError = (inputId, message) => {
  const errorElement = document.getElementById(`${inputId}-error`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = message ? 'block' : 'none';
    const inputElement = document.getElementById(inputId);
    if (inputElement) {
      if (message) {
        inputElement.classList.add('input-error');
      } else {
        inputElement.classList.remove('input-error');
      }
    }
  }
};

/**
 * Valida o formato de um email
 * @param {string} email - Email a ser validado
 * @returns {boolean} - Se o email é válido
 */
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Formata um número de WhatsApp para o formato brasileiro
 * @param {string} number - Número a ser formatado
 * @returns {string} - Número formatado
 */
const formatWhatsApp = (number) => {
  // Remove caracteres não numéricos
  let digits = number.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  return number;
};

/**
 * Configura o mascaramento do campo de WhatsApp
 */
const setupWhatsappMask = () => {
  const whatsappInput = document.getElementById('register-whatsapp');
  if (whatsappInput) {
    whatsappInput.addEventListener('input', (e) => {
      e.target.value = formatWhatsApp(e.target.value);
    });
  }
};

/**
 * Configura o indicador de força de senha
 */
const setupPasswordStrength = () => {
  const registerPassword = document.getElementById('register-password');
  const strengthMeter = document.querySelector('.strength-value');
  const strengthText = document.querySelector('.strength-text');
  
  if (registerPassword && strengthMeter && strengthText) {
    registerPassword.addEventListener('input', () => {
      const password = registerPassword.value;
      let strength = 0;
      let feedback = 'Senha fraca';
      
      if (password.length >= 8) strength += 25;
      if (password.match(/[A-Z]/)) strength += 25;
      if (password.match(/[0-9]/)) strength += 25;
      if (password.match(/[^A-Za-z0-9]/)) strength += 25;
      
      strengthMeter.style.width = `${strength}%`;
      
      if (strength <= 25) {
        strengthMeter.style.backgroundColor = '#ff4d4d';
        feedback = 'Senha fraca';
      } else if (strength <= 50) {
        strengthMeter.style.backgroundColor = '#ffa64d';
        feedback = 'Senha média';
      } else if (strength <= 75) {
        strengthMeter.style.backgroundColor = '#4da6ff';
        feedback = 'Senha boa';
      } else {
        strengthMeter.style.backgroundColor = '#4CAF50';
        feedback = 'Senha forte';
      }
      
      strengthText.textContent = feedback;
    });
  }
};

/**
 * Configura os botões de toggle de visibilidade de senha
 */
const setupPasswordToggles = () => {
  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const passwordInput = e.currentTarget.parentNode.querySelector('input');
      const icon = e.currentTarget.querySelector('i');
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  });
};

/**
 * Configura a navegação entre abas
 */
const setupTabs = () => {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Link "Esqueceu a senha"
  const forgotPasswordLink = document.getElementById('forgot-password');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('recovery');
    });
  }
  
  // Botão voltar na recuperação de senha
  const backToLoginBtn = document.querySelector('.back-to-login');
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
      switchTab('login');
    });
  }
};

/**
 * Configura o formulário de login
 */
const setupLoginForm = () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Limpar erros anteriores
      showError('login-email', '');
      showError('login-password', '');
      
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      let hasErrors = false;
      
      // Validação básica
      if (!email) {
        showError('login-email', 'Informe seu e-mail');
        hasErrors = true;
      } else if (!validateEmail(email)) {
        showError('login-email', 'E-mail inválido');
        hasErrors = true;
      }
      
      if (!password) {
        showError('login-password', 'Informe sua senha');
        hasErrors = true;
      }
      
      if (hasErrors) return;
      
      // Estado de carregamento
      const loginButton = document.getElementById('login-button');
      loginButton.disabled = true;
      loginButton.classList.add('loading');
      
      try {
        await AuthAPI.signIn({ email, password });
        window.location.href = '/index.html';
      } catch (error) {
        let errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';
        
        // Tratar tipos específicos de erro
        if (error.message && error.message.includes('Invalid login credentials')) {
          errorMessage = 'E-mail ou senha incorretos';
          showError('login-password', errorMessage);
        } else if (error.message && error.message.includes('Email not confirmed')) {
          errorMessage = 'E-mail não confirmado. Verifique sua caixa de entrada.';
          showError('login-email', errorMessage);
        } else {
          console.error('Login error:', error);
          alert(errorMessage);
        }
      } finally {
        // Restaurar estado do botão
        loginButton.disabled = false;
        loginButton.classList.remove('loading');
      }
    });
  }
};

/**
 * Configura o formulário de cadastro
 */
const setupRegisterForm = () => {
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Limpar erros anteriores
      showError('register-name', '');
      showError('register-email', '');
      showError('register-password', '');
      showError('register-role', '');
      showError('terms-error', '');
      
      const fullName = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const role = document.getElementById('register-role').value;
      const companyName = document.getElementById('register-company').value;
      const whatsapp = document.getElementById('register-whatsapp').value;
      const termsAgreed = document.getElementById('terms-agree').checked;
      
      let hasErrors = false;
      
      // Validação
      if (!fullName) {
        showError('register-name', 'Informe seu nome completo');
        hasErrors = true;
      }
      
      if (!email) {
        showError('register-email', 'Informe seu e-mail');
        hasErrors = true;
      } else if (!validateEmail(email)) {
        showError('register-email', 'E-mail inválido');
        hasErrors = true;
      }
      
      if (!password) {
        showError('register-password', 'Crie uma senha');
        hasErrors = true;
      } else if (password.length < 8) {
        showError('register-password', ' ');
        hasErrors = true;
      }
      
      if (!role) {
        showError('register-role', 'Selecione seu perfil');
        hasErrors = true;
      }
      
      if (!termsAgreed) {
        showError('terms-error', 'Você precisa concordar com os termos');
        hasErrors = true;
      }
      
      if (hasErrors) return;
      
      // Estado de carregamento
      const registerButton = document.getElementById('register-button');
      registerButton.disabled = true;
      registerButton.classList.add('loading');
      
      try {
        await AuthAPI.signUp({
          email,
          password,
          fullName,
          role,
          companyName,
          whatsapp
        });
        
        // Mostrar mensagem de sucesso
        document.getElementById('success-title').textContent = 'Cadastro realizado com sucesso!';
        document.getElementById('success-text').textContent = 'Enviamos um email de confirmação para seu endereço.';
        
        const successButton = document.getElementById('success-button');
        successButton.textContent = 'Fazer login';
        successButton.onclick = () => switchTab('login');
        
        document.querySelectorAll('.auth-form').forEach(form => {
          form.style.display = 'none';
        });
        document.getElementById('success-message').style.display = 'block';
        
      } catch (error) {
        let errorMessage = 'Erro ao criar conta. Tente novamente.';
        
        // Tratar tipos específicos de erro
        if (error.message && error.message.includes('User already registered')) {
          errorMessage = 'Este e-mail já está cadastrado';
          showError('register-email', errorMessage);
        } else {
          console.error('Registration error:', error);
          alert(errorMessage);
        }
      } finally {
        // Restaurar estado do botão
        registerButton.disabled = false;
        registerButton.classList.remove('loading');
      }
    });
  }
};

// No início do arquivo auth.js ou dentro da função principal/classe
function setupTabsFromUrl() {
  // Verificar se há um parâmetro de URL para a tab
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  
  if (tabParam) {
    // Encontrar todos os botões de tab
    const tabs = document.querySelectorAll('.auth-tab');
    
    // Remover a classe 'active' de todos os botões
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Encontrar o botão com o data-tab correspondente
    const targetTab = document.querySelector(`.auth-tab[data-tab="${tabParam}"]`);
    
    // Se encontrar, ativar essa tab
    if (targetTab) {
      targetTab.classList.add('active');
      
      // Encontrar e exibir o conteúdo da tab correspondente
      const tabContents = document.querySelectorAll('.auth-form');
      tabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      const targetContent = document.getElementById(`${tabParam}-form`);
      if (targetContent) {
        targetContent.style.display = 'block';
      }
    }
  }
}

// Certifique-se que o script executa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
  // Configurar as tabs baseado na URL
  setupTabsFromUrl();
  
  // Configurar alternância de tabs ao clicar (se ainda não estiver implementado)
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Remover active de todas as tabs
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
      });
      
      // Adicionar active à tab clicada
      this.classList.add('active');
      
      // Mostrar o conteúdo correspondente
      const tabName = this.getAttribute('data-tab');
      document.querySelectorAll('.auth-form').forEach(form => {
        form.style.display = 'none';
      });
      
      document.getElementById(`${tabName}-form`).style.display = 'block';
    });
  });
});

/**
 * Configura o formulário de recuperação de senha
 */
const setupRecoveryForm = () => {
  const recoveryForm = document.getElementById('recovery-form');
  if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Limpar erros anteriores
      showError('recovery-email', '');
      
      const email = document.getElementById('recovery-email').value;
      let hasErrors = false;
      
      // Validação
      if (!email) {
        showError('recovery-email', 'Informe seu e-mail');
        hasErrors = true;
      } else if (!validateEmail(email)) {
        showError('recovery-email', 'E-mail inválido');
        hasErrors = true;
      }
      
      if (hasErrors) return;
      
      // Estado de carregamento
      const recoveryButton = document.getElementById('recovery-button');
      recoveryButton.disabled = true;
      recoveryButton.classList.add('loading');
      
      try {
        // Chamar API de recuperação de senha
        await AuthAPI.resetPassword(email);
        
        // Mostrar mensagem de sucesso
        document.getElementById('success-title').textContent = 'Link enviado!';
        document.getElementById('success-text').textContent = 'Verifique seu e-mail para redefinir sua senha.';
        
        const successButton = document.getElementById('success-button');
        successButton.textContent = 'Voltar para login';
        successButton.onclick = () => switchTab('login');
        
        document.querySelectorAll('.auth-form').forEach(form => {
          form.style.display = 'none';
        });
        document.getElementById('success-message').style.display = 'block';
        
      } catch (error) {
        console.error('Password reset error:', error);
        showError('recovery-email', 'Não foi possível enviar o email de recuperação');
      } finally {
        // Restaurar estado do botão
        recoveryButton.disabled = false;
        recoveryButton.classList.remove('loading');
      }
    });
  }
};

/**
 * Configura o login com Google
 */
const setupGoogleLogin = () => {
  const googleButton = document.querySelector('.social-button.google');
  if (googleButton) {
    googleButton.addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/index.html'
          }
        });
        
        if (error) throw error;
      } catch (error) {
        console.error('Google login error:', error);
        alert('Erro ao fazer login com Google. Tente novamente.');
      }
    });
  }
};

/**
 * Verifica se o usuário já está autenticado
 */
const checkAuth = async () => {
  try {
    const { data: session } = await AuthAPI.getSession();
    if (session?.session) {
      window.location.href = '/index.html';
    }
  } catch (error) {
    console.error('Error checking authentication:', error);
  }
};

/**
 * Inicializa todos os componentes do sistema de autenticação
 */
const initAuth = () => {
  // Inicializar Supabase se necessário
  initSupabase();
  
  // Configurar componentes de UI
  setupTabs();
  setupPasswordToggles();
  setupPasswordStrength();
  setupWhatsappMask();
  
  // Configurar formulários
  setupLoginForm();
  setupRegisterForm();
  setupRecoveryForm();
  setupGoogleLogin();
  
  // Verificar autenticação
  checkAuth();
};

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initAuth);

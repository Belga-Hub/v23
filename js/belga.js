/** belga.js
 * Belga Hub - Marketplace de Software B2B e Partnership as a Service
 * JavaScript integrado com Supabase para gerenciamento completo
 */

// Aguardar o Supabase carregar
document.addEventListener('supabase-ready', function() {
  const supabase = window.supabaseClient;

  class BelgaHub {
    constructor() {
      this.supabase = supabase;
      this.user = null;
      this.allSoftwares = [];
      this.filteredSoftwares = [];
      this.allPartnerships = [];
      this.filteredPartnerships = [];
      this.currentSoftwareURL = '';
      this.filtersCollapsed = true;
      this.currentPage = this.detectCurrentPage();
      this.init();
    }

    detectCurrentPage() {
      const path = window.location.pathname;
      if (path.includes('parceiros.html') || path.includes('partnership')) {
        return 'partnerships';
      }
      return 'index';
    }

    async init() {
      console.log('Inicializando BelgaHub, página atual:', this.currentPage);
      await this.checkAuth();
      
      if (this.currentPage === 'partnerships') {
        await this.initPartnershipsPage();
      } else {
        await this.initIndexPage();
      }
      
      this.setupEventListeners();
      this.setupSmartRedirects();
      this.setupFaqAccordion();
      this.setupGlobalNotificationIndicator();
    }

    async initPartnershipsPage() {
      console.log('Inicializando página de parcerias...');
      await this.loadPartnerships();
      // Aguardar renderização antes de configurar filtros
      setTimeout(() => {
        this.setupPartnershipFilters();
        console.log('Filtros de parceria configurados');
      }, 100);
    }

    async initIndexPage() {
      await this.loadInitialData();
      this.setupFilterState();
    }

    async checkAuth() {
      try {
        const { data: user } = await this.supabase.auth.getUser();
        this.user = user?.user || null;
        this.updateAuthUI();
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      }
    }

    updateAuthUI() {
      const loginBtn = document.querySelector('.cta-button');
      const signupBtn = document.querySelector('.cta-button2');

      if (this.user) {
        if (loginBtn) {
          loginBtn.textContent = 'Perfil';
          loginBtn.href = '/perfil.html';
        }
        if (signupBtn) {
          signupBtn.textContent = 'Logout';
          signupBtn.href = '#';
          signupBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.handleLogout();
          });
        }
        
        // Verificar notificações não lidas
        this.checkUnreadNotifications();
      }
    }

    // Novo método para verificar notificações não lidas e mostrar indicador global
    async checkUnreadNotifications() {
      if (!this.user) return;
      
      try {
        const { data: notifications, error } = await this.supabase
          .from('notifications')
          .select('id')
          .eq('user_id', this.user.id)
          .eq('read', false)
          .limit(1);
          
        if (error) throw error;
        
        // Se houver pelo menos uma notificação não lida, mostrar indicador
        if (notifications && notifications.length > 0) {
          this.showGlobalNotificationIndicator();
        } else {
          this.hideGlobalNotificationIndicator();
        }
      } catch (error) {
        console.error('Erro ao verificar notificações não lidas:', error);
      }
    }
    
    // Método para configurar o indicador global de notificação
    setupGlobalNotificationIndicator() {
      // Verificar se o indicador já existe
      if (!document.getElementById('global-notification-indicator')) {
        // Criar indicador e adicionar ao DOM
        const indicator = document.createElement('div');
        indicator.id = 'global-notification-indicator';
        indicator.className = 'notification-indicator';
        indicator.style.display = 'none';
        
        // Adicionar ao botão de perfil (último botão no header)
        const perfilBtn = document.querySelector('.cta-button');
        if (perfilBtn) {
          perfilBtn.style.position = 'relative';
          perfilBtn.appendChild(indicator);
        }
      }
    }
    
    // Método para mostrar o indicador global de notificação
    showGlobalNotificationIndicator() {
      const indicator = document.getElementById('global-notification-indicator');
      if (indicator) {
        indicator.style.display = 'block';
      }
    }
    
    // Método para esconder o indicador global de notificação
    hideGlobalNotificationIndicator() {
      const indicator = document.getElementById('global-notification-indicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    }

    setupSmartRedirects() {
      // Todos os botões que precisam de redirecionamento inteligente
      const smartButtons = [
        { id: 'submit-software-btn', loggedInUrl: 'perfil.html', loggedOutUrl: 'login.html' },
        { id: 'submit-software-btn2', loggedInUrl: 'perfil.html', loggedOutUrl: 'login.html' },
        { id: 'submit-software-btn3', loggedInUrl: 'perfil.html', loggedOutUrl: 'login.html' },
        { id: 'submit-software-btn4', loggedInUrl: 'perfil.html#partnerships-tab', loggedOutUrl: 'login.html' },
        { id: 'submit-software-btn5', loggedInUrl: 'parceiros.html#partners-title', loggedOutUrl: 'parceiros.html#partners-title' },
        // Adicione outros botões aqui seguindo o mesmo formato
      ];
      
      // Configurar cada botão
      smartButtons.forEach(button => {
        const element = document.getElementById(button.id);
        if (element) {
          if (this.user) {
            element.href = button.loggedInUrl;
          } else {
            element.href = button.loggedOutUrl;
          }
          
          // Adicionar event listener como fallback de segurança
          element.addEventListener('click', (e) => {
            if (this.user) {
              window.location.href = button.loggedInUrl;
            } else {
              window.location.href = button.loggedOutUrl;
            }
          });
        }
      });
    }

    setupFaqAccordion() {
      const faqQuestions = document.querySelectorAll('.faq-question');
      
      if (faqQuestions.length === 0) return;
      
      console.log('Configurando acordeão de FAQ:', faqQuestions.length, 'perguntas encontradas');
      
      // Inicialmente, definir altura 0 para todas as respostas
      const answers = document.querySelectorAll('.faq-answer');
      answers.forEach(answer => {
        answer.style.height = '0px';
        answer.style.transition = 'height 0.3s ease-in-out, opacity 0.3s ease-in-out';
        answer.style.opacity = '0';
        answer.style.overflow = 'hidden';
      });
      
      faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
          // Toggle active class no botão
          question.classList.toggle('active');
          
          // Referência à resposta
          const answer = question.nextElementSibling;
          
          // Fechar outras respostas
          faqQuestions.forEach(otherQuestion => {
            if (otherQuestion !== question) {
              otherQuestion.classList.remove('active');
              const otherAnswer = otherQuestion.nextElementSibling;
              otherAnswer.style.height = '0px';
              otherAnswer.style.opacity = '0';
            }
          });
          
          // Animar altura dinamicamente
          if (question.classList.contains('active')) {
            // Calcular altura real
            answer.style.height = 'auto';
            answer.style.opacity = '1';
            const height = answer.scrollHeight;
            answer.style.height = '0px';
            
            // Forçar reflow
            void answer.offsetHeight;
            
            // Animar para altura calculada
            answer.style.height = height + 'px';
            answer.style.opacity = '1';
          } else {
            // Fechar
            answer.style.height = '0px';
            answer.style.opacity = '0';
          }
        });
      });
    }

    async handleLogout() {
      try {
        await this.supabase.auth.signOut();
        window.location.reload();
      } catch (error) {
        console.error('Erro no logout:', error);
      }
    }

    async loadInitialData() {
      try {
        await this.loadSoftwares();
        await this.loadCategories();
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    }

    async loadSoftwares() {
      try {
        const { data: softwares, error } = await this.supabase
          .from('softwares')
          .select(`
            *,
            software_categories(
              categories(name, slug, icon)
            ),
            reviews(rating),
            votes(type)
          `)
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Pré-processar dados para adicionar campos de filtragem padrão se não existirem
        this.allSoftwares = softwares.map(software => {
          // Configurar valores padrão
          if (software.pricing && !software.price_range) {
            software.price_range = this.getPriceRange(software.pricing);
          }
          
          // Determinar tipos de disponibilidade baseados no pricing
          if (software.pricing && !software.subscription_available) {
            software.subscription_available = software.pricing.toLowerCase().includes('mês') || 
                                            software.pricing.toLowerCase().includes('mensal');
          }
          
          if (!software.purchase_available) {
            // Assume disponível para compra por padrão se não for especificado
            software.purchase_available = true;
          }
          
          return software;
        });
        
        this.filteredSoftwares = [...this.allSoftwares];
        this.renderSoftwares();
      } catch (error) {
        console.error('Erro ao carregar softwares:', error);
        this.renderFallbackSoftwares();
      }
    }

    async loadCategories() {
      try {
        const { data: categories, error } = await this.supabase
          .from('categories')
          .select('*')
          .order('name');

        if (error) throw error;

        this.renderCategoryPills(categories || []);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
      }
    }

    // PARTNERSHIP SPECIFIC METHODS
    async loadPartnerships() {
      try {
        console.log('Tentando carregar parcerias do Supabase...');
        
        // Tentar carregar do Supabase (sem JOIN com profiles)
        const { data: partnerships, error } = await this.supabase
          .from('partnerships')
          .select('*')
          .eq('active', true)
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }

        if (partnerships && partnerships.length > 0) {
          console.log('Parcerias carregadas do Supabase:', partnerships.length);
          this.allPartnerships = partnerships;
        } else {
          console.log('Nenhuma parceria encontrada, usando fallback');
          this.loadPartnershipsFallback();
        }

        this.filteredPartnerships = [...this.allPartnerships];
        this.renderPartnerships();
      } catch (error) {
        console.error('Erro ao carregar parcerias:', error);
        this.loadPartnershipsFallback();
      }
    }

    loadPartnershipsFallback() {
      console.log('Carregando parcerias estáticas (fallback)');
      // Dados estáticos que correspondem aos filtros
      this.allPartnerships = [
        {
          id: 1,
          type: 'revenda',
          name: 'Programa de Parcerias FinanControl',
          description: 'Procuramos parceiros para revender nossa solução financeira FinanControl. Oferecemos comissões atrativas e suporte técnico dedicado.',
          commission: '25% recorrente',
          training: 'Treinamento completo fornecido',
          support: 'Suporte técnico prioritário',
          partnership_type: 'Busco revendedores',
          featured: true,
          active: true,
          company_name: 'FinanControl Sistemas'
        },
        {
          id: 2,
          type: 'implementacao',
          name: 'Consultoria em ERP BrasilSoft',
          description: 'Empresa especializada em implementação de ERP busca parceiros desenvolvedores de software de gestão para complementar portfólio.',
          commission: '15% por projeto',
          experience: '+50 implementações',
          focus: 'Médias empresas',
          partnership_type: 'Quero implementar',
          featured: false,
          active: true,
          company_name: 'BrasilSoft Consultoria'
        },
        {
          id: 3,
          type: 'leads',
          name: 'Geração de Leads - Marketing Digital',
          description: 'Agência de marketing digital oferece geração qualificada de leads para softwares B2B com foco em PMEs brasileiras.',
          commission: 'R$ 200 por lead qualificado',
          volume: '50+ leads/mês',
          conversion: '8% taxa de conversão média',
          partnership_type: 'Gero leads',
          featured: false,
          active: true,
          company_name: 'LeadGen Digital'
        },
        {
          id: 4,
          type: 'revenda',
          name: 'Rede de Revendedores - TechSolution',
          description: 'Procuramos revendedores experientes para ampliar nossa rede de distribuição nacional de soluções em TI.',
          commission: '30% de margem',
          territory: 'Nacional',
          support: 'Kit de marketing incluído',
          partnership_type: 'Busco revendedores',
          featured: false,
          active: true,
          company_name: 'TechSolution Brasil'
        }
      ];

      this.filteredPartnerships = [...this.allPartnerships];
      this.renderPartnerships();
    }

    setupPartnershipFilters() {
      const partnershipCategories = document.getElementById('partnership-categories');
      if (!partnershipCategories) {
        console.error('Elemento partnership-categories não encontrado');
        return;
      }

      const categoryPills = partnershipCategories.querySelectorAll('.category-pill');
      console.log('Configurando filtros. Pills encontradas:', categoryPills.length);
      
      // Remover todos os event listeners existentes clonando elementos
      categoryPills.forEach(pill => {
        const newPill = pill.cloneNode(true);
        pill.parentNode.replaceChild(newPill, pill);
      });

      // Reselecionar após clonagem e adicionar novos listeners
      const newCategoryPills = partnershipCategories.querySelectorAll('.category-pill');
      newCategoryPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          const selectedCategory = pill.getAttribute('data-category');
          console.log('Filtro clicado:', selectedCategory);
          
          // Atualizar visual dos filtros
          newCategoryPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          
          // Filtrar parcerias
          this.filterPartnershipsByCategory(selectedCategory);
        });
      });

      console.log('Event listeners configurados para', newCategoryPills.length, 'pills');
    }

    filterPartnershipsByCategory(category) {
      console.log('Filtrando parcerias...');
      console.log('Categoria selecionada:', category);
      console.log('Total de parcerias disponíveis:', this.allPartnerships.length);
      
      if (category === 'all') {
        this.filteredPartnerships = [...this.allPartnerships];
      } else {
        this.filteredPartnerships = this.allPartnerships.filter(partnership => {
          const matches = partnership.type === category;
          console.log(`Parceria "${partnership.name}" (${partnership.type}) ${matches ? 'INCLUÍDA' : 'EXCLUÍDA'}`);
          return matches;
        });
      }

      console.log('Parcerias após filtro:', this.filteredPartnerships.length);
      this.renderPartnerships();

      if (this.filteredPartnerships.length === 0) {
        this.showNoPartnershipsResults('Não há parcerias disponíveis nesta categoria atualmente');
      }
    }

    renderPartnerships() {
      const partnershipsContainer = document.querySelector('.partnership-cards');
      if (!partnershipsContainer) {
        console.error('Container de parcerias não encontrado');
        return;
      }

      console.log('Renderizando', this.filteredPartnerships.length, 'parcerias');
      partnershipsContainer.innerHTML = '';

      if (this.filteredPartnerships.length === 0) {
        this.showNoPartnershipsResults('Nenhuma parceria encontrada');
        return;
      }

      this.filteredPartnerships.forEach(partnership => {
        const card = this.createPartnershipCard(partnership);
        partnershipsContainer.appendChild(card);
      });

      // Configurar event listeners para os cards criados
      this.attachPartnershipListeners();
    }

    createPartnershipCard(partnership) {
  const card = document.createElement('div');
  card.className = 'partnership-card';
  card.dataset.partnershipId = partnership.id;

  // Mapeamento de tipos de parceria para nomes amigáveis
  const partnershipTypeNames = {
    'lead_generation': 'Geração de Leads',
    'implementation': 'Implementação',
    'resell': 'Revenda',
    // Manter compatibilidade com dados antigos
    'revenda': 'Revenda',
    'implementacao': 'Implementação',
    'leads': 'Geração de Leads'
  };

  // Tipo formatado para exibição
  const displayType = partnershipTypeNames[partnership.type] || partnership.type;
  
  // Tipo de parceria para o cabeçalho (busco revendedores, sou implementador, etc.)
  const partnershipRoleText = partnership.partnership_type || 
    (partnership.type === 'resell' || partnership.type === 'revenda' ? 'Busco revendedores' : 
     partnership.type === 'implementation' || partnership.type === 'implementacao' ? 'Busco implementadores' : 
     'Busco parceiros');

  // Criar seção de metadados padronizada com todos os campos disponíveis
  let metaItems = '';
  
  // Adicionar comissão (sempre mostrar se disponível)
  if (partnership.commission_rate || partnership.commission) {
    metaItems += `
      <div class="partnership-meta-item">
        <i class="fas fa-percentage partnership-meta-icon"></i>
        <span>Comissão: ${partnership.commission_rate || partnership.commission}${partnership.commission_rate ? '%' : ''}</span>
      </div>`;
  }
  
  // Adicionar treinamento (se disponível)
  if (partnership.training_provided === true || partnership.training) {
    metaItems += `
      <div class="partnership-meta-item">
        <i class="fas fa-graduation-cap partnership-meta-icon"></i>
        <span>${partnership.training || 'Treinamento dedicado'}</span>
      </div>`;
  }
  
  // Adicionar suporte (se disponível)
  if (partnership.support_provided === true || partnership.support) {
    metaItems += `
      <div class="partnership-meta-item">
        <i class="fas fa-headset partnership-meta-icon"></i>
        <span>${partnership.support || 'Suporte para parceiros'}</span>
      </div>`;
  }

  // Badge de destaque se for featured
  const featuredBadge = partnership.featured 
    ? '<div class="partnership-featured-badge"></div>' 
    : '';

  // NOVA IMPLEMENTAÇÃO: Determinar nome da empresa baseado no login
  let companyNameDisplay;
  let companyIconClass = "fas fa-building";
  
  if (this.user) {
    // Usuário logado: mostrar o nome real da empresa
    companyNameDisplay = partnership.company_name || 
                      (partnership.profiles && partnership.profiles.company_name) || 
                      "Empresa não especificada";
  } else {
    // Usuário não logado: mostrar mensagem para fazer login
    companyNameDisplay = "Faça login para visualizar a empresa";
    companyIconClass = "fas fa-lock"; // Ícone de cadeado
  }

  // NOVA IMPLEMENTAÇÃO: URL do WhatsApp ou login baseado no status de autenticação
  const whatsAppUrl = this.user 
    ? "https://wa.me/5511986059310?text=Ol%C3%A1%2C%20vi%20no%20Belga%20Hub%20sua%20publica%C3%A7%C3%A3o%20sobre%20uma%20potencial%20parceria%20e%20gostaria%20de%20tirar%20d%C3%BAvidas%20antes%20de%20me%20aplicar"
    : "login.html";
  
  // NOVA IMPLEMENTAÇÃO: Ícone do WhatsApp baseado no status de autenticação
  const whatsAppIcon = this.user ? "fab fa-whatsapp" : "fas fa-lock";
  
  // NOVA IMPLEMENTAÇÃO: Target do link de WhatsApp
  const whatsAppTarget = this.user ? "_blank" : "_self";

  card.innerHTML = `
    ${featuredBadge}
    <div class="partnership-card-header">
      <div class="partnership-type">${partnershipRoleText}</div>
      <h3 class="partnership-name">${partnership.name}</h3>
    </div>
    <div class="partnership-card-content">
      <div class="partnership-tag">${displayType}</div>
      <p class="partnership-description">${partnership.description}</p>
      <div class="partnership-meta">
        ${metaItems}
      </div>
    </div>
    <div class="partnership-card-company">
      <i class="${companyIconClass} partnership-company-icon"></i>
      <span>${companyNameDisplay}</span>
    </div>
    <div class="partnership-card-footer">
      <button class="contact-partner" data-partnership-id="${partnership.id}">
        Quero ser parceiro
      </button>
      <a href="${whatsAppUrl}" 
         target="${whatsAppTarget}" 
         class="contact-whatsapp">
        <i class="${whatsAppIcon}"></i> ${this.user ? 'WhatsApp' : 'WhatsApp'}
      </a>
    </div>
  `;

  return card;
}

    showNoPartnershipsResults(message) {
      const partnershipsContainer = document.querySelector('.partnership-cards');
      if (!partnershipsContainer) return;

      partnershipsContainer.innerHTML = `
        <div class="no-results-message" style="text-align: center; width: 100%; padding: 40px 0;">
          <i class="fas fa-handshake" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
          <h3 style="margin-bottom: 10px; color: #333;">${message}</h3>
          <p style="color: #666;">Tente selecionar uma categoria diferente.</p>
        </div>
      `;
    }

    // SOFTWARE SPECIFIC METHODS (modificados para melhor UX)
    renderCategoryPills(categories) {
      const categoriesContainer = document.getElementById('categories');
      if (!categoriesContainer) return;

      // Manter o "Todos" e adicionar categorias do Supabase
      const allPill = categoriesContainer.querySelector('[data-category="all"]');
      
      // Remover pills existentes exceto "Todos"
      const existingPills = categoriesContainer.querySelectorAll('.category-pill:not([data-category="all"])');
      existingPills.forEach(pill => pill.remove());

      // Adicionar novas categorias
      categories.forEach(category => {
        const pill = document.createElement('span');
        pill.className = 'category-pill';
        pill.setAttribute('data-category', category.slug);
        pill.textContent = category.name;
        categoriesContainer.appendChild(pill);
      });

      // Reattach event listeners para as novas pills
      this.attachCategoryListeners();
    }

    renderSoftwares() {
      const softwareGrid = document.getElementById('software-grid');
      if (!softwareGrid) return;

      softwareGrid.innerHTML = '';

      if (this.filteredSoftwares.length === 0) {
        this.showNoResults('Nenhum software encontrado');
        return;
      }

      this.filteredSoftwares.forEach(software => {
        const card = this.createSoftwareCard(software);
        softwareGrid.appendChild(card);
      });

      // Attach event listeners para os novos cards
      this.attachSoftwareListeners();
    }

    // NOVA IMPLEMENTAÇÃO DO createSoftwareCard
    createSoftwareCard(software) {
      const card = document.createElement('div');
      card.className = 'software-card';
      card.dataset.softwareId = software.id;

      // Calcular estatísticas
      const reviews = software.reviews || [];
      const votes = software.votes || [];
      const ratings = reviews.map(r => r.rating).filter(Boolean);
      const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;
      const upvotes = votes.filter(v => v.type === 'upvote').length;
      const downvotes = votes.filter(v => v.type === 'downvote').length;

      // Badge de parceria
      const partnershipBadge = software.partnership_available 
        ? '<div class="partnership-badge">Programa de Parceiros</div>' 
        : '';

      // Categorias para data attributes
      const categories = software.software_categories
        .map(sc => sc.categories.slug)
        .join(' ');

      // Imagem do software (usar imagem padrão baseada no tipo se não houver URL)
      const softwareType = software.software_categories.length > 0 ? software.software_categories[0].categories.slug : 'default';
      const imageUrl = software.image_url || 
                      `/images/${softwareType}-default.png` || 
                      '/images/default-software.png';

      // Stars display
      const stars = '★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));

      card.innerHTML = `
        ${partnershipBadge}
        <div class="software-card-image">
          <img src="${imageUrl}" alt="${software.name}" onerror="this.src='/images/default-software.png'">
        </div>
        <div class="software-card-content">
          <h3 class="software-name">${software.name}</h3>
          <p class="software-company">${software.company || 'Empresa não especificada'}</p>
          <p class="software-description">${software.description}</p>
          <div class="software-meta">
            <span class="software-category">${software.software_categories[0]?.categories.name || 'Software'}</span>
            <div class="software-rating">
              <span class="rating-stars">${stars}</span>
              <span class="rating-count">(${ratings.length})</span>
            </div>
          </div>
          <p class="software-pricing">${software.pricing}</p>
          <div class="software-card-footer">
            <a href="#" class="view-details" data-slug="${software.slug}">Ver detalhes</a>
            <div class="vote-buttons">
              <button class="vote-button upvote" data-type="upvote">
                <i class="fa fa-thumbs-up"></i>
                <span class="vote-count">${upvotes}</span>
              </button>
              <button class="vote-button downvote" data-type="downvote">
                <i class="fa fa-thumbs-down"></i>
                <span class="vote-count">${downvotes}</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Adicionar data attributes para filtros
      card.setAttribute('data-category', categories);
      card.setAttribute('data-partnership', software.partnership_available ? 'sim' : 'nao');

      // Adicionar dados adicionais como atributos de dados para os filtros
      if (software.company_size) {
        card.setAttribute('data-company-size', Array.isArray(software.company_size) ? 
          software.company_size.join(' ') : software.company_size);
      }
      
      if (software.problems) {
        card.setAttribute('data-problem', Array.isArray(software.problems) ? 
          software.problems.join(' ') : software.problems);
      }
      
      const priceValue = this.getPriceRange(software.pricing);
      if (priceValue) {
        card.setAttribute('data-price', priceValue);
      }

      return card;
    }

    // Adicionar o método auxiliar para determinar a faixa de preço
    getPriceRange(pricing) {
      if (!pricing) return '';
      const priceText = pricing.toLowerCase();
      
      if (priceText.includes('grátis') || priceText.includes('gratuito')) {
        return 'free';
      } else if (priceText.includes('até r$ 100') || (priceText.match(/r\$\s*\d+/) && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) <= 100)) {
        return 'ate-100';
      } else if (priceText.includes('r$ 100') || priceText.includes('r$ 300') || 
                (priceText.match(/r\$\s*\d+/) && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) > 100 && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) <= 300)) {
        return '100-300';
      } else if (priceText.includes('r$ 300') || priceText.includes('r$ 1000') ||
                (priceText.match(/r\$\s*\d+/) && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) > 300 && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) <= 1000)) {
        return '300-1000';
      } else if (priceText.includes('acima') || 
                (priceText.match(/r\$\s*\d+/) && parseFloat(priceText.match(/r\$\s*(\d+)/)[1]) > 1000)) {
        return 'acima-1000';
      }
      
      return '';
    }

    renderFallbackSoftwares() {
      // Usar os softwares estáticos do HTML existente como fallback
      const existingCards = document.querySelectorAll('.software-card');
      this.filteredSoftwares = Array.from(existingCards);
    }

    showNoResults(message) {
      const softwareGrid = document.getElementById('software-grid');
      if (!softwareGrid) return;

      const existingMessage = softwareGrid.querySelector('.no-results-message');
      if (existingMessage) {
        softwareGrid.removeChild(existingMessage);
      }

      const noResultsMessage = document.createElement('div');
      noResultsMessage.className = 'no-results-message';
      noResultsMessage.style.textAlign = 'center';
      noResultsMessage.style.width = '100%';
      noResultsMessage.style.padding = '40px 0';
      noResultsMessage.style.gridColumn = '1 / -1';
      noResultsMessage.innerHTML = `
        <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
        <h3 style="margin-bottom: 10px; color: #333;">${message}</h3>
        <p style="color: #666;">Tente ajustar os filtros para ampliar sua busca.</p>
      `;

      softwareGrid.appendChild(noResultsMessage);
    }

    setupEventListeners() {
      if (this.currentPage === 'partnerships') {
        // Na página de parcerias, configuramos filtros depois do carregamento
        console.log('Event listeners configurados para página de parcerias');
      } else {
        this.setupFilterListeners();
        this.setupSearchListeners();
        this.attachCategoryListeners();
        this.setupModalListeners();
      }
      
      // Setup global dos listeners de parceria (para ambas as páginas)
      this.attachPartnershipListeners();
    }

    setupFilterState() {
      // Aplicar estado inicial dos filtros
      const filtersToggle = document.getElementById('filters-toggle');
      const filtersContent = document.getElementById('filters-content');
      
      if (filtersToggle && filtersContent) {
        // Configurar transição e overflow
        filtersContent.style.transition = 'height 0.3s ease-in-out, opacity 0.3s ease-in-out';
        filtersContent.style.overflow = 'hidden';
        
        // Definir estado inicial como colapsado
        this.filtersCollapsed = true;
        filtersToggle.innerHTML = '<span><i class="fas fa-filter"></i></span> Mostrar filtros';
        
        // Inicialmente oculto
        filtersContent.style.height = '0px';
        filtersContent.style.opacity = '0';
      }
    }

    setupFilterListeners() {
      const filtersToggle = document.getElementById('filters-toggle');
      const applyFiltersBtn = document.getElementById('apply-filters');

      if (filtersToggle) {
        filtersToggle.addEventListener('click', () => this.toggleFilters());
      }

      if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => this.applyFilters());
      }
    }

    toggleFilters() {
      this.filtersCollapsed = !this.filtersCollapsed;
      const filtersToggle = document.getElementById('filters-toggle');
      const filtersContent = document.getElementById('filters-content');

      if (filtersToggle && filtersContent) {
        if (this.filtersCollapsed) {
          // Fechar os filtros com animação
          const currentHeight = filtersContent.scrollHeight;
          filtersContent.style.height = currentHeight + 'px';
          filtersContent.style.opacity = '1';
          
          // Forçar reflow
          void filtersContent.offsetHeight;
          
          // Animar para fechado
          filtersContent.style.height = '0px';
          filtersContent.style.opacity = '0';
          
          // Atualizar texto do botão após a animação
          setTimeout(() => {
            filtersToggle.innerHTML = '<span><i class="fas fa-filter"></i></span> Mostrar filtros';
          }, 300); // Mesmo tempo da transição
        } else {
          // Abrir os filtros com animação
          // Configurar para medição
          filtersContent.style.height = 'auto';
          filtersContent.style.opacity = '1';
          const targetHeight = filtersContent.scrollHeight;
          
          // Redefinir para animação
          filtersContent.style.height = '0px';
          
          // Forçar reflow
          void filtersContent.offsetHeight;
          
          // Animar para aberto
          filtersContent.style.height = targetHeight + 'px';
          filtersContent.style.opacity = '1';
          filtersToggle.innerHTML = '<span><i class="fas fa-filter"></i></span> Ocultar filtros';
          
          // Limpeza após a animação
          setTimeout(() => {
            filtersContent.style.height = 'auto'; // Permitir redimensionamento
          }, 300); // Mesmo tempo da transição
        }
      }
    }

    applyFilters() {
      const categoryFilter = document.getElementById('category-filter')?.value || 'all';
      const companySizeFilter = document.getElementById('company-size-filter')?.value || 'all';
      const problemFilter = document.getElementById('problem-filter')?.value || 'all';
      const priceFilter = document.getElementById('price-filter')?.value || 'all';
      const partnershipFilter = document.getElementById('partnership-filter')?.value || 'all';

      this.filterSoftwaresBy({
        category: categoryFilter,
        companySize: companySizeFilter,
        problem: problemFilter,
        price: priceFilter,
        partnership: partnershipFilter
      });
    }

    filterSoftwaresBy(filters) {
      console.log('Aplicando filtros:', filters);
      
      this.filteredSoftwares = this.allSoftwares.filter(software => {
        // Filtro de categoria
        if (filters.category !== 'all') {
          const categories = software.software_categories.map(sc => sc.categories.slug);
          if (!categories.includes(filters.category)) {
            return false;
          }
        }

        // Filtro de tamanho de empresa
        if (filters.companySize !== 'all') {
          // Verifica se o software tem a propriedade company_size
          if (!software.company_size) return true; // Não filtrar se não tiver o dado
          
          // Processar o company_size que pode ser string ou array
          const sizes = Array.isArray(software.company_size) ? 
            software.company_size : software.company_size.split(' ');
          
          if (!sizes.includes(filters.companySize)) {
            return false;
          }
        }

        // Filtro de problema resolvido
        if (filters.problem !== 'all') {
          // Verifica se o software tem a propriedade problems
          if (!software.problems) return true; // Não filtrar se não tiver o dado
          
          // Processar o problems que pode ser string ou array
          const problems = Array.isArray(software.problems) ? 
            software.problems : software.problems.split(' ');
          
          if (!problems.includes(filters.problem)) {
            return false;
          }
        }

        // Filtro de preço
        if (filters.price !== 'all') {
          const priceRange = this.getPriceRange(software.pricing);
          if (priceRange !== filters.price) {
            return false;
          }
        }

        // Filtro de parceria
        if (filters.partnership !== 'all') {
          // Verificar se o filtro corresponde ao tipo de disponibilidade
          if (filters.partnership === 'parceiros' && !software.partnership_available) {
            return false;
          } else if (filters.partnership === 'compra' && !software.purchase_available) {
            return false;
          } else if (filters.partnership === 'assinatura' && !software.subscription_available) {
            return false;
          }
        }

        return true;
      });

      console.log('Softwares filtrados:', this.filteredSoftwares.length);
      this.renderSoftwares();

      if (this.filteredSoftwares.length === 0) {
        this.showNoResults('Nenhum software encontrado com os critérios selecionados');
      }
    }

    setupSearchListeners() {
      const searchBox = document.querySelector('.search-box');
      const searchButton = document.querySelector('.search-button');

      if (searchButton) {
        searchButton.addEventListener('click', () => {
          const query = searchBox?.value || '';
          this.searchSoftware(query);
        });
      }

      if (searchBox) {
        searchBox.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.searchSoftware(searchBox.value);
          }
        });
      }
    }

    searchSoftware(query) {
      query = query.toLowerCase().trim();

      if (!query) {
        this.filteredSoftwares = [...this.allSoftwares];
        this.renderSoftwares();
        return;
      }

      this.filteredSoftwares = this.allSoftwares.filter(software => {
        const searchableText = [
          software.name,
          software.company,
          software.description,
          ...software.software_categories.map(sc => sc.categories.name)
        ].join(' ').toLowerCase();

        return searchableText.includes(query);
      });

      this.renderSoftwares();

      // Se não houver resultados, mostrar mensagem específica
      if (this.filteredSoftwares.length === 0) {
        this.showNoResults(`Sua busca por "${query}" não retornou resultados`);
      }
    }

    attachCategoryListeners() {
      const categoryPills = document.querySelectorAll('#categories .category-pill');

      categoryPills.forEach(pill => {
        // Remover listeners existentes
        pill.replaceWith(pill.cloneNode(true));
      });

      // Reselecionar após clonagem
      document.querySelectorAll('#categories .category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          // Remover classe active de todas as pills
          document.querySelectorAll('#categories .category-pill').forEach(p => 
            p.classList.remove('active')
          );

          // Adicionar classe active à pill clicada
          pill.classList.add('active');

          // Filtrar softwares
          const selectedCategory = pill.getAttribute('data-category');
          this.filterByCategory(selectedCategory);
        });
      });
    }

    filterByCategory(category) {
      if (category === 'all') {
        this.filteredSoftwares = [...this.allSoftwares];
      } else {
        this.filteredSoftwares = this.allSoftwares.filter(software => {
          const categories = software.software_categories.map(sc => sc.categories.slug);
          return categories.includes(category);
        });
      }

      this.renderSoftwares();

      if (this.filteredSoftwares.length === 0) {
        this.showNoResults('Não há softwares disponíveis nesta categoria atualmente');
      }
    }

    setupModalListeners() {
      const modalOverlay = document.getElementById('software-detail-modal');
      const modalCloseButtons = document.querySelectorAll('.modal-close');
      const modalVisitButton = document.querySelector('.modal-button-primary');

      // Fechar modal
      modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => this.closeModal());
      });

      // Fechar modal ao clicar fora
      if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) {
            this.closeModal();
          }
        });
      }

      // Visitar site
      if (modalVisitButton) {
        modalVisitButton.addEventListener('click', () => {
          if (this.currentSoftwareURL) {
            window.open(this.currentSoftwareURL, '_blank');
          }
        });
      }
    }

    attachSoftwareListeners() {
      // View details listeners
      document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const slug = button.getAttribute('data-slug');
          this.showSoftwareDetails(slug);
        });
      });

      // Vote listeners
      document.querySelectorAll('.vote-button').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleVote(button);
        });
      });
    }

    async showSoftwareDetails(slug) {
  try {
    const { data: software, error } = await this.supabase
      .from('softwares')
      .select(`
        *,
        software_categories(
          categories(name, slug, icon)
        ),
        reviews(
          rating, title, review_text,
          profiles(full_name)
        )
      `)
      .eq('slug', slug)
      .single();

    if (error) throw error;

    // Se logado, criar notificação personalizada
    if (this.user) {
      await this.createSoftwareViewNotification(software.id, software.name);
    } else {
      // Se anônimo, apenas incrementar contadores
      await this.createAnonymousViewStats(software.id);
    }
    
    this.renderModalContent(software);
    this.openModal();
  } catch (error) {
    console.error('Erro ao carregar detalhes do software:', error);
    // Fallback para modal genérico
    this.showFallbackModal();
  }
}

async createAnonymousViewStats(softwareId) {
  try {
    // Incrementar contador de visualizações no software
    await this.supabase.rpc('increment_software_views', {
      software_id: softwareId
    });
    
    // Não criar notificação, apenas registrar a visualização anônima
  } catch (error) {
    console.error('Erro ao registrar visualização anônima:', error);
  }
}

    // NOVO: Método para criar notificação quando alguém visualiza um software
    async createSoftwareViewNotification(softwareId, softwareName) {
      if (!this.user) return; // Usuário precisa estar logado
      
      try {
        // Primeiro, buscar o proprietário do software
        const { data: software, error } = await this.supabase
          .from('softwares')
          .select('owner_id')
          .eq('id', softwareId)
          .single();
          
        if (error || !software.owner_id) return;
        
        // Não notificar se o usuário estiver visualizando seu próprio software
        if (software.owner_id === this.user.id) return;
        
        // Criar notificação para o proprietário
        await this.supabase
          .from('notifications')
          .insert({
            user_id: software.owner_id,
            title: 'Visualização de software',
            message: `Seu software ${softwareName} foi visualizado.`,
            type: 'view',
            read: false,
            metadata: {
              software_id: softwareId,
              viewer_id: this.user.id,
              software_slug: softwareName.toLowerCase().replace(/\s+/g, '-')
            },
            created_at: new Date().toISOString()
          });
          
      } catch (error) {
        console.error('Erro ao criar notificação de visualização:', error);
      }
    }

    // NOVA IMPLEMENTAÇÃO DO renderModalContent
    renderModalContent(software) {
      const modalContent = document.getElementById('software-detail-content');
      if (!modalContent) return;

      this.currentSoftwareURL = software.website_url || '#';

      // Calcular rating médio
      const ratings = software.reviews.map(r => r.rating).filter(Boolean);
      const averageRating = ratings.length > 0 
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        : 0;
      const stars = '★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));

      // Preparar informações sobre tamanho de empresa
      const companySizes = {
        'micro': 'Microempresa',
        'pequena': 'Pequena',
        'media': 'Média',
        'grande-media': 'Média-Grande'
      };
      
      const sizeDisplay = software.company_size && 
        (Array.isArray(software.company_size) ? software.company_size.length > 0 : software.company_size)
        ? (Array.isArray(software.company_size) 
          ? software.company_size.map(size => companySizes[size] || size).join(', ')
          : companySizes[software.company_size] || software.company_size)
        : 'Todos os tamanhos';

      // Preparar informações sobre problemas resolvidos
      const problemTypes = {
        'controle-financeiro': 'Controle Financeiro',
        'vendas': 'Vendas',
        'gestao-clientes': 'Gestão de Clientes',
        'automacao': 'Automação de Processos',
        'comunicacao': 'Comunicação',
        'contabilidade': 'Contabilidade',
        'marketing': 'Marketing',
        'estoque': 'Gestão de Estoque',
        'rh': 'Recursos Humanos'
      };
      
      const problemsDisplay = software.problems && 
        (Array.isArray(software.problems) ? software.problems.length > 0 : software.problems)
        ? (Array.isArray(software.problems) 
          ? software.problems.map(problem => problemTypes[problem] || problem).join(', ')
          : problemTypes[software.problems] || software.problems)
        : 'Múltiplos problemas';

      // Imagem padrão se necessário
      const softwareType = software.software_categories.length > 0 ? software.software_categories[0].categories.slug : 'default';
      const imageUrl = software.image_url || 
                      `/images/${softwareType}-default.png` || 
                      '/images/default-software.png';

      modalContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 180px 1fr; gap: 30px; margin-bottom: 30px; align-items: start;">
          <div>
            <img src="${imageUrl}" alt="${software.name}" 
                 style="max-width: 100%; max-height: 180px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.08);" onerror="this.src='/images/default-software.png'">
          </div>
          <div>
            <h3 style="font-size: 28px; margin-bottom: 8px; color: #333;">${software.name}</h3>
            <p style="color: #666; margin-bottom: 12px; font-size: 16px;">${software.company || 'Empresa não especificada'}</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; align-items: center;">
              <span style="background-color: #f5f5f5; padding: 5px 10px; border-radius: 4px; font-size: 13px; font-weight: 500;">
                ${software.software_categories[0]?.categories.name || 'Software'}
              </span>
              <span style="color: #ffc107; font-size: 16px; display: flex; align-items: center;">
                ${stars} <span style="color: #666; font-size: 13px; margin-left: 5px;">(${ratings.length} avaliações)</span>
              </span>
              ${software.featured ? '<span style="background-color: #ff4900; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: 600;">DESTAQUE</span>' : ''}
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 15px;">
              <p style="font-weight: 600; font-size: 18px; color: #ff4900; margin: 0;">${software.pricing}</p>
              <a href="${this.currentSoftwareURL}" target="_blank" style="display: inline-flex; align-items: center; gap: 5px; color: #0077cc; font-weight: 500; text-decoration: none;">
                <i class="fas fa-external-link-alt"></i> Visitar site
              </a>
            </div>
          </div>
        </div>
        
        <div class="software-detail-tabs">
          <div class="tab-header">
            <button class="tab-btn active" data-tab="overview">Visão Geral</button>
            <button class="tab-btn" data-tab="details">Detalhes</button>
            <button class="tab-btn" data-tab="reviews">Avaliações <span>(${ratings.length})</span></button>
          </div>
          
          <div class="tab-content" id="overview-tab" style="display: block;">
            <h4 style="font-size: 18px; margin-bottom: 10px; color: #333;">Sobre o software</h4>
            <p style="line-height: 1.7; margin-bottom: 20px; color: #444;">${software.detailed_description || software.description}</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 25px;">
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h5 style="font-size: 14px; margin-bottom: 8px; color: #666;">Tamanho das empresas</h5>
                <p style="font-weight: 500; color: #333;">${sizeDisplay}</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h5 style="font-size: 14px; margin-bottom: 8px; color: #666;">Problemas Resolvidos</h5>
                <p style="font-weight: 500; color: #333;">${problemsDisplay}</p>
              </div>
            </div>
          </div>
          
          <div class="tab-content" id="details-tab" style="display: none;">
            <div style="margin-bottom: 30px;">
              <h4 style="font-size: 18px; margin-bottom: 15px; color: #333;">Especificações</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                <!-- Detalhes técnicos aqui -->
                <div style="display: flex; gap: 10px; align-items: center;">
                  <i class="fas fa-code" style="color: #ff4900; font-size: 16px; width: 20px;"></i>
                  <div>
                    <h5 style="font-size: 13px; color: #666; margin-bottom: 3px;">Categoria</h5>
                    <p style="font-weight: 500; color: #333;">${software.software_categories[0]?.categories.name || 'Software'}</p>
                  </div>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                  <i class="fas fa-users" style="color: #ff4900; font-size: 16px; width: 20px;"></i>
                  <div>
                    <h5 style="font-size: 13px; color: #666; margin-bottom: 3px;">Tamanho das Empresas</h5>
                    <p style="font-weight: 500; color: #333;">${sizeDisplay}</p>
                  </div>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                  <i class="fas fa-check-circle" style="color: #ff4900; font-size: 16px; width: 20px;"></i>
                  <div>
                    <h5 style="font-size: 13px; color: #666; margin-bottom: 3px;">Problemas Resolvidos</h5>
                    <p style="font-weight: 500; color: #333;">${problemsDisplay}</p>
                  </div>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                  <i class="fas fa-tag" style="color: #ff4900; font-size: 16px; width: 20px;"></i>
                  <div>
                    <h5 style="font-size: 13px; color: #666; margin-bottom: 3px;">Preço</h5>
                    <p style="font-weight: 500; color: #333;">${software.pricing}</p>
                  </div>
                </div>
              </div>
            </div>
            
            ${software.partnership_available ? `
            <div style="margin-bottom: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #ff4900;">
              <h4 style="font-size: 18px; margin-bottom: 10px; color: #333;">
                <i class="fas fa-handshake"></i> Programa de Parceiros Disponível
              </h4>
              
              ${software.commission_rate ? `
                <p style="margin-bottom: 15px;">Comissão de <strong>${software.commission_rate}%</strong> disponível para revendedores.</p>
              ` : ''}
              
              <a href="parceiros.html#partners-title" class="btn-primary" style="display: inline-block; margin-top: 5px; padding: 8px 16px; border-radius: 6px; background-color: #ff4900; color: white; text-decoration: none; font-weight: 500;">
                <i class="fas fa-external-link-alt"></i> Ver Programa de Parceiros
              </a>
            </div>
            ` : ''}
          </div>
          
          <div class="tab-content" id="reviews-tab" style="display: none;">
            <h4 style="font-size: 18px; margin-bottom: 15px; color: #333;">Avaliações dos usuários</h4>
            ${this.renderReviews(software.reviews)}
          </div>
        </div>
      `;

      // Adicionar os event listeners para as abas
      const tabButtons = modalContent.querySelectorAll('.tab-btn');
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          // Remover active de todos os botões
          tabButtons.forEach(btn => btn.classList.remove('active'));
          
          // Adicionar active ao botão clicado
          button.classList.add('active');
          
          // Esconder todos os conteúdos
          modalContent.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
          });
          
          // Mostrar o conteúdo correspondente
          const tabId = button.getAttribute('data-tab');
          document.getElementById(`${tabId}-tab`).style.display = 'block';
        });
      });
    }

    renderReviews(reviews) {
      if (!reviews || reviews.length === 0) {
        return '<p style="color: #666; font-style: italic;">Ainda não há avaliações para este software.</p>';
      }

      return reviews.slice(0, 3).map(review => `
        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-weight: 600;">${review.profiles?.full_name || 'Usuário'}</span>
            <span style="color: #ffc107;">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
          </div>
          ${review.title ? `<h5 style="margin-bottom: 5px; font-size: 14px;">${review.title}</h5>` : ''}
          <p style="font-size: 14px; line-height: 1.5;">${review.review_text || 'Recomendo este software!'}</p>
        </div>
      `).join('');
    }

    showFallbackModal() {
      // Usar o sistema de modal original como fallback
      const card = document.querySelector('.software-card');
      if (!card) return;

      const softwareName = card.querySelector('.software-name')?.textContent || 'Software';
      const modalContent = document.getElementById('software-detail-content');
      
      if (modalContent) {
        modalContent.innerHTML = `
          <p>Detalhes para ${softwareName} não puderam ser carregados.</p>
          <p>Tente novamente mais tarde.</p>
        `;
      }
      
      this.openModal();
    }

    openModal() {
      const modalOverlay = document.getElementById('software-detail-modal');
      if (modalOverlay) {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    closeModal() {
      const modalOverlay = document.getElementById('software-detail-modal');
      if (modalOverlay) {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
      }
    }

    async handleVote(button) {
      if (!this.user) {
        alert('Por favor, faça login para votar.');
        window.location.href = '/login.html';
        return;
      }

      const card = button.closest('.software-card');
      const softwareId = card.dataset.softwareId;
      const voteType = button.dataset.type;
      const softwareName = card.querySelector('.software-name').textContent;

      try {
        // Verificar voto existente
        const { data: existingVote } = await this.supabase
          .from('votes')
          .select('id, type')
          .eq('user_id', this.user.id)
          .eq('software_id', softwareId)
          .single();

        if (existingVote) {
          if (existingVote.type === voteType) {
            // Remover voto
            await this.supabase
              .from('votes')
              .delete()
              .eq('id', existingVote.id);
          } else {
            // Mudar tipo de voto
            await this.supabase
              .from('votes')
              .update({ type: voteType })
              .eq('id', existingVote.id);
          }
        } else {
          // Criar novo voto
          await this.supabase
            .from('votes')
            .insert({
              user_id: this.user.id,
              software_id: softwareId,
              type: voteType
            });
        }

        // NOVO: Criar notificação de voto
        await this.createSoftwareVoteNotification(softwareId, softwareName, voteType);
        
        // Recarregar contadores
        await this.updateVoteCounts(card, softwareId);

      } catch (error) {
        console.error('Erro ao votar:', error);
        alert('Erro ao registrar voto. Tente novamente.');
      }
    }

    // NOVO: Método para criar notificação quando um software recebe voto
    async createSoftwareVoteNotification(softwareId, softwareName, voteType) {
      if (!this.user) return; // Usuário precisa estar logado
      
      try {
        // Buscar o proprietário do software
        const { data: software, error } = await this.supabase
          .from('softwares')
          .select('owner_id')
          .eq('id', softwareId)
          .single();
          
        if (error || !software.owner_id) return;
        
        // Não notificar se o usuário estiver votando em seu próprio software
        if (software.owner_id === this.user.id) return;
        
        // Buscar dados do usuário votante
        const { data: userData } = await this.supabase
          .from('profiles')
          .select('full_name')
          .eq('id', this.user.id)
          .single();
          
        const userName = userData?.full_name || 'Um usuário';
        
        // Criar notificação para o proprietário
        await this.supabase
          .from('notifications')
          .insert({
            user_id: software.owner_id,
            title: 'Nova avaliação de software',
            message: `${userName} ${voteType === 'upvote' ? 'recomendou' : 'não recomendou'} seu software ${softwareName}.`,
            type: voteType === 'upvote' ? 'success' : 'warning',
            read: false,
            metadata: {
              software_id: softwareId,
              voter_id: this.user.id,
              vote_type: voteType,
              software_slug: softwareName.toLowerCase().replace(/\s+/g, '-')
            },
            created_at: new Date().toISOString()
          });
          
      } catch (error) {
        console.error('Erro ao criar notificação de voto:', error);
      }
    }

    async updateVoteCounts(card, softwareId) {
      try {
        const { data: votes } = await this.supabase
          .from('votes')
          .select('type')
          .eq('software_id', softwareId);

        const upvotes = votes.filter(v => v.type === 'upvote').length;
        const downvotes = votes.filter(v => v.type === 'downvote').length;

        // Atualizar UI
        const upvoteBtn = card.querySelector('.upvote .vote-count');
        const downvoteBtn = card.querySelector('.downvote .vote-count');

        if (upvoteBtn) upvoteBtn.textContent = upvotes;
        if (downvoteBtn) downvoteBtn.textContent = downvotes;

        // Verificar voto do usuário atual
        if (this.user) {
          const { data: userVote } = await this.supabase
            .from('votes')
            .select('type')
            .eq('user_id', this.user.id)
            .eq('software_id', softwareId)
            .single();

          // Remover classes voted
          card.querySelector('.upvote').classList.remove('voted');
          card.querySelector('.downvote').classList.remove('voted');

          // Adicionar classe voted se necessário
          if (userVote) {
            card.querySelector(`.${userVote.type}`).classList.add('voted');
          }
        }

      } catch (error) {
        console.error('Erro ao atualizar contadores de voto:', error);
      }
    }

    attachPartnershipListeners() {
      // Aguardar um pouco para garantir que os elementos foram renderizados
      setTimeout(() => {
        const contactButtons = document.querySelectorAll('.contact-partner');
        console.log('Configurando listeners para', contactButtons.length, 'botões de contato');
        
        contactButtons.forEach(button => {
          // Remover listener existente clonando o elemento
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);
          
          // Adicionar novo listener
          newButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!this.user) {
              alert('Por favor, faça login para entrar em contato com parceiros.');
              window.location.href = '/login.html';
              return;
            }

            // Pegar informações do card
            const card = newButton.closest('.partnership-card');
            const partnershipId = newButton.dataset.partnershipId || card.dataset.partnershipId;
            const partnershipName = card.querySelector('.partnership-name')?.textContent || 'Parceria';

            console.log('Botão de contato clicado:', partnershipName);
            
            // NOVO: Criar notificação de solicitação de parceria
            await this.createPartnershipRequestNotification(partnershipId, partnershipName);
            
            // Por enquanto, mostrar um alert simples
            alert(`Formulário de contato para: ${partnershipName}\n\nEm uma implementação real, este seria um modal de contato com o parceiro.`);
          });
        });
      }, 500);
    }

    // NOVO: Método para criar notificação quando alguém solicita parceria
    async createPartnershipRequestNotification(partnershipId, partnershipName) {
      if (!this.user) return; // Usuário precisa estar logado
      
      try {
        // Buscar dados da parceria
        const { data: partnership, error } = await this.supabase
          .from('partnerships')
          .select('user_id')
          .eq('id', partnershipId)
          .single();
          
        if (error || !partnership.user_id) return;
        
        // Buscar dados do usuário solicitante
        const { data: userData } = await this.supabase
          .from('profiles')
          .select('full_name')
          .eq('id', this.user.id)
          .single();
          
        const userName = userData?.full_name || 'Um usuário';
        
        // Criar notificação para o proprietário da parceria
        await this.supabase
          .from('notifications')
          .insert({
            user_id: partnership.user_id,
            title: 'Nova solicitação de parceria',
            message: `${userName} deseja ser seu parceiro em "${partnershipName}".`,
            type: 'partnership',
            read: false,
            metadata: {
              partnership_id: partnershipId,
              requester_id: this.user.id
            },
            created_at: new Date().toISOString()
          });
          
      } catch (error) {
        console.error('Erro ao criar notificação de parceria:', error);
      }
    }
  }

  // Inicializar a aplicação quando o Supabase estiver pronto
  console.log('Inicializando BelgaHub...');
  new BelgaHub();
});
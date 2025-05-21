/** perfil.js
 * Belga Hub - Sistema de Perfil Completo com Supabase
 * Versão integrada e funcional para todos os tipos de usuário
 */

// Aguardar carregamento do DOM e Supabase
document.addEventListener('DOMContentLoaded', async function() {
  // Aguardar Supabase estar disponível
  let supabase;
  let attempts = 0;
  const maxAttempts = 50; // 5 segundos máximo

  // Aguardar Supabase carregar
  const waitForSupabase = () => {
    return new Promise((resolve) => {
      const checkSupabase = () => {
        if (window.supabaseClient) {
          resolve(window.supabaseClient);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkSupabase, 100);
        } else {
          console.error('Supabase não foi carregado a tempo');
          resolve(null);
        }
      };
      checkSupabase();
    });
  };

  supabase = await waitForSupabase();

  if (!supabase) {
    console.error('Erro: Supabase não está disponível');
    return;
  }

  class ProfilePage {
    constructor() {
      this.supabase = supabase;
      this.user = null;
      this.profile = null;
      this.currentTab = 'dashboard';
      this.allVotes = [];
      this.allPartnerships = [];
      this.allNotifications = [];
      // Estado para o modal de criação de software
      this.hasPartnership = false;
      this.notificationsSubscription = null;
      this.init();
    }

    async init() {
      console.log('Inicializando sistema de perfil...');
      
      /* // Verificar autenticação
      await this.checkAuth();
      
      if (!this.user) {
        console.log('Usuário não autenticado, redirecionando...');
        window.location.href = '/login.html';
        return;
      }*/

      // Configurar interface
      this.setupEventListeners();
      this.setupSoftwareModals();
      
      // Carregar dados
      await this.loadUserProfile();
      await this.loadUserStats();
      
      // Carregar tab inicial
      this.showTab('dashboard');
    }

    async checkAuth() {
      try {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        
        if (error) throw error;
        
        this.user = user;
        console.log('Usuário autenticado:', user?.email);
      } catch (error) {
        console.error('Erro na autenticação:', error);
        this.user = null;
      }
    }

    setupEventListeners() {
      // Tab Navigation
      document.querySelectorAll('.profile-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = link.dataset.tab;
          this.showTab(tab);
        });
      });

      // Avatar Upload
      const avatarUpload = document.getElementById('avatar-upload');
      if (avatarUpload) {
        avatarUpload.addEventListener('change', (e) => {
          this.handleAvatarUpload(e);
        });
      }

      // Profile Info Form
      const profileForm = document.getElementById('profile-info-form');
      if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleProfileUpdate(e);
        });
      }

      // Preferences Form
      const preferencesForm = document.getElementById('preferences-form');
      if (preferencesForm) {
        preferencesForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handlePreferencesUpdate(e);
        });
      }

      // Password Form
      const passwordForm = document.getElementById('password-form');
      if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handlePasswordChange(e);
        });
      }

      // Password strength checker
      const newPasswordInput = document.getElementById('new-password');
      if (newPasswordInput) {
        newPasswordInput.addEventListener('input', (e) => {
          this.checkPasswordStrength(e.target.value);
        });
      }

      // Partnership Modals
      document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeModal(btn.closest('.modal-overlay').id);
        });
      });

      document.querySelectorAll('.modal-close2').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeModal(btn.closest('.modal-overlay').id);
        });
      });

      // Click outside to close modal
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeModal(modal.id);
          }
        });
      });

      // Create Partnership
      const createPartnershipBtn = document.getElementById('create-partnership-btn');
      if (createPartnershipBtn) {
        createPartnershipBtn.addEventListener('click', () => {
          this.showModal('create-partnership-modal');
        });
      }

      const createPartnershipForm = document.getElementById('create-partnership-form');
      if (createPartnershipForm) {
        createPartnershipForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleCreatePartnership(e);
        });
      }

      // Edit Partnership
      const editPartnershipForm = document.getElementById('edit-partnership-form');
      if (editPartnershipForm) {
        editPartnershipForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleEditPartnership(e);
        });
      }

      // Vote filters
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Verificar se são os filtros de status de software
          if (btn.closest('#software-tab')) {
            this.filterSoftwares(btn.dataset.filter);
          } else {
            // Caso contrário são os filtros de votos
            this.filterVotes(btn.dataset.filter);
          }
        });
      });

      // Logout
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.handleLogout();
        });
      }

      // Mark all notifications as read
      const markAllReadBtn = document.getElementById('mark-all-read');
      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
          this.markAllNotificationsRead();
        });
      }

      // CEP lookup
      const cepInput = document.getElementById('cep');
      if (cepInput) {
        cepInput.addEventListener('blur', (e) => {
          this.lookupCEP(e.target.value);
        });
      }

      // Session info
      this.updateSessionInfo();
    }

    // Configuração específica para modais de software
    setupSoftwareModals() {
      // Obter todos os botões que abrem o modal
      const createButtons = document.querySelectorAll('#create-software-btn');
      const emptyAddButton = document.getElementById('empty-add-software-btn');
      const modal = document.getElementById('create-software-modal');
      const successModal = document.getElementById('success-modal');
      const form = document.getElementById('create-software-form');
      
      // Configurar handlers de evento para todos os botões de criação
      if (createButtons.length > 0) {
        createButtons.forEach(button => {
          button.addEventListener('click', () => this.openModal('create-software-modal'));
        });
      }
      
      if (emptyAddButton) {
        emptyAddButton.addEventListener('click', () => this.openModal('create-software-modal'));
      }
      
      // Botão para ir para a aba de parcerias
      const goToPartnershipsBtn = document.getElementById('go-to-partnerships');
      if (goToPartnershipsBtn) {
        goToPartnershipsBtn.addEventListener('click', () => {
          // Fechar o modal de sucesso
          this.closeModal('success-modal');
          
          // Navegar para a aba de parcerias e simular clique no botão "Nova Parceria"
          const partnershipsTab = document.querySelector('[data-tab="partnerships"]');
          if (partnershipsTab) {
            partnershipsTab.click();
            
            // Dar tempo para a aba carregar e então clicar no botão de nova parceria
            setTimeout(() => {
              const newPartnershipBtn = document.getElementById('create-partnership-btn');
              if (newPartnershipBtn) {
                newPartnershipBtn.click();
              }
            }, 300);
          }
        });
      }
      
      // Submissão do formulário de software
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleCreateSoftware(e);
        });
      }
    }

    async showTab(tabName) {
      console.log('Mostrando tab:', tabName);
      this.currentTab = tabName;

      // Update active link
      document.querySelectorAll('.profile-link').forEach(link => {
        link.classList.remove('active');
      });
      const activeLink = document.querySelector(`[data-tab="${tabName}"]`);
      if (activeLink) activeLink.classList.add('active');

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      const activeTab = document.getElementById(`${tabName}-tab`);
      if (activeTab) activeTab.classList.add('active');

      // Load tab-specific data
      await this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
      switch(tabName) {
        case 'dashboard':
          await this.loadDashboardData();
          break;
        case 'votes':
          await this.loadUserVotes();
          break;
        case 'partnerships':
          await this.loadUserPartnerships();
          break;
        case 'notifications':
          await this.loadNotifications();
          break;
        case 'softwares':
          await this.loadMySoftwares();
          break;
      }
    }

    async loadUserProfile() {
      try {
        // Primeiro tentar buscar perfil existente
        let { data: profile, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', this.user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          // Perfil não existe, criar um novo
          console.log('Criando novo perfil...');
          const { data: newProfile, error: createError } = await this.supabase
            .from('profiles')
            .insert({
              id: this.user.id,
              email: this.user.email,
              full_name: this.user.user_metadata?.full_name || 'Usuário',
              role: this.user.user_metadata?.role || 'client'
            })
            .select()
            .single();

          if (createError) throw createError;
          profile = newProfile;
        } else if (error) {
          throw error;
        }

        this.profile = profile;
        this.updateProfileUI();

      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        // Fallback para dados básicos do usuário
        this.profile = {
          id: this.user.id,
          email: this.user.email,
          full_name: this.user.user_metadata?.full_name || 'Usuário',
          role: this.user.user_metadata?.role || 'client'
        };
        this.updateProfileUI();
      }
    }

    updateProfileUI() {
      if (!this.profile) return;

      // Update sidebar
      const profileName = document.getElementById('profile-name');
      if (profileName) profileName.textContent = this.profile.full_name || 'Nome não informado';
      
      const profileRole = document.getElementById('profile-role');
      if (profileRole) profileRole.textContent = this.getRoleDisplayName(this.profile.role);
      
      const profileCompany = document.getElementById('profile-company');
      if (profileCompany) profileCompany.textContent = this.profile.company_name || '';

      const profileLinkedIn = document.getElementById('profile-linkedin');
      if (profileLinkedIn) profileLinkedIn.textContent = this.profile.linkedin || '';

      // Fill form fields
      this.populateProfileForm();
    }

    populateProfileForm() {
      if (!this.profile) return;

      const fields = {
        'full-name': this.profile.full_name || '',
        'email': this.profile.email || '',
        'phone': this.profile.whatsapp || '',
        'birth-date': this.profile.birth_date || '',
        'role': this.profile.role || 'client',
        'company': this.profile.company_name || '',
        'position': this.profile.position || '',
        'industry': this.profile.industry || '',
        'linkedin': this.profile.linkedin || '',
        'cep': this.profile.cep || '',
        'city': this.profile.city || '',
        'state': this.profile.state || '',
        'bio': this.profile.bio || ''
      };

      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      });
    }

    async loadUserStats() {
      try {
        // Count votes
        const { data: votes, error: votesError } = await this.supabase
          .from('votes')
          .select('id, type')
          .eq('user_id', this.user.id);

        if (votesError) throw votesError;

        const totalVotes = votes?.length || 0;
        const upvotes = votes?.filter(v => v.type === 'upvote').length || 0;

        document.getElementById('votes-count').textContent = totalVotes;
        document.getElementById('upvotes-count').textContent = upvotes;

        // Count partnerships
        const { data: partnerships, error: partnershipsError } = await this.supabase
          .from('partnerships')
          .select('id, active')
          .eq('user_id', this.user.id);

        if (partnershipsError) throw partnershipsError;

        const totalPartnerships = partnerships?.length || 0;
        const activePartnerships = partnerships?.filter(p => p.active).length || 0;

        document.getElementById('partnerships-count').textContent = totalPartnerships;
        document.getElementById('active-partnerships-count').textContent = activePartnerships;

        // Mock data for profile views (in real app, track this)
        document.getElementById('profile-views').textContent = Math.floor(Math.random() * 500) + 100;

        // Update trends (mock data)
        document.getElementById('upvotes-trend').textContent = '+' + Math.floor(Math.random() * 10) + ' esta semana';
        document.getElementById('partnerships-trend').textContent = totalPartnerships > 0 ? 'Ativo' : 'Sem alteração';
        document.getElementById('views-trend').textContent = '+' + Math.floor(Math.random() * 20) + '% este mês';

      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        // Set fallback values
        document.getElementById('votes-count').textContent = '0';
        document.getElementById('partnerships-count').textContent = '0';
        document.getElementById('sales-count').textContent = '0';
      }
    }

    async loadDashboardData() {
      await this.loadRecentActivity();
      await this.loadRecommendations();
    }

    async loadRecentActivity() {
      try {
        const activities = [];

        const activityList = document.getElementById('activity-list');
        activityList.innerHTML = this.createLoadingState();

        // Load recent votes
        const { data: recentVotes } = await this.supabase
          .from('votes')
          .select(`
            *,
            softwares(name)
          `)
          .eq('user_id', this.user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentVotes) {
          recentVotes.forEach(vote => {
            activities.push({
              icon: vote.type === 'upvote' ? 'fas fa-thumbs-up' : 'fas fa-thumbs-down',
              title: `Você votou ${vote.type === 'upvote' ? 'positivamente' : 'negativamente'}`,
              description: `em ${vote.softwares.name}`,
              time: this.getTimeAgo(vote.created_at),
              created_at: vote.created_at
            });
          });
        }

        // Load recent partnerships
        const { data: recentPartnerships } = await this.supabase
          .from('partnerships')
          .select('*')
          .eq('user_id', this.user.id)
          .order('created_at', { ascending: false })
          .limit(2);

        if (recentPartnerships) {
          recentPartnerships.forEach(partnership => {
            activities.push({
              icon: 'fas fa-handshake',
              title: 'Nova parceria criada:',
              description: partnership.name,
              time: this.getTimeAgo(partnership.created_at),
              created_at: partnership.created_at
            });
          });
        }

        // Sort by date and display
        activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        this.renderRecentActivity(activities.slice(0, 5));

      } catch (error) {
        console.error('Erro ao carregar atividade recente:', error);
        this.renderRecentActivity([]);
      }
    }

    renderRecentActivity(activities) {
      const activityList = document.getElementById('activity-list');
      if (!activityList) return;

      if (activities.length === 0) {
        activityList.innerHTML = `
          <div class="activity-item">
            <div class="activity-icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="activity-content">
              <p>Nenhuma atividade recente</p>
              <span class="activity-time">Comece avaliando softwares ou criando parcerias</span>
            </div>
          </div>
        `;
        return;
      }

      activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="${activity.icon}"></i>
          </div>
          <div class="activity-content">
            <p><strong>${activity.title}</strong> ${activity.description}</p>
            <span class="activity-time">${activity.time}</span>
          </div>
        </div>
      `).join('');
    }

    async loadRecommendations() {
      try {
        const recommendedList = document.getElementById('recommended-list');
        recommendedList.innerHTML = this.createLoadingState();
        // Load recommended software based on user activity
        const { data: recommendations } = await this.supabase
          .from('softwares')
          .select(`
            *,
            software_categories(
              categories(name)
            ),
            reviews(rating)
          `)
          .eq('featured', true)
          .limit(3);

        if (recommendations) {
          this.renderRecommendations(recommendations);
        }
        } catch (error) {
        console.error('Erro ao carregar recomendações:', error);
        this.renderRecommendations([]);
      }
    }

    renderRecommendations(recommendations) {
      const recommendedList = document.getElementById('recommended-list');
      if (!recommendedList) return;

      if (recommendations.length === 0) {
        recommendedList.innerHTML = `
          <div class="recommended-item">
            <div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-info-circle" style="color: #ccc;"></i>
            </div>
            <div class="recommended-content">
              <h4>Nenhuma recomendação disponível</h4>
              <p>Continue usando a plataforma para receber recomendações personalizadas</p>
            </div>
          </div>
        `;
        return;
      }

      recommendedList.innerHTML = recommendations.map(software => {
        const reviews = software.reviews || [];
        const avgRating = reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
          : 0;
        const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));

        return `
          <div class="recommended-item">
            <img src="${software.image_url || 'images/default-software.png'}" alt="${software.name}">
            <div class="recommended-content">
              <h4>${software.name}</h4>
              <p>${software.software_categories[0]?.categories.name || 'Software'} - ${software.company}</p>
              <div class="recommended-rating">
                <span class="stars">${stars}</span> 
                <span>(${reviews.length} avaliações)</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    async loadUserVotes() {
      try {
        const { data: votes, error } = await this.supabase
          .from('votes')
          .select(`
            *,
            softwares(
              name,
              company,
              image_url,
              slug
            )
          `)
          .eq('user_id', this.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.allVotes = votes || [];
        this.filterVotes('all');

      } catch (error) {
        console.error('Erro ao carregar votos:', error);
        this.renderVotes([]);
      }
    }

    filterVotes(filter) {
      let filteredVotes = this.allVotes;

      if (filter === 'upvote') {
        filteredVotes = this.allVotes.filter(vote => vote.type === 'upvote');
      } else if (filter === 'downvote') {
        filteredVotes = this.allVotes.filter(vote => vote.type === 'downvote');
      }

      this.renderVotes(filteredVotes);
    }

    renderVotes(votes) {
      const votesList = document.getElementById('votes-list');
      if (!votesList) return;

      if (votes.length === 0) {
        votesList.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-thumbs-up" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
            <h3>Nenhuma avaliação encontrada</h3>
            <a href="index.html" class="btn-primary" style="margin-top: 15px; color: white;" onmouseover="this.style.color='white';" onmouseout="this.style.color='white';">
              Explorar softwares
            </a>
          </div>
        `;
        return;
      }

      votesList.innerHTML = votes.map(vote => `
        <div class="vote-item" data-vote-type="${vote.type}">
          <img src="${vote.softwares.image_url || 'images/default-software.png'}" 
               alt="${vote.softwares.name}">
          <div class="vote-content">
            <h4>${vote.softwares.name}</h4>
            <p>${vote.softwares.company}</p>
            <span class="vote-type ${vote.type}">
              ${vote.type === 'upvote' ? '👍 Recomendo' : '👎 Não recomendo'}
            </span>
            <div style="margin-top: 8px;">
              <span style="color: #999; font-size: 12px;">${this.getTimeAgo(vote.created_at)}</span>
            </div>
          </div>
          <a href="index.html#${vote.softwares.slug}" class="btn-primary" style="align-self: center;">
            Ver Software
          </a>
        </div>
      `).join('');
    }

    async loadUserPartnerships() {
      try {
        const { data: partnerships, error } = await this.supabase
          .from('partnerships')
          .select('*')
          .eq('user_id', this.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.allPartnerships = partnerships || [];
        this.renderPartnerships();

      } catch (error) {
        console.error('Erro ao carregar parcerias:', error);
        this.renderPartnerships();
      }
    }

    renderPartnerships() {
      const partnershipsGrid = document.getElementById('partnerships-grid');
      if (!partnershipsGrid) return;

      if (this.allPartnerships.length === 0) {
        partnershipsGrid.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">
            <i class="fas fa-handshake" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
            <h3>Nenhuma parceria criada</h3>
            <p>Clique em "Nova parceria" para criar sua primeira parceria.</p>
          </div>
        `;
        return;
      }

      partnershipsGrid.innerHTML = this.allPartnerships.map(partnership => `
        <div class="partnership-item">
          <div class="partnership-header">
            <span class="partnership-type">${this.getPartnershipTypeDisplay(partnership.type)}</span>
            <span class="partnership-date">${new Date(partnership.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <h4>${partnership.name}</h4>
          <p>${partnership.description}</p>
          <div class="partnership-meta">
            ${partnership.location ? `<span><i class="fas fa-map-marker-alt"></i> ${partnership.location}</span>` : ''}
            ${partnership.commission_rate ? `<span><i class="fas fa-percentage"></i> ${partnership.commission_rate}R$ comissão</span>` : ''}
            ${partnership.active ? '<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Ativa</span>' : '<span style="color: #ffc107;"><i class="fas fa-pause-circle"></i> Pausada</span>'}
          </div>
          <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="btn-secondary" onclick="profileInstance.editPartnership('${partnership.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn-danger-outline" onclick="profileInstance.deletePartnership('${partnership.id}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </div>
        </div>
      `).join('');
    }

    // INÍCIO DAS NOVAS IMPLEMENTAÇÕES DE NOTIFICAÇÕES
    async loadNotifications() {
      try {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;
        
        notificationsList.innerHTML = this.createLoadingState('Carregando notificações...');
        
        // Combinar abordagens: buscar notificações do banco e configurar listener em tempo real
        await this.fetchStoredNotifications();
        this.setupNotificationsListener();
        
        this.renderNotifications();
        this.updateNotificationBadge();
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
        this.allNotifications = this.getMockNotifications();
        this.renderNotifications();
      }
    }

    async fetchStoredNotifications() {
      // Buscar notificações existentes no banco
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      this.allNotifications = notifications && notifications.length > 0 
        ? notifications 
        : this.getMockNotifications();
    }

    setupNotificationsListener() {
      // Configurar canal de tempo real para novas notificações
      const notificationsChannel = this.supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${this.user.id}`
          },
          (payload) => {
            console.log('Nova notificação recebida:', payload);
            // Adicionar nova notificação ao topo da lista
            this.allNotifications.unshift(payload.new);
            // Atualizar interface
            this.renderNotifications();
            this.updateNotificationBadge();
            // Tocar som ou mostrar toast de notificação (opcional)
            this.showNotificationToast(payload.new);
          }
        )
        .subscribe();
        
      // Guardar referência para desinscrever quando necessário
      this.notificationsSubscription = notificationsChannel;
    }

    showNotificationToast(notification) {
      // Criar um toast para notificação em tempo real
      const toast = document.createElement('div');
      toast.className = 'notification-toast';
      toast.innerHTML = `
        <div class="notification-toast-icon ${notification.type}">
          <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-toast-content">
          <h4>${notification.title}</h4>
          <p>${notification.message}</p>
        </div>
        <button class="notification-toast-close">&times;</button>
      `;
      
      document.body.appendChild(toast);
      
      // Remover após 5 segundos
      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
      }, 5000);
      
      // Configurar botão de fechar
      toast.querySelector('.notification-toast-close').addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
      });
    }

    getNotificationIcon(type) {
      const icons = {
        'info': 'fa-info-circle',
        'success': 'fa-check-circle',
        'warning': 'fa-exclamation-triangle',
        'error': 'fa-times-circle',
        'partnership': 'fa-handshake',
        'message': 'fa-envelope',
        'lead': 'fa-user-plus',
        'view': 'fa-eye',
        'software': 'fa-code'
      };
      return icons[type] || 'fa-bell';
    }

    renderNotifications() {
      const notificationsList = document.getElementById('notifications-list');
      if (!notificationsList) return;

      if (this.allNotifications.length === 0) {
        notificationsList.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-bell" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
            <h3>Nenhuma notificação</h3>
            <p>Você está em dia com todas as notificações!</p>
          </div>
        `;
        return;
      }

      notificationsList.innerHTML = this.allNotifications.map(notification => {
        // Verificar se existe metadata para ações específicas
        const hasAction = notification.metadata && 
                          (notification.metadata.profile_id || 
                           notification.metadata.partnership_id || 
                           notification.metadata.software_id);
                           
        // Determinar a ação ao clicar em "Ver detalhes"
        let actionHtml = '';
        
        if (hasAction) {
          let actionUrl = '#';
          let actionText = 'Ver detalhes';
          
          if (notification.metadata && notification.metadata.profile_id) {
            actionUrl = `perfil.html?id=${notification.metadata.profile_id}`;
            actionText = 'Ver perfil';
          } else if (notification.metadata && notification.metadata.partnership_id) {
            actionUrl = `#partnerships-tab`;
            actionText = 'Ver parceria';
          } else if (notification.metadata && notification.metadata.software_id) {
            actionUrl = `index.html#${notification.metadata.software_slug || ''}`;
            actionText = 'Ver software';
          }
          
          actionHtml = `
            <a href="${actionUrl}" class="btn-primary-outline notification-action">
              ${actionText}
            </a>
          `;
        }
        
        return `
          <div class="notification-item ${!notification.read ? 'unread' : ''}">
            <div class="notification-icon ${notification.type}">
              <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
              <h4>${notification.title}</h4>
              <p>${notification.message}</p>
              <span class="notification-time">${this.getTimeAgo(notification.created_at)}</span>
            </div>
            <div class="notification-actions">
              ${actionHtml}
              ${!notification.read ? `
                <button class="btn-primary" onclick="profileInstance.markNotificationAsRead('${notification.id}')" 
                        style="padding: 6px 12px; font-size: 12px;">
                  Marcar como lida
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    async createNotification(notificationData) {
      try {
        const { data, error } = await this.supabase
          .from('notifications')
          .insert({
            user_id: this.user.id,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type || 'info',
            read: false,
            metadata: notificationData.metadata || {},
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Erro ao criar notificação:', error);
        return null;
      }
    }

    getNotificationTypes() {
      return {
        // Notificações relacionadas a parcerias
        NEW_PARTNERSHIP_REQUEST: {
          title: 'Nova solicitação de parceria',
          message: (partnerName) => `${partnerName} deseja ser seu parceiro.`,
          type: 'partnership'
        },
        PARTNERSHIP_APPROVED: {
          title: 'Parceria aprovada',
          message: (companyName) => `${companyName} aprovou sua solicitação de parceria.`,
          type: 'success'
        },
        PARTNERSHIP_REJECTED: {
          title: 'Parceria recusada',
          message: (companyName) => `${companyName} recusou sua solicitação de parceria.`,
          type: 'warning'
        },
        
        // Notificações relacionadas a softwares
        SOFTWARE_APPROVED: {
          title: 'Software aprovado',
          message: (softwareName) => `Seu software ${softwareName} foi aprovado e já está disponível na plataforma.`,
          type: 'success'
        },
        SOFTWARE_FEEDBACK: {
          title: 'Feedback de software',
          message: (softwareName) => `Seu software ${softwareName} recebeu uma nova avaliação.`,
          type: 'info'
        },
        SOFTWARE_VIEWS: {
          title: 'Visualizações de software',
          message: (softwareName, count) => `Seu software ${softwareName} recebeu ${count} novas visualizações.`,
          type: 'info'
        },
        
        // Notificações relacionadas a perfil e interações
        PROFILE_VIEW: {
          title: 'Visualização de perfil',
          message: (viewerName) => `${viewerName} visualizou seu perfil.`,
          type: 'view'
        },
        NEW_MESSAGE: {
          title: 'Nova mensagem',
          message: (senderName) => `Você recebeu uma nova mensagem de ${senderName}.`,
          type: 'message'
        },
        NEW_LEAD: {
          title: 'Novo lead gerado',
          message: (softwareName) => `Seu software ${softwareName} gerou um novo lead.`,
          type: 'lead'
        }
      };
    }
    // FIM DAS NOVAS IMPLEMENTAÇÕES DE NOTIFICAÇÕES

    // Nova função para lidar com softwares do usuário
    async loadMySoftwares() {
      const softwaresGrid = document.getElementById('softwares-grid');
      const emptyState = document.getElementById('empty-software-state');
      
      if (!softwaresGrid) return;
      
      try {
        console.log('Carregando softwares do usuário...');
        // Obter softwares do usuário atual
        const { data: softwares, error } = await this.supabase
          .from('softwares')
          .select(`
            *,
            software_categories(
              categories(name, slug)
            ),
            reviews(rating),
            views_count,
            leads_count
          `)
          .eq('owner_id', this.user?.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        // Mostrar estado vazio se não houver softwares
        if (!softwares || softwares.length === 0) {
          if (softwaresGrid) softwaresGrid.style.display = 'none';
          if (emptyState) emptyState.style.display = 'block';
          return;
        }
        
        // Esconder estado vazio e mostrar grid
        if (softwaresGrid) softwaresGrid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        
        // Limpar grid e renderizar softwares
        softwaresGrid.innerHTML = '';
        
        softwares.forEach(software => {
          // Calcular estatísticas
          const reviewsCount = software.reviews?.length || 0;
          const avgRating = reviewsCount > 0 
            ? software.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewsCount 
            : 0;
          const viewsCount = software.views_count || 0;
          const leadsCount = software.leads_count || 0;
          
          // Determinar status
          let statusClass = 'status-inactive';
          let statusText = 'Inativo';
          
          if (software.status === 'active') {
            statusClass = 'status-active';
            statusText = 'Ativo';
          } else if (software.status === 'pending') {
            statusClass = 'status-pending';
            statusText = 'Em análise';
          }
          
          // Criar card
          const card = document.createElement('div');
          card.className = 'software-card';
          card.dataset.status = software.status || 'inactive';
          
          card.innerHTML = `
            <span class="software-status ${statusClass}">${statusText}</span>
            <div class="software-image">
              <img src="${software.image_url || '/images/default-software.png'}" alt="${software.name}">
            </div>
            <div class="software-content">
              <h3 class="software-name">${software.name}</h3>
              <p class="software-category">
                ${software.software_categories[0]?.categories.name || 'Software'}
              </p>
              <div class="software-stats">
                <span><i class="fas fa-eye"></i> ${viewsCount} visualizações</span>
                <span><i class="fas fa-star"></i> ${avgRating.toFixed(1)}</span>
                <span><i class="fas fa-user-plus"></i> ${leadsCount} leads</span>
              </div>
              <div class="software-actions">
                <button class="action-btn action-edit" data-id="${software.id}">
                  <i class="fas fa-edit"></i> Editar
                </button>
                <button class="action-btn action-view" data-id="${software.id}">
                  <i class="fas fa-external-link-alt"></i> Ver
                </button>
              </div>
            </div>
          `;
          
          softwaresGrid.appendChild(card);
        });
        
        // Adicionar event listeners nos botões
        this.setupSoftwareActions();
        
      } catch (error) {
        console.error('Erro ao carregar softwares:', error);
        if (softwaresGrid) {
          softwaresGrid.innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
              <i class="fas fa-exclamation-triangle" style="font-size: 24px; color: #ff4900;"></i>
              <p style="margin-top: 10px; color: #666;">Erro ao carregar softwares. Tente novamente.</p>
            </div>
          `;
        }
      }
    }

    // Configurar ações nos botões dos cards de software
    setupSoftwareActions() {
      // Botões de edição
      document.querySelectorAll('.action-edit').forEach(button => {
        button.addEventListener('click', (e) => {
          const softwareId = e.currentTarget.dataset.id;
          this.openSoftwareEditor(softwareId);
        });
      });
      
      // Botões de visualização
      document.querySelectorAll('.action-view').forEach(button => {
        button.addEventListener('click', (e) => {
          const softwareId = e.currentTarget.dataset.id;
          window.open(`/software/${softwareId}`, '_blank');
        });
      });
      
      // Botão de adicionar software (estado vazio)
      const emptyAddButton = document.getElementById('empty-add-software-btn');
      if (emptyAddButton) {
        emptyAddButton.addEventListener('click', () => {
          this.openSoftwareEditor();
        });
      }
    }

    // Filtrar softwares por status
    filterSoftwares(status) {
      const cards = document.querySelectorAll('.software-card');
      
      cards.forEach(card => {
        if (status === 'all' || card.dataset.status === status) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    // Abrir editor de software
    openSoftwareEditor(softwareId = null) {
      if (softwareId) {
        console.log(`Editando software ${softwareId}`);
        this.showModal('edit-software-modal');
        // Implementação futura: carregar dados do software
      } else {
        console.log('Criando novo software');
        this.showModal('create-software-modal');
      }
    }

    getMockNotifications() {
      return [
        {
          id: '1',
          title: 'Bem-vindo ao Belga Hub!',
          message: 'Complete seu perfil para receber recomendações personalizadas',
          type: 'info',
          read: false,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Explore nossos softwares',
          message: 'Descubra soluções inovadoras para sua empresa',
          type: 'info',
          read: false,
          created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        }
      ];
    }

    updateNotificationBadge() {
      const badge = document.getElementById('notification-badge');
      if (!badge) return;

      const unreadCount = this.allNotifications.filter(n => !n.read).length;
      
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    async markNotificationAsRead(notificationId) {
      try {
        // Update in memory (for mock notifications)
        const notification = this.allNotifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
        }

        // Update in database when notifications table is properly implemented
        await this.supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

        this.renderNotifications();
        this.updateNotificationBadge();

      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

    async markAllNotificationsRead() {
      try {
        // Update all in memory (for mock notifications)
        this.allNotifications.forEach(n => n.read = true);

        // Update in database when notifications table is properly implemented
        await this.supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', this.user.id);

        this.renderNotifications();
        this.updateNotificationBadge();
        
        alert('Todas as notificações foram marcadas como lidas.');

      } catch (error) {
        console.error('Erro ao marcar notificações como lidas:', error);
        alert('Erro ao atualizar notificações.');
      }
    }

    // HANDLERS
    async handleLogout() {
      try {
        // Desinscrever do canal de notificações se existir
        if (this.notificationsSubscription) {
          await this.notificationsSubscription.unsubscribe();
        }
        
        await this.supabase.auth.signOut();
        window.location.href = '/login.html';
      } catch (error) {
        console.error('Erro no logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
      }
    }

    async handleProfileUpdate(event) {
      const formData = new FormData(event.target);
      const updateData = {};

      // Extract form data
      formData.forEach((value, key) => {
        updateData[key] = value;
      });

      // Add updated timestamp
      updateData.updated_at = new Date().toISOString();

      try {
        const { error } = await this.supabase
          .from('profiles')
          .update(updateData)
          .eq('id', this.user.id);

        if (error) throw error;

        // Reload profile
        await this.loadUserProfile();
        
        alert('Perfil atualizado com sucesso!');

      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        alert('Erro ao atualizar perfil: ' + error.message);
      }
    }

    async handlePreferencesUpdate(event) {
      // For now, just show success message
      // In a real app, you'd save preferences to the database
      alert('Preferências salvas com sucesso!');
    }

    async handlePasswordChange(event) {
      const formData = new FormData(event.target);
      const newPassword = formData.get('newPassword');
      const confirmPassword = formData.get('confirmPassword');

      if (newPassword !== confirmPassword) {
        alert('As senhas não conferem.');
        return;
      }

      if (newPassword.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres.');
        return;
      }

      try {
        const { error } = await this.supabase.auth.updateUser({
          password: newPassword
        });

        if (error) throw error;

        alert('Senha alterada com sucesso!');
        event.target.reset();

      } catch (error) {
        console.error('Erro ao alterar senha:', error);
        alert('Erro ao alterar senha: ' + error.message);
      }
    }

    checkPasswordStrength(password) {
      const strengthIndicator = document.getElementById('password-strength');
      if (!strengthIndicator) return;
      
      let strength = 0;
      if (password.length >= 8) strength++;
      if (/[A-Z]/.test(password)) strength++;
      if (/[a-z]/.test(password)) strength++;
      if (/[0-9]/.test(password)) strength++;
      if (/[^A-Za-z0-9]/.test(password)) strength++;

      strengthIndicator.className = 'password-strength';
      
      if (strength < 2) {
        strengthIndicator.classList.add('weak');
      } else if (strength < 4) {
        strengthIndicator.classList.add('fair');
      } else {
        strengthIndicator.classList.add('strong');
      }
    }

    async handleAvatarUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }

      try {
        // Create preview
        const tempUrl = URL.createObjectURL(file);
        const avatarImg = document.getElementById('profile-avatar');
        if (avatarImg) avatarImg.src = tempUrl;

        // TODO: Implement actual upload to Supabase Storage
        // const filePath = `avatars/${this.user.id}/${Date.now()}-${file.name}`;
        // const { data, error } = await this.supabase.storage
        //   .from('profile-images')
        //   .upload(filePath, file);

      } catch (error) {
        console.error('Erro ao fazer upload da foto:', error);
        alert('Erro ao atualizar a foto, tente novamente');
      }
    }

    async handleCreatePartnership(event) {
      const formData = new FormData(event.target);
      const partnershipData = {};

      formData.forEach((value, key) => {
        if (key === 'training_provided' || key === 'support_provided') {
          partnershipData[key] = value === 'true';
        } else if (key === 'commission_rate') {
          partnershipData[key] = value ? parseFloat(value) : null;
        } else {
          partnershipData[key] = value || null;
        }
      });

      // Add user ID and default values
      partnershipData.user_id = this.user.id;
      partnershipData.active = true;

      try {
        const { error } = await this.supabase
          .from('partnerships')
          .insert(partnershipData);

        if (error) throw error;

        alert('Parceria criada com sucesso!');
        this.closeModal('create-partnership-modal');
        event.target.reset();
        
        // Reload partnerships and stats
        await this.loadUserPartnerships();
        await this.loadUserStats();

      } catch (error) {
        console.error('Erro ao criar parceria:', error);
        alert('Erro ao criar parceria: ' + error.message);
      }
    }

    // Manipulação do formulário de criação de software
    async handleCreateSoftware(event) {
      const formData = new FormData(event.target);
      const softwareData = {};
      
      // Processar checkboxes para arrays
      const companySizes = [];
      const problems = [];
      
      formData.forEach((value, key) => {
        if (key === 'company_size[]') {
          companySizes.push(value);
        } else if (key === 'problems[]') {
          problems.push(value);
        } else if (key === 'partnership_available') {
          this.hasPartnership = value === 'true';
          softwareData[key] = this.hasPartnership;
        } else {
          softwareData[key] = value;
        }
      });
      
      // Adicionar arrays processados
      softwareData.company_sizes = companySizes;
      softwareData.problems = problems;
      
      try {
        // Aqui você implementaria a integração com o Supabase
        console.log('Dados do software a serem enviados:', softwareData);
        
        // Simulação do envio para fins de demonstração
        this.closeModal('create-software-modal');
        event.target.reset();
        
        // Mostrar o modal de sucesso
        this.showSuccessModal();
        
        // Em um sistema real, recarregar a lista
        // await this.loadMySoftwares();
        
      } catch (error) {
        console.error('Erro ao adicionar software:', error);
        alert('Erro ao adicionar software: ' + error.message);
      }
    }
    
    // Exibe o modal de sucesso após criar um software
    showSuccessModal() {
      // Verificar se o software tem parceria disponível
      const partnershipNextSteps = document.getElementById('partnership-next-steps');
      if (partnershipNextSteps) {
        if (this.hasPartnership) {
          partnershipNextSteps.style.display = 'block';
        } else {
          partnershipNextSteps.style.display = 'none';
        }
      }
      
      this.showModal('success-modal');
    }

    async editPartnership(partnershipId) {
      const partnership = this.allPartnerships.find(p => p.id === partnershipId);
      if (!partnership) return;

      // Populate edit modal
      document.getElementById('edit-partnership-id').value = partnership.id;
      document.getElementById('edit-partnership-type').value = partnership.type;
      document.getElementById('edit-partnership-name').value = partnership.name;
      document.getElementById('edit-partnership-whatsapp').value = partnership.whatsapp;
      document.getElementById('edit-partnership-description').value = partnership.description;
      document.getElementById('edit-partnership-location').value = partnership.location || '';
      document.getElementById('edit-partnership-commission').value = partnership.commission_rate || '';
      document.getElementById('edit-partnership-training').value = partnership.training_provided ? 'true' : 'false';
      document.getElementById('edit-partnership-support').value = partnership.support_provided ? 'true' : 'false';

      this.showModal('edit-partnership-modal');
    }

    async handleEditPartnership(event) {
      const formData = new FormData(event.target);
      const updateData = {};

      formData.forEach((value, key) => {
        if (key === 'id') return; // Skip the ID field
        
        if (key === 'training_provided' || key === 'support_provided') {
          updateData[key] = value === 'true';
        } else if (key === 'commission_rate') {
          updateData[key] = value ? parseFloat(value) : null;
        } else {
          updateData[key] = value || null;
        }
      });

      updateData.updated_at = new Date().toISOString();

      try {
        const { error } = await this.supabase
          .from('partnerships')
          .update(updateData)
          .eq('id', formData.get('id'));

        if (error) throw error;

        alert('Parceria atualizada com sucesso!');
        this.closeModal('edit-partnership-modal');
        
        // Reload partnerships
        await this.loadUserPartnerships();
        await this.loadUserStats();

      } catch (error) {
        console.error('Erro ao atualizar parceria:', error);
        alert('Erro ao atualizar parceria: ' + error.message);
      }
    }

    async deletePartnership(partnershipId) {
      if (!confirm('Tem certeza que deseja excluir esta parceria? Esta ação não pode ser desfeita.')) {
        return;
      }

      try {
        const { error } = await this.supabase
          .from('partnerships')
          .delete()
          .eq('id', partnershipId);

        if (error) throw error;

        alert('Parceria excluída com sucesso!');
        
        // Reload partnerships and stats
        await this.loadUserPartnerships();
        await this.loadUserStats();

      } catch (error) {
        console.error('Erro ao excluir parceria:', error);
        alert('Erro ao excluir parceria: ' + error.message);
      }
    }

    async lookupCEP(cep) {
      if (!cep || cep.length < 8) return;
      
      // Clean CEP
      cep = cep.replace(/\D/g, '');
      
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          document.getElementById('city').value = data.localidade;
          document.getElementById('state').value = data.uf;
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }

    updateSessionInfo() {
      const sessionInfo = document.getElementById('current-session-info');
      if (sessionInfo) {
        const browser = this.getBrowserInfo();
        sessionInfo.textContent = `${browser.name} - Agora`;
      }
    }

    createLoadingState(message = 'Carregando...') {
      return `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>${message}</p>
        </div>
      `;
    }

    getBrowserInfo() {
      const userAgent = navigator.userAgent;
      let browserName = 'Navegador desconhecido';
      
      if (userAgent.includes('Chrome')) browserName = 'Chrome';
      else if (userAgent.includes('Firefox')) browserName = 'Firefox';
      else if (userAgent.includes('Safari')) browserName = 'Safari';
      else if (userAgent.includes('Edge')) browserName = 'Edge';
      
      return { name: browserName };
    }

    async deactivateAccount() {
      if (!confirm('Tem certeza que deseja desativar sua conta? Você poderá reativá-la fazendo login novamente.')) {
        return;
      }

      try {
        // TODO: Implement account deactivation logic
        alert('Funcionalidade de desativação será implementada em breve.');
      } catch (error) {
        console.error('Erro ao desativar conta:', error);
        alert('Erro ao desativar conta. Tente novamente.');
      }
    }

    async deleteAccount() {
      if (!confirm('ATENÇÃO: Excluir sua conta é uma ação irreversível. Todos os seus dados serão perdidos permanentemente. Tem certeza?')) {
        return;
      }

      if (!prompt('Digite "EXCLUIR" para confirmar:').toUpperCase().includes('EXCLUIR')) {
        return;
      }

      try {
        // TODO: Implement account deletion logic
        alert('Funcionalidade de exclusão será implementada em breve.');
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        alert('Erro ao excluir conta. Tente novamente.');
      }
    }

    // UTILITIES
    showModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
        // Add class after a small delay for animation
        setTimeout(() => modal.classList.add('active'), 10);
      }
    }

    openModal(modalId) {
      this.showModal(modalId);
    }

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
        // Remove from DOM after animation
        setTimeout(() => modal.style.display = 'none', 300);
      }
    }

    getRoleDisplayName(role) {
      const roleMap = {
        'client': 'Empresário/Gestor',
        'developer': 'Desenvolvedor de Software',
        'partner': 'Consultor/Revendedor'
      };
      return roleMap[role] || role;
    }

    getPartnershipTypeDisplay(type) {
      const typeMap = {
        'resell': 'Revenda',
        'implementation': 'Implementação',
        'lead_generation': 'Geração de Leads'
      };
      return typeMap[type] || type;
    }

    getTimeAgo(date) {
      const now = new Date();
      const past = new Date(date);
      const diffInSeconds = Math.floor((now - past) / 1000);

      if (diffInSeconds < 60) return 'Agora mesmo';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}min atrás`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d atrás`;
      
      return past.toLocaleDateString('pt-BR');
    }
  }

  // Initialize profile page
  console.log('Criando instância do perfil...');
  window.profileInstance = new ProfilePage();
});
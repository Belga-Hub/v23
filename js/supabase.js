// js/supabase.js

const supabaseUrl = 'https://lskcucdjrubwinhqfgcy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza2N1Y2RqcnVid2luaHFmZ2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNzIzNjYsImV4cCI6MjA2Mjc0ODM2Nn0.o_IIReMU-91UnBHBVzvMLrdYG8XPPO-u4kuLwsMMDAY'

// Função para configurar rastreamento de links externos
function setupExternalLinkTracking(supabase) {
  console.log('Configurando rastreamento de links externos...')
  
  document.addEventListener('click', async function(e) {
    // Encontrar o link clicado (possivelmente um elemento pai)
    const link = e.target.closest('a')
    
    // Se não for um link, ignorar
    if (!link) return
    
    const href = link.getAttribute('href')
    
    // Verificar se é um link externo
    if (href && 
        !href.startsWith('#') && 
        !href.startsWith('/') && 
        !href.includes('belgahub.com.br')) {
        
      try {
        // Determinar o tipo de link
        let linkType = 'external'
        if (href.includes('whatsapp.com') || href.includes('wa.me')) {
          linkType = 'whatsapp'
        } else if (href.includes('linkedin.com')) {
          linkType = 'linkedin'
        } else if (href.includes('instagram.com')) {
          linkType = 'instagram'
        } else if (href.includes('mail')) {
          linkType = 'email'
        }
        
        // Obter dados contextuais
        const linkText = link.innerText || 'Sem texto'
        const context = link.closest('.software-card, .partnership-card, .partnership-item') || null
        const entityId = context ? 
          (context.dataset.softwareId || context.dataset.partnershipId || 'desconhecido') : 
          'desconhecido'
        
        // Obter usuário atual
        let userId = 'anônimo'
        try {
          const { data } = await supabase.auth.getUser()
          if (data && data.user) {
            userId = data.user.id
          }
        } catch (authError) {
          console.log('Usuário não autenticado')
        }
        
        // Dados para registro
        const clickData = {
          user_id: userId,
          link_url: href,
          link_type: linkType,
          link_text: linkText,
          entity_id: entityId,
          page_url: window.location.href,
          clicked_at: new Date().toISOString()
        }
        
        console.log('Link externo clicado:', clickData)
        
        // Registrar no Supabase (assíncrono, não bloqueia a navegação)
        supabase.from('external_clicks').insert([clickData])
          .then(response => {
            if (response.error) {
              console.error('Erro ao registrar clique:', response.error)
            }
          })
        
      } catch (error) {
        console.error('Erro ao processar clique em link externo:', error)
      }
    }
  })
}

// Nova abordagem: carregar o Supabase via script tag e inicializar depois
function initSupabase() {
  // Verificar se já existe
  if (window.supabase) {
    setupSupabase();
    return;
  }
  
  // Criar script tag
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/dist/umd/supabase.min.js';
  script.async = true;
  
  script.onload = function() {
    setupSupabase();
  };
  
  script.onerror = function(error) {
    console.error('Erro ao carregar Supabase:', error);
  };
  
  document.head.appendChild(script);
}

function setupSupabase() {
  try {
    // Criar cliente Supabase usando o objeto global supabase
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    
    // Disponibilizar globalmente
    window.supabaseClient = supabase;
    
    // Configurar rastreamento de links
    setupExternalLinkTracking(supabase);
    
    // Sinalizar que está pronto
    window.supabaseReady = true;
    document.dispatchEvent(new Event('supabase-ready'));
    
    console.log('Supabase inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao configurar Supabase:', error);
  }
}

// Inicializar
initSupabase();
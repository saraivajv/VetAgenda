// ============================================================================
// VETAGENDA - CORE APPLICATION LOGIC
// ============================================================================

// --- CONFIGURAÇÕES E ESTADO DO BANCO DE DADOS MOCKADO ---
const DB_KEY = 'vetagenda_db';

// Dados iniciais padrão do aplicativo
const INITIAL_DATABASE = {
  vets: [
    { id: "vet-1", name: "Dr. Silva", specialty: "Clínica Geral", avatar: "S" },
    { id: "vet-2", name: "Dra. Maria", specialty: "Dermatologia", avatar: "M" },
    { id: "vet-3", name: "Dr. Marcos", specialty: "Cardiologia", avatar: "MC" },
    { id: "vet-4", name: "Dra. Julia", specialty: "Ortopedia", avatar: "J" }
  ],
  pets: [
    { id: "pet-1", name: "Rex", species: "Cachorro", breed: "Golden Retriever", age: "3 anos", weight: "32kg", tutor: "Carlos Mendes", type: "dog" },
    { id: "pet-2", name: "Mia", species: "Gato", breed: "Siamês", age: "2 anos", weight: "4.5kg", tutor: "Ana Clara", type: "cat" },
    { id: "pet-3", name: "Thor", species: "Cachorro", breed: "Bulldog Francês", age: "5 anos", weight: "12kg", tutor: "Roberto Dias", type: "dog" },
    { id: "pet-4", name: "Pipoca", species: "Gato", breed: "Persa", age: "1 ano", weight: "3.8kg", tutor: "Carlos Mendes", type: "cat" },
    { id: "pet-5", name: "Luna", species: "Cachorro", breed: "Poodle", age: "4 anos", weight: "6kg", tutor: "Carlos Mendes", type: "dog" }
  ],
  appointments: [], // Preenchido dinamicamente abaixo
  medicalRecords: [
    {
      id: "mr-1",
      petId: "pet-1",
      date: "2026-05-10",
      type: "Consulta",
      title: "Consulta de Rotina",
      description: "Paciente pesou 32kg, vacinas em dia. Apresenta boa dentição e comportamento ativo. Recomendado manter ração super premium.",
      vetName: "Dr. Silva"
    },
    {
      id: "mr-2",
      petId: "pet-1",
      date: "2026-02-15",
      type: "Vacina",
      title: "Aplicação da Vacina V10",
      description: "Aplicação anual de reforço da vacina múltipla (V10). Sem reações imediatas.",
      vetName: "Dra. Maria"
    },
    {
      id: "mr-3",
      petId: "pet-2",
      date: "2026-04-20",
      type: "Procedimento",
      title: "Limpeza de Tártaro",
      description: "Profilaxia dentária realizada sob anestesia geral inalatória. Remoção de tártaro e polimento. Recuperação pós-anestésica tranquila.",
      vetName: "Dr. Silva"
    },
    {
      id: "mr-4",
      petId: "pet-3",
      date: "2026-06-02",
      type: "Consulta",
      title: "Consulta Dermatológica",
      description: "Apresenta prurido intenso e eritema na região abdominal. Coleta de raspado de pele realizada (negativo para ectoparasitas). Diagnosticado com dermatite alérgica tópica. Receitado shampoo hipoalergênico e anti-inflamatório.",
      vetName: "Dra. Maria"
    }
  ]
};

// Inicializa consultas iniciais com base na data de hoje
const initDefaultAppointments = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  return [
    {
      id: "apt-1",
      petId: "pet-1",
      petName: "Rex",
      tutorName: "Carlos Mendes",
      vetId: "vet-1",
      vetName: "Dr. Silva",
      specialty: "Clínica Geral",
      date: todayStr,
      time: "09:00",
      status: "Confirmado",
      type: "routine"
    },
    {
      id: "apt-2",
      petId: "pet-2",
      petName: "Mia",
      tutorName: "Ana Clara",
      vetId: "vet-2",
      vetName: "Dra. Maria",
      specialty: "Dermatologia",
      date: todayStr,
      time: "10:30",
      status: "Aguardando",
      type: "vaccine"
    },
    {
      id: "apt-3",
      petId: "pet-3",
      petName: "Thor",
      tutorName: "Roberto Dias",
      vetId: "vet-3",
      vetName: "Dr. Marcos",
      specialty: "Cardiologia",
      date: todayStr,
      time: "11:15",
      status: "Confirmado",
      type: "emergency"
    }
  ];
};

// --- OBJETO DE GERENCIAMENTO DE ESTADO (STORE) ---
const AppStore = {
  db: null,
  currentUser: null,

  // Inicializa o banco de dados carregando do localStorage ou usando padrões
  init() {
    let saved = localStorage.getItem(DB_KEY);
    if (saved) {
      try {
        this.db = JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao analisar banco de dados salvo, resetando...", e);
        this.resetDB();
      }
    } else {
      this.resetDB();
    }

    // Carrega sessão atual
    let savedSession = localStorage.getItem('vetagenda_session');
    if (savedSession) {
      try {
        this.currentUser = JSON.parse(savedSession);
      } catch (e) {
        this.currentUser = null;
      }
    }
  },

  // Grava o estado atual no localStorage
  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.db));
  },

  // Reseta para os dados de fábrica
  resetDB() {
    this.db = { ...INITIAL_DATABASE };
    this.db.appointments = initDefaultAppointments();
    this.save();
  },

  // Autenticação mockada
  login(email, password, roleOverride = null) {
    let user = null;
    if (roleOverride === 'vet' || email === 'dr.silva@vetagenda.com') {
      user = { name: "Dr. Silva", email: "dr.silva@vetagenda.com", role: "vet", avatar: "S" };
    } else if (roleOverride === 'tutor' || email === 'carlos@vetagenda.com') {
      user = { name: "Carlos Mendes", email: "carlos@vetagenda.com", role: "tutor", avatar: "C" };
    } else {
      // Qualquer outro email loga como tutor genérico
      const name = email.split('@')[0];
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
      user = { name: capitalized, email: email, role: "tutor", avatar: capitalized.charAt(0) };
    }

    this.currentUser = user;
    localStorage.setItem('vetagenda_session', JSON.stringify(user));
    return user;
  },

  // Encerra a sessão
  logout() {
    this.currentUser = null;
    localStorage.removeItem('vetagenda_session');
  },

  // Adiciona consulta
  addAppointment(appointment) {
    this.db.appointments.push(appointment);
    this.save();
  },

  // Atualiza status da consulta
  updateAppointmentStatus(aptId, newStatus) {
    const apt = this.db.appointments.find(a => a.id === aptId);
    if (apt) {
      apt.status = newStatus;
      this.save();
      return true;
    }
    return false;
  },

  // Adiciona ficha de prontuário
  addMedicalRecord(record) {
    this.db.medicalRecords.push(record);
    this.save();
  }
};

// --- CORE DA APLICAÇÃO VETAGENDA ---
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar estado
  AppStore.init();

  // Elementos do DOM
  const els = {
    loginScreen: document.getElementById("loginScreen"),
    sidebar: document.querySelector(".sidebar"),
    mainContent: document.querySelector(".main-content"),
    mobileTopbar: document.querySelector(".mobile-topbar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    menuToggle: document.getElementById("menuToggle"),
    
    // Links de navegação da barra lateral
    navLinks: document.querySelector(".nav-links"),

    // Cabeçalho dinâmico
    headerTitle: document.querySelector(".header h2"),
    headerSubtitle: document.getElementById("headerSubtitle"),
    headerAvatar: document.querySelector(".header .avatar"),
    headerProfileName: document.querySelector(".header .user-profile span"),

    // Seções
    sections: {
      panel: document.getElementById("section-panel"),
      agenda: document.getElementById("section-agenda"),
      booking: document.getElementById("section-booking"),
      confirmation: document.getElementById("section-confirmation"),
      patients: document.getElementById("section-patients")
    },

    // Painel (Dashboard)
    panelStatsGrid: document.getElementById("panelStatsGrid"),
    panelRecentAppointments: document.getElementById("panelRecentAppointmentsTable"),

    // Formulário de Login
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    btnQuickVet: document.getElementById("btnQuickVet"),
    btnQuickTutor: document.getElementById("btnQuickTutor"),

    // Agenda
    agendaDateDisplay: document.getElementById("agendaDateDisplay"),
    agendaFilterStatus: document.getElementById("agendaFilterStatus"),
    agendaFilterVet: document.getElementById("agendaFilterVet"),
    agendaTableBody: document.getElementById("agendaTableBody"),
    calendarGrid: document.getElementById("calendarGrid"),
    calendarMonthYear: document.getElementById("calendarMonthYear"),
    prevMonthBtn: document.getElementById("prevMonthBtn"),
    nextMonthBtn: document.getElementById("nextMonthBtn"),

    // Marcação
    bookingForm: document.getElementById("bookingForm"),
    selectPet: document.getElementById("selectPet"),
    selectSpecialty: document.getElementById("selectSpecialty"),
    selectVet: document.getElementById("selectVet"),
    inputDate: document.getElementById("bookingDate"),
    timeSlotsGrid: document.getElementById("timeSlotsGrid"),
    
    // Resumo de Marcação
    summaryPet: document.getElementById("summaryPet"),
    summarySpecialty: document.getElementById("summarySpecialty"),
    summaryVet: document.getElementById("summaryVet"),
    summaryDate: document.getElementById("summaryDate"),
    summaryTime: document.getElementById("summaryTime"),
    bookingSubmitBtn: document.getElementById("bookingSubmitBtn"),

    // Confirmação
    confirmPet: document.getElementById("confirmPet"),
    confirmVet: document.getElementById("confirmVet"),
    confirmDate: document.getElementById("confirmDate"),
    confirmStatus: document.getElementById("confirmStatus"),
    btnConfirmGoAgenda: document.getElementById("btnConfirmGoAgenda"),
    btnConfirmGoPanel: document.getElementById("btnConfirmGoPanel"),

    // Histórico/Pacientes
    patientSearchInput: document.getElementById("patientSearchInput"),
    patientsListGroup: document.getElementById("patientsListGroup"),
    patientDetailCard: document.getElementById("patientDetailCard"),
    patientDetailPlaceholder: document.getElementById("patientDetailPlaceholder"),
    
    // Detalhes do Pet Selecionado
    detailPetName: document.getElementById("detailPetName"),
    detailPetSpecies: document.getElementById("detailPetSpecies"),
    detailPetBreed: document.getElementById("detailPetBreed"),
    detailPetAge: document.getElementById("detailPetAge"),
    detailPetWeight: document.getElementById("detailPetWeight"),
    detailPetTutor: document.getElementById("detailPetTutor"),
    detailPetAvatarIcon: document.getElementById("detailPetAvatarIcon"),
    petMedicalTimeline: document.getElementById("petMedicalTimeline"),
    
    // Formulário de Prontuário (Apenas Veterinário)
    vetRecordFormContainer: document.getElementById("vetRecordFormContainer"),
    addRecordForm: document.getElementById("addRecordForm"),
    recordType: document.getElementById("recordType"),
    recordTitle: document.getElementById("recordTitle"),
    recordDesc: document.getElementById("recordDesc"),

    // Cadastro de Pet
    btnNewPet: document.getElementById("btnNewPet"),
    newPetFormCard: document.getElementById("newPetFormCard"),
    addPetForm: document.getElementById("addPetForm"),
    btnCancelAddPet: document.getElementById("btnCancelAddPet"),
    petFormName: document.getElementById("petFormName"),
    petFormSpecies: document.getElementById("petFormSpecies"),
    petFormBreed: document.getElementById("petFormBreed"),
    petFormAge: document.getElementById("petFormAge"),
    petFormWeight: document.getElementById("petFormWeight"),
    petFormTutor: document.getElementById("petFormTutor")
  };

  // --- CONTROLE DE ROTAS SPA ---
  function navigateTo(sectionId) {
    // Esconde todas as seções
    Object.keys(els.sections).forEach(key => {
      if (els.sections[key]) {
        els.sections[key].classList.add("hidden");
      }
    });

    // Mostra a seção ativa
    if (els.sections[sectionId]) {
      els.sections[sectionId].classList.remove("hidden");
    }

    // Atualiza links da barra lateral
    const links = els.navLinks.querySelectorAll("a");
    links.forEach(link => {
      const target = link.getAttribute("data-target");
      if (target === sectionId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Fecha menu mobile se aberto
    if (els.sidebar.classList.contains("active")) {
      toggleMenu();
    }

    // Renderiza a seção correspondente para garantir dados frescos
    renderSection(sectionId);
    
    // Executa recriação de ícones do Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Registra eventos nos links da sidebar
  els.navLinks.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    e.preventDefault();
    const target = link.getAttribute("data-target");
    
    if (target === "logout") {
      logout();
    } else if (target) {
      navigateTo(target);
    }
  });

  // Novo Agendamento a partir do Dashboard ou Agenda
  document.addEventListener("click", (e) => {
    const newBookingBtn = e.target.closest(".btn-new");
    if (newBookingBtn) {
      e.preventDefault();
      navigateTo("booking");
    }
  });

  // --- SISTEMA DE SESSÃO / LOGIN ---
  function checkSession() {
    if (AppStore.currentUser) {
      // Logado
      els.loginScreen.classList.add("hidden");
      els.sidebar.classList.remove("hidden");
      els.mainContent.classList.remove("hidden");
      if (window.innerWidth <= 768) {
        els.mobileTopbar.style.display = 'flex';
      }

      // Configura header e visibilidade do menu
      setupRoleSidebar();
      updateHeader();
      
      // Vai para o painel por padrão
      navigateTo("panel");
    } else {
      // Deslogado
      els.loginScreen.classList.remove("hidden");
      els.sidebar.classList.add("hidden");
      els.mainContent.classList.add("hidden");
      els.mobileTopbar.style.display = 'none';
      els.sidebarOverlay.classList.remove("active");
    }
  }

  function handleLogin(email, password, roleOverride = null) {
    const user = AppStore.login(email, password, roleOverride);
    checkSession();
  }

  function logout() {
    AppStore.logout();
    checkSession();
  }

  // Eventos de Login
  if (els.loginForm) {
    els.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = els.loginEmail.value || 'tutor@vetagenda.com';
      handleLogin(email, '123456');
    });
  }

  if (els.btnQuickVet) {
    els.btnQuickVet.addEventListener("click", () => {
      handleLogin('dr.silva@vetagenda.com', '123', 'vet');
    });
  }

  if (els.btnQuickTutor) {
    els.btnQuickTutor.addEventListener("click", () => {
      handleLogin('carlos@vetagenda.com', '123', 'tutor');
    });
  }

  function updateHeader() {
    if (!AppStore.currentUser) return;
    const user = AppStore.currentUser;

    if (user.role === 'vet') {
      els.headerTitle.textContent = `Olá, ${user.name} 👋`;
      els.headerSubtitle.textContent = "Aqui está o resumo da sua clínica hoje.";
    } else {
      els.headerTitle.textContent = `Olá, ${user.name} 👋`;
      els.headerSubtitle.textContent = "Aqui estão os seus pets e agendamentos.";
    }

    els.headerAvatar.textContent = user.avatar;
    els.headerProfileName.textContent = user.name;
  }

  function setupRoleSidebar() {
    if (!AppStore.currentUser) return;
    const role = AppStore.currentUser.role;

    // Define quais abas o Tutor e o Veterinário podem ver
    const links = els.navLinks.querySelectorAll("li");
    links.forEach(li => {
      const link = li.querySelector("a");
      const target = link.getAttribute("data-target");

      if (target === 'agenda' && role === 'tutor') {
        // Tutor não vê agenda clínica geral, vê apenas seus agendamentos no painel/histórico
        li.classList.add("hidden");
      } else {
        li.classList.remove("hidden");
      }

      // Renomeia "Pacientes" para "Meus Pets" para o Tutor
      if (target === 'patients') {
        if (role === 'tutor') {
          link.innerHTML = '<i data-lucide="dog"></i> Meus Pets';
        } else {
          link.innerHTML = '<i data-lucide="dog"></i> Pacientes';
        }
      }
    });
  }


  // --- RENDERIZAÇÃO DAS SEÇÕES ---
  function renderSection(sectionId) {
    switch (sectionId) {
      case "panel":
        renderPanel();
        break;
      case "agenda":
        renderAgenda();
        break;
      case "booking":
        resetBookingForm();
        break;
      case "patients":
        renderPatients();
        break;
    }
  }

  // --- SEÇÃO 1: PAINEL ---
  function renderPanel() {
    const role = AppStore.currentUser.role;
    const name = AppStore.currentUser.name;
    const appointments = AppStore.db.appointments;
    const pets = AppStore.db.pets;
    const todayStr = new Date().toISOString().split('T')[0];

    // Limpa Grid de Status
    els.panelStatsGrid.innerHTML = '';

    // Filtragem de dados com base no papel logado
    let displayApts = [];
    if (role === 'vet') {
      displayApts = appointments.filter(a => a.date === todayStr);

      const consultationsCount = displayApts.length;
      const totalPatients = pets.length;
      const pendingCount = displayApts.filter(a => a.status === 'Aguardando').length;

      // Stats do Vet
      els.panelStatsGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue"><i data-lucide="calendar-check"></i></div>
          <div class="stat-info">
            <p>Consultas Hoje</p>
            <h3>${consultationsCount}</h3>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i data-lucide="activity"></i></div>
          <div class="stat-info">
            <p>Total de Pacientes</p>
            <h3>${totalPatients}</h3>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i data-lucide="clock"></i></div>
          <div class="stat-info">
            <p>Aguardando Confirmação</p>
            <h3>${pendingCount}</h3>
          </div>
        </div>
      `;
    } else {
      // Filtra pets do tutor logado
      const tutorPets = pets.filter(p => p.tutor === name);
      const petIds = tutorPets.map(p => p.id);
      
      // Filtra consultas dos pets do tutor
      displayApts = appointments.filter(a => petIds.includes(a.petId));
      
      // Filtra futuras consultas
      const upcomingCount = displayApts.filter(a => a.status !== 'Cancelado' && a.status !== 'Concluído').length;

      // Pegar última vacina nos records
      const tutorRecords = AppStore.db.medicalRecords.filter(r => petIds.includes(r.petId) && r.type === 'Vacina');
      let lastVaccineDate = 'Nenhuma';
      if (tutorRecords.length > 0) {
        // Ordena por data decrescente
        tutorRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
        const dateObj = new Date(tutorRecords[0].date);
        lastVaccineDate = dateObj.toLocaleDateString('pt-BR');
      }

      // Stats do Tutor
      els.panelStatsGrid.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue"><i data-lucide="dog"></i></div>
          <div class="stat-info">
            <p>Meus Pets</p>
            <h3>${tutorPets.length}</h3>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i data-lucide="calendar"></i></div>
          <div class="stat-info">
            <p>Consultas Ativas</p>
            <h3>${upcomingCount}</h3>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i data-lucide="shield-check"></i></div>
          <div class="stat-info">
            <p>Última Vacina</p>
            <h3>${lastVaccineDate}</h3>
          </div>
        </div>
      `;
    }

    // Renderizar tabela do Painel
    const tbody = els.panelRecentAppointments.querySelector("tbody");
    tbody.innerHTML = '';

    // Ordenação dos compromissos (por hora)
    let sortedApts = [...displayApts];
    if (role === 'vet') {
      sortedApts.sort((a,b) => a.time.localeCompare(b.time));
    } else {
      // Tutor vê todos os compromissos dele ordenados por data futura
      sortedApts.sort((a,b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
    }

    if (sortedApts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${role === 'vet' ? 5 : 6}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Nenhum agendamento encontrado para o seu perfil.
          </td>
        </tr>
      `;
    } else {
      sortedApts.forEach(apt => {
        const pet = pets.find(p => p.id === apt.petId) || { type: 'dog' };
        const petIcon = pet.type === 'cat' ? 'cat' : 'dog';
        const formattedDate = new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR');
        
        let statusColor = 'var(--text-muted)';
        if (apt.status === 'Confirmado') statusColor = 'var(--success)';
        if (apt.status === 'Concluído') statusColor = '#3b82f6';
        if (apt.status === 'Cancelado') statusColor = '#ef4444';
        if (apt.status === 'Aguardando') statusColor = '#f59e0b';

        // Renderiza linha
        const tr = document.createElement("tr");
        
        let actionColumn = '';
        if (role === 'vet') {
          // Ações do Veterinário no Painel
          actionColumn = `
            <td data-label="Ação">
              <div class="action-buttons-flex">
                ${apt.status === 'Aguardando' ? `<button class="btn-action confirm" data-id="${apt.id}" title="Confirmar"><i data-lucide="check"></i></button>` : ''}
                ${apt.status !== 'Concluído' && apt.status !== 'Cancelado' ? `
                  <button class="btn-action complete" data-id="${apt.id}" title="Concluir"><i data-lucide="check-square"></i></button>
                  <button class="btn-action cancel" data-id="${apt.id}" title="Cancelar"><i data-lucide="x-circle"></i></button>
                ` : '<span style="font-size:0.8rem; color:var(--text-muted)">Sem ações</span>'}
              </div>
            </td>
          `;
        } else {
          // Tutor apenas vê os detalhes
          actionColumn = `
            <td data-label="Ação">
              ${apt.status === 'Aguardando' || apt.status === 'Confirmado' ? `
                <button class="btn-action cancel" data-id="${apt.id}" title="Cancelar Agendamento"><i data-lucide="trash-2"></i> Cancelar</button>
              ` : '<span style="font-size:0.8rem; color:var(--text-muted)">Finalizado</span>'}
            </td>
          `;
        }

        tr.innerHTML = `
          <td data-label="Data/Hora" style="font-weight: 500">${role === 'vet' ? apt.time : `${formattedDate} às ${apt.time}`}</td>
          <td data-label="Paciente">
            <div class="pet-info">
              <div class="pet-avatar"><i data-lucide="${petIcon}" size="18"></i></div>
              <div class="pet-details">
                <strong>${apt.petName}</strong>
                <span>${apt.tutorName}</span>
              </div>
            </div>
          </td>
          <td data-label="Especialidade/Médico">
            <div style="display:flex; flex-direction:column;">
              <span class="badge routine" style="font-size:0.7rem; align-self: flex-start; margin-bottom: 2px;">${apt.specialty}</span>
              <span style="font-size:0.85rem; color:var(--text-muted)">Prof: ${apt.vetName}</span>
            </div>
          </td>
          <td data-label="Status" style="color: ${statusColor}; font-weight: 600; font-size: 0.875rem;">
            ${apt.status}
          </td>
          ${actionColumn}
        `;
        tbody.appendChild(tr);
      });
    }

    }

  function handleTableActionClick(e) {
    const btn = e.target.closest(".btn-action");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute("data-id");
    const role = AppStore.currentUser.role;
    
    if (btn.classList.contains("confirm")) {
      AppStore.updateAppointmentStatus(id, "Confirmado");
      renderPanel();
      if (role === 'vet') renderAgenda();
    } else if (btn.classList.contains("cancel")) {
      if (confirm("Tem certeza que deseja cancelar esta consulta?")) {
        AppStore.updateAppointmentStatus(id, "Cancelado");
        renderPanel();
        if (role === 'vet') renderAgenda();
      }
    } else if (btn.classList.contains("complete")) {
      const apt = AppStore.db.appointments.find(a => a.id === id);
      if (apt) {
        AppStore.updateAppointmentStatus(id, "Concluído");
        if (confirm("Consulta concluída! Deseja registrar a ficha médica/prontuário do paciente agora?")) {
          navigateTo("patients");
          selectPatientById(apt.petId);
          els.recordTitle.value = `Atendimento - ${apt.specialty}`;
          els.recordDesc.value = `Consulta de ${apt.specialty} realizada pelo ${apt.vetName} em ${new Date().toLocaleDateString('pt-BR')}. Notas clínicas: `;
          els.recordType.value = "Consulta";
          els.recordDesc.focus();
        } else {
          renderPanel();
          if (role === 'vet') renderAgenda();
        }
      }
    }
  }


  // --- SEÇÃO 2: AGENDA CLÍNICA (VETERINÁRIO) ---
  let agendaSelectedDate = new Date(); // Inicia com hoje

  function renderAgenda() {
    const todayStr = agendaSelectedDate.toISOString().split('T')[0];
    
    // Atualiza cabeçalho com a data formatada
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    els.agendaDateDisplay.textContent = agendaSelectedDate.toLocaleDateString('pt-BR', options);

    // Carregar veterinários no filtro
    if (els.agendaFilterVet.options.length <= 1) {
      els.agendaFilterVet.innerHTML = '<option value="all">Todos os Profissionais</option>';
      AppStore.db.vets.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = `${v.name} (${v.specialty})`;
        els.agendaFilterVet.appendChild(opt);
      });
    }

    // Filtrar consultas da data escolhida e dos filtros de status/vet
    const selectedVet = els.agendaFilterVet.value;
    const selectedStatus = els.agendaFilterStatus.value;
    
    const dayAppointments = AppStore.db.appointments.filter(apt => {
      const matchDate = apt.date === todayStr;
      const matchVet = selectedVet === 'all' || apt.vetId === selectedVet;
      const matchStatus = selectedStatus === 'all' || apt.status === selectedStatus;
      return matchDate && matchVet && matchStatus;
    });

    // Ordena por hora
    dayAppointments.sort((a,b) => a.time.localeCompare(b.time));

    // Renderizar tabela de Agenda
    els.agendaTableBody.innerHTML = '';

    if (dayAppointments.length === 0) {
      els.agendaTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            Nenhuma consulta agendada para os filtros selecionados neste dia.
          </td>
        </tr>
      `;
    } else {
      dayAppointments.forEach(apt => {
        const pet = AppStore.db.pets.find(p => p.id === apt.petId) || { type: 'dog' };
        const petIcon = pet.type === 'cat' ? 'cat' : 'dog';

        let statusColor = 'var(--text-muted)';
        if (apt.status === 'Confirmado') statusColor = 'var(--success)';
        if (apt.status === 'Concluído') statusColor = '#3b82f6';
        if (apt.status === 'Cancelado') statusColor = '#ef4444';
        if (apt.status === 'Aguardando') statusColor = '#f59e0b';

        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td data-label="Horário" style="font-weight: 600; font-size:1.05rem;">${apt.time}</td>
          <td data-label="Paciente">
            <div class="pet-info">
              <div class="pet-avatar"><i data-lucide="${petIcon}" size="18"></i></div>
              <div class="pet-details">
                <strong>${apt.petName}</strong>
                <span>${apt.tutorName}</span>
              </div>
            </div>
          </td>
          <td data-label="Especialidade">${apt.specialty}</td>
          <td data-label="Profissional">
            <div style="font-weight:500; font-size:0.9rem;">${apt.vetName}</div>
          </td>
          <td data-label="Status" style="color: ${statusColor}; font-weight: 600; font-size:0.875rem;">
            ${apt.status}
          </td>
          <td data-label="Ações">
            <div class="action-buttons-flex">
              ${apt.status === 'Aguardando' ? `<button class="btn-action confirm" data-id="${apt.id}" title="Confirmar"><i data-lucide="check"></i></button>` : ''}
              ${apt.status !== 'Concluído' && apt.status !== 'Cancelado' ? `
                <button class="btn-action complete" data-id="${apt.id}" title="Concluir Consulta"><i data-lucide="check-square"></i></button>
                <button class="btn-action cancel" data-id="${apt.id}" title="Cancelar"><i data-lucide="x-circle"></i></button>
              ` : '<span style="font-size:0.8rem; color:var(--text-muted)">Sem ações</span>'}
            </div>
          </td>
        `;
        els.agendaTableBody.appendChild(tr);
      });
    }

    // Renderizar Calendário Compacto Lateral
    renderMiniCalendar();
  }

  // Lógica do Filtro da Agenda
  if (els.agendaFilterStatus) {
    els.agendaFilterStatus.addEventListener("change", renderAgenda);
  }
  if (els.agendaFilterVet) {
    els.agendaFilterVet.addEventListener("change", renderAgenda);
  }

  // --- LÓGICA DO MINI CALENDÁRIO ---
  let calendarCurrentMonth = new Date().getMonth();
  let calendarCurrentYear = new Date().getFullYear();

  function renderMiniCalendar() {
    const firstDayIndex = new Date(calendarCurrentYear, calendarCurrentMonth, 1).getDay();
    const lastDay = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();
    
    // Meses em português
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    els.calendarMonthYear.textContent = `${months[calendarCurrentMonth]} ${calendarCurrentYear}`;
    
    // Limpa calendário
    els.calendarGrid.innerHTML = '';

    // Cabeçalhos dos dias da semana
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    weekDays.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "calendar-cell header-cell";
      cell.textContent = day;
      els.calendarGrid.appendChild(cell);
    });

    // Células vazias até o início do mês
    for (let i = 0; i < firstDayIndex; i++) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell empty";
      els.calendarGrid.appendChild(cell);
    }

    // Dias do mês
    const todayStr = new Date().toISOString().split('T')[0];
    const activeSelectedStr = agendaSelectedDate.toISOString().split('T')[0];

    for (let day = 1; day <= lastDay; day++) {
      const dateForCell = new Date(calendarCurrentYear, calendarCurrentMonth, day);
      const dateStr = dateForCell.toISOString().split('T')[0];
      
      const cell = document.createElement("button");
      cell.className = "calendar-cell day-cell";
      cell.textContent = day;

      // Marcadores especiais
      if (dateStr === todayStr) {
        cell.classList.add("today");
      }
      if (dateStr === activeSelectedStr) {
        cell.classList.add("selected");
      }

      // Adicionar bolinha verde se houver consulta agendada nesse dia
      const hasApts = AppStore.db.appointments.some(a => a.date === dateStr && a.status !== 'Cancelado');
      if (hasApts) {
        cell.classList.add("has-events");
      }

      // Evento de clique
      cell.addEventListener("click", () => {
        agendaSelectedDate = dateForCell;
        renderAgenda();
      });

      els.calendarGrid.appendChild(cell);
    }
  }

  // Controles de navegação do calendário
  if (els.prevMonthBtn) {
    els.prevMonthBtn.addEventListener("click", () => {
      calendarCurrentMonth--;
      if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
      }
      renderMiniCalendar();
    });
  }

  if (els.nextMonthBtn) {
    els.nextMonthBtn.addEventListener("click", () => {
      calendarCurrentMonth++;
      if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
      }
      renderMiniCalendar();
    });
  }


  // --- SEÇÃO 3: TELA DE MARCAÇÃO DE CONSULTA ---
  let selectedTimeSlot = null;

  function resetBookingForm() {
    selectedTimeSlot = null;
    els.bookingForm.reset();

    // Restringe o input de data para hoje ou futuro
    const today = new Date().toISOString().split('T')[0];
    els.inputDate.setAttribute("min", today);
    els.inputDate.value = today;

    // Carregar pets com base no papel
    const role = AppStore.currentUser.role;
    els.selectPet.innerHTML = '<option value="" disabled selected>Selecione o paciente</option>';
    
    let displayPets = AppStore.db.pets;
    if (role === 'tutor') {
      displayPets = AppStore.db.pets.filter(p => p.tutor === AppStore.currentUser.name);
    }

    displayPets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.species} - ${p.breed})`;
      els.selectPet.appendChild(opt);
    });

    // Reseta especialidades
    els.selectSpecialty.innerHTML = `
      <option value="" disabled selected>Selecione a especialidade</option>
      <option value="Clínica Geral">Clínica Geral</option>
      <option value="Dermatologia">Dermatologia</option>
      <option value="Cardiologia">Cardiologia</option>
      <option value="Ortopedia">Ortopedia</option>
    `;

    // Reseta selects dependentes
    els.selectVet.innerHTML = '<option value="" disabled selected>Aguardando especialidade</option>';
    els.selectVet.disabled = true;

    // Limpa time slots
    els.timeSlotsGrid.innerHTML = '<p style="color:var(--text-muted); grid-column: 1/-1; text-align:center;">Selecione o profissional e a data para ver os horários</p>';

    // Atualiza resumo
    updateBookingSummary();
  }

  // Select encadeado: Especialidade -> Vets
  els.selectSpecialty.addEventListener("change", () => {
    const specialty = els.selectSpecialty.value;
    els.selectVet.innerHTML = '<option value="" disabled selected>Selecione o profissional</option>';
    els.selectVet.disabled = false;

    const filteredVets = AppStore.db.vets.filter(v => v.specialty === specialty);
    filteredVets.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      els.selectVet.appendChild(opt);
    });

    if (filteredVets.length === 1) {
      els.selectVet.value = filteredVets[0].id;
      els.selectVet.dispatchEvent(new Event('change'));
    }

    updateBookingSummary();
  });

  // Mudou o Veterinário ou a Data -> Gera Horários Disponíveis
  els.selectVet.addEventListener("change", generateAvailableTimeSlots);
  els.inputDate.addEventListener("change", generateAvailableTimeSlots);
  els.selectPet.addEventListener("change", updateBookingSummary);

  function generateAvailableTimeSlots() {
    updateBookingSummary();

    const vetId = els.selectVet.value;
    const date = els.inputDate.value;

    if (!vetId || !date) {
      return;
    }

    // Horários padrão de atendimento
    const defaultSlots = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
    
    // Consulta os agendamentos existentes para esse médico nessa data
    const activeAppointments = AppStore.db.appointments.filter(
      apt => apt.vetId === vetId && apt.date === date && apt.status !== 'Cancelado'
    );
    const takenTimes = activeAppointments.map(apt => apt.time);

    els.timeSlotsGrid.innerHTML = '';
    selectedTimeSlot = null;

    defaultSlots.forEach(time => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot-btn";
      btn.textContent = time;

      const isTaken = takenTimes.includes(time);
      
      // Valida se a data selecionada é hoje e o horário já passou
      let isPast = false;
      const todayStr = new Date().toISOString().split('T')[0];
      if (date === todayStr) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const [slotHour, slotMin] = time.split(':').map(Number);
        
        if (slotHour < currentHour || (slotHour === currentHour && slotMin <= currentMin)) {
          isPast = true;
        }
      }

      if (isTaken || isPast) {
        btn.disabled = true;
        btn.classList.add("taken");
        btn.title = isTaken ? "Horário indisponível" : "Horário passado";
      } else {
        btn.addEventListener("click", () => {
          // Remove seleção anterior
          const selected = els.timeSlotsGrid.querySelector(".selected");
          if (selected) selected.classList.remove("selected");

          btn.classList.add("selected");
          selectedTimeSlot = time;
          updateBookingSummary();
        });
      }

      els.timeSlotsGrid.appendChild(btn);
    });
  }

  function updateBookingSummary() {
    const petId = els.selectPet.value;
    const specialty = els.selectSpecialty.value;
    const vetId = els.selectVet.value;
    const date = els.inputDate.value;

    const pet = AppStore.db.pets.find(p => p.id === petId);
    const vet = AppStore.db.vets.find(v => v.id === vetId);

    els.summaryPet.textContent = pet ? `${pet.name} (${pet.breed})` : "Não selecionado";
    els.summarySpecialty.textContent = specialty || "Não selecionado";
    els.summaryVet.textContent = vet ? vet.name : "Não selecionado";
    
    if (date) {
      const dateObj = new Date(date + 'T00:00:00');
      els.summaryDate.textContent = dateObj.toLocaleDateString('pt-BR');
    } else {
      els.summaryDate.textContent = "Não selecionada";
    }

    els.summaryTime.textContent = selectedTimeSlot ? `${selectedTimeSlot}h` : "Não selecionado";

    // Habilita/Desabilita botão de salvar
    if (petId && specialty && vetId && date && selectedTimeSlot) {
      els.bookingSubmitBtn.removeAttribute("disabled");
    } else {
      els.bookingSubmitBtn.setAttribute("disabled", "true");
    }
  }

  // Ação de Cadastrar Consulta
  if (els.bookingForm) {
    els.bookingForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const petId = els.selectPet.value;
      const specialty = els.selectSpecialty.value;
      const vetId = els.selectVet.value;
      const date = els.inputDate.value;

      const pet = AppStore.db.pets.find(p => p.id === petId);
      const vet = AppStore.db.vets.find(v => v.id === vetId);
      const role = AppStore.currentUser.role;

      if (!pet || !vet || !selectedTimeSlot) return;

      const newApt = {
        id: `apt-${Date.now()}`,
        petId: pet.id,
        petName: pet.name,
        tutorName: pet.tutor,
        vetId: vet.id,
        vetName: vet.name,
        specialty: specialty,
        date: date,
        time: selectedTimeSlot,
        status: role === 'vet' ? 'Confirmado' : 'Aguardando', // Veterinário agenda confirmado automaticamente
        type: 'routine'
      };

      // Adiciona no BD
      AppStore.addAppointment(newApt);

      // Prepara tela de confirmação
      renderConfirmation(newApt, pet, vet);

      // Redireciona para confirmação
      navigateTo("confirmation");
    });
  }


  // --- SEÇÃO 4: CONFIRMAÇÃO ---
  function renderConfirmation(apt, pet, vet) {
    els.confirmPet.textContent = `${pet.name} (${pet.breed})`;
    els.confirmVet.textContent = `${vet.name} - ${apt.specialty}`;
    
    const dateObj = new Date(apt.date + 'T00:00:00');
    els.confirmDate.textContent = `${dateObj.toLocaleDateString('pt-BR')} às ${apt.time}h`;
    
    // Status visual
    els.confirmStatus.textContent = apt.status;
    if (apt.status === 'Confirmado') {
      els.confirmStatus.style.backgroundColor = '#d1fae5';
      els.confirmStatus.style.color = 'var(--success)';
    } else {
      els.confirmStatus.style.backgroundColor = '#fef3c7';
      els.confirmStatus.style.color = '#d97706';
    }
  }

  // Navegações pós-confirmação
  if (els.btnConfirmGoAgenda) {
    els.btnConfirmGoAgenda.addEventListener("click", () => {
      const role = AppStore.currentUser.role;
      if (role === 'vet') {
        navigateTo("agenda");
      } else {
        navigateTo("panel"); // Tutor não tem tela de agenda cheia, vai para o painel
      }
    });
  }

  if (els.btnConfirmGoPanel) {
    els.btnConfirmGoPanel.addEventListener("click", () => {
      navigateTo("panel");
    });
  }


  // --- SEÇÃO 5: PACIENTES & HISTÓRICO DO PET ---
  let selectedPatientId = null;

  function renderPatients() {
    const role = AppStore.currentUser.role;
    const tutorName = AppStore.currentUser.name;
    const query = els.patientSearchInput.value.toLowerCase();

    // Filtra pets
    let filteredPets = AppStore.db.pets;
    if (role === 'tutor') {
      // Tutor só vê os próprios pets
      filteredPets = filteredPets.filter(p => p.tutor === tutorName);
    }

    if (query) {
      filteredPets = filteredPets.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.breed.toLowerCase().includes(query) ||
        p.species.toLowerCase().includes(query) ||
        p.tutor.toLowerCase().includes(query)
      );
    }

    // Renderiza lista lateral
    els.patientsListGroup.innerHTML = '';

    if (filteredPets.length === 0) {
      els.patientsListGroup.innerHTML = '<p style="color:var(--text-muted); padding: 1rem; text-align:center;">Nenhum pet encontrado</p>';
      els.patientDetailCard.classList.add("hidden");
      els.patientDetailPlaceholder.classList.remove("hidden");
      return;
    }

    filteredPets.forEach(p => {
      const div = document.createElement("div");
      div.className = `patient-list-item ${selectedPatientId === p.id ? 'active' : ''}`;
      
      const petIcon = p.type === 'cat' ? 'cat' : 'dog';

      div.innerHTML = `
        <div class="patient-list-avatar"><i data-lucide="${petIcon}" size="18"></i></div>
        <div class="patient-list-info">
          <h4>${p.name}</h4>
          <span>${p.species} • ${p.breed}</span>
          ${role === 'vet' ? `<span style="font-size: 0.75rem; color: var(--primary); display:block; margin-top:2px;">Tutor: ${p.tutor}</span>` : ''}
        </div>
      `;

      div.addEventListener("click", () => {
        // Remove active class
        const currentActive = els.patientsListGroup.querySelector(".patient-list-item.active");
        if (currentActive) currentActive.classList.remove("active");

        div.classList.add("active");
        selectPatientById(p.id);
      });

      els.patientsListGroup.appendChild(div);
    });

    // Recria ícones lucide na lista de pets
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Se houver algum selecionado, atualiza o painel dele. Se não, seleciona o primeiro por padrão
    if (selectedPatientId && filteredPets.some(p => p.id === selectedPatientId)) {
      selectPatientById(selectedPatientId);
    } else if (filteredPets.length > 0) {
      selectPatientById(filteredPets[0].id);
      // Marca o primeiro na lista como ativo visualmente
      const firstItem = els.patientsListGroup.querySelector(".patient-list-item");
      if (firstItem) firstItem.classList.add("active");
    } else {
      els.patientDetailCard.classList.add("hidden");
      els.patientDetailPlaceholder.classList.remove("hidden");
    }
  }

  function selectPatientById(petId) {
    selectedPatientId = petId;
    const pet = AppStore.db.pets.find(p => p.id === petId);
    if (!pet) return;

    // Oculta placeholder e mostra detalhe
    els.patientDetailPlaceholder.classList.add("hidden");
    els.patientDetailCard.classList.remove("hidden");

    // Preenche dados básicos do pet
    els.detailPetName.textContent = pet.name;
    els.detailPetSpecies.textContent = pet.species;
    els.detailPetBreed.textContent = pet.breed;
    els.detailPetAge.textContent = pet.age;
    els.detailPetWeight.textContent = pet.weight;
    els.detailPetTutor.textContent = pet.tutor;

    const petIcon = pet.type === 'cat' ? 'cat' : 'dog';
    els.detailPetAvatarIcon.innerHTML = `<i data-lucide="${petIcon}"></i>`;

    // Formulário de Prontuário Clínico (apenas visível para Vets)
    if (AppStore.currentUser.role === 'vet') {
      els.vetRecordFormContainer.classList.remove("hidden");
    } else {
      els.vetRecordFormContainer.classList.add("hidden");
    }

    // Renderiza a Timeline
    renderMedicalTimeline(petId);
  }

  function renderMedicalTimeline(petId) {
    const records = AppStore.db.medicalRecords.filter(r => r.petId === petId);

    // Ordena registros do mais recente para o mais antigo
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    els.petMedicalTimeline.innerHTML = '';

    if (records.length === 0) {
      els.petMedicalTimeline.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Nenhum histórico médico ou prontuário registrado para este pet ainda.
        </div>
      `;
      return;
    }

    records.forEach(r => {
      const dateObj = new Date(r.date + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString('pt-BR');
      
      let icon = 'activity';
      let iconClass = 'consulta';
      if (r.type === 'Vacina') {
        icon = 'shield-check';
        iconClass = 'vacina';
      } else if (r.type === 'Procedimento' || r.type === 'Exame') {
        icon = 'stethoscope';
        iconClass = 'procedimento';
      }

      const timelineItem = document.createElement("div");
      timelineItem.className = "timeline-item";
      
      timelineItem.innerHTML = `
        <div class="timeline-badge ${iconClass}">
          <i data-lucide="${icon}" size="16"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4>${r.title}</h4>
            <span class="timeline-date">${formattedDate}</span>
          </div>
          <p class="timeline-desc">${r.description}</p>
          <div class="timeline-footer">
            <span>Profissional: <strong>${r.vetName}</strong></span>
            <span class="badge ${iconClass.toLowerCase()}">${r.type}</span>
          </div>
        </div>
      `;
      els.petMedicalTimeline.appendChild(timelineItem);
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Filtragem de Busca de Pacientes
  if (els.patientSearchInput) {
    els.patientSearchInput.addEventListener("input", renderPatients);
  }

  // Adicionar novo prontuário clínico pelo Veterinário
  if (els.addRecordForm) {
    els.addRecordForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!selectedPatientId) return;

      const title = els.recordTitle.value;
      const type = els.recordType.value;
      const desc = els.recordDesc.value;

      if (!title || !desc) {
        alert("Por favor, preencha todos os campos do prontuário.");
        return;
      }

      const newRecord = {
        id: `mr-${Date.now()}`,
        petId: selectedPatientId,
        date: new Date().toISOString().split('T')[0],
        type: type,
        title: title,
        description: desc,
        vetName: AppStore.currentUser.name
      };

      // Adiciona no BD
      AppStore.addMedicalRecord(newRecord);

      // Reseta form
      els.addRecordForm.reset();

      // Recarrega timeline
      renderMedicalTimeline(selectedPatientId);
    });
  }


  // --- MENU MOBILE ---
  function toggleMenu() {
    els.sidebar.classList.toggle("active");
    els.sidebarOverlay.classList.toggle("active");
  }

  if (els.menuToggle) {
    els.menuToggle.addEventListener("click", toggleMenu);
  }

  if (els.sidebarOverlay) {
    els.sidebarOverlay.addEventListener("click", toggleMenu);
  }

  // --- CADASTRO DE NOVO PET ---
  if (els.btnNewPet) {
    els.btnNewPet.addEventListener("click", () => {
      // Oculta fichas e exibe formulário de cadastro
      els.patientDetailPlaceholder.classList.add("hidden");
      els.patientDetailCard.classList.add("hidden");
      els.newPetFormCard.classList.remove("hidden");

      // Preenche o tutor se logado como tutor
      if (AppStore.currentUser.role === 'tutor') {
        els.petFormTutor.value = AppStore.currentUser.name;
        els.petFormTutor.setAttribute("disabled", "true");
      } else {
        els.petFormTutor.value = '';
        els.petFormTutor.removeAttribute("disabled");
      }
      els.petFormName.focus();
    });
  }

  if (els.btnCancelAddPet) {
    els.btnCancelAddPet.addEventListener("click", () => {
      els.newPetFormCard.classList.add("hidden");
      if (selectedPatientId) {
        els.patientDetailCard.classList.remove("hidden");
      } else {
        els.patientDetailPlaceholder.classList.remove("hidden");
      }
    });
  }

  if (els.addPetForm) {
    els.addPetForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = els.petFormName.value.trim();
      const speciesVal = els.petFormSpecies.value;
      const breed = els.petFormBreed.value.trim();
      const age = els.petFormAge.value.trim();
      const weight = els.petFormWeight.value.trim();
      // Se estiver desabilitado (tutor), pega o valor do store ou do campo
      const tutor = AppStore.currentUser.role === 'tutor' ? AppStore.currentUser.name : els.petFormTutor.value.trim();

      if (!name || !breed || !age || !weight || !tutor) {
        alert("Por favor, preencha todos os campos para cadastrar o pet.");
        return;
      }

      const speciesName = speciesVal === 'cat' ? 'Gato' : (speciesVal === 'dog' ? 'Cachorro' : 'Outro');

      const newPet = {
        id: `pet-${Date.now()}`,
        name: name,
        species: speciesName,
        breed: breed,
        age: age,
        weight: weight,
        tutor: tutor,
        type: speciesVal
      };

      // Adiciona ao banco de dados mockado
      AppStore.db.pets.push(newPet);
      AppStore.save();

      // Reseta formulário
      els.addPetForm.reset();
      els.newPetFormCard.classList.add("hidden");

      // Recarrega lista de pacientes
      selectedPatientId = newPet.id;
      renderPatients();

      alert(`${name} cadastrado com sucesso!`);
    });
  }

  // --- ENLACE ÚNICO DE EVENTOS DE BOTÃO DE AÇÃO DA TABELA (EVENT DELEGATION) ---
  if (els.panelRecentAppointments) {
    const tbody = els.panelRecentAppointments.querySelector("tbody");
    if (tbody) {
      tbody.addEventListener("click", handleTableActionClick);
    }
  }
  if (els.agendaTableBody) {
    els.agendaTableBody.addEventListener("click", handleTableActionClick);
  }

  // --- INICIALIZAÇÃO DA APLICAÇÃO ---
  checkSession();
});

// ============================================================================
// VETAGENDA - CORE APPLICATION LOGIC
// ============================================================================

// --- CONFIGURAÇÕES E ESTADO DO BANCO DE DADOS MOCKADO ---
const DB_KEY = 'vetagenda_db';

// --- UTILITÁRIOS DE DATA (SEGUROS PARA FUSO HORÁRIO) ---
// Atenção: new Date().toISOString() converte para UTC. No Brasil (UTC-3) a
// meia-noite local vira o dia anterior, quebrando calendário e validações.
// Estas funções trabalham sempre no fuso local do usuário.
function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Clona profundamente os dados de fábrica para evitar mutação acidental.
function deepClone(obj) {
  return typeof structuredClone === 'function'
    ? structuredClone(obj)
    : JSON.parse(JSON.stringify(obj));
}

// Horários padrão de atendimento da clínica
const DEFAULT_SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

// Avalia a disponibilidade dos horários de um veterinário numa data.
// excludeAptId permite ignorar a própria consulta ao reagendá-la.
function computeSlots(vetId, date, excludeAptId = null) {
  const taken = AppStore.db.appointments
    .filter(a => a.vetId === vetId && a.date === date && a.status !== 'Cancelado' && a.id !== excludeAptId)
    .map(a => a.time);

  const todayStr = getLocalDateStr();
  const now = new Date();

  return DEFAULT_SLOTS.map(time => {
    let isPast = false;
    if (date === todayStr) {
      const [h, m] = time.split(':').map(Number);
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        isPast = true;
      }
    }
    return { time, taken: taken.includes(time), past: isPast };
  });
}

// --- CARTEIRA DE VACINAÇÃO ---
// Intervalos de revacinação por palavra-chave no título da vacina (em dias).
const VACCINE_RULES = [
  { match: /anti.?r[áa]bica|raiva/i, label: 'Antirrábica', days: 365 },
  { match: /v10|v8|m[úu]ltipla|polivalente|p[óo]livalente/i, label: 'Múltipla (V8/V10)', days: 365 },
  { match: /gi[áa]rdia/i, label: 'Giárdia', days: 365 },
  { match: /gripe|tosse|bordetella|traqueobronquite/i, label: 'Gripe Canina', days: 365 },
  { match: /leishmaniose/i, label: 'Leishmaniose', days: 365 },
  { match: /qu[áa]drupla|qu[íi]ntupla|tr[íi]plice felina|leucemia felina|felina/i, label: 'Vacina Felina', days: 365 }
];
const DEFAULT_VACCINE_DAYS = 365;

function classifyVaccine(title) {
  const rule = VACCINE_RULES.find(v => v.match.test(title || ''));
  return rule || { label: title || 'Vacina', days: DEFAULT_VACCINE_DAYS };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d;
}

// Calcula o status de uma vacina a partir da data da próxima dose.
function vaccineStatus(nextDueDate) {
  const today = new Date(getLocalDateStr() + 'T00:00:00');
  const diffDays = Math.round((nextDueDate - today) / 86400000);
  if (diffDays < 0) return { key: 'vencida', label: `Vencida há ${Math.abs(diffDays)} dia(s)`, tone: 'danger' };
  if (diffDays <= 30) return { key: 'vence-breve', label: `Vence em ${diffDays} dia(s)`, tone: 'warning' };
  return { key: 'em-dia', label: 'Em dia', tone: 'success' };
}

// --- PESO ---
// Extrai o valor numérico de strings como "32kg", "4.5 kg".
function parseWeightKg(weightStr) {
  if (typeof weightStr === 'number') return weightStr;
  const m = String(weightStr || '').replace(',', '.').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

// --- SISTEMA DE NOTIFICAÇÕES (TOASTS) E CONFIRMAÇÃO ---
// Substitui os alert()/confirm() nativos por componentes mais agradáveis.
const UI = {
  // Exibe uma notificação flutuante. type: success | error | info | warning
  toast(message, type = 'success', duration = 3200) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: 'check-circle', error: 'x-circle', info: 'info', warning: 'alert-triangle' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    // Animação de entrada
    requestAnimationFrame(() => toast.classList.add('show'));

    // Remoção automática
    const remove = () => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
    };
    setTimeout(remove, duration);
    toast.addEventListener('click', remove);
  },

  // Modal de confirmação que retorna uma Promise<boolean>.
  confirm(message, { title = 'Confirmar ação', confirmText = 'Confirmar', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-modal-overlay';
      overlay.innerHTML = `
        <div class="confirm-modal" role="dialog" aria-modal="true">
          <div class="confirm-modal-icon ${danger ? 'danger' : ''}">
            <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}"></i>
          </div>
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="confirm-modal-actions">
            <button class="confirm-modal-cancel" type="button">Cancelar</button>
            <button class="confirm-modal-ok ${danger ? 'danger' : ''}" type="button">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      if (window.lucide) window.lucide.createIcons();
      requestAnimationFrame(() => overlay.classList.add('show'));

      const close = (result) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 250);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter') close(true);
      };

      overlay.querySelector('.confirm-modal-ok').addEventListener('click', () => close(true));
      overlay.querySelector('.confirm-modal-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', onKey);
    });
  }
};

// Dados iniciais padrão do aplicativo
const INITIAL_DATABASE = {
  vets: [
    { id: "vet-1", name: "Dr. Silva", specialty: "Clínica Geral", avatar: "S" },
    { id: "vet-2", name: "Dra. Maria", specialty: "Dermatologia", avatar: "M" },
    { id: "vet-3", name: "Dr. Marcos", specialty: "Cardiologia", avatar: "MC" },
    { id: "vet-4", name: "Dra. Julia", specialty: "Ortopedia", avatar: "J" }
  ],
  pets: [
    { id: "pet-1", name: "Rex", species: "Cachorro", breed: "Golden Retriever", age: "3 anos", weight: "32kg", tutor: "Carlos Mendes", type: "dog", allergies: "Nenhuma registrada",
      weightHistory: [ { date: "2025-09-10", kg: 30 }, { date: "2026-01-15", kg: 31.2 }, { date: "2026-05-10", kg: 32 } ] },
    { id: "pet-2", name: "Mia", species: "Gato", breed: "Siamês", age: "2 anos", weight: "4.5kg", tutor: "Ana Clara", type: "cat", allergies: "Nenhuma registrada",
      weightHistory: [ { date: "2026-01-05", kg: 4.2 }, { date: "2026-04-20", kg: 4.5 } ] },
    { id: "pet-3", name: "Thor", species: "Cachorro", breed: "Bulldog Francês", age: "5 anos", weight: "12kg", tutor: "Roberto Dias", type: "dog", allergies: "Dermatite alérgica tópica",
      weightHistory: [ { date: "2025-08-01", kg: 13.4 }, { date: "2025-12-01", kg: 12.8 }, { date: "2026-06-02", kg: 12 } ] },
    { id: "pet-4", name: "Pipoca", species: "Gato", breed: "Persa", age: "1 ano", weight: "3.8kg", tutor: "Carlos Mendes", type: "cat", allergies: "Nenhuma registrada",
      weightHistory: [ { date: "2026-03-01", kg: 3.5 }, { date: "2026-06-01", kg: 3.8 } ] },
    { id: "pet-5", name: "Luna", species: "Cachorro", breed: "Poodle", age: "4 anos", weight: "6kg", tutor: "Carlos Mendes", type: "dog", allergies: "Nenhuma registrada",
      weightHistory: [ { date: "2025-11-10", kg: 5.5 }, { date: "2026-02-15", kg: 5.8 }, { date: "2026-04-01", kg: 6 } ] }
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
      id: "mr-5",
      petId: "pet-1",
      date: "2025-06-20",
      type: "Vacina",
      title: "Vacina Antirrábica",
      description: "Dose anual da vacina antirrábica aplicada sem intercorrências.",
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
  const todayStr = getLocalDateStr();
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
    this.db = deepClone(INITIAL_DATABASE);
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
  },

  // Reagenda uma consulta (nova data/horário)
  rescheduleAppointment(aptId, newDate, newTime) {
    const apt = this.db.appointments.find(a => a.id === aptId);
    if (apt) {
      apt.date = newDate;
      apt.time = newTime;
      this.save();
      return true;
    }
    return false;
  },

  // Remove um pet e, opcionalmente, seus dados associados (consultas e prontuários)
  deletePet(petId) {
    this.db.pets = this.db.pets.filter(p => p.id !== petId);
    this.db.appointments = this.db.appointments.filter(a => a.petId !== petId);
    this.db.medicalRecords = this.db.medicalRecords.filter(r => r.petId !== petId);
    this.save();
  },

  // Registra uma nova pesagem no histórico do pet e atualiza o peso atual
  addWeightEntry(petId, kg, dateStr = getLocalDateStr()) {
    const pet = this.db.pets.find(p => p.id === petId);
    if (!pet) return;
    if (!Array.isArray(pet.weightHistory)) pet.weightHistory = [];
    pet.weightHistory.push({ date: dateStr, kg });
    pet.weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    pet.weight = `${kg}kg`;
    this.save();
  },

  // Exporta todo o banco como string JSON (para backup)
  exportDB() {
    return JSON.stringify(this.db, null, 2);
  },

  // Importa um banco a partir de objeto, validando a estrutura mínima
  importDB(data) {
    const required = ['vets', 'pets', 'appointments', 'medicalRecords'];
    const valid = data && typeof data === 'object' && required.every(k => Array.isArray(data[k]));
    if (!valid) return false;
    this.db = data;
    this.save();
    return true;
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
    panelNextAppointment: document.getElementById("panelNextAppointment"),
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
    recordWeight: document.getElementById("recordWeight"),

    // Carteira de vacinação e gráfico de peso
    petVaccineGrid: document.getElementById("petVaccineGrid"),
    petVaccineSection: document.getElementById("petVaccineSection"),
    petWeightChart: document.getElementById("petWeightChart"),
    petWeightSection: document.getElementById("petWeightSection"),

    // Backup de dados
    btnExportData: document.getElementById("btnExportData"),
    btnImportData: document.getElementById("btnImportData"),
    btnResetData: document.getElementById("btnResetData"),
    importFileInput: document.getElementById("importFileInput"),

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
    petFormTutor: document.getElementById("petFormTutor"),
    petFormAllergies: document.getElementById("petFormAllergies"),
    detailPetAllergies: document.getElementById("detailPetAllergies"),
    btnDeletePet: document.getElementById("btnDeletePet"),

    // Tema
    themeToggle: document.getElementById("themeToggle")
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
      // Alguns itens do menu (ex: ferramentas de dados) não possuem link <a>
      if (!link) return;
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
    const todayStr = getLocalDateStr();

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

    // --- Card de Próxima Consulta (somente Tutor) ---
    if (els.panelNextAppointment) {
      els.panelNextAppointment.innerHTML = '';
      if (role === 'tutor') {
        const now = new Date();
        const upcoming = displayApts
          .filter(a => a.status !== 'Cancelado' && a.status !== 'Concluído')
          .filter(a => new Date(`${a.date}T${a.time}`) >= now)
          .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        if (upcoming.length > 0) {
          const next = upcoming[0];
          const pet = pets.find(p => p.id === next.petId) || { type: 'dog' };
          const petIcon = pet.type === 'cat' ? 'cat' : 'dog';
          const dateObj = new Date(next.date + 'T00:00:00');
          const dateFmt = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
          const isToday = next.date === todayStr;

          els.panelNextAppointment.innerHTML = `
            <div class="next-appointment-card">
              <div class="next-appointment-icon"><i data-lucide="${petIcon}"></i></div>
              <div class="next-appointment-body">
                <span class="next-appointment-label">
                  <i data-lucide="bell" size="14"></i> ${isToday ? 'Sua próxima consulta é HOJE' : 'Sua próxima consulta'}
                </span>
                <strong>${next.petName} • ${next.specialty}</strong>
                <span class="next-appointment-meta">
                  ${dateFmt} às ${next.time}h · ${next.vetName} · <em>${next.status}</em>
                </span>
              </div>
              <button class="btn-new next-appointment-cta">
                <i data-lucide="calendar-plus" size="18"></i> Nova consulta
              </button>
            </div>
          `;
        }
      }
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
                  <button class="btn-action reschedule" data-id="${apt.id}" title="Reagendar"><i data-lucide="calendar-clock"></i></button>
                  <button class="btn-action complete" data-id="${apt.id}" title="Concluir"><i data-lucide="check-square"></i></button>
                  <button class="btn-action cancel" data-id="${apt.id}" title="Cancelar"><i data-lucide="x-circle"></i></button>
                ` : '<span style="font-size:0.8rem; color:var(--text-muted)">Sem ações</span>'}
              </div>
            </td>
          `;
        } else {
          // Tutor pode reagendar ou cancelar seus agendamentos ativos
          actionColumn = `
            <td data-label="Ação">
              ${apt.status === 'Aguardando' || apt.status === 'Confirmado' ? `
                <div class="action-buttons-flex">
                  <button class="btn-action reschedule" data-id="${apt.id}" title="Reagendar"><i data-lucide="calendar-clock"></i></button>
                  <button class="btn-action cancel" data-id="${apt.id}" title="Cancelar Agendamento"><i data-lucide="trash-2"></i></button>
                </div>
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

  async function handleTableActionClick(e) {
    const btn = e.target.closest(".btn-action");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute("data-id");
    const role = AppStore.currentUser.role;

    if (btn.classList.contains("confirm")) {
      AppStore.updateAppointmentStatus(id, "Confirmado");
      UI.toast("Consulta confirmada com sucesso!", "success");
      renderPanel();
      if (role === 'vet') renderAgenda();
    } else if (btn.classList.contains("reschedule")) {
      openRescheduleModal(id);
    } else if (btn.classList.contains("cancel")) {
      const ok = await UI.confirm("Tem certeza que deseja cancelar esta consulta?", {
        title: "Cancelar consulta",
        confirmText: "Sim, cancelar",
        danger: true
      });
      if (ok) {
        AppStore.updateAppointmentStatus(id, "Cancelado");
        UI.toast("Consulta cancelada.", "info");
        renderPanel();
        if (role === 'vet') renderAgenda();
      }
    } else if (btn.classList.contains("complete")) {
      const apt = AppStore.db.appointments.find(a => a.id === id);
      if (apt) {
        AppStore.updateAppointmentStatus(id, "Concluído");
        UI.toast("Atendimento concluído!", "success");
        const registrar = await UI.confirm(
          "Deseja registrar a ficha médica/prontuário do paciente agora?",
          { title: "Consulta concluída", confirmText: "Registrar prontuário" }
        );
        if (registrar) {
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

  // --- MODAL DE REAGENDAMENTO ---
  function openRescheduleModal(aptId) {
    const apt = AppStore.db.appointments.find(a => a.id === aptId);
    if (!apt) return;

    let chosenDate = apt.date;
    let chosenTime = apt.time;
    const todayStr = getLocalDateStr();

    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay reschedule-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal reschedule-modal" role="dialog" aria-modal="true">
        <div class="confirm-modal-icon"><i data-lucide="calendar-clock"></i></div>
        <h3>Reagendar Consulta</h3>
        <p>${apt.petName} • ${apt.specialty} com ${apt.vetName}</p>

        <div class="form-group" style="text-align:left; margin-bottom: 1rem;">
          <label for="rescheduleDate">Nova data</label>
          <input type="date" id="rescheduleDate" value="${apt.date}" min="${todayStr}">
        </div>

        <div class="form-group" style="text-align:left;">
          <label>Novo horário</label>
          <div class="time-slots-grid" id="rescheduleSlots"></div>
        </div>

        <div class="confirm-modal-actions" style="margin-top: 1.5rem;">
          <button class="confirm-modal-cancel" type="button">Cancelar</button>
          <button class="confirm-modal-ok" id="rescheduleSave" type="button" disabled>Salvar nova data</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => overlay.classList.add('show'));

    const dateInput = overlay.querySelector('#rescheduleDate');
    const slotsGrid = overlay.querySelector('#rescheduleSlots');
    const saveBtn = overlay.querySelector('#rescheduleSave');

    function renderSlots() {
      slotsGrid.innerHTML = '';
      saveBtn.disabled = true;
      chosenTime = null;
      computeSlots(apt.vetId, chosenDate, apt.id).forEach(({ time, taken, past }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-slot-btn';
        btn.textContent = time;
        if (taken || past) {
          btn.disabled = true;
          btn.classList.add('taken');
          btn.title = taken ? 'Horário indisponível' : 'Horário passado';
        } else {
          // Mantém o horário atual pré-selecionado se ainda for a mesma data
          if (chosenDate === apt.date && time === apt.time) {
            btn.classList.add('selected');
            chosenTime = time;
            saveBtn.disabled = false;
          }
          btn.addEventListener('click', () => {
            const prev = slotsGrid.querySelector('.selected');
            if (prev) prev.classList.remove('selected');
            btn.classList.add('selected');
            chosenTime = time;
            saveBtn.disabled = false;
          });
        }
        slotsGrid.appendChild(btn);
      });
    }

    renderSlots();

    dateInput.addEventListener('change', () => {
      chosenDate = dateInput.value;
      renderSlots();
    });

    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector('.confirm-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    saveBtn.addEventListener('click', () => {
      if (!chosenDate || !chosenTime) return;
      AppStore.rescheduleAppointment(apt.id, chosenDate, chosenTime);
      close();
      UI.toast('Consulta reagendada com sucesso!', 'success');
      renderPanel();
      if (AppStore.currentUser.role === 'vet') renderAgenda();
    });
  }


  // --- SEÇÃO 2: AGENDA CLÍNICA (VETERINÁRIO) ---
  let agendaSelectedDate = new Date(); // Inicia com hoje

  function renderAgenda() {
    const todayStr = getLocalDateStr(agendaSelectedDate);
    
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
                <button class="btn-action reschedule" data-id="${apt.id}" title="Reagendar"><i data-lucide="calendar-clock"></i></button>
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
    const todayStr = getLocalDateStr();
    const activeSelectedStr = getLocalDateStr(agendaSelectedDate);

    for (let day = 1; day <= lastDay; day++) {
      const dateForCell = new Date(calendarCurrentYear, calendarCurrentMonth, day);
      const dateStr = getLocalDateStr(dateForCell);
      
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
    const today = getLocalDateStr();
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

    els.timeSlotsGrid.innerHTML = '';
    selectedTimeSlot = null;

    computeSlots(vetId, date).forEach(({ time, taken, past }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot-btn";
      btn.textContent = time;

      if (taken || past) {
        btn.disabled = true;
        btn.classList.add("taken");
        btn.title = taken ? "Horário indisponível" : "Horário passado";
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

    // Alergias (orientado a dados). Destaca em vermelho quando há alergia relevante.
    if (els.detailPetAllergies) {
      const allergyText = pet.allergies || 'Nenhuma registrada';
      els.detailPetAllergies.textContent = allergyText;
      const chip = els.detailPetAllergies.closest('.info-chip');
      const hasAllergy = !/^nenhuma/i.test(allergyText.trim());
      if (chip) chip.classList.toggle('danger-chip', hasAllergy);
    }

    const petIcon = pet.type === 'cat' ? 'cat' : 'dog';
    els.detailPetAvatarIcon.innerHTML = `<i data-lucide="${petIcon}"></i>`;

    // Formulário de Prontuário Clínico (apenas visível para Vets)
    if (AppStore.currentUser.role === 'vet') {
      els.vetRecordFormContainer.classList.remove("hidden");
    } else {
      els.vetRecordFormContainer.classList.add("hidden");
    }

    // Renderiza carteira de vacinação, gráfico de peso e a timeline
    renderVaccineCard(petId);
    renderWeightChart(petId);
    renderMedicalTimeline(petId);
  }

  // Carteira de vacinação: agrupa as vacinas por tipo e calcula o vencimento.
  function renderVaccineCard(petId) {
    if (!els.petVaccineGrid) return;

    const vaccines = AppStore.db.medicalRecords
      .filter(r => r.petId === petId && r.type === 'Vacina')
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    els.petVaccineGrid.innerHTML = '';

    if (vaccines.length === 0) {
      els.petVaccineGrid.innerHTML = `
        <div class="vaccine-empty">
          <i data-lucide="syringe"></i>
          <span>Nenhuma vacina registrada. Registre uma vacinação no prontuário para acompanhar os vencimentos.</span>
        </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Mantém apenas a aplicação mais recente de cada tipo de vacina
    const latestByType = new Map();
    vaccines.forEach(v => {
      const { label, days } = classifyVaccine(v.title);
      if (!latestByType.has(label)) {
        latestByType.set(label, { label, days, date: v.date });
      }
    });

    latestByType.forEach(({ label, days, date }) => {
      const nextDue = addDays(date, days);
      const status = vaccineStatus(nextDue);
      const lastFmt = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
      const nextFmt = nextDue.toLocaleDateString('pt-BR');

      const card = document.createElement('div');
      card.className = `vaccine-card ${status.tone}`;
      card.innerHTML = `
        <div class="vaccine-card-top">
          <span class="vaccine-name"><i data-lucide="syringe" size="16"></i> ${label}</span>
          <span class="vaccine-status ${status.tone}">${status.label}</span>
        </div>
        <div class="vaccine-dates">
          <span>Última: <strong>${lastFmt}</strong></span>
          <span>Próxima dose: <strong>${nextFmt}</strong></span>
        </div>`;
      els.petVaccineGrid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Gráfico de evolução de peso (SVG nativo, sem dependências).
  function renderWeightChart(petId) {
    if (!els.petWeightChart) return;
    const pet = AppStore.db.pets.find(p => p.id === petId);
    if (!pet) return;

    let history = Array.isArray(pet.weightHistory) ? [...pet.weightHistory] : [];
    // Fallback: deriva um ponto único do peso atual se não houver histórico
    if (history.length === 0) {
      const kg = parseWeightKg(pet.weight);
      if (kg != null) history = [{ date: getLocalDateStr(), kg }];
    }
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (history.length === 0) {
      els.petWeightChart.innerHTML = '<p class="weight-empty">Sem dados de peso registrados.</p>';
      return;
    }

    if (history.length === 1) {
      els.petWeightChart.innerHTML = `
        <div class="weight-single">
          <strong>${history[0].kg} kg</strong>
          <span>Registre novas pesagens no prontuário para visualizar a evolução.</span>
        </div>`;
      return;
    }

    // Dimensões do gráfico
    const W = 600, H = 220, padX = 40, padY = 30;
    const kgs = history.map(h => h.kg);
    let min = Math.min(...kgs), max = Math.max(...kgs);
    if (min === max) { min -= 1; max += 1; } // evita divisão por zero
    const range = max - min;

    const x = i => padX + (i * (W - padX * 2)) / (history.length - 1);
    const y = kg => padY + (H - padY * 2) * (1 - (kg - min) / range);

    const points = history.map((h, i) => `${x(i)},${y(h.kg)}`).join(' ');
    const areaPoints = `${x(0)},${H - padY} ${points} ${x(history.length - 1)},${H - padY}`;

    const dots = history.map((h, i) => `
      <circle cx="${x(i)}" cy="${y(h.kg)}" r="4" class="weight-dot"></circle>
      <text x="${x(i)}" y="${y(h.kg) - 12}" class="weight-value" text-anchor="middle">${h.kg}</text>
    `).join('');

    const labels = history.map((h, i) => {
      const d = new Date(h.date + 'T00:00:00');
      const lbl = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      return `<text x="${x(i)}" y="${H - 8}" class="weight-label" text-anchor="middle">${lbl}</text>`;
    }).join('');

    const first = history[0].kg, last = history[history.length - 1].kg;
    const delta = (last - first).toFixed(1);
    const trendUp = last >= first;

    els.petWeightChart.innerHTML = `
      <div class="weight-summary">
        <span>Atual: <strong>${last} kg</strong></span>
        <span class="weight-trend ${trendUp ? 'up' : 'down'}">
          ${trendUp ? '▲' : '▼'} ${delta > 0 ? '+' : ''}${delta} kg no período
        </span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="weight-svg" preserveAspectRatio="xMidYMid meet">
        <polygon points="${areaPoints}" class="weight-area"></polygon>
        <polyline points="${points}" class="weight-line"></polyline>
        ${dots}
        ${labels}
      </svg>`;
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
        UI.toast("Por favor, preencha todos os campos do prontuário.", "warning");
        return;
      }

      const newRecord = {
        id: `mr-${Date.now()}`,
        petId: selectedPatientId,
        date: getLocalDateStr(),
        type: type,
        title: title,
        description: desc,
        vetName: AppStore.currentUser.name
      };

      // Adiciona no BD
      AppStore.addMedicalRecord(newRecord);

      // Registra a pesagem, se informada
      const weightKg = els.recordWeight ? parseWeightKg(els.recordWeight.value) : null;
      if (weightKg != null && weightKg > 0) {
        AppStore.addWeightEntry(selectedPatientId, weightKg);
        els.detailPetWeight.textContent = `${weightKg}kg`;
      }

      // Reseta form
      els.addRecordForm.reset();

      // Recarrega timeline, carteira de vacinação e gráfico de peso
      renderMedicalTimeline(selectedPatientId);
      renderVaccineCard(selectedPatientId);
      renderWeightChart(selectedPatientId);
      UI.toast("Evolução clínica registrada no prontuário!", "success");
    });
  }

  // --- EXCLUIR PET ---
  if (els.btnDeletePet) {
    els.btnDeletePet.addEventListener("click", async () => {
      if (!selectedPatientId) return;
      const pet = AppStore.db.pets.find(p => p.id === selectedPatientId);
      if (!pet) return;

      const ok = await UI.confirm(
        `Isso removerá <strong>${pet.name}</strong> e todo o seu histórico de consultas e prontuários. Esta ação não pode ser desfeita.`,
        { title: "Excluir pet", confirmText: "Sim, excluir", danger: true }
      );
      if (!ok) return;

      AppStore.deletePet(selectedPatientId);
      selectedPatientId = null;
      renderPatients();
      UI.toast(`${pet.name} foi removido do sistema.`, "info");
    });
  }


  // --- BACKUP DE DADOS (EXPORTAR / IMPORTAR / RESTAURAR) ---
  if (els.btnExportData) {
    els.btnExportData.addEventListener("click", () => {
      const blob = new Blob([AppStore.exportDB()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vetagenda-backup-${getLocalDateStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      UI.toast("Backup exportado com sucesso!", "success");
    });
  }

  if (els.btnImportData && els.importFileInput) {
    els.btnImportData.addEventListener("click", () => els.importFileInput.click());

    els.importFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        let data;
        try {
          data = JSON.parse(ev.target.result);
        } catch (err) {
          UI.toast("Arquivo inválido: não é um JSON válido.", "error");
          els.importFileInput.value = "";
          return;
        }

        const ok = await UI.confirm(
          "Importar este backup substituirá <strong>todos os dados atuais</strong> do sistema. Deseja continuar?",
          { title: "Importar backup", confirmText: "Importar e substituir", danger: true }
        );
        if (!ok) { els.importFileInput.value = ""; return; }

        if (AppStore.importDB(data)) {
          UI.toast("Backup importado com sucesso!", "success");
          selectedPatientId = null;
          setupRoleSidebar();
          navigateTo("panel");
        } else {
          UI.toast("Backup inválido: estrutura de dados não reconhecida.", "error");
        }
        els.importFileInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  if (els.btnResetData) {
    els.btnResetData.addEventListener("click", async () => {
      const ok = await UI.confirm(
        "Isso apagará todas as suas alterações e restaurará os dados originais de demonstração. Tem certeza?",
        { title: "Restaurar demonstração", confirmText: "Sim, restaurar", danger: true }
      );
      if (!ok) return;
      AppStore.resetDB();
      UI.toast("Dados de demonstração restaurados.", "info");
      selectedPatientId = null;
      navigateTo("panel");
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
      const allergies = els.petFormAllergies ? els.petFormAllergies.value.trim() : '';
      // Se estiver desabilitado (tutor), pega o valor do store ou do campo
      const tutor = AppStore.currentUser.role === 'tutor' ? AppStore.currentUser.name : els.petFormTutor.value.trim();

      if (!name || !breed || !age || !weight || !tutor) {
        UI.toast("Por favor, preencha todos os campos para cadastrar o pet.", "warning");
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
        type: speciesVal,
        allergies: allergies || 'Nenhuma registrada'
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

      UI.toast(`${name} cadastrado com sucesso!`, "success");
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

  // --- MODO ESCURO (TEMA) ---
  const THEME_KEY = 'vetagenda_theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (els.themeToggle) {
      const icon = theme === 'dark' ? 'sun' : 'moon';
      els.themeToggle.innerHTML = `<i data-lucide="${icon}"></i>`;
      els.themeToggle.setAttribute('title', theme === 'dark' ? 'Modo claro' : 'Modo escuro');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
  }

  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  initTheme();

  // --- INICIALIZAÇÃO DA APLICAÇÃO ---
  checkSession();
});

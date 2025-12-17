
import { Language } from './types';

export const translations = {
  es: {
    // General
    loading: "Cargando...",
    save: "Guardar",
    saved: "Guardado",
    cancel: "Cancelar",
    edit: "Editar",
    delete: "Eliminar",
    back: "Volver",
    status: "Estado",
    actions: "Acciones",
    date: "Fecha",
    total: "Total",
    created: "Creado",
    language: "Idioma",
    
    // Auth
    login_title: "Inicia sesión en tu cuenta",
    signup_title: "Crea tu cuenta",
    email: "Correo Electrónico",
    password: "Contraseña",
    fullname: "Nombre Completo",
    login_btn: "Entrar",
    signup_btn: "Registrarse",
    no_account: "¿No tienes una cuenta?",
    have_account: "¿Ya tienes cuenta?",
    demo_mode: "Entrar en Modo Demo",

    // Onboarding
    onboarding_title: "Crea tu Workspace",
    onboarding_subtitle: "Para empezar, necesitamos configurar tu empresa o equipo.",
    company_name: "Nombre de la Empresa",
    company_slug: "URL de tu web (Slug)",
    create_company_btn: "Crear y Empezar",
    slug_hint: "Tu web será: acmesaas.com/c/",
    
    // Platform Public
    start_cta: "Empezar",
    login_nav: "Iniciar Sesión",
    pricing_nav: "Precios",
    home_hero_title_default: "Gestiona tu negocio sin esfuerzo.",
    home_hero_subtitle_default: "La plataforma todo en uno para presupuestos y gestión.",
    
    // Dashboard & Admin
    dashboard: "Panel de Control",
    customers: "Clientes",
    quotes: "Presupuestos",
    settings: "Configuración",
    website: "Mi Web Pública",
    admin_panel: "Superadmin",
    logout: "Cerrar Sesión",
    switch_team: "Cambiar Equipo",
    view_mode: "Modo de Vista",
    view_admin: "Panel Admin",
    view_public: "Ver Web",
    back_to_admin: "Volver al Admin",
    
    // Tenant Website Management
    manage_website: "Gestionar Web Pública",
    public_link: "Enlace Público",
    hero_section: "Sección Hero (Inicio)",
    services_section: "Sección Servicios",
    contact_section: "Sección Contacto",
    title: "Título",
    description: "Descripción",
    
    // Quotes
    new_quote: "Nuevo Presupuesto",
    quote_details: "Detalle Presupuesto",
    bill_to: "Facturar a",
    from: "De",
    item: "Concepto",
    price: "Precio",
    quantity: "Cant.",
    add_line: "Añadir Línea",
    accept_quote: "Aceptar Presupuesto",
    reject_quote: "Rechazar Presupuesto",
    download_pdf: "Descargar PDF",
    view_as_client: "Ver como Cliente",
    quote_accepted_msg: "¡Presupuesto Aceptado!",
    quote_rejected_msg: "Presupuesto Rechazado",
    
    // Stats
    total_revenue: "Ingresos Totales",
    active_quotes: "Presupuestos Activos",
    total_customers: "Clientes Totales",
  },
  ca: {
    // General
    loading: "Carregant...",
    save: "Desar",
    saved: "Desat",
    cancel: "Cancel·lar",
    edit: "Editar",
    delete: "Eliminar",
    back: "Tornar",
    status: "Estat",
    actions: "Accions",
    date: "Data",
    total: "Total",
    created: "Creat",
    language: "Idioma",
    
    // Auth
    login_title: "Inicia sessió al teu compte",
    signup_title: "Crea el teu compte",
    email: "Correu Electrònic",
    password: "Contrasenya",
    fullname: "Nom Complet",
    login_btn: "Entrar",
    signup_btn: "Registrar-se",
    no_account: "¿No tens un compte?",
    have_account: "¿Ja tens compte?",
    demo_mode: "Entrar en Mode Demo",

    // Onboarding
    onboarding_title: "Crea el teu Workspace",
    onboarding_subtitle: "Per començar, hem de configurar la teva empresa o equip.",
    company_name: "Nom de l'Empresa",
    company_slug: "URL de la teva web (Slug)",
    create_company_btn: "Crear i Començar",
    slug_hint: "La teva web serà: acmesaas.com/c/",
    
    // Platform Public
    start_cta: "Començar",
    login_nav: "Iniciar Sessió",
    pricing_nav: "Preus",
    home_hero_title_default: "Gestiona el teu negoci sense esforç.",
    home_hero_subtitle_default: "La plataforma tot en un per a pressupostos i gestió.",
    
    // Dashboard & Admin
    dashboard: "Tauler de Control",
    customers: "Clients",
    quotes: "Pressupostos",
    settings: "Configuració",
    website: "La Meva Web Pública",
    admin_panel: "Superadmin",
    logout: "Tancar Sessió",
    switch_team: "Canviar d'Equip",
    view_mode: "Mode de Vista",
    view_admin: "Tauler Admin",
    view_public: "Veure Web",
    back_to_admin: "Tornar a l'Admin",
    
    // Tenant Website Management
    manage_website: "Gestionar Web Pública",
    public_link: "Enllaç Públic",
    hero_section: "Secció Hero (Inici)",
    services_section: "Secció Serveis",
    contact_section: "Secció Contacte",
    title: "Títol",
    description: "Descripció",
    
    // Quotes
    new_quote: "Nou Pressupost",
    quote_details: "Detall Pressupost",
    bill_to: "Facturar a",
    from: "De",
    item: "Concepte",
    price: "Preu",
    quantity: "Quant.",
    add_line: "Afegir Línia",
    accept_quote: "Acceptar Pressupost",
    reject_quote: "Rebutjar Pressupost",
    download_pdf: "Descarregar PDF",
    view_as_client: "Veure com a Client",
    quote_accepted_msg: "Pressupost Acceptat!",
    quote_rejected_msg: "Pressupost Rebutjat",
    
    // Stats
    total_revenue: "Ingressos Totals",
    active_quotes: "Pressupostos Actius",
    total_customers: "Clients Totals",
  }
};

export const formatCurrency = (amount: number, lang: Language) => {
  return new Intl.NumberFormat(lang === 'ca' ? 'ca-ES' : 'es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export const formatDate = (dateString: string, lang: Language) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const ROUTES = {
  public: {
    home: '/',
    rastreamento: '/rastreamento',
    servicos: '/servicos',
    sobre: '/sobre',
    blog: '/blog',
    contato: '/contato',
  },

  auth: {
    login: '/login',
  },

  admin: {
    root: '/admin',
    dashboard: '/admin',
    usuarios: '/admin/usuarios',
    empresas: '/admin/empresas',
    pacotes: '/admin/pacotes',
    coletas: '/admin/coletas',
    devolucoes: '/admin/devolucoes',
    finalizados: '/admin/finalizados',
    financeiro: '/admin/financeiro',
    score: '/admin/score',
    ranking: '/admin/ranking',
    mapa: '/admin/mapa',
    comunicados: '/admin/comunicados',
    configuracoes: '/admin/configuracoes',
  },

  operacao: {
    root: '/operacao',
    dashboard: '/operacao',
    pacotes: '/operacao/pacotes',
    lotes: '/operacao/lotes',
    coletas: '/operacao/coletas',
    rotas: '/operacao/rotas',
    entregas: '/operacao/entregas',
    ausentes: '/operacao/ausentes',
    devolucoes: '/operacao/devolucoes',
    mapa: '/operacao/mapa',
  },

  empresa: {
    root: '/empresa',
    dashboard: '/empresa',
    pacotes: '/empresa/pacotes',
    entregas: '/empresa/entregas',
    ausentes: '/empresa/ausentes',
    devolucoes: '/empresa/devolucoes',
    mapa: '/empresa/mapa',
    historico: '/empresa/historico',
  },
} as const;
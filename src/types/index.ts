// ARQUIVO: src/types/index.ts
export type StatusPacote = "COLETADO" | "ROTA" | "ENTREGUE" | "AUSENTE" | "DEVOLVIDO";
export type TipoPacote = "MERCADO_LIVRE" | "SHOPEE" | "AVULSO" | string;

export interface Usuario { id:string; email:string; nome:string; tipo?:string; perfil?:string; empresaId?:string; ativo?:boolean; regiao?:string; telefone?:string; banco?:string; pix?:string; favorecido?:string; ganhos?:number; permissoes?:Record<string,unknown>; }
export interface Empresa { id:string; nome:string; pastas:string[]; ativo:boolean; valorML:number; valorShopee:number; valorAvulso:number; }
export interface Repasse { id:string; usuarioId:string; usuarioNome:string; dataInicio?:unknown; dataFim?:unknown; dataPagamento?:unknown; pago:boolean; creditos:number; debitos:number; mlTotal:number; shopeeTotal:number; avulsoTotal:number; totalPacotes:number; totalGeral:number; quinzena?:string; quinzenaLabel?:string; porTransportadora:{id?:string;nome:string;qtdML:number;qtdShopee:number;qtdAvulso:number;quantidade:number;valor:number}[]; dadosBancarios?:{banco?:string;favorecido?:string;pix?:string}; }
export interface HistoricoPacote {
  status: StatusPacote | string;
  dataHora?: unknown;
}

export interface Pacote {
  id: string;
  codigo: string;
  confirmado?: boolean;
  data?: unknown;
  dataDevolucao?: unknown;
  documentoRecebedor?: string;
  empresa?: string;
  erro?: boolean;
  fotoDevolucao?: string;
  fotos?: string[];
  usuarioNome?: string;
  bairro?:string; cidade?:string; cep?:string; rua?:string; numero?:string; pastaColeta?:string;
  historico: HistoricoPacote[];
  nomeRecebedor?: string;
  observacao?: string;
  raw?: string;
  status: StatusPacote;
  subiu?: boolean;
  tipo: TipoPacote;
  usuario?: string | null;
  usuarioAnterior?: string | null;
  usuarioFinalizacao?: string | null;
  visivelAte?: unknown;

  // Coordenadas usadas pelo mapa do app Android/Firebase.
  latitude?: number | null;
  longitude?: number | null;
  latitudeEntrega?: number | null;
  longitudeEntrega?: number | null;
  dataHoraBaixa?: unknown;
}

export type PackageStatus =
  | 'COLETADO'
  | 'ROTA'
  | 'ENTREGUE'
  | 'AUSENTE'
  | 'DEVOLVIDO'
  | 'CANCELADO';

export type PackageType =
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'AVULSO';

export interface PackageHistory {
  status: PackageStatus;
  dataHora?: unknown;
  usuario?: string | null;
  usuarioNome?: string | null;
  observacao?: string | null;
}

export interface DeliveryPackage {
  id: string;
  codigo: string;

  empresaId?: string | null;
  empresaNome?: string | null;

  transportadora?: string | null;
  tipo?: PackageType | string | null;

  status: PackageStatus;

  usuario?: string | null;
  usuarioNome?: string | null;

  usuarioFinalizacao?: string | null;
  entregador?: string | null;
  entregadorNome?: string | null;

  data?: unknown;
  dataColeta?: unknown;
  dataRota?: unknown;
  dataEntrega?: unknown;
  dataAusente?: unknown;
  dataDevolucao?: unknown;

  nomeRecebedor?: string | null;
  documentoRecebedor?: string | null;

  fotoUrl?: string | null;
  fotos?: string[];

  latitudeEntrega?: number | null;
  longitudeEntrega?: number | null;

  observacao?: string | null;

  historico?: PackageHistory[];
}
export interface CompanyFolder {
  id?: string;
  nome?: string;
  codigo?: string;
  [key: string]: unknown;
}

export interface Company {
  id: string;
  nome: string;
  razaoSocial?: string | null;
  cnpj?: string | null;

  telefone?: string | null;
  email?: string | null;

  endereco?: string | null;

  ativo?: boolean;

  pastas?: CompanyFolder[];

  createdAt?: unknown;
  updatedAt?: unknown;
}
import { ConversationPhase } from '../conversations/conversation.types';

export type IntentType =
  | 'AGENDAMENTO'
  | 'REAGENDAMENTO'
  | 'CANCELAMENTO'
  | 'CONSULTA_AGENDA'
  | 'PAGAMENTO'
  | 'FAQ'
  | 'HANDOFF'
  | 'SAUDACAO'
  | 'OUTRO';

export interface BotResponse {
  intent: IntentType;
  fase: ConversationPhase;
  message: string;
  extraido: {
    profissional: string | null;
    modalidade: string | null;
    dia: string | null;       // YYYY-MM-DD quando cliente informar o dia preferido
    horario: string | null;   // ISO datetime quando cliente escolher o slot
    nomeCliente: string | null;
  };
}

export interface Profissional {
  id: string;
  nome: string;
  apelidos: string[];
  especialidades: string[];
  gcalCalendarId?: string;
  slotCapacity?: number;
  businessHours?: Record<string, { open: string; close: string }[] | null>;
  servicos?: ProfessionalServiceInfo[];
}

export interface ServicoInfo {
  id?: string;
  nome: string;
  preco: number;
  duracaoMin: number;
  requerHumano: boolean;
  schedulingMode: 'individual' | 'group';
}

export interface ProfessionalServiceInfo extends ServicoInfo {
  professionalServiceId?: string;
  serviceId: string;
  slotCapacity: number;
  active: boolean;
}

export interface PromptContext {
  assistantName: string;
  studioName: string;
  extraRules?: string;
  behaviorNotes?: string;
  profissionais: Profissional[];
  servicos: ServicoInfo[];
  conversationState: string;
  conversationHistory: string;
  ragContext: string;
  customerData: string;
  today: string;        // ex: "Quarta-feira, 29/04/2026"
  todayIso: string;     // ex: "2026-04-29"
  tomorrowIso: string;  // ex: "2026-04-30"
}

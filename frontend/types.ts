
export type MessageRole = 'user' | 'assistant' | 'system';


export interface MessageMetadata {
  iterations?: number;
  tools_used?: number;
  timestamp?: string;
  model?: string;
  [key: string]: any;
}

export interface ToolResult {
  tool_name: string;
  success: boolean;
  [key: string]: any;
}

export interface ChannelToolView {
  view_type: string;
  payload: Record<string, any>;
  fallback_text?: string;
}

export interface ResolvedToolView {
  tool_name?: string;
  channel: string;
  view: ChannelToolView;
  fallback_text?: string;
  metadata?: Record<string, any>;
}

export interface ToolViewEnvelope {
  type: 'tool_view';
  channel: string;
  views: ResolvedToolView[];
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
  toolResults?: ToolResult[];
  toolViews?: ResolvedToolView[];
  isStreaming?: boolean;
}

export interface WSMessage {
  type: 'welcome' | 'context_initialized' | 'context_received' | 'ack' | 'stream' | 'stream_end' | 'response' | 'message' | 'response_complete' | 'tools' | 'tool_view' | 'error';
  message?: string;
  content?: string;
  session_id?: string;
  channel?: string;
  request_id?: string;
  context?: Record<string, string>;
  metadata?: MessageMetadata;
  tool_results?: ToolResult[];
  data?: ToolViewEnvelope;
}

export type AgentKey = 'root' | 'flight' | 'expense' | 'booking';

export type ControlStatus = 'enabled' | 'disabled' | 'maintenance';

export interface AdminRecord {
  id: string;
  name: string;
  description: string;
  status: ControlStatus;
  kind?: 'builtin' | 'mcp' | 'api' | 'function';
  version?: string;
  config?: Record<string, any>;
  auth_secret_ref?: string | null;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  user_id: string;
  agent_id: AgentKey | string;
  status: 'active' | 'idle' | 'ended' | 'failed';
  started_at: string;
  last_seen_at: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ToolInvocation {
  id: string;
  session_id: string;
  tool_id: string;
  status: 'running' | 'success' | 'failed';
  started_at: string;
  completed_at?: string | null;
  latency_ms?: number | null;
  error_message?: string | null;
}

export interface AdminSnapshot {
  metrics: {
    agents_running: number;
    tools_running: number;
    users_online: number;
    active_sessions: number;
    registered_agents: number;
    registered_tools: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  agents: AdminRecord[];
  tools: AdminRecord[];
  sessions: AdminSession[];
  tool_invocations: ToolInvocation[];
  audit_log: Record<string, any>[];
}

export type StreamEvent =
  | { type: 'session'; data: { session_id: string; agent: AgentKey } }
  | { type: 'message'; data: { text: string; final?: boolean } }
  | { type: 'tool_call'; data: Record<string, any> }
  | { type: 'tool_response'; data: Record<string, any> }
  | { type: 'error'; data: { message: string; session_id?: string } }
  | { type: 'done'; data: { session_id: string } }
  | { type: 'event'; data: Record<string, any> };

export interface ContextData {
  booking_ref: string;
  company_id: string;
  [key: string]: string;
}

export interface LoginPayload {
  companyId: string;
  accountNo: string;
  userName: string;
  password: string;
  source: string;
  uid?: string;
  subAgentId?: string;
  saUserId?: string;
  corporateId?: string;
}

export interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departure: {
    city: string;
    code: string;
    time: string;
  };
  arrival: {
    city: string;
    code: string;
    time: string;
  };
  duration: string;
  price: {
    amount: number;
    currency: string;
  };
  stops?: number;
}

export interface CreditCard {
  id: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover';
  last4: string;
  cardHolder: string;
  expiry: string; // MM/YY
  issuer: string;
  gradient: string; // CSS gradient string
}

export interface BookingDetails {
  reference: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  passengerName: string;
  flight: {
    airline: string;
    flightNumber: string;
    origin: string;
    destination: string;
    date: string;
  };
}

export interface FareRule {
  title: string;
  description: string;
  category: 'cancellation' | 'change' | 'baggage' | 'other';
  fee?: string;
}

export interface CancellationPolicy {
  refundable: boolean;
  refundAmount?: string;
  deadline?: string;
  notes?: string[];
}

export interface ExpenseItem {
  Expense_Id: number;
  ExpenseDate: string;
  CategoryName: string;
  Merchant: string;
  InvoiceNo: string;
  Currency: string;
  Amount: number;
  TaxAmount: number;
  GSTNumber: string;
  ModeOfPayment: string;
  SameInvoiceCount: number;
  ImagePath: string | null;
  IsImageUploaded: number;
  Trip_Id?: number;
  Trip_Name?: string;
  TripStart_Date?: string;
  TripEnd_Date?: string;
  Comments?: string;
  PolicyStatus?: boolean;
  IsPersonal?: boolean | null;
  PolicyReason?: string;
}

export interface ExpenseReportData {
  TripExpense: ExpenseItem[];
  FiledTrip: ExpenseItem[];
  PersonalTrip: ExpenseItem[];
  DeletedTrip: ExpenseItem[];
}

export interface ExpenseReportResponse {
  Status: string;
  Message: string;
  Data: ExpenseReportData;
}

export interface ExpenseCategoryItem {
  Category_ID: number;
  Category_Name: string;
}

export interface PaymentModeItem {
  PaymentMode_Code: string;
  PaymentMode_Display_Name: string;
}

export interface CorporateCurrencyItem {
  Currency: string;
}

export interface CurrencyItem {
  currency_code: string;
  CurrencyDescription: string;
}

export interface TripItem {
  Trip_Id: number;
  Trip_Name: string;
  PerDiem_Allowance: number;
  Advance_Amount: number;
}

export interface ConveyanceCategoryItem {
  Category_ID: number;
}

export interface ExpenseSettingsData {
  PaymentModes: PaymentModeItem[];
  CorporateCurrency: CorporateCurrencyItem[];
  Currency: CurrencyItem[];
  Trip: TripItem[];
  ExpenseCategory: ExpenseCategoryItem[];
  conveyancecategory: ConveyanceCategoryItem[];
  ConveyanceForExpense: unknown | null;
}

export interface ExpenseSettingsResponse {
  Status: string;
  Message: string;
  Data: ExpenseSettingsData;
}

export interface ExpenseSettingsPayload {
  title?: string;
  categories: { id: number; name: string }[];
  payment_modes: { code: string; name: string }[];
  currencies: { code: string; name: string }[];
  corporate_currency?: string | null;
  trips: {
    id: number;
    name: string;
    per_diem_allowance: number;
    advance_amount: number;
  }[];
}


declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BASE_URL: string,
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string; // Optional property
    }
  }
}

export interface SessionItem {
  token: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  createdAt: number;
  submittedAt: number | null;
  status: string;
  hasAnswers: boolean;
}

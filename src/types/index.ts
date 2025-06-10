import { Request } from 'express';

export interface Company {
  id: string;
  name: string;
  // Add other fields as needed
}

export interface AuthenticatedRequest extends Request {
  company?: Company;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}

export interface TransactionRequest {
  contractAddress: string;
  functionName: string;
  parameters: any[];
  network?: string;
}
import { Request } from 'express';

// Define your Company interface properly
export interface Company {
  id: string;
  name: string;
  email: string; // Required property to fix the build error
  createdAt?: Date;
  updatedAt?: Date;
  // Add other fields as needed
}

// Define User interface
export interface User {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  name?: string; // Make name optional since Express doesn't expect it
}


// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string; // Optional: for tracking
}

// Health check interface
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'; // More specific types
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}

// Blockchain transaction interface
export interface TransactionRequest {
  contractAddress: string;
  functionName: string;
  parameters: any[];
  network?: string;
  gasLimit?: number; // Optional: for gas estimation
  gasPrice?: string; // Optional: for gas price
}

// Pagination interfaces for B2B platform
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// Additional useful interfaces for B2B platform
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  companyName?: string;
}

export interface AuthResponse extends ApiResponse {
  data?: {
    user: User;
    company?: Company;
    token: string;
    refreshToken?: string;
  };
}
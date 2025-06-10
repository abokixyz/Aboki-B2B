import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types';

const prisma = new PrismaClient();

export const createCompany = async (req: Request, res: Response) => {
  try {
    const { name, email, walletAddress } = req.body;

    // Check if company already exists
    const existingCompany = await prisma.company.findUnique({
      where: { email }
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        error: 'Company with this email already exists'
      } as ApiResponse);
    }

    // Create new company
    const company = await prisma.company.create({
      data: {
        name,
        email,
        walletAddress
      },
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        apiKey: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      data: company,
      message: 'Company created successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create company'
    } as ApiResponse);
  }
};

export const getCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        walletAddress: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
            contracts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: companies
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies'
    } as ApiResponse);
  }
};
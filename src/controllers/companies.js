// src/controllers/companies.js
const { Company } = require('../models');

const createCompany = async (req, res) => {
 try {
   const { name, email, walletAddress } = req.body;

   // Check if company already exists
   const existingCompany = await Company.findOne({ email });

   if (existingCompany) {
     return res.status(400).json({
       success: false,
       error: 'Company with this email already exists'
     });
   }

   // Create new company
   const company = await Company.create({
     name,
     email,
     walletAddress
   });

   // Return selected fields
   const companyData = {
     id: company._id,
     name: company.name,
     email: company.email,
     walletAddress: company.walletAddress,
     apiKey: company.apiKey,
     isActive: company.isActive,
     createdAt: company.createdAt
   };

   res.status(201).json({
     success: true,
     data: companyData,
     message: 'Company created successfully'
   });

 } catch (error) {
   console.error('Error creating company:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to create company'
   });
 }
};

const getCompanies = async (req, res) => {
 try {
   const companies = await Company.aggregate([
     {
       $lookup: {
         from: 'transactions',
         localField: '_id',
         foreignField: 'companyId',
         as: 'transactions'
       }
     },
     {
       $lookup: {
         from: 'contracts',
         localField: '_id',
         foreignField: 'companyId',
         as: 'contracts'
       }
     },
     {
       $project: {
         id: '$_id',
         name: 1,
         email: 1,
         walletAddress: 1,
         isActive: 1,
         createdAt: 1,
         _count: {
           transactions: { $size: '$transactions' },
           contracts: { $size: '$contracts' }
         }
       }
     },
     {
       $sort: { createdAt: -1 }
     }
   ]);

   res.json({
     success: true,
     data: companies
   });

 } catch (error) {
   console.error('Error fetching companies:', error);
   res.status(500).json({
     success: false,
     error: 'Failed to fetch companies'
   });
 }
};

module.exports = {
 createCompany,
 getCompanies
};
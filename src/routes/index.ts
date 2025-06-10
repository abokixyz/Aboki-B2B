import { Router } from 'express';
import { healthCheck, basicHealth } from '../controllers/healthController';
import { createCompany, getCompanies } from '../controllers/companyController';

const router = Router();

// Health check routes - simplified paths
router.get('/', basicHealth);
router.get('/health', healthCheck);

// Company routes - ensure clean paths
router.get('/companies', getCompanies);
// Uncomment when ready to use
// router.post('/companies', createCompany);

// Optional: Add specific company route if needed
// router.get('/companies/:id', getCompanyById);

export default router;
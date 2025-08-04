/**
 * Liquidity Provider Service
 * Handles all liquidity provider validations and dashboard operations
 * 
 * File: services/liquidityService.js
 */

const axios = require('axios');

class LiquidityService {
  constructor(adminApiUrl = null, adminToken = null) {
    this.adminApiUrl = adminApiUrl || process.env.ADMIN_API_BASE_URL || 'http://localhost:5001';
    this.adminToken = adminToken || process.env.ADMIN_API_TOKEN;
    this.bufferPercentage = parseFloat(process.env.LIQUIDITY_BUFFER_PERCENTAGE || '20') / 100;
  }
  
  /**
   * Check if sufficient liquidity is available for a given network and amount
   */
  async checkAvailability(network, requiredUsdcAmount) {
    try {
      console.log(`[LIQUIDITY_SERVICE] Checking ${network} liquidity for $${requiredUsdcAmount} USDC`);
      
      if (!this.adminToken) {
        console.warn('[LIQUIDITY_SERVICE] Admin API token not configured, skipping liquidity check');
        return {
          success: true,
          hasLiquidity: true,
          note: 'Liquidity check skipped - admin token not configured'
        };
      }
      
      // Calculate minimum balance needed (add buffer for safety)
      const minRequiredBalance = requiredUsdcAmount * (1 + this.bufferPercentage);
      
      // Query liquidity providers for the specific network
      const queryParams = new URLSearchParams({
        network: network === 'base' ? 'base' : network === 'solana' ? 'solana' : 'total',
        liquidityType: 'onramp',
        isActive: 'true',
        isVerified: 'false', // Include unverified for now
        minBalance: minRequiredBalance.toString(),
        sortBy: 'totalBalance',
        sortOrder: 'desc',
        limit: '10'
      });
      
      console.log(`[LIQUIDITY_SERVICE] Querying providers with min balance: $${minRequiredBalance} USDC (${this.bufferPercentage * 100}% buffer)`);
      
      const response = await axios.get(`${this.adminApiUrl}/api/admin/liquidity-providers?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (!response.data || !response.data.success) {
        throw new Error('Failed to fetch liquidity provider data');
      }
      
      const data = response.data.data;
      const availableProviders = data.providers || [];
      
      console.log(`[LIQUIDITY_SERVICE] Found ${availableProviders.length} providers with sufficient balance`);
      
      // Calculate total available liquidity
      let totalAvailableLiquidity = 0;
      const suitableProviders = [];
      
      for (const provider of availableProviders) {
        const providerBalance = network === 'base' ? provider.balances.base : 
                              network === 'solana' ? provider.balances.solana : 
                              provider.balances.total;
        
        if (providerBalance >= requiredUsdcAmount) {
          totalAvailableLiquidity += providerBalance;
          suitableProviders.push({
            id: provider.id,
            name: provider.user.name,
            email: provider.user.email,
            balance: providerBalance,
            walletAddress: network === 'base' ? provider.wallets.baseAddress : provider.wallets.solanaAddress,
            isVerified: provider.status.isVerified
          });
        }
      }
      
      const hasEnoughLiquidity = totalAvailableLiquidity >= requiredUsdcAmount;
      
      console.log(`[LIQUIDITY_SERVICE] Liquidity analysis:`);
      console.log(`  - Required: $${requiredUsdcAmount} USDC`);
      console.log(`  - Available: $${totalAvailableLiquidity} USDC`);
      console.log(`  - Suitable providers: ${suitableProviders.length}`);
      console.log(`  - Has enough liquidity: ${hasEnoughLiquidity ? '✅' : '❌'}`);
      
      return {
        success: true,
        hasLiquidity: hasEnoughLiquidity,
        liquidityAnalysis: {
          network,
          requiredAmount: requiredUsdcAmount,
          totalAvailable: totalAvailableLiquidity,
          liquidityRatio: totalAvailableLiquidity / requiredUsdcAmount,
          suitableProvidersCount: suitableProviders.length,
          recommendedProvider: suitableProviders[0] || null, // Best provider (highest balance)
          allSuitableProviders: suitableProviders.slice(0, 3), // Top 3 providers
          bufferUsed: minRequiredBalance,
          bufferPercentage: this.bufferPercentage * 100
        },
        recommendation: hasEnoughLiquidity 
          ? `Sufficient liquidity available with ${suitableProviders.length} provider(s)`
          : `Insufficient liquidity: need $${requiredUsdcAmount} but only $${totalAvailableLiquidity} available`
      };
      
    } catch (error) {
      console.error(`[LIQUIDITY_SERVICE] Error checking liquidity:`, error.message);
      
      // Don't block order creation on liquidity check errors - log and continue
      return {
        success: false,
        hasLiquidity: true, // Assume liquidity exists to not block orders
        error: error.message,
        note: 'Liquidity check failed but order allowed to proceed'
      };
    }
  }
  
  /**
   * Get comprehensive liquidity dashboard data
   */
  async getDashboard() {
    try {
      console.log('[LIQUIDITY_SERVICE] Getting liquidity dashboard');
      
      if (!this.adminToken) {
        throw new Error('Admin API token not configured');
      }
      
      // Get all active liquidity providers
      const response = await axios.get(`${this.adminApiUrl}/api/admin/liquidity-providers`, {
        params: {
          liquidityType: 'onramp',
          isActive: 'true',
          sortBy: 'totalBalance',
          sortOrder: 'desc',
          limit: '50'
        },
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (!response.data || !response.data.success) {
        throw new Error('Failed to fetch liquidity provider data');
      }
      
      const data = response.data.data;
      const providers = data.providers || [];
      
      // Analyze liquidity by network
      const networkAnalysis = {
        base: {
          providers: [],
          totalLiquidity: 0,
          averageBalance: 0,
          maxSingleOrder: 0
        },
        solana: {
          providers: [],
          totalLiquidity: 0,
          averageBalance: 0,
          maxSingleOrder: 0
        },
        overall: {
          totalProviders: providers.length,
          activeProviders: providers.filter(p => p.status.isActive).length,
          verifiedProviders: providers.filter(p => p.status.isVerified).length,
          totalLiquidity: data.summary?.totalBalance || 0
        }
      };
      
      // Process each provider
      providers.forEach(provider => {
        // Base network analysis
        if (provider.balances.base > 0) {
          networkAnalysis.base.providers.push({
            id: provider.id,
            name: provider.user.name,
            email: provider.user.email,
            balance: provider.balances.base,
            walletAddress: provider.wallets.baseAddress,
            isVerified: provider.status.isVerified
          });
          networkAnalysis.base.totalLiquidity += provider.balances.base;
          networkAnalysis.base.maxSingleOrder = Math.max(
            networkAnalysis.base.maxSingleOrder, 
            provider.balances.base * 0.8 // 80% of balance for safety
          );
        }
        
        // Solana network analysis
        if (provider.balances.solana > 0) {
          networkAnalysis.solana.providers.push({
            id: provider.id,
            name: provider.user.name,
            email: provider.user.email,
            balance: provider.balances.solana,
            walletAddress: provider.wallets.solanaAddress,
            isVerified: provider.status.isVerified
          });
          networkAnalysis.solana.totalLiquidity += provider.balances.solana;
          networkAnalysis.solana.maxSingleOrder = Math.max(
            networkAnalysis.solana.maxSingleOrder,
            provider.balances.solana * 0.8
          );
        }
      });
      
      // Calculate averages
      if (networkAnalysis.base.providers.length > 0) {
        networkAnalysis.base.averageBalance = networkAnalysis.base.totalLiquidity / networkAnalysis.base.providers.length;
      }
      if (networkAnalysis.solana.providers.length > 0) {
        networkAnalysis.solana.averageBalance = networkAnalysis.solana.totalLiquidity / networkAnalysis.solana.providers.length;
      }
      
      // Health assessment
      const healthMetrics = {
        base: {
          status: networkAnalysis.base.totalLiquidity >= 10 ? 'healthy' : 
                  networkAnalysis.base.totalLiquidity >= 5 ? 'warning' : 'critical',
          providerCount: networkAnalysis.base.providers.length,
          liquidityLevel: networkAnalysis.base.totalLiquidity >= 50 ? 'high' :
                         networkAnalysis.base.totalLiquidity >= 20 ? 'medium' : 'low',
          canHandleLargeOrders: networkAnalysis.base.maxSingleOrder >= 10
        },
        solana: {
          status: networkAnalysis.solana.totalLiquidity >= 10 ? 'healthy' : 
                  networkAnalysis.solana.totalLiquidity >= 5 ? 'warning' : 'critical',
          providerCount: networkAnalysis.solana.providers.length,
          liquidityLevel: networkAnalysis.solana.totalLiquidity >= 50 ? 'high' :
                         networkAnalysis.solana.totalLiquidity >= 20 ? 'medium' : 'low',
          canHandleLargeOrders: networkAnalysis.solana.maxSingleOrder >= 10
        }
      };
      
      // Generate recommendations
      const recommendations = [];
      
      if (healthMetrics.base.status === 'critical') {
        recommendations.push({
          type: 'CRITICAL',
          network: 'base',
          message: 'Base network liquidity is critically low - orders may fail',
          action: 'Add more Base liquidity providers or increase existing balances'
        });
      }
      
      if (healthMetrics.solana.status === 'critical') {
        recommendations.push({
          type: 'CRITICAL',
          network: 'solana',
          message: 'Solana network liquidity is critically low - orders may fail',
          action: 'Add more Solana liquidity providers or increase existing balances'
        });
      }
      
      if (networkAnalysis.overall.verifiedProviders < networkAnalysis.overall.activeProviders * 0.5) {
        recommendations.push({
          type: 'WARNING',
          network: 'overall',
          message: 'Less than 50% of providers are verified',
          action: 'Verify more liquidity providers to improve trust and reliability'
        });
      }
      
      if (recommendations.length === 0) {
        recommendations.push({
          type: 'INFO',
          network: 'overall',
          message: 'Liquidity levels are adequate across all networks',
          action: 'Continue monitoring and maintain current provider relationships'
        });
      }
      
      return {
        timestamp: new Date().toISOString(),
        networkAnalysis,
        healthMetrics,
        recommendations,
        summary: {
          overallHealth: Math.min(
            healthMetrics.base.status === 'healthy' ? 3 : healthMetrics.base.status === 'warning' ? 2 : 1,
            healthMetrics.solana.status === 'healthy' ? 3 : healthMetrics.solana.status === 'warning' ? 2 : 1
          ) === 3 ? 'healthy' : 
          Math.min(
            healthMetrics.base.status === 'healthy' ? 3 : healthMetrics.base.status === 'warning' ? 2 : 1,
            healthMetrics.solana.status === 'healthy' ? 3 : healthMetrics.solana.status === 'warning' ? 2 : 1
          ) === 2 ? 'warning' : 'critical',
          totalProvidersActive: networkAnalysis.overall.activeProviders,
          totalLiquidityUsd: networkAnalysis.base.totalLiquidity + networkAnalysis.solana.totalLiquidity,
          networksOperational: (healthMetrics.base.status !== 'critical' ? 1 : 0) + (healthMetrics.solana.status !== 'critical' ? 1 : 0),
          maxOrderCapacity: Math.max(networkAnalysis.base.maxSingleOrder, networkAnalysis.solana.maxSingleOrder)
        }
      };
      
    } catch (error) {
      console.error('[LIQUIDITY_SERVICE] Dashboard error:', error);
      throw new Error(`Failed to get liquidity dashboard: ${error.message}`);
    }
  }
  
  /**
   * Get real-time liquidity status (lightweight)
   */
  async getStatus(network = null) {
    try {
      console.log(`[LIQUIDITY_SERVICE] Getting liquidity status${network ? ` for ${network}` : ''}`);
      
      if (!this.adminToken) {
        throw new Error('Admin API token not configured');
      }
      
      const queryParams = new URLSearchParams({
        liquidityType: 'onramp',
        isActive: 'true',
        sortBy: 'totalBalance',
        sortOrder: 'desc',
        limit: '20'
      });
      
      if (network) {
        queryParams.append('network', network);
      }
      
      const response = await axios.get(`${this.adminApiUrl}/api/admin/liquidity-providers?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (!response.data?.success) {
        throw new Error('Failed to fetch liquidity data');
      }
      
      const data = response.data.data;
      
      // Quick status calculation
      const quickStatus = {
        timestamp: new Date().toISOString(),
        networks: {
          base: {
            totalLiquidity: data.summary?.totalBaseBalance || 0,
            providerCount: data.providers?.filter(p => p.balances.base > 0).length || 0,
            status: (data.summary?.totalBaseBalance || 0) >= 10 ? 'healthy' : 
                    (data.summary?.totalBaseBalance || 0) >= 5 ? 'warning' : 'critical'
          },
          solana: {
            totalLiquidity: data.summary?.totalSolanaBalance || 0,
            providerCount: data.providers?.filter(p => p.balances.solana > 0).length || 0,
            status: (data.summary?.totalSolanaBalance || 0) >= 10 ? 'healthy' : 
                    (data.summary?.totalSolanaBalance || 0) >= 5 ? 'warning' : 'critical'
          }
        },
        overall: {
          status: Math.min(
            (data.summary?.totalBaseBalance || 0) >= 5 ? 2 : 1,
            (data.summary?.totalSolanaBalance || 0) >= 5 ? 2 : 1
          ) === 2 ? 'operational' : 'degraded',
          totalProviders: data.providers?.length || 0,
          totalLiquidityUsd: (data.summary?.totalBalance || 0)
        },
        alerts: []
      };
      
      // Generate alerts
      if (quickStatus.networks.base.status === 'critical') {
        quickStatus.alerts.push({
          level: 'CRITICAL',
          network: 'base',
          message: 'Base network liquidity critically low',
          impact: 'New Base orders may fail'
        });
      }
      
      if (quickStatus.networks.solana.status === 'critical') {
        quickStatus.alerts.push({
          level: 'CRITICAL',
          network: 'solana',
          message: 'Solana network liquidity critically low',
          impact: 'New Solana orders may fail'
        });
      }
      
      if (quickStatus.overall.totalProviders === 0) {
        quickStatus.alerts.push({
          level: 'CRITICAL',
          network: 'overall',
          message: 'No active liquidity providers',
          impact: 'All new orders will fail'
        });
      }
      
      return quickStatus;
      
    } catch (error) {
      console.error('[LIQUIDITY_SERVICE] Status error:', error);
      return {
        error: error.message,
        status: 'unknown',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Check if a specific order can be fulfilled
   */
  async checkOrderFulfillment(network, requiredUsdcAmount, customerNgnAmount) {
    try {
      console.log(`[LIQUIDITY_SERVICE] Checking order fulfillment: $${requiredUsdcAmount} USDC on ${network}`);
      
      const liquidityCheck = await this.checkAvailability(network, requiredUsdcAmount);
      
      const fulfillmentAnalysis = {
        canFulfill: liquidityCheck.hasLiquidity,
        network,
        requiredUsdcAmount,
        customerNgnAmount,
        liquidityAnalysis: liquidityCheck.liquidityAnalysis,
        recommendation: liquidityCheck.recommendation,
        alternativeOptions: []
      };
      
      // If can't fulfill, suggest alternatives
      if (!liquidityCheck.hasLiquidity) {
        const availableLiquidity = liquidityCheck.liquidityAnalysis?.totalAvailable || 0;
        if (availableLiquidity > 0) {
          const maxFulfillableUsd = availableLiquidity * 0.8; // 80% for safety
          const maxFulfillableNgnRatio = maxFulfillableUsd / requiredUsdcAmount;
          const maxFulfillableNgn = customerNgnAmount * maxFulfillableNgnRatio;
          
          fulfillmentAnalysis.alternativeOptions.push({
            type: 'REDUCE_AMOUNT',
            suggestion: `Maximum fulfillable amount: ₦${Math.floor(maxFulfillableNgn).toLocaleString()}`,
            maxNgnAmount: Math.floor(maxFulfillableNgn),
            maxUsdcAmount: maxFulfillableUsd
          });
        }
        
        fulfillmentAnalysis.alternativeOptions.push({
          type: 'WAIT_FOR_LIQUIDITY',
          suggestion: 'Wait for liquidity providers to add more funds',
          estimatedWaitTime: '5-30 minutes'
        });
        
        fulfillmentAnalysis.alternativeOptions.push({
          type: 'SPLIT_ORDER',
          suggestion: 'Split into multiple smaller orders over time',
          recommendedSplits: Math.ceil(requiredUsdcAmount / (availableLiquidity * 0.8))
        });
      }
      
      return fulfillmentAnalysis;
      
    } catch (error) {
      console.error('[LIQUIDITY_SERVICE] Fulfillment check error:', error);
      throw new Error(`Failed to check order fulfillment: ${error.message}`);
    }
  }
  
  /**
   * Validate service configuration
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.adminApiUrl) {
      issues.push('ADMIN_API_BASE_URL not configured');
    }
    
    if (!this.adminToken) {
      issues.push('ADMIN_API_TOKEN not configured');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      config: {
        adminApiUrl: this.adminApiUrl,
        hasToken: !!this.adminToken,
        bufferPercentage: this.bufferPercentage * 100
      }
    };
  }
}

// Export both the class and a singleton instance
const liquidityService = new LiquidityService();

module.exports = {
  LiquidityService,
  liquidityService,
  
  // Export individual methods for convenience
  checkLiquidityProviderAvailability: (network, amount) => liquidityService.checkAvailability(network, amount),
  getLiquidityDashboard: () => liquidityService.getDashboard(),
  getLiquidityStatus: (network) => liquidityService.getStatus(network),
  checkOrderFulfillment: (network, usdcAmount, ngnAmount) => liquidityService.checkOrderFulfillment(network, usdcAmount, ngnAmount)
};
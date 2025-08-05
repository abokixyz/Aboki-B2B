/**
 * FIXED Liquidity Provider Service - Single Provider Transaction Model
 * Each transaction must be handled by ONE liquidity provider
 * Works with real API data only
 * 
 * File: services/liquidityService.js
 */

const axios = require('axios');

class LiquidityService {
  constructor(adminApiUrl = null, adminToken = null) {
    this.adminApiUrl = adminApiUrl || process.env.ADMIN_API_BASE_URL || 'http://localhost:5001';
    this.adminToken = adminToken || process.env.ADMIN_API_TOKEN;
    this.bufferPercentage = parseFloat(process.env.LIQUIDITY_BUFFER_PERCENTAGE || '5') / 100; // 5% safety buffer
    
    console.log(`[LIQUIDITY_SERVICE] 🔧 Initialized with:`);
    console.log(`[LIQUIDITY_SERVICE]   - Admin API: ${this.adminApiUrl}`);
    console.log(`[LIQUIDITY_SERVICE]   - Has Token: ${!!this.adminToken}`);
    console.log(`[LIQUIDITY_SERVICE]   - Buffer: ${this.bufferPercentage * 100}%`);
    console.log(`[LIQUIDITY_SERVICE]   - Model: Single Provider Per Transaction`);
  }
  
  /**
   * FIXED: Check if ANY SINGLE liquidity provider can handle the full transaction
   * This is the correct model for onramp transactions - NO AGGREGATION
   */
  async checkAvailability(network, requiredUsdcAmount) {
    const checkId = Math.random().toString(36).substr(2, 6);
    console.log(`[LIQUIDITY_CHECK_${checkId}] 🔍 Starting liquidity check`);
    console.log(`[LIQUIDITY_CHECK_${checkId}] 📊 Required: $${requiredUsdcAmount} USDC on ${network}`);
    console.log(`[LIQUIDITY_CHECK_${checkId}] 🎯 Model: Single provider must handle entire amount`);
    
    // Validate inputs
    if (!network || !requiredUsdcAmount || requiredUsdcAmount <= 0) {
      console.error(`[LIQUIDITY_CHECK_${checkId}] ❌ Invalid inputs: network=${network}, amount=${requiredUsdcAmount}`);
      return {
        success: false,
        hasLiquidity: false,
        error: 'Invalid network or amount parameters',
        liquidityAnalysis: {
          network,
          requiredAmount: requiredUsdcAmount,
          error: 'Invalid parameters'
        }
      };
    }
    
    // Check if admin API is configured
    if (!this.adminToken) {
      console.warn(`[LIQUIDITY_CHECK_${checkId}] ⚠️  Admin API token not configured`);
      console.warn(`[LIQUIDITY_CHECK_${checkId}] ⚠️  Skipping liquidity validation - ORDERS MAY FAIL`);
      return {
        success: true,
        hasLiquidity: true, // Assume available when not configured
        note: 'Liquidity check skipped - admin token not configured',
        liquidityAnalysis: {
          network,
          requiredAmount: requiredUsdcAmount,
          skipped: true,
          reason: 'Admin API not configured'
        }
      };
    }
    
    try {
      // Query ALL active liquidity providers
      const queryParams = new URLSearchParams({
        network: 'total', // Get all networks to analyze properly
        liquidityType: 'onramp',
        isActive: 'true',
        isVerified: 'false', // Include unverified providers
        minBalance: '0.01', // Very low threshold to get all providers
        sortBy: 'totalBalance',
        sortOrder: 'desc',
        limit: '100' // Get all providers
      });
      
      const apiUrl = `${this.adminApiUrl}/api/admin/liquidity-providers?${queryParams}`;
      console.log(`[LIQUIDITY_CHECK_${checkId}] 🌐 Calling API: ${apiUrl}`);
      
      const startTime = Date.now();
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'OnrampService/4.0-LiquidityCheck'
        },
        timeout: 15000
      });
      
      const apiTime = Date.now() - startTime;
      console.log(`[LIQUIDITY_CHECK_${checkId}] ✅ API responded in ${apiTime}ms`);
      
      // Validate API response
      if (!response.data) {
        throw new Error('No response data from admin API');
      }
      
      if (!response.data.success) {
        throw new Error(`Admin API error: ${response.data.message || 'Unknown error'}`);
      }
      
      const data = response.data.data;
      if (!data || !Array.isArray(data.providers)) {
        throw new Error('Invalid response format from admin API');
      }
      
      const allProviders = data.providers;
      console.log(`[LIQUIDITY_CHECK_${checkId}] 📊 Retrieved ${allProviders.length} providers from API`);
      console.log(`[LIQUIDITY_CHECK_${checkId}] 💰 API Summary:`, {
        totalProviders: data.summary?.totalProviders || 0,
        totalBalance: data.summary?.totalBalance || 0,
        baseBalance: data.summary?.totalBaseBalance || 0,
        solanaBalance: data.summary?.totalSolanaBalance || 0
      });
      
      // CRITICAL: Find providers that can handle the FULL transaction amount
      const capableProviders = [];
      let maxSingleProviderBalance = 0;
      let totalNetworkLiquidity = 0;
      let activeProvidersOnNetwork = 0;
      
      console.log(`[LIQUIDITY_CHECK_${checkId}] 🔍 Analyzing providers for ${network} network:`);
      
      for (let i = 0; i < allProviders.length; i++) {
        const provider = allProviders[i];
        
        // Get the specific network balance
        const networkBalance = network === 'base' ? provider.balances.base : 
                              network === 'solana' ? provider.balances.solana : 
                              provider.balances.total;
        
        // Count active providers and total liquidity on this network
        if (networkBalance > 0) {
          activeProvidersOnNetwork++;
          totalNetworkLiquidity += networkBalance;
          maxSingleProviderBalance = Math.max(maxSingleProviderBalance, networkBalance);
        }
        
        console.log(`[LIQUIDITY_CHECK_${checkId}] 👤 Provider ${i + 1}: ${provider.user.name}`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - ${network} Balance: $${networkBalance} USDC`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Active: ${provider.status.isActive ? '✅' : '❌'}`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Verified: ${provider.status.isVerified ? '✅' : '❌'}`);
        
        // CRITICAL CHECK: Can this single provider handle the FULL required amount?
        const canHandleFullAmount = networkBalance >= requiredUsdcAmount;
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Can Handle $${requiredUsdcAmount}? ${canHandleFullAmount ? '✅ YES' : '❌ NO'}`);
        
        if (canHandleFullAmount) {
          const utilizationRate = (requiredUsdcAmount / networkBalance * 100);
          const remainingBalance = networkBalance - requiredUsdcAmount;
          
          capableProviders.push({
            id: provider.id,
            name: provider.user.name,
            email: provider.user.email,
            balance: networkBalance,
            remainingAfterTx: remainingBalance,
            utilizationRate: parseFloat(utilizationRate.toFixed(2)),
            walletAddress: network === 'base' ? provider.wallets.baseAddress : provider.wallets.solanaAddress,
            isVerified: provider.status.isVerified,
            isActive: provider.status.isActive,
            selectionScore: this.calculateProviderScore(provider, networkBalance, requiredUsdcAmount)
          });
          
          console.log(`[LIQUIDITY_CHECK_${checkId}]   - ✅ CAPABLE: Utilization ${utilizationRate.toFixed(1)}%, Remaining $${remainingBalance.toFixed(2)}`);
        } else {
          const shortage = requiredUsdcAmount - networkBalance;
          console.log(`[LIQUIDITY_CHECK_${checkId}]   - ❌ INSUFFICIENT: Short by $${shortage.toFixed(2)} USDC`);
        }
      }
      
      // Sort capable providers by selection score (best first)
      capableProviders.sort((a, b) => b.selectionScore - a.selectionScore);
      
      // FINAL DETERMINATION: Can we fulfill the transaction?
      const hasLiquidity = capableProviders.length > 0;
      const recommendedProvider = capableProviders[0] || null;
      
      console.log(`[LIQUIDITY_CHECK_${checkId}] 🎯 LIQUIDITY ANALYSIS COMPLETE:`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Required Amount: $${requiredUsdcAmount} USDC`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Network: ${network}`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Total Providers: ${allProviders.length}`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Active on ${network}: ${activeProvidersOnNetwork}`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Total ${network} Liquidity: $${totalNetworkLiquidity} USDC`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Max Single Provider: $${maxSingleProviderBalance} USDC`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - Providers That Can Handle Full Amount: ${capableProviders.length}`);
      console.log(`[LIQUIDITY_CHECK_${checkId}]   - ⭐ CAN FULFILL: ${hasLiquidity ? '✅ YES' : '❌ NO'}`);
      
      if (recommendedProvider) {
        console.log(`[LIQUIDITY_CHECK_${checkId}] 🏆 RECOMMENDED PROVIDER:`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Name: ${recommendedProvider.name}`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Balance: $${recommendedProvider.balance} USDC`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Utilization: ${recommendedProvider.utilizationRate}%`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Remaining After TX: $${recommendedProvider.remainingAfterTx.toFixed(2)} USDC`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Verified: ${recommendedProvider.isVerified ? 'Yes' : 'No'}`);
        console.log(`[LIQUIDITY_CHECK_${checkId}]   - Selection Score: ${recommendedProvider.selectionScore}`);
      }
      
      // Generate detailed recommendation
      let recommendation;
      if (hasLiquidity) {
        recommendation = `✅ Transaction can be fulfilled. ${capableProviders.length} provider(s) available. Recommended: ${recommendedProvider.name} ($${recommendedProvider.balance} USDC, ${recommendedProvider.utilizationRate}% utilization).`;
      } else {
        const deficit = requiredUsdcAmount - maxSingleProviderBalance;
        const deficitPercentage = ((deficit / requiredUsdcAmount) * 100).toFixed(1);
        recommendation = `❌ No single provider can handle $${requiredUsdcAmount} USDC. Largest available: $${maxSingleProviderBalance} USDC. Need additional $${deficit.toFixed(2)} USDC (${deficitPercentage}% short).`;
      }
      
      console.log(`[LIQUIDITY_CHECK_${checkId}] 📝 Recommendation: ${recommendation}`);
      
      return {
        success: true,
        hasLiquidity: hasLiquidity,
        liquidityAnalysis: {
          network,
          requiredAmount: requiredUsdcAmount,
          totalNetworkLiquidity,
          maxSingleProviderAmount: maxSingleProviderBalance,
          liquidityRatio: maxSingleProviderBalance / requiredUsdcAmount,
          suitableProvidersCount: capableProviders.length,
          totalProvidersOnNetwork: activeProvidersOnNetwork,
          totalProvidersChecked: allProviders.length,
          recommendedProvider: recommendedProvider,
          allSuitableProviders: capableProviders.slice(0, 5), // Top 5
          transactionModel: 'single_provider_only',
          bufferPercentage: this.bufferPercentage * 100,
          checkId: checkId,
          apiResponseTime: apiTime,
          // Include deficit info for failed checks
          ...((!hasLiquidity) && {
            deficit: requiredUsdcAmount - maxSingleProviderBalance,
            deficitPercentage: ((requiredUsdcAmount - maxSingleProviderBalance) / requiredUsdcAmount * 100).toFixed(1),
            maxPossibleOrder: maxSingleProviderBalance * 0.9 // 90% of max provider for safety
          })
        },
        recommendation
      };
      
    } catch (error) {
      console.error(`[LIQUIDITY_CHECK_${checkId}] 💥 ERROR during liquidity check:`, error.message);
      console.error(`[LIQUIDITY_CHECK_${checkId}] Stack trace:`, error.stack);
      
      // On error, we cannot verify liquidity - return false for safety
      return {
        success: false,
        hasLiquidity: false, // SAFE DEFAULT: Assume no liquidity on error
        error: error.message,
        liquidityAnalysis: {
          network,
          requiredAmount: requiredUsdcAmount,
          error: true,
          errorMessage: error.message,
          checkId: checkId,
          transactionModel: 'single_provider_only'
        },
        recommendation: `❌ Liquidity verification failed: ${error.message}. Cannot guarantee transaction fulfillment.`
      };
    }
  }
  
  /**
   * Calculate provider selection score (0-100)
   * Higher score = better provider for the transaction
   */
  calculateProviderScore(provider, networkBalance, requiredAmount) {
    let score = 0;
    
    // Balance adequacy score (0-40 points)
    const balanceRatio = networkBalance / requiredAmount;
    if (balanceRatio >= 5) score += 40; // Excellent balance (5x requirement)
    else if (balanceRatio >= 3) score += 35; // Very good (3x requirement)
    else if (balanceRatio >= 2) score += 30; // Good (2x requirement)
    else if (balanceRatio >= 1.5) score += 25; // Adequate (1.5x requirement)
    else if (balanceRatio >= 1.2) score += 20; // Tight but acceptable
    else if (balanceRatio >= 1) score += 15; // Just enough
    
    // Verification status (0-25 points)
    if (provider.status.isVerified) score += 25;
    
    // Active status (0-15 points)
    if (provider.status.isActive) score += 15;
    
    // Utilization efficiency (0-20 points)
    // Sweet spot: 20-70% utilization of provider's balance
    const utilizationRate = requiredAmount / networkBalance;
    if (utilizationRate >= 0.2 && utilizationRate <= 0.7) {
      score += 20; // Perfect utilization range
    } else if (utilizationRate >= 0.1 && utilizationRate <= 0.8) {
      score += 15; // Good utilization
    } else if (utilizationRate >= 0.05 && utilizationRate <= 0.9) {
      score += 10; // Acceptable utilization
    } else {
      score += 5; // Poor utilization (too high or too low)
    }
    
    return parseFloat(score.toFixed(1));
  }
  
  /**
   * Get comprehensive liquidity dashboard
   */
  async getDashboard() {
    try {
      console.log('[LIQUIDITY_SERVICE] 📊 Getting liquidity dashboard');
      
      if (!this.adminToken) {
        throw new Error('Admin API token not configured');
      }
      
      const response = await axios.get(`${this.adminApiUrl}/api/admin/liquidity-providers`, {
        params: {
          liquidityType: 'onramp',
          isActive: 'true',
          sortBy: 'totalBalance',
          sortOrder: 'desc',
          limit: '100'
        },
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (!response.data?.success) {
        throw new Error('Failed to fetch liquidity provider data');
      }
      
      const data = response.data.data;
      const providers = data.providers || [];
      
      // Network analysis for single-provider model
      const networkAnalysis = {
        base: {
          providers: [],
          totalLiquidity: 0,
          maxSingleTransaction: 0,
          providerCount: 0,
          averageBalance: 0
        },
        solana: {
          providers: [],
          totalLiquidity: 0,
          maxSingleTransaction: 0,
          providerCount: 0,
          averageBalance: 0
        }
      };
      
      providers.forEach(provider => {
        // Base network analysis
        if (provider.balances.base > 0) {
          networkAnalysis.base.providers.push({
            id: provider.id,
            name: provider.user.name,
            balance: provider.balances.base,
            isVerified: provider.status.isVerified
          });
          networkAnalysis.base.totalLiquidity += provider.balances.base;
          networkAnalysis.base.maxSingleTransaction = Math.max(
            networkAnalysis.base.maxSingleTransaction,
            provider.balances.base
          );
          networkAnalysis.base.providerCount++;
        }
        
        // Solana network analysis
        if (provider.balances.solana > 0) {
          networkAnalysis.solana.providers.push({
            id: provider.id,
            name: provider.user.name,
            balance: provider.balances.solana,
            isVerified: provider.status.isVerified
          });
          networkAnalysis.solana.totalLiquidity += provider.balances.solana;
          networkAnalysis.solana.maxSingleTransaction = Math.max(
            networkAnalysis.solana.maxSingleTransaction,
            provider.balances.solana
          );
          networkAnalysis.solana.providerCount++;
        }
      });
      
      // Calculate averages
      if (networkAnalysis.base.providerCount > 0) {
        networkAnalysis.base.averageBalance = networkAnalysis.base.totalLiquidity / networkAnalysis.base.providerCount;
      }
      if (networkAnalysis.solana.providerCount > 0) {
        networkAnalysis.solana.averageBalance = networkAnalysis.solana.totalLiquidity / networkAnalysis.solana.providerCount;
      }
      
      // Health assessment based on max single transaction capacity
      const healthMetrics = {
        base: {
          status: networkAnalysis.base.maxSingleTransaction >= 100 ? 'healthy' :
                  networkAnalysis.base.maxSingleTransaction >= 50 ? 'warning' : 
                  networkAnalysis.base.maxSingleTransaction >= 10 ? 'limited' : 'critical',
          maxOrderCapacity: networkAnalysis.base.maxSingleTransaction,
          providerCount: networkAnalysis.base.providerCount,
          canHandleLargeOrders: networkAnalysis.base.maxSingleTransaction >= 100
        },
        solana: {
          status: networkAnalysis.solana.maxSingleTransaction >= 100 ? 'healthy' :
                  networkAnalysis.solana.maxSingleTransaction >= 50 ? 'warning' : 
                  networkAnalysis.solana.maxSingleTransaction >= 10 ? 'limited' : 'critical',
          maxOrderCapacity: networkAnalysis.solana.maxSingleTransaction,
          providerCount: networkAnalysis.solana.providerCount,
          canHandleLargeOrders: networkAnalysis.solana.maxSingleTransaction >= 100
        }
      };
      
      return {
        timestamp: new Date().toISOString(),
        model: 'single_provider_per_transaction',
        networkAnalysis,
        healthMetrics,
        summary: {
          overallHealth: Math.min(
            healthMetrics.base.status === 'healthy' ? 4 : healthMetrics.base.status === 'warning' ? 3 : healthMetrics.base.status === 'limited' ? 2 : 1,
            healthMetrics.solana.status === 'healthy' ? 4 : healthMetrics.solana.status === 'warning' ? 3 : healthMetrics.solana.status === 'limited' ? 2 : 1
          ) >= 3 ? 'healthy' : 
          Math.min(
            healthMetrics.base.status === 'healthy' ? 4 : healthMetrics.base.status === 'warning' ? 3 : healthMetrics.base.status === 'limited' ? 2 : 1,
            healthMetrics.solana.status === 'healthy' ? 4 : healthMetrics.solana.status === 'warning' ? 3 : healthMetrics.solana.status === 'limited' ? 2 : 1
          ) >= 2 ? 'warning' : 'critical',
          totalProvidersActive: providers.filter(p => p.status.isActive).length,
          totalLiquidityUsd: networkAnalysis.base.totalLiquidity + networkAnalysis.solana.totalLiquidity,
          maxSingleTransactionCapacity: Math.max(
            networkAnalysis.base.maxSingleTransaction,
            networkAnalysis.solana.maxSingleTransaction
          )
        }
      };
      
    } catch (error) {
      console.error('[LIQUIDITY_SERVICE] Dashboard error:', error);
      throw new Error(`Failed to get liquidity dashboard: ${error.message}`);
    }
  }
  
  /**
   * Check if a specific order can be fulfilled by a single provider
   */
  async checkOrderFulfillment(network, requiredUsdcAmount, customerNgnAmount) {
    try {
      console.log(`[LIQUIDITY_SERVICE] 🔍 Order fulfillment check: $${requiredUsdcAmount} USDC on ${network}`);
      
      const liquidityCheck = await this.checkAvailability(network, requiredUsdcAmount);
      
      const fulfillmentAnalysis = {
        canFulfill: liquidityCheck.hasLiquidity,
        network,
        requiredUsdcAmount,
        customerNgnAmount,
        liquidityAnalysis: liquidityCheck.liquidityAnalysis,
        recommendation: liquidityCheck.recommendation,
        fulfillmentModel: 'single_provider_only',
        alternativeOptions: []
      };
      
      // Generate alternatives if can't fulfill
      if (!liquidityCheck.hasLiquidity) {
        const maxAvailable = liquidityCheck.liquidityAnalysis?.maxSingleProviderAmount || 0;
        
        if (maxAvailable > 1) { // If there's some liquidity available
          const maxFulfillableRatio = (maxAvailable * 0.9) / requiredUsdcAmount; // 90% for safety
          const maxFulfillableNgn = Math.floor(customerNgnAmount * maxFulfillableRatio);
          
          fulfillmentAnalysis.alternativeOptions.push({
            type: 'REDUCE_ORDER_SIZE',
            suggestion: `Reduce order to maximum single provider capacity`,
            maxNgnAmount: maxFulfillableNgn,
            maxUsdcAmount: maxAvailable * 0.9,
            reductionNeeded: `${((requiredUsdcAmount - maxAvailable) / requiredUsdcAmount * 100).toFixed(1)}%`
          });
        }
        
        fulfillmentAnalysis.alternativeOptions.push({
          type: 'WAIT_FOR_LIQUIDITY',
          suggestion: 'Wait for liquidity providers to add more funds',
          estimatedWaitTime: '15-60 minutes'
        });
        
        fulfillmentAnalysis.alternativeOptions.push({
          type: 'CONTACT_SUPPORT',
          suggestion: 'Contact support to arrange larger liquidity or split transaction',
          supportEmail: 'support@yourplatform.com'
        });
      }
      
      return fulfillmentAnalysis;
      
    } catch (error) {
      console.error('[LIQUIDITY_SERVICE] Fulfillment check error:', error);
      throw new Error(`Failed to check order fulfillment: ${error.message}`);
    }
  }
  
  /**
   * Get real-time liquidity status
   */
  async getStatus(network = null) {
    try {
      console.log(`[LIQUIDITY_SERVICE] Status check${network ? ` for ${network}` : ''}`);
      
      if (!this.adminToken) {
        throw new Error('Admin API token not configured');
      }
      
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
        timeout: 5000
      });
      
      if (!response.data?.success) {
        throw new Error('Failed to fetch liquidity data');
      }
      
      const data = response.data.data;
      const providers = data.providers || [];
      
      // Calculate max single transaction capacity per network
      let maxBaseTx = 0;
      let maxSolanaTx = 0;
      let baseProviders = 0;
      let solanaProviders = 0;
      let totalBaseLiquidity = 0;
      let totalSolanaLiquidity = 0;
      
      providers.forEach(provider => {
        if (provider.balances.base > 0) {
          maxBaseTx = Math.max(maxBaseTx, provider.balances.base);
          totalBaseLiquidity += provider.balances.base;
          baseProviders++;
        }
        if (provider.balances.solana > 0) {
          maxSolanaTx = Math.max(maxSolanaTx, provider.balances.solana);
          totalSolanaLiquidity += provider.balances.solana;
          solanaProviders++;
        }
      });
      
      return {
        timestamp: new Date().toISOString(),
        model: 'single_provider_per_transaction',
        networks: {
          base: {
            totalLiquidity: totalBaseLiquidity,
            maxSingleTransaction: maxBaseTx,
            providerCount: baseProviders,
            status: maxBaseTx >= 50 ? 'operational' : maxBaseTx >= 10 ? 'limited' : 'critical'
          },
          solana: {
            totalLiquidity: totalSolanaLiquidity,
            maxSingleTransaction: maxSolanaTx,
            providerCount: solanaProviders,
            status: maxSolanaTx >= 50 ? 'operational' : maxSolanaTx >= 10 ? 'limited' : 'critical'
          }
        },
        overall: {
          status: (maxBaseTx >= 10 && maxSolanaTx >= 10) ? 'operational' : 
                  (maxBaseTx >= 5 || maxSolanaTx >= 5) ? 'limited' : 'critical',
          totalProviders: providers.length,
          maxGlobalTransaction: Math.max(maxBaseTx, maxSolanaTx)
        }
      };
      
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
   * Validate service configuration
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.adminApiUrl) {
      issues.push('ADMIN_API_BASE_URL not configured');
    }
    
    if (!this.adminToken) {
      issues.push('ADMIN_API_TOKEN not configured - liquidity checks will be skipped');
    }
    
    try {
      new URL(this.adminApiUrl);
    } catch (error) {
      issues.push('ADMIN_API_BASE_URL is not a valid URL');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      config: {
        adminApiUrl: this.adminApiUrl,
        hasToken: !!this.adminToken,
        bufferPercentage: this.bufferPercentage * 100,
        transactionModel: 'single_provider_only'
      }
    };
  }
}

// Export singleton instance
const liquidityService = new LiquidityService();

module.exports = {
  LiquidityService,
  liquidityService
};
const axios = require('axios');

class TokenValidationService {
  constructor() {
    // Enhanced RPC endpoints with multiple Solana providers
    this.rpcEndpoints = {
      base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      
      // Primary Solana endpoint
      solana: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      
      // Testnet endpoints
      'base-sepolia': process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      'solana-devnet': process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com'
    };

    // Multiple Solana RPC providers for fallback
    this.solanaProviders = {
      mainnet: [
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana',
        'https://solana-api.projectserum.com',
        'https://api.metaplex.solana.com',
        'https://ssc-dao.genesysgo.net',
        'https://rpc.hellomoon.io/84c8cb19-5cc8-4bdf-bb1f-fa87cd4b8c5d',
        'https://mainnet.helius-rpc.com/?api-key=public'
      ],
      devnet: [
        'https://api.devnet.solana.com',
        'https://rpc.ankr.com/solana_devnet',
        'https://devnet.helius-rpc.com/?api-key=public'
      ]
    };

    // Request timeout and retry configuration
    this.requestConfig = {
      timeout: 15000,
      retries: 2,
      retryDelay: 1000,
      solanaTimeout: parseInt(process.env.SOLANA_TIMEOUT) || 8000,
      solanaRetries: parseInt(process.env.SOLANA_RETRY_ATTEMPTS) || 2
    };

    // Known Solana tokens for fallback
    this.knownSolanaTokens = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        verified: true
      },
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        verified: true
      },
      'So11111111111111111111111111111111111111112': {
        name: 'Wrapped SOL',
        symbol: 'WSOL',
        decimals: 9,
        verified: true
      },
      '11111111111111111111111111111111': {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9,
        verified: true
      },
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
        name: 'Marinade staked SOL',
        symbol: 'mSOL',
        decimals: 9,
        verified: true
      },
      'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': {
        name: 'Serum',
        symbol: 'SRM',
        decimals: 6,
        verified: true
      }
    };
  }

  // Validate Ethereum/Base address format
  isValidEthereumAddress(address) {
    if (!address || typeof address !== 'string') return false;
    
    // Check if it starts with 0x and has 42 characters total
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
  }

  // Validate Solana address format
  isValidSolanaAddress(address) {
    if (!address || typeof address !== 'string') return false;
    
    // Solana addresses are base58 encoded and typically 32-44 characters
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaAddressRegex.test(address);
  }

  // Get ERC-20 token information from blockchain with enhanced error handling
  async validateERC20Token(contractAddress, network = 'base') {
    try {
      if (!this.isValidEthereumAddress(contractAddress)) {
        return {
          isValid: false,
          error: 'Invalid Ethereum address format'
        };
      }

      const rpcUrl = this.rpcEndpoints[network];
      if (!rpcUrl) {
        return {
          isValid: false,
          error: 'Unsupported network'
        };
      }

      // Standard ERC-20 function signatures
      const nameSelector = '0x06fdde03';      // name()
      const symbolSelector = '0x95d89b41';    // symbol() 
      const decimalsSelector = '0x313ce567';  // decimals()
      const totalSupplySelector = '0x18160ddd'; // totalSupply()

      // Make RPC calls to get token information with retry logic
      const [nameResult, symbolResult, decimalsResult, totalSupplyResult] = await this.makeParallelEthRpcCalls(
        rpcUrl, 
        [
          { to: contractAddress, data: nameSelector },
          { to: contractAddress, data: symbolSelector },
          { to: contractAddress, data: decimalsSelector },
          { to: contractAddress, data: totalSupplySelector }
        ]
      );

      // Check if all calls returned valid data
      if (!nameResult || !symbolResult || !decimalsResult || !totalSupplyResult) {
        return {
          isValid: false,
          error: 'Contract does not implement ERC-20 interface or is not deployed'
        };
      }

      // Decode the results
      const name = this.decodeString(nameResult);
      const symbol = this.decodeString(symbolResult);
      const decimals = parseInt(decimalsResult, 16);
      const totalSupply = BigInt(totalSupplyResult);

      // Validate that we got reasonable values
      if (!name || !symbol || isNaN(decimals) || decimals < 0 || decimals > 18) {
        return {
          isValid: false,
          error: 'Invalid token metadata - token may not be a standard ERC-20'
        };
      }

      // Additional validation: check if total supply is reasonable
      if (totalSupply < 0n) {
        return {
          isValid: false,
          error: 'Invalid total supply'
        };
      }

      return {
        isValid: true,
        tokenInfo: {
          address: contractAddress.toLowerCase(),
          name: name.trim(),
          symbol: symbol.trim(),
          decimals,
          totalSupply: totalSupply.toString(),
          network,
          type: network === 'base' ? 'base-erc20' : 'erc20',
          standard: 'ERC-20',
          verifiedAt: new Date().toISOString(),
          rpcEndpoint: rpcUrl
        }
      };

    } catch (error) {
      console.error('ERC-20 validation error:', error);
      return {
        isValid: false,
        error: 'Failed to validate token: ' + error.message
      };
    }
  }

  // Enhanced SPL token validation with better error handling and fallbacks
  async validateSPLToken(mintAddress, network = 'solana') {
    try {
      if (!this.isValidSolanaAddress(mintAddress)) {
        return {
          isValid: false,
          error: 'Invalid Solana address format'
        };
      }

      const rpcUrl = this.rpcEndpoints[network];
      if (!rpcUrl) {
        return {
          isValid: false,
          error: 'Unsupported network'
        };
      }

      console.log(`🔍 Validating SPL token: ${mintAddress} on ${network}`);

      // Quick check if it's a known token (for immediate response)
      if (this.knownSolanaTokens[mintAddress]) {
        console.log(`✅ Found in known tokens: ${mintAddress}`);
        const knownToken = this.knownSolanaTokens[mintAddress];
        
        // Still try RPC validation but don't fail if it doesn't work
        try {
          const accountInfo = await Promise.race([
            this.makeSolanaRpcCallWithRetry(rpcUrl, 'getAccountInfo', [
              mintAddress,
              { encoding: 'jsonParsed' }
            ]),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('RPC timeout')), 5000)
            )
          ]);

          if (accountInfo?.value?.data?.parsed?.info) {
            const mintData = accountInfo.value.data.parsed.info;
            return {
              isValid: true,
              tokenInfo: {
                address: mintAddress,
                name: knownToken.name,
                symbol: knownToken.symbol,
                decimals: mintData.decimals || knownToken.decimals,
                supply: mintData.supply || '0',
                mintAuthority: mintData.mintAuthority,
                freezeAuthority: mintData.freezeAuthority,
                isInitialized: mintData.isInitialized,
                network,
                type: mintAddress === '11111111111111111111111111111111' ? 'native' : 'spl-token',
                standard: 'SPL',
                isVerified: knownToken.verified,
                verifiedAt: new Date().toISOString(),
                rpcEndpoint: rpcUrl,
                source: 'RPC + Known Token List'
              }
            };
          }
        } catch (rpcError) {
          console.log(`⚠️  RPC failed but token is known: ${rpcError.message}`);
          
          // For known tokens, try to enrich with API data even if RPC fails
          try {
            const apiInfo = await this.getTokenInfoFromApis(mintAddress);
            if (apiInfo) {
              console.log(`✅ Enhanced known token with API data from ${apiInfo.source}`);
              return {
                isValid: true,
                tokenInfo: {
                  address: mintAddress,
                  name: apiInfo.name || knownToken.name,
                  symbol: apiInfo.symbol || knownToken.symbol,
                  decimals: apiInfo.decimals || knownToken.decimals,
                  supply: 'unknown',
                  network,
                  type: mintAddress === '11111111111111111111111111111111' ? 'native' : 'spl-token',
                  standard: 'SPL',
                  isVerified: knownToken.verified,
                  verifiedAt: new Date().toISOString(),
                  source: `Known Token List + ${apiInfo.source}`,
                  warning: 'RPC unavailable, using known token data enhanced with API info',
                  // Include additional API data
                  priceUsd: apiInfo.priceUsd,
                  marketCap: apiInfo.marketCap,
                  volume24h: apiInfo.volume24h,
                  logoURI: apiInfo.logoURI,
                  metadata: apiInfo
                }
              };
            }
          } catch (apiError) {
            console.log(`⚠️  API enhancement also failed: ${apiError.message}`);
          }
        }

        // Return known token info even if RPC fails
        return {
          isValid: true,
          tokenInfo: {
            address: mintAddress,
            name: knownToken.name,
            symbol: knownToken.symbol,
            decimals: knownToken.decimals,
            supply: 'unknown',
            network,
            type: mintAddress === '11111111111111111111111111111111' ? 'native' : 'spl-token',
            standard: 'SPL',
            isVerified: knownToken.verified,
            verifiedAt: new Date().toISOString(),
            source: 'Known Token List (RPC unavailable)',
            warning: 'Could not verify on-chain, using known token data'
          }
        };
      }

      // For unknown tokens, try RPC validation
      let accountInfo;
      try {
        accountInfo = await this.makeSolanaRpcCallWithRetry(rpcUrl, 'getAccountInfo', [
          mintAddress,
          { encoding: 'jsonParsed' }
        ]);
      } catch (rpcError) {
        console.error(`💥 RPC validation failed for unknown token ${mintAddress}:`, rpcError.message);
        
        // Try comprehensive API fallbacks when all RPC providers fail
        try {
          console.log(`🚨 All Solana RPC providers failed, trying API fallbacks...`);
          const apiTokenInfo = await this.getTokenInfoFromApis(mintAddress);
          
          if (apiTokenInfo) {
            return {
              isValid: true,
              tokenInfo: {
                address: mintAddress,
                name: apiTokenInfo.name,
                symbol: apiTokenInfo.symbol,
                decimals: apiTokenInfo.decimals,
                supply: 'unknown', // Can't get from APIs
                mintAuthority: null, // Can't get from APIs
                freezeAuthority: null, // Can't get from APIs
                isInitialized: true, // Assume true if found in APIs
                network,
                type: 'spl-token',
                standard: 'SPL',
                metadata: apiTokenInfo,
                isVerified: apiTokenInfo.isVerified || true,
                verifiedAt: new Date().toISOString(),
                source: apiTokenInfo.source,
                warning: 'Could not verify on-chain, using external API data',
                // Include additional data from APIs
                priceUsd: apiTokenInfo.priceUsd,
                marketCap: apiTokenInfo.marketCap,
                volume24h: apiTokenInfo.volume24h,
                logoURI: apiTokenInfo.logoURI
              }
            };
          }
        } catch (apiError) {
          console.log('💥 All API fallbacks also failed:', apiError.message);
        }
        
        return {
          isValid: false,
          error: `Unable to validate token: ${rpcError.message}. All RPC providers and API fallbacks failed.`
        };
      }

      if (!accountInfo || !accountInfo.value) {
        return {
          isValid: false,
          error: 'Token mint account not found'
        };
      }

      const accountData = accountInfo.value;
      
      // Check if it's a token mint account
      if (accountData.owner !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        return {
          isValid: false,
          error: 'Address is not a valid SPL token mint'
        };
      }

      // Parse mint data
      const mintData = accountData.data.parsed.info;
      
      // Validate mint data
      if (typeof mintData.decimals !== 'number' || mintData.decimals < 0 || mintData.decimals > 18) {
        return {
          isValid: false,
          error: 'Invalid SPL token decimals'
        };
      }

      // Try to get token metadata with timeout
      let tokenMetadata = null;
      try {
        tokenMetadata = await Promise.race([
          this.getSolanaTokenMetadata(mintAddress),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Metadata timeout')), 3000)
          )
        ]);
      } catch (error) {
        console.log(`⚠️  Could not fetch metadata for ${mintAddress}:`, error.message);
      }

      const supply = mintData.supply || '0';
      const isNativeMint = mintAddress === '11111111111111111111111111111111';

      return {
        isValid: true,
        tokenInfo: {
          address: mintAddress,
          name: tokenMetadata?.name || (isNativeMint ? 'Solana' : 'Unknown Token'),
          symbol: tokenMetadata?.symbol || (isNativeMint ? 'SOL' : 'UNKNOWN'),
          decimals: mintData.decimals,
          supply: supply,
          mintAuthority: mintData.mintAuthority,
          freezeAuthority: mintData.freezeAuthority,
          isInitialized: mintData.isInitialized,
          network,
          type: isNativeMint ? 'native' : 'spl-token',
          standard: 'SPL',
          metadata: tokenMetadata,
          isVerified: !!tokenMetadata,
          verifiedAt: new Date().toISOString(),
          rpcEndpoint: rpcUrl,
          source: 'RPC Validation'
        }
      };

    } catch (error) {
      console.error('💥 SPL token validation error:', error);
      return {
        isValid: false,
        error: `Failed to validate SPL token: ${error.message}`
      };
    }
  }

  // Enhanced metadata fetching with Jupiter API
  async getSolanaTokenMetadata(mintAddress) {
    const sources = [
      {
        name: 'Jupiter',
        url: `https://token.jup.ag/strict/${mintAddress}`,
        timeout: 3000
      },
      {
        name: 'Solana Token List',
        url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json',
        timeout: 3000,
        isTokenList: true
      }
    ];

    for (const source of sources) {
      try {
        console.log(`🔍 Fetching metadata from ${source.name}...`);
        
        const response = await axios.get(source.url, {
          timeout: source.timeout,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TokenValidationService/1.0'
          }
        });

        if (source.isTokenList) {
          // Handle token list format
          const tokens = response.data.tokens || [];
          const foundToken = tokens.find(token => token.address === mintAddress);
          
          if (foundToken) {
            return {
              name: foundToken.name,
              symbol: foundToken.symbol,
              logoURI: foundToken.logoURI,
              source: source.name
            };
          }
        } else {
          // Handle direct API format (Jupiter)
          if (response.data && response.data.name) {
            return {
              name: response.data.name,
              symbol: response.data.symbol,
              logoURI: response.data.logoURI,
              source: source.name
            };
          }
        }
      } catch (error) {
        console.log(`❌ ${source.name} metadata failed:`, error.message);
      }
    }

    return null;
  }

  // Jupiter API fallback for token info
  async getJupiterTokenInfo(mintAddress) {
    try {
      const response = await axios.get(`https://token.jup.ag/strict/${mintAddress}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TokenValidationService/1.0'
        }
      });

      if (response.data) {
        return {
          name: response.data.name || 'Unknown Token',
          symbol: response.data.symbol || 'UNKNOWN',
          decimals: response.data.decimals || 9,
          logoURI: response.data.logoURI,
          isVerified: true, // Jupiter tokens are generally verified
          source: 'Jupiter API'
        };
      }
    } catch (error) {
      console.log('Jupiter API failed:', error.message);
    }
    
    return null;
  }

  // DexScreener API fallback for token info
  async getDexScreenerTokenInfo(mintAddress) {
    try {
      console.log(`🔍 Fetching from DexScreener: ${mintAddress}`);
      
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TokenValidationService/1.0'
        }
      });

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0]; // Get the first pair
        const baseToken = pair.baseToken;
        
        if (baseToken && baseToken.address.toLowerCase() === mintAddress.toLowerCase()) {
          return {
            name: baseToken.name || 'Unknown Token',
            symbol: baseToken.symbol || 'UNKNOWN',
            decimals: parseInt(baseToken.decimals) || 9,
            logoURI: pair.info?.imageUrl,
            priceUsd: pair.priceUsd,
            volume24h: pair.volume?.h24,
            marketCap: pair.marketCap,
            liquidity: pair.liquidity?.usd,
            pairAddress: pair.pairAddress,
            dexId: pair.dexId,
            isVerified: true,
            source: 'DexScreener API'
          };
        }
      }
    } catch (error) {
      console.log('DexScreener API failed:', error.message);
    }
    
    return null;
  }

  // CoinGecko API fallback for token info
  async getCoinGeckoTokenInfo(mintAddress) {
    try {
      console.log(`🔍 Fetching from CoinGecko: ${mintAddress}`);
      
      // First, try to get coin info by contract address
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/solana/contract/${mintAddress}`, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TokenValidationService/1.0'
        }
      });

      if (response.data && response.data.id) {
        const coinData = response.data;
        
        return {
          name: coinData.name || 'Unknown Token',
          symbol: coinData.symbol?.toUpperCase() || 'UNKNOWN',
          decimals: coinData.detail_platforms?.solana?.decimal_place || 9,
          logoURI: coinData.image?.large || coinData.image?.small,
          description: coinData.description?.en,
          marketCapRank: coinData.market_cap_rank,
          currentPrice: coinData.market_data?.current_price?.usd,
          marketCap: coinData.market_data?.market_cap?.usd,
          volume24h: coinData.market_data?.total_volume?.usd,
          priceChange24h: coinData.market_data?.price_change_percentage_24h,
          coingeckoId: coinData.id,
          categories: coinData.categories,
          isVerified: true,
          source: 'CoinGecko API'
        };
      }
    } catch (error) {
      console.log('CoinGecko API failed:', error.message);
    }
    
    return null;
  }

  // Comprehensive fallback API chain for token info
  async getTokenInfoFromApis(mintAddress) {
    console.log(`🔄 Trying API fallbacks for token: ${mintAddress}`);
    
    const apiSources = [
      {
        name: 'Jupiter',
        method: () => this.getJupiterTokenInfo(mintAddress)
      },
      {
        name: 'DexScreener',
        method: () => this.getDexScreenerTokenInfo(mintAddress)
      },
      {
        name: 'CoinGecko',
        method: () => this.getCoinGeckoTokenInfo(mintAddress)
      }
    ];

    for (const source of apiSources) {
      try {
        console.log(`🔍 Trying ${source.name} API...`);
        
        const result = await Promise.race([
          source.method(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${source.name} timeout`)), 10000)
          )
        ]);

        if (result) {
          console.log(`✅ Got token info from ${source.name}: ${result.name} (${result.symbol})`);
          return result;
        } else {
          console.log(`⚠️  ${source.name} returned no data`);
        }
      } catch (error) {
        console.log(`❌ ${source.name} failed: ${error.message}`);
      }
      
      // Small delay between API calls
      await this.delay(500);
    }

    console.log(`💥 All API sources failed for token: ${mintAddress}`);
    return null;
  }

  // Enhanced Solana RPC with multiple provider fallback
  async makeSolanaRpcCallWithRetry(rpcUrl, method, params, retryCount = 0) {
    const network = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet';
    const providers = this.solanaProviders[network];
    let lastError;

    // Try each provider once before retrying
    for (let i = 0; i < providers.length; i++) {
      const endpoint = providers[i];
      
      try {
        console.log(`🔄 Trying Solana RPC [${i + 1}/${providers.length}]: ${endpoint.substring(0, 50)}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestConfig.solanaTimeout);
        
        const response = await axios.post(endpoint, {
          jsonrpc: '2.0',
          id: Date.now() + Math.random(),
          method,
          params
        }, {
          timeout: this.requestConfig.solanaTimeout,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TokenValidationService/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (response.data.error) {
          const errorMsg = response.data.error.message || 'Unknown RPC error';
          console.log(`❌ RPC Error from ${endpoint}: ${errorMsg}`);
          lastError = new Error(`Solana RPC Error: ${errorMsg}`);
          continue;
        }

        console.log(`✅ Solana RPC success with: ${endpoint.substring(0, 50)}...`);
        return response.data.result;

      } catch (error) {
        const errorMsg = error.code === 'ECONNABORTED' ? 'Timeout' : error.message;
        console.log(`❌ Connection failed to ${endpoint}: ${errorMsg}`);
        lastError = error;
        
        // Small delay before trying next provider
        if (i < providers.length - 1) {
          await this.delay(500);
        }
      }
    }

    // If all providers failed and we have retries left
    if (retryCount < this.requestConfig.solanaRetries) {
      console.log(`🔄 All providers failed, retrying (${retryCount + 1}/${this.requestConfig.solanaRetries})`);
      await this.delay(this.requestConfig.retryDelay * (retryCount + 1));
      return this.makeSolanaRpcCallWithRetry(rpcUrl, method, params, retryCount + 1);
    }

    // All attempts failed
    const finalError = lastError?.message || 'All Solana RPC providers failed';
    console.error(`💥 Final Solana RPC failure: ${finalError}`);
    throw new Error(`Solana RPC call failed after trying ${providers.length} providers and ${this.requestConfig.solanaRetries} retries: ${finalError}`);
  }

  // Make parallel Ethereum RPC calls with retry logic
  async makeParallelEthRpcCalls(rpcUrl, callData) {
    const promises = callData.map(data => 
      this.makeEthRpcCallWithRetry(rpcUrl, 'eth_call', [data, 'latest'])
    );
    
    return await Promise.all(promises);
  }

  // Make Ethereum RPC call with retry logic
  async makeEthRpcCallWithRetry(rpcUrl, method, params, retryCount = 0) {
    try {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: Date.now() + Math.random(),
        method,
        params
      }, {
        timeout: this.requestConfig.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      if (retryCount < this.requestConfig.retries) {
        console.log(`Retrying RPC call (${retryCount + 1}/${this.requestConfig.retries}):`, error.message);
        await this.delay(this.requestConfig.retryDelay * (retryCount + 1));
        return this.makeEthRpcCallWithRetry(rpcUrl, method, params, retryCount + 1);
      }
      throw new Error(`RPC call failed after ${this.requestConfig.retries} retries: ${error.message}`);
    }
  }

  // Utility function for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced string decoding for ERC-20 responses
  decodeString(hexString) {
    if (!hexString || hexString === '0x') return '';
    
    try {
      // Remove 0x prefix
      const hex = hexString.slice(2);
      
      // Handle different encoding formats
      if (hex.length === 64) {
        // Fixed-length string (32 bytes)
        let result = '';
        for (let i = 0; i < hex.length; i += 2) {
          const charCode = parseInt(hex.substr(i, 2), 16);
          if (charCode !== 0) {
            result += String.fromCharCode(charCode);
          }
        }
        return result.trim();
      } else if (hex.length >= 128) {
        // Dynamic-length string
        const lengthHex = hex.slice(64, 128);
        const length = parseInt(lengthHex, 16);
        
        if (length > 0 && length <= 100) { // Reasonable string length
          const stringHex = hex.slice(128, 128 + (length * 2));
          let result = '';
          for (let i = 0; i < stringHex.length; i += 2) {
            const charCode = parseInt(stringHex.substr(i, 2), 16);
            if (charCode !== 0) {
              result += String.fromCharCode(charCode);
            }
          }
          return result.trim();
        }
      }
      
      return '';
    } catch (error) {
      console.error('String decoding error:', error);
      return '';
    }
  }

  // Main validation function with enhanced error handling
  async validateTokenAddress(address, network) {
    if (!address || !network) {
      return {
        isValid: false,
        error: 'Address and network are required'
      };
    }

    // Normalize inputs
    const normalizedNetwork = network.toLowerCase().trim();
    const normalizedAddress = address.trim();

    // Determine validation method based on network
    if (normalizedNetwork === 'base' || normalizedNetwork === 'ethereum' || normalizedNetwork === 'base-sepolia') {
      return await this.validateERC20Token(normalizedAddress, normalizedNetwork);
    } else if (normalizedNetwork === 'solana' || normalizedNetwork === 'solana-devnet') {
      return await this.validateSPLToken(normalizedAddress, normalizedNetwork);
    } else {
      return {
        isValid: false,
        error: 'Unsupported network. Supported networks: base, ethereum, solana, base-sepolia, solana-devnet'
      };
    }
  }

  // Enhanced token list checking with updated URLs and multiple sources
  async checkTokenLists(address, network) {
    try {
      const normalizedAddress = address.toLowerCase();
      
      // Updated token list URLs
      const tokenLists = {
        base: [
          'https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/master/optimism.tokenlist.json',
          'https://static.optimism.io/optimism.tokenlist.json'
        ],
        ethereum: [
          'https://tokens.coingecko.com/uniswap/all.json',
          'https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/mainnet.json'
        ],
        solana: [
          'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json',
          'https://token.jup.ag/all' // Jupiter aggregator as fallback
        ]
      };

      const lists = tokenLists[network.toLowerCase()];
      if (!lists) return { isInList: false };

      for (const listUrl of lists) {
        try {
          console.log(`Checking token list: ${listUrl}`);
          const response = await axios.get(listUrl, { 
            timeout: 8000, // Reduced timeout for faster failover
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'TokenValidationService/1.0'
            }
          });
          
          const tokens = response.data.tokens || response.data;
          
          const foundToken = Array.isArray(tokens) ? tokens.find(token => 
            (token.address && token.address.toLowerCase() === normalizedAddress) ||
            (token.mint && token.mint.toLowerCase() === normalizedAddress)
          ) : null;
          
          if (foundToken) {
            console.log(`Token found in list: ${response.data.name || 'Token List'}`);
            return {
              isInList: true,
              listName: response.data.name || 'Token List',
              listUrl: listUrl,
              tokenInfo: foundToken
            };
          }
        } catch (error) {
          console.log(`Failed to check token list ${listUrl}:`, error.message);
          // Continue to next list instead of failing
        }
      }

      return { isInList: false };
    } catch (error) {
      console.error('Token list check error:', error);
      return { isInList: false };
    }
  }

  // Batch validate multiple addresses with improved concurrency control
  async validateMultipleAddresses(addresses, network) {
    const results = [];
    const batchSize = network.toLowerCase().includes('solana') ? 3 : 5; // Smaller batches for Solana
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const batchPromises = batch.map(async (address) => {
        try {
          const result = await this.validateTokenAddress(address, network);
          return {
            address,
            ...result
          };
        } catch (error) {
          return {
            address,
            isValid: false,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Longer delay between batches for Solana to be respectful to RPC endpoints
      if (i + batchSize < addresses.length) {
        const delay = network.toLowerCase().includes('solana') ? 500 : 100;
        await this.delay(delay);
      }
    }
    
    return results;
  }

  // Get network status and health
  async getNetworkHealth(network) {
    try {
      const rpcUrl = this.rpcEndpoints[network];
      if (!rpcUrl) {
        return { healthy: false, error: 'Unsupported network' };
      }

      const startTime = Date.now();
      
      if (network === 'solana' || network === 'solana-devnet') {
        // For Solana, try multiple providers and return the best one
        const networkType = network.includes('devnet') ? 'devnet' : 'mainnet';
        const providers = this.solanaProviders[networkType];
        
        const healthChecks = await Promise.allSettled(
          providers.map(async (provider) => {
            const providerStartTime = Date.now();
            try {
              await axios.post(provider, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getHealth'
              }, { timeout: 5000 });
              
              return {
                provider,
                healthy: true,
                responseTime: Date.now() - providerStartTime
              };
            } catch (error) {
              return {
                provider,
                healthy: false,
                error: error.message,
                responseTime: Date.now() - providerStartTime
              };
            }
          })
        );

        const healthyProviders = healthChecks
          .filter(result => result.status === 'fulfilled' && result.value.healthy)
          .map(result => result.value);

        const totalResponseTime = Date.now() - startTime;

        return {
          healthy: healthyProviders.length > 0,
          responseTime: totalResponseTime,
          rpcEndpoint: rpcUrl,
          providersChecked: providers.length,
          healthyProviders: healthyProviders.length,
          providers: healthChecks.map(result => 
            result.status === 'fulfilled' ? result.value : { healthy: false, error: 'Check failed' }
          )
        };
      } else {
        // For Ethereum/Base networks
        await this.makeEthRpcCallWithRetry(rpcUrl, 'eth_blockNumber', []);
        
        const responseTime = Date.now() - startTime;
        
        return {
          healthy: true,
          responseTime,
          rpcEndpoint: rpcUrl
        };
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        rpcEndpoint: this.rpcEndpoints[network]
      };
    }
  }

  // Enhanced health check for Solana specifically
  async getSolanaHealth(network = 'mainnet') {
    const providers = this.solanaProviders[network];
    const results = [];

    console.log(`🏥 Checking health of ${providers.length} Solana ${network} providers...`);

    for (const provider of providers) {
      const startTime = Date.now();
      try {
        await axios.post(provider, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        }, { timeout: 5000 });

        const responseTime = Date.now() - startTime;
        results.push({
          endpoint: provider,
          healthy: true,
          responseTime
        });
        console.log(`✅ ${provider}: ${responseTime}ms`);
      } catch (error) {
        results.push({
          endpoint: provider,
          healthy: false,
          error: error.message
        });
        console.log(`❌ ${provider}: ${error.message}`);
      }
    }

    const healthyProviders = results.filter(r => r.healthy);
    console.log(`📊 Health check complete: ${healthyProviders.length}/${results.length} providers healthy`);

    return {
      network,
      totalProviders: results.length,
      healthyProviders: healthyProviders.length,
      results,
      recommendedProvider: healthyProviders.length > 0 ? 
        healthyProviders.reduce((fastest, current) => 
          current.responseTime < fastest.responseTime ? current : fastest
        ) : null
    };
  }

  // Test a specific token validation
  async testTokenValidation(address, network) {
    console.log(`🧪 Testing token validation: ${address} on ${network}`);
    
    const startTime = Date.now();
    try {
      const result = await this.validateTokenAddress(address, network);
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        address,
        network,
        duration,
        result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        address,
        network,
        duration,
        error: error.message
      };
    }
  }

  // Get service statistics and health overview
  async getServiceStats() {
    const networks = ['base', 'ethereum', 'solana', 'base-sepolia', 'solana-devnet'];
    const stats = {
      timestamp: new Date().toISOString(),
      networks: {},
      knownTokens: {
        solana: Object.keys(this.knownSolanaTokens).length
      },
      configuration: {
        timeout: this.requestConfig.timeout,
        retries: this.requestConfig.retries,
        solanaTimeout: this.requestConfig.solanaTimeout,
        solanaRetries: this.requestConfig.solanaRetries
      }
    };

    // Check health of each network
    for (const network of networks) {
      try {
        stats.networks[network] = await this.getNetworkHealth(network);
      } catch (error) {
        stats.networks[network] = {
          healthy: false,
          error: error.message
        };
      }
    }

    return stats;
  }

  // Validate multiple tokens with detailed results
  async validateTokensBatch(tokenRequests) {
    const results = [];
    const startTime = Date.now();

    console.log(`🔄 Starting batch validation of ${tokenRequests.length} tokens...`);

    for (const request of tokenRequests) {
      const { address, network } = request;
      const tokenStartTime = Date.now();
      
      try {
        const validation = await this.validateTokenAddress(address, network);
        const tokenDuration = Date.now() - tokenStartTime;
        
        results.push({
          address,
          network,
          duration: tokenDuration,
          ...validation
        });
        
        console.log(`${validation.isValid ? '✅' : '❌'} ${address} (${tokenDuration}ms)`);
      } catch (error) {
        const tokenDuration = Date.now() - tokenStartTime;
        results.push({
          address,
          network,
          duration: tokenDuration,
          isValid: false,
          error: error.message
        });
        
        console.log(`❌ ${address} failed: ${error.message} (${tokenDuration}ms)`);
      }
      
      // Small delay between requests
      await this.delay(100);
    }

    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.isValid).length;
    
    console.log(`🏁 Batch validation complete: ${successful}/${results.length} successful (${totalDuration}ms total)`);

    return {
      totalRequests: tokenRequests.length,
      successful,
      failed: results.length - successful,
      totalDuration,
      averageDuration: Math.round(totalDuration / results.length),
      results
    };
  }

  // Cache management for known tokens
  updateKnownToken(mintAddress, tokenInfo) {
    this.knownSolanaTokens[mintAddress] = {
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      verified: tokenInfo.verified || false,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`📝 Updated known token cache: ${tokenInfo.symbol} (${mintAddress})`);
  }

  // Get cached token info
  getCachedTokenInfo(mintAddress) {
    return this.knownSolanaTokens[mintAddress] || null;
  }

  // Clear cache
  clearKnownTokensCache() {
    const count = Object.keys(this.knownSolanaTokens).length;
    this.knownSolanaTokens = {};
    console.log(`🗑️  Cleared ${count} cached tokens`);
  }

  // Debug method to log current configuration
  logConfiguration() {
    console.log('🔧 TokenValidationService Configuration:');
    console.log('  RPC Endpoints:', this.rpcEndpoints);
    console.log('  Solana Providers:', {
      mainnet: this.solanaProviders.mainnet.length,
      devnet: this.solanaProviders.devnet.length
    });
    console.log('  Request Config:', this.requestConfig);
    console.log('  Known Solana Tokens:', Object.keys(this.knownSolanaTokens).length);
  }

  // Test all Solana providers
  async testAllSolanaProviders(network = 'mainnet') {
    const providers = this.solanaProviders[network];
    const testResults = [];

    console.log(`🧪 Testing all ${providers.length} Solana ${network} providers...`);

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const startTime = Date.now();
      
      try {
        const response = await axios.post(provider, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        }, { 
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'TokenValidationService/1.0'
          }
        });

        const responseTime = Date.now() - startTime;
        const status = response.data.error ? 'error' : 'success';
        
        testResults.push({
          index: i + 1,
          provider,
          status,
          responseTime,
          error: response.data.error?.message || null
        });

        console.log(`${status === 'success' ? '✅' : '⚠️'} [${i + 1}/${providers.length}] ${provider.substring(0, 50)}... (${responseTime}ms)`);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        testResults.push({
          index: i + 1,
          provider,
          status: 'failed',
          responseTime,
          error: error.message
        });

        console.log(`❌ [${i + 1}/${providers.length}] ${provider.substring(0, 50)}... (${error.message})`);
      }

      // Small delay between tests
      await this.delay(200);
    }

    const summary = {
      total: testResults.length,
      successful: testResults.filter(r => r.status === 'success').length,
      errors: testResults.filter(r => r.status === 'error').length,
      failed: testResults.filter(r => r.status === 'failed').length,
      averageResponseTime: Math.round(
        testResults
          .filter(r => r.status === 'success')
          .reduce((acc, r) => acc + r.responseTime, 0) / 
        testResults.filter(r => r.status === 'success').length
      ),
      fastestProvider: testResults
        .filter(r => r.status === 'success')
        .reduce((fastest, current) => 
          current.responseTime < (fastest?.responseTime || Infinity) ? current : fastest, 
          null
        )
    };

    console.log(`\n📊 Test Summary for ${network}:`);
    console.log(`  Total Providers: ${summary.total}`);
    console.log(`  Successful: ${summary.successful}`);
    console.log(`  Errors: ${summary.errors}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Average Response Time: ${summary.averageResponseTime}ms`);
    if (summary.fastestProvider) {
      console.log(`  Fastest Provider: ${summary.fastestProvider.provider.substring(0, 50)}... (${summary.fastestProvider.responseTime}ms)`);
    }

    return {
      network,
      summary,
      details: testResults
    };
  }
}

module.exports = new TokenValidationService();
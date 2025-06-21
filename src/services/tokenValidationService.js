const axios = require('axios');

class TokenValidationService {
  constructor() {
    // RPC endpoints for different networks
    this.rpcEndpoints = {
      base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      solana: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      // Testnet endpoints
      'base-sepolia': 'https://sepolia.base.org',
      'solana-devnet': 'https://api.devnet.solana.com'
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

  // Get ERC-20 token information from blockchain
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

      // Make RPC calls to get token information
      const [nameResult, symbolResult, decimalsResult, totalSupplyResult] = await Promise.all([
        this.makeEthRpcCall(rpcUrl, 'eth_call', [{ to: contractAddress, data: nameSelector }, 'latest']),
        this.makeEthRpcCall(rpcUrl, 'eth_call', [{ to: contractAddress, data: symbolSelector }, 'latest']),
        this.makeEthRpcCall(rpcUrl, 'eth_call', [{ to: contractAddress, data: decimalsSelector }, 'latest']),
        this.makeEthRpcCall(rpcUrl, 'eth_call', [{ to: contractAddress, data: totalSupplySelector }, 'latest'])
      ]);

      // Check if all calls returned valid data
      if (!nameResult || !symbolResult || !decimalsResult || !totalSupplyResult) {
        return {
          isValid: false,
          error: 'Contract does not implement ERC-20 interface'
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
          error: 'Invalid token metadata'
        };
      }

      return {
        isValid: true,
        tokenInfo: {
          address: contractAddress,
          name,
          symbol,
          decimals,
          totalSupply: totalSupply.toString(),
          network,
          type: network === 'base' ? 'base-erc20' : 'erc20',
          verifiedAt: new Date().toISOString()
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

  // Get SPL token information from Solana
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

      // Get account info to verify it's a valid mint
      const accountInfo = await this.makeSolanaRpcCall(rpcUrl, 'getAccountInfo', [
        mintAddress,
        { encoding: 'jsonParsed' }
      ]);

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
      
      // Try to get token metadata (if available)
      let tokenMetadata = null;
      try {
        tokenMetadata = await this.getSolanaTokenMetadata(mintAddress, rpcUrl);
      } catch (error) {
        console.log('Could not fetch metadata:', error.message);
      }

      return {
        isValid: true,
        tokenInfo: {
          address: mintAddress,
          name: tokenMetadata?.name || 'Unknown Token',
          symbol: tokenMetadata?.symbol || 'UNKNOWN',
          decimals: mintData.decimals,
          supply: mintData.supply,
          mintAuthority: mintData.mintAuthority,
          freezeAuthority: mintData.freezeAuthority,
          network,
          type: 'spl-token',
          metadata: tokenMetadata,
          verifiedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('SPL token validation error:', error);
      return {
        isValid: false,
        error: 'Failed to validate SPL token: ' + error.message
      };
    }
  }

  // Get Solana token metadata
  async getSolanaTokenMetadata(mintAddress, rpcUrl) {
    try {
      // Try to get metadata account
      const metadataProgram = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
      
      // This is a simplified approach - in production you'd use @metaplex-foundation/js
      // For now, we'll use a token list API or return basic info
      
      // You could also integrate with Jupiter API or other token registries:
      // const jupiterResponse = await axios.get(`https://token.jup.ag/strict/${mintAddress}`);
      
      return null; // Return null if no metadata found
    } catch (error) {
      return null;
    }
  }

  // Make Ethereum RPC call
  async makeEthRpcCall(rpcUrl, method, params) {
    try {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.result;
    } catch (error) {
      throw new Error(`RPC call failed: ${error.message}`);
    }
  }

  // Make Solana RPC call
  async makeSolanaRpcCall(rpcUrl, method, params) {
    try {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data.result;
    } catch (error) {
      throw new Error(`Solana RPC call failed: ${error.message}`);
    }
  }

  // Decode hex string to UTF-8 (for ERC-20 name/symbol)
  decodeString(hexString) {
    if (!hexString || hexString === '0x') return '';
    
    try {
      // Remove 0x prefix
      const hex = hexString.slice(2);
      
      // First 64 characters (32 bytes) is the offset, next 64 is the length
      const lengthHex = hex.slice(64, 128);
      const length = parseInt(lengthHex, 16);
      
      // Get the actual string data
      const stringHex = hex.slice(128, 128 + (length * 2));
      
      // Convert to string
      let result = '';
      for (let i = 0; i < stringHex.length; i += 2) {
        const charCode = parseInt(stringHex.substr(i, 2), 16);
        if (charCode !== 0) {
          result += String.fromCharCode(charCode);
        }
      }
      
      return result;
    } catch (error) {
      return '';
    }
  }

  // Main validation function
  async validateTokenAddress(address, network) {
    if (!address || !network) {
      return {
        isValid: false,
        error: 'Address and network are required'
      };
    }

    // Normalize network name
    const normalizedNetwork = network.toLowerCase();

    // Determine validation method based on network
    if (normalizedNetwork === 'base' || normalizedNetwork === 'ethereum' || normalizedNetwork === 'base-sepolia') {
      return await this.validateERC20Token(address, normalizedNetwork);
    } else if (normalizedNetwork === 'solana' || normalizedNetwork === 'solana-devnet') {
      return await this.validateSPLToken(address, normalizedNetwork);
    } else {
      return {
        isValid: false,
        error: 'Unsupported network. Supported networks: base, ethereum, solana'
      };
    }
  }

  // Check if token is in known token lists
  async checkTokenLists(address, network) {
    try {
      const tokenLists = {
        base: [
          'https://raw.githubusercontent.com/base-org/token-list/main/base.tokenlist.json'
        ],
        ethereum: [
          'https://tokens.coingecko.com/uniswap/all.json'
        ],
        solana: [
          'https://token.jup.ag/strict' // Jupiter token list
        ]
      };

      const lists = tokenLists[network.toLowerCase()];
      if (!lists) return null;

      for (const listUrl of lists) {
        try {
          const response = await axios.get(listUrl, { timeout: 5000 });
          const tokens = response.data.tokens || response.data;
          
          const foundToken = tokens.find(token => 
            token.address?.toLowerCase() === address.toLowerCase() ||
            token.mint?.toLowerCase() === address.toLowerCase()
          );
          
          if (foundToken) {
            return {
              isInList: true,
              listName: response.data.name || 'Token List',
              tokenInfo: foundToken
            };
          }
        } catch (error) {
          console.log(`Failed to check token list ${listUrl}:`, error.message);
        }
      }

      return { isInList: false };
    } catch (error) {
      console.error('Token list check error:', error);
      return null;
    }
  }

  // Batch validate multiple addresses
  async validateMultipleAddresses(addresses, network) {
    const results = [];
    
    for (const address of addresses) {
      try {
        const result = await this.validateTokenAddress(address, network);
        results.push({
          address,
          ...result
        });
      } catch (error) {
        results.push({
          address,
          isValid: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new TokenValidationService();
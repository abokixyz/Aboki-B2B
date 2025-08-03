/**
 * FIXED Wallet Generator Service for Off-ramp Orders
 * Generates secure wallets for customers to deposit tokens
 * Supports Base (EVM) and Solana networks with encryption
 * 
 * FIXES:
 * - Fixed encryption key generation
 * - Improved error handling
 * - Better validation
 * - More robust fallbacks
 */

const { ethers } = require('ethers');
const { Keypair } = require('@solana/web3.js');
const crypto = require('crypto');

class WalletGeneratorService {
  constructor() {
    this.encryptionKey = this.initializeEncryptionKey();
    console.log('🔑 Wallet Generator Service initialized with encryption');
  }

  /**
   * FIXED: Initialize encryption key with proper validation
   */
  initializeEncryptionKey() {
    try {
      // Try to use environment variable first
      if (process.env.WALLET_ENCRYPTION_KEY) {
        const envKey = process.env.WALLET_ENCRYPTION_KEY;
        
        // If it's a hex string, convert it to buffer
        if (envKey.match(/^[0-9a-fA-F]{64}$/)) {
          return Buffer.from(envKey, 'hex');
        }
        
        // If it's a regular string, hash it to get 32 bytes
        return crypto.createHash('sha256').update(envKey).digest();
      }
      
      // Generate a secure random key if no environment variable
      console.warn('⚠️ No WALLET_ENCRYPTION_KEY found, generating secure random key');
      console.warn('⚠️ For production, set WALLET_ENCRYPTION_KEY environment variable');
      
      return crypto.randomBytes(32); // 256 bits for AES-256
      
    } catch (error) {
      console.error('❌ Failed to initialize encryption key:', error);
      // Emergency fallback - use a deterministic key based on system info
      const fallbackSeed = `wallet-encryption-${process.pid}-${Date.now()}`;
      return crypto.createHash('sha256').update(fallbackSeed).digest();
    }
  }

  /**
   * FIXED: Encrypt private key with modern Node.js crypto methods
   */
  encryptPrivateKey(privateKey) {
    try {
      if (!privateKey) {
        throw new Error('Private key is required for encryption');
      }

      if (!this.encryptionKey || this.encryptionKey.length !== 32) {
        throw new Error('Invalid encryption key - must be 32 bytes');
      }

      // Use AES-256-CBC with explicit IV (modern approach)
      return this.encryptWithModernCBC(privateKey);
      
    } catch (error) {
      console.error('❌ Failed to encrypt private key:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Modern CBC encryption using createCipheriv (works on all Node.js versions)
   */
  encryptWithModernCBC(privateKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Create HMAC for authentication
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(iv.toString('hex') + ':' + encrypted);
    const authTag = hmac.digest('hex');
    
    // Format: modern:iv:authTag:encrypted
    const combined = 'modern:' + iv.toString('hex') + ':' + authTag + ':' + encrypted;
    
    console.log('🔐 Private key encrypted successfully (Modern CBC+HMAC)');
    return combined;
  }

  /**
   * FIXED: Decrypt private key with modern methods
   */
  decryptPrivateKey(encryptedData) {
    try {
      if (!encryptedData) {
        throw new Error('Encrypted data is required for decryption');
      }

      const parts = encryptedData.split(':');
      if (parts.length < 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      if (!this.encryptionKey || this.encryptionKey.length !== 32) {
        throw new Error('Invalid encryption key for decryption');
      }
      
      // Detect encryption format
      if (parts[0] === 'modern' && parts.length === 4) {
        return this.decryptModernCBC(parts);
      } else if (parts[0] === 'gcm' && parts.length === 4) {
        return this.decryptGCM(parts);
      } else if (parts[0] === 'cbc' && parts.length === 4) {
        return this.decryptLegacyCBC(parts);
      } else if (parts.length === 3) {
        // Legacy format (assume GCM)
        return this.decryptLegacyGCM(parts);
      } else {
        throw new Error('Unknown encryption format');
      }
      
    } catch (error) {
      console.error('❌ Failed to decrypt private key:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt modern CBC format
   */
  decryptModernCBC(parts) {
    const [format, ivHex, authTagHex, encrypted] = parts;
    
    // Verify HMAC
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(ivHex + ':' + encrypted);
    const expectedAuthTag = hmac.digest('hex');
    
    if (expectedAuthTag !== authTagHex) {
      throw new Error('Authentication failed - data may be corrupted');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log('🔓 Private key decrypted successfully (Modern CBC+HMAC)');
    return decrypted;
  }

  /**
   * Check if GCM mode is supported
   */
  checkGCMSupport() {
    try {
      // Test if createCipherGCM exists and works
      const testIv = crypto.randomBytes(16);
      const testCipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey);
      return !!testCipher;
    } catch (error) {
      console.log('GCM not supported:', error.message);
      return false;
    }
  }

  /**
   * Encrypt using GCM mode (preferred) - if available
   */
  encryptWithGCM(privateKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: gcm:iv:authTag:encrypted
    const combined = 'gcm:' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    
    console.log('🔐 Private key encrypted successfully (GCM)');
    return combined;
  }

  /**
   * Encrypt using legacy CBC mode (deprecated)
   */
  encryptWithCBC(privateKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey.toString('hex'));
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Create HMAC for authentication
    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(iv.toString('hex') + ':' + encrypted);
    const authTag = hmac.digest('hex');
    
    // Format: cbc:iv:authTag:encrypted
    const combined = 'cbc:' + iv.toString('hex') + ':' + authTag + ':' + encrypted;
    
    console.log('🔐 Private key encrypted successfully (CBC+HMAC)');
    return combined;
  }

  /**
   * Decrypt GCM format (if available)
   */
  decryptGCM(parts) {
    try {
      const [format, ivHex, authTagHex, encrypted] = parts;
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipherGCM('aes-256-gcm', this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('🔓 Private key decrypted successfully (GCM)');
      return decrypted;
    } catch (error) {
      throw new Error(`GCM decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt legacy CBC format
   */
  decryptLegacyCBC(parts) {
    try {
      const [format, ivHex, authTagHex, encrypted] = parts;
      
      // Verify HMAC
      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(ivHex + ':' + encrypted);
      const expectedAuthTag = hmac.digest('hex');
      
      if (expectedAuthTag !== authTagHex) {
        throw new Error('Authentication failed - data may be corrupted');
      }
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey.toString('hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('🔓 Private key decrypted successfully (Legacy CBC+HMAC)');
      return decrypted;
    } catch (error) {
      throw new Error(`Legacy CBC decryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt legacy GCM format (backward compatibility)
   */
  decryptLegacyGCM(parts) {
    try {
      const [ivHex, authTagHex, encrypted] = parts;
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipherGCM('aes-256-gcm', this.encryptionKey);
      decipher.setAAD(Buffer.from('wallet-private-key', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('🔓 Private key decrypted successfully (Legacy GCM)');
      return decrypted;
    } catch (error) {
      throw new Error(`Legacy GCM decryption failed: ${error.message}`);
    }
  }

  /**
   * FIXED: Generate EVM wallet with better validation
   */
  generateEVMWallet() {
    try {
      console.log('🔑 Generating new EVM wallet...');
      
      // Validate ethers is available
      if (!ethers || !ethers.Wallet) {
        throw new Error('Ethers.js library not properly loaded');
      }
      
      // Generate random wallet
      const wallet = ethers.Wallet.createRandom();
      
      // Validate wallet was created
      if (!wallet.address || !wallet.privateKey) {
        throw new Error('Failed to generate valid EVM wallet');
      }
      
      // Validate address format
      if (!wallet.address.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Generated invalid EVM address format');
      }
      
      const walletData = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey || wallet.address, // Fallback to address if no public key
        network: 'evm',
        walletType: 'evm'
      };
      
      console.log(`✅ EVM wallet generated: ${wallet.address}`);
      
      return walletData;
      
    } catch (error) {
      console.error('❌ Failed to generate EVM wallet:', error);
      
      // Enhanced error reporting
      if (error.message.includes('ethers')) {
        throw new Error('EVM wallet generation failed: Ethers.js library error. Check installation.');
      } else {
        throw new Error(`EVM wallet generation failed: ${error.message}`);
      }
    }
  }

  /**
   * FIXED: Generate Solana wallet with better validation
   */
  generateSolanaWallet() {
    try {
      console.log('🔑 Generating new Solana wallet...');
      
      // Validate Solana web3 is available
      if (!Keypair) {
        throw new Error('Solana web3.js library not properly loaded');
      }
      
      // Generate random keypair
      const keypair = Keypair.generate();
      
      // Validate keypair was created
      if (!keypair.publicKey || !keypair.secretKey) {
        throw new Error('Failed to generate valid Solana keypair');
      }
      
      const publicKeyString = keypair.publicKey.toString();
      const secretKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
      
      // Validate public key format (Solana addresses are base58)
      if (!publicKeyString.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        throw new Error('Generated invalid Solana address format');
      }
      
      const walletData = {
        address: publicKeyString,
        privateKey: secretKeyBase64,
        publicKey: publicKeyString,
        network: 'solana',
        walletType: 'solana'
      };
      
      console.log(`✅ Solana wallet generated: ${publicKeyString}`);
      
      return walletData;
      
    } catch (error) {
      console.error('❌ Failed to generate Solana wallet:', error);
      
      // Enhanced error reporting
      if (error.message.includes('Solana') || error.message.includes('Keypair')) {
        throw new Error('Solana wallet generation failed: Solana web3.js library error. Check installation.');
      } else {
        throw new Error(`Solana wallet generation failed: ${error.message}`);
      }
    }
  }

  /**
   * FIXED: Main function with comprehensive error handling
   */
  async generateOfframpWallet(network, tokenSymbol) {
    try {
      console.log(`🏗️ Generating off-ramp wallet for ${tokenSymbol} on ${network}...`);
      
      // Input validation
      if (!network || !tokenSymbol) {
        throw new Error('Network and token symbol are required');
      }
      
      // Validate network
      const supportedNetworks = ['base', 'solana', 'ethereum'];
      const normalizedNetwork = network.toLowerCase().trim();
      
      if (!supportedNetworks.includes(normalizedNetwork)) {
        throw new Error(`Unsupported network: ${network}. Supported: ${supportedNetworks.join(', ')}`);
      }
      
      // FIXED: Improved token symbol validation to support special characters like $
      const normalizedTokenSymbol = tokenSymbol.trim();
      
      // More flexible token symbol validation
      if (!normalizedTokenSymbol) {
        throw new Error('Token symbol cannot be empty');
      }
      
      if (normalizedTokenSymbol.length > 20) {
        throw new Error('Token symbol too long (maximum 20 characters)');
      }
      
      // Allow alphanumeric characters, $, and common token symbols
      if (!normalizedTokenSymbol.match(/^[\$A-Za-z0-9_-]{1,20}$/)) {
        throw new Error(`Invalid token symbol format: ${tokenSymbol}. Allowed characters: letters, numbers, $, _, -`);
      }
      
      console.log(`✅ Token symbol validation passed: ${normalizedTokenSymbol}`);
      
      let walletData;
      
      // Generate appropriate wallet based on network
      if (normalizedNetwork === 'solana') {
        walletData = this.generateSolanaWallet();
      } else {
        // Base and Ethereum use EVM wallets
        walletData = this.generateEVMWallet();
        walletData.network = normalizedNetwork;
      }
      
      // Validate wallet was generated
      if (!walletData || !walletData.address || !walletData.privateKey) {
        throw new Error('Wallet generation returned invalid data');
      }
      
      // Encrypt the private key before returning
      console.log(`🔐 Encrypting private key for secure storage...`);
      const encryptedPrivateKey = this.encryptPrivateKey(walletData.privateKey);
      
      if (!encryptedPrivateKey) {
        throw new Error('Failed to encrypt private key');
      }
      
      console.log(`🔐 Private key encrypted successfully`);
      
      const result = {
        success: true,
        address: walletData.address,
        publicKey: walletData.publicKey,
        encryptedPrivateKey: encryptedPrivateKey,
        network: walletData.network,
        walletType: walletData.walletType,
        tokenSymbol: normalizedTokenSymbol, // Keep original format including $
        generatedAt: new Date().toISOString(),
        expirationNote: 'Wallet expires in 24 hours if not used',
        validation: {
          addressValid: this.validateWalletAddress(walletData.address, walletData.network),
          encryptionValid: true,
          networkSupported: true,
          tokenSymbolValid: true,
          tokenSymbolFormat: normalizedTokenSymbol
        }
      };
      
      console.log(`✅ Off-ramp wallet generation completed for ${normalizedTokenSymbol} on ${walletData.network}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to generate off-ramp wallet for ${tokenSymbol} on ${network}:`, error);
      
      return {
        success: false,
        error: error.message,
        network: network?.toLowerCase(),
        tokenSymbol: tokenSymbol,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          tokenSymbolFormat: 'Token symbols can contain letters, numbers, $, _, and - (max 20 chars)',
          supportedNetworks: 'base, solana, ethereum',
          checkEncryptionKey: 'Ensure WALLET_ENCRYPTION_KEY is set or allow random generation',
          checkDependencies: 'Verify ethers and @solana/web3.js are installed',
          checkPermissions: 'Verify crypto module permissions'
        }
      };
    }
  }

  /**
   * FIXED: Get wallet private key with validation
   */
  async getWalletPrivateKey(encryptedPrivateKey) {
    try {
      if (!encryptedPrivateKey) {
        throw new Error('Encrypted private key is required');
      }
      
      console.log('🔓 Decrypting wallet private key for processing...');
      
      const privateKey = this.decryptPrivateKey(encryptedPrivateKey);
      
      if (!privateKey) {
        throw new Error('Decryption returned empty private key');
      }
      
      console.log('✅ Private key decrypted successfully');
      
      return {
        success: true,
        privateKey,
        decryptedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to decrypt wallet private key:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * FIXED: Generate token-specific wallet with comprehensive metadata
   */
  async generateTokenSpecificWallet(network, tokenSymbol, tokenAddress) {
    try {
      console.log(`🎯 Generating ${tokenSymbol}-specific wallet on ${network}...`);
      
      // Input validation - more flexible for token symbols
      if (!tokenAddress && !this.isNativeToken(tokenSymbol, network)) {
        console.warn('⚠️ No token address provided for non-native token, proceeding anyway...');
      }
      
      // Generate base wallet
      const walletResult = await this.generateOfframpWallet(network, tokenSymbol);
      
      if (!walletResult.success) {
        return walletResult;
      }
      
      // Add token-specific metadata
      walletResult.tokenMetadata = {
        tokenSymbol: tokenSymbol, // Keep original format (e.g., $WIF)
        tokenAddress: tokenAddress || 'native',
        network: network.toLowerCase(),
        isNativeToken: this.isNativeToken(tokenSymbol, network),
        requiresTokenAccount: network.toLowerCase() === 'solana' && !this.isNativeToken(tokenSymbol, network),
        hasSpecialCharacters: /[\$_-]/.test(tokenSymbol)
      };
      
      // Add specific instructions based on token type
      if (network.toLowerCase() === 'solana') {
        if (tokenSymbol.toUpperCase() === 'SOL') {
          walletResult.instructions = [
            `Send SOL directly to: ${walletResult.address}`,
            'This is a native SOL transfer',
            'Transaction will be automatically detected',
            'Minimum amount: 0.001 SOL'
          ];
        } else {
          walletResult.instructions = [
            `Send ${tokenSymbol} SPL tokens to: ${walletResult.address}`,
            tokenAddress ? `Token contract: ${tokenAddress}` : 'Token contract: To be determined',
            'Associated token account will be created automatically if needed',
            `Ensure you are sending the correct ${tokenSymbol} SPL token`,
            'Minimum amount: Check with your business settings',
            tokenSymbol.includes('$') ? '⚠️ Note: This token uses special characters in its symbol' : ''
          ].filter(Boolean);
        }
      } else {
        // EVM networks (Base, Ethereum)
        if (this.isNativeToken(tokenSymbol, network)) {
          walletResult.instructions = [
            `Send ${tokenSymbol} directly to: ${walletResult.address}`,
            `Network: ${network.charAt(0).toUpperCase() + network.slice(1)}`,
            'This is a native token transfer',
            'Minimum amount: 0.001 ETH'
          ];
        } else {
          walletResult.instructions = [
            `Send ${tokenSymbol} tokens to: ${walletResult.address}`,
            tokenAddress ? `Token contract: ${tokenAddress}` : 'Token contract: To be determined',
            `Network: ${network.charAt(0).toUpperCase() + network.slice(1)}`,
            'Ensure you are using the correct network and token contract',
            'Minimum amount: Check with your business settings',
            tokenSymbol.includes('$') ? '⚠️ Note: This token uses special characters in its symbol' : ''
          ].filter(Boolean);
        }
      }
      
      console.log(`✅ ${tokenSymbol}-specific wallet generated with instructions`);
      
      return walletResult;
      
    } catch (error) {
      console.error(`❌ Failed to generate ${tokenSymbol}-specific wallet:`, error);
      return {
        success: false,
        error: error.message,
        network,
        tokenSymbol,
        tokenAddress,
        timestamp: new Date().toISOString()
      };
    }
  }  

  /**
   * Check if token is native to the network
   */
  isNativeToken(tokenSymbol, network) {
    const nativeTokens = {
      'base': ['ETH'],
      'ethereum': ['ETH'],
      'solana': ['SOL']
    };
    
    // Normalize token symbol for comparison (remove special characters for native token check)
    const normalizedTokenSymbol = tokenSymbol.replace(/[\$_-]/g, '').toUpperCase();
    
    return nativeTokens[network.toLowerCase()]?.includes(normalizedTokenSymbol) || false;
  }

  /**
   * FIXED: Validate wallet address format with better patterns
   */
  validateWalletAddress(address, network) {
    try {
      if (!address || !network) {
        return false;
      }
      
      if (network.toLowerCase() === 'solana') {
        // Solana addresses are base58 encoded, typically 32-44 characters
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } else {
        // EVM addresses are 40 hex characters with 0x prefix
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      }
    } catch (error) {
      console.error('Error validating wallet address:', error);
      return false;
    }
  }

  /**
   * Generate multiple wallets for batch processing
   */
  async generateBatchWallets(requests) {
    try {
      console.log(`🔄 Generating ${requests.length} wallets in batch...`);
      
      if (!Array.isArray(requests) || requests.length === 0) {
        throw new Error('Requests must be a non-empty array');
      }
      
      if (requests.length > 50) {
        throw new Error('Batch size too large. Maximum 50 wallets per batch.');
      }
      
      const results = [];
      
      for (const request of requests) {
        const { network, tokenSymbol, tokenAddress } = request;
        
        try {
          const walletResult = await this.generateTokenSpecificWallet(network, tokenSymbol, tokenAddress);
          results.push({
            ...request,
            ...walletResult
          });
        } catch (error) {
          results.push({
            ...request,
            success: false,
            error: error.message
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      console.log(`✅ Batch wallet generation completed: ${successful}/${requests.length} successful`);
      
      return {
        success: successful > 0,
        results,
        summary: {
          total: requests.length,
          successful,
          failed: requests.length - successful,
          successRate: (successful / requests.length) * 100
        }
      };
      
    } catch (error) {
      console.error('❌ Batch wallet generation failed:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * FIXED: Get service status with modern crypto validation
   */
  getServiceStatus() {
    try {
      const encryptionKeyValid = this.encryptionKey && this.encryptionKey.length === 32;
      
      // Test modern crypto methods
      const modernCryptoSupport = this.testModernCryptoSupport();
      
      return {
        configured: true,
        encryptionEnabled: !!this.encryptionKey,
        encryptionKeyValid: encryptionKeyValid,
        encryptionKeySource: process.env.WALLET_ENCRYPTION_KEY ? 'environment' : 'generated',
        encryptionMethod: modernCryptoSupport.primary,
        supportedNetworks: ['base', 'solana', 'ethereum'],
        capabilities: {
          evmWallets: true,
          solanaWallets: true,
          privateKeyEncryption: encryptionKeyValid,
          batchGeneration: true,
          tokenSpecificWallets: true,
          addressValidation: true,
          modernCrypto: modernCryptoSupport.modern,
          legacyCompatibility: true
        },
        security: {
          primaryEncryption: modernCryptoSupport.primary,
          fallbackMethods: modernCryptoSupport.available,
          keyLength: this.encryptionKey ? this.encryptionKey.length : 0,
          keyValid: encryptionKeyValid,
          authenticationMethod: 'HMAC-SHA256'
        },
        dependencies: {
          ethers: !!ethers,
          solanaWeb3: !!Keypair,
          crypto: !!crypto,
          modernCryptoSupport: modernCryptoSupport.modern
        },
        health: encryptionKeyValid && !!ethers && !!Keypair && modernCryptoSupport.modern ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        configured: false,
        error: error.message,
        health: 'unhealthy'
      };
    }
  }

  /**
   * Test modern crypto support
   */
  testModernCryptoSupport() {
    const support = {
      modern: false,
      gcm: false,
      cbc: false,
      available: [],
      primary: 'none'
    };

    // Test modern CBC (createCipheriv)
    try {
      const testIv = crypto.randomBytes(16);
      const testCipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, testIv);
      if (testCipher) {
        support.cbc = true;
        support.modern = true;
        support.available.push('AES-256-CBC');
        support.primary = 'AES-256-CBC+HMAC';
      }
    } catch (error) {
      console.warn('Modern CBC not supported:', error.message);
    }

    // Test GCM if available
    try {
      const testCipher = crypto.createCipherGCM('aes-256-gcm', this.encryptionKey);
      if (testCipher) {
        support.gcm = true;
        support.available.push('AES-256-GCM');
        if (!support.primary || support.primary === 'none') {
          support.primary = 'AES-256-GCM';
        }
      }
    } catch (error) {
      // GCM not supported, which is fine
    }

    return support;
  }

  /**
   * FIXED: Test wallet generation with comprehensive validation
   */
  async testWalletGeneration() {
    try {
      console.log('🧪 Testing wallet generation for all networks...');
      
      const tests = [
        { network: 'base', tokenSymbol: 'ETH', description: 'Base native ETH' },
        { network: 'base', tokenSymbol: 'USDC', description: 'Base USDC token' },
        { network: 'solana', tokenSymbol: 'SOL', description: 'Solana native SOL' },
        { network: 'solana', tokenSymbol: 'USDC', description: 'Solana USDC token' },
        { network: 'ethereum', tokenSymbol: 'ETH', description: 'Ethereum native ETH' }
      ];
      
      const results = [];
      
      for (const test of tests) {
        try {
          console.log(`🧪 Testing: ${test.description}`);
          
          const result = await this.generateOfframpWallet(test.network, test.tokenSymbol);
          
          // Additional validation
          const extraValidation = {
            addressFormatValid: result.success ? this.validateWalletAddress(result.address, result.network) : false,
            hasEncryptedKey: result.success ? !!result.encryptedPrivateKey : false,
            canDecrypt: false
          };
          
          // Test decryption if wallet was generated successfully
          if (result.success && result.encryptedPrivateKey) {
            try {
              const decryptResult = await this.getWalletPrivateKey(result.encryptedPrivateKey);
              extraValidation.canDecrypt = decryptResult.success;
            } catch (decryptError) {
              console.warn(`Decryption test failed for ${test.description}:`, decryptError.message);
            }
          }
          
          results.push({
            ...test,
            success: result.success,
            address: result.success ? result.address : null,
            error: result.success ? null : result.error,
            validation: extraValidation
          });
          
          if (result.success) {
            console.log(`✅ ${test.description}: ${result.address}`);
          } else {
            console.log(`❌ ${test.description}: ${result.error}`);
          }
          
        } catch (error) {
          results.push({
            ...test,
            success: false,
            error: error.message,
            validation: {
              addressFormatValid: false,
              hasEncryptedKey: false,
              canDecrypt: false
            }
          });
          console.log(`❌ ${test.description}: ${error.message}`);
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const fullyValidated = results.filter(r => r.success && r.validation.addressFormatValid && r.validation.canDecrypt).length;
      
      console.log(`🧪 Wallet generation test completed: ${successful}/${tests.length} successful, ${fullyValidated} fully validated`);
      
      return {
        success: successful === tests.length,
        results,
        summary: {
          total: tests.length,
          successful,
          failed: tests.length - successful,
          fullyValidated,
          successRate: (successful / tests.length) * 100,
          validationRate: (fullyValidated / tests.length) * 100
        },
        serviceStatus: this.getServiceStatus()
      };
      
    } catch (error) {
      console.error('❌ Wallet generation test failed:', error);
      return {
        success: false,
        error: error.message,
        serviceStatus: this.getServiceStatus()
      };
    }
  }
}

module.exports = new WalletGeneratorService();
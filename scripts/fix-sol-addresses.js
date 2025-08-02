// scripts/fix-sol-addresses.js
// Run this script to fix existing SOL tokens in your database

const mongoose = require('mongoose');
const { Business } = require('../src/models'); // Adjust path to your models

async function migrateSolAddresses() {
    try {
        console.log('🔧 Starting SOL address migration...');
        
        // Connect to MongoDB (adjust connection string as needed)
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db');
            console.log('📦 Connected to MongoDB');
        }
        
        // Find businesses with incorrect SOL address
        const businesses = await Business.find({
            $or: [
                { 'supportedTokens.solana.contractAddress': '11111111111111111111111111111112' },
                { 'feeConfiguration.solana.contractAddress': '11111111111111111111111111111112' }
            ]
        });
        
        console.log(`📊 Found ${businesses.length} businesses with incorrect SOL addresses`);
        
        let totalFixed = 0;
        
        for (const business of businesses) {
            let updated = false;
            
            console.log(`\n🏢 Processing business: ${business.businessId || business._id}`);
            
            // Fix supported tokens
            if (business.supportedTokens?.solana) {
                for (const token of business.supportedTokens.solana) {
                    if (token.symbol?.toUpperCase() === 'SOL' && 
                        token.contractAddress === '11111111111111111111111111111112') {
                        
                        console.log(`  ✏️  Fixing SOL token address...`);
                        console.log(`     Old: ${token.contractAddress}`);
                        
                        token.contractAddress = 'So11111111111111111111111111111111111111112';
                        token.metadata = {
                            ...token.metadata,
                            addressCorrected: true,
                            correctionDate: new Date(),
                            originalAddress: '11111111111111111111111111111112',
                            reason: 'Jupiter DEX compatibility fix - native SOL not tradable'
                        };
                        
                        console.log(`     New: ${token.contractAddress}`);
                        updated = true;
                    }
                }
            }
            
            // Fix fee configuration
            if (business.feeConfiguration?.solana) {
                for (const fee of business.feeConfiguration.solana) {
                    if (fee.symbol?.toUpperCase() === 'SOL' && 
                        fee.contractAddress === '11111111111111111111111111111112') {
                        
                        console.log(`  ✏️  Fixing SOL fee configuration...`);
                        fee.contractAddress = 'So11111111111111111111111111111111111111112';
                        fee.updatedAt = new Date();
                        updated = true;
                    }
                }
            }
            
            // Save changes
            if (updated) {
                business.supportedTokensUpdatedAt = new Date();
                business.updatedAt = new Date();
                await business.save();
                totalFixed++;
                console.log(`  ✅ Successfully fixed SOL addresses`);
            } else {
                console.log(`  ℹ️  No SOL addresses needed fixing`);
            }
        }
        
        console.log(`\n🎉 Migration completed!`);
        console.log(`📈 Summary:`);
        console.log(`   - Businesses checked: ${businesses.length}`);
        console.log(`   - Businesses fixed: ${totalFixed}`);
        console.log(`   - New SOL address: So11111111111111111111111111111111111111112`);
        console.log(`   - Old SOL address: 11111111111111111111111111111112`);
        
        return {
            success: true,
            businessesChecked: businesses.length,
            businessesFixed: totalFixed
        };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the migration
if (require.main === module) {
    migrateSolAddresses()
        .then((result) => {
            if (result.success) {
                console.log('✅ Migration completed successfully');
                process.exit(0);
            } else {
                console.error('❌ Migration failed:', result.error);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('💥 Migration crashed:', error);
            process.exit(1);
        });
}

module.exports = { migrateSolAddresses };
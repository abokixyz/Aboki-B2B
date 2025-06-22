// Import all models
const User = require('./User');
const Business = require('./Business');
const ApiKey = require('./ApiKey');
const TokenSelectionHistory = require('./TokenSelectionHistory');

// Export all models
module.exports = {
  User,
  Business,
  ApiKey,
  TokenSelectionHistory
};

// Optional: Add any shared model utilities or connections here
// For example, if you want to add database-wide utilities

// Cleanup expired tokens every hour
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await User.cleanupExpiredTokens();
      await TokenSelectionHistory.cleanupOldHistory();
      console.log('✅ Periodic cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }, 60 * 60 * 1000); // 1 hour
}

// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
 email: {
   type: String,
   required: true,
   unique: true,
   lowercase: true
 },
 password: {
   type: String,
   required: true
 },
 firstName: {
   type: String,
   required: true
 },
 lastName: {
   type: String,
   required: true
 },
 companyId: {
   type: mongoose.Schema.Types.ObjectId,
   ref: 'Company',
   default: null
 },
 phoneNumber: {
   type: String,
   default: null
 },
 role: {
   type: String,
   enum: ['ADMIN', 'USER', 'MANAGER'],
   default: 'USER'
 },
 isActive: {
   type: Boolean,
   default: true
 },
 emailVerified: {
   type: Boolean,
   default: false
 },
 lastLoginAt: {
   type: Date,
   default: null
 },
 resetToken: {
   type: String,
   default: null
 },
 resetTokenExpiry: {
   type: Date,
   default: null
 }
}, {
 timestamps: true
});

userSchema.pre('save', async function(next) {
 if (!this.isModified('password')) return next();
 this.password = await bcrypt.hash(this.password, 10);
 next();
});

module.exports = mongoose.model('User', userSchema);
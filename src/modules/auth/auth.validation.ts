import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  phoneNumber: Joi.string().optional().allow(''),
  tinNumber: Joi.string()
    .pattern(/^\d{9}$/)
    .messages({ 'string.pattern.base': 'tinNumber must be exactly 9 digits (Rwanda RRA format)' })
    .optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const googleTokenSchema = Joi.object({
  idToken: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Code-based email verification
export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Verification code must be exactly 6 digits',
    'string.pattern.base': 'Verification code must be numeric',
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

// Verify the reset code without consuming it
export const verifyResetCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Reset code must be exactly 6 digits',
    'string.pattern.base': 'Reset code must be numeric',
  }),
});

// Consume the code and set the new password
export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
import { configurePassport } from './passport.config.js';

/**
 * Central auth setup entry point
 * Delegates Passport configuration to passport.config.ts
 */
export function setupAuth() {
  configurePassport();
}
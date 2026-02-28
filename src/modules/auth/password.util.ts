import argon2 from 'argon2';

/**
 * 2.1: Hash password using Argon2id
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
  });
};

/**
 * 2.1: Verify password against stored hash
 */
export const verifyPassword = async (hash: string, password: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
};
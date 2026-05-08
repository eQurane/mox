const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (isProd && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required in production.');
  process.exit(1);
}

export const jwtSecret = JWT_SECRET || 'dev-local-only-insecure-secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

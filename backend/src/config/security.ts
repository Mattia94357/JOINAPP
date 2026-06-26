export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured.');
  return secret;
};

export const isProduction = () => process.env.NODE_ENV === 'production';

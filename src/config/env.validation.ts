type Environment = Record<string, string | undefined>;

export function validateEnvironment(config: Environment): Environment {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];
  for (const key of required) {
    if (!config[key])
      throw new Error(`${key} environment variable is required.`);
  }

  if ((config.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  if (
    config.NODE_ENV === 'production' &&
    config.JWT_SECRET?.includes('replace')
  ) {
    throw new Error('A placeholder JWT_SECRET cannot be used in production.');
  }

  const port = Number(config.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  return {
    ...config,
    PORT: String(port),
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN ?? '8h',
  };
}

import { validateApiConfig, ConfigValidationError, type ApiConfig } from '@soulforge/shared';

let config: ApiConfig | null = null;

export function getConfig(): ApiConfig {
  if (!config) {
    try {
      config = validateApiConfig(process.env);
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        console.error('FATAL: Invalid API configuration:');
        console.error(err.message);
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        console.error('See apps/api/.env.example for reference.');
        process.exit(1);
      }
      throw err;
    }
  }
  return config;
}

export { type ApiConfig };

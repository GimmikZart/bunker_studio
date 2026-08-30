import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  STUDIO_MASTER_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
});

export type StudioEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): StudioEnv {
  const env = envSchema.parse(source);
  if (env.NODE_ENV === 'production' && !env.STUDIO_MASTER_KEY)
    throw new Error('STUDIO_MASTER_KEY is required in production.');
  return env;
}

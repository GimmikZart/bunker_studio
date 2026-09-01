import { z } from 'zod';

const encodedMasterKey = z.string().refine(
  (value) => {
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return false;
    return Buffer.from(value, 'base64').length === 32;
  },
  { message: 'STUDIO_MASTER_KEY must be a base64-encoded 32-byte key.' },
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BUNKER_PERSISTENCE_MODE: z.enum(['memory', 'supabase']).default('memory'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  STUDIO_MASTER_KEY: z.union([encodedMasterKey, z.literal('')]).optional(),
  SUPABASE_URL: z.string().url().default('http://127.0.0.1:55421'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@127.0.0.1:55422/postgres'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  AGENT_CHAT_ESTIMATED_COST: z.coerce.number().nonnegative().default(0.01),
  GITHUB_API_TOKEN: z.union([z.string().min(1), z.literal('')]).optional(),
  WEB_PUSH_VAPID_SUBJECT: z.union([z.string().min(1), z.literal('')]).optional(),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.union([z.string().min(1), z.literal('')]).optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.union([z.string().min(1), z.literal('')]).optional(),
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_CONTROL_PLANE_URL: z.union([z.string().url(), z.literal('')]).optional(),
  WORKER_REGISTRATION_TOKEN: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_NODE_ID: z.union([z.string().uuid(), z.literal('')]).optional(),
  WORKER_CREDENTIAL: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_IDENTITY_FILE: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_WORKSPACE_ROOT: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_CODEX_NETWORK_ACCESS: z.enum(['true', 'false']).default('false'),
  WORKER_NAME: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_CAPABILITIES: z.union([z.string().min(1), z.literal('')]).optional(),
  WORKER_TASK_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
  WORKER_PUSH_POLL_INTERVAL_MS: z.coerce.number().int().positive().optional(),
});

export type StudioEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): StudioEnv {
  const env = envSchema.parse(source);
  if (
    (env.NODE_ENV === 'production' || env.BUNKER_PERSISTENCE_MODE === 'supabase') &&
    !env.STUDIO_MASTER_KEY
  )
    throw new Error('STUDIO_MASTER_KEY is required in production.');
  return env;
}

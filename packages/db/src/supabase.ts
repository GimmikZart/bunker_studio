import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
};

export function createStudioSupabaseClient(
  cookies: CookieAdapter,
  env: { url: string; anonKey: string },
) {
  return createServerClient(env.url, env.anonKey, { cookies });
}

export function createStudioAuthClient(env: { url: string; anonKey: string }) {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createStudioServiceClient(env: { url: string; serviceRoleKey: string }) {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

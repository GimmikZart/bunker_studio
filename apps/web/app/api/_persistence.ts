export function usesSupabasePersistence(
  env: { NODE_ENV?: string; BUNKER_PERSISTENCE_MODE?: string } = process.env,
): boolean {
  return env.NODE_ENV === 'production' || env.BUNKER_PERSISTENCE_MODE === 'supabase';
}

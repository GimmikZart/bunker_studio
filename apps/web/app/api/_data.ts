import {
  SupabaseTenancyRepository,
  type SupabaseDataClient,
  type TenantStore,
} from '@bunker-studio/db';
import { createRequestSupabaseClient } from './_supabase';
import { tenantStore } from './_store';

export type WebTenancyRepository = TenantStore | SupabaseTenancyRepository;

export async function getWebTenancyRepository(): Promise<WebTenancyRepository | null> {
  if (process.env.NODE_ENV !== 'production') return tenantStore;
  const client = await createRequestSupabaseClient();
  return client ? new SupabaseTenancyRepository(client as unknown as SupabaseDataClient) : null;
}

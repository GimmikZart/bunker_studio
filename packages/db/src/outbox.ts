export type OutboxRow = {
  id: string;
  event_type: string;
  payload_json: Record<string, unknown>;
  available_at: string;
  processed_at: string | null;
  attempts: number;
};

export type OutboxDatabaseClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: OutboxRow[] | null;
    error: { message: string } | null;
  }>;
  from: (table: 'outbox_events') => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export class SupabaseOutboxRepository {
  constructor(private readonly client: OutboxDatabaseClient) {}

  async claim(now = new Date()): Promise<OutboxRow | null> {
    const result = await this.client.rpc('claim_outbox_event', { p_now: now.toISOString() });
    if (result.error) throw new Error(result.error.message);
    return result.data?.[0] ?? null;
  }

  async markProcessed(eventId: string): Promise<void> {
    const result = await this.client
      .from('outbox_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', eventId);
    if (result.error) throw new Error(result.error.message);
  }
}

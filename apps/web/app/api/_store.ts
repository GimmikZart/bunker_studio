import { TenantStore, WorkerRegistry } from '@bunker-studio/db';
import type { DesignRecord } from '@bunker-studio/core';
import type { MemoryUnit } from '@bunker-studio/db';

export const tenantStore = new TenantStore();
export const workerRegistry = new WorkerRegistry();

const memories = new Map<string, MemoryUnit[]>();

export function addMemory(
  organizationId: string,
  input: Omit<MemoryUnit, 'id' | 'deletedAt'>,
): MemoryUnit {
  const memory: MemoryUnit = { ...input, id: crypto.randomUUID(), deletedAt: null };
  memories.set(organizationId, [...(memories.get(organizationId) ?? []), memory]);
  return structuredClone(memory);
}

export function getMemories(organizationId: string): MemoryUnit[] {
  return structuredClone(memories.get(organizationId) ?? []);
}

export function deleteMemory(organizationId: string, memoryId: string): boolean {
  const current = memories.get(organizationId) ?? [];
  const target = current.find((memory) => memory.id === memoryId && !memory.deletedAt);
  if (!target) return false;
  target.deletedAt = new Date().toISOString();
  return true;
}

const designs = new Map<string, DesignRecord[]>();

export function submitDesignVersion(
  organizationId: string,
  input: Pick<DesignRecord, 'version' | 'spec'>,
): DesignRecord {
  const versions = designs.get(organizationId) ?? [];
  const record: DesignRecord = {
    id: crypto.randomUUID(),
    version: input.version,
    status: 'SUBMITTED',
    spec: structuredClone(input.spec),
  };
  designs.set(organizationId, [...versions, record]);
  return record;
}

export function listDesignVersions(organizationId: string): DesignRecord[] {
  return structuredClone(designs.get(organizationId) ?? []);
}

export function replaceDesignVersions(organizationId: string, versions: DesignRecord[]): void {
  designs.set(organizationId, structuredClone(versions));
}

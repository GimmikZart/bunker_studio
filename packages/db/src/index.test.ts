import { describe, expect, it } from 'vitest';
import { AuthorizationError } from '@bunker-studio/core';
import { TenantStore, WorkerRegistry } from './index';

describe('TenantStore', () => {
  it('keeps organization data isolated by membership', () => {
    const store = new TenantStore();
    const first = store.createOrganization({ name: 'First Org', ownerUserId: 'user-a' });
    store.createOrganization({ name: 'Second Org', ownerUserId: 'user-b' });
    expect(store.listOrganizations('user-a')).toHaveLength(1);
    expect(store.listOrganizations('user-a')[0]?.id).toBe(first.id);
    expect(() =>
      store.createTeam({ organizationId: first.id, actorUserId: 'user-b', name: 'Intrusion' }),
    ).toThrow(AuthorizationError);
  });

  it('archives instead of deleting an organization', () => {
    const store = new TenantStore();
    const organization = store.createOrganization({ name: 'Archive Me', ownerUserId: 'owner' });
    store.archiveOrganization(organization.id, 'owner');
    expect(store.listOrganizations('owner')).toEqual([]);
    expect(store.snapshot().organizations[0]?.archivedAt).not.toBeNull();
  });

  it('preserves an agent identity independently from its binding', () => {
    const store = new TenantStore();
    const organization = store.createOrganization({ name: 'Agents', ownerUserId: 'owner' });
    const agent = store.createAgent({
      organizationId: organization.id,
      actorUserId: 'owner',
      name: 'Maya',
      roleKey: 'frontend',
      title: 'Frontend Engineer',
      providerBindingId: 'binding-v1',
      avatarAssetId: '00000000-0000-0000-0000-000000000001',
      skills: ['frontend'],
      tools: ['repository workspace'],
      permissions: ['repo.read'],
    });
    expect(store.listAgents(organization.id, 'owner')[0]?.id).toBe(agent.id);
    expect(store.listAgents(organization.id, 'owner')[0]?.providerBindingId).toBe('binding-v1');
    expect(store.listAgents(organization.id, 'owner')[0]).toMatchObject({
      avatarAssetId: '00000000-0000-0000-0000-000000000001',
      skills: ['frontend'],
      tools: ['repository workspace'],
      permissions: ['repo.read'],
    });
    store.changeAgentBinding(agent.id, organization.id, 'owner', 'binding-v2');
    expect(store.listAgents(organization.id, 'owner')[0]?.id).toBe(agent.id);
    expect(store.listAgents(organization.id, 'owner')[0]?.providerBindingId).toBe('binding-v2');
  });
});

describe('WorkerRegistry', () => {
  it('only assigns online nodes with matching capability and concurrency', () => {
    const registry = new WorkerRegistry();
    const node = registry.register({
      organizationId: 'org-a',
      name: 'local',
      capabilities: ['ollama'],
      maxConcurrent: 1,
      now: 0,
    });
    expect(
      registry.findEligible({ organizationId: 'org-a', capability: 'ollama', now: 1 })?.id,
    ).toBe(node.id);
    registry.startJob(node.id, 1);
    expect(
      registry.findEligible({ organizationId: 'org-a', capability: 'ollama', now: 1 }),
    ).toBeNull();
    registry.finishJob(node.id);
    registry.setOffline(node.id);
    expect(
      registry.findEligible({ organizationId: 'org-a', capability: 'ollama', now: 1 }),
    ).toBeNull();
  });
});

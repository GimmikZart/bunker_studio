import { ConversationArchivePanel } from '../_components/conversation-archive-panel';

export default function ConversationsPage() {
  return (
    <main className="shell onboarding-shell">
      <p className="eyebrow">Organization / Conversations</p>
      <h1>Find the decision you remember.</h1>
      <p className="hero-copy">
        Search the tenant-scoped conversation archive while keeping agent context bounded and
        intentional.
      </p>
      <ConversationArchivePanel />
    </main>
  );
}

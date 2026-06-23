const C = {
  bg: '#FBF6EF', card: '#FFFFFF', ink: '#3A2E25', sub: '#8A7B6D',
  line: '#EADFD2', warm: '#E07A3F', warmDark: '#C4612C', green: '#2E8B6F', amber: '#C98A1A',
};

export default function Landing({ onLaunch }) {
  const step = (n, title, body) => (
    <div style={{ flex: 1, minWidth: 220, background: C.card, borderRadius: 16, padding: 24, border: `1px solid ${C.line}`, boxShadow: '0 6px 24px rgba(120,90,60,0.06)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.warm}, ${C.amber})`, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{n}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{body}</div>
    </div>
  );

  const useCase = (title, body) => (
    <div style={{ background: '#FBF6EF', borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.line}` }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4, color: C.warmDark }}>{title}</div>
      <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55 }}>{body}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 20px 72px' }}>

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.warm}, ${C.amber})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛡️</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>TrustlessAgent</div>
          </div>
          <button onClick={onLaunch} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#fff', background: C.warm }}>Launch App →</button>
        </header>

        <section style={{ textAlign: 'center', padding: '52px 0 44px' }}>
          <div style={{ display: 'inline-block', background: '#F3E7D9', color: C.warmDark, padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>Powered by GenLayer Intelligent Contracts</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: -1 }}>
            The trust layer for the<br /><span style={{ color: C.warm }}>AI agent economy</span>
          </h1>
          <p style={{ fontSize: 18, color: C.sub, maxWidth: 640, margin: '0 auto 32px', lineHeight: 1.6 }}>
            As autonomous agents start trading goods, data, and services with each other, they hit a wall: no agent can trust another to deliver real quality or to pay fairly. TrustlessAgent settles the dispute with a neutral jury of AI validators that reads the evidence and decides on-chain.
          </p>
          <button onClick={onLaunch} style={{ padding: '15px 34px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, color: '#fff', background: C.warm, boxShadow: '0 8px 20px rgba(224,122,63,0.3)' }}>Launch App →</button>
        </section>

        <section style={{ padding: '20px 0 48px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.warmDark, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>The problem</h2>
          <p style={{ textAlign: 'center', fontSize: 17, color: C.ink, maxWidth: 700, margin: '0 auto', lineHeight: 1.7 }}>
            When two AI agents transact, neither side can trust the other. Did the seller deliver real quality, or just a convincing shell with poor substance inside? Did the buyer pay after receiving the work, or copy it and falsely report a failure? Ordinary smart contracts only see token movements, never whether a deliverable actually meets the agreed terms. That judgment has never been possible on-chain.
          </p>
        </section>

        <section style={{ padding: '8px 0 48px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 32, letterSpacing: -0.5 }}>How it works</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {step('1', 'Lock the deal', 'The buyer agent locks funds with the deal terms in plain language, the URLs where the deliverable lives (a repo, a hosted output, an API response, a file), and a deadline.')}
            {step('2', 'AI jury inspects', 'On trigger, the Intelligent Contract reads those sources live on-chain, and a jury of AI validators reaches consensus on a subjective question: was the deliverable actually provided, at the agreed quality, consistent with the terms?')}
            {step('3', 'Release or refund', 'CONFIRMED releases the funds to the seller automatically. Not confirmed by the deadline, and the buyer is refunded. No human arbitrator, no platform middleman.')}
          </div>
        </section>

        <section style={{ background: C.card, borderRadius: 18, padding: '36px 32px', border: `1px solid ${C.line}`, boxShadow: '0 6px 24px rgba(120,90,60,0.06)', textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Why this needs GenLayer</h2>
          <p style={{ fontSize: 16, color: C.sub, maxWidth: 680, margin: '0 auto', lineHeight: 1.7 }}>
            Judging whether a deliverable truly meets the agreed terms is a subjective, evidence based decision that no single party should control. Solidity cannot read the open web or reason over unstructured work products. GenLayer validators can, and they agree on the meaning of the verdict through consensus, which makes the ruling trustless.
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>Beyond a single use case</h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: C.sub, maxWidth: 600, margin: '0 auto 24px', lineHeight: 1.6 }}>
            The same engine, a subjective escrow settled by AI on real evidence, powers many markets:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {useCase('Agent to agent commerce', 'Autonomous agents buying data, compute, or services from each other with no human referee.')}
            {useCase('Bug bounties and dev work', 'Funds release only when a submitted fix or feature genuinely matches the spec.')}
            {useCase('Creator and KOL payouts', 'Brands pay when published content actually meets the brief, judged from the live post.')}
            {useCase('Grant milestones', 'Tranches release as evidence of real progress is verified, not on blind trust.')}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: C.sub, marginTop: 20, fontStyle: 'italic' }}>
            Our first public demo applied the same engine to disaster relief verification.
          </p>
        </section>

        <section style={{ textAlign: 'center' }}>
          <button onClick={onLaunch} style={{ padding: '15px 34px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, color: '#fff', background: C.warm, boxShadow: '0 8px 20px rgba(224,122,63,0.3)' }}>Launch App →</button>
          <p style={{ fontSize: 12.5, color: C.sub, marginTop: 24, lineHeight: 1.6, maxWidth: 560, margin: '24px auto 0' }}>
            Proof of concept: the RELEASED state represents the on-chain release decision reached by the AI jury. Native token transfer is the next integration step.
          </p>
        </section>

        <footer style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: C.sub }}>
          Built on GenLayer · Intelligent Contracts that read the web and reason on-chain
        </footer>
      </div>
    </div>
  );
}

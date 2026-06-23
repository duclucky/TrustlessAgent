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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '0 20px 72px' }}>

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.warm}, ${C.amber})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🤍</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>CrisisPledge</div>
          </div>
          <button onClick={onLaunch} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#fff', background: C.warm }}>Launch App →</button>
        </header>

        <section style={{ textAlign: 'center', padding: '52px 0 44px' }}>
          <div style={{ display: 'inline-block', background: '#F3E7D9', color: C.warmDark, padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>Powered by GenLayer Intelligent Contracts</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: -1 }}>
            Relief funds that release<br />only when disaster is <span style={{ color: C.warm }}>truly verified</span>
          </h1>
          <p style={{ fontSize: 18, color: C.sub, maxWidth: 620, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Pledge money against a disaster condition. A jury of AI validators reads live news on-chain and decides whether it really happened — no trusted middleman, no fake claims, no frozen funds.
          </p>
          <button onClick={onLaunch} style={{ padding: '15px 34px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 17, color: '#fff', background: C.warm, boxShadow: '0 8px 20px rgba(224,122,63,0.3)' }}>Launch App →</button>
        </section>

        <section style={{ padding: '20px 0 48px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.warmDark, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>The problem</h2>
          <p style={{ textAlign: 'center', fontSize: 17, color: C.ink, maxWidth: 680, margin: '0 auto', lineHeight: 1.7 }}>
            Conditional charity pledges depend on a middleman to decide whether the triggering disaster truly occurred — slow, biased, and easy to game. Ordinary blockchains can't read the news or judge whether an event is real, so this has never worked on-chain.
          </p>
        </section>

        <section style={{ padding: '8px 0 48px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, marginBottom: 32, letterSpacing: -0.5 }}>How it works</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {step('1', 'Lock a pledge', 'A donor locks funds with a disaster condition (e.g. "M7+ earthquake in region X") plus the news sources to check, and a deadline.')}
            {step('2', 'AI jury investigates', 'On trigger, the Intelligent Contract reads the live sources on-chain and a jury of AI validators reaches consensus: did it really happen, at the claimed scale, consistently across sources?')}
            {step('3', 'Release or refund', 'CONFIRMED → funds release to the relief org automatically. Not confirmed by the deadline → the donor is refunded. No human in the loop.')}
          </div>
        </section>

        <section style={{ background: C.card, borderRadius: 18, padding: '36px 32px', border: `1px solid ${C.line}`, boxShadow: '0 6px 24px rgba(120,90,60,0.06)', textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Why this needs GenLayer</h2>
          <p style={{ fontSize: 16, color: C.sub, maxWidth: 660, margin: '0 auto', lineHeight: 1.7 }}>
            Deciding whether a real disaster happened — cross-checked across independent sources and not fake news — is a subjective, multi-source judgment. Solidity can't read the web or reason over unstructured news. GenLayer's AI validators can, and they agree on the <em>meaning</em> of the verdict through consensus.
          </p>
          <button onClick={onLaunch} style={{ marginTop: 28, padding: '13px 30px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, color: '#fff', background: C.warm }}>Try it now →</button>
        </section>

        <footer style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: C.sub }}>
          Built on GenLayer · Intelligent Contracts that read the web and reason on-chain
        </footer>
      </div>
    </div>
  );
}

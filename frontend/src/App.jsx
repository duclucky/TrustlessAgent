import { useEffect, useMemo, useState } from 'react';
import { AGENT_ESCROW, makeWriteClient, readEscrow, TransactionStatus } from './genlayer.js';

const TERMS =
  'Seller agent must deliver a working REST API for weather lookups with a public endpoint, an OpenAPI description, and evidence of meaningful test coverage.';
const REQUIREMENTS =
  'Validators inspect the submitted URL content and decide whether the deliverable is accessible, matches the agreed API scope, and provides enough implementation evidence.';

const C = {
  bg: '#f7f5f1',
  panel: '#ffffff',
  ink: '#202124',
  sub: '#62666d',
  line: '#d8dce2',
  blue: '#265fdd',
  blueSoft: '#e8efff',
  green: '#16794c',
  red: '#aa2e25',
  amber: '#9a6700',
};

function weiFromGen(value) {
  const clean = String(value || '0').trim();
  const [whole, frac = ''] = clean.split('.');
  const padded = (frac + '000000000000000000').slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(padded || '0');
}

function parseDeal(raw) {
  const parts = String(raw || '').split('|');
  return {
    id: parts[0] || '',
    status: parts[1] || '',
    verdict: parts[2] || '',
    amount: parts[3] || '0',
    buyer: parts[4] || '',
    seller: parts[5] || '',
    deadline: parts[6] || '',
  };
}

function statusColor(status) {
  if (status === 'RELEASED' || status === 'RELEASE_APPROVED') return C.green;
  if (status === 'REFUNDED' || status === 'REFUND_APPROVED') return C.red;
  if (status === 'SUBMITTED') return C.amber;
  return C.blue;
}

export default function App() {
  const [wallet, setWallet] = useState('');
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState('deal-0');
  const [seller, setSeller] = useState('');
  const [amount, setAmount] = useState('0.1');
  const [terms, setTerms] = useState(TERMS);
  const [requirements, setRequirements] = useState(REQUIREMENTS);
  const [deadline, setDeadline] = useState('9999999999');
  const [deliverableUrl, setDeliverableUrl] = useState('https://example.com');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const contractReady = useMemo(() => !AGENT_ESCROW.endsWith('0000000000000000000000000000000000000000'), []);

  async function connectWallet() {
    setError('');
    if (!window.ethereum) {
      setError('MetaMask is required for write transactions.');
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWallet(accounts[0]);
  }

  async function refreshDeals() {
    setError('');
    try {
      const count = Number(await readEscrow('get_deal_count', []));
      const next = [];
      for (let i = 0; i < count; i += 1) {
        const id = `deal-${i}`;
        const deal = parseDeal(await readEscrow('get_deal', [id]));
        const reason = String(await readEscrow('get_reason', [id]));
        next.push({ ...deal, reason });
      }
      setDeals(next.reverse());
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    refreshDeals();
  }, []);

  async function write(functionName, args, label, value = 0n) {
    if (!wallet) {
      setError('Connect a funded studionet wallet first.');
      return;
    }
    setBusy(label);
    setError('');
    setMessage('');
    try {
      const client = makeWriteClient(wallet);
      const hash = await client.writeContract({
        address: AGENT_ESCROW,
        functionName,
        args,
        value,
      });
      await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
      setMessage(`Transaction accepted: ${hash}`);
      await refreshDeals();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy('');
    }
  }

  function openDeal() {
    write('open_deal', [seller, terms, requirements, Number(deadline)], 'Opening funded escrow', weiFromGen(amount));
  }

  function submitDeliverable() {
    write('submit_deliverable', [selectedDeal, deliverableUrl], 'Submitting deliverable evidence');
  }

  function adjudicate() {
    write('adjudicate_delivery', [selectedDeal], 'Waiting for validator adjudication');
  }

  function release() {
    write('release_deal', [selectedDeal], 'Releasing escrow to seller');
  }

  function refund() {
    const nowTs = Math.floor(Date.now() / 1000);
    write('claim_refund', [selectedDeal, nowTs], 'Refunding escrow to buyer');
  }

  const input = {
    width: '100%',
    border: `1px solid ${C.line}`,
    borderRadius: 6,
    padding: '10px 12px',
    font: 'inherit',
    color: C.ink,
    boxSizing: 'border-box',
  };
  const label = { display: 'block', marginBottom: 6, color: C.sub, fontSize: 13, fontWeight: 600 };
  const button = (primary = false) => ({
    border: `1px solid ${primary ? C.blue : C.line}`,
    borderRadius: 6,
    padding: '10px 14px',
    background: primary ? C.blue : '#fff',
    color: primary ? '#fff' : C.ink,
    fontWeight: 700,
    cursor: busy ? 'wait' : 'pointer',
  });

  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Inter, Segoe UI, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 0 }}>TrustlessAgent</h1>
            <div style={{ color: C.sub, marginTop: 4 }}>Agent deliverable escrow on GenLayer studionet</div>
          </div>
          <button style={button(true)} onClick={wallet ? refreshDeals : connectWallet}>
            {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Connect Wallet'}
          </button>
        </header>

        {!contractReady && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, background: C.blueSoft, marginBottom: 16 }}>
            Set VITE_CONTRACT_ADDRESS after deploying AgentDeliverableEscrow.
          </div>
        )}
        {message && <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, background: '#eef8f2', color: C.green, marginBottom: 16 }}>{message}</div>}
        {error && <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, background: '#fff0ee', color: C.red, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{error}</div>}
        {busy && <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, background: '#fff8e6', color: C.amber, marginBottom: 16 }}>{busy}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 430px) 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 14px' }}>Open Funded Escrow</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={label}>Seller address</label>
                <input style={input} value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x..." />
              </div>
              <div>
                <label style={label}>Funding amount in GEN</label>
                <input style={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label style={label}>Deliverable terms</label>
                <textarea style={{ ...input, minHeight: 96, resize: 'vertical' }} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
              <div>
                <label style={label}>Evidence requirements</label>
                <textarea style={{ ...input, minHeight: 72, resize: 'vertical' }} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
              </div>
              <div>
                <label style={label}>Refund deadline timestamp</label>
                <input style={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <button style={button(true)} onClick={openDeal} disabled={!!busy}>Open Escrow</button>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Deal Workflow</h2>
              <button style={button()} onClick={refreshDeals} disabled={!!busy}>Refresh</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={label}>Deal ID</label>
                <input style={input} value={selectedDeal} onChange={(e) => setSelectedDeal(e.target.value)} />
              </div>
              <div>
                <label style={label}>Deliverable URL</label>
                <input style={input} value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
              <button style={button()} onClick={submitDeliverable} disabled={!!busy}>Submit Deliverable</button>
              <button style={button(true)} onClick={adjudicate} disabled={!!busy}>Adjudicate</button>
              <button style={button()} onClick={release} disabled={!!busy}>Release</button>
              <button style={button()} onClick={refund} disabled={!!busy}>Refund</button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {deals.length === 0 && <div style={{ color: C.sub, padding: '20px 0', textAlign: 'center' }}>No canonical deals found.</div>}
              {deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal.id)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${selectedDeal === deal.id ? C.blue : C.line}`,
                    borderRadius: 8,
                    padding: 14,
                    background: selectedDeal === deal.id ? C.blueSoft : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <strong>{deal.id}</strong>
                    <span style={{ color: statusColor(deal.status), fontWeight: 800 }}>{deal.status || 'UNKNOWN'}</span>
                  </div>
                  <div style={{ color: C.sub, fontSize: 13 }}>Verdict: {deal.verdict || 'NONE'} | Escrow wei: {deal.amount}</div>
                  <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>Buyer: {deal.buyer || 'unknown'}</div>
                  <div style={{ color: C.sub, fontSize: 13 }}>Seller: {deal.seller || 'unknown'}</div>
                  {deal.reason && <div style={{ color: C.ink, fontSize: 13, marginTop: 8 }}>{deal.reason}</div>}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

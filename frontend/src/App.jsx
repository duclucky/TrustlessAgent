import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  Gavel,
  HandCoins,
  History,
  Lock,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  Wallet,
  XCircle,
} from 'lucide-react';
import { AGENT_ESCROW, makeWriteClient, readEscrow, STUDIONET_CHAIN, TransactionStatus } from './genlayer.js';
import './App.css';

const DEFAULT_TERMS =
  'Seller agent must deliver a working REST API for weather lookups with a public endpoint, an OpenAPI description, and evidence of meaningful test coverage.';
const DEFAULT_REQUIREMENTS =
  'Validators inspect the submitted URL content and decide whether the deliverable is accessible, matches the agreed API scope, and provides enough implementation evidence.';
const DEFAULT_DELIVERABLE = 'https://trustlessagent-omega.vercel.app/weather-agent-deliverable.txt';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EXPLORER = 'https://genlayer-explorer.vercel.app';
const TABS = ['Dashboard', 'Escrow Deals', 'Adjudication', 'Settings'];

function weiFromGen(value) {
  const clean = String(value || '0').trim();
  if (!/^\d+(\.\d{0,18})?$/.test(clean)) return 0n;
  const [whole, frac = ''] = clean.split('.');
  const padded = (frac + '000000000000000000').slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(padded || '0');
}

function formatGen(wei) {
  try {
    const value = BigInt(String(wei || '0'));
    const whole = value / 10n ** 18n;
    const fraction = (value % 10n ** 18n).toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction} GEN` : `${whole} GEN`;
  } catch {
    return '0 GEN';
  }
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
    terms: '',
    deliverable: '',
    reason: '',
  };
}

function shortAddress(address) {
  if (!address) return 'not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerTxUrl(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

function explorerAddressUrl(address) {
  return `${EXPLORER}/address/${address}`;
}

function sameAddress(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function getInjectedProviders() {
  const ethereum = window.ethereum;
  if (!ethereum) return [];
  if (Array.isArray(ethereum.providers)) return ethereum.providers;
  return [ethereum];
}

function providerKey(provider, fallback = 'injected') {
  return provider?.info?.uuid || provider?.info?.rdns || provider?.info?.name || fallback;
}

function providerName(provider, fallback = 'EVM Wallet') {
  if (provider?.info?.name) return provider.info.name;
  if (provider?.isRabby) return 'Rabby';
  if (provider?.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider?.isTrust) return 'Trust Wallet';
  if (provider?.isMetaMask) return 'MetaMask';
  return fallback;
}

function isBuyer(deal, wallet) {
  return wallet && sameAddress(deal?.buyer, wallet);
}

function isSeller(deal, wallet) {
  return wallet && sameAddress(deal?.seller, wallet);
}

function canSubmit(deal, wallet) {
  return !!deal?.id && isSeller(deal, wallet) && ['FUNDED', 'SUBMITTED'].includes(deal.status);
}

function canAdjudicate(deal, wallet) {
  return !!deal?.id && (isBuyer(deal, wallet) || isSeller(deal, wallet)) && deal.status === 'SUBMITTED';
}

function canRelease(deal, wallet) {
  return !!deal?.id && isSeller(deal, wallet) && deal.status === 'RELEASE_APPROVED';
}

function canRefund(deal, wallet) {
  if (!deal?.id || !isBuyer(deal, wallet)) return false;
  if (deal.status === 'REFUND_APPROVED') return true;
  return ['FUNDED', 'SUBMITTED'].includes(deal.status) && Number(deal.deadline || 0) <= nowTs();
}

function roleReason(action, deal, wallet) {
  if (!wallet) return 'Connect a funded studionet wallet first.';
  if (!deal?.id) return 'Select a canonical deal first.';
  if (action === 'submit' && !isSeller(deal, wallet)) return 'Only the seller can submit deliverable evidence.';
  if (action === 'adjudicate' && !isSeller(deal, wallet) && !isBuyer(deal, wallet)) return 'Only deal parties can request adjudication.';
  if (action === 'release' && !isSeller(deal, wallet)) return 'Only the seller can release approved escrow.';
  if (action === 'refund' && !isBuyer(deal, wallet)) return 'Only the buyer can claim a refund.';
  if (action === 'submit' && !['FUNDED', 'SUBMITTED'].includes(deal.status)) return `Submit is unavailable when status is ${deal.status}.`;
  if (action === 'adjudicate' && deal.status !== 'SUBMITTED') return 'Adjudication requires submitted evidence.';
  if (action === 'release' && deal.status !== 'RELEASE_APPROVED') return 'Release requires a DELIVERED validator verdict.';
  if (action === 'refund' && !canRefund(deal, wallet)) return 'Refund requires REFUND_APPROVED or a deadline already reached by contract time.';
  return '';
}

function statusTone(status) {
  if (['RELEASED', 'RELEASE_APPROVED'].includes(status)) return 'success';
  if (['REFUNDED', 'REFUND_APPROVED'].includes(status)) return 'danger';
  if (status === 'SUBMITTED') return 'warning';
  return 'primary';
}

function verdictTone(verdict) {
  if (verdict === 'DELIVERED') return 'success';
  if (verdict === 'FAILED') return 'danger';
  if (verdict === 'INSUFFICIENT') return 'warning';
  return 'neutral';
}

function activeStep(status) {
  if (status === 'FUNDED') return 1;
  if (status === 'SUBMITTED') return 2;
  if (status === 'RELEASE_APPROVED' || status === 'REFUND_APPROVED') return 3;
  if (status === 'RELEASED' || status === 'REFUNDED') return 4;
  return 0;
}

function ActionButton({ icon: Icon, label, onClick, disabled, reason, tone = 'secondary', busy }) {
  return (
    <div className="action-wrap">
      <button className={`btn ${tone}`} onClick={onClick} disabled={disabled || busy} title={disabled ? reason : label}>
        <Icon size={16} />
        <span>{busy ? 'Working...' : label}</span>
      </button>
      {disabled && reason && <span className="disabled-reason">{reason}</span>}
    </div>
  );
}

export default function App() {
  const [wallet, setWallet] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [seller, setSeller] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [deadline, setDeadline] = useState('9999999999');
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [deliverableUrl, setDeliverableUrl] = useState(DEFAULT_DELIVERABLE);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activity, setActivity] = useState([]);
  const [walletOptions, setWalletOptions] = useState([]);
  const [selectedWalletKey, setSelectedWalletKey] = useState('');

  const contractReady = AGENT_ESCROW && AGENT_ESCROW !== ZERO_ADDRESS;
  const selectedDeal = deals.find((deal) => deal.id === selectedDealId) || deals[0] || null;

  const metrics = useMemo(() => {
    const active = deals.filter((deal) => ['FUNDED', 'SUBMITTED'].includes(deal.status)).length;
    const releaseApproved = deals.filter((deal) => deal.status === 'RELEASE_APPROVED').length;
    const refundApproved = deals.filter((deal) => deal.status === 'REFUND_APPROVED').length;
    const closed = deals.filter((deal) => ['RELEASED', 'REFUNDED'].includes(deal.status)).length;
    return { total: deals.length, active, releaseApproved, refundApproved, closed };
  }, [deals]);

  const filteredDeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return deals.filter((deal) => {
      const matchesQuery =
        !normalized ||
        deal.id.toLowerCase().includes(normalized) ||
        deal.buyer.toLowerCase().includes(normalized) ||
        deal.seller.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'ALL' || deal.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [deals, query, statusFilter]);

  async function refreshDeals(preferredDealId = selectedDealId) {
    setError('');
    try {
      const count = Number(await readEscrow('get_deal_count', []));
      const next = [];
      for (let i = 0; i < count; i += 1) {
        const id = `deal-${i}`;
        const [dealRaw, dealTerms, deliverable, reason] = await Promise.all([
          readEscrow('get_deal', [id]),
          readEscrow('get_terms', [id]),
          readEscrow('get_deliverable', [id]),
          readEscrow('get_reason', [id]),
        ]);
        next.push({
          ...parseDeal(dealRaw),
          terms: String(dealTerms || ''),
          deliverable: String(deliverable || ''),
          reason: String(reason || ''),
        });
      }
      const ordered = next.reverse();
      setDeals(ordered);
      if (preferredDealId && next.some((deal) => deal.id === preferredDealId)) {
        setSelectedDealId(preferredDealId);
      } else if (ordered[0]) {
        setSelectedDealId(ordered[0].id);
      }
    } catch (e) {
      setError(`Unable to read canonical state: ${e?.message || e}`);
    }
  }

  useEffect(() => {
    refreshDeals();
  }, []);

  useEffect(() => {
    function addWalletOptions(options) {
      setWalletOptions((current) => {
        const byKey = new Map(current.map((option) => [option.key, option]));
        for (const option of options) {
          byKey.set(option.key, option);
        }
        const next = Array.from(byKey.values());
        setSelectedWalletKey((existing) => existing || next[0]?.key || '');
        return next;
      });
    }

    function syncLegacyProviders() {
      addWalletOptions(getInjectedProviders().map((provider, index) => ({
        key: providerKey(provider, `injected-${index}`),
        name: providerName(provider, `EVM Wallet ${index + 1}`),
        provider,
      })));
    }

    function onProviderAnnounced(event) {
      const detail = event.detail;
      if (!detail?.provider) return;
      const provider = detail.provider;
      provider.info = detail.info;
      addWalletOptions([{
        key: providerKey(provider, `eip6963-${detail.info?.uuid || detail.info?.name || Date.now()}`),
        name: providerName(provider),
        provider,
      }]);
    }

    window.addEventListener('eip6963:announceProvider', onProviderAnnounced);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    syncLegacyProviders();
    return () => window.removeEventListener('eip6963:announceProvider', onProviderAnnounced);
  }, []);

  async function connectWallet() {
    setError('');
    setNotice('');
    const selectedOption = walletOptions.find((option) => option.key === selectedWalletKey) || walletOptions[0];
    const provider = selectedOption?.provider || getInjectedProviders()[0];
    if (!provider) {
      setError('No EVM wallet extension was found. Open this app in a browser where your wallet extension is installed, unlocked, and enabled for this site.');
      return;
    }
    try {
      const chainId = `0x${STUDIONET_CHAIN.id.toString(16)}`;
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }],
        });
      } catch (switchError) {
        if (switchError?.code !== 4902 && switchError?.code !== -32603) throw switchError;
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId,
              chainName: STUDIONET_CHAIN.name || 'GenLayer Studionet',
              nativeCurrency: STUDIONET_CHAIN.nativeCurrency || { name: 'GEN', symbol: 'GEN', decimals: 18 },
              rpcUrls: STUDIONET_CHAIN.rpcUrls?.default?.http || ['https://studio.genlayer.com/api'],
              blockExplorerUrls: [EXPLORER],
            },
          ],
        });
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      setWallet(accounts[0]);
      setNotice('Wallet connected on GenLayer studionet. Canonical state from GenLayer is ready to refresh.');
    } catch (e) {
      setError(`Wallet connection failed: ${e?.message || e}`);
    }
  }

  function pushActivity(entry) {
    setActivity((items) => [{ time: new Date().toLocaleTimeString(), ...entry }, ...items].slice(0, 8));
  }

  async function write(functionName, args, label, value = 0n, waitStatus = TransactionStatus.ACCEPTED) {
    if (!wallet) {
      setError('Connect a funded studionet wallet first.');
      return null;
    }
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const client = makeWriteClient(wallet);
      const hash = await client.writeContract({ address: AGENT_ESCROW, functionName, args, value });
      pushActivity({ label, method: functionName, hash, status: 'Submitted', dealId: args[0] || 'new' });
      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: waitStatus,
        interval: 5000,
        retries: 120,
      });
      const finalLabel = waitStatus === TransactionStatus.FINALIZED ? 'Finalized' : 'Accepted';
      pushActivity({ label, method: functionName, hash, status: finalLabel, dealId: args[0] || 'new' });
      setNotice(`${label} ${finalLabel.toLowerCase()}: ${hash}`);
      await refreshDeals(args[0]);
      return receipt;
    } catch (e) {
      pushActivity({ label, method: functionName, hash: '', status: 'Failed', dealId: args[0] || 'new' });
      setError(`${label} failed: ${e?.message || e}`);
      return null;
    } finally {
      setBusy('');
    }
  }

  async function openDeal() {
    const value = weiFromGen(amount);
    if (!/^0x[a-fA-F0-9]{40}$/.test(seller.trim())) {
      setError('Seller address must be a valid 0x address.');
      return;
    }
    if (value <= 0n) {
      setError('Funding amount must be greater than 0 GEN.');
      return;
    }
    if (!terms.trim() || !requirements.trim()) {
      setError('Terms and evidence requirements are required.');
      return;
    }
    const before = deals.length;
    await write('open_deal', [seller.trim(), terms.trim(), requirements.trim(), Number(deadline)], 'Open funded escrow', value);
    await refreshDeals(`deal-${before}`);
  }

  function submitDeliverable() {
    if (!selectedDeal) return;
    write('submit_deliverable', [selectedDeal.id, deliverableUrl.trim()], 'Submit deliverable evidence');
  }

  function adjudicate() {
    if (!selectedDeal) return;
    write('adjudicate_delivery', [selectedDeal.id], 'Waiting for validator consensus', 0n, TransactionStatus.FINALIZED);
  }

  function release() {
    if (!selectedDeal) return;
    write('release_deal', [selectedDeal.id], 'Release escrow to seller');
  }

  function refund() {
    if (!selectedDeal) return;
    write('claim_refund', [selectedDeal.id], 'Refund escrow to buyer');
  }

  async function copyText(text, label) {
    await navigator.clipboard?.writeText(text);
    setNotice(`${label} copied.`);
  }

  const step = activeStep(selectedDeal?.status);

  function renderMetrics() {
    return (
      <section className="metric-grid" aria-label="Escrow metrics">
        <Metric label="Total deals" value={metrics.total} />
        <Metric label="Active funded/submitted" value={metrics.active} tone="primary" />
        <Metric label="Release approved" value={metrics.releaseApproved} tone="success" />
        <Metric label="Refund approved" value={metrics.refundApproved} tone="danger" />
        <Metric label="Closed" value={metrics.closed} tone="neutral" />
      </section>
    );
  }

  function renderCreateEscrow() {
    return (
      <CreateEscrow
        seller={seller}
        setSeller={setSeller}
        amount={amount}
        setAmount={setAmount}
        deadline={deadline}
        setDeadline={setDeadline}
        terms={terms}
        setTerms={setTerms}
        requirements={requirements}
        setRequirements={setRequirements}
        openDeal={openDeal}
        busy={busy}
      />
    );
  }

  function renderDealConsole(title = 'Deal Console', description = 'Operate the selected escrow from canonical contract state.') {
    return (
      <section className="panel deal-console">
        <div className="panel-head split">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="deal-search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deal or address" />
          </div>
        </div>

        {selectedDeal ? (
          <>
            <div className="deal-summary">
              <div>
                <div className="row-tight">
                  <span className="mono strong">{selectedDeal.id}</span>
                  <Badge tone={statusTone(selectedDeal.status)}>{selectedDeal.status || 'UNKNOWN'}</Badge>
                  <Badge tone={verdictTone(selectedDeal.verdict)}>{selectedDeal.verdict || 'NONE'}</Badge>
                </div>
                <strong className="amount">{formatGen(selectedDeal.amount)}</strong>
              </div>
              <div className="party-stack">
                <span>Buyer <b className="mono">{shortAddress(selectedDeal.buyer)}</b></span>
                <span>Seller <b className="mono">{shortAddress(selectedDeal.seller)}</b></span>
                <span>Deadline <b className="mono">{selectedDeal.deadline}</b></span>
              </div>
            </div>

            <div className="timeline" aria-label="Deal lifecycle">
              {['Funded', 'Submitted', 'Adjudicated', selectedDeal.status === 'REFUNDED' ? 'Refunded' : 'Released'].map((label, index) => (
                <div key={label} className={index + 1 <= step ? 'timeline-step done' : 'timeline-step'}>
                  <span>{index + 1}</span>
                  <p>{label}</p>
                </div>
              ))}
            </div>

            <div className="details-grid">
              <DetailCard icon={FileText} title="Terms" body={selectedDeal.terms || 'No terms read from contract.'} />
              <DetailCard icon={Upload} title="Deliverable evidence" body={selectedDeal.deliverable || 'No deliverable submitted yet.'} link={selectedDeal.deliverable} />
              <DetailCard icon={Gavel} title="Validator reason" body={selectedDeal.reason || 'No validator reason yet.'} emphasis />
            </div>

            <div className="submit-inline">
              <label htmlFor="deliverable">Deliverable URL</label>
              <div>
                <input id="deliverable" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} />
                <button className="btn secondary" type="button" onClick={() => setDeliverableUrl(DEFAULT_DELIVERABLE)}>
                  Use verified sample
                </button>
              </div>
            </div>

            <div className="action-bar">
              <ActionButton icon={Upload} label="Submit" onClick={submitDeliverable} disabled={!canSubmit(selectedDeal, wallet)} reason={roleReason('submit', selectedDeal, wallet)} busy={busy === 'Submit deliverable evidence'} />
              <ActionButton icon={Gavel} label="Adjudicate" onClick={adjudicate} disabled={!canAdjudicate(selectedDeal, wallet)} reason={roleReason('adjudicate', selectedDeal, wallet)} busy={busy === 'Waiting for validator consensus'} tone="primary" />
              <ActionButton icon={Send} label="Release" onClick={release} disabled={!canRelease(selectedDeal, wallet)} reason={roleReason('release', selectedDeal, wallet)} busy={busy === 'Release escrow to seller'} tone="success" />
              <ActionButton icon={RotateCcw} label="Refund" onClick={refund} disabled={!canRefund(selectedDeal, wallet)} reason={roleReason('refund', selectedDeal, wallet)} busy={busy === 'Refund escrow to buyer'} tone="danger" />
            </div>
          </>
        ) : (
          <EmptyWorkflow
            wallet={wallet}
            refreshDeals={refreshDeals}
            connectWallet={connectWallet}
          />
        )}
      </section>
    );
  }

  function renderDealInventory() {
    return (
      <section className="panel deal-inventory">
        <div className="panel-head split">
          <div>
            <h2>Escrow Deals</h2>
            <p>Every row is read from `get_deal` and related views.</p>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="FUNDED">FUNDED</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="RELEASE_APPROVED">RELEASE_APPROVED</option>
            <option value="REFUND_APPROVED">REFUND_APPROVED</option>
            <option value="RELEASED">RELEASED</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>
        </div>
        <div className="deal-list">
          {filteredDeals.map((deal) => (
            <button key={deal.id} className={selectedDeal?.id === deal.id ? 'deal-row selected' : 'deal-row'} onClick={() => setSelectedDealId(deal.id)}>
              <span className="mono strong">{deal.id}</span>
              <Badge tone={statusTone(deal.status)}>{deal.status}</Badge>
              <Badge tone={verdictTone(deal.verdict)}>{deal.verdict || 'NONE'}</Badge>
              <span>{formatGen(deal.amount)}</span>
              <span className="mono">{shortAddress(deal.buyer)} / {shortAddress(deal.seller)}</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {filteredDeals.length === 0 && <p className="empty-line">No deals match the current filter.</p>}
        </div>
      </section>
    );
  }

  function renderTrustBoundary() {
    return (
      <section className="panel trust-boundary">
        <div className="panel-head">
          <h2>Trust Boundary</h2>
          <p>GenLayer validators render seller evidence and compare verdict meaning. The frontend only submits transactions and reads canonical state.</p>
        </div>
        <ul>
          <li><CheckCircle2 size={16} /> Browser signs with the connected wallet address.</li>
          <li><CheckCircle2 size={16} /> Adjudication waits for `TransactionStatus.FINALIZED`.</li>
          <li><CheckCircle2 size={16} /> Release/refund claims require canonical approved states.</li>
        </ul>
      </section>
    );
  }

  function renderActivityPanel() {
    return (
      <section className="panel activity-panel">
        <div className="panel-head">
          <h2><History size={18} /> Recent wallet activity</h2>
          <p>Session-local transaction activity. Canonical deal state remains the contract views.</p>
        </div>
        <div className="activity-list">
          {activity.map((item, index) => (
            <div className="activity-item" key={`${item.hash}-${item.time}-${index}`}>
              <span>{item.label}</span>
              <Badge tone={item.status === 'Failed' ? 'danger' : item.status === 'Finalized' || item.status === 'Accepted' ? 'success' : 'primary'}>{item.status}</Badge>
              {item.hash ? <a className="mono" href={explorerTxUrl(item.hash)} target="_blank" rel="noreferrer">{shortAddress(item.hash)} <ExternalLink size={12} /></a> : <span className="muted">No hash</span>}
              <time>{item.time}</time>
            </div>
          ))}
          {activity.length === 0 && <p className="empty-line">No wallet writes in this browser session yet.</p>}
        </div>
      </section>
    );
  }

  function renderDashboardTab() {
    return (
      <>
        {renderMetrics()}
        <section className="layout-grid">
          {renderCreateEscrow()}
          {renderDealConsole()}
        </section>
        <section className="bottom-grid">
          {renderTrustBoundary()}
          {renderActivityPanel()}
        </section>
      </>
    );
  }

  function renderDealsTab() {
    return (
      <section className="tab-stack">
        {renderMetrics()}
        {renderDealInventory()}
      </section>
    );
  }

  function renderAdjudicationTab() {
    const submittedDeals = deals.filter((deal) => ['SUBMITTED', 'RELEASE_APPROVED', 'REFUND_APPROVED'].includes(deal.status));
    return (
      <section className="tab-stack">
        <section className="adjudication-grid">
          {renderDealConsole('Adjudication Queue', 'Review seller evidence, request validator consensus, then settle the approved path.')}
          <section className="panel route-panel">
            <div className="panel-head">
              <h2>Adjudication queue</h2>
              <p>Deals that need validator judgment or final settlement.</p>
            </div>
            <div className="queue-list">
              {submittedDeals.map((deal) => (
                <button key={deal.id} className={selectedDeal?.id === deal.id ? 'queue-item selected' : 'queue-item'} onClick={() => setSelectedDealId(deal.id)}>
                  <span className="mono strong">{deal.id}</span>
                  <Badge tone={statusTone(deal.status)}>{deal.status}</Badge>
                  <span>{deal.verdict || 'NONE'}</span>
                </button>
              ))}
              {submittedDeals.length === 0 && <p className="empty-line">No submitted or approved deals need adjudication right now.</p>}
            </div>
          </section>
        </section>
        {renderActivityPanel()}
      </section>
    );
  }

  function renderSettingsTab() {
    return (
      <section className="settings-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Contract configuration</h2>
            <p>Production dApp wiring for the active Studionet escrow contract.</p>
          </div>
          <div className="settings-list">
            <span>Network <b>GenLayer Studionet</b></span>
            <span>Contract <b className="mono">{shortAddress(AGENT_ESCROW)}</b></span>
            <span>Connected wallet <b className="mono">{shortAddress(wallet)}</b></span>
            <span>Canonical reads <b>{contractReady ? 'Enabled' : 'Missing contract address'}</b></span>
          </div>
        </section>
        {renderTrustBoundary()}
        <section className="panel">
          <div className="panel-head">
            <h2>Evidence policy</h2>
            <p>Seller deliverables must be bounded public URLs. Validators render those URLs and compare release/refund meaning.</p>
          </div>
          <div className="settings-list">
            <span>Allowed evidence <b>HTTP or HTTPS URLs</b></span>
            <span>Max URLs <b>4 per deal</b></span>
            <span>Refund clock <b>Contract transaction time</b></span>
            <span>Settlement invariant <b>Escrow zeroed before transfer</b></span>
          </div>
        </section>
        {renderActivityPanel()}
      </section>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={18} /></div>
          <div>
            <strong>TrustlessAgent</strong>
            <span>Agent escrow console</span>
          </div>
        </div>
        <nav aria-label="Workspace navigation">
          {TABS.map((tab) => {
            const Icon = tab === 'Dashboard' ? Activity : tab === 'Escrow Deals' ? HandCoins : tab === 'Adjudication' ? Gavel : Settings;
            return (
              <button key={tab} className={activeTab === tab ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(tab)}>
                <Icon size={18} />
                <span>{tab}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span>Trust Boundary</span>
          <p>Validators inspect submitted public evidence. This browser does not decide the verdict.</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Canonical state from GenLayer</p>
            <h1>{activeTab}</h1>
          </div>
          <div className="top-actions">
            <a className="contract-pill" href={explorerAddressUrl(AGENT_ESCROW)} target="_blank" rel="noreferrer">
              <Network size={15} />
              <span>{shortAddress(AGENT_ESCROW)}</span>
              <ExternalLink size={14} />
            </a>
            <button className="icon-btn" onClick={() => copyText(AGENT_ESCROW, 'Contract address')} aria-label="Copy contract address">
              <Copy size={17} />
            </button>
            <button className="icon-btn" onClick={() => refreshDeals()} aria-label="Refresh canonical state" disabled={!!busy}>
              <RefreshCw size={17} />
            </button>
            {walletOptions.length > 1 && (
              <select className="wallet-select" value={selectedWalletKey} onChange={(e) => setSelectedWalletKey(e.target.value)} aria-label="Wallet extension">
                {walletOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.name}</option>
                ))}
              </select>
            )}
            <button className="btn primary" onClick={wallet ? () => refreshDeals() : connectWallet}>
              <Wallet size={16} />
              <span>{wallet ? shortAddress(wallet) : 'Connect Wallet'}</span>
            </button>
          </div>
        </header>

        {!contractReady && (
          <div className="banner warning">
            <AlertTriangle size={18} />
            <span>Set VITE_CONTRACT_ADDRESS to the deployed AgentDeliverableEscrow address.</span>
          </div>
        )}
        {notice && <div className="banner success" aria-live="polite"><CheckCircle2 size={18} /><span>{notice}</span></div>}
        {error && (
          <div className="banner danger" role="alert">
            <XCircle size={18} />
            <span>
              {error}
            </span>
          </div>
        )}
        {busy && <div className="banner progress" aria-live="polite"><RefreshCw className="spin" size={18} /><span>{busy}</span></div>}

        {activeTab === 'Dashboard' && renderDashboardTab()}
        {activeTab === 'Escrow Deals' && renderDealsTab()}
        {activeTab === 'Adjudication' && renderAdjudicationTab()}
        {activeTab === 'Settings' && renderSettingsTab()}

        {false && (
          <>
        <section className="metric-grid" aria-label="Escrow metrics">
          <Metric label="Total deals" value={metrics.total} />
          <Metric label="Active funded/submitted" value={metrics.active} tone="primary" />
          <Metric label="Release approved" value={metrics.releaseApproved} tone="success" />
          <Metric label="Refund approved" value={metrics.refundApproved} tone="danger" />
          <Metric label="Closed" value={metrics.closed} tone="neutral" />
        </section>

        <section className="layout-grid">
          <CreateEscrow
            seller={seller}
            setSeller={setSeller}
            amount={amount}
            setAmount={setAmount}
            deadline={deadline}
            setDeadline={setDeadline}
            terms={terms}
            setTerms={setTerms}
            requirements={requirements}
            setRequirements={setRequirements}
            openDeal={openDeal}
            busy={busy}
          />

          <section className="panel deal-console">
            <div className="panel-head split">
              <div>
                <h2>Deal Console</h2>
                <p>Operate the selected escrow from canonical contract state.</p>
              </div>
              <div className="deal-search">
                <Search size={16} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deal or address" />
              </div>
            </div>

            {selectedDeal ? (
              <>
                <div className="deal-summary">
                  <div>
                    <div className="row-tight">
                      <span className="mono strong">{selectedDeal.id}</span>
                      <Badge tone={statusTone(selectedDeal.status)}>{selectedDeal.status || 'UNKNOWN'}</Badge>
                      <Badge tone={verdictTone(selectedDeal.verdict)}>{selectedDeal.verdict || 'NONE'}</Badge>
                    </div>
                    <strong className="amount">{formatGen(selectedDeal.amount)}</strong>
                  </div>
                  <div className="party-stack">
                    <span>Buyer <b className="mono">{shortAddress(selectedDeal.buyer)}</b></span>
                    <span>Seller <b className="mono">{shortAddress(selectedDeal.seller)}</b></span>
                    <span>Deadline <b className="mono">{selectedDeal.deadline}</b></span>
                  </div>
                </div>

                <div className="timeline" aria-label="Deal lifecycle">
                  {['Funded', 'Submitted', 'Adjudicated', selectedDeal.status === 'REFUNDED' ? 'Refunded' : 'Released'].map((label, index) => (
                    <div key={label} className={index + 1 <= step ? 'timeline-step done' : 'timeline-step'}>
                      <span>{index + 1}</span>
                      <p>{label}</p>
                    </div>
                  ))}
                </div>

                <div className="details-grid">
                  <DetailCard icon={FileText} title="Terms" body={selectedDeal.terms || 'No terms read from contract.'} />
                  <DetailCard icon={Upload} title="Deliverable evidence" body={selectedDeal.deliverable || 'No deliverable submitted yet.'} link={selectedDeal.deliverable} />
                  <DetailCard icon={Gavel} title="Validator reason" body={selectedDeal.reason || 'No validator reason yet.'} emphasis />
                </div>

                <div className="submit-inline">
                  <label htmlFor="deliverable">Deliverable URL</label>
                  <div>
                    <input id="deliverable" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} />
                    <button className="btn secondary" type="button" onClick={() => setDeliverableUrl(DEFAULT_DELIVERABLE)}>
                      Use verified sample
                    </button>
                  </div>
                </div>

                <div className="action-bar">
                  <ActionButton icon={Upload} label="Submit" onClick={submitDeliverable} disabled={!canSubmit(selectedDeal, wallet)} reason={roleReason('submit', selectedDeal, wallet)} busy={busy === 'Submit deliverable evidence'} />
                  <ActionButton icon={Gavel} label="Adjudicate" onClick={adjudicate} disabled={!canAdjudicate(selectedDeal, wallet)} reason={roleReason('adjudicate', selectedDeal, wallet)} busy={busy === 'Waiting for validator consensus'} tone="primary" />
                  <ActionButton icon={Send} label="Release" onClick={release} disabled={!canRelease(selectedDeal, wallet)} reason={roleReason('release', selectedDeal, wallet)} busy={busy === 'Release escrow to seller'} tone="success" />
                  <ActionButton icon={RotateCcw} label="Refund" onClick={refund} disabled={!canRefund(selectedDeal, wallet)} reason={roleReason('refund', selectedDeal, wallet)} busy={busy === 'Refund escrow to buyer'} tone="danger" />
                </div>
              </>
            ) : (
              <EmptyWorkflow
                wallet={wallet}
                refreshDeals={refreshDeals}
                connectWallet={connectWallet}
              />
            )}
          </section>
        </section>

        <section className="panel deal-inventory">
          <div className="panel-head split">
            <div>
              <h2>Escrow Deals</h2>
              <p>Every row is read from `get_deal` and related views.</p>
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="FUNDED">FUNDED</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="RELEASE_APPROVED">RELEASE_APPROVED</option>
              <option value="REFUND_APPROVED">REFUND_APPROVED</option>
              <option value="RELEASED">RELEASED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
          <div className="deal-list">
            {filteredDeals.map((deal) => (
              <button key={deal.id} className={selectedDeal?.id === deal.id ? 'deal-row selected' : 'deal-row'} onClick={() => setSelectedDealId(deal.id)}>
                <span className="mono strong">{deal.id}</span>
                <Badge tone={statusTone(deal.status)}>{deal.status}</Badge>
                <Badge tone={verdictTone(deal.verdict)}>{deal.verdict || 'NONE'}</Badge>
                <span>{formatGen(deal.amount)}</span>
                <span className="mono">{shortAddress(deal.buyer)} / {shortAddress(deal.seller)}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {filteredDeals.length === 0 && <p className="empty-line">No deals match the current filter.</p>}
          </div>
        </section>

        <section className="bottom-grid">
          <section className="panel trust-boundary">
            <div className="panel-head">
              <h2>Trust Boundary</h2>
              <p>GenLayer validators render seller evidence and compare verdict meaning. The frontend only submits transactions and reads canonical state.</p>
            </div>
            <ul>
              <li><CheckCircle2 size={16} /> Browser signs with the connected wallet address.</li>
              <li><CheckCircle2 size={16} /> Adjudication waits for `TransactionStatus.FINALIZED`.</li>
              <li><CheckCircle2 size={16} /> Release/refund claims require canonical approved states.</li>
            </ul>
          </section>

          <section className="panel activity-panel">
            <div className="panel-head">
              <h2><History size={18} /> Recent wallet activity</h2>
              <p>Session-local transaction activity. Canonical deal state remains the contract views.</p>
            </div>
            <div className="activity-list">
              {activity.map((item, index) => (
                <div className="activity-item" key={`${item.hash}-${item.time}-${index}`}>
                  <span>{item.label}</span>
                  <Badge tone={item.status === 'Failed' ? 'danger' : item.status === 'Finalized' || item.status === 'Accepted' ? 'success' : 'primary'}>{item.status}</Badge>
                  {item.hash ? <a className="mono" href={explorerTxUrl(item.hash)} target="_blank" rel="noreferrer">{shortAddress(item.hash)} <ExternalLink size={12} /></a> : <span className="muted">No hash</span>}
                  <time>{item.time}</time>
                </div>
              ))}
              {activity.length === 0 && <p className="empty-line">No wallet writes in this browser session yet.</p>}
            </div>
          </section>
        </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function DetailCard({ icon: Icon, title, body, link, emphasis }) {
  const hasLink = link && /^https?:\/\//.test(link);
  return (
    <article className={emphasis ? 'detail-card emphasis' : 'detail-card'}>
      <h3><Icon size={16} /> {title}</h3>
      <p>{body}</p>
      {hasLink && (
        <a href={link} target="_blank" rel="noreferrer">
          Open evidence <ExternalLink size={13} />
        </a>
      )}
    </article>
  );
}

function EmptyWorkflow({ wallet, refreshDeals, connectWallet }) {
  const emptyDeal = null;

  return (
    <div className="empty-workflow">
      <div className="empty-state">
        <Clipboard size={28} />
        <div>
          <strong>Canonical state from GenLayer is empty or unavailable.</strong>
          <p>Open a funded escrow, connect the buyer or seller wallet, then refresh to operate a real deal.</p>
        </div>
      </div>

      <div className="timeline empty" aria-label="Escrow lifecycle preview">
        {['Buyer funds', 'Seller submits', 'Validators judge', 'Release or refund'].map((label, index) => (
          <div key={label} className="timeline-step">
            <span>{index + 1}</span>
            <p>{label}</p>
          </div>
        ))}
      </div>

      <div className="empty-cards">
        <DetailCard icon={FileText} title="Buyer and seller terms" body="Terms are stored on the AgentDeliverableEscrow contract when the buyer funds custody." />
        <DetailCard icon={Upload} title="Deliverable evidence" body="The seller submits a public URL that validators can independently inspect." />
        <DetailCard icon={ShieldCheck} title="Custody consequence" body="A finalized validator verdict gates the seller release path or the buyer refund path." emphasis />
      </div>

      <div className="action-bar empty-actions">
        <ActionButton icon={Upload} label="Submit" onClick={() => {}} disabled reason={roleReason('submit', emptyDeal, wallet)} />
        <ActionButton icon={Gavel} label="Adjudicate" onClick={() => {}} disabled reason={roleReason('adjudicate', emptyDeal, wallet)} tone="primary" />
        <ActionButton icon={Send} label="Release" onClick={() => {}} disabled reason={roleReason('release', emptyDeal, wallet)} tone="success" />
        <ActionButton icon={RotateCcw} label="Refund" onClick={() => {}} disabled reason={roleReason('refund', emptyDeal, wallet)} tone="danger" />
      </div>

      <div className="empty-tools">
        <button className="btn secondary" type="button" onClick={wallet ? refreshDeals : connectWallet}>
          {wallet ? <RefreshCw size={16} /> : <Wallet size={16} />}
          <span>{wallet ? 'Refresh canonical state' : 'Connect Wallet'}</span>
        </button>
      </div>
    </div>
  );
}

function CreateEscrow({ seller, setSeller, amount, setAmount, deadline, setDeadline, terms, setTerms, requirements, setRequirements, openDeal, busy }) {
  return (
    <section className="panel create-panel">
      <div className="panel-head">
        <h2><Lock size={18} /> Create Escrow</h2>
        <p>Define terms and fund custody in one payable transaction.</p>
      </div>
      <div className="form-grid">
        <label>
          Seller address
          <input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="0x..." />
        </label>
        <div className="dual-fields">
          <label>
            Amount in GEN
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </label>
          <label>
            Deadline timestamp
            <input value={deadline} onChange={(e) => setDeadline(e.target.value)} inputMode="numeric" />
            <small>Current timestamp: {nowTs()}</small>
          </label>
        </div>
        <label>
          Deliverable terms
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={5} />
        </label>
        <label>
          Evidence requirements
          <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} />
        </label>
        <button className="btn primary wide" onClick={openDeal} disabled={!!busy}>
          <Lock size={16} />
          Open Funded Escrow
        </button>
      </div>
    </section>
  );
}

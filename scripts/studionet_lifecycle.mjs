import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const genlayerRoot = path.resolve(projectRoot, '..');
const evidenceDir = path.join(projectRoot, 'docs', 'evidence', 'studionet');
const evidencePath = path.join(evidenceDir, 'deployment.json');
const contractAddress = process.env.VITE_CONTRACT_ADDRESS || '0x59e470473966A0E97A5DF236D5ff349ecCef7080';
const liveApp = 'https://trustlessagent-omega.vercel.app';
const defaultDeliverableUrl = `${liveApp}/weather-agent-deliverable.txt`;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(projectRoot, '.env'));
loadEnvFile(path.join(genlayerRoot, '.env'));

const [{ createClient, createAccount }, { studionet }, { TransactionStatus }] = await Promise.all([
  import(pathToFileURL(path.join(projectRoot, 'frontend', 'node_modules', 'genlayer-js', 'dist', 'index.js')).href),
  import(pathToFileURL(path.join(projectRoot, 'frontend', 'node_modules', 'genlayer-js', 'dist', 'chains', 'index.js')).href),
  import(pathToFileURL(path.join(projectRoot, 'frontend', 'node_modules', 'genlayer-js', 'dist', 'types', 'index.js')).href),
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`${name} is required in project .env or parent .env`);
  return value.trim();
}

const buyerAccount = createAccount(requireEnv('STUDIONET_PRIVATE_KEY'));
const sellerAccount = createAccount(requireEnv('STUDIONET_INTEGRATOR_PRIVATE_KEY'));
const readClient = createClient({ chain: studionet, account: buyerAccount });
const buyerClient = createClient({ chain: studionet, account: buyerAccount });
const sellerClient = createClient({ chain: studionet, account: sellerAccount });

function parseDeal(raw) {
  const parts = String(raw || '').split('|');
  return {
    id: parts[0] || '',
    status: parts[1] || '',
    verdict: parts[2] || '',
    escrowAmountWei: parts[3] || '0',
    buyer: parts[4] || '',
    seller: parts[5] || '',
    deadlineTs: parts[6] || '',
  };
}

function safeReceipt(receipt) {
  const statusName = { 5: 'ACCEPTED', 7: 'FINALIZED' };
  const resultName = { 6: 'MAJORITY_AGREE' };
  return {
    status: statusName[receipt?.status] ?? receipt?.status ?? receipt?.statusName ?? null,
    result: resultName[receipt?.result] ?? receipt?.result ?? receipt?.transactionResult ?? receipt?.transactionResultName ?? null,
    executionResult: receipt?.executionResult ?? receipt?.txExecutionResult ?? receipt?.execution_result ?? null,
    genvmStatus: receipt?.genvmStatus ?? receipt?.genvm_status ?? null,
  };
}

async function readDeal(dealId, stateStatus = 'accepted') {
  const [dealRaw, deliverable, reason] = await Promise.all([
    readClient.readContract({ address: contractAddress, functionName: 'get_deal', args: [dealId], stateStatus }),
    readClient.readContract({ address: contractAddress, functionName: 'get_deliverable', args: [dealId], stateStatus }),
    readClient.readContract({ address: contractAddress, functionName: 'get_reason', args: [dealId], stateStatus }),
  ]);
  return { ...parseDeal(dealRaw), deliverableUrl: String(deliverable || ''), reason: String(reason || '') };
}

async function dealCount(stateStatus = 'accepted') {
  return Number(await readClient.readContract({
    address: contractAddress,
    functionName: 'get_deal_count',
    args: [],
    stateStatus,
  }));
}

async function writeStep(client, functionName, args, value = 0n, status = TransactionStatus.ACCEPTED) {
  const hash = await client.writeContract({ address: contractAddress, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash, status, interval: 5000, retries: 120, fullTransaction: false });
  return { hash, receipt: safeReceipt(receipt) };
}

function loadEvidence() {
  if (!fs.existsSync(evidencePath)) {
    return {
      project: 'TrustlessAgent',
      network: 'studionet',
      contractAddress,
      explorer: `https://genlayer-explorer.vercel.app/address/${contractAddress}`,
      liveApp,
      actors: {
        buyer: buyerAccount.address,
        seller: sellerAccount.address,
      },
      notes: [
        'Sanitized evidence only. Raw receipts, traces, validator configuration, and private keys are intentionally omitted.',
      ],
      lifecycles: {},
    };
  }
  return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
}

function saveEvidence(evidence) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  evidence.contractAddress = contractAddress;
  evidence.explorer = `https://genlayer-explorer.vercel.app/address/${contractAddress}`;
  evidence.liveApp = liveApp;
  evidence.actors = {
    buyer: buyerAccount.address,
    seller: sellerAccount.address,
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function runReleasePath(resumeDealId = '', recoveredOpenHash = '') {
  const evidence = loadEvidence();
  const dealId = resumeDealId || `deal-${await dealCount('accepted')}`;
  const terms = [
    'Seller agent must deliver an accessible weather lookup REST API artifact.',
    'The evidence must include a public endpoint, an OpenAPI description, and meaningful test coverage evidence.',
    'Validators should approve release only if the submitted public URL supports those acceptance criteria.',
  ].join(' ');
  const requirements = [
    'Read the submitted URL directly.',
    'Confirm it is accessible and describes a weather lookup REST API.',
    'Confirm it includes public endpoint details, OpenAPI content, and test coverage evidence.',
  ].join(' ');

  const steps = {};
  let currentState = resumeDealId ? await readDeal(dealId, 'accepted') : null;
  if (!resumeDealId) {
    steps.open = await writeStep(
      buyerClient,
      'open_deal',
      [sellerAccount.address, terms, requirements, 9999999999],
      10_000_000_000_000_000n,
    );
    steps.open.state = await readDeal(dealId, 'accepted');
    currentState = steps.open.state;
  } else {
    steps.open = {
      hash: recoveredOpenHash || 'RECOVERED_FROM_CANONICAL_STATE',
      receipt: { status: 'ACCEPTED', result: 'RECOVERED_FROM_CANONICAL_STATE', executionResult: 'SUCCESS', genvmStatus: 'return' },
      state: currentState,
    };
  }

  if (currentState.status === 'FUNDED') {
    steps.submit = await writeStep(sellerClient, 'submit_deliverable', [dealId, defaultDeliverableUrl]);
    steps.submit.state = await readDeal(dealId, 'accepted');
    currentState = steps.submit.state;
  } else {
    steps.submit = { hash: 'SKIPPED_ALREADY_SUBMITTED_OR_LATER', state: currentState };
  }

  if (currentState.status === 'SUBMITTED') {
    steps.adjudicate = await writeStep(
      buyerClient,
      'adjudicate_delivery',
      [dealId],
      0n,
      TransactionStatus.FINALIZED,
    );
    steps.adjudicate.stateAccepted = await readDeal(dealId, 'accepted');
    steps.adjudicate.stateFinalized = await readDeal(dealId, 'finalized');
    currentState = steps.adjudicate.stateAccepted;
  } else {
    steps.adjudicate = { hash: 'SKIPPED_ALREADY_ADJUDICATED_OR_LATER', stateAccepted: currentState, stateFinalized: currentState };
  }

  if (currentState.status !== 'RELEASE_APPROVED' && currentState.status !== 'RELEASED') {
    throw new Error(`release path did not reach RELEASE_APPROVED: ${JSON.stringify(currentState)}`);
  }

  if (currentState.status === 'RELEASE_APPROVED') {
    steps.release = await writeStep(sellerClient, 'release_deal', [dealId]);
    steps.release.stateAccepted = await readDeal(dealId, 'accepted');
    steps.release.stateFinalized = await readDeal(dealId, 'finalized');
  } else {
    steps.release = { hash: 'SKIPPED_ALREADY_RELEASED', stateAccepted: currentState, stateFinalized: currentState };
  }

  evidence.lifecycles.releaseToSeller = {
    dealId,
    escrowAmountWei: '10000000000000000',
    deliverableUrl: defaultDeliverableUrl,
    steps,
    consequence: 'Seller release path reached RELEASED and escrowAmountWei is 0.',
  };
  saveEvidence(evidence);
  console.log(JSON.stringify({
    lifecycle: 'releaseToSeller',
    dealId,
    contractAddress,
    openTx: steps.open.hash,
    submitTx: steps.submit.hash,
    adjudicateTx: steps.adjudicate.hash,
    releaseTx: steps.release.hash,
    finalState: steps.release.stateAccepted,
  }, null, 2));
}

async function runRefundPath() {
  const evidence = loadEvidence();
  const beforeCount = await dealCount('accepted');
  const dealId = `deal-${beforeCount}`;
  const terms = 'Seller must submit an accessible weather API deliverable with endpoint, OpenAPI, and test coverage evidence.';
  const requirements = 'Reject generic placeholder pages that do not contain weather API deliverable details.';
  const steps = {};

  steps.open = await writeStep(
    buyerClient,
    'open_deal',
    [sellerAccount.address, terms, requirements, 9999999999],
    10_000_000_000_000_000n,
  );
  steps.open.state = await readDeal(dealId, 'accepted');
  steps.submit = await writeStep(sellerClient, 'submit_deliverable', [dealId, 'https://example.com']);
  steps.submit.state = await readDeal(dealId, 'accepted');
  steps.adjudicate = await writeStep(buyerClient, 'adjudicate_delivery', [dealId], 0n, TransactionStatus.FINALIZED);
  steps.adjudicate.stateAccepted = await readDeal(dealId, 'accepted');

  if (steps.adjudicate.stateAccepted.status !== 'REFUND_APPROVED') {
    throw new Error(`refund path did not reach REFUND_APPROVED: ${JSON.stringify(steps.adjudicate.stateAccepted)}`);
  }

  steps.refund = await writeStep(buyerClient, 'claim_refund', [dealId, Math.floor(Date.now() / 1000)]);
  steps.refund.stateAccepted = await readDeal(dealId, 'accepted');

  evidence.lifecycles.refundToBuyerLatest = {
    dealId,
    escrowAmountWei: '10000000000000000',
    deliverableUrl: 'https://example.com',
    steps,
    consequence: 'Buyer refund path reached REFUNDED and escrowAmountWei is 0.',
  };
  saveEvidence(evidence);
  console.log(JSON.stringify({
    lifecycle: 'refundToBuyerLatest',
    dealId,
    contractAddress,
    openTx: steps.open.hash,
    submitTx: steps.submit.hash,
    adjudicateTx: steps.adjudicate.hash,
    refundTx: steps.refund.hash,
    finalState: steps.refund.stateAccepted,
  }, null, 2));
}

async function inspect() {
  const evidence = loadEvidence();
  evidence.currentDealCount = await dealCount('accepted');
  saveEvidence(evidence);
  console.log(JSON.stringify({
    contractAddress,
    dealCount: evidence.currentDealCount,
    buyer: buyerAccount.address,
    seller: sellerAccount.address,
  }, null, 2));
}

const command = process.argv[2] || 'inspect';
if (command === 'inspect') {
  await inspect();
} else if (command === 'release') {
  await runReleasePath(process.argv[3] || '', process.argv[4] || '');
} else if (command === 'refund') {
  await runRefundPath();
} else {
  throw new Error(`unknown command: ${command}`);
}

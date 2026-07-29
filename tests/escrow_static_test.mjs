import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const contractPath = path.join(root, 'contracts', 'AgentDeliverableEscrow.py');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.ok(fs.existsSync(contractPath), 'contracts/AgentDeliverableEscrow.py must exist');

const contract = fs.readFileSync(contractPath, 'utf8');
const frontend = read('frontend/src/App.jsx') + '\n' + read('frontend/src/genlayer.js');
const appCssPath = path.join(root, 'frontend', 'src', 'App.css');
const readme = read('README.md');
const deliverablePath = path.join(root, 'frontend', 'public', 'weather-agent-deliverable.txt');
const lifecycleScriptPath = path.join(root, 'scripts', 'studionet_lifecycle.mjs');
const evidencePath = path.join(root, 'docs', 'evidence', 'studionet', 'deployment.json');

for (const forbidden of ['DisasterOracle', 'ReliefRegistry', 'PledgeVault', 'disaster', 'relief', 'pledge']) {
  assert.equal(contract.includes(forbidden), false, `contract must not contain old ${forbidden} domain`);
}

for (const required of [
  'buyer:',
  'seller:',
  'terms:',
  'deliverable_urls:',
  'escrow_amount:',
  'release_deal',
  'claim_refund',
  'submit_deliverable',
  'adjudicate_delivery',
]) {
  assert.ok(contract.includes(required), `contract must define ${required}`);
}

assert.match(contract, /@gl\.public\.write\.payable\s+def open_deal/, 'open_deal must be payable');
assert.ok(contract.includes('seller = Address(seller_address)'), 'open_deal must normalize seller address before storage');
assert.ok(contract.includes('gl.message.value'), 'open_deal must custody the caller value');
assert.ok(contract.includes('gl.message.sender_address'), 'contract must use sender_address for Address storage');
assert.equal(contract.includes('gl.message.sender\\n'), false, 'contract must not fall back to string sender for Address storage');
assert.ok(contract.includes('emit_transfer'), 'release/refund must emit a native GEN transfer');
assert.ok(contract.includes('DELIVERED') && contract.includes('FAILED') && contract.includes('INSUFFICIENT'), 'verdict enum must cover delivered/failed/insufficient');
assert.ok(contract.includes('validator_fn') && contract.includes('leader_fn'), 'adjudication must use leader/validator nondet consensus');

for (const required of ['open_deal', 'submit_deliverable', 'adjudicate_delivery', 'release_deal', 'claim_refund', 'get_deal']) {
  assert.ok(frontend.includes(required), `frontend must call/read ${required}`);
}

for (const required of [
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'studionet.id',
  'TransactionStatus.FINALIZED',
  'Recent wallet activity',
  'Canonical state from GenLayer',
  'roleReason',
  'canRelease',
  'canRefund',
  'Trust Boundary',
]) {
  assert.ok(frontend.includes(required), `frontend must include Projects-track UI behavior: ${required}`);
}

assert.ok(fs.existsSync(appCssPath), 'frontend must have a dedicated polished app stylesheet');
const appCss = fs.readFileSync(appCssPath, 'utf8');
for (const required of ['.app-shell', '.sidebar', '.metric-grid', '.deal-console', '.timeline', '@media (max-width: 760px)', 'prefers-reduced-motion']) {
  assert.ok(appCss.includes(required), `App.css must include ${required}`);
}

for (const forbidden of ['142', 'DEAL-892A', '0.5 ETH', 'Force Refund', 'TechCorp Inc.']) {
  assert.equal(frontend.includes(forbidden), false, `frontend must not ship Stitch mock data: ${forbidden}`);
}

for (const forbidden of ['PLEDGE_VAULT', 'create_pledge', 'trigger_verification', 'set_trusted_org']) {
  assert.equal(frontend.includes(forbidden), false, `frontend must not use old ${forbidden} API`);
}

assert.ok(readme.includes('buyer') && readme.includes('seller') && readme.includes('escrow funding'), 'README must describe buyer/seller/funding');
assert.ok(readme.includes('release') && readme.includes('refund'), 'README must describe release/refund workflow');

assert.ok(fs.existsSync(deliverablePath), 'frontend must publish a concrete deliverable evidence artifact');
const deliverable = fs.readFileSync(deliverablePath, 'utf8');
for (const phrase of ['WeatherAgent REST Deliverable', 'public endpoint', 'OpenAPI', 'test coverage', 'acceptance criteria']) {
  assert.ok(deliverable.includes(phrase), `deliverable artifact must include ${phrase}`);
}

assert.ok(fs.existsSync(lifecycleScriptPath), 'Studionet lifecycle script must exist');
const lifecycleScript = fs.readFileSync(lifecycleScriptPath, 'utf8');
for (const phrase of ['safeReceipt', 'open_deal', 'submit_deliverable', 'adjudicate_delivery', 'release_deal', 'claim_refund', 'resumeDealId', 'retries: 120']) {
  assert.ok(lifecycleScript.includes(phrase), `lifecycle script must include ${phrase}`);
}

assert.ok(fs.existsSync(evidencePath), 'sanitized Studionet deployment evidence must exist');
const evidence = fs.readFileSync(evidencePath, 'utf8');
for (const forbidden of ['private_key', 'node_config', 'mnemonic', 'STUDIONET_PRIVATE_KEY']) {
  assert.equal(evidence.includes(forbidden), false, `evidence must not contain ${forbidden}`);
}

console.log('escrow static checks passed');

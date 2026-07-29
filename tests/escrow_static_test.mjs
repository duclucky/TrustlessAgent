import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const contractPath = path.join(root, 'contracts', 'AgentDeliverableEscrow.py');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

assert.ok(fs.existsSync(contractPath), 'contracts/AgentDeliverableEscrow.py must exist');

const contract = fs.readFileSync(contractPath, 'utf8');
const frontend = read('frontend/src/App.jsx') + '\n' + read('frontend/src/genlayer.js');
const readme = read('README.md');

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
assert.ok(contract.includes('gl.message.value'), 'open_deal must custody the caller value');
assert.ok(contract.includes('emit_transfer'), 'release/refund must emit a native GEN transfer');
assert.ok(contract.includes('DELIVERED') && contract.includes('FAILED') && contract.includes('INSUFFICIENT'), 'verdict enum must cover delivered/failed/insufficient');
assert.ok(contract.includes('validator_fn') && contract.includes('leader_fn'), 'adjudication must use leader/validator nondet consensus');

for (const required of ['open_deal', 'submit_deliverable', 'adjudicate_delivery', 'release_deal', 'claim_refund', 'get_deal']) {
  assert.ok(frontend.includes(required), `frontend must call/read ${required}`);
}

for (const forbidden of ['PLEDGE_VAULT', 'create_pledge', 'trigger_verification', 'set_trusted_org']) {
  assert.equal(frontend.includes(forbidden), false, `frontend must not use old ${forbidden} API`);
}

assert.ok(readme.includes('buyer') && readme.includes('seller') && readme.includes('escrow funding'), 'README must describe buyer/seller/funding');
assert.ok(readme.includes('release') && readme.includes('refund'), 'README must describe release/refund workflow');

console.log('escrow static checks passed');

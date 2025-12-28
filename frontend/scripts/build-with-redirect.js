#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🚀 Building frontend for deployment...\n');

// Read deployments.json to verify it exists
const deploymentsPath = path.join(__dirname, '../../deployments.json');
if (!fs.existsSync(deploymentsPath)) {
  console.error('❌ deployments.json not found!');
  console.log('   Location expected: ' + deploymentsPath);
  console.log('\n💡 Please deploy contracts first:');
  console.log('   cd contracts && npm run deploy');
  process.exit(1);
}

const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));

// Get default deployment (first network or specified via env)
const networkName = process.env.DEPLOY_NETWORK || Object.keys(deployments)[0];
const deployment = deployments[networkName];

if (!deployment) {
  console.error(`❌ No deployment found for network: ${networkName}`);
  console.log('\nAvailable networks in deployments.json:');
  Object.keys(deployments).forEach(net => {
    console.log(`   - ${net}`);
  });
  process.exit(1);
}

if (!deployment.channelRegistry) {
  console.error(`❌ No channelRegistry address found for network: ${networkName}`);
  console.log('   Deployment data:', JSON.stringify(deployment, null, 2));
  process.exit(1);
}

console.log(`🔧 Configuration:`);
console.log(`   Network: ${deployment.network}`);
console.log(`   Chain ID: ${deployment.chainId}`);
console.log(`   Registry: ${deployment.channelRegistry}`);

// Run build
console.log('\n📦 Building frontend...');
try {
  execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
} catch (error) {
  console.error('\n❌ Build failed!');
  process.exit(1);
}

const distPath = path.join(__dirname, '../dist');
console.log('\n✅ Build complete!');
console.log(`   Output: ${distPath}`);
console.log(`\n🌐 Test locally:`);
console.log(`   npx serve dist`);
console.log('   Then visit: http://localhost:3000\n');

import fs from 'fs';
import path from 'path';
import { stringify } from 'yaml';
import { chainMetadata, hyperlaneContractAddresses } from '@hyperlane-xyz/sdk';

const LOGO_DIR_PATH = path.join('./node_modules/@hyperlane-xyz/sdk/logos/color');
const CHAIN_SCHEMA_REF = '# yaml-language-server: $schema=../schema.json';

console.log('Migrating chain data from SDK');

Object.entries(chainMetadata).forEach(([name, metadata]) => {
  if (name.startsWith('test')) return;

  const chainDir = path.join('./chains', name);
  if (!fs.existsSync(chainDir)) fs.mkdirSync(chainDir, { recursive: true });

  // Write metadata.yaml
  const metaYaml = `${CHAIN_SCHEMA_REF}\n${stringify(metadata, { indent: 2 })}`;
  fs.writeFileSync(path.join(chainDir, 'metadata.yaml'), metaYaml, 'utf8');

  // Write addresses.yaml if addresses exist
  const addresses = hyperlaneContractAddresses[name];
  if (addresses) {
    const addrYaml = stringify(addresses, { indent: 2 });
    fs.writeFileSync(path.join(chainDir, 'addresses.yaml'), addrYaml);
  } else {
    console.warn(`No addresses found for chain ${name}`);
  }

  // Copy logo.svg if it exists
  const logoPath = path.join(LOGO_DIR_PATH, `${name}.svg`);
  const logoDestPath = path.join(chainDir, 'logo.svg');
  if (fs.existsSync(logoPath)) {
    fs.copyFileSync(logoPath, logoDestPath);
  }
});

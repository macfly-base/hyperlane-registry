import { ChainMetadataSchemaObject, WarpCoreConfigSchema } from '@hyperlane-xyz/sdk';
import fs from 'fs/promises'; // Utilisation de la version asynchrone
import path from 'path';
import { parse, stringify } from 'yaml';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { warpRouteConfigToId } from '../src/registry/warp-utils';

const chainMetadata: Record<string, any> = {};
const chainAddresses: Record<string, any> = {};
const warpRouteConfigs: Record<string, any> = {};

// Logger helper function
function logStatus(message: string) {
  console.log(`[Status]: ${message}`);
}

// Error handler
function handleError(error: any) {
  console.error(`[Error]: ${error.message || error}`);
  process.exit(1); // Exit with error
}

// Async file write with logging
async function writeFileSafe(filePath: string, data: string | Buffer, format = 'utf8') {
  try {
    await fs.writeFile(filePath, data, format);
    logStatus(`Written file: ${filePath}`);
  } catch (error) {
    handleError(error);
  }
}

// Async copy with logging
async function copyFileSafe(src: string, dest: string) {
  try {
    await fs.copyFile(src, dest);
    logStatus(`Copied file: ${src} to ${dest}`);
  } catch (error) {
    handleError(error);
  }
}

// Generate JS export from data
function genJsExport(data: any, exportName: string) {
  return `export const ${exportName} = ${JSON.stringify(data, null, 2)};`;
}

// Generate chain metadata export
function genChainMetadataExport(data: any, exportName: string) {
  return `import type { ChainMetadata } from '@hyperlane-xyz/sdk';\n${genJsExport(data, exportName)} as ChainMetadata;`;
}

// Generate warp route config export
function genWarpRouteConfigExport(data: any, exportName: string) {
  return `import type { WarpCoreConfig } from '@hyperlane-xyz/sdk';\n${genJsExport(data, exportName)} as WarpCoreConfig;`;
}

// Create directories safely
async function createDirSafe(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    logStatus(`Directory created: ${dirPath}`);
  } catch (error) {
    handleError(error);
  }
}

// Create temporary working directory
async function createTmpDir() {
  logStatus('Preparing tmp directory');
  try {
    const tmpPath = './tmp';
    await fs.rm(tmpPath, { recursive: true, force: true });
    await fs.cp('./src', tmpPath, { recursive: true });
  } catch (error) {
    handleError(error);
  }
}

// Process chain files
async function createChainFiles() {
  logStatus('Parsing and copying chain data');
  const chainDir = './chains';
  const distChainDir = './dist/chains';
  const tmpChainDir = './tmp/chains';

  const chainFiles = await fs.readdir(chainDir);

  for (const file of chainFiles) {
    const inDirPath = path.join(chainDir, file);
    const assetOutPath = path.join(distChainDir, file);
    const tsOutPath = path.join(tmpChainDir, file);

    const stat = await fs.stat(inDirPath);
    if (!stat.isDirectory()) continue;

    const metadata = parse(await fs.readFile(path.join(inDirPath, 'metadata.yaml'), 'utf8'));
    chainMetadata[metadata.name] = metadata;

    await createDirSafe(assetOutPath);
    await createDirSafe(tsOutPath);

    await copyFileSafe(path.join(inDirPath, 'metadata.yaml'), path.join(assetOutPath, 'metadata.yaml'));
    await writeFileSafe(path.join(assetOutPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
    await writeFileSafe(path.join(tsOutPath, 'metadata.ts'), genChainMetadataExport(metadata, 'metadata'));

    // Copy addresses if exists
    const addressesPath = path.join(inDirPath, 'addresses.yaml');
    if (await fs.stat(addressesPath).catch(() => false)) {
      const addresses = parse(await fs.readFile(addressesPath, 'utf8'));
      chainAddresses[metadata.name] = addresses;
      await copyFileSafe(addressesPath, path.join(assetOutPath, 'addresses.yaml'));
      await writeFileSafe(path.join(assetOutPath, 'addresses.json'), JSON.stringify(addresses, null, 2));
      await writeFileSafe(path.join(tsOutPath, 'addresses.ts'), genJsExport(addresses, 'addresses'));
    }

    // Copy logo file
    await copyFileSafe(path.join(inDirPath, 'logo.svg'), path.join(assetOutPath, 'logo.svg'));
  }
}

// Update combined metadata and addresses
async function updateCombinedChainFiles() {
  logStatus('Updating combined chain metadata and addresses files');
  const AUTO_GEN_PREFIX = '# AUTO-GENERATED; DO NOT EDIT MANUALLY';
  const combinedMetadata = stringify(chainMetadata, { sortMapEntries: true });
  const combinedAddresses = stringify(chainAddresses, { sortMapEntries: true });
  
  await writeFileSafe('./chains/metadata.yaml', `${AUTO_GEN_PREFIX}\n${combinedMetadata}`);
  await writeFileSafe('./chains/addresses.yaml', `${AUTO_GEN_PREFIX}\n${combinedAddresses}`);
}

// More functions...

// Main function to handle the build process
async function main() {
  try {
    await createTmpDir();
    await createChainFiles();
    await updateCombinedChainFiles();
    // Other steps...
    logStatus('Build process completed successfully.');
  } catch (error) {
    handleError(error);
  }
}

main();

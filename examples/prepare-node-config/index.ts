import { writeFile } from 'fs/promises';
import { Chain, createPublicClient, http, defineChain } from 'viem';
// import {   baseSepolia } from 'viem/chains';
import {
  ChainConfig,
  PrepareNodeConfigParams,
  createRollupPrepareTransaction,
  createRollupPrepareTransactionReceipt,
  prepareNodeConfig,
} from '@arbitrum/orbit-sdk';
import { getParentChainLayer } from '@arbitrum/orbit-sdk/utils';
import { config } from 'dotenv';
config();

const baseSepolia = /*#__PURE__*/ defineChain(
  {
    id: 84532,
    network: 'base-sepolia',
    name: 'Base Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      alchemy: {
        http: ['https://base-sepolia.g.alchemy.com/v2'],
        webSocket: ['wss://base-sepolia.g.alchemy.com/v2'],
      },
      default: {
        http: ['https://sepolia.base.org'],
      },
      public: {
        http: ['https://sepolia.base.org'],
      },
    },
    blockExplorers: {
      blockscout: {
        name: 'Blockscout',
        url: 'https://base-sepolia.blockscout.com',
      },
      default: {
        name: 'Blockscout',
        url: 'https://base-sepolia.blockscout.com',
      },
    },
    contracts: {
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11',
        blockCreated:11846544,
      },
    },
    testnet: true,
  
  },
  
)

function getRpcUrl(chain: Chain) {
  return chain.rpcUrls.default.http[0];
}

if (typeof process.env.ORBIT_DEPLOYMENT_TRANSACTION_HASH === 'undefined') {
  throw new Error(`Please provide the "ORBIT_DEPLOYMENT_TRANSACTION_HASH" environment variable`);
}

if (typeof process.env.BATCH_POSTER_PRIVATE_KEY === 'undefined') {
  throw new Error(`Please provide the "BATCH_POSTER_PRIVATE_KEY" environment variable`);
}

if (typeof process.env.VALIDATOR_PRIVATE_KEY === 'undefined') {
  throw new Error(`Please provide the "VALIDATOR_PRIVATE_KEY" environment variable`);
}

if (typeof process.env.PARENT_CHAIN_RPC === 'undefined' || process.env.PARENT_CHAIN_RPC === '') {
  console.warn(
    `Warning: you may encounter timeout errors while running the script with the default rpc endpoint. Please provide the "PARENT_CHAIN_RPC" environment variable instead.`,
  );
}

// set the parent chain and create a public client for it
const parentChain = baseSepolia;
const parentChainPublicClient = createPublicClient({
  chain: parentChain,
  transport: http(process.env.PARENT_CHAIN_RPC),
});

if (
  getParentChainLayer(parentChainPublicClient.chain.id) == 1 &&
  typeof process.env.ETHEREUM_BEACON_RPC_URL === 'undefined'
) {
  throw new Error(
    `Please provide the "ETHEREUM_BEACON_RPC_URL" environment variable necessary for L2 Orbit chains`,
  );
}

async function main() {
  // tx hash for the transaction to create rollup
  const txHash = process.env.ORBIT_DEPLOYMENT_TRANSACTION_HASH as `0x${string}`;

  // get the transaction
  const tx = createRollupPrepareTransaction(
    await parentChainPublicClient.getTransaction({ hash: txHash }),
  );

  // get the transaction receipt
  const txReceipt = createRollupPrepareTransactionReceipt(
    await parentChainPublicClient.getTransactionReceipt({ hash: txHash }),
  );

  // get the chain config from the transaction inputs
  const chainConfig: ChainConfig = JSON.parse(tx.getInputs()[0].config.chainConfig);
  // get the core contracts from the transaction receipt
  const coreContracts = txReceipt.getCoreContracts();

  // prepare the node config
  const nodeConfigParameters: PrepareNodeConfigParams = {
    chainName: 'Complare chain',
    chainConfig,
    coreContracts,
    batchPosterPrivateKey: process.env.BATCH_POSTER_PRIVATE_KEY as `0x${string}`,
    validatorPrivateKey: process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`,
    parentChainId: parentChain.id,
    parentChainRpcUrl: getRpcUrl(parentChain),
  };

  // For L2 Orbit chains settling to Ethereum mainnet or testnet
  if (getParentChainLayer(parentChainPublicClient.chain.id) === 1) {
    nodeConfigParameters.parentChainBeaconRpcUrl = process.env.ETHEREUM_BEACON_RPC_URL;
  }

  const nodeConfig = prepareNodeConfig(nodeConfigParameters);

  await writeFile('node-config.json', JSON.stringify(nodeConfig, null, 2));
  console.log(`Node config written to "node-config.json"`);
  console.log("txHash", txHash , "\n");
  console.log("tx", tx , "\n");
  console.log("txReceipt", txReceipt , "\n");
  console.log("nodeConfigParameters", nodeConfigParameters , "\n");
  console.log("coreContracts", coreContracts , "\n");
  console.log("chainConfig", chainConfig , "\n");
}

main();

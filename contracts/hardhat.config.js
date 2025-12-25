import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import { Mnemonic, HDNodeWallet } from "ethers";

dotenv.config();

// Function to get accounts from seed phrase or private key
function getAccounts() {
  if (process.env.SEED_PHRASE) {
    // Derive private key from seed phrase
    const mnemonic = Mnemonic.fromPhrase(process.env.SEED_PHRASE);
    const wallet = HDNodeWallet.fromMnemonic(mnemonic);
    return [wallet.privateKey];
  } else if (process.env.PRIVATE_KEY) {
    // Use private key directly
    return [`0x${process.env.PRIVATE_KEY.replace(/^0x/, '')}`];
  }
  return [];
}

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    polkadotAssetHub: {
      url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
      chainId: 420420422,
      accounts: getAccounts()
    }
  }
};

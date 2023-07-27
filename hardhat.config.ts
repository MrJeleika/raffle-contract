import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import dotenv from 'dotenv';
dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.18',
  gasReporter: {
    currency: 'USD',
    gasPrice: 21,
    enabled: true,
  },
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: `https://mainnet.infura.io/v3/${process.env.KEY}`,
      },
      chainId: 1,
    },
  },
};

export default config;

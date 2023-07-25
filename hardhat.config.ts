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
        url: `https://goerli.infura.io/v3/19babb07c31c4e1c80f9e94f20527f6a`,
      },
      chainId: 5,
    },
  },
};

export default config;

import { keccak256 } from 'ethereumjs-util';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { parseEther, parseUnits, solidityPacked } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { Raffle } from '../typechain-types';

const usdtTokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const maticTokenAddress = '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0';
const wethTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

async function main() {
  const selectWinner = async (raffle: Raffle) => {
    await raffle.selectRandomNum();
    const randomNum = await raffle.randomNum();
    const users = await raffle.getPoolUsers();
    for (let i = 0; i < users.length; i++) {
      if (users[i][0] < randomNum && users[i][1] >= randomNum) {
        await raffle.selectWinner(i, randomNum);
        break;
      }
    }
  };

  const deployRaffleTexture = async () => {
    const [owner, user] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory('VRFMock');
    const mock = await Mock.connect(owner).deploy();
    await mock.createSubscription();
    await mock.fundSubscription(1, BigInt('10000000000000000000'));

    const Consumer = await ethers.getContractFactory('VRFv2Consumer');
    const consumer = await Consumer.connect(owner).deploy(
      1,
      await mock.getAddress(),
      '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
    );

    const DataPrice = await ethers.getContractFactory('DataConsumerV3');
    const dataPrice = await DataPrice.deploy();

    const Swap = await ethers.getContractFactory('Swap');
    const swap = await Swap.deploy(
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    );

    const Raffle = await ethers.getContractFactory('Raffle');
    const raffle = await Raffle.connect(owner).deploy(
      await consumer.getAddress(),
      await mock.getAddress(),
      await dataPrice.getAddress(),
      await swap.getAddress(),
    );

    await mock.addConsumer(1, await consumer.getAddress());
    await mock.addConsumer(1, await raffle.getAddress());
    const USDT = await ethers.getContractAt('ERC20', usdtTokenAddress);
    const MATIC = await ethers.getContractAt('ERC20', maticTokenAddress);
    const WETH = await ethers.getContractAt('ERC20', wethTokenAddress);

    return { owner, user, raffle, swap, USDT, MATIC, WETH };
  };
  const { owner, user, raffle, swap, USDT, MATIC } = await loadFixture(
    deployRaffleTexture,
  );

  await raffle.allowToken(
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
  );

  console.log(await raffle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

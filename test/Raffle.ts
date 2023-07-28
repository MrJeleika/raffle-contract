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

describe('Raffle', async () => {
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
  describe('allow token', async () => {
    it('should allow token', async () => {
      const { owner, user, raffle, swap, USDT } = await loadFixture(
        deployRaffleTexture,
      );

      await raffle.allowToken(
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      );
      expect(
        await raffle.tokenFeed('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
      ).to.eq('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });
  });
  describe('deposit', async () => {
    describe('revert', async () => {
      it('should revert on small token balance', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture,
        );
        await expect(
          raffle.deposit(5, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
        ).to.be.revertedWith('Not enough tokens');
      });
      it('should revert on not allowed token', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture,
        );

        await expect(
          raffle.deposit(5, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
        ).to.be.revertedWith('Token is not allowed');
      });
      it('should revert on amount 0', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture,
        );

        await expect(raffle.deposit(0, usdtTokenAddress)).to.be.revertedWith(
          'Amount == 0',
        );
      });
    });
    describe('Working', async () => {
      it('should change user/contract token balance', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture,
        );
        const initialUserBalance = await USDT.balanceOf(owner.address);
        const initialContractBalance = await USDT.balanceOf(
          await raffle.getAddress(),
        );
        await USDT.approve(await raffle.getAddress(), 50 * 10 ** 6);
        await raffle.deposit(50 * 10 ** 6, usdtTokenAddress);

        console.log(await raffle.totalPoolBalance());

        expect(await USDT.balanceOf(owner.address)).to.be.lt(
          initialUserBalance,
        );
        expect(await USDT.balanceOf(await raffle.getAddress())).to.be.gt(
          initialContractBalance,
        );
      });
      it('should add user to users pool', async () => {
        const { owner, user, raffle, swap, MATIC } = await loadFixture(
          deployRaffleTexture,
        );
        await MATIC.approve(await raffle.getAddress(), parseEther('50'));
        await raffle.deposit(parseEther('50'), maticTokenAddress);
        console.log(await raffle.totalPoolBalance());
        const users = await raffle.getPoolUsers();
        expect(users[0][2]).to.eq(owner.address);
      });
    });
  });
  describe('Select winner', async () => {
    it('Should revert tx on fake random number', async () => {
      const { owner, user, raffle, swap, MATIC, WETH } = await loadFixture(
        deployRaffleTexture,
      );
      await MATIC.approve(await raffle.getAddress(), parseEther('50'));
      await MATIC.approve(await swap.getAddress(), parseEther('50'));
      await raffle.deposit(parseEther('50'), maticTokenAddress);
      await raffle.selectRandomNum();
      await expect(raffle.selectWinner(0, 5)).to.be.revertedWith(
        'Wrong winner',
      );
    });
    it('Should select winner', async () => {
      const { owner, user, raffle, swap, MATIC, WETH } = await loadFixture(
        deployRaffleTexture,
      );
      await MATIC.approve(await raffle.getAddress(), parseEther('100'));
      await MATIC.approve(await swap.getAddress(), parseEther('100'));
      await raffle.deposit(parseEther('100'), maticTokenAddress);
      const initialBalance = await WETH.balanceOf(owner.address);
      console.log(initialBalance);

      await selectWinner(raffle);

      console.log(await WETH.balanceOf(owner.address));

      expect(initialBalance).to.be.lt(await WETH.balanceOf(owner.address));
    });
  });
});

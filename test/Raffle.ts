import { keccak256 } from 'ethereumjs-util';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { AbiCoder, parseEther, parseUnits, solidityPacked } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { Raffle } from '../typechain-types';

const usdtTokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const maticTokenAddress = '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0';
const wethTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const usdcTokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('Raffle', async () => {
  const selectWinner = async (raffle: Raffle) => {
    const winningToken = await raffle.winningToken();
    const users = await raffle.getPoolUsers();
    const poolBalance = await raffle.playedTokensBalance(winningToken);
    const randomNum = (await raffle.randomNum()) % poolBalance;
    console.log(randomNum);

    for (let i = 0; i < users.length; i++) {
      console.log(users[i]);

      if (
        users[i][0] < randomNum &&
        users[i][1] >= randomNum &&
        users[i][3] == winningToken
      ) {
        console.log(winningToken);
        await raffle.selectWinner2(randomNum, winningToken, i);
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
      '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc'
    );

    const DataPrice = await ethers.getContractFactory('DataConsumerV3');
    const dataPrice = await DataPrice.deploy();

    const Swap = await ethers.getContractFactory('Swap');
    const swap = await Swap.deploy(
      '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    );

    const Raffle = await ethers.getContractFactory('Raffle');
    const raffle = await Raffle.connect(owner).deploy(
      await consumer.getAddress(),
      await mock.getAddress(),
      await dataPrice.getAddress(),
      await swap.getAddress()
    );

    await mock.addConsumer(1, await consumer.getAddress());
    await mock.addConsumer(1, await raffle.getAddress());
    const USDT = await ethers.getContractAt('ERC20', usdtTokenAddress);
    const MATIC = await ethers.getContractAt('ERC20', maticTokenAddress);
    const WETH = await ethers.getContractAt('ERC20', wethTokenAddress);
    const USDC = await ethers.getContractAt('ERC20', usdcTokenAddress);

    return { owner, user, raffle, swap, USDT, MATIC, WETH, USDC };
  };
  describe('allow token', async () => {
    it('should allow token', async () => {
      const { owner, user, raffle, swap, USDT } = await loadFixture(
        deployRaffleTexture
      );

      await raffle.allowToken(
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      );
      expect(
        await raffle.tokenFeed('0xdAC17F958D2ee523a2206206994597C13D831ec7')
      ).to.eq('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });
  });
  describe('deposit', async () => {
    describe('revert', async () => {
      it('should revert on small token balance', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture
        );
        await expect(
          raffle.deposit(5, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
        ).to.be.revertedWith('Not enough tokens');
      });
      it('should revert on not allowed token', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture
        );

        await expect(
          raffle.deposit(5, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
        ).to.be.revertedWith('Token is not allowed');
      });
      it('should revert on amount 0', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture
        );

        await expect(raffle.deposit(0, usdtTokenAddress)).to.be.revertedWith(
          'Amount == 0'
        );
      });
    });
    describe('Working', async () => {
      it('should change user/contract token balance', async () => {
        const { owner, user, raffle, swap, USDT } = await loadFixture(
          deployRaffleTexture
        );
        const initialUserBalance = await USDT.balanceOf(owner.address);
        const initialContractBalance = await USDT.balanceOf(
          await raffle.getAddress()
        );
        await USDT.approve(await raffle.getAddress(), 500 * 10 ** 6);
        await raffle.deposit(50 * 10 ** 6, usdtTokenAddress);

        console.log(await raffle.totalPoolBalance());
        await raffle.deposit(50 * 10 ** 6, usdtTokenAddress);

        expect(await USDT.balanceOf(owner.address)).to.be.lt(
          initialUserBalance
        );
        expect(await USDT.balanceOf(await raffle.getAddress())).to.be.gt(
          initialContractBalance
        );
      });
      it('should select winner address', async () => {
        const { owner, user, raffle, swap, USDT, WETH } = await loadFixture(
          deployRaffleTexture
        );

        await USDT.approve(await raffle.getAddress(), 5000 * 10 ** 6);
        await raffle.deposit(50 * 10 ** 6, usdtTokenAddress);
        await raffle.deposit(50 * 10 ** 6, usdtTokenAddress);
        await raffle.deposit(500 * 10 ** 6, usdtTokenAddress);
        await raffle.selectWinner();
        await selectWinner(raffle);
        expect(await WETH.balanceOf(owner.address)).to.be.gt(0);
      });
      it.only('Should permit', async () => {
        const { owner, user, raffle, swap, USDT, USDC } = await loadFixture(
          deployRaffleTexture
        );
        const chainId = 1; // Replace with your chain ID
        const name = await USDC.name(); // Replace with your token's name
        const verifyingContract = await USDC.getAddress(); // Replace with your token's contract address

        // Define the typed data
        const domain = {
          name: name,
          version: '2',
          chainId: chainId,
          verifyingContract: verifyingContract,
        };

        const Permit = [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'value', type: 'uint256' },
        ];

        const EIP712Domain = [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ];

        const transactionDeadline = Math.floor(Date.now() / 1000) + 20 * 60; // Convert to seconds

        const message = {
          owner: owner.address,
          spender: await raffle.getAddress(), // address of the smart contract that you want to allow
          value: 400000, // value in case of ERC20
          nonce: '1',
          deadline: transactionDeadline, // permit for 20 minutes only
        };

        const data = JSON.stringify({
          types: {
            EIP712Domain,
            Permit,
          },
          domain,
          primaryType: 'Permit',
          message,
        });

        // Sign the typed data
        const signature = await owner.signMessage(data);

        const splitSig = (sig: string) => {
          // Split the signature into r, s, and v values.
          const r = '0x' + sig.slice(2, 66);
          const s = '0x' + sig.slice(66, 130);
          const v = parseInt(sig.slice(130, 132), 16);

          return {
            r,
            s,
            v,
          };
        };

        const { v, r, s } = splitSig(signature);

        await raffle.checkSignature(
          400000,
          verifyingContract,
          transactionDeadline,
          v,
          r,
          s
        );

        console.log(
          await USDC.allowance(owner.address, await raffle.getAddress())
        );

        async function signPermit(
          tokenAddress: string,
          value: number,
          nonce: number,
          deadline: number
        ) {
          // Define the EIP-712 domain separator
          const domainSeparator = await myToken.DOMAIN_SEPARATOR();

          // Create the permit data struct
          const permitData = {
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            primaryType: 'Permit',
            domain: {
              name: 'MyToken',
              version: '1',
              chainId: 1, // Replace with the correct chainId
              verifyingContract: tokenAddress,
            },
            message: {
              owner: owner.address,
              spender: await raffle.getAddress(), // Typically, the owner and spender are the same for permit
              value: value,
              nonce: nonce,
              deadline: deadline,
            },
          };

          const abiCoder = new AbiCoder();

          // Sign the permit
          const signature = await owner.signMessage(
            ethers.utils.arrayify(
              ethers.keccak256(
                abiCoder.encode(permitData.types.Permit, permitData.message)
              )
            )
          );

          // Split the signature into r, s, and v
          const sig = ethers.utils.splitSignature(signature);

          return {
            v: sig.v,
            r: sig.r,
            s: sig.s,
          };
        }
      });
    });
  });
  // describe('Select winner', async () => {
  //   it('Should revert tx on fake random number', async () => {
  //     const { owner, user, raffle, swap, MATIC, WETH } = await loadFixture(
  //       deployRaffleTexture,
  //     );
  //     await MATIC.approve(await raffle.getAddress(), parseEther('50'));
  //     await MATIC.approve(await swap.getAddress(), parseEther('50'));
  //     await raffle.deposit(parseEther('50'), maticTokenAddress);
  //     await raffle.selectRandomNum();
  //     await expect(raffle.selectWinner(0, 5)).to.be.revertedWith(
  //       'Wrong winner',
  //     );
  //   });
  //   it('Should select winner', async () => {
  //     const { owner, user, raffle, swap, MATIC, WETH } = await loadFixture(
  //       deployRaffleTexture,
  //     );
  //     await MATIC.approve(await raffle.getAddress(), parseEther('100'));
  //     await MATIC.approve(await swap.getAddress(), parseEther('100'));
  //     await raffle.deposit(parseEther('100'), maticTokenAddress);
  //     const initialBalance = await WETH.balanceOf(owner.address);
  //     console.log(initialBalance);

  //     await selectWinner(raffle);

  //     console.log(await WETH.balanceOf(owner.address));

  //     expect(initialBalance).to.be.lt(await WETH.balanceOf(owner.address));
  //   });
  // });
});

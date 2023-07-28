import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { parseEther, parseUnits } from 'ethers';
import { ethers } from 'hardhat';

const usdtTokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

async function main() {
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

    return { owner, user, raffle, swap };
  };
  const { owner, user, raffle, swap } = await loadFixture(deployRaffleTexture);

  const USDT = await ethers.getContractAt('ERC20', usdtTokenAddress);

  console.log(await ethers.provider.getBalance(owner.address));
  console.log(await USDT.balanceOf(owner.address));

  // Get the balance of the owner's address

  await USDT.approve(await swap.getAddress(), parseUnits('1000'));
  await USDT.approve(await raffle.getAddress(), parseUnits('1000'));

  await raffle.deposit(parseUnits('1000'), await USDT.getAddress());

  console.log(await USDT.balanceOf(owner.address));
  await raffle.selectRandomNum();

  // console.log(await raffle.getAddress());
  // const res = await raffle.selectRandomWord(
  //   '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
  // );
  // console.log(res);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

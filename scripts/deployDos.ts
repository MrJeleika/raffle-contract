import { ethers } from 'hardhat';

const usdtTokenAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

async function main() {
  const [owner] = await ethers.getSigners();
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

  const consumerAddress = await consumer.getAddress();

  const Swap = await ethers.getContractFactory('Swap');
  const swap = await Swap.deploy('0xE592427A0AEce92De3Edee1F18E0157C05861564');

  const Raffle = await ethers.getContractFactory('Raffle');
  const raffle = await Raffle.connect(owner).deploy(
    consumerAddress,
    await mock.getAddress(),
    await dataPrice.getAddress(),
    await swap.getAddress(),
  );

  await mock.addConsumer(1, consumerAddress);
  await mock.addConsumer(1, await raffle.getAddress());

  const Token = await ethers.getContractFactory('MerkleAirdropToken');
  const token = await Token.deploy();

  raffle.allowToken(
    await token.getAddress(),
    '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
  );
  const USDT = await ethers.getContractAt('IERC20', usdtTokenAddress);

  // Now you can interact with the USDT token contract using the `USDT` instance.
  // For example, you can call its functions like `transfer`, `approve`, `balanceOf`, etc.
  // Note that you don't need to deploy the USDT contract because it already exists on the mainnet.

  // Transfer USDT from the owner to another address
  const amountToSend = ethers.parseUnits('1000', 6);
  await USDT.connect(owner).transfer(owner.address, amountToSend);

  // Get the balance of the owner's address
  const balance = await USDT.balanceOf(owner.address);
  console.log('USDT balance of owner:', balance.toString());

  // await token.increaseAllowance(await raffle.getAddress(), 10);

  // await raffle.deposit(10, await token.getAddress());

  // await raffle.selectRandomNum();

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

import { ethers } from 'hardhat';

async function main() {
  const Mock = await ethers.getContractFactory('VRFCoordinatorV2Mock');
  const mock = await Mock.deploy(100000000000000, 1000000000);

  const sub = await mock.createSubscription();

  await mock.fundSubscription(1, 100000000000000);

  const Consumer = await ethers.getContractFactory('VRFv2Consumer');
  const consumer = await Consumer.deploy(
    1,
    await mock.getAddress(),
    '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
  );

  const consumerAddress = await consumer.getAddress();

  const Raffle = await ethers.getContractFactory('Raffle');
  const raffle = await Raffle.deploy();

  await mock.addConsumer(1, consumerAddress);

  await consumer.requestRandomWords();

  await mock.fulfillRandomWordsWithOverride(
    1,
    consumerAddress,
    [5, 6, 4, 61, 1, 56],
  );

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

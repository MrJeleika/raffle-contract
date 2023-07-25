import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { MerkleAirdrop, MerkleAirdropToken } from '../typechain-types';
import { AbiCoder, Wallet, parseEther } from 'ethers';
import { randomBytes } from 'crypto';

import { keccak256 } from 'ethers';

import { MerkleTree } from 'merkletreejs';

describe('Merkle Tree', async () => {
  let signer: HardhatEthersSigner;
  let guy: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let merkleAirdrop: MerkleAirdrop;
  let merkleAirdropToken: MerkleAirdropToken;

  beforeEach(async () => {
    [signer, guy] = await ethers.getSigners();
    const MerkleAirdropToken = await ethers.getContractFactory(
      'MerkleAirdropToken',
    );
    merkleAirdropToken = await MerkleAirdropToken.deploy();
  });

  describe('Tree', async () => {
    it('should drop', async () => {
      const randomAddresses = new Array(9998)
        .fill(0)
        .map(() => new Wallet(randomBytes(32).toString('hex')).address)
        .concat(signer.address, guy.address);

      const generateValue = () => Math.floor(Math.random() * 1000);

      const amount = new Array(10000).fill(0).map(() => generateValue());

      const timelock = new Array(10000).fill(0).map(() => generateValue());

      const data: MerkleAirdrop.DataStruct[] = [];

      for (let i = 0; i < amount.length; i++) {
        const leaf = {
          amount: amount[i],
          timelock: timelock[i],
          account: randomAddresses[i],
        };

        data.push(leaf);
      }

      const abiCoder = new ethers.AbiCoder();

      const leaves = data.map(({ amount, timelock, account }) =>
        abiCoder.encode(
          ['uint256', 'uint256', 'address'],
          [amount, timelock, account],
        ),
      );

      const merkleTree = new MerkleTree(leaves, keccak256, {
        hashLeaves: true,
        sortPairs: true,
      });

      const root = merkleTree.getHexRoot();

      const index = data.findIndex((leaf) => leaf.account === guy.address)!;

      const leaf = keccak256(leaves[index]);

      const proof = merkleTree.getHexProof(leaf);

      const res = merkleTree.verify(proof, leaf, root);

      const MerkleAirdrop = await ethers.getContractFactory('MerkleAirdrop');
      merkleAirdrop = await MerkleAirdrop.deploy(
        await merkleAirdropToken.getAddress(),
        root,
      );

      await merkleAirdropToken.transfer(
        await merkleAirdrop.getAddress(),
        parseEther('5'),
      );

      await merkleAirdrop
        .connect(guy)
        .claim(proof, data[index].amount, data[index].timelock);
      expect(await merkleAirdrop.claimed(guy.address)).to.equal(true);

      await expect(
        merkleAirdrop.claim(proof, data[index].amount, data[index].timelock),
      ).to.be.revertedWith(
        'MerkleAirdrop: Address is not a candidate for claim',
      );

      await expect(merkleAirdrop.claim(proof, 5, 10)).to.be.revertedWith(
        'MerkleAirdrop: Address is not a candidate for claim',
      );
    });
  });
});

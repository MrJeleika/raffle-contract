import { keccak256 } from 'ethereumjs-util';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { MerkleAirdropToken, Signature } from '../typechain-types';
import { parseEther, solidityPacked } from 'ethers';

describe('Signature', async () => {
  let signer: HardhatEthersSigner;
  let guy: HardhatEthersSigner;
  let guy2: HardhatEthersSigner;
  let merkleAirdropToken: MerkleAirdropToken;
  let signatureContract: Signature;

  beforeEach(async () => {
    [signer, guy, guy2] = await ethers.getSigners();
    const MerkleAirdropToken = await ethers.getContractFactory(
      'MerkleAirdropToken',
    );
    merkleAirdropToken = await MerkleAirdropToken.deploy();
  });

  describe('Signature', async () => {
    it('should drop', async () => {
      const Signature = await ethers.getContractFactory('Signature');
      signatureContract = await Signature.connect(signer).deploy(
        await merkleAirdropToken.getAddress(),
      );

      const Test = await ethers.getContractFactory('Raffle');
      const raffle = await Test.deploy();

      await merkleAirdropToken.transfer(
        await signatureContract.getAddress(),
        parseEther('5'),
      );
      const signatureAddress = await signatureContract.getAddress();
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const abiCoder = new ethers.AbiCoder();

      const message1 = solidityPacked(
        ['uint256', 'address', 'uint256', 'address', 'uint256'],
        [5, guy.address, chainId, signatureAddress, 0],
      );
      const message2 = solidityPacked(
        ['uint256', 'address', 'uint256', 'address', 'uint256'],
        [5, guy2.address, chainId, signatureAddress, 0],
      );

      const signature1 = await signer.signMessage(keccak256(message1));

      const signature2 = await signer.signMessage(keccak256(message2));

      await signatureContract.connect(guy).claim(signature1, 0, 5);

      expect(await merkleAirdropToken.balanceOf(guy)).to.equal(5);

      await expect(
        signatureContract.connect(guy2).claim(signature2, 0, 5),
      ).to.be.revertedWith('Signature: Address is not a candidate for claim');
    });
  });
});

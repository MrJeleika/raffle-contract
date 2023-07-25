
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '../node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "../node_modules/@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../node_modules/hardhat/console.sol";

// Erc 20 permit example of signature
contract MerkleAirdrop {
    using MerkleProof for bytes32[];
    using SafeERC20 for IERC20;

    address private _owner;
    address public immutable token;
    bytes32 public immutable merkleRoot;

    struct Data{
        uint256 amount;
        uint256 timelock;
        address account;
    }

    mapping(address => bool) public claimed;

    event Claim(address indexed claimer);

    constructor(address _token, bytes32 _merkleRoot) {
        _owner = msg.sender;
        token = _token;
        merkleRoot = _merkleRoot;
        IERC20(token).approve(_owner, 5000000000000);
    }

    function claim(bytes32[] calldata merkleProof, uint256 amount, uint256 timelock) external {
        require(block.timestamp > timelock, "Can't claim yet");
        require(
            canClaim(msg.sender, merkleProof, amount, timelock),
            "MerkleAirdrop: Address is not a candidate for claim"
        );

        claimed[msg.sender] = true;

        IERC20(token).safeTransfer(msg.sender,  amount);

        emit Claim(msg.sender);
    }

    function canClaim(address claimer, bytes32[] calldata merkleProof, uint256 amount, uint256 timelock)
        public
        view
        returns (bool)
    {
        bytes32 leaf = hashElement(amount, timelock, claimer);
        bytes32 computedRoot = MerkleProof.processProof(merkleProof, leaf);
        return computedRoot == merkleRoot;
    }

    function hashElement(uint256 amount, uint256 timelock, address claimer) internal pure returns (bytes32) {
        return keccak256(abi.encode(amount, timelock, claimer));
    }
}
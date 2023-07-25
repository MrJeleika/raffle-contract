
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";

// Erc 20 permit example of signature
contract Signature {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    address private _owner;
    address public immutable token;

    mapping(bytes => bool) public isClaimed;

    event Claim(address indexed claimer);

    constructor(address _token) {
        _owner = msg.sender;
        token = _token;
        IERC20(token).approve(_owner, 5000000000000);
    }

    function claim(bytes calldata signature, uint256 nonce, uint256 amount) external {
        require(
            canClaim(signature, nonce, amount, msg.sender),
            "Signature: Address is not a candidate for claim"
        );

        isClaimed[signature] = true;

        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Claim(msg.sender);
    }

    function canClaim(bytes calldata signature, uint256 nonce, uint256 amount, address sender)
        public
        view
        returns (bool)
    {

    bytes32 message = keccak256(abi.encodePacked(amount, sender, block.chainid, address(this), nonce));

    return !isClaimed[signature] && message.toEthSignedMessageHash().recover(signature) == _owner;
    }
}
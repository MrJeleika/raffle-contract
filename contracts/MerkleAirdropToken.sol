
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MerkleAirdropToken is ERC20{
  constructor() ERC20("MerkleAirdropToken", "MAT"){
    _mint(msg.sender, 1000000 * 10 ** decimals());
  }
}
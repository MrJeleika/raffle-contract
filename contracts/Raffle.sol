
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './DataConsumerV3.sol';
import './VRFv2Consumer.sol';

// if we can use offchain choosing of number, we can use array with structs that has range of winning numbers
// And then pass that array on backend and random number to find the right address

contract Raffle {
  using SafeERC20 for IERC20;
  DataConsumerV3 dataConsumer;
  VRFv2Consumer random;


  address private _owner;
  bool isEnded;
  uint256 public totalPoolBalance; // Pool id => balance
  mapping(address => bool) public isTokenAllowed;

  struct UserNumbers{
    uint256 from;
    uint256 to;
    address user;
  }

  UserNumbers[] public poolUsers;
  
  event Deposit(uint256 amount, address user, address tokenAddress);

  constructor(){
    _owner = msg.sender;
    isTokenAllowed[0xdAC17F958D2ee523a2206206994597C13D831ec7] = true; // USDT
    isTokenAllowed[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = true; // USDC
    isTokenAllowed[0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6] = true; // WETH
  }
  

  function allowToken(address tokenAddress, bool isAllowed) external onlyOwner{
    isTokenAllowed[tokenAddress] = isAllowed;
  }

  function deposit(uint256 amount, address tokenAddress) external {
    require(!isEnded, "Raffle ended");
    require(isTokenAllowed[tokenAddress], 'Token is not allowed');
    require(amount > 0, "Amount == 0");
    uint256 price = dataConsumer.getLatestData(tokenAddress);
    IERC20(tokenAddress).approve(msg.sender, amount);
    IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
    UserNumbers memory userNumber = UserNumbers(totalPoolBalance, totalPoolBalance + amount, msg.sender);
    totalPoolBalance += (amount * price);
    poolUsers.push(userNumber);
    emit Deposit(amount, msg.sender, tokenAddress);
  }
  
  function selectRandomWord(address tokenAddress) public onlyOwner returns(UserNumbers[] memory, uint256){
    uint256 price = dataConsumer.getLatestData(tokenAddress);
    return (poolUsers, price);
  }
  
  function selectWinner(uint256 userIndex, uint256 randomNum) public onlyOwner{
    UserNumbers memory user = poolUsers[userIndex];
    require(user.from < randomNum && user.to >= randomNum, 'Wrong winner');
   
  } 

  modifier onlyOwner() {
    require(msg.sender == _owner, 'Not allowed');
    _;
  }
}
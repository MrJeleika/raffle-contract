
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './DataConsumerV3.sol';
import './VRFv2Consumer.sol';
import './VRFMock.sol';
import './Swap.sol';

// if we can use offchain choosing of number, we can use array with structs that has range of winning numbers
// And then pass that array on backend and random number to find the right address

contract Raffle {
  using SafeERC20 for IERC20;
  DataConsumerV3 priceData;
  Swap swap;
  // ! I DELETED ONLY OVNER
  VRFv2Consumer public random;
  VRFMock public mock;

  address private _owner;
  bool isEnded;
  uint256 public totalPoolBalance; // Pool id => balance
  uint256 public randomNum;
  mapping(address => address) public tokenFeed; // Token address => chainlink feed

  struct UserNumbers{
    uint256 from;
    uint256 to;
    address user;
  }

  UserNumbers[] public poolUsers;

  event Deposit(uint256 amount, address user, address tokenAddress);

  constructor(address consumerAddress, address mockAddress, address priceDataAddress, address routerAddress) {
    random = VRFv2Consumer(consumerAddress);
    mock = VRFMock(mockAddress);
    priceData = DataConsumerV3(priceDataAddress);
    swap = Swap(routerAddress);
    _owner = msg.sender;
    tokenFeed[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D; // USDT 
  }

  function allowToken(address tokenAddress, address dataFeedAddress) external onlyOwner{
    tokenFeed[tokenAddress] = dataFeedAddress;
  }

  function deposit(uint256 amount, address tokenAddress) external {
    require(IERC20(tokenAddress).balanceOf(msg.sender) > amount, 'Not enough tokens');
    require(!isEnded, "Raffle ended");
    require(tokenFeed[tokenAddress] != address(0), 'Token is not allowed');
    require(amount > 0, "Amount == 0");

    uint256 price = priceData.getLatestData(tokenFeed[tokenAddress]);

    IERC20(tokenAddress).safeApprove(address(this), amount);

    require(IERC20(tokenAddress).allowance(msg.sender, address(this)) >= amount, 'Not enough allowance');

    IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
    
    UserNumbers memory userNumber = UserNumbers(totalPoolBalance, totalPoolBalance + amount, msg.sender);

    uint res = swap.swapTokenForETH(tokenAddress, amount);
    console.log(res);
    totalPoolBalance += (amount * price);
    poolUsers.push(userNumber);
    emit Deposit(amount, msg.sender, tokenAddress);
  }
  
  function selectRandomNum() public onlyOwner {
    require(totalPoolBalance > 0, "No users");
    random.requestRandomWords();
    mock.fulfillRandomWords(random.s_requestId(), address(random));
    randomNum = random.s_randomWords(0) % totalPoolBalance;
  }
  
  function selectWinner(uint256 userIndex, uint256 _randomNum) public onlyOwner{
    UserNumbers memory user = poolUsers[userIndex];
    require(user.from < _randomNum && user.to >= _randomNum && randomNum == _randomNum, 'Wrong winner');

  } 

  modifier onlyOwner() {
    require(msg.sender == _owner, 'Not allowed');
    _;
  }
}
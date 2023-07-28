
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
interface IERC20Extented is IERC20 {
    function decimals() external view returns (uint8);
}



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
  address[] public playedTokens;

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
    tokenFeed[0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0] = 0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676; // matic  
  }

  function allowToken(address tokenAddress, address dataFeedAddress) external onlyOwner{
    tokenFeed[tokenAddress] = dataFeedAddress;
  }

  function deposit(uint256 amount, address tokenAddress) external {
    console.log(amount);
    require(amount > 0, "Amount == 0");
    require(IERC20(tokenAddress).balanceOf(msg.sender) >= amount, 'Not enough tokens');
    require(!isEnded, "Raffle ended");
    require(tokenFeed[tokenAddress] != address(0), 'Token is not allowed');

    uint256 price = priceData.getLatestData(tokenFeed[tokenAddress]);
    console.log(price);
    IERC20(tokenAddress).safeApprove(address(this), amount);

    require(IERC20(tokenAddress).allowance(msg.sender, address(this)) >= amount, 'Not enough allowance');

    IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
    
    playedTokens.push(tokenAddress);

    // Since we have 6 and 18 decimals tokens, we have to set it to 6 to match USD
    if(IERC20Extented(tokenAddress).decimals() == 18){
      amount /= 10 ** 12;
    }

    UserNumbers memory userNumber = UserNumbers(totalPoolBalance, totalPoolBalance + (amount * price), msg.sender);
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
    require(randomNum != 0, "Wrong number");
    require(user.from < _randomNum && user.to >= _randomNum && randomNum == _randomNum, 'Wrong winner');
    randomNum = 0;
    totalPoolBalance = 0;

    for(uint256 i = 0; i < playedTokens.length; i++) {
      (bool success, ) = address(playedTokens[i]).call(abi.encodeWithSignature("approve(address,uint256)", address(swap), IERC20(playedTokens[i]).balanceOf(address(this))));
      require(success, "ERC20 approval failed");
      uint256 out = swap.swapTokenForETH(playedTokens[i], IERC20(playedTokens[i]).balanceOf(address(this)), address(this), user.user);
    }
    // playedTokens = new address[](0);
  } 

  function getPoolUsers() public view returns (UserNumbers[] memory) {
        return poolUsers;
  }

  receive() payable external{}

  modifier onlyOwner() {
    require(msg.sender == _owner, 'Not allowed');
    _;
  }
}
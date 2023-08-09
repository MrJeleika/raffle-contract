
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
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

  bool isEnded;
  address private _owner;
  address private _founder;
  uint8 public contractPercent;
  uint8 public founderPercent;
  uint8 public userPercent;
  uint256 public totalPoolBalance;
  uint256 public randomNum;
  mapping(address => address) public tokenFeed; // Token address => chainlink feed
  mapping(address => bool) private playedTokensMap;

  struct UserNumbers{
    uint256 from;
    uint256 to;
    address user;
  }
  // TODO: Сделать геттеры для функций
  address[] public playedTokens;
  UserNumbers[] public poolUsers;
  UserNumbers[] public emptyArray;

  event Deposit(uint256 amount, address user, address tokenAddress);

  constructor(address consumerAddress, address mockAddress, address priceDataAddress, address routerAddress) {
    random = VRFv2Consumer(consumerAddress);
    mock = VRFMock(mockAddress);
    priceData = DataConsumerV3(priceDataAddress);
    swap = Swap(routerAddress);
    _owner = msg.sender;
    tokenFeed[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D; // USDT
    tokenFeed[0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0] = 0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676; // matic  
    contractPercent = 5;
    founderPercent = 5;
    userPercent = 90;
  }

  function allowToken(address tokenAddress, address dataFeedAddress) external onlyOwner{
    tokenFeed[tokenAddress] = dataFeedAddress;
  }

  function deposit(uint256 amount, address tokenAddress, uint8 v, bytes32 r, bytes32 s) external {
    console.log(amount);
    require(amount > 0, "Amount == 0");
    require(!isEnded, "Raffle ended");
    require(tokenFeed[tokenAddress] != address(0), 'Token is not allowed');

    // ! Проверять цену при передаче юзеру
    // ? Когда юзер будет депозитить можно писать в USD, видел пример на cyberconnect
    // https://link3.to/cybertrek
    IERC20Permit(tokenAddress).permit(msg.sender, address(this), amount, block.timestamp + 10 weeks, v, r, s);
    uint256 price = priceData.getLatestData(tokenFeed[tokenAddress]);

    IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
    
    if(!playedTokensMap[tokenAddress]){
      playedTokens.push(tokenAddress);
      playedTokensMap[tokenAddress] = true;
    }

    // Since we have 6 and 18 decimals tokens, we have to set it to 6 to match USD
    if(IERC20Extented(tokenAddress).decimals() != 6){
      amount /= 10 ** (IERC20Extented(tokenAddress).decimals() - 6);
    }

    UserNumbers memory userNumber = UserNumbers(totalPoolBalance, totalPoolBalance + (amount * price), msg.sender);
    totalPoolBalance += (amount * price);
    poolUsers.push(userNumber);
    emit Deposit(amount, msg.sender, tokenAddress);
  }
  
  function selectRandomNum() public onlyOwner {
    require(totalPoolBalance > 0, "No users");
    random.requestRandomWords();
    isEnded = true;
    mock.fulfillRandomWords(random.s_requestId(), address(random));
    randomNum = random.s_randomWords(0) % totalPoolBalance;
  }
  
  
  function selectWinner(uint256 userIndex, uint256 _randomNum) public onlyOwner{
    UserNumbers memory user = poolUsers[userIndex];
    require(randomNum != 0, "Wrong number");
    require(user.from < _randomNum && user.to >= _randomNum && randomNum == _randomNum, 'Wrong winner');
    randomNum = 0;
    totalPoolBalance = 0;
    poolUsers = emptyArray;

    for(uint256 i = 0; i < playedTokens.length; i++) {
      address token = playedTokens[i];
      playedTokensMap[token] = false;
      uint256 userBalance = IERC20(token).balanceOf(address(this));
      (bool success, ) = address(token).call(abi.encodeWithSignature("approve(address,uint256)", address(swap), userBalance));
      require(success, "ERC20 approval failed");
      swap.swapTokenForETH(token, userBalance, address(this), address(this));
    } 
    
    uint256 contractBalance = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(address(this));
    console.log(contractBalance);
    // For user
    IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).transfer(user.user, contractBalance * userPercent / 100);
    // For founder
    IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).transfer(_founder, contractBalance * founderPercent / 100);
    // And we left % for us
    playedTokens = new address[](0);
    isEnded = false;
  } 

  function getPoolUsers() public view returns (UserNumbers[] memory) {
    return poolUsers;
  }

  function getPlayedTokens() public view returns (address[] memory) {
    return playedTokens;
  }

  function changeFounder(address newFounder) external onlyFounder onlyOwner{
    _founder = newFounder;
  }

  receive() payable external{}

  modifier onlyFounder() {
    require(msg.sender == _founder, 'Not allowed');
    _;
  }

  modifier onlyOwner() {
    require(msg.sender == _owner, 'Not allowed');
    _;
  }
}
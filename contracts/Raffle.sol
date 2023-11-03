// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DataConsumerV3.sol";
import "./VRFv2Consumer.sol";
import "./VRFMock.sol";
import "./Swap.sol";

// if we can use offchain choosing of number, we can use array with structs that has range of winning numbers
// And then pass that array on backend and random number to find the right address
interface IERC20Extented is IERC20, IERC20Permit {
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
    address public winningToken;
    uint256 public totalPoolBalance;
    uint256 public randomNum;
    mapping(address => address) public tokenFeed; // Token address => chainlink feed
    mapping(address => bool) private playedTokensMap;
    mapping(address => uint256) private playedTokensIndex;
    mapping(address => uint256) public playedTokensBalance;
    mapping(address => uint256) public playedTokensBalanceUSD;
    mapping(address => uint256) private chanseToWin; // Token chanse to win * 10000

    struct UserNumber2 {
        uint256 from;
        uint256 to;
        address user;
        address token;
    }

    mapping(address => UserNumber2[]) public poolUsers2; // token addres => array of users that voted for the token

    struct UserNumbers {
        uint256 from;
        uint256 to;
        address user;
    }

    address[] public playedTokens;
    UserNumber2[] public poolUsers;
    UserNumber2[] public emptyArray;

    event Deposit(uint256 amount, address user, address tokenAddress);

    constructor(address consumerAddress, address mockAddress, address priceDataAddress, address routerAddress) {
        random = VRFv2Consumer(consumerAddress);
        mock = VRFMock(mockAddress);
        priceData = DataConsumerV3(priceDataAddress);
        swap = Swap(routerAddress);
        _owner = msg.sender;
        tokenFeed[0xdAC17F958D2ee523a2206206994597C13D831ec7] = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D; // USDT
        tokenFeed[0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0] = 0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676; // matic
        tokenFeed[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = 0x3E7d1eAB13ad0104d2750B8863b489D65364e32D;
        contractPercent = 5;
        founderPercent = 5;
        userPercent = 90;
    }

    function allowToken(address tokenAddress, address dataFeedAddress) external onlyOwner {
        tokenFeed[tokenAddress] = dataFeedAddress;
    }

    function checkSignature(uint256 value, address tokenAddress, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external view {
        bytes32 PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        // For USDC
        bytes32 DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("USD Coin")), // Replace with your token name
                keccak256(bytes("2")), // Replace with your token version
                1, // Use the correct chainId (you may need to pass it as an argument)
                tokenAddress
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                msg.sender,
                tokenAddress,
                value,
                1, // Assuming you have a mapping to track nonces
                deadline
            )
        );

        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        address recoveredAddress = ecrecover(hash, v, r, s);
        console.log("recovered address: ", recoveredAddress);
        require(recoveredAddress == msg.sender, "Invalid signature");
    }

    function deposit(uint256 amount, address tokenAddress, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(amount > 0, "Amount == 0");
        require(!isEnded, "Raffle ended");
        require(tokenFeed[tokenAddress] != address(0), "Token is not allowed");

        // ! Проверять цену при передаче юзеру
        // ? Когда юзер будет депозитить можно писать в USD, видел пример на cyberconnect
        // https://link3.to/cybertrek

        IERC20Extented(tokenAddress).permit(msg.sender, address(this), amount, deadline, v, r, s);

        IERC20Extented(tokenAddress).transferFrom(msg.sender, address(this), amount);

        if (IERC20Extented(tokenAddress).decimals() != 6) {
            amount /= 10 ** (IERC20Extented(tokenAddress).decimals() - 6);
        }

        // If this token played 1 time we create new array in pool
        if (playedTokensBalance[tokenAddress] == 0) {
            playedTokens.push(tokenAddress);
            poolUsers2[tokenAddress].push(UserNumber2(0, amount, msg.sender, tokenAddress));
            poolUsers.push(UserNumber2(0, amount, msg.sender, tokenAddress));
        } else {
            UserNumber2[] storage userNumbers = poolUsers2[tokenAddress];
            userNumbers.push(UserNumber2(playedTokensBalance[tokenAddress], playedTokensBalance[tokenAddress] + amount, msg.sender, tokenAddress));
            poolUsers.push(UserNumber2(playedTokensBalance[tokenAddress], playedTokensBalance[tokenAddress] + amount, msg.sender, tokenAddress));
        }

        playedTokensBalance[tokenAddress] += amount;

        // Since we have 6 and 18 decimals tokens, we have to set it to 6 to match USD

        // UserNumbers memory userNumber = UserNumbers(totalPoolBalance, totalPoolBalance + (amount * price), msg.sender);
        // totalPoolBalance += (amount * price);
        // poolUsers.push(userNumber);
        emit Deposit(amount, msg.sender, tokenAddress);
    }

    function selectRandomNum() public onlyOwner {
        require(totalPoolBalance > 0, "No users");
        random.requestRandomWords();
        isEnded = true;
        mock.fulfillRandomWords(random.s_requestId(), address(random));
        randomNum = random.s_randomWords(0) % totalPoolBalance;
    }

    function selectWinner2(uint256 _userIndex) public {
        UserNumber2[] storage userNumbers = poolUsers2[winningToken];
        UserNumber2 memory user = userNumbers[_userIndex];

        require(randomNum != 0, "Wrong number");
        uint256 _randomNum = randomNum % playedTokensBalance[winningToken];
        require(user.from < _randomNum && user.to >= _randomNum, "Wrong winner");
        randomNum = 0;
        totalPoolBalance = 0;
        poolUsers = emptyArray;

        // Swap tokens
        for (uint256 i = 0; i < playedTokens.length; i++) {
            address token = playedTokens[i];
            playedTokensMap[token] = false;
            uint256 userBalance = IERC20(token).balanceOf(address(this));
            console.log(userBalance);
            (bool success, ) = address(token).call(abi.encodeWithSignature("approve(address,uint256)", address(swap), userBalance));
            require(success, "ERC20 approval failed");
            swap.swapTokenForETH(token, userBalance, address(this), address(this));
            uint256 userBalance2 = IERC20(token).balanceOf(address(this));
            playedTokensBalance[token] = 0;
            console.log(i);
        }

        uint256 contractBalance = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(address(this));

        // For user
        IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).transfer(user.user, (contractBalance * userPercent) / 100);

        // For founder
        IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).transfer(_founder, (contractBalance * founderPercent) / 100);

        // And we left % for us
        playedTokens = new address[](0);
        isEnded = false;
        console.log(IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(_founder));
    }

    function selectWinner() public onlyOwner returns (address tokenAddress) {
        uint256 totalPoolBalanceUSD;
        console.log(playedTokens.length);
        // Count price of all tokens
        for (uint8 i = 0; i < playedTokens.length; i++) {
            address token = playedTokens[i];

            uint256 price = priceData.getLatestData(tokenFeed[token]);
            playedTokensBalanceUSD[token] += playedTokensBalance[token] * price;
            totalPoolBalanceUSD += playedTokensBalance[token] * price;
        }

        random.requestRandomWords();
        mock.fulfillRandomWords(random.s_requestId(), address(random));
        randomNum = random.s_randomWords(0);

        uint256 currRandomTokenNumber = 10000;
        uint256 randomTokenNumber = randomNum % 10000;
        console.log(randomTokenNumber);
        // Select winningY
        for (uint8 i = 0; i < playedTokens.length; i++) {
            address token = playedTokens[i];

            currRandomTokenNumber -= (playedTokensBalanceUSD[token] * 10000) / totalPoolBalanceUSD;
            if (randomTokenNumber >= currRandomTokenNumber) {
                winningToken = token;
                playedTokensBalanceUSD[token] = 0;
                return token;
            }
            playedTokensBalanceUSD[token] = 0;
        }

        // If Some kind of error we return last pool
        winningToken = playedTokens[playedTokens.length - 1];
        return playedTokens[playedTokens.length - 1];
    }

    function getPoolUsers() public view returns (UserNumber2[] memory) {
        return poolUsers;
    }

    function getPlayedTokens() public view returns (address[] memory) {
        return playedTokens;
    }

    function changeFounder(address newFounder) external onlyFounder onlyOwner {
        _founder = newFounder;
    }

    receive() external payable {}

    modifier onlyFounder() {
        require(msg.sender == _founder, "Not allowed");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Not allowed");
        _;
    }
}

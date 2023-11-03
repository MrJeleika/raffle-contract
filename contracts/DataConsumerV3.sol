// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DataConsumerV3 {
    function getLatestData(address tokenAddress) public view returns (uint256) {
        AggregatorV3Interface dataFeed = AggregatorV3Interface(tokenAddress);

        (
            ,
            /* uint80 roundID */ int answer /*uint startedAt*/ /*uint timeStamp*/ /*uint80 answeredInRound*/,
            ,
            ,

        ) = dataFeed.latestRoundData();
        return answer >= 0 ? uint256(answer) : uint256(-answer);
    }
}

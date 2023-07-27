
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract Swap{
      ISwapRouter public immutable swapRouter;
      address public constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
      uint24 public constant feeTier = 3000;
      
      constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
      }
      
      function swapTokenForETH(address tokenAddress, uint256 amountIn) external returns (uint256 amountOut) {

          // Transfer the specified amount of WETH9 to this contract.
          TransferHelper.safeTransferFrom(tokenAddress, msg.sender, address(this), amountIn);
          // Approve the router to spend WETH9.
          TransferHelper.safeApprove(tokenAddress, address(swapRouter), amountIn);
          // Note: To use this example, you should explicitly set slippage limits, omitting for simplicity
          uint256 minOut = /* Calculate min output */ 0;
          uint160 priceLimit = /* Calculate price limit */ 0;
          // Create the params that will be used to execute the swap
          ISwapRouter.ExactInputSingleParams memory params =
              ISwapRouter.ExactInputSingleParams({
                  tokenIn: tokenAddress,
                  tokenOut: WETH9,
                  fee: feeTier,
                  recipient: msg.sender,
                  deadline: block.timestamp,
                  amountIn: amountIn,
                  amountOutMinimum: minOut,
                  sqrtPriceLimitX96: priceLimit
              });
          // The call to `exactInputSingle` executes the swap.
          amountOut = swapRouter.exactInputSingle(params);
          return amountOut;
      }
}
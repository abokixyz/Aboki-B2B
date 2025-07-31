/**
 * Contract ABIs
 * All contract ABIs used in the onramp system
 */

// Your AbokiV2 Contract ABI (from paste-3.txt)
const ABOKI_V2_ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_initialOwner",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "orderId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "rate",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "refundAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "liquidityProvider",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "feeRecipient",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "feePercent",
          "type": "uint256"
        }
      ],
      "name": "OrderCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "orderId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "liquidityProvider",
          "type": "address"
        }
      ],
      "name": "OrderFulfilled",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "WETH",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address[]",
          "name": "_tokens",
          "type": "address[]"
        }
      ],
      "name": "areTokensSupported",
      "outputs": [
        {
          "internalType": "bool[]",
          "name": "",
          "type": "bool[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getConfiguration",
      "outputs": [
        {
          "internalType": "address",
          "name": "v2Router",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "v3Router",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "v3Quoter",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "weth",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "totalOrders",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "supportedTokens",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_inputToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_targetToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_inputAmount",
          "type": "uint256"
        }
      ],
      "name": "estimateSwapOutputV2",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_tokenIn",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_tokenOut",
          "type": "address"
        },
        {
          "internalType": "uint24",
          "name": "_fee",
          "type": "uint24"
        },
        {
          "internalType": "uint256",
          "name": "_inputAmount",
          "type": "uint256"
        }
      ],
      "name": "estimateSwapOutputV3Single",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
  
  // Quoter V2 ABI (from paste-4.txt)
  const QUOTER_ABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_factory",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_WETH9",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "WETH9",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "tokenIn",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "tokenOut",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amountIn",
              "type": "uint256"
            },
            {
              "internalType": "uint24",
              "name": "fee",
              "type": "uint24"
            },
            {
              "internalType": "uint160",
              "name": "sqrtPriceLimitX96",
              "type": "uint160"
            }
          ],
          "internalType": "struct IQuoterV2.QuoteExactInputSingleParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "quoteExactInputSingle",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint160",
          "name": "sqrtPriceX96After",
          "type": "uint160"
        },
        {
          "internalType": "uint32",
          "name": "initializedTicksCrossed",
          "type": "uint32"
        },
        {
          "internalType": "uint256",
          "name": "gasEstimate",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes",
          "name": "path",
          "type": "bytes"
        },
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        }
      ],
      "name": "quoteExactInput",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint160[]",
          "name": "sqrtPriceX96AfterList",
          "type": "uint160[]"
        },
        {
          "internalType": "uint32[]",
          "name": "initializedTicksCrossedList",
          "type": "uint32[]"
        },
        {
          "internalType": "uint256",
          "name": "gasEstimate",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
  
  // ERC20 ABI for token info and balances
  const ERC20_ABI = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];
  
  // Uniswap V2 Router ABI (minimal for price checking)
  const ROUTER_V2_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)",
    "function factory() external pure returns (address)",
    "function WETH() external pure returns (address)"
  ];
  
  // Swap Router ABI (from paste-4.txt - minimal for swaps)
  const SWAP_ROUTER_ABI = [
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "tokenIn",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "tokenOut",
              "type": "address"
            },
            {
              "internalType": "uint24",
              "name": "fee",
              "type": "uint24"
            },
            {
              "internalType": "address",
              "name": "recipient",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amountIn",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "amountOutMinimum",
              "type": "uint256"
            },
            {
              "internalType": "uint160",
              "name": "sqrtPriceLimitX96",
              "type": "uint160"
            }
          ],
          "internalType": "struct IV3SwapRouter.ExactInputSingleParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "exactInputSingle",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    }
  ];
  
  module.exports = {
    ABOKI_V2_ABI,
    QUOTER_ABI,
    ERC20_ABI,
    ROUTER_V2_ABI,
    SWAP_ROUTER_ABI
  };
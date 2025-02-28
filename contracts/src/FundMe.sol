// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title A fundraising smart contract
 * @author howellsy
 * @notice Only the owner can withdraw funds
 * @dev Uses a Chainlink price feed to convert ETH to USD
 */
contract FundMe {
    mapping(address => uint256) private s_addressToAmountFunded;
    address[] private s_funders;
    // Remove the price feed variable
    // AggregatorV3Interface private s_priceFeed;
    IERC20 private s_usdcToken;

    address private immutable i_owner;
    uint256 private constant MINIMUM_USD = 5 * 10 ** 18;

    event Funded(address indexed funder, uint256 value);

    error FundMe__NotOwner(address sender);
    error FundMe__TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert FundMe__NotOwner(msg.sender);
        _;
    }

    constructor(address usdcToken) {
        i_owner = msg.sender;
        // Remove the price feed initialization
        // s_priceFeed = AggregatorV3Interface(priceFeed);
        s_usdcToken = IERC20(usdcToken);
    }

    receive() external payable {
        fund();
    }

    fallback() external payable {
        fund();
    }

    function fund(uint256 usdcAmount) public {
        // Remove the price conversion check
        // require(usdcAmount.getConversionRate(s_priceFeed) >= MINIMUM_USD, "You need to send more USDC!");
        require(usdcAmount >= MINIMUM_USD, "You need to send more USDC!");
        s_usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
        s_addressToAmountFunded[msg.sender] += usdcAmount;
        s_funders.push(msg.sender);

        emit Funded(msg.sender, usdcAmount);
    }

    function withdraw() public onlyOwner {
        uint256 fundersLength = s_funders.length;
        uint256 balance = s_usdcToken.balanceOf(address(this));

        for (uint256 funderIndex = 0; funderIndex < fundersLength; funderIndex++) {
            address funder = s_funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }

        s_funders = new address[](0);

        s_usdcToken.transfer(msg.sender, balance);
    }

    /**
     * View/Pure functions (Getters)
     */

    function getAddressToAmountFunded(address fundingAddress) external view returns (uint256) {
        return s_addressToAmountFunded[fundingAddress];
    }

    function getFunder(uint256 index) external view returns (address) {
        return s_funders[index];
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }

    function getMinimumUsd() external pure returns (uint256) {
        return MINIMUM_USD;
    }
}
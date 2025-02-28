// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./FundMe.sol"; // Assuming FundMe is in a separate file

contract FundMeFactory {
    FundMe[] public fundMeContracts;

    event FundMeCreated(address indexed owner, address fundMeAddress);

    function createFundMe(address usdcToken) external {
        FundMe newFundMe = new FundMe(usdcToken);
        fundMeContracts.push(newFundMe);
        emit FundMeCreated(msg.sender, address(newFundMe));
    }

    function getFundMeContracts() external view returns (FundMe[] memory) {
        return fundMeContracts;
    }
}
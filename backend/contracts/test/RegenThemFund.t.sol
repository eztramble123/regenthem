// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {RegenThemFund} from "../src/RegenThemFund.sol";
import {RegenThemFundFactory} from "../src/RegenThemFundFactory.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

// Mock USDC token for testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1000000 * 10**18); // Mint 1 million tokens to deployer
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

contract RegenThemFundTest is Test {
    RegenThemFund public regenThemFund;
    RegenThemFundFactory public factory;
    MockUSDC public mockUSDC;
    
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public owner;
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    uint256 public constant GOAL_AMOUNT = 100 * 10**18; // 100 USDC
    string public constant FUND_NAME = "Test Fund";
    string public constant FUND_DESCRIPTION = "Test Fund Description";

    function setUp() public {
        // Deploy mock USDC
        mockUSDC = new MockUSDC();
        
        // Set up the owner address
        owner = address(this);
        
        // Mock the USDC token at the expected address BEFORE creating funds
        vm.etch(USDC_ADDRESS, address(mockUSDC).code);
        
        // Give tokens to the test contract so it can distribute them
        deal(USDC_ADDRESS, address(this), 1000000 * 10**18);
        
        // Give some USDC to test users
        deal(USDC_ADDRESS, alice, 1000 * 10**18);
        deal(USDC_ADDRESS, bob, 1000 * 10**18);
        
        // Deploy factory
        factory = new RegenThemFundFactory();
        
        // Create a fund through the factory
        factory.createRegenThemFund(FUND_NAME, FUND_DESCRIPTION, GOAL_AMOUNT);
        
        // Get the deployed fund
        regenThemFund = RegenThemFund(factory.regenThemFundContracts(0));
    }

    function testFactoryDeployment() public view {
        assertEq(factory.getRegenThemFundContracts().length, 1);
    }
    
    function testFundCreation() public view {
        assertEq(regenThemFund.getName(), FUND_NAME);
        assertEq(regenThemFund.getDescription(), FUND_DESCRIPTION);
        assertEq(regenThemFund.getGoalAmount(), GOAL_AMOUNT);
        // Use msg.sender instead of owner for the factory-created fund
        assertEq(regenThemFund.getOwner(), address(this));
    }
    
    function testMinimumContribution() public view {
        uint256 minUsd = regenThemFund.getMinimumUsd();
        assertEq(minUsd, 1 * 10**16); // 0.01 USDC
    }
    
    function testFunding() public {
        uint256 fundAmount = 10 * 10**18; // 10 USDC
        
        // Approve and fund as Alice
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), fundAmount);
        regenThemFund.fund(fundAmount);
        vm.stopPrank();
        
        // Check balances and tracking
        assertEq(regenThemFund.getAddressToAmountFunded(alice), fundAmount);
        assertEq(regenThemFund.getCurrentBalance(), fundAmount);
        assertEq(regenThemFund.getTotalRaised(), fundAmount);
        assertEq(regenThemFund.getProgress(), (fundAmount * 100) / GOAL_AMOUNT);
    }
    
    function testMultipleFunders() public {
        uint256 aliceFundAmount = 20 * 10**18; // 20 USDC
        uint256 bobFundAmount = 30 * 10**18; // 30 USDC
        
        // Alice funds
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), aliceFundAmount);
        regenThemFund.fund(aliceFundAmount);
        vm.stopPrank();
        
        // Bob funds
        vm.startPrank(bob);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), bobFundAmount);
        regenThemFund.fund(bobFundAmount);
        vm.stopPrank();
        
        // Check balances and tracking
        assertEq(regenThemFund.getAddressToAmountFunded(alice), aliceFundAmount);
        assertEq(regenThemFund.getAddressToAmountFunded(bob), bobFundAmount);
        assertEq(regenThemFund.getCurrentBalance(), aliceFundAmount + bobFundAmount);
        assertEq(regenThemFund.getTotalRaised(), aliceFundAmount + bobFundAmount);
    }
    
    function testGoalReached() public {
        uint256 fundAmount = GOAL_AMOUNT;
        
        // Fund the full goal amount
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), fundAmount);
        
        // Emit the event manually to match the contract's event
        vm.expectEmit(true, true, true, true);
        emit RegenThemFund.GoalReached(fundAmount);
        
        regenThemFund.fund(fundAmount);
        vm.stopPrank();
        
        // Check progress is 100%
        assertEq(regenThemFund.getProgress(), 100);
    }
    
    function testWithdraw() public {
        uint256 fundAmount = 50 * 10**18; // 50 USDC
        
        // Alice funds
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), fundAmount);
        regenThemFund.fund(fundAmount);
        vm.stopPrank();
        
        // Get initial owner balance
        address fundOwner = regenThemFund.getOwner();
        uint256 initialOwnerBalance = IERC20(USDC_ADDRESS).balanceOf(fundOwner);
        
        // Owner withdraws
        vm.prank(fundOwner);
        regenThemFund.withdraw();
        
        // Check balances after withdrawal
        assertEq(regenThemFund.getCurrentBalance(), 0);
        assertEq(regenThemFund.getTotalRaised(), fundAmount);
        assertEq(IERC20(USDC_ADDRESS).balanceOf(fundOwner), initialOwnerBalance + fundAmount);
    }
    
    function testOnlyOwnerCanWithdraw() public {
        uint256 fundAmount = 50 * 10**18; // 50 USDC
        
        // Alice funds
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), fundAmount);
        regenThemFund.fund(fundAmount);
        
        // Alice tries to withdraw (should fail)
        vm.expectRevert(abi.encodeWithSelector(RegenThemFund.RegenThemFund__NotOwner.selector, alice));
        regenThemFund.withdraw();
        vm.stopPrank();
    }
    
    function testMinimumFundingRequirement() public {
        uint256 tooSmallAmount = 1 * 10**15; // 0.001 USDC (below minimum)
        
        // Try to fund with too small amount
        vm.startPrank(alice);
        IERC20(USDC_ADDRESS).approve(address(regenThemFund), tooSmallAmount);
        
        vm.expectRevert("You need to send more USDC!");
        regenThemFund.fund(tooSmallAmount);
        vm.stopPrank();
    }
    
    function testCreateMultipleFunds() public {
        // Create a second fund
        string memory name2 = "Second Fund";
        string memory desc2 = "Second Fund Description";
        uint256 goal2 = 200 * 10**18;
        
        factory.createRegenThemFund(name2, desc2, goal2);
        
        // Verify we have two funds now
        assertEq(factory.getRegenThemFundContracts().length, 2);
        
        // Get the second fund
        RegenThemFund secondFund = RegenThemFund(factory.regenThemFundContracts(1));
        
        // Verify its properties
        assertEq(secondFund.getName(), name2);
        assertEq(secondFund.getDescription(), desc2);
        assertEq(secondFund.getGoalAmount(), goal2);
    }
} 
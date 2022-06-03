//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IACDM_token.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error Uregistered();
error SelfReffering();
error ReRegistring();
error AlreadyStarted(string round);
error NotFinished(string round);
error AlreadyFinished(string round);
error AmountExeeded(uint256 amount0, uint256 amount1);

contract AcademPlatform is AccessControl, ReentrancyGuard {
    event SaleStarted(uint256 currentRound, uint256 timeStamp);
    event TradeStarted(uint256 currentRound, uint256 timeStamp);
    event OrderAdded(uint256 orderId, address orderOwner, uint256 amount, uint256 price);
    event OrderRemoved(uint256 orderId);
    event OrderRedeemed(uint256 orderId, address redeemer, uint256 amount, uint256 price);
    event BonusesChanged(uint256 saleLvl1, uint256 saleLvl2, uint256 tradeLvl1, uint256 tradeLvl2);

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant CHAIR_MAN = keccak256("CHAIR_MAN");

    using SafeERC20 for IACDM_token;
    IACDM_token public acdmToken;

    uint256 public roundTime;
    uint256 public currentRound = 0;
    uint256 public invDecimals;
    uint256 private orderId = 0;
    address public dao;

    mapping(address => User) public users;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Order) public orders;
    Bonus public bonuses;

    struct Order {
        address user;
        uint256 amount;
        uint256 price;
        bool isActive;
    }

    struct Round {
        RoundState round;
        uint256 startTime;
        uint256 tokenMintCount;
        uint256 tokenPrice;
        uint256 tradedEthCount;
    }

    struct User {
        bool isUser;
        address payable referrer1;
        address payable referrer2;
    }

    struct Bonus{
        uint256 saleLvl1;
        uint256 saleLvl2;
        uint256 tradeLvl1;
        uint256 tradeLvl2;
    }

    enum RoundState { sale, trade }

    /*
     * Constructor
     * @param {address} daoAddress - Address of the DAO
     * @param {address} acdmAddress - Address of the ACDM token
     * @param {uint256} _roundTime - Period of the round
     */
    constructor(address daoAddress, address acdmAddress, uint256 _roundTime) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CHAIR_MAN, msg.sender);

        dao = daoAddress;
        acdmToken = IACDM_token(acdmAddress);
        roundTime = _roundTime;
        invDecimals = (10**18/(10**acdmToken.decimals()));

        rounds[0].round = RoundState.trade;
        rounds[1].tokenPrice = 10 * invDecimals;
        rounds[0].tradedEthCount = 1 * 10**18;

        bonuses = Bonus(500, 300, 250, 250);
    }

    /*
     * Registers new user with referrer
     * @param {address payable} referrer - Referrer address
     */
    function register(address payable referrer) external {
        if(users[msg.sender].isUser) revert ReRegistring();
        if(referrer == msg.sender) revert SelfReffering();
        if(!users[referrer].isUser) revert Uregistered();

        users[msg.sender].isUser = true;
        users[msg.sender].referrer1 = referrer;
        users[msg.sender].referrer2 = users[referrer].referrer1;
    }
    
    /**
     * Registers new user
     */
    function register() external {
        if(users[msg.sender].isUser) revert ReRegistring();
        users[msg.sender].isUser = true;
    }

    /**
     * Starts sale round, only chairman can call this function
     */
    function startSaleRound() external onlyRole(CHAIR_MAN){
        currentRound++;
        if(rounds[currentRound-1].round != RoundState.trade) revert AlreadyStarted("sale");
        if(rounds[currentRound-1].startTime + roundTime >= block.timestamp) revert NotFinished("trade");        
        
        rounds[currentRound].startTime = block.timestamp;
        rounds[currentRound].round = RoundState.sale;

        uint256 tradeCount = rounds[currentRound - 1].tradedEthCount;
        uint256 tokenPrice = rounds[currentRound].tokenPrice;
        rounds[currentRound].tokenMintCount = tradeCount / tokenPrice;

        acdmToken.mint(address(this), rounds[currentRound].tokenMintCount);

        uint256 lastPrice = rounds[currentRound].tokenPrice / invDecimals;
        rounds[currentRound + 1].tokenPrice = ((((lastPrice * 103 + 400) * invDecimals) / 10**2) / invDecimals) * invDecimals;
        
        emit SaleStarted(currentRound, rounds[currentRound].startTime);
    }

    /**
     * Starts trade round, only chairman can call this function
     */
    function startTradeRound() external onlyRole(CHAIR_MAN){
        if(rounds[currentRound].round != RoundState.trade) revert AlreadyStarted("trade");
        if(rounds[currentRound].startTime + roundTime >= block.timestamp) revert NotFinished("sale");

        rounds[currentRound].startTime = block.timestamp;
        rounds[currentRound].round = RoundState.trade;

        emit TradeStarted(currentRound, rounds[currentRound].startTime);
    }
    
    /*
     * Buy ACDM tokens during sale round
     * @param {uint256} amount - Amount of tokens to buy
     */
    function buyACDM(uint256 amount) external payable nonReentrant{
        if(!users[msg.sender].isUser) revert Uregistered();
        if(rounds[currentRound].round != RoundState.sale) revert NotFinished("trade");
        if(rounds[currentRound].startTime + roundTime < block.timestamp) revert AlreadyFinished("sale");
        if(rounds[currentRound].tokenMintCount < amount) revert AmountExeeded(rounds[currentRound].tokenMintCount, amount);

        uint256 price = rounds[currentRound].tokenPrice;
        if(msg.value < amount*price) revert AmountExeeded(msg.value, amount*price);

        if(users[msg.sender].referrer1 != address(0)){
            uint256 bonus = (amount*price*bonuses.saleLvl1)/10000;
            users[msg.sender].referrer1.transfer(bonus);
        }
        else if(users[msg.sender].referrer2 != address(0)){
            uint256 bonus = (amount*price*bonuses.saleLvl2)/10000;
            users[msg.sender].referrer2.transfer(bonus);
        }

        rounds[currentRound].tokenMintCount -= amount;

        if(rounds[currentRound].tokenMintCount == 0){
            rounds[currentRound].startTime = 0;
        }

        acdmToken.safeTransfer(msg.sender, amount);
    }

    /*
     * Add order for trade round
     * @param {uint256} amount - Amount of tokens to buy
     * @param {uint256} price - Price of the token
     */
    function addOrder(uint256 amount, uint256 price) external{
        if(!users[msg.sender].isUser) revert Uregistered();
        if(rounds[currentRound].round != RoundState.trade) revert NotFinished("sale");
        if(rounds[currentRound].startTime + roundTime < block.timestamp) revert AlreadyFinished("trade");
        if(acdmToken.balanceOf(msg.sender) < amount) revert AmountExeeded(acdmToken.balanceOf(msg.sender), amount);

        orders[orderId].user = msg.sender;
        orders[orderId].amount = amount;
        orders[orderId].price = price;
        orders[orderId].isActive = true;

        acdmToken.safeTransferFrom(msg.sender, address(this), amount);

        emit OrderAdded(orderId, msg.sender, amount, price);
        orderId++;
    }

    /*
     * Cancel order
     * @param {uint256} orderId - Order id
     */
    function removeOrder(uint256 _orderId) external{
        require(orders[_orderId].user == msg.sender, "Not an owner");
        require(orders[_orderId].isActive, "No such order");
        if(rounds[currentRound].round != RoundState.trade) revert NotFinished("sale");
        if(rounds[currentRound].startTime + roundTime < block.timestamp) revert AlreadyFinished("trade");
        
        orders[_orderId].isActive = false;
        acdmToken.safeTransfer(msg.sender, orders[_orderId].amount);

        emit OrderRemoved(_orderId);
    }

    /*
     * Redeem order by id
     * @param {uint256} orderId - Order id
     * @param {uint256} amount - Amount of tokens to redeem
     */
    function redeemOrder(uint256 _orderId, uint256 amount) external payable nonReentrant{
        if(!users[msg.sender].isUser) revert Uregistered();
        require(orders[_orderId].isActive, "No such order");
        if(rounds[currentRound].round != RoundState.trade) revert NotFinished("sale");
        if(rounds[currentRound].startTime + roundTime < block.timestamp) revert AlreadyFinished("trade");

        uint256 price = orders[_orderId].price;
        uint256 currentAmount = orders[_orderId].amount;
        uint256 total = amount * price;
        uint256 bonus;

        if(currentAmount < amount) revert AmountExeeded(currentAmount, amount);
        if(msg.value < total) revert AmountExeeded(msg.value, total);

        if(amount == currentAmount){
            orders[_orderId].isActive = false;
        }
        else{
            orders[_orderId].amount -= amount;
        }

        rounds[currentRound].tradedEthCount += total;

        bonus = (total*bonuses.tradeLvl1)/10000;
        if(users[msg.sender].referrer1 != address(0)){         
            users[msg.sender].referrer1.transfer(bonus);
        } else{
            payable(dao).transfer(bonus);
        }
        total -= bonus;

        bonus = (total*bonuses.tradeLvl2)/10000;
        if(users[msg.sender].referrer2 != address(0)){
            users[msg.sender].referrer2.transfer(bonus);
        } else {
            payable(dao).transfer(bonus);
        }
        total -= bonus;
        
        acdmToken.safeTransfer(msg.sender, amount);
        payable(orders[_orderId].user).transfer(total);

        emit OrderRedeemed(_orderId, msg.sender, amount, price);
    }

    /**
     * Sets bonuses for lvl refferal, only dao can call this function
     */
    function setBonuses(
        uint256 _saleLvl1,
        uint256 _saleLvl2, 
        uint256 _tradeLvl1, 
        uint256 _tradeLvl2
    ) external onlyRole(DAO_ROLE) {
        bonuses.saleLvl1 = _saleLvl1;
        bonuses.saleLvl2 = _saleLvl2;
        bonuses.tradeLvl1 = _tradeLvl1;
        bonuses.tradeLvl2 = _tradeLvl2;

        emit BonusesChanged(bonuses.saleLvl1, bonuses.saleLvl2, bonuses.tradeLvl1, bonuses.tradeLvl2);
    }
}
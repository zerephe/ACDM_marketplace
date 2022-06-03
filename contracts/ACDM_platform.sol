//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IACDM_token.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

error Uregistered();
error SelfReffering();
error ReRegistring();
error AlreadyStarted(string round);
error NotFinished(string round);
error AlreadyFinished(string round);
error AmountExeeded(uint256 amount0, uint256 amount1);

contract AcademPlatform is AccessControl {
    event SaleStarted(uint256 currentRound, uint256 timeStamp);
    event TradeStarted(uint256 currentRound, uint256 timeStamp);
    event OrderAdded(uint256 orderId, address orderOwner, uint256 amount, uint256 price);
    event OrderRemoved(uint256 orderId);
    event OrderRedeemed(uint256 orderId, address redeemer, uint256 amount, uint256 price);
    event BonusesChanged(uint16 saleLvl1, uint16 saleLvl2, uint16 tradeLvl1, uint16 tradeLvl2);

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant CHAIR_MAN = keccak256("CHAIR_MAN");

    IACDM_token public acdmToken;

    uint16[] public bonuses;
    uint256 public roundTime;
    uint256 public currentRound = 0;
    uint256 public invDecimals;
    uint256 private orderId = 0;
    address public dao;

    mapping(address => User) public users;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Order) public orders;
    
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

        bonuses = new uint16[](4);
        bonuses[0] = 500;
        bonuses[1] = 300;
        bonuses[2] = 250;
        bonuses[3] = 250;
    }

    /*
     * Registers new user with referrer
     * @param {address payable} referrer - Referrer address
     */
    function register(address payable referrer) external {
        if(users[msg.sender].isUser) revert ReRegistring();
        if(referrer == msg.sender) revert SelfReffering();
        if(!users[referrer].isUser) revert Uregistered();

        users[msg.sender] = User(true, referrer, users[referrer].referrer1);
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
        Round memory prevRound = rounds[currentRound-1];
        Round memory currRound = rounds[currentRound];

        if(prevRound.round != RoundState.trade) revert AlreadyStarted("sale");
        if(prevRound.startTime + roundTime >= block.timestamp) revert NotFinished("trade");        
        
        currRound.startTime = block.timestamp;
        currRound.round = RoundState.sale;

        currRound.tokenMintCount = prevRound.tradedEthCount / currRound.tokenPrice;

        acdmToken.mint(address(this), currRound.tokenMintCount);

        uint256 lastPrice = currRound.tokenPrice / invDecimals;
        rounds[currentRound + 1].tokenPrice = ((((lastPrice * 103 + 400) * invDecimals) / 10**2) / invDecimals) * invDecimals;
        
        emit SaleStarted(currentRound, currRound.startTime);
    }

    /**
     * Starts trade round, only chairman can call this function
     */
    function startTradeRound() external onlyRole(CHAIR_MAN){
        Round memory currRound = rounds[currentRound];
        
        if(currRound.round != RoundState.trade) revert AlreadyStarted("trade");
        if(currRound.startTime + roundTime >= block.timestamp) revert NotFinished("sale");

        currRound.startTime = block.timestamp;
        currRound.round = RoundState.trade;

        emit TradeStarted(currentRound, currRound.startTime);
    }
    
    /*
     * Buy ACDM tokens during sale round
     * @param {uint256} amount - Amount of tokens to buy
     */
    function buyACDM(uint256 amount) external payable {
        Round memory currRound = rounds[currentRound];
        
        if(!users[msg.sender].isUser) revert Uregistered();
        if(currRound.round != RoundState.sale) revert NotFinished("trade");
        if(currRound.startTime + roundTime < block.timestamp) revert AlreadyFinished("sale");
        if(currRound.tokenMintCount < amount) revert AmountExeeded(currRound.tokenMintCount, amount);

        uint256 price = currRound.tokenPrice;
        if(msg.value < amount*price) revert AmountExeeded(msg.value, amount*price);

        if(users[msg.sender].referrer1 != address(0)){
            uint256 bonus = (amount*price*bonuses[0])/10000;
            users[msg.sender].referrer1.transfer(bonus);
        }
        else if(users[msg.sender].referrer2 != address(0)){
            uint256 bonus = (amount*price*bonuses[1])/10000;
            users[msg.sender].referrer2.transfer(bonus);
        }

        currRound.tokenMintCount -= amount;

        if(currRound.tokenMintCount == 0){
            currRound.startTime = 0;
        }

        acdmToken.transfer(msg.sender, amount);
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

        orders[orderId] = Order(msg.sender, amount, price, true);

        acdmToken.transferFrom(msg.sender, address(this), amount);

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
        acdmToken.transfer(msg.sender, orders[_orderId].amount);

        emit OrderRemoved(_orderId);
    }

    /*
     * Redeem order by id
     * @param {uint256} orderId - Order id
     * @param {uint256} amount - Amount of tokens to redeem
     */
    function redeemOrder(uint256 _orderId, uint256 amount) external payable {
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

        bonus = (total*bonuses[2])/10000;
        if(users[msg.sender].referrer1 != address(0)){         
            users[msg.sender].referrer1.transfer(bonus);
        } else{
            payable(dao).transfer(bonus);
        }
        total -= bonus;

        bonus = (total*bonuses[3])/10000;
        if(users[msg.sender].referrer2 != address(0)){
            users[msg.sender].referrer2.transfer(bonus);
        } else {
            payable(dao).transfer(bonus);
        }
        total -= bonus;
        
        acdmToken.transfer(msg.sender, amount);
        payable(orders[_orderId].user).transfer(total);

        emit OrderRedeemed(_orderId, msg.sender, amount, price);
    }

    /**
     * Sets bonuses for lvl refferal, only dao can call this function
     */
    function setBonuses(uint16 b1, uint16 b2, uint16 b3, uint16 b4) external onlyRole(DAO_ROLE) {
        bonuses[0] = b1;
        bonuses[1] = b2;
        bonuses[2] = b3;
        bonuses[3] = b4;

        emit BonusesChanged(bonuses[0], bonuses[1], bonuses[2], bonuses[3]);
    }
}
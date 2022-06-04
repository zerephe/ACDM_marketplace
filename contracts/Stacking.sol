//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IDAO {
    function setVotes(address voterAddress, uint256 amount) external returns(bool);
}

contract Stacking is AccessControl, ReentrancyGuard {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    using SafeERC20 for ERC20;
    ERC20 public stakeToken;
    ERC20 public rewardToken;
    IDAO public dao;

    uint256 public rewardCo;
    uint256 public rewardGenTime;
    uint256 public tokenLockTime;

    mapping(address => StakeToken) private stakes;

    struct StakeToken {
        uint256 amount;
        uint256 timestamp;
    }


    /*
     * Constructor - sets initial values and roles
     * @param {address} _lpToken - Address of the token used for stakes
     * @param {address} _rewardToken - Address of the token used for rewards
     * @param {address} daoAddress - Address of the DAO contract
     */
    constructor(address _lpToken, address _rewardToken, address daoAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DAO_ROLE, daoAddress);

        rewardCo = 300;
        rewardGenTime = 7 days;
        tokenLockTime = 30 days;
        stakeToken = ERC20(_lpToken);
        rewardToken = ERC20(_rewardToken);
        dao = IDAO(daoAddress);
    }
    
    /**
     * Stake tokens in order to participate in DAO voting
     * @param {uint256} amount - Amount of tokens to stake
     * @return {bool} - Returns true if transaction succeed
     */
    function stake(uint256 amount) external returns(bool) {        
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender] = StakeToken(stakes[msg.sender].amount + amount, block.timestamp);
        dao.setVotes(msg.sender, stakes[msg.sender].amount);

        return true;
    }

    /**
     * Withdraws tokens from the stake
     * @return {bool} - Returns true if transaction succeed
     */
    function unstake() external nonReentrant returns(bool) {
        uint256 _locktime = stakes[msg.sender].timestamp + tokenLockTime;
        require(_locktime <= block.timestamp, "Too soon to unstake mf!");
        require(stakes[msg.sender].amount > 0, "Nothing to unstake mf!");

        stakeToken.safeTransfer(msg.sender, stakes[msg.sender].amount);

        _claim(msg.sender);

        stakes[msg.sender].amount = 0;
        dao.setVotes(msg.sender, stakes[msg.sender].amount);

        return true;
    }

    /**
     * Claim tokens from the reward
     * @return {bool} - Returns true if transaction succeed
     */
    function claim() external nonReentrant returns(bool) {

        _claim(msg.sender);

        return true;
    }

    /**
     * Internal claim function
     * @return {bool} - Returns true if transaction succeed
     */
    function _claim(address _owner) internal returns(bool) {
        require(stakes[_owner].amount > 0, "You are not a staker mf!");
        uint256 _rewardGen = (block.timestamp - stakes[_owner].timestamp) / rewardGenTime;


        uint256 _reward = _rewardGen * ((stakes[_owner].amount * rewardCo) / 10000);
        rewardToken.safeTransfer(_owner, _reward);

        return true;
    }

    /**
     * Internal claim function
     * @param {uint256} _rewardCo - Reward coefficient
     * @return {bool} - Returns true if transaction succeed
     */
    function setReward(uint256 _rewardCo) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool) {
        require(_rewardCo <= 10000, "Too high reward mf!");

        rewardCo = _rewardCo;

        return true;
    }

    /**
     * Sets token lock time
     * @param {uint256} _tokenLockTime - Token lock time
     * @return {bool} - Returns true if transaction succeed
     */
    function setLockTime(uint256 _tokenLockTime) external onlyRole(DAO_ROLE) returns(bool) {
        require(_tokenLockTime >= 1, "Min token locktime is 1 mf!");

        tokenLockTime = _tokenLockTime * 1 days;

        return true;
    }

    /**
     * Sets token lock time
     * @param {address} _owner - Address of the stake owner
     * @return {bool} - Returns true if transaction succeed
     */
    function getStakeAmount(address _owner) external view returns(uint256) {
        return stakes[_owner].amount;
    }
}

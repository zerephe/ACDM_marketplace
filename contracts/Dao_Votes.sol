//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IACDM_token.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IUniswapV2Router01.sol";

contract DAO is AccessControl {
    using SafeERC20 for IACDM_token;

    bytes32 public constant CHAIR_MAN = keccak256("CHAIR_MAN");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    
    address private constant WETH9 = 0xc778417E063141139Fce010982780140Aa0cD5Ab;
    address private constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    IACDM_token public xxxToken;

    address public chairMan;
    address public owner;
    uint256 public minQ;
    uint256 public debatePeriod;
    uint256 private propId = 0;

    struct Voters {
        uint256 depositedAmount;
        mapping(uint256 => uint256) voteCount;
    }

    struct Proposals {
        address recipient;
        bytes callData;
        string description;
        uint256 timeStamp;
        mapping(bool => uint256) position;
    }

    mapping(address => Voters) public voters;
    mapping(uint256 => Proposals) public proposals;

    /*
     * Constructor 
     * @param {address} _chairMan - Chairman address
     * @param {address} _voteTokenAddress - Deposit token
     * @param {uint256} _minQ - Minimal quorum
     * @param {uint256} _dabatePeriod - Lock period of debates
     */
    constructor(address _chairMan, address xxxAddress, uint256 _minQ, uint256 _dabatePeriod) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CHAIR_MAN, _chairMan);
        _grantRole(DAO_ROLE, address(this));

        xxxToken = IACDM_token(xxxAddress);
        owner = msg.sender;
        chairMan = _chairMan;
        minQ = _minQ;
        debatePeriod = _dabatePeriod;
    }

    /**
     * Sets new chairman
     * @param {address} _chairMan - Chairman address
     */
    function updateChairMan(address _chairMan) external onlyRole(DEFAULT_ADMIN_ROLE) returns(bool) {
        _grantRole(CHAIR_MAN, _chairMan);

        chairMan = _chairMan;

        return true;
    }


    /**
     * Updates DAO's parameters, such as debate period
     * @param {address} _voteTokenAddress - Deposit token
     * @param {uint256} _minQ - Minimal quorum
     * @param {uint256} _dabatePeriod - Lock period of debates
     */
    function updateProposalParams(
        uint256 _minQ, 
        uint256 _dabatePeriod
    ) external onlyRole(DAO_ROLE) returns(bool) {
        minQ = _minQ;
        debatePeriod = _dabatePeriod;

        return true;
    }

    /**
     * Add proposal
     * @param {address} recipient - Contract address of call function
     * @param {bytes} callData - Calldata
     * @param {string} description - Description
     */
    function addProposal(address recipient, bytes memory callData, string memory description) external onlyRole(CHAIR_MAN) returns(bool) {
        proposals[propId].recipient = recipient;
        proposals[propId].callData = callData;
        proposals[propId].description = description;
        proposals[propId].timeStamp = block.timestamp;        

        propId++;

        return true;
    }

    /**
     * Vote for or against by id
     * @param {uint256} _propId - Uniqe ID of proposal
     * @param {uint256} amount - Amount of votes
     * @param {bool} position - Voter position (for-against)
     */
    function vote(uint256 _propId, uint256 amount, bool position) external returns(bool) {
        require(proposals[_propId].timeStamp + debatePeriod >= block.timestamp, "Proposal doesn't exist!");
        require(voters[msg.sender].depositedAmount >= voters[msg.sender].voteCount[_propId] + amount, "Not enough votes!");

        proposals[_propId].position[position] += amount;
        voters[msg.sender].voteCount[_propId] += amount;

        return true;
    }

    /**
     * Finish proposal by id
     * @param {uint256} _propId - Uniqe ID of proposal
     */
    function finishProposal(uint256 _propId) external returns(bool) {
        require(proposals[_propId].timeStamp != 0, "Proposal doesn't exist!");
        require(proposals[_propId].timeStamp + debatePeriod <= block.timestamp, "Too soon to finish!");
        require(proposals[_propId].position[true] + proposals[_propId].position[false] >= minQ, "MinQ doesnt reached!");


        if(proposals[_propId].position[true] >= proposals[_propId].position[false]) {
            (bool success, ) = proposals[_propId].recipient.call{value: 0}(
                proposals[_propId].callData
            );
            
            require(success, "ERROR call func");
        }
        
        return true;
    }

    /**
     * Get specific position count by proposal id
     * @param {uint256} _propId - Proposal id
     * @param {bool} position - Position (for-against)
     * @return {uint256} - Returns position count
     */
    function getProposalPositions(uint256 _propId, bool position) external view returns(uint256){
        return proposals[_propId].position[position];
    }

    /**
     * Get voter position count for specific proposal by id
     * @param {address} voterAddress - Voter's address
     * @param {uint256} _propId - Proposal id
     * @return {uint256} - Returns position count
     */
    function getVoterPositionForProposal(address voterAddress, uint256 _propId) external view returns(uint256){
        return voters[voterAddress].voteCount[_propId];
    }

    function setVotes(address voterAddress, uint256 amount) external onlyRole(CHAIR_MAN) returns(bool) {
        voters[voterAddress].depositedAmount = amount;
        return true;
    }

    function sendToOwner() external onlyRole(DAO_ROLE) returns(bool) {
        payable(owner).transfer(address(this).balance);
        return true;
    }

    
    function burnXXX() external onlyRole(DAO_ROLE) returns(bool) {
        address[] memory path;
        path = new address[](2);
        path[0] = WETH9;
        path[1] = address(xxxToken);

        uint256 amountOut = getAmountOutMin(WETH9, address(xxxToken), address(this).balance);
        IUniswapV2Router01(UNISWAP_V2_ROUTER).swapExactETHForTokens{value: address(this).balance}(
            amountOut,
            path,
            msg.sender,
            block.timestamp
        );

        xxxToken.burn(amountOut);
        
        return true;
    }

    function getAmountOutMin(address _tokenIn, address _tokenOut, uint256 _amountIn) public view returns (uint256) {

        address[] memory path;
        if (_tokenIn == WETH9 || _tokenOut == WETH9) {
            path = new address[](2);
            path[0] = _tokenIn;
            path[1] = _tokenOut;
        } else {
            path = new address[](3);
            path[0] = _tokenIn;
            path[1] = WETH9;
            path[2] = _tokenOut;
        }
        
        uint256[] memory amountOutMins = IUniswapV2Router01(UNISWAP_V2_ROUTER).getAmountsOut(_amountIn, path);
        return amountOutMins[path.length -1];  
    }
}
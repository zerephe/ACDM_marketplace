// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ACDMTokens is ERC20, AccessControl, ERC20Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint8 private deci;
    
    constructor(string memory name, string memory symbol, uint8 _deci) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        deci = _deci;
    }

    /**
     * Mints tokens to specific address
     * @param {address} to - Address of recipient
     * @param {uint256} amount - Amount to mint
     * @return {bool} - Returns true if transaction succeed
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) returns(bool){
        _mint(to, amount);

        return true;
    }

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() public view virtual override returns (uint8) {
        return deci;
    }
}

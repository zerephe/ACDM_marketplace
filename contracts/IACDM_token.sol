// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IACDM_token {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;

    function decimals() external view returns (uint8);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

}
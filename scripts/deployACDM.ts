import { ethers } from "hardhat";

async function main() {
 /* Deploying the contract */
  const [owner] = await ethers.getSigners()
  const Token = await ethers.getContractFactory("ACDMTokens", owner);
  const tokenInstance = await Token.deploy("ACADEM Coin", "ACDM", 6);
 
  await tokenInstance.deployed();

  console.log("Deployed to:", tokenInstance.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default {
  solidity: "0.8.4"
};
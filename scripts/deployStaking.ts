import { ethers } from "hardhat";

async function main() {
 /* Deploying the contract */
  const [owner] = await ethers.getSigners()
  const Staking = await ethers.getContractFactory("Stacking", owner);
  const stakingInstance = await Staking.deploy(
    "0x37B67e5bcD3d88862680Bc6aF77c69196F24Cf6F", 
    "0x7b5a0FCC84A85f5074f0400857000bDEB1552C5b", 
    "0x13524b2d01aDeF1C48DE1Bacdf2EB63D0f2eA111"
  );
 
  await stakingInstance.deployed();

  console.log("Deployed to:", stakingInstance.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default {
  solidity: "0.8.4"
};
import { ethers } from "hardhat";

async function main() {
 /* Deploying the contract */
  const [owner] = await ethers.getSigners()
  const ACDM = await ethers.getContractFactory("AcademPlatform", owner);
  const platformInstance = await ACDM.deploy("0x13524b2d01aDeF1C48DE1Bacdf2EB63D0f2eA111", "0xCf0C93E93075c9D6A4230F3c68e4921A39633E65", 3);
 
  await platformInstance.deployed();

  console.log("Deployed to:", platformInstance.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default {
  solidity: "0.8.4"
};
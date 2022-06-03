import { ethers } from "hardhat";

async function main() {
 /* Deploying the contract */
  const [owner] = await ethers.getSigners()
  const DAO = await ethers.getContractFactory("DAO", owner);
  const daoInstance = await DAO.deploy(owner.address, "0x7a73017403F934f56DA85Cc5F9724eedf7a271bB", 1000, 10000);
 
  await daoInstance.deployed();

  console.log("Deployed to:", daoInstance.address);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default {
  solidity: "0.8.4"
};
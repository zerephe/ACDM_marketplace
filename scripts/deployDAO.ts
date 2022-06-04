import { ethers } from "hardhat";

async function main() {
 /* Deploying the contract */
  const [owner] = await ethers.getSigners()
  const DAO = await ethers.getContractFactory("DAO", owner);
  const daoInstance = await DAO.deploy("0x7A49BABc429b5f5a44C77d6c82f27a1D3EcbF1D5", "0x7b5a0FCC84A85f5074f0400857000bDEB1552C5b", 1000, 86400);
 
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
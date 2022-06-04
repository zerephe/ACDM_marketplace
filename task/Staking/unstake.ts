import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("unstake", "Unstake staked tokens")
  .setAction(async (hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const stakingToken = await hre.ethers.getContractAt("Stacking", contractAddress)

    const result = await stakingToken.unstake();
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("stake", "Stake tokens to pool")
  .addParam("amount", "Amount to stake")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const stakingToken = await hre.ethers.getContractAt("Stacking", contractAddress)

    const result = await stakingToken.stake(args.amount);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
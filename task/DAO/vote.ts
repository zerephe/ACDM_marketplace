import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("vote", "Vote for or against")
  .addParam("id", "Proposal ID")
  .addParam("amount", "Amount to deposit")
  .addParam("position", "Fro or against(true-false)")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const daoInstance = await hre.ethers.getContractAt("DAO", contractAddress);

    const result = await daoInstance.vote(args.id, args.amount, args.position);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
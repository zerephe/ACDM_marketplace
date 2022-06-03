import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("deposit", "Deposit tokens in dao")
  .addParam("amount", "Amount to deposit")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const daoInstance = await hre.ethers.getContractAt("DAO", contractAddress);

    const result = await daoInstance.deposit(args.amount);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
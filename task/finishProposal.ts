import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("finishProposal", "Finish proposal")
  .addParam("id", "Proposal ID")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const daoInstance = await hre.ethers.getContractAt("DAO", contractAddress);

    const result = await daoInstance.finishProposal(args.id);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
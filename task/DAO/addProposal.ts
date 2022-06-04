import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("addProposal", "Add proposal to dao")
  .addParam("recipient", "Recepient address")
  .addParam("calldata", "Function calldata")
  .addParam("description", "Proposal description")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const daoInstance = await hre.ethers.getContractAt("DAO", contractAddress);

    const result = await daoInstance.addProposal(args.recipient, args.calldata, args.description);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
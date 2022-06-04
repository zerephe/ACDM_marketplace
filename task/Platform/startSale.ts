import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("startSale", "Start sale round")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const platformInstance = await hre.ethers.getContractAt("AcademPlatform", contractAddress);

    const result = await platformInstance.startSaleRound();
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
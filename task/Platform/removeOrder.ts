import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("removeOrder", "Remove order")
  .addParam("orderId", "Order id")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const platformInstance = await hre.ethers.getContractAt("AcademPlatform", contractAddress);

    const result = await platformInstance.removeOrder(args.orderId);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
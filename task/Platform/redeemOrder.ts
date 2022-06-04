import * as dotenv from "dotenv";
import { task } from "hardhat/config";

dotenv.config();

task("redeemOrder", "Redeem order")
  .addParam("orderId", "Order id")
  .addParam("price", "Price of one ACDM")
  .setAction(async (args, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS as string;
    const platformInstance = await hre.ethers.getContractAt("AcademPlatform", contractAddress);

    const result = await platformInstance.redeemOrder(args.orderId, args.price);
    console.log(result);
  });

  export default {
    solidity: "0.8.4"
  };
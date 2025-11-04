import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the PaymentSBT contract
 * 
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployPaymentSBT: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🏗️  Deploying PaymentSBT contract...\n");

  // Deploy PaymentSBT
  console.log("1️⃣  Deploying PaymentSBT...");
  const paymentSBT = await deploy("PaymentSBT", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  console.log("✅ PaymentSBT deployed at:", paymentSBT.address);

  // Verify deployment
  const paymentSBTContract = await hre.ethers.getContract<Contract>("PaymentSBT", deployer);
  const totalSupply = await paymentSBTContract.totalSupply();

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PaymentSBT:          ", paymentSBT.address);
  console.log("Initial Total Supply:", totalSupply.toString());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎉 PaymentSBT deployment complete!\n");
};

export default deployPaymentSBT;

deployPaymentSBT.tags = ["PaymentSBT"];


import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 PaymentSBT 部署信息
const deploymentPath = path.join(__dirname, "../deployments/bscTestnet/PaymentSBT.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

/**
 * 查询指定地址拥有的 SBT 数量和信息
 * 
 * 使用方法:
 *   npx hardhat run scripts/querySBTsByAddress.ts --network bscTestnet
 * 
 * 或者指定地址:
 *   ADDRESS=0xB05955b5D34171bd9675B9D0BFfe1c73818E671e npx hardhat run scripts/querySBTsByAddress.ts --network bscTestnet
 */
async function main() {
  // 从环境变量获取地址，默认使用指定的地址
  const targetAddress = process.env.ADDRESS || "0xB05955b5D34171bd9675B9D0BFfe1c73818E671e";
  
  console.log("=".repeat(60));
  console.log("查询 SBT 信息");
  console.log("=".repeat(60));
  console.log(`目标地址: ${targetAddress}`);
  console.log(`合约地址: ${deployment.address}`);
  console.log("");

  // 获取合约实例
  const PaymentSBT = await ethers.getContractAt(
    "PaymentSBT",
    deployment.address
  );

  try {
    // 查询余额（SBT 数量）
    const balance = await PaymentSBT.balanceOf(targetAddress);
    console.log(`✅ SBT 数量: ${balance.toString()}`);

    if (balance > 0n) {
      // 查询所有 Token IDs
      const tokenIds = await PaymentSBT.getTokensByOwner(targetAddress);
      console.log(`\n📋 Token IDs (共 ${tokenIds.length} 个):`);
      tokenIds.forEach((tokenId, index) => {
        console.log(`  ${index + 1}. Token ID: ${tokenId.toString()}`);
      });

      // 查询详细信息（最多显示前10个）
      console.log(`\n📊 SBT 详细信息:`);
      const displayCount = Math.min(tokenIds.length, 10);
      for (let i = 0; i < displayCount; i++) {
        const tokenId = tokenIds[i];
        try {
          const paymentInfo = await PaymentSBT.getPaymentInfo(tokenId);
          const rarity = paymentInfo.rarity === 0 ? "Common" : "Rare";
          const amountInEth = ethers.formatEther(paymentInfo.amount);
          const timestamp = new Date(Number(paymentInfo.timestamp) * 1000).toLocaleString();
          
          console.log(`\n  Token ID: ${tokenId.toString()}`);
          console.log(`    - 金额: ${amountInEth} BNB`);
          console.log(`    - 付款人: ${paymentInfo.payer}`);
          console.log(`    - 收款人: ${paymentInfo.recipient}`);
          console.log(`    - 稀有度: ${rarity}`);
          console.log(`    - 推荐码: ${paymentInfo.referrer || "(无)"}`);
          console.log(`    - 描述: ${paymentInfo.description || "(无)"}`);
          console.log(`    - 时间戳: ${timestamp}`);
        } catch (error: any) {
          console.log(`  Token ID: ${tokenId.toString()} - 查询失败: ${error.message}`);
        }
      }

      if (tokenIds.length > 10) {
        console.log(`\n  ... 还有 ${tokenIds.length - 10} 个 SBT 未显示`);
      }

      // 查询稀有度统计
      try {
        const rarityStats = await PaymentSBT.getRarityStatsByOwner(targetAddress);
        console.log(`\n📈 稀有度统计:`);
        console.log(`  - Common: ${rarityStats.common.toString()}`);
        console.log(`  - Rare: ${rarityStats.rare.toString()}`);
        console.log(`  - 总计: ${rarityStats.total.toString()}`);
      } catch (error: any) {
        console.log(`\n⚠️  无法查询稀有度统计: ${error.message}`);
      }
    } else {
      console.log("\n该地址没有 SBT");
    }

    console.log("\n" + "=".repeat(60));
  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
    if (error.data) {
      console.error("错误数据:", error.data);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


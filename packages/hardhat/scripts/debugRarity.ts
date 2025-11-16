import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 PaymentSBT 部署信息
const deploymentPath = path.join(__dirname, "../deployments/bscTestnet/PaymentSBT.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

/**
 * 调试稀有度生成逻辑
 * 检查为什么所有 SBT 都是 Rare
 */
async function main() {
  console.log("=".repeat(60));
  console.log("调试稀有度生成逻辑");
  console.log("=".repeat(60));
  console.log(`合约地址: ${deployment.address}`);
  console.log("");

  const PaymentSBT = await ethers.getContractAt(
    "PaymentSBT",
    deployment.address
  );

  try {
    // 读取常量
    const COMMON_PROBABILITY = await PaymentSBT.COMMON_PROBABILITY();
    console.log(`📊 COMMON_PROBABILITY: ${COMMON_PROBABILITY}`);
    console.log(`📊 RARE_PROBABILITY: ${100 - Number(COMMON_PROBABILITY)}%`);
    console.log("");

    // 查询所有 SBT 的稀有度
    const totalSupply = await PaymentSBT.totalSupply();
    console.log(`总 SBT 数量: ${totalSupply.toString()}`);
    console.log("");

    // 统计稀有度
    let commonCount = 0;
    let rareCount = 0;

    for (let i = 1; i <= Number(totalSupply); i++) {
      const tokenId = BigInt(i);
      const exists = await PaymentSBT.exists(tokenId);
      if (!exists) continue;

      const rarity = await PaymentSBT.getRarity(tokenId);
      const rarityName = rarity === 0 ? "Common" : "Rare";
      
      if (rarity === 0) {
        commonCount++;
      } else {
        rareCount++;
      }

      // 获取付款信息以查看详细信息
      const paymentInfo = await PaymentSBT.getPaymentInfo(tokenId);
      const timestamp = new Date(Number(paymentInfo.timestamp) * 1000).toLocaleString();
      
      console.log(`Token ID ${tokenId}: ${rarityName} (时间: ${timestamp})`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 稀有度统计");
    console.log("=".repeat(60));
    console.log(`Common: ${commonCount} 个 (${((commonCount / Number(totalSupply)) * 100).toFixed(2)}%)`);
    console.log(`Rare: ${rareCount} 个 (${((rareCount / Number(totalSupply)) * 100).toFixed(2)}%)`);
    console.log(`总计: ${totalSupply.toString()} 个`);
    console.log("");

    // 检查概率是否正确
    const expectedCommon = Math.floor(Number(totalSupply) * 0.7);
    const expectedRare = Math.ceil(Number(totalSupply) * 0.7);
    
    console.log("预期分布（70% Common, 30% Rare）:");
    console.log(`  Common: 约 ${expectedCommon}-${expectedRare} 个`);
    console.log(`  Rare: 约 ${Number(totalSupply) - expectedRare}-${Number(totalSupply) - expectedCommon} 个`);
    console.log("");

    if (commonCount === 0 && rareCount === Number(totalSupply)) {
      console.log("⚠️  警告: 所有 SBT 都是 Rare，这不符合 70/30 的概率分布！");
      console.log("可能的原因:");
      console.log("  1. 随机数生成逻辑有问题");
      console.log("  2. 所有随机数都恰好 >= 70");
      console.log("  3. 样本量太小（只有 5 个），统计偏差");
      console.log("  4. 合约代码与部署的版本不一致");
    } else if (commonCount === Number(totalSupply)) {
      console.log("⚠️  警告: 所有 SBT 都是 Common，这也不符合 70/30 的概率分布！");
    } else {
      console.log("✅ 稀有度分布看起来正常");
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


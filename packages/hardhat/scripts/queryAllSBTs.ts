import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 PaymentSBT 部署信息
const deploymentPath = path.join(__dirname, "../deployments/bscTestnet/PaymentSBT.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

/**
 * 查询所有 SBT 信息
 * 
 * 使用方法:
 *   npx hardhat run scripts/queryAllSBTs.ts --network bscTestnet
 */
async function main() {
  console.log("=".repeat(60));
  console.log("查询所有 SBT 信息");
  console.log("=".repeat(60));
  console.log(`合约地址: ${deployment.address}`);
  console.log("");

  // 获取合约实例
  const PaymentSBT = await ethers.getContractAt(
    "PaymentSBT",
    deployment.address
  );

  try {
    // 查询总供应量
    const totalSupply = await PaymentSBT.totalSupply();
    console.log(`📊 总 SBT 数量: ${totalSupply.toString()}`);
    console.log("");

    if (totalSupply === 0n) {
      console.log("目前还没有铸造任何 SBT");
      return;
    }

    // 查询合约余额
    const contractBalance = await PaymentSBT.getContractBalance();
    console.log(`💰 合约余额: ${ethers.formatEther(contractBalance)} BNB`);
    console.log("");

    // 统计信息
    const ownerMap = new Map<string, number>();
    const rarityMap = new Map<string, number>();
    let totalAmount = 0n;

    console.log("=".repeat(60));
    console.log("所有 SBT 详细信息");
    console.log("=".repeat(60));

    // 遍历所有 Token ID（从 1 开始）
    for (let i = 1; i <= Number(totalSupply); i++) {
      try {
        const tokenId = BigInt(i);
        
        // 检查 Token 是否存在
        const exists = await PaymentSBT.exists(tokenId);
        if (!exists) {
          console.log(`⚠️  Token ID ${tokenId} 不存在，跳过`);
          continue;
        }

        // 获取拥有者
        const owner = await PaymentSBT.ownerOf(tokenId);
        
        // 获取付款信息
        const paymentInfo = await PaymentSBT.getPaymentInfo(tokenId);
        
        // 统计
        const ownerCount = ownerMap.get(owner) || 0;
        ownerMap.set(owner, ownerCount + 1);
        
        const rarity = paymentInfo.rarity === 0 ? "Common" : "Rare";
        const rarityCount = rarityMap.get(rarity) || 0;
        rarityMap.set(rarity, rarityCount + 1);
        
        totalAmount += paymentInfo.amount;

        // 显示详细信息
        const amountInEth = ethers.formatEther(paymentInfo.amount);
        const timestamp = new Date(Number(paymentInfo.timestamp) * 1000).toLocaleString();
        
        console.log(`\n📌 Token ID: ${tokenId.toString()}`);
        console.log(`   拥有者: ${owner}`);
        console.log(`   金额: ${amountInEth} BNB`);
        console.log(`   付款人: ${paymentInfo.payer}`);
        console.log(`   收款人: ${paymentInfo.recipient}`);
        console.log(`   稀有度: ${rarity}`);
        console.log(`   推荐码: ${paymentInfo.referrer || "(无)"}`);
        console.log(`   描述: ${paymentInfo.description || "(无)"}`);
        console.log(`   时间戳: ${timestamp}`);
      } catch (error: any) {
        console.log(`\n❌ Token ID ${i} 查询失败: ${error.message}`);
      }
    }

    // 显示统计信息
    console.log("\n" + "=".repeat(60));
    console.log("📈 统计信息");
    console.log("=".repeat(60));
    
    console.log(`\n总金额: ${ethers.formatEther(totalAmount)} BNB`);
    
    console.log(`\n稀有度分布:`);
    rarityMap.forEach((count, rarity) => {
      const percentage = ((count / Number(totalSupply)) * 100).toFixed(2);
      console.log(`  - ${rarity}: ${count} 个 (${percentage}%)`);
    });
    
    console.log(`\n拥有者分布 (共 ${ownerMap.size} 个地址):`);
    const sortedOwners = Array.from(ownerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // 只显示前20个
    
    sortedOwners.forEach(([owner, count]) => {
      const percentage = ((count / Number(totalSupply)) * 100).toFixed(2);
      console.log(`  - ${owner}: ${count} 个 (${percentage}%)`);
    });
    
    if (ownerMap.size > 20) {
      console.log(`  ... 还有 ${ownerMap.size - 20} 个地址未显示`);
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


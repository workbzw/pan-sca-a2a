import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件（从项目根目录）
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 查询新合约的推荐码统计信息
 */
async function main() {
  // 新合约地址
  const PAYMENT_SBT_ADDRESS = "0x1956f3E39c7a9Bdd8E35a0345379692C3f433898";
  
  // 获取网络配置
  const networkName = "bscTestnet";
  const network = config.networks[networkName];
  
  if (!network || !("url" in network)) {
    console.error(`❌ 网络 ${networkName} 未配置或无效`);
    return;
  }

  console.log(`📌 新合约地址: ${PAYMENT_SBT_ADDRESS}`);
  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`📄 合约地址: ${PAYMENT_SBT_ADDRESS}\n`);

  // 创建 provider
  const provider = new ethers.JsonRpcProvider(network.url);
  
  // 创建合约实例
  const contract = new ethers.Contract(PAYMENT_SBT_ADDRESS, PaymentSBT_ABI, provider);

  try {
    console.log("🔍 正在查询推荐码统计信息...\n");

    // 查询所有推荐码和推荐数量
    const [referrers, counts] = await contract.getReferrerStats();

    if (referrers.length === 0) {
      console.log("📭 目前还没有推荐码记录");
      return;
    }

    // 格式化数据并过滤掉空字符串
    const referrerStats = referrers
      .map((referrer: string, index: number) => ({
        code: referrer,
        count: Number(counts[index]),
      }))
      .filter((stat: any) => stat.code.trim().length > 0);

    if (referrerStats.length === 0) {
      console.log("📭 目前还没有有效的推荐码记录（已过滤空字符串）");
      return;
    }

    // 按推荐数量排序（从高到低）
    referrerStats.sort((a: any, b: any) => b.count - a.count);

    // 显示结果
    console.log("=".repeat(80));
    console.log(`📊 推荐码排行榜 (共 ${referrerStats.length} 个有效推荐码，已过滤空字符串)`);
    console.log("=".repeat(80));
    console.log(`${"排名".padEnd(6)}${"推荐码".padEnd(30)}${"推荐数量"}`);
    console.log("-".repeat(80));

    referrerStats.forEach((stat: any, index: number) => {
      const rank = (index + 1).toString().padEnd(6);
      const code = stat.code.padEnd(30);
      const count = stat.count.toString();
      console.log(`${rank}${code}${count}`);
    });

    console.log("-".repeat(80));
    
    // 统计信息
    const totalReferrals = referrerStats.reduce((sum: number, stat: any) => sum + stat.count, 0);
    const avgReferrals = totalReferrals / referrerStats.length;
    const maxReferrals = referrerStats[0].count;
    const minReferrals = referrerStats[referrerStats.length - 1].count;
    
    console.log(`\n📈 统计信息:`);
    console.log(`   总推荐次数: ${totalReferrals}`);
    console.log(`   平均推荐次数: ${avgReferrals.toFixed(2)}`);
    console.log(`   最高推荐次数: ${maxReferrals}`);
    console.log(`   最低推荐次数: ${minReferrals}`);
    
  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
    if (error.reason) {
      console.error("错误原因:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


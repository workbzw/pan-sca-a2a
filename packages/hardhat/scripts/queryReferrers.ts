import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件（从项目根目录）
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 查询所有推荐人的推荐数量
 * 
 * 使用方法:
 *   yarn hardhat run scripts/queryReferrers.ts --network bscTestnet
 *   yarn hardhat run scripts/queryReferrers.ts --network bscTestnet <合约地址>
 */
async function main() {
  // 获取网络配置
  const networkName = process.argv[2] || "bscTestnet";
  const network = config.networks[networkName];
  
  // 尝试从命令行参数获取合约地址，如果没有则从 deployedContracts 读取
  let PAYMENT_SBT_ADDRESS: string;
  
  // 检查是否有命令行参数（跳过 --network 参数）
  const addressArg = process.argv.find((arg, index) => 
    index > 0 && 
    process.argv[index - 1] !== "--network" && 
    arg.startsWith("0x") && 
    arg.length === 42
  );
  
  if (addressArg) {
    PAYMENT_SBT_ADDRESS = addressArg;
    console.log(`📌 使用命令行指定的合约地址: ${PAYMENT_SBT_ADDRESS}`);
  } else {
    // 尝试从 deployedContracts 读取
    try {
      const deployedContractsPath = path.join(__dirname, "../../nextjs/contracts/deployedContracts.ts");
      const deployedContractsContent = fs.readFileSync(deployedContractsPath, "utf-8");
      
      // 提取 BSC Testnet (chainId 97) 的 PaymentSBT 地址
      const addressMatch = deployedContractsContent.match(/97:\s*{[^}]*PaymentSBT:\s*{[^}]*address:\s*"([^"]+)"/s);
      
      if (addressMatch && addressMatch[1]) {
        PAYMENT_SBT_ADDRESS = addressMatch[1];
        console.log(`📌 从 deployedContracts.ts 读取的合约地址: ${PAYMENT_SBT_ADDRESS}`);
      } else {
        // 默认地址（BSC Testnet）
        PAYMENT_SBT_ADDRESS = "0x110CC702FC4968d231eFD6E08Db75776265b6A1B";
        console.log(`📌 使用默认合约地址: ${PAYMENT_SBT_ADDRESS}`);
      }
    } catch (error) {
      // 如果读取失败，使用默认地址
      PAYMENT_SBT_ADDRESS = "0x110CC702FC4968d231eFD6E08Db75776265b6A1B";
      console.log(`📌 使用默认合约地址: ${PAYMENT_SBT_ADDRESS}`);
    }
  }
  
  if (!network || !("url" in network)) {
    console.error(`❌ 网络 ${networkName} 未配置或无效`);
    return;
  }

  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`📄 合约地址: ${PAYMENT_SBT_ADDRESS}\n`);

  // 创建 provider
  const provider = new ethers.JsonRpcProvider(network.url);
  
  // 创建合约实例
  const contract = new ethers.Contract(PAYMENT_SBT_ADDRESS, PaymentSBT_ABI, provider);

  try {
    // 查询推荐人统计信息
    console.log("🔍 正在查询推荐人统计信息...\n");
    const [referrers, counts] = await contract.getReferrerStats();

    if (referrers.length === 0) {
      console.log("📭 目前还没有推荐人记录");
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
    const avgReferrals = (totalReferrals / referrerStats.length).toFixed(2);
    const maxReferrals = referrerStats[0].count;
    const minReferrals = referrerStats[referrerStats.length - 1].count;

    console.log(`\n📈 统计信息:`);
    console.log(`   总推荐数: ${totalReferrals}`);
    console.log(`   平均推荐数: ${avgReferrals}`);
    console.log(`   最高推荐数: ${maxReferrals}`);
    console.log(`   最低推荐数: ${minReferrals}`);

  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
    if (error.data) {
      console.error("错误详情:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


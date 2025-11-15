/**
 * 使用 Node.js 测试 RPC 连接（支持系统代理）
 * 这个脚本会使用系统的代理设置（包括 VPN）
 */

const https = require('https');

const testRPC = (name, url) => {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.result) {
              const blockNum = parseInt(json.result, 16);
              resolve({
                name,
                url,
                status: '✅ 可用',
                block: blockNum,
                latency: Date.now() - startTime,
              });
            } else {
              resolve({
                name,
                url,
                status: '⚠️  响应异常',
                error: json.error?.message || JSON.stringify(json),
              });
            }
          } catch (e) {
            resolve({
              name,
              url,
              status: '❌ 解析失败',
              error: e.message,
              raw: data.substring(0, 200),
            });
          }
        });
      });

      const startTime = Date.now();
      req.on('error', (e) => {
        resolve({
          name,
          url,
          status: '❌ 连接失败',
          error: e.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          url,
          status: '❌ 连接超时',
        });
      });

      req.write(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        })
      );
      req.end();
    } catch (e) {
      resolve({
        name,
        url,
        status: '❌ URL 解析失败',
        error: e.message,
      });
    }
  });
};

// 测试多个 RPC 节点
const rpcs = [
  { name: 'Ankr', url: 'https://rpc.ankr.com/bsc_testnet_chapel' },
  { name: 'PublicNode', url: 'https://bsc-testnet-rpc.publicnode.com' },
  { name: '1RPC', url: 'https://1rpc.io/bnb/testnet' },
  { name: 'BlastAPI', url: 'https://bsc-testnet.public.blastapi.io' },
  { name: 'Alchemy', url: 'https://bnb-testnet.g.alchemy.com/v2/cR4WnXePioePZ5fFrnSiR' },
];

console.log('🔍 测试 BSC Testnet RPC 节点（使用 Node.js，支持系统代理/VPN）\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

Promise.all(rpcs.map((rpc) => testRPC(rpc.name, rpc.url))).then((results) => {
  const available = results.filter((r) => r.status === '✅ 可用');
  const failed = results.filter((r) => r.status !== '✅ 可用');

  // 显示可用的节点
  if (available.length > 0) {
    console.log('✅ 可用的 RPC 节点:\n');
    available.forEach((r) => {
      console.log(`   ${r.name.padEnd(15)}: ${r.url}`);
      console.log(`   ${''.padEnd(15)}  区块: ${r.block}, 延迟: ${r.latency}ms\n`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 使用第一个可用节点部署:');
    console.log(
      `   BSC_TESTNET_RPC="${available[0].url}" yarn deploy --network bscTestnet\n`
    );
  }

  // 显示失败的节点
  if (failed.length > 0) {
    console.log('❌ 不可用的 RPC 节点:\n');
    failed.forEach((r) => {
      console.log(`   ${r.name.padEnd(15)}: ${r.status}`);
      if (r.error) {
        console.log(`   ${''.padEnd(15)}  错误: ${r.error}`);
      }
      console.log('');
    });
  }

  if (available.length === 0) {
    console.log('❌ 所有 RPC 节点都不可用\n');
    console.log('可能的原因:');
    console.log('1. VPN 未正确配置或未生效');
    console.log('2. 需要手动设置代理环境变量');
    console.log('3. 防火墙阻止连接');
    console.log('4. 所有 RPC 节点暂时不可用\n');
    console.log('建议:');
    console.log('1. 检查 VPN 是否正常工作');
    console.log('2. 尝试重启终端');
    console.log('3. 检查系统代理设置');
    console.log('4. 稍后重试');
  }
});


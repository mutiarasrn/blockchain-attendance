const hre = require("hardhat");

async function main() {
  console.log("Deploying AttendanceLogger contract...");

  // Get the contract factory
  const AttendanceLogger = await hre.ethers.getContractFactory("AttendanceLogger");

  // Deploy the contract
  const attendanceLogger = await AttendanceLogger.deploy();

  // Wait for deployment to finish
  await attendanceLogger.waitForDeployment();

  const contractAddress = await attendanceLogger.getAddress();

  console.log("\n✅ AttendanceLogger deployed successfully!");
  console.log("📍 Contract address:", contractAddress);
  console.log("\n📝 Next steps:");
  console.log("1. Copy contract address to your frontend");
  console.log("2. Update frontend to use this address");
  console.log("3. Make sure Hardhat node is running (npx hardhat node)");
  console.log("4. Connect MetaMask to localhost:8545");

  // Save deployment info to a file for frontend to use
  const fs = require("fs");
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: hre.network.name,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n💾 Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

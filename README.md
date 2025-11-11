# 📋 Blockchain Attendance System

Decentralized & tamper-proof attendance logging system built with Solidity, Hardhat, and Ethers.js.

## 🎯 Features

- ✅ **Privacy-Focused**: IDs and names are hashed on-chain (only cryptographic hashes stored)
- ✅ **Tamper-Proof**: Immutable records on blockchain
- ✅ **Multi-Status**: HADIR, TIDAK HADIR
- ✅ **Flexible**: Works for students, employees, or any group
- ✅ **Multi-Wallet Support**: Connect with any Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- ✅ **Local Development**: Test with Hardhat local node (unlimited testnet ETH)

## 🏗️ Architecture

```
├── contracts/
│   └── AttendanceLogger.sol    # Smart contract
├── scripts/
│   └── deploy.js                # Deployment script
├── test/                        # Tests (TODO)
├── frontend/
│   ├── index.html               # Main UI
│   ├── app.js                   # Application logic
│   └── styles.css               # Styling
└── hardhat.config.js            # Hardhat configuration
```

## 📊 Data Structure

### On-Chain (Blockchain)
```solidity
struct AttendanceRecord {
    uint256 recordId;        // Auto-increment ID
    bytes32 idHash;          // Hash of ID (NIM/Employee ID)
    bytes32 nameHash;        // Hash of name
    uint256 timestamp;       // block.timestamp
    Status status;           // HADIR, IZIN, SAKIT, ALPA
    address recorder;        // Who recorded (msg.sender)
}
```

### Off-Chain (LocalStorage)
```javascript
{
  "0x1a2b3c...": { id: "123456", idHash: "0x1a2b3c..." },
  "0x4d5e6f...": { name: "Budi Santoso", nameHash: "0x4d5e6f..." }
}
```

## 🚀 Getting Started

### Prerequisites

- Node.js v20+ (you have v20.17.0)
- MetaMask or any Web3 wallet
- Git (optional)

### Installation

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Verify installation**:
   ```bash
   npx hardhat --version
   # Should show: 2.27.0
   ```

### Development Workflow

#### Step 1: Start Local Blockchain

Open a terminal and run:

```bash
npx hardhat node
```

**Output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

⚠️ **Keep this terminal running!** This is your local blockchain.

---

#### Step 2: Deploy Contract

Open a **NEW terminal** (keep the first one running!) and run:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

**Output:**
```
Deploying AttendanceLogger contract...

✅ AttendanceLogger deployed successfully!
📍 Contract address: 0x5FbDB2315678afecb367f032d93F642f64180aa3

📝 Next steps:
1. Copy contract address to your frontend
...

💾 Deployment info saved to deployment-info.json
```

**📋 COPY THE CONTRACT ADDRESS!** You'll need it in the next step.

---

#### Step 3: Update Frontend

1. Open `frontend/app.js`
2. Find line 10:
   ```javascript
   const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
   ```
3. Replace with your deployed contract address from Step 2

---

#### Step 4: Setup MetaMask

1. **Add Localhost Network to MetaMask:**
   - Open MetaMask
   - Click network dropdown → "Add Network" → "Add network manually"
   - Fill in:
     - **Network name:** Hardhat Local
     - **RPC URL:** `http://127.0.0.1:8545`
     - **Chain ID:** `1337` (or `31337`)
     - **Currency symbol:** ETH
   - Click "Save"

2. **Import Test Account:**
   - MetaMask → Account menu → "Import Account"
   - Paste **Private Key** from Step 1 (e.g., `0xac0974bec...`)
   - You now have **10,000 ETH** for testing! 🎉

---

#### Step 5: Run Frontend

Open `frontend/index.html` in your browser:

**Option A: Double-click** `index.html`

**Option B: Use Live Server** (recommended):
```bash
# If you have Python:
cd frontend
python -m http.server 8000

# Then open: http://localhost:8000
```

**Option C: VS Code Live Server:**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

---

#### Step 6: Use the App!

1. Click **"Connect Wallet"**
2. MetaMask will pop up → Select your imported account → Approve
3. Fill the form:
   - **ID:** `123456` (NIM/Employee ID)
   - **Name:** `Budi Santoso`
   - **Status:** Select status
4. Click **"Submit Attendance"**
5. MetaMask will ask for confirmation → Click **"Confirm"**
6. Wait for transaction... ✅ **Success!**
7. Records will appear in the table below

---

## 🔒 Privacy & Security

### What's Stored On-Chain (PUBLIC):
- ✅ Hash of ID: `0x1a2b3c4d5e6f...` (irreversible)
- ✅ Hash of name: `0x7a8b9c0d1e2f...` (irreversible)
- ✅ Timestamp, status, recorder address

### What's Stored Off-Chain (PRIVATE):
- 📁 Plaintext ID & name in **browser's localStorage**
- ⚠️ Clearing browser cache will **delete** the plaintext mapping
- ⚠️ Other users won't see your plaintext data

### Migration Path:
Later, you can replace localStorage with:
- Backend database (PostgreSQL, MongoDB)
- IPFS (decentralized storage)
- The Graph (blockchain indexer)

**No smart contract redeployment needed!** The contract only stores hashes.

---

## 📝 Contract Functions

### Write Functions (Cost Gas)

```solidity
// Log new attendance
function logAttendance(
    bytes32 _idHash,      // keccak256(id)
    bytes32 _nameHash,    // keccak256(name)
    Status _status        // 0=HADIR, 1=IZIN, 2=SAKIT, 3=ALPA
) returns (uint256 recordId)
```

### Read Functions (Free)

```solidity
// Get batch of records (pagination)
function getBatch(uint256 startIndex, uint256 count)
    returns (AttendanceRecord[])

// Get single record
function getRecord(uint256 recordId)
    returns (AttendanceRecord)

// Get total count
function getTotalRecords() returns (uint256)
```

---

## 🧪 Testing

```bash
# Run tests (TODO: create tests)
npx hardhat test

# Check coverage
npx hardhat coverage
```

---

## 🌐 Deploy to Testnet (Sepolia)

### 1. Get Sepolia ETH from Faucets:
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://cloud.google.com/application/web3/faucet/ethereum/sepolia

### 2. Update `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL, // Get from Alchemy/Infura
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

### 3. Create `.env`:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_wallet_private_key_here
```

### 4. Deploy:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 5. Update Frontend:
- Change MetaMask network to **Sepolia**
- Update `CONTRACT_ADDRESS` in `app.js`

---

## 🛠️ Troubleshooting

### ❌ "Cannot connect to network"
- Make sure `npx hardhat node` is running
- Check MetaMask is on "Hardhat Local" network
- Verify RPC URL is `http://127.0.0.1:8545`

### ❌ "Contract not deployed"
- Run `npx hardhat run scripts/deploy.js --network localhost`
- Update `CONTRACT_ADDRESS` in `frontend/app.js`

### ❌ "Nonce too high" error
- Reset MetaMask: Settings → Advanced → Clear activity tab data

### ❌ "Insufficient funds"
- Make sure you imported the test account from `npx hardhat node`
- Each account has 10,000 ETH

### ❌ Plaintext not showing in table
- Check browser console for errors
- Verify localStorage has data: `localStorage.getItem('attendance_mappings')`

---

## 📚 Tech Stack

- **Smart Contract:** Solidity ^0.8.20
- **Development:** Hardhat 2.27.0
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Web3 Library:** Ethers.js v6
- **Wallet:** Web3Modal v3 (multi-wallet support)
- **Testing:** Hardhat (Mocha + Chai)

---

## 🎓 Learning Resources

- [Hardhat Docs](https://hardhat.org/docs)
- [Ethers.js Docs](https://docs.ethers.org/v6/)
- [Solidity Docs](https://docs.soliditylang.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## 📄 License

MIT

---

## 🤝 Contributing

Feel free to fork and customize for your needs!

---

## 📧 Support

If you encounter issues:
1. Check the Troubleshooting section
2. Check browser console for errors
3. Check Hardhat node terminal for errors

---

**Built with ❤️ for decentralized attendance tracking**

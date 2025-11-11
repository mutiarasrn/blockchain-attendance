// Import Web3Modal (AppKit) - For production, use proper module imports
// For now, we'll use a simpler approach with vanilla JS

// ============================================
// CONFIGURATION
// ============================================

// Deployed on Base Sepolia Testnet
const CONTRACT_ADDRESS = '0xd24ed1eB1fb4f3b6217A33cf005d60b06C09547c';

// Base Sepolia Network Config
const BASE_SEPOLIA_CHAIN_ID = '0x14a34'; // 84532 in hex
const BASE_SEPOLIA_NETWORK = {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    chainName: 'Base Sepolia',
    nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://sepolia.base.org'],
    blockExplorerUrls: ['https://sepolia.basescan.org']
};

// Contract ABI (only functions we need)
const CONTRACT_ABI = [
    "function logAttendance(bytes32 _idHash, bytes32 _nameHash, bool _isPresent, string memory _reason, bytes32 _documentHash) public returns (uint256)",
    "function getBatch(uint256 _startIndex, uint256 _count) public view returns (tuple(uint256 recordId, bytes32 idHash, bytes32 nameHash, uint256 timestamp, bool isPresent, string reason, bytes32 documentHash, address recorder)[])",
    "function getRecord(uint256 _recordId) public view returns (tuple(uint256 recordId, bytes32 idHash, bytes32 nameHash, uint256 timestamp, bool isPresent, string reason, bytes32 documentHash, address recorder))",
    "function getTotalRecords() public view returns (uint256)",
    "function recordCount() public view returns (uint256)",
    "event AttendanceLogged(uint256 indexed recordId, bytes32 indexed idHash, bytes32 nameHash, uint256 timestamp, bool isPresent, string reason, bytes32 documentHash, address indexed recorder)"
];

// Pagination
const RECORDS_PER_PAGE = 10;
let currentPage = 0;

// ============================================
// STATE MANAGEMENT
// ============================================

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;

// ============================================
// LOCALSTORAGE HELPERS
// ============================================

const STORAGE_KEY = 'attendance_mappings';
const PDF_STORAGE_KEY = 'attendance_pdfs';

function savePlaintextData(idHash, nameHash, id, name) {
    const mappings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    mappings[idHash] = { id, idHash };
    mappings[nameHash] = { name, nameHash };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

function getPlaintextData(hash) {
    const mappings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return mappings[hash] || null;
}

function savePDFData(documentHash, pdfData) {
    if (!documentHash || documentHash === '0x0000000000000000000000000000000000000000000000000000000000000000') return;

    const pdfs = JSON.parse(localStorage.getItem(PDF_STORAGE_KEY) || '{}');
    pdfs[documentHash] = pdfData;
    localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(pdfs));
}

function getPDFData(documentHash) {
    if (!documentHash || documentHash === '0x0000000000000000000000000000000000000000000000000000000000000000') return null;

    const pdfs = JSON.parse(localStorage.getItem(PDF_STORAGE_KEY) || '{}');
    return pdfs[documentHash] || null;
}

// ============================================
// PDF HASHING
// ============================================

async function hashPDFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);

                // Hash the file content
                const hash = ethers.keccak256(uint8Array);

                // Convert to base64 for storage (chunk to avoid stack overflow)
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, chunk);
                }
                const base64 = btoa(binary);

                resolve({ hash, base64, name: file.name });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ============================================
// NETWORK HELPERS
// ============================================

async function checkAndSwitchNetwork(selectedProvider) {
    try {
        const currentChainId = await selectedProvider.request({ method: 'eth_chainId' });

        if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
            showMessage('formMessage', 'Wrong network detected. Switching to Base Sepolia...', 'info');

            try {
                // Try to switch to Base Sepolia
                await selectedProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
                });
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await selectedProvider.request({
                            method: 'wallet_addEthereumChain',
                            params: [BASE_SEPOLIA_NETWORK],
                        });
                    } catch (addError) {
                        throw new Error('Failed to add Base Sepolia network to wallet');
                    }
                } else {
                    throw switchError;
                }
            }
        }
        return true;
    } catch (error) {
        console.error('Network switch error:', error);
        throw new Error(`Please switch to Base Sepolia network manually. ${error.message}`);
    }
}

// ============================================
// WALLET CONNECTION (Simple approach)
// ============================================

async function connectWallet() {
    try {
        // Check if any Web3 wallet is installed
        if (!window.ethereum) {
            showMessage('formMessage', 'Please install MetaMask or another Web3 wallet!', 'error');
            return;
        }

        let selectedProvider = null;

        // If multiple wallets, try to find MetaMask first
        if (window.ethereum.providers?.length) {
            selectedProvider = window.ethereum.providers.find((p) => p.isMetaMask)
                || window.ethereum.providers[0]; // Fallback to first provider
        } else {
            // Single wallet installed
            selectedProvider = window.ethereum;
        }

        // Request account access
        await selectedProvider.request({ method: 'eth_requestAccounts' });

        // Check and switch network to Base Sepolia
        await checkAndSwitchNetwork(selectedProvider);

        // Create provider and signer
        provider = new ethers.BrowserProvider(selectedProvider);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        // Verify we're on Base Sepolia
        const network = await provider.getNetwork();
        if (network.chainId !== 84532n) {
            throw new Error('Please switch to Base Sepolia network (Chain ID: 84532)');
        }

        // Create contract instance
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Update UI
        updateWalletUI(true);
        document.getElementById('walletAddress').textContent =
            `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        document.getElementById('contractAddress').textContent =
            `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`;

        // Load records
        await loadRecords();

        showMessage('formMessage', 'Wallet connected successfully on Base Sepolia!', 'success');

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showMessage('formMessage', `Error: ${error.message}`, 'error');
    }
}

async function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    userAddress = null;
    updateWalletUI(false);
    showMessage('formMessage', 'Wallet disconnected', 'info');
}

function updateWalletUI(connected) {
    const connectBtn = document.getElementById('connectBtn');
    const walletInfo = document.getElementById('walletInfo');

    if (connected) {
        connectBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
    } else {
        connectBtn.classList.remove('hidden');
        walletInfo.classList.add('hidden');
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        window.location.reload();
    }
}

function handleChainChanged() {
    window.location.reload();
}

// ============================================
// ATTENDANCE LOGGING
// ============================================

async function submitAttendance(event) {
    event.preventDefault();

    if (!contract) {
        showMessage('formMessage', 'Please connect your wallet first!', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        // Get form data
        const id = document.getElementById('personId').value.trim();
        const name = document.getElementById('personName').value.trim();
        const isPresent = document.querySelector('input[name="status"]:checked').value === 'present';

        let reason = '';
        let documentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
        let pdfData = null;

        // If absent, get reason and document
        if (!isPresent) {
            reason = document.getElementById('reason').value.trim();
            const documentFile = document.getElementById('document').files[0];

            // Hash PDF if provided
            if (documentFile) {
                showMessage('formMessage', 'Hashing PDF document...', 'info');
                const pdfHashResult = await hashPDFFile(documentFile);
                documentHash = pdfHashResult.hash;
                pdfData = {
                    base64: pdfHashResult.base64,
                    name: pdfHashResult.name
                };
            }
        }

        // Hash the data
        const idHash = ethers.id(id); // keccak256 hash
        const nameHash = ethers.id(name);

        showMessage('formMessage', 'Hashing data and preparing transaction...', 'info');

        // Call smart contract
        const tx = await contract.logAttendance(idHash, nameHash, isPresent, reason, documentHash);

        showMessage('formMessage', 'Transaction sent! Waiting for confirmation...', 'info');

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        // Save plaintext mapping to localStorage
        savePlaintextData(idHash, nameHash, id, name);

        // Save PDF data if exists
        if (pdfData) {
            savePDFData(documentHash, pdfData);
        }

        showMessage('formMessage',
            `Attendance logged successfully! Transaction: ${receipt.hash.slice(0, 10)}...`,
            'success'
        );

        // Reset form
        document.getElementById('attendanceForm').reset();
        document.getElementById('absentFields').classList.add('hidden');

        // Reload records
        await loadRecords();

    } catch (error) {
        console.error('Error submitting attendance:', error);
        let errorMsg = 'Error submitting attendance';

        if (error.code === 'ACTION_REJECTED') {
            errorMsg = 'Transaction was rejected by user';
        } else if (error.message) {
            errorMsg = error.message;
        }

        showMessage('formMessage', errorMsg, 'error');

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Attendance';
    }
}

// ============================================
// RECORDS LOADING
// ============================================

async function loadRecords() {
    if (!contract) {
        return;
    }

    try {
        // Get total records
        const totalRecords = await contract.getTotalRecords();
        document.getElementById('totalRecords').textContent = totalRecords.toString();

        if (totalRecords === 0n) {
            renderEmptyTable();
            return;
        }

        // Calculate pagination
        const startIndex = currentPage * RECORDS_PER_PAGE;
        const count = RECORDS_PER_PAGE;

        // Fetch batch of records
        const records = await contract.getBatch(startIndex, count);

        // Render table
        renderRecordsTable(records);

        // Update pagination buttons
        updatePaginationButtons(totalRecords);

    } catch (error) {
        console.error('Error loading records:', error);
        showMessage('recordsMessage', `Error loading records: ${error.message}`, 'error');
    }
}

function renderRecordsTable(records) {
    const tbody = document.getElementById('recordsBody');
    tbody.innerHTML = '';

    records.forEach((record) => {
        const row = document.createElement('tr');

        // Get plaintext data from localStorage
        const idData = getPlaintextData(record.idHash);
        const nameData = getPlaintextData(record.nameHash);

        const displayId = idData ? idData.id : `${record.idHash.slice(0, 10)}...`;
        const displayName = nameData ? nameData.name : `${record.nameHash.slice(0, 10)}...`;

        // Format timestamp
        const date = new Date(Number(record.timestamp) * 1000);
        const formattedDate = date.toLocaleString();

        // Format status
        const statusBadge = record.isPresent
            ? '<span class="status-badge status-hadir">HADIR</span>'
            : '<span class="status-badge status-alpa">TIDAK HADIR</span>';

        // Format reason
        const reasonText = record.reason || '-';

        // Format document
        let documentCell = '-';
        if (record.documentHash && record.documentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            const pdfData = getPDFData(record.documentHash);
            if (pdfData) {
                documentCell = `<button class="btn-link" onclick="viewPDF('${record.documentHash}')">View PDF</button>`;
            } else {
                documentCell = `<span class="hash-short" title="${record.documentHash}">${record.documentHash.slice(0, 10)}...</span>`;
            }
        }

        // Format recorder address
        const recorderShort = `${record.recorder.slice(0, 6)}...${record.recorder.slice(-4)}`;

        row.innerHTML = `
            <td>${Number(record.recordId) + 1}</td>
            <td>${displayId}</td>
            <td>${displayName}</td>
            <td>${statusBadge}</td>
            <td>${reasonText}</td>
            <td>${documentCell}</td>
            <td>${formattedDate}</td>
            <td>${recorderShort}</td>
        `;

        tbody.appendChild(row);
    });
}

function renderEmptyTable() {
    const tbody = document.getElementById('recordsBody');
    tbody.innerHTML = '<tr><td colspan="8" class="no-data">No records yet. Submit the first attendance!</td></tr>';
}

function updatePaginationButtons(totalRecords) {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    const totalPages = Math.ceil(Number(totalRecords) / RECORDS_PER_PAGE);

    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1 || totalRecords === 0n;

    pageInfo.textContent = `Page ${currentPage + 1} of ${Math.max(totalPages, 1)}`;
}

// ============================================
// PDF VIEWING
// ============================================

window.viewPDF = function(documentHash) {
    const pdfData = getPDFData(documentHash);
    if (!pdfData) {
        alert('PDF not found in local storage');
        return;
    }

    // Convert base64 to blob
    const byteCharacters = atob(pdfData.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Create URL and open in new tab
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up URL after opening
    setTimeout(() => URL.revokeObjectURL(url), 100);
};

// ============================================
// PAGINATION HANDLERS
// ============================================

async function goToPreviousPage() {
    if (currentPage > 0) {
        currentPage--;
        await loadRecords();
    }
}

async function goToNextPage() {
    currentPage++;
    await loadRecords();
}

// ============================================
// UI HELPERS
// ============================================

function toggleAbsentFields() {
    const isAbsent = document.querySelector('input[name="status"][value="absent"]').checked;
    const absentFields = document.getElementById('absentFields');
    const reasonField = document.getElementById('reason');

    if (isAbsent) {
        absentFields.classList.remove('hidden');
        reasonField.setAttribute('required', 'required');
    } else {
        absentFields.classList.add('hidden');
        reasonField.removeAttribute('required');
        // Clear fields when hiding
        reasonField.value = '';
        document.getElementById('document').value = '';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Wallet connection
    document.getElementById('connectBtn').addEventListener('click', connectWallet);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWallet);

    // Form submission
    document.getElementById('attendanceForm').addEventListener('submit', submitAttendance);

    // Status radio buttons
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.addEventListener('change', toggleAbsentFields);
    });

    // Pagination
    document.getElementById('prevBtn').addEventListener('click', goToPreviousPage);
    document.getElementById('nextBtn').addEventListener('click', goToNextPage);
    document.getElementById('refreshBtn').addEventListener('click', loadRecords);

    // Update contract address in UI
    document.getElementById('contractAddress').textContent =
        `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`;
});

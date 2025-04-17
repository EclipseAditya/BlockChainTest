const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Set up configuration
const ganacheUrl = process.env.GANACHE_URL || 'http://localhost:7545';
const mnemonic = process.env.GANACHE_MNEMONIC || 'voyage supreme fun forum bomb dinner memory sight fetch jacket quarter seven';

// Initialize Web3 with the provider
const provider = new HDWalletProvider(mnemonic, ganacheUrl);
const web3 = new Web3(provider);

// Path to wallet data file
const dataDir = path.join(__dirname, '../data');
const walletDataPath = path.join(dataDir, 'wallets.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize wallet data structure
const initWalletData = () => {
  if (!fs.existsSync(walletDataPath)) {
    fs.writeFileSync(walletDataPath, JSON.stringify({ wallets: {} }), 'utf8');
  }
};

// Save wallet data
const saveWalletData = (data) => {
  fs.writeFileSync(walletDataPath, JSON.stringify(data, null, 2), 'utf8');
};

// Load wallet data
const loadWalletData = () => {
  initWalletData();
  const data = fs.readFileSync(walletDataPath, 'utf8');
  return JSON.parse(data);
};

/**
 * Create a new Ethereum wallet for a patient
 * @param {string} patientId - The ID of the patient
 * @returns {Promise<{address: string, privateKey: string}>} The wallet address and private key
 */
const createWallet = async (patientId) => {
  try {
    console.log(`Creating wallet for patient ${patientId}...`);
    
    // Create a new account
    const account = web3.eth.accounts.create();
    const walletAddress = account.address;
    const privateKey = account.privateKey;
    
    // Get accounts from ganache
    const accounts = await web3.eth.getAccounts();
    const adminAccount = accounts[0]; // Use the first account as admin
    
    // Fund the new account with some ETH
    const amountToSend = web3.utils.toWei('1', 'ether');
    await web3.eth.sendTransaction({
      from: adminAccount,
      to: walletAddress,
      value: amountToSend
    });
    
    console.log(`Funded ${walletAddress} with 1 ETH from ${adminAccount}`);
    
    // Save wallet info to local storage
    const walletData = loadWalletData();
    walletData.wallets[patientId] = {
      address: walletAddress,
      privateKey: privateKey,
      createdAt: new Date().toISOString()
    };
    saveWalletData(walletData);
    
    return {
      address: walletAddress,
      privateKey: privateKey
    };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
};

/**
 * Get a patient's wallet by ID
 * @param {string} patientId - The ID of the patient
 * @returns {Object|null} The wallet data or null if not found
 */
const getWallet = (patientId) => {
  try {
    const walletData = loadWalletData();
    return walletData.wallets[patientId] || null;
  } catch (error) {
    console.error('Error getting wallet:', error);
    return null;
  }
};

// Initialize wallet data on module load
initWalletData();

module.exports = {
  createWallet,
  getWallet
}; 
 
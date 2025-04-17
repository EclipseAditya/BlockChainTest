const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

// Configuration - using local Ganache blockchain
const WEB3_PROVIDER = 'http://localhost:7545';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ACCOUNT_POOL_FILE = path.join(DATA_DIR, 'account_pool.json');

// Initialize Web3
const web3 = new Web3(WEB3_PROVIDER);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default account pool structure
const defaultAccountPool = {
  nextIndex: 4, // Start from index 4 (0-3 reserved for other purposes)
  maxIndex: 19, // End at index 19
  accounts: {} // Will store assigned accounts: { "patientId": { address, privateKey, index } }
};

// Load or initialize the account pool
function loadAccountPool() {
  try {
    if (fs.existsSync(ACCOUNT_POOL_FILE)) {
      const data = fs.readFileSync(ACCOUNT_POOL_FILE, 'utf8');
      return JSON.parse(data);
    }
    
    // Create default account pool file if it doesn't exist
    fs.writeFileSync(ACCOUNT_POOL_FILE, JSON.stringify(defaultAccountPool, null, 2), 'utf8');
    return { ...defaultAccountPool };
  } catch (error) {
    console.error('Error loading account pool:', error);
    return { ...defaultAccountPool };
  }
}

// Save the account pool
function saveAccountPool(pool) {
  try {
    fs.writeFileSync(ACCOUNT_POOL_FILE, JSON.stringify(pool, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving account pool:', error);
    return false;
  }
}

// Get the next available account from the blockchain
async function getNextAvailableAccount() {
  try {
    // Load the account pool
    const pool = loadAccountPool();
    
    // Check if we've reached the maximum number of accounts
    if (pool.nextIndex > pool.maxIndex) {
      throw new Error('All accounts in the pool have been assigned');
    }
    
    // Get all accounts from the blockchain
    const accounts = await web3.eth.getAccounts();
    
    // Get the next account based on the index
    const accountIndex = pool.nextIndex;
    const ganacheAddress = accounts[accountIndex];
    
    // Get the private key (in a real system, you would use a secure way to get this)
    // For Ganache, we'll use a predefined list of private keys or derive them
    // This is just for demonstration - in production, private keys should be secured
    
    // Example hardcoded Ganache private keys (for development only)
    const ganachePrivateKeys = [
      '0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', // 0
      '0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f', // 1
      '0x0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1', // 2
      '0xc88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c', // 3
      '0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418', // 4
      '0xd8d1f9015d2b178a0e65ef048706714b183b8fa4e9101d9efa551e8cd175ebe7', // 5
      '0x28f39c6d1e0cbf11584cd60bac93c606b156e5e0a229e2e21fa84efafe172649', // 6
      '0xf2bf03b9ee05ced6167bd38f78ef503d85e70a9c9af659370f1ec72fe85e3a10', // 7
      '0x25dd6e8117631ff3df2b058dbb7fd310cc2b939d3b5207d43c5f4d99e5c04a9d', // 8
      '0xd7fa5bf2e0a5db0ee677b14dba5add4f4ddc2d75bf185f1d2aa313c7f2dcc3ab', // 9
      // Add more keys as needed or fetch them dynamically
    ];
    
    // Get the private key for this account index
    let privateKey;
    if (accountIndex < ganachePrivateKeys.length) {
      privateKey = ganachePrivateKeys[accountIndex];
    } else {
      // For demo, we'll generate a predictable key - in production, use a secure method
      privateKey = `0x${Buffer.from(`ganache_demo_key_${accountIndex}`).toString('hex').padEnd(64, '0')}`;
    }
    
    // IMPORTANT: Derive the actual address from the private key using web3.js
    // This ensures the address matches what web3.js will derive when the key is used elsewhere
    const derivedAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
    const derivedAddress = derivedAccount.address;
    
    // Output both addresses for debugging
    console.log(`Account ${accountIndex}:`);
    console.log(`  Ganache address: ${ganacheAddress}`);
    console.log(`  Derived address: ${derivedAddress}`);
    
    // Use the derived address, not the Ganache address
    const address = derivedAddress;
    
    // Increment the next index and save the pool
    pool.nextIndex++;
    saveAccountPool(pool);
    
    // Return the account information with the correct web3-derived address
    return {
      address,
      privateKey,
      index: accountIndex
    };
  } catch (error) {
    console.error('Error getting next available account:', error);
    throw error;
  }
}

// Assign an account to a patient
async function assignAccountToPatient(patientId) {
  try {
    // Load the account pool
    const pool = loadAccountPool();
    
    // Check if this patient already has an account
    if (pool.accounts[patientId]) {
      return pool.accounts[patientId];
    }
    
    // Get the next available account
    const account = await getNextAvailableAccount();
    
    // Assign it to the patient
    pool.accounts[patientId] = account;
    
    // Save the updated pool
    saveAccountPool(pool);
    
    return account;
  } catch (error) {
    console.error(`Error assigning account to patient ${patientId}:`, error);
    throw error;
  }
}

// Get a patient's account
function getPatientAccount(patientId) {
  const pool = loadAccountPool();
  return pool.accounts[patientId] || null;
}

// Release an account (if a patient is deleted)
function releaseAccount(patientId) {
  const pool = loadAccountPool();
  
  if (pool.accounts[patientId]) {
    const releasedIndex = pool.accounts[patientId].index;
    delete pool.accounts[patientId];
    
    // Optionally adjust the nextIndex if this is the lowest available
    if (releasedIndex < pool.nextIndex) {
      pool.nextIndex = releasedIndex;
    }
    
    saveAccountPool(pool);
    return true;
  }
  
  return false;
}

module.exports = {
  assignAccountToPatient,
  getPatientAccount,
  releaseAccount,
  getNextAvailableAccount
}; 
 
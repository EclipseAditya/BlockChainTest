// Script to fix wallet addresses for all existing patients
const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, updateDoc, getDoc, getDocs } = require('firebase/firestore');

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545';
const DATA_DIR = path.join(__dirname, '..', 'data');
const PATIENTS_DIR = path.join(DATA_DIR, 'patients');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBIGqnQdxpXYUUU5HiRfkrqQv9pk8VmBbM",
  authDomain: "chakra-b3d4b.firebaseapp.com",
  projectId: "chakra-b3d4b",
  storageBucket: "chakra-b3d4b.firebasestorage.app",
  messagingSenderId: "673336667562",
  appId: "1:673336667562:web:0827d7a4e0f43757d40fd3",
  measurementId: "G-Z14QFT9GF5"
};

// Initialize Firebase and Web3
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const web3 = new Web3(WEB3_PROVIDER);

async function fixPatientAddresses() {
  console.log('Starting patient address fix process...');
  
  // Track statistics
  const stats = {
    total: 0,
    fixed: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    // Ensure patients directory exists
    if (!fs.existsSync(PATIENTS_DIR)) {
      fs.mkdirSync(PATIENTS_DIR, { recursive: true });
      console.log('Created patients directory');
    }
    
    // Get all patient JSON files
    const patientFiles = fs.readdirSync(PATIENTS_DIR)
      .filter(file => file.endsWith('.json'));
    
    console.log(`Found ${patientFiles.length} patient files`);
    
    // Process each patient file
    for (const file of patientFiles) {
      stats.total++;
      
      try {
        const filePath = path.join(PATIENTS_DIR, file);
        const patientData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const patientId = patientData.patientId;
        
        if (!patientData.privateKey) {
          console.log(`Skipping patient ${patientId} - no private key found`);
          stats.skipped++;
          continue;
        }
        
        // Derive the correct address from the private key
        const account = web3.eth.accounts.privateKeyToAccount(patientData.privateKey);
        const correctAddress = account.address;
        
        // Check if the address needs updating
        if (patientData.walletAddress.toLowerCase() === correctAddress.toLowerCase()) {
          console.log(`Patient ${patientId} address is already correct`);
          stats.skipped++;
          continue;
        }
        
        console.log(`Fixing patient ${patientId}:`);
        console.log(`  Old address: ${patientData.walletAddress}`);
        console.log(`  New address: ${correctAddress}`);
        
        // Update the local file
        patientData.walletAddress = correctAddress;
        fs.writeFileSync(filePath, JSON.stringify(patientData, null, 2));
        
        // Try to update in Firebase
        try {
          // Check if patient exists in Firestore
          const patientRef = doc(db, 'patients', patientId);
          const patientDoc = await getDoc(patientRef);
          
          if (patientDoc.exists()) {
            await updateDoc(patientRef, {
              walletAddress: correctAddress,
              lastUpdated: new Date().toISOString()
            });
            console.log(`  Updated in Firebase`);
          } else {
            console.log(`  Not found in Firebase, only local file updated`);
          }
        } catch (firebaseError) {
          console.error(`  Firebase update failed: ${firebaseError.message}`);
          console.log(`  Local file was still updated`);
        }
        
        stats.fixed++;
        
      } catch (patientError) {
        console.error(`Error processing patient file ${file}:`, patientError);
        stats.errors++;
      }
    }
    
    // Update account pool file if it exists
    try {
      const accountPoolPath = path.join(DATA_DIR, 'account_pool.json');
      if (fs.existsSync(accountPoolPath)) {
        console.log('Updating account pool addresses...');
        
        const accountPool = JSON.parse(fs.readFileSync(accountPoolPath, 'utf8'));
        let poolUpdated = false;
        
        // Check each account in the pool
        for (const patientId in accountPool.accounts) {
          const accountData = accountPool.accounts[patientId];
          
          if (accountData.privateKey) {
            // Derive the correct address
            const account = web3.eth.accounts.privateKeyToAccount(accountData.privateKey);
            const correctAddress = account.address;
            
            // Update if needed
            if (accountData.address.toLowerCase() !== correctAddress.toLowerCase()) {
              console.log(`Updating pool address for patient ${patientId}:`);
              console.log(`  Old address: ${accountData.address}`);
              console.log(`  New address: ${correctAddress}`);
              
              accountPool.accounts[patientId].address = correctAddress;
              poolUpdated = true;
            }
          }
        }
        
        // Save updated pool
        if (poolUpdated) {
          fs.writeFileSync(accountPoolPath, JSON.stringify(accountPool, null, 2));
          console.log('Account pool file updated');
        } else {
          console.log('Account pool addresses were already correct');
        }
      }
    } catch (poolError) {
      console.error('Error updating account pool file:', poolError);
    }
    
    // Print final stats
    console.log('\nAddress fix process completed:');
    console.log(`  Total patients processed: ${stats.total}`);
    console.log(`  Addresses fixed: ${stats.fixed}`);
    console.log(`  Patients skipped: ${stats.skipped}`);
    console.log(`  Errors: ${stats.errors}`);
    
  } catch (error) {
    console.error('Fatal error in fixPatientAddresses:', error);
  }
}

// Run the script
fixPatientAddresses()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 
 
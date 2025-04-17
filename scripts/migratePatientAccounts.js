/**
 * Script to migrate existing patient records to use proper blockchain accounts
 * 
 * This script is used to fix mismatches between private keys and wallet addresses
 * by assigning new accounts from the account pool to all existing patients.
 */

const fs = require('fs');
const path = require('path');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const accountPool = require('../config/accountPool');
const firebaseDb = require('../config/firebaseConfig');

// Directories
const dataDir = path.join(__dirname, '..', 'data');
const patientsDir = path.join(dataDir, 'patients');

// Ensure directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
if (!fs.existsSync(patientsDir)) {
  fs.mkdirSync(patientsDir);
}

async function migratePatientAccounts() {
  console.log('=== PATIENT ACCOUNT MIGRATION ===');
  console.log('This will update all patient records to use proper blockchain accounts');
  console.log('WARNING: This process will change private keys and wallet addresses');
  console.log('Make sure blockchain is running and web3 can connect to it\n');
  
  try {
    // Step 1: Get all patient IDs from Firebase
    console.log('Fetching patients from Firebase...');
    const patientsCollection = collection(firebaseDb.db, 'patients');
    const patientsSnapshot = await getDocs(patientsCollection);
    const firebasePatients = [];
    
    patientsSnapshot.forEach(docSnapshot => {
      firebasePatients.push({
        id: docSnapshot.id,
        data: docSnapshot.data()
      });
    });
    console.log(`Found ${firebasePatients.length} patients in Firebase`);
    
    // Step 2: Get all local JSON files
    console.log('Checking local patient files...');
    const patientFiles = fs.readdirSync(patientsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        id: path.basename(file, '.json'),
        path: path.join(patientsDir, file)
      }));
    console.log(`Found ${patientFiles.length} local patient files`);
    
    // Step 3: Combine and deduplicate patients
    const allPatientIds = new Set([
      ...firebasePatients.map(p => p.id),
      ...patientFiles.map(p => p.id)
    ]);
    console.log(`Total unique patients to migrate: ${allPatientIds.size}\n`);
    
    // Step 4: Migrate each patient
    let successCount = 0;
    let errorCount = 0;
    
    for (const patientId of allPatientIds) {
      try {
        console.log(`Migrating patient: ${patientId}`);
        
        // Get patient data from Firebase first, then try local
        let patientData = null;
        const firebasePatient = firebasePatients.find(p => p.id === patientId);
        
        if (firebasePatient) {
          patientData = firebasePatient.data;
          console.log(`  Found in Firebase`);
        } else {
          const localFilePath = path.join(patientsDir, `${patientId}.json`);
          if (fs.existsSync(localFilePath)) {
            patientData = JSON.parse(fs.readFileSync(localFilePath, 'utf8'));
            console.log(`  Found in local file`);
          }
        }
        
        if (!patientData) {
          console.log(`  WARNING: No data found for patient ${patientId}, skipping`);
          errorCount++;
          continue;
        }
        
        // Save original values for logging
        const originalWallet = patientData.walletAddress || 'none';
        const originalKey = patientData.privateKey || 'none';
        
        // Assign a new account to this patient
        const account = await accountPool.assignAccountToPatient(patientId);
        
        // Update patient data
        patientData.walletAddress = account.address;
        patientData.privateKey = account.privateKey;
        
        // Save back to Firebase
        if (firebasePatient) {
          const patientRef = doc(firebaseDb.db, 'patients', patientId);
          await updateDoc(patientRef, {
            walletAddress: account.address,
            privateKey: account.privateKey,
            lastUpdated: new Date().toISOString()
          });
          console.log(`  Updated in Firebase`);
        }
        
        // Save back to local file
        const localFilePath = path.join(patientsDir, `${patientId}.json`);
        fs.writeFileSync(localFilePath, JSON.stringify(patientData, null, 2), 'utf8');
        console.log(`  Updated in local file`);
        
        // Log the change
        console.log(`  Wallet: ${originalWallet.substring(0, 10)}... -> ${account.address.substring(0, 10)}...`);
        console.log(`  Successfully migrated patient ${patientId}`);
        successCount++;
      } catch (error) {
        console.error(`  ERROR migrating patient ${patientId}:`, error.message);
        errorCount++;
      }
      
      console.log(''); // Empty line between patients
    }
    
    // Step 5: Report results
    console.log('=== MIGRATION COMPLETE ===');
    console.log(`Total patients: ${allPatientIds.size}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed to migrate: ${errorCount}`);
    console.log('\nPlease restart the server for changes to take effect.');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migratePatientAccounts(); 
 
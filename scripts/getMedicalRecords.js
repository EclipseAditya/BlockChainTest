const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for retrieving all medical records for a patient
 * 
 * Usage: node scripts/getMedicalRecords.js <private-key> <patient-address>
 * 
 * If accessed by the patient themselves, private-key should be the patient's.
 * If accessed by a doctor, private-key should be the doctor's, and they must have been granted access.
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider

// Known Ganache private key to address mappings
const ganacheKeyMappings = {
  '0x388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418': '0x2743bE8fa96BE68A8B779ebCEECA4c7544b41c95',
};

async function getMedicalRecords() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/getMedicalRecords.js <private-key> <patient-address>');
      process.exit(1);
    }
    
    const privateKey = args[0];
    const patientAddress = args[1];
    
    // Validate patient address
    const web3 = new Web3(WEB3_PROVIDER);
    if (!Web3.utils.isAddress(patientAddress)) {
      console.error(`Invalid patient address: ${patientAddress}`);
      process.exit(1);
    }
    
    // Get account from private key, but check our mappings first
    let callerAddress;
    
    // Check if this is a special Ganache private key we've mapped in our system
    if (ganacheKeyMappings[privateKey]) {
      callerAddress = ganacheKeyMappings[privateKey];
      console.log(`Using mapped address: ${callerAddress} for known private key`);
      
      // Add account to wallet with correct address
      web3.eth.accounts.wallet.add({
        privateKey: privateKey,
        address: callerAddress
      });
    } else {
      // Normal case - derive the address from the private key
      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      web3.eth.accounts.wallet.add(account);
      callerAddress = account.address;
    }
    
    console.log(`Caller address: ${callerAddress}`);
    console.log(`Patient address: ${patientAddress}`);
    
    // Get the network ID
    const networkId = await web3.eth.net.getId();
    
    // Get the deployed contract address from the build JSON
    const deployedNetwork = PatientControlledRecords.networks[networkId];
    if (!deployedNetwork) {
      console.error(`Contract not deployed on network ${networkId}`);
      process.exit(1);
    }
    
    // Create contract instance
    const contractAddress = deployedNetwork.address;
    const patientRecords = new web3.eth.Contract(
      PatientControlledRecords.abi,
      contractAddress
    );
    
    console.log(`Contract address: ${contractAddress}`);
    
    // Check access permissions
    let accessExplanation = '';
    
    if (callerAddress.toLowerCase() === patientAddress.toLowerCase()) {
      // Patient is accessing their own records - no need for additional checks
      accessExplanation = 'self-access by patient';
    } else {
      // Only check doctor authorization if not self-access
      const isAuthorizedDoctor = await patientRecords.methods.isAuthorizedDoctor(callerAddress).call();
      if (!isAuthorizedDoctor) {
        console.error(`Access denied: ${callerAddress} is not an authorized doctor`);
        process.exit(1);
      }
      
      // Check if doctor has access to patient's records
      const hasDoctorAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, callerAddress).call();
      if (!hasDoctorAccess) {
        console.error(`Access denied: ${callerAddress} does not have access to patient ${patientAddress}'s records`);
        process.exit(1);
      }
      
      accessExplanation = 'authorized doctor access';
    }
    
    // Get the patient's record count
    const recordCount = await patientRecords.methods.getPatientRecordCount(patientAddress).call({ from: callerAddress });
    console.log(`Patient has ${recordCount} records`);
    
    // Get records
    console.log(`Retrieving records (${accessExplanation})...`);
    const records = await patientRecords.methods.getPatientRecords(patientAddress).call({
      from: callerAddress
    });
    
    // Display records
    console.log(`\nFound ${records.length} records for patient ${patientAddress}:`);
    
    if (records.length === 0) {
      console.log('No records found.');
    } else {
      records.forEach((record, index) => {
        const date = new Date(parseInt(record.timestamp) * 1000);
        console.log(`\nRecord #${index + 1}:`);
        console.log(`Record ID: ${record.recordID}`);
        console.log(`Type: ${record.recordType}`);
        console.log(`Added by: ${record.doctorAddress}`);
        console.log(`Date: ${date.toLocaleString()}`);
        console.log(`Hash: ${record.sha256Hash}`);
        console.log(`IPFS CID: ${record.cid}`);
      });
      
      // Save records to JSON file
      const outputPath = path.join(__dirname, '..', 'data', `records_${patientAddress.substring(0, 8)}.json`);
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify({
        patientAddress: patientAddress,
        accessType: accessExplanation,
        recordCount: records.length,
        records: records
      }, null, 2));
      
      console.log(`\nRecords saved to ${outputPath}`);
    }
    
  } catch (error) {
    console.error('Error retrieving medical records:', error.message);
    process.exit(1);
  }
}

// Run the script
getMedicalRecords(); 
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for adding IPFS-based medical records to the blockchain
 * Takes the output from uploadToPinata.js and sends it to the blockchain
 * 
 * Usage: node scripts/addIPFSRecords.js <ipfs-json-file> <doctor-private-key> <patient-address>
 * 
 * Example IPFS JSON:
 * {
 *   "patientID": "0123456789",
 *   "records": [
 *     {
 *       "recordID": "REC12345",
 *       "recordType": "Blood Test",
 *       "sha256Hash": "0x8d87c72ea6d9577d5721e375f4c84f979580dcb3f5a4254ce612665d8873fd5e",
 *       "cid": "QmX6j9DHcPhgBcBtZsuRkfmk8iAboKwLwfgvwZFWEJ7VTo"
 *     },
 *     ...
 *   ]
 * }
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider
const GAS_LIMIT = 3000000;

async function addIPFSRecords() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.error('Usage: node scripts/addIPFSRecords.js <ipfs-json-file> <doctor-private-key> <patient-address>');
      process.exit(1);
    }
    
    const ipfsJsonPath = args[0];
    const doctorPrivateKey = args[1];
    const patientAddress = args[2];
    
    // Validate patient address
    const web3 = new Web3(WEB3_PROVIDER);
    if (!Web3.utils.isAddress(patientAddress)) {
      console.error(`Invalid patient address: ${patientAddress}`);
      process.exit(1);
    }
    
    // Read and parse the IPFS JSON file
    console.log(`Reading IPFS data file: ${ipfsJsonPath}`);
    if (!fs.existsSync(ipfsJsonPath)) {
      console.error(`IPFS data file not found: ${ipfsJsonPath}`);
      process.exit(1);
    }
    
    const ipfsData = JSON.parse(fs.readFileSync(ipfsJsonPath, 'utf8'));
    const { patientID, records } = ipfsData;
    
    if (!patientID || !records || !Array.isArray(records) || records.length === 0) {
      console.error('Invalid IPFS JSON format. Must include patientID and records array.');
      process.exit(1);
    }
    
    console.log(`\n========= ADDING IPFS RECORDS TO BLOCKCHAIN =========`);
    console.log(`Patient ID: ${patientID}`);
    console.log(`Patient Address: ${patientAddress}`);
    console.log(`Number of records: ${records.length}`);
    
    // Get the doctor's account from private key
    const doctorAccount = web3.eth.accounts.privateKeyToAccount(doctorPrivateKey);
    web3.eth.accounts.wallet.add(doctorAccount);
    const doctorAddress = doctorAccount.address;
    
    console.log(`Doctor Address: ${doctorAddress}`);
    
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
    
    // Check if doctor is authorized in the system
    const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    if (!isAuthorized) {
      console.error(`\n❌ ERROR: Doctor ${doctorAddress} is not authorized in the system.`);
      console.error('Please authorize the doctor first using:');
      console.error(`npm run authorize-doctor ${doctorAddress} <OWNER_PRIVATE_KEY>`);
      process.exit(1);
    }
    
    // Check if doctor has access to the patient's records
    const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    if (!hasAccess) {
      console.error(`\n❌ ERROR: Doctor ${doctorAddress} does not have access to patient ${patientAddress}'s records.`);
      console.error('The patient must grant access using:');
      console.error(`npm run patient-authorize-uploader ${doctorAddress} <PATIENT_PRIVATE_KEY>`);
      process.exit(1);
    }
    
    console.log(`\n✅ Verified: Doctor is authorized and has access to patient's records.`);
    
    // Add each record to the blockchain
    let successCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\nAdding record ${i+1}/${records.length}: ${record.recordID}`);
      
      try {
        console.log(`Record Type: ${record.recordType}`);
        console.log(`SHA256: ${record.sha256Hash}`);
        console.log(`CID: ${record.cid}`);
        
        const result = await patientRecords.methods.addMedicalRecord(
          patientAddress,
          record.recordID,
          record.recordType,
          record.sha256Hash,
          record.cid
        ).send({
          from: doctorAddress,
          gas: GAS_LIMIT
        });
        
        console.log(`✅ Record ${record.recordID} added successfully to blockchain!`);
        console.log(`Transaction hash: ${result.transactionHash}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error adding record ${record.recordID}:`, error.message);
      }
    }
    
    // Get updated record count
    const recordCount = await patientRecords.methods.getPatientRecordCount(patientAddress).call({ from: doctorAddress });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total records in IPFS data: ${records.length}`);
    console.log(`Successfully added to blockchain: ${successCount}`);
    console.log(`Patient now has ${recordCount} records in total`);
    
    if (successCount > 0) {
      console.log(`\nTo view the patient's records:`);
      console.log(`npm run get-records <PRIVATE_KEY> ${patientAddress}`);
    }
    
  } catch (error) {
    console.error('\nError adding IPFS records to blockchain:', error.message);
    process.exit(1);
  }
}

// Run the script
addIPFSRecords(); 
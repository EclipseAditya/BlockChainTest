const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for patients to remove a doctor's permission to upload/view medical records
 * This script provides more detailed information about the permissions being revoked
 * 
 * Usage: node scripts/patientRemoveUploader.js <doctor-address> <patient-private-key>
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider
const GAS_LIMIT = 1000000;

async function revokeDoctorUploadAccess() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/patientRemoveUploader.js <doctor-address> <patient-private-key>');
      process.exit(1);
    }
    
    const doctorAddress = args[0];
    const patientPrivateKey = args[1];
    
    // Validate doctor address
    if (!Web3.utils.isAddress(doctorAddress)) {
      console.error(`Invalid doctor address: ${doctorAddress}`);
      process.exit(1);
    }
    
    // Initialize web3
    const web3 = new Web3(WEB3_PROVIDER);
    
    // Get the patient's account from private key
    const patientAccount = web3.eth.accounts.privateKeyToAccount(patientPrivateKey);
    web3.eth.accounts.wallet.add(patientAccount);
    const patientAddress = patientAccount.address;
    
    console.log('\n========= MEDICAL RECORD ACCESS REVOCATION =========');
    console.log(`Patient: ${patientAddress}`);
    console.log(`Doctor to remove access: ${doctorAddress}`);
    
    // Get the network ID
    const networkId = await web3.eth.net.getId();
    
    // Get the deployed contract address from the build JSON
    const deployedNetwork = PatientControlledRecords.networks[networkId];
    if (!deployedNetwork) {
      console.error(`\n❌ ERROR: Contract not deployed on network ${networkId}`);
      process.exit(1);
    }
    
    // Create contract instance
    const contractAddress = deployedNetwork.address;
    const patientRecords = new web3.eth.Contract(
      PatientControlledRecords.abi,
      contractAddress
    );
    
    console.log(`\nConnecting to Medical Records system at: ${contractAddress}`);
    
    // Check if doctor currently has access
    const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    if (!hasAccess) {
      console.log(`\nℹ️ Doctor ${doctorAddress} does not currently have access to your medical records.`);
      console.log('No action required.');
      process.exit(0);
    }
    
    console.log('\nSECURITY NOTICE:');
    console.log('You are about to revoke this doctor\'s permission to:');
    console.log('  - Upload new medical records to your account');
    console.log('  - View all your existing medical records');
    console.log('\nThis action cannot be undone. You will need to re-authorize this doctor');
    console.log('if you want them to access your records again in the future.');
    
    // Revoke access from doctor
    console.log('\nProcessing revocation...');
    const result = await patientRecords.methods.revokeAccessFromDoctor(doctorAddress).send({
      from: patientAddress,
      gas: GAS_LIMIT
    });
    
    console.log(`\n✅ SUCCESS: Doctor ${doctorAddress} can no longer upload or view your medical records.`);
    console.log(`Transaction confirmed on the blockchain (hash: ${result.transactionHash})`);
    
    // Verify the doctor no longer has access
    const newAccessStatus = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    console.log(`\nVerification: Doctor access status is now: ${newAccessStatus ? 'GRANTED' : 'DENIED'}`);
    
    console.log('\nTo grant access to this doctor again in the future, run:');
    console.log(`npm run patient-authorize-uploader ${doctorAddress} YOUR_PRIVATE_KEY`);
    
  } catch (error) {
    console.error('\n❌ ERROR revoking doctor access:', error.message);
    process.exit(1);
  }
}

// Run the script
revokeDoctorUploadAccess(); 
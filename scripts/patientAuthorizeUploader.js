const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for patients to authorize a specific doctor to upload medical records
 * This script provides more detailed information about the permissions being granted
 * 
 * Usage: node scripts/patientAuthorizeUploader.js <doctor-address> <patient-private-key>
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider
const GAS_LIMIT = 1000000;

async function authorizeDoctorToUpload() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/patientAuthorizeUploader.js <doctor-address> <patient-private-key>');
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
    
    console.log('\n========= MEDICAL RECORD UPLOAD AUTHORIZATION =========');
    console.log(`Patient: ${patientAddress}`);
    console.log(`Doctor to authorize: ${doctorAddress}`);
    
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
    
    // Check if the doctor is authorized in the system
    const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    if (!isAuthorized) {
      console.error(`\n❌ ERROR: Doctor ${doctorAddress} is not authorized in the medical system.`);
      console.error('This doctor must first be verified and authorized by the healthcare administrator.');
      process.exit(1);
    }
    
    console.log(`\n✅ Verified: Doctor ${doctorAddress} is a recognized healthcare provider in the system.`);
    
    // Check if doctor already has access
    const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    if (hasAccess) {
      console.log(`\n✅ This doctor already has permission to upload and view your medical records.`);
      console.log('No additional authorization needed.');
      process.exit(0);
    }
    
    console.log('\nSECURITY NOTICE:');
    console.log('You are about to grant this doctor permission to:');
    console.log('  - Upload new medical records to your account');
    console.log('  - View all your existing medical records');
    console.log('\nThis permission will remain active until you explicitly revoke it.');
    
    // Grant access to doctor
    console.log('\nProcessing authorization...');
    const result = await patientRecords.methods.grantAccessToDoctor(doctorAddress).send({
      from: patientAddress,
      gas: GAS_LIMIT
    });
    
    console.log(`\n✅ SUCCESS: Doctor ${doctorAddress} is now authorized to upload medical records to your account.`);
    console.log(`Transaction confirmed on the blockchain (hash: ${result.transactionHash})`);
    
    // Verify the doctor now has access
    const newAccessStatus = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    console.log(`\nVerification: Doctor access status is now: ${newAccessStatus ? 'GRANTED' : 'DENIED'}`);
    
    console.log('\nTo revoke this permission in the future, run:');
    console.log(`npm run patient-remove-uploader ${doctorAddress} YOUR_PRIVATE_KEY`);
    
  } catch (error) {
    console.error('\n❌ ERROR authorizing doctor:', error.message);
    process.exit(1);
  }
}

// Run the script
authorizeDoctorToUpload(); 
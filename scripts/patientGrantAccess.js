const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for patients to grant access to specific doctors
 * 
 * Usage: node scripts/patientGrantAccess.js <doctor-address> <patient-private-key>
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider
const GAS_LIMIT = 1000000;

async function grantDoctorAccess() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/patientGrantAccess.js <doctor-address> <patient-private-key>');
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
    
    console.log(`Patient address: ${patientAddress}`);
    console.log(`Doctor address to grant access: ${doctorAddress}`);
    
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
    
    // Check if the doctor is authorized in the system
    const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    if (!isAuthorized) {
      console.error(`Doctor ${doctorAddress} is not authorized in the system. Ask admin to authorize this doctor first.`);
      process.exit(1);
    }
    
    // Check if doctor already has access
    const hasAccess = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    if (hasAccess) {
      console.log(`Doctor ${doctorAddress} already has access to your records.`);
      process.exit(0);
    }
    
    // Grant access to doctor
    console.log('Granting access to doctor...');
    const result = await patientRecords.methods.grantAccessToDoctor(doctorAddress).send({
      from: patientAddress,
      gas: GAS_LIMIT
    });
    
    console.log(`✅ Successfully granted access to doctor ${doctorAddress}`);
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    // Verify the doctor now has access
    const newAccessStatus = await patientRecords.methods.hasDoctorAccess(patientAddress, doctorAddress).call();
    console.log(`Verification: Doctor access status is now ${newAccessStatus}`);
    
  } catch (error) {
    console.error('Error granting access to doctor:', error.message);
    process.exit(1);
  }
}

// Run the script
grantDoctorAccess(); 
const Web3 = require('web3');
const PatientControlledRecords = require('../build/contracts/PatientControlledRecords.json');

/**
 * Script for contract owner to revoke a doctor's authorization
 * 
 * Usage: node scripts/revokeDoctor.js <doctor-address> <owner-private-key>
 */

// Configuration
const WEB3_PROVIDER = 'http://localhost:7545'; // Replace with your provider
const GAS_LIMIT = 1000000;

async function revokeDoctor() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: node scripts/revokeDoctor.js <doctor-address> <owner-private-key>');
      process.exit(1);
    }
    
    const doctorAddress = args[0];
    const ownerPrivateKey = args[1];
    
    // Validate doctor address
    if (!Web3.utils.isAddress(doctorAddress)) {
      console.error(`Invalid doctor address: ${doctorAddress}`);
      process.exit(1);
    }
    
    // Initialize web3
    const web3 = new Web3(WEB3_PROVIDER);
    
    // Get the owner's account from private key
    const ownerAccount = web3.eth.accounts.privateKeyToAccount(ownerPrivateKey);
    web3.eth.accounts.wallet.add(ownerAccount);
    const ownerAddress = ownerAccount.address;
    
    console.log(`Owner address: ${ownerAddress}`);
    console.log(`Doctor address to revoke: ${doctorAddress}`);
    
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
    
    // Check if caller is the owner
    const contractOwner = await patientRecords.methods.getOwner().call();
    if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      console.error(`Revocation failed: ${ownerAddress} is not the contract owner (${contractOwner})`);
      process.exit(1);
    }
    
    // Check if doctor is authorized
    const isAlreadyAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    if (!isAlreadyAuthorized) {
      console.log(`Doctor ${doctorAddress} is not authorized, nothing to revoke`);
      process.exit(0);
    }
    
    // Revoke the doctor
    console.log('Revoking doctor authorization...');
    const result = await patientRecords.methods.revokeDoctor(doctorAddress).send({
      from: ownerAddress,
      gas: GAS_LIMIT
    });
    
    console.log(`✅ Doctor ${doctorAddress} successfully revoked`);
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    // Verify the doctor is now revoked
    const isAuthorized = await patientRecords.methods.isAuthorizedDoctor(doctorAddress).call();
    console.log(`Verification: Doctor authorization status is now ${isAuthorized}`);
    
  } catch (error) {
    console.error('Error revoking doctor:', error.message);
    process.exit(1);
  }
}

// Run the script
revokeDoctor(); 
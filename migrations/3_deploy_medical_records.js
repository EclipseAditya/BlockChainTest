const MedicalRecords = artifacts.require("MedicalRecords");

module.exports = function (deployer) {
  // Deploy the MedicalRecords contract
  deployer.deploy(MedicalRecords);
}; 
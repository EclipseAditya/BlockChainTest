const PatientControlledRecords = artifacts.require("PatientControlledRecords");

module.exports = function (deployer) {
  // Deploy the PatientControlledRecords contract
  deployer.deploy(PatientControlledRecords);
}; 
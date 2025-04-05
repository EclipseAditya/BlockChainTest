const PatientData = artifacts.require("PatientData"); // Gets the contract artifact

module.exports = function (deployer) {
  // Deploy the PatientData contract
  deployer.deploy(PatientData);
};
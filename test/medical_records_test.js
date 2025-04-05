const MedicalRecords = artifacts.require("MedicalRecords");

contract("MedicalRecords", (accounts) => {
  // Define test accounts for readability
  const owner = accounts[0];
  const doctor1 = accounts[1];
  const doctor2 = accounts[2];
  const patient1 = accounts[3];
  const patient2 = accounts[4];
  const unauthorized = accounts[5];

  // Test data - using example values
  const testRecord = {
    recordID: "REC12345",
    recordType: "Blood Test",
    // Example SHA256 hash - this would normally be generated from the actual medical data
    sha256Hash: "0x8d87c72ea6d9577d5721e375f4c84f979580dcb3f5a4254ce612665d8873fd5e",
    // Example CID for IPFS - this would be generated when uploading the encrypted data
    cid: "QmX6j9DHcPhgBcBtZsuRkfmk8iAboKwLwfgvwZFWEJ7VTo"
  };

  let medicalRecordsInstance;

  // Deploy a new contract before each test
  beforeEach(async () => {
    medicalRecordsInstance = await MedicalRecords.new({ from: owner });
  });

  it("should set the deployer account as the owner", async () => {
    const contractOwner = await medicalRecordsInstance.getOwner();
    assert.equal(contractOwner, owner, "The deploying account is not set as owner");
  });

  it("should authorize and verify doctors", async () => {
    await medicalRecordsInstance.authorizeDoctor(doctor1, { from: owner });
    
    const isAuthorized = await medicalRecordsInstance.isAuthorizedDoctor(doctor1);
    assert.equal(isAuthorized, true, "Doctor should be authorized");
    
    const isUnauthorized = await medicalRecordsInstance.isAuthorizedDoctor(doctor2);
    assert.equal(isUnauthorized, false, "Doctor should not be authorized");
  });

  it("should allow authorized doctors to add records", async () => {
    // Authorize doctor1
    await medicalRecordsInstance.authorizeDoctor(doctor1, { from: owner });
    
    // Add record for patient1
    await medicalRecordsInstance.addMedicalRecord(
      patient1,
      testRecord.recordID,
      testRecord.recordType,
      testRecord.sha256Hash,
      testRecord.cid,
      { from: doctor1 }
    );
    
    // Check record count
    const recordCount = await medicalRecordsInstance.getPatientRecordCount(patient1, { from: patient1 });
    assert.equal(recordCount, 1, "Record count should be 1");
  });

  it("should not allow unauthorized doctors to add records", async () => {
    try {
      await medicalRecordsInstance.addMedicalRecord(
        patient1,
        testRecord.recordID,
        testRecord.recordType,
        testRecord.sha256Hash,
        testRecord.cid,
        { from: doctor2 } // doctor2 is not authorized
      );
      assert.fail("The transaction should have thrown an error");
    } catch (err) {
      assert.include(err.message, "revert", "The error message should contain 'revert'");
    }
  });

  it("should allow patients to access their own records", async () => {
    // Authorize doctor and add record
    await medicalRecordsInstance.authorizeDoctor(doctor1, { from: owner });
    await medicalRecordsInstance.addMedicalRecord(
      patient1,
      testRecord.recordID,
      testRecord.recordType,
      testRecord.sha256Hash,
      testRecord.cid,
      { from: doctor1 }
    );
    
    // Patient accesses their records
    const records = await medicalRecordsInstance.getPatientRecords(patient1, { from: patient1 });
    
    assert.equal(records.length, 1, "Should have 1 record");
    assert.equal(records[0].recordID, testRecord.recordID, "Record ID should match");
    assert.equal(records[0].sha256Hash, testRecord.sha256Hash, "SHA256 hash should match");
    assert.equal(records[0].cid, testRecord.cid, "CID should match");
  });

  it("should allow authorized doctors to access patient records", async () => {
    // Authorize doctor and add record
    await medicalRecordsInstance.authorizeDoctor(doctor1, { from: owner });
    await medicalRecordsInstance.addMedicalRecord(
      patient1,
      testRecord.recordID,
      testRecord.recordType,
      testRecord.sha256Hash,
      testRecord.cid,
      { from: doctor1 }
    );
    
    // Doctor accesses patient records
    const records = await medicalRecordsInstance.getPatientRecords(patient1, { from: doctor1 });
    
    assert.equal(records.length, 1, "Should have 1 record");
    assert.equal(records[0].sha256Hash, testRecord.sha256Hash, "SHA256 hash should match");
  });

  it("should not allow unauthorized users to access patient records", async () => {
    // Authorize doctor and add record
    await medicalRecordsInstance.authorizeDoctor(doctor1, { from: owner });
    await medicalRecordsInstance.addMedicalRecord(
      patient1,
      testRecord.recordID,
      testRecord.recordType,
      testRecord.sha256Hash,
      testRecord.cid,
      { from: doctor1 }
    );
    
    // Unauthorized attempt to access records
    try {
      await medicalRecordsInstance.getPatientRecords(patient1, { from: unauthorized });
      assert.fail("The transaction should have thrown an error");
    } catch (err) {
      assert.include(err.message, "revert", "The error message should contain 'revert'");
    }
  });
}); 
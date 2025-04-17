// Firebase configuration and utility functions for patient data management
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc } = require('firebase/firestore');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIGqnQdxpXYUUU5HiRfkrqQv9pk8VmBbM",
  authDomain: "chakra-b3d4b.firebaseapp.com",
  projectId: "chakra-b3d4b",
  storageBucket: "chakra-b3d4b.firebasestorage.app",
  messagingSenderId: "673336667562",
  appId: "1:673336667562:web:0827d7a4e0f43757d40fd3",
  measurementId: "G-Z14QFT9GF5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection reference
const patientsCollection = 'patients';

/**
 * Save patient data to Firestore
 * @param {Object} patientData - Object containing patient information
 * @returns {Promise<Object>} - Operation result
 */
async function savePatient(patientData) {
  try {
    const patientRef = doc(db, patientsCollection, patientData.patientId);
    await setDoc(patientRef, {
      aadharNumber: patientData.aadharNumber,
      fullName: patientData.fullName,
      walletAddress: patientData.walletAddress,
      email: patientData.email || '',
      phoneNumber: patientData.phoneNumber || '',
      age: patientData.age || '',
      gender: patientData.gender || '',
      bloodGroup: patientData.bloodGroup || '',
      allergies: patientData.allergies || '',
      medicalConditions: patientData.medicalConditions || '',
      registrationDate: patientData.registrationDate || new Date().toISOString(),
      status: patientData.status || 'active',
      privateKey: patientData.privateKey || '',
      password: patientData.password || null,
      lastLogin: patientData.lastLogin || null
    });
    
    return { success: true, patientId: patientData.patientId };
  } catch (error) {
    console.error("Error saving patient data:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patient by ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} - Patient data or error
 */
async function getPatientById(patientId) {
  try {
    const patientRef = doc(db, patientsCollection, patientId);
    const patientSnap = await getDoc(patientRef);
    
    if (patientSnap.exists()) {
      return { 
        success: true, 
        data: { patientId, ...patientSnap.data() } 
      };
    } else {
      return { success: false, error: "Patient not found" };
    }
  } catch (error) {
    console.error("Error fetching patient by ID:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patient by Aadhaar number
 * @param {string} aadharNumber - Aadhaar number
 * @returns {Promise<Object>} - Patient data or error
 */
async function getPatientByAadhaar(aadharNumber) {
  try {
    const q = query(collection(db, patientsCollection), where("aadharNumber", "==", aadharNumber));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const patientDoc = querySnapshot.docs[0];
      return { 
        success: true, 
        data: { patientId: patientDoc.id, ...patientDoc.data() } 
      };
    } else {
      return { success: false, error: "Patient not found" };
    }
  } catch (error) {
    console.error("Error fetching patient by Aadhaar:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patient by wallet address
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<Object>} - Patient data or error
 */
async function getPatientByWalletAddress(walletAddress) {
  try {
    const q = query(collection(db, patientsCollection), where("walletAddress", "==", walletAddress));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const patientDoc = querySnapshot.docs[0];
      return { 
        success: true, 
        data: { patientId: patientDoc.id, ...patientDoc.data() } 
      };
    } else {
      return { success: false, error: "Patient not found" };
    }
  } catch (error) {
    console.error("Error fetching patient by wallet address:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update patient password
 * @param {string} patientId - Patient ID
 * @param {string} password - New password
 * @returns {Promise<Object>} - Operation result
 */
async function updatePatientPassword(patientId, password) {
  try {
    const patientRef = doc(db, patientsCollection, patientId);
    await updateDoc(patientRef, {
      password: password,
      lastUpdated: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating patient password:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Import multiple patients from JSON
 * @param {Object} patientsJson - JSON object with patients array
 * @returns {Promise<Object>} - Operation results
 */
async function importPatientsFromJson(patientsJson) {
  try {
    const results = [];
    for (const patient of patientsJson.patients) {
      const result = await savePatient(patient);
      results.push(result);
    }
    return { success: true, results };
  } catch (error) {
    console.error("Error importing patients:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  db,
  savePatient,
  getPatientById,
  getPatientByAadhaar,
  getPatientByWalletAddress,
  updatePatientPassword,
  importPatientsFromJson
}; 
 
 
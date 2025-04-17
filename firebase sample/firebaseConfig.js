// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Only initialize analytics in browser environments
let analytics = null;
if (typeof window !== 'undefined') {
  // Dynamically import analytics to avoid issues in Node.js
  import('firebase/analytics').then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  }).catch(err => {
    console.warn("Analytics failed to initialize:", err);
  });
}

// Collection reference
const patientsCollection = collection(db, "patients");

// Create or update a patient document
export const savePatient = async (patientData) => {
  try {
    const patientRef = doc(patientsCollection, patientData.patientId);
    await setDoc(patientRef, {
      aadharNumber: patientData.aadharNumber,
      name: patientData.name,
      walletAddress: patientData.walletAddress,
      basicInfo: patientData.basicInfo
    });
    return { success: true, patientId: patientData.patientId };
  } catch (error) {
    console.error("Error saving patient data:", error);
    return { success: false, error };
  }
};

// Get a patient by ID
export const getPatientById = async (patientId) => {
  try {
    const patientRef = doc(patientsCollection, patientId);
    const patientSnap = await getDoc(patientRef);
    
    if (patientSnap.exists()) {
      return { success: true, data: { patientId, ...patientSnap.data() } };
    } else {
      return { success: false, error: "Patient not found" };
    }
  } catch (error) {
    console.error("Error fetching patient:", error);
    return { success: false, error };
  }
};

// Get patient by wallet address
export const getPatientByWalletAddress = async (walletAddress) => {
  try {
    const q = query(patientsCollection, where("walletAddress", "==", walletAddress));
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
    return { success: false, error };
  }
};

// Import patients from JSON
export const importPatientsFromJson = async (patientsJson) => {
  try {
    const results = [];
    for (const patient of patientsJson.patients) {
      const result = await savePatient(patient);
      results.push(result);
    }
    return { success: true, results };
  } catch (error) {
    console.error("Error importing patients:", error);
    return { success: false, error };
  }
};

export { db, patientsCollection, analytics }; 
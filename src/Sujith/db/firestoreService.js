import { db } from "../config/firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc
} from "firebase/firestore";

/**
 * ශිෂ්‍යයාගේ profile data Firestore 'students' collection එකට save කිරීම.
 * Document ID ලෙස Firebase Auth UID එක භාවිතා කෙරේ.
 */
export const saveStudentProfile = async (uid, studentData, isNew = false) => {
  try {
    const studentDocRef = doc(db, "students", uid);

    if (isNew) {
      // New registration — set all fields including defaults
      await setDoc(studentDocRef, {
        ...studentData,
        uid,
        isVerified: false,
        status: "active",
        createdAt: serverTimestamp(),
      });
    } else {
      // Profile update — merge so createdAt / isVerified are preserved
      await setDoc(studentDocRef, {
        ...studentData,
        uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving student profile: ", error);
    throw error;
  }
};

/**
 * ශිෂ්‍යයෙකුගේ profile data Firestore 'students' collection එකෙන් ලබා ගැනීම.
 */
export const getStudentProfile = async (uid) => {
  try {
    const studentDocRef = doc(db, "students", uid);
    const docSnap = await getDoc(studentDocRef);

    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No such student found!");
      return null;
    }
  } catch (error) {
    throw error;
  }
};

// ── ADMIN: Students Management ─────────────────────────────────────

/**
 * Retrieve all registered students.
 */
export const getAllStudents = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "students"));
    const students = [];
    querySnapshot.forEach((doc) => {
      students.push({ id: doc.id, ...doc.data() });
    });
    return students;
  } catch (error) {
    console.error("Error getting students: ", error);
    throw error;
  }
};

/**
 * Delete a student from Firestore.
 */
export const deleteStudent = async (uid) => {
  try {
    await deleteDoc(doc(db, "students", uid));
    return { success: true };
  } catch (error) {
    console.error("Error deleting student: ", error);
    throw error;
  }
};

// ── CLASSES: Catalog ───────────────────────────────────────────────

/**
 * Add a new class to the purchase catalog.
 */
export const addClass = async (classData) => {
  try {
    const docRef = await addDoc(collection(db, "classes"), {
      ...classData,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding class: ", error);
    throw error;
  }
};

/**
 * Retrieve all classes in the purchase catalog.
 */
export const getClasses = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "classes"));
    const classes = [];
    querySnapshot.forEach((doc) => {
      classes.push({ id: doc.id, ...doc.data() });
    });
    return classes;
  } catch (error) {
    console.error("Error getting classes: ", error);
    throw error;
  }
};

// ── PAYMENTS & PURCHASES ──────────────────────────────────────────

/**
 * Submit a payment slip request for a class.
 */
export const submitPayment = async (paymentData) => {
  try {
    const docRef = await addDoc(collection(db, "payments"), {
      ...paymentData,
      status: "pending",
      submittedAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error submitting payment: ", error);
    throw error;
  }
};

/**
 * Get all payment records submitted by a specific student.
 */
export const getStudentPayments = async (studentUid) => {
  try {
    const q = query(collection(db, "payments"), where("studentUid", "==", studentUid));
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return payments;
  } catch (error) {
    console.error("Error getting student payments: ", error);
    throw error;
  }
};

/**
 * Get all payment records for the admin to approve/reject.
 */
export const getAllPayments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "payments"));
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return payments;
  } catch (error) {
    console.error("Error getting all payments: ", error);
    throw error;
  }
};

/**
 * Approve a pending payment.
 */
export const approvePayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      status: "approved",
      approvedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error approving payment: ", error);
    throw error;
  }
};

/**
 * Reject a pending payment.
 */
export const rejectPayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      status: "rejected",
      rejectedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error rejecting payment: ", error);
    throw error;
  }
};

/**
 * Confirm that the student has received the tute.
 */
export const confirmTuteDelivery = async (paymentId) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      deliveryStatus: "Delivered",
      studentConfirmed: true,
      deliveredAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error confirming delivery: ", error);
    throw error;
  }
};
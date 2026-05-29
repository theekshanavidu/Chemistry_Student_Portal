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

// ── ADMIN AUTH & MANAGEMENT FUNCTIONS ──

/**
 * Save admin details to Firestore 'admins' collection.
 */
export const saveAdminProfile = async (uid, adminData) => {
  try {
    const adminRef = doc(db, "admins", uid);
    await setDoc(adminRef, {
      ...adminData,
      uid,
      role: "admin",
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving admin profile:", error);
    throw error;
  }
};

/**
 * Fetch admin profile by UID.
 */
export const getAdminProfile = async (uid) => {
  try {
    const adminRef = doc(db, "admins", uid);
    const docSnap = await getDoc(adminRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    throw error;
  }
};

/**
 * Delete a class from the catalog.
 */
export const deleteClass = async (classId) => {
  try {
    await deleteDoc(doc(db, "classes", classId));
    return { success: true };
  } catch (error) {
    console.error("Error deleting class:", error);
    throw error;
  }
};

/**
 * Update class details (e.g. videos, zoom Link).
 */
export const updateClass = async (classId, data) => {
  try {
    const classRef = doc(db, "classes", classId);
    await updateDoc(classRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating class:", error);
    throw error;
  }
};

/**
 * Find a student profile by their custom Student ID.
 */
export const getStudentByStudentId = async (studentId) => {
  try {
    const q = query(collection(db, "students"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error finding student by ID:", error);
    throw error;
  }
};

/**
 * Activate a class physically for a student.
 */
export const activateClassForStudent = async (studentUid, studentName, studentId, classId, classTitle, price) => {
  try {
    // Check if there is already an active payment for this class and student
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Update existing payment to approved
      const payDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "payments", payDoc.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        paymentType: "physical_activation"
      });
    } else {
      // Create new approved payment record
      await addDoc(collection(db, "payments"), {
        studentUid,
        studentName,
        studentId,
        classId,
        classTitle,
        price: Number(price),
        status: "approved",
        paymentType: "physical_activation",
        submittedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        tuteRequired: true,
        deliveryStatus: "Pending"
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error activating class for student:", error);
    throw error;
  }
};

/**
 * Deactivate a class for a student.
 */
export const deactivateClassForStudent = async (studentUid, classId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    // Delete or mark rejected
    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, "payments", docSnap.id));
    }
    return { success: true };
  } catch (error) {
    console.error("Error deactivating class for student:", error);
    throw error;
  }
};

/**
 * Update delivery status, tracking ID, and courier link for a payment.
 */
export const updatePaymentDelivery = async (paymentId, updateData) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      ...updateData,
      shippedAt: updateData.deliveryStatus === "Shipped" ? new Date().toISOString() : undefined,
      deliveredAt: updateData.deliveryStatus === "Delivered" ? new Date().toISOString() : undefined
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating payment delivery status:", error);
    throw error;
  }
};
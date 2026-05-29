import { auth } from "../config/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

// 1. අලුත් ශිෂ්‍යයෙක් Register කිරීම
export const registerStudent = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user; // මෙයාගෙන් තමයි user ගේ unique 'uid' එක ලැබෙන්නේ
  } catch (error) {
    throw error;
  }
};

// 2. ශිෂ්‍යයා Login කිරීම
export const loginStudent = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};
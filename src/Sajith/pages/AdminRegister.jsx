import React, { useState } from "react";
import { auth } from "../config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { saveAdminProfile } from "../db/firestoreService";

export default function AdminRegister({ onNavigate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords ගැලපෙන්නේ නැත.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password එක අවම වශයෙන් අකුරු/ඉලක්කම් 6ක් විය යුතුය.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save to admins collection
      await saveAdminProfile(user.uid, {
        name,
        email,
      });

      setSuccess(true);
      setTimeout(() => {
        onNavigate("admin-login");
      }, 2000);
    } catch (err) {
      console.error(err);
      const messages = {
        "auth/email-already-in-use": "මෙම Email ලිපිනය දැනටමත් ලියාපදිංචි වී ඇත.",
        "auth/invalid-email": "Email ලිපිනය නිවැරදි නොවේ.",
        "auth/weak-password": "Password එක දුර්වල වැඩියි.",
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden relative p-8 md:p-10">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-purple-600 to-indigo-600" />

        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-black text-lg">A</span>
          </div>
          <span className="text-gray-900 font-extrabold text-xl tracking-tight">ADMIN PORTAL</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Admin Register</h1>
          <p className="text-gray-400 text-xs mt-1">CM.ECHEM.LK Admin Control Panel</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl text-center font-bold">
            ලියාපදිංචිය සාර්ථකයි! Login පිටුවට යොමු කෙරේ...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sujith K Kumara"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@echem.lk"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-colors text-sm shadow-md flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Registering...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-xs text-gray-500">
            දැනටමත් ගිණුමක් තිබේද?{" "}
            <button
              onClick={() => onNavigate("admin-login")}
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
          <div className="border-t pt-3">
            <button
              onClick={() => onNavigate("login")}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold inline-flex items-center gap-1"
            >
              ← Student Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

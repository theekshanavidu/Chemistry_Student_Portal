import React, { useState } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getAdminProfile } from "../db/firestoreService";

export default function AdminLogin({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Verify if user is an admin in Firestore
      const adminProfile = await getAdminProfile(user.uid);
      if (!adminProfile) {
        // Log out immediately if not an admin
        await signOut(auth);
        throw new Error("ප්‍රවේශය අත්හිටුවා ඇත: ඔබ ලියාපදිංචි පරිපාලකයෙකු (Admin) නොවේ.");
      }
      
      // Navigation is handled in App.jsx auth state observer or we can trigger it
      window.location.reload();
    } catch (err) {
      console.error(err);
      const messages = {
        "auth/user-not-found": "මෙම Admin Email ලිපිනය ලියාපදිංචි වී නොමැත.",
        "auth/wrong-password": "Password නිවැරදි නොවේ.",
        "auth/invalid-credential": "Email හෝ Password වැරදිය.",
        "auth/invalid-email": "Email ලිපිනය නිවැරදිව ඇතුළු කරන්න.",
        "auth/too-many-requests": "ඉතා බොහෝ වාර ගණනාවක් උත්සාහ කළා. ටිකක් රැඳෙන්න.",
        "auth/network-request-failed": "Network සම්බන්ධතාව පරීක්ෂා කරන්න.",
      };
      setError(messages[err.code] || err.message);
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
          <h1 className="text-2xl font-bold text-gray-800">Admin Sign In</h1>
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

        <form onSubmit={handleSubmit} className="space-y-5">
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
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Password</label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-extrabold py-3 px-6 rounded-xl transition-colors text-sm shadow-md flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logging in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-xs text-gray-500">
            පරිපාලක ගිණුමක් නොමැතිද?{" "}
            <button
              onClick={() => onNavigate("admin-register")}
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline"
            >
              Sign Up (Register)
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

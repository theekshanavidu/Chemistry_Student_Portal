import React, { useState } from "react";
import { loginStudent } from "../services/authService";

export default function Login({ onNavigate }) {
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
      await loginStudent(email, password);
    } catch (err) {
      const messages = {
        "auth/user-not-found":      "මෙම Email ලිපිනය ලියාපදිංචි නොවී ඇත.",
        "auth/wrong-password":      "Password නිවැරදි නොවේ.",
        "auth/invalid-credential":  "Email හෝ Password වැරදිය.",
        "auth/invalid-email":       "Email ලිපිනය නිවැරදිව ඇතුළු කරන්න.",
        "auth/too-many-requests":   "ඉතා බොහෝ වාර ගණනාවක් උත්සාහ කළා. ටිකක් රැඳෙන්න.",
        "auth/network-request-failed": "Network සම්බන්ධතාව පරීක්ෂා කරන්න.",
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Hero Image ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img
          src="/login_hero.png"
          alt="SKCHEM.COM Teacher"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* ── Right: Form Panel ── */}
      <div className="flex-1 lg:w-[45%] flex flex-col items-center justify-center bg-white px-8 py-12 relative">


        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <span className="text-gray-800 font-bold text-xl tracking-tight">SKCHEM.COM</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome to SKCHEM.COM!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Please sign-in to your account and start the adventure
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@gmail.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
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
              <div className="mt-2 text-right">
                <a href="#" className="text-xs text-red-600 hover:text-red-700 font-medium">
                  Password අමතක වුණාද?
                </a>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              id="login-btn"
              disabled={loading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-6 rounded-lg transition-colors text-sm shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Login වෙමින්...
                </>
              ) : (
                "Login"
              )}
            </button>

            {/* Register Button */}
            <button
              type="button"
              id="goto-register-btn"
              onClick={() => onNavigate("register")}
              className="w-full bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm"
            >
              Register
            </button>
          </form>

          <div className="text-center text-gray-400 mt-8 space-y-0.5">
            <p className="text-xs font-bold text-gray-600">SKCHEM.COM - Sujith K Kumara</p>
            <p className="text-[10px] font-medium">Copyright &copy; Theekshana Viduranga <span className="font-mono">&lt;/&gt;</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth } from './Sujith/config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getStudentProfile, saveStudentProfile } from './Sujith/db/firestoreService';
import Login from './Sujith/pages/Login';
import Register from './Sujith/pages/Register';
import StudentDashboard from './Sujith/pages/StudentDashboard';

function AppInner() {
  const [user, setUser] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Disable right-click globally across all pages
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setAuthError('');
      if (currentUser) {
        setUser(currentUser);
        try {
          let profile = await getStudentProfile(currentUser.uid);
          if (!profile) {
            const defaultProfile = {
              firstName: currentUser.email ? currentUser.email.split('@')[0] : 'Student',
              lastName: 'User',
              email: currentUser.email || 'student@skchem.com',
              studentId: 'SK' + Math.floor(100000 + Math.random() * 900000).toString(),
              batch: '2026AL',
              mobile: '0777123456',
              address: 'No. 123, Street, City',
              homeCity: 'Colombo',
              nic: '200000000000',
              gender: 'Male',
              school: 'Other'
            };
            await saveStudentProfile(currentUser.uid, defaultProfile, true);
            profile = defaultProfile;
          }

          // Enforce custom browser session ID check (Facebook/Instagram style device protection)
          let localSessionId = localStorage.getItem('student_session_id');
          if (!profile.currentSessionId) {
            // Case 1: Firestore document has no session ID (fresh account or legacy)
            const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
            await saveStudentProfile(currentUser.uid, { currentSessionId: newSessionId });
            localStorage.setItem('student_session_id', newSessionId);
            profile.currentSessionId = newSessionId;
          } else if (!localSessionId) {
            // Case 2: New login on this browser/device
            const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
            await saveStudentProfile(currentUser.uid, { currentSessionId: newSessionId });
            localStorage.setItem('student_session_id', newSessionId);
            profile.currentSessionId = newSessionId;
          } else if (profile.currentSessionId !== localSessionId) {
            // Case 3: Session mismatch (account active on another device)
            setAuthError('⚠️ මෙම ගිණුම වෙනත් උපකරණයකින් ලොග් වී ඇත. (Logged out: Account active on another device)');
            localStorage.removeItem('student_session_id');
            await signOut(auth);
            setUser(null);
            setStudentData(null);
            navigate('/login', { replace: true });
            setLoading(false);
            return;
          }

          setStudentData(profile);
          // Only navigate to dashboard if currently on login/register
          if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
            navigate('/dashboard/home', { replace: true });
          }
        } catch (error) {
          console.error('Firestore error:', error);
          setAuthError(
            error.code === 'permission-denied'
              ? '⚠️ Firestore Rules Permission Denied.'
              : '⚠️ Profile load error: ' + error.message
          );
          localStorage.removeItem('student_session_id');
          await signOut(auth);
          setUser(null);
          setStudentData(null);
          navigate('/login', { replace: true });
        }
      } else {
        setUser(null);
        setStudentData(null);
        localStorage.removeItem('student_session_id');
        navigate('/login', { replace: true });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to window focus events to immediately log out if logged in on another device
  useEffect(() => {
    const checkSession = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const profile = await getStudentProfile(currentUser.uid);
          const localSessionId = localStorage.getItem('student_session_id');
          if (profile && profile.currentSessionId && localSessionId && profile.currentSessionId !== localSessionId) {
            alert('⚠️ මෙම ගිණුම වෙනත් උපකරණයකින් ලොග් වී ඇත. (Logged out: Account active on another device)');
            localStorage.removeItem('student_session_id');
            await signOut(auth);
            window.location.reload();
          }
        } catch (e) {
          console.error('Session focus check error:', e);
        }
      }
    };
    window.addEventListener('focus', checkSession);
    return () => window.removeEventListener('focus', checkSession);
  }, [user]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('student_session_id');
      await signOut(auth);
      setUser(null);
      setStudentData(null);
      setAuthError('');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-gray-500">SKCHEM.COM පූරණය වෙමින්...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {authError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-xs font-bold px-6 py-3 flex items-center justify-between shadow-lg">
          <span>{authError}</span>
          <button onClick={() => setAuthError('')} className="ml-4 text-white/80 hover:text-white font-bold">✕</button>
        </div>
      )}
      <Routes>
        <Route path="/login" element={!user ? <Login onNavigate={(p) => navigate('/' + p)} /> : <Navigate to="/dashboard/home" replace />} />
        <Route path="/register" element={!user ? <Register onNavigate={(p) => navigate('/' + p)} /> : <Navigate to="/dashboard/home" replace />} />
        <Route
          path="/dashboard/*"
          element={
            user && studentData
              ? <StudentDashboard initialStudentData={studentData} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="/" element={<Navigate to={user ? '/dashboard/home' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard/home' : '/login'} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
import React, { useState, useEffect } from "react";
import {
  getAllStudents,
  deleteStudent,
  addClass,
  getClasses,
  getAllPayments,
  approvePayment,
  rejectPayment
} from "../db/firestoreService";

export default function AdminDashboard({ onNavigate }) {
  const [activeTab, setActiveTab] = useState("students"); // "students", "classes", "approvals"
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  
  // Loading states
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // New Class Form State
  const [classForm, setClassForm] = useState({
    title: "",
    price: "",
    month: "June",
    batch: "2026AL",
    description: "",
    type: "chemistry"
  });
  const [addingClassStatus, setAddingClassStatus] = useState("");

  // Modals / Zoom States
  const [viewingStudent, setViewingStudent] = useState(null);
  const [zoomedSlip, setZoomedSlip] = useState(null);

  // Fetch all data
  const fetchData = async () => {
    setLoadingStudents(true);
    setLoadingClasses(true);
    setLoadingPayments(true);
    try {
      const allStuds = await getAllStudents();
      setStudents(allStuds);
      
      const allCls = await getClasses();
      setClasses(allCls);
      
      const allPays = await getAllPayments();
      setPayments(allPays);
    } catch (e) {
      console.error("Error fetching admin dashboard data:", e);
    } finally {
      setLoadingStudents(false);
      setLoadingClasses(false);
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Delete Student
  const handleDeleteStudent = async (uid) => {
    if (window.confirm("මෙම ශිෂ්‍යයා ඇත්තටම පද්ධතියෙන් ඉවත් කිරීමට අවශ්‍යද?")) {
      try {
        await deleteStudent(uid);
        alert("ශිෂ්‍යයා සාර්ථකව ඉවත් කරන ලදී.");
        fetchData();
      } catch (err) {
        alert("ඉවත් කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Add Class
  const handleAddClassSubmit = async (e) => {
    e.preventDefault();
    if (!classForm.title || !classForm.price) {
      alert("කරුණාකර සියලු විස්තර ඇතුළත් කරන්න.");
      return;
    }
    setAddingClassStatus("adding");
    try {
      const payload = {
        ...classForm,
        price: Number(classForm.price),
      };
      await addClass(payload);
      setAddingClassStatus("success");
      setClassForm({
        title: "",
        price: "",
        month: "June",
        batch: "2026AL",
        description: "",
        type: "chemistry"
      });
      fetchData();
      setTimeout(() => setAddingClassStatus(""), 2000);
    } catch (err) {
      alert("පන්තිය ඇතුළත් කිරීම අසාර්ථකයි: " + err.message);
      setAddingClassStatus("");
    }
  };

  // Approve Payment
  const handleApprovePayment = async (paymentId) => {
    try {
      await approvePayment(paymentId);
      alert("ගෙවීම් රිසිට්පත සාර්ථකව අනුමත කරන ලදී! පන්තිය ශිෂ්‍යයාට විවෘත වේ.");
      fetchData();
    } catch (err) {
      alert("අනුමත කිරීම අසාර්ථකයි: " + err.message);
    }
  };

  // Reject Payment
  const handleRejectPayment = async (paymentId) => {
    if (window.confirm("මෙම ගෙවීම් රිසිට්පත ප්‍රතික්ෂේප කිරීමට අවශ්‍යද?")) {
      try {
        await rejectPayment(paymentId);
        alert("ගෙවීම් රිසිට්පත ප්‍රතික්ෂේප කරන ලදී.");
        fetchData();
      } catch (err) {
        alert("ප්‍රතික්ෂේප කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Filter students by search query
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.firstName || "").toLowerCase().includes(q) ||
      (s.lastName || "").toLowerCase().includes(q) ||
      (s.studentId || "").toLowerCase().includes(q) ||
      (s.mobile || "").toLowerCase().includes(q) ||
      (s.school || "").toLowerCase().includes(q)
    );
  });

  // Analytics Stats
  const activeStudentsCount = students.length;
  const pendingPayments = payments.filter((p) => p.status === "pending");
  const pendingPaymentsCount = pendingPayments.length;
  const totalClassesCount = classes.length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
      {/* ── Admin Dashboard Header ── */}
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-black text-base">A</span>
          </div>
          <h1 className="font-extrabold text-lg text-gray-900 tracking-tight">CM.ECHEM.LK - Admin Control Panel</h1>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("student-dashboard")}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-full text-xs shadow-sm transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Student Portal
          </button>

          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider px-3 py-1 bg-gray-100 rounded-lg">
            System Admin
          </span>
        </div>
      </header>

      {/* ── Dashboard Stats Section ── */}
      <section className="px-8 pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Students Card */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Registered Students</p>
            <h4 className="text-2xl font-black text-gray-900 mt-1">{loadingStudents ? "..." : activeStudentsCount}</h4>
          </div>
        </div>

        {/* Pending Payments Card */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pending Payment Slips</p>
            <h4 className="text-2xl font-black text-gray-900 mt-1">{loadingPayments ? "..." : pendingPaymentsCount}</h4>
          </div>
        </div>

        {/* Active Classes Card */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Classes In Catalog</p>
            <h4 className="text-2xl font-black text-gray-900 mt-1">{loadingClasses ? "..." : totalClassesCount}</h4>
          </div>
        </div>
      </section>

      {/* ── Tabs Navigation ── */}
      <section className="px-8 mt-8">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("students")}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "students"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-950"
            }`}
          >
            Students Management
          </button>
          <button
            onClick={() => setActiveTab("classes")}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "classes"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-950"
            }`}
          >
            Add &amp; Manage Classes
          </button>
          <button
            onClick={() => setActiveTab("approvals")}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "approvals"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-950"
            }`}
          >
            Approve Slip Payments
            {pendingPaymentsCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                {pendingPaymentsCount}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* ── Sub-view Panel ── */}
      <main className="p-8 flex-1">
        {/* ──────────────────────────────────────────────────────── */}
        {/* 1. STUDENTS MANAGEMENT TAB                               */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <h2 className="text-xl font-bold text-gray-900">Registered Students Directory</h2>
              {/* Search input */}
              <div className="relative max-w-md w-full">
                <input
                  type="text"
                  placeholder="ID, Name, Mobile or School වලින් සොයන්න..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </span>
              </div>
            </div>

            {loadingStudents ? (
              <div className="flex justify-center p-12">
                <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border p-8">
                ශිෂ්‍යයින් කිසිවෙකු සොයාගත නොහැකි විය.
              </div>
            ) : (
              <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-700">
                    <thead className="bg-gray-50 border-b font-extrabold text-xs uppercase text-gray-400 tracking-wider">
                      <tr>
                        <th className="py-4 px-6">Student ID</th>
                        <th className="py-4 px-6">Name</th>
                        <th className="py-4 px-6">AL Batch</th>
                        <th className="py-4 px-6">Mobile</th>
                        <th className="py-4 px-6">City</th>
                        <th className="py-4 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {filteredStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-purple-600 font-mono tracking-wider">{s.studentId || "N/A"}</td>
                          <td className="py-4 px-6 font-semibold text-gray-900">{s.firstName} {s.lastName}</td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-800 text-[10px] font-bold rounded uppercase">
                              {s.batch}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-500 font-mono text-xs">{s.mobile}</td>
                          <td className="py-4 px-6 text-gray-500 text-xs">{s.homeCity}</td>
                          <td className="py-4 px-6 flex items-center justify-center gap-3">
                            <button
                              onClick={() => setViewingStudent(s)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-colors"
                            >
                              Profile
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(s.id)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* 2. ADD & MANAGE CLASSES TAB                              */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === "classes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Class Creator Form */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm h-fit">
              <h3 className="font-extrabold text-gray-900 text-lg border-b pb-3 mb-4">Add New Class Catalog</h3>
              <form onSubmit={handleAddClassSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Class Title</label>
                  <input
                    type="text"
                    placeholder="2026 Revision Only | June"
                    value={classForm.title}
                    onChange={(e) => setClassForm({ ...classForm, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Price (LKR)</label>
                  <input
                    type="number"
                    placeholder="3300"
                    value={classForm.price}
                    onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                    required
                    className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Month */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Month</label>
                  <select
                    value={classForm.month}
                    onChange={(e) => setClassForm({ ...classForm, month: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50"
                  >
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Batch */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">AL Batch Compatibility</label>
                  <select
                    value={classForm.batch}
                    onChange={(e) => setClassForm({ ...classForm, batch: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50"
                  >
                    <option value="2026AL">2026 A/L</option>
                    <option value="2027AL">2027 A/L</option>
                    <option value="2028AL">2028 A/L</option>
                    <option value="2026Rapid">2026 Rapid</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description (Optional)</label>
                  <textarea
                    placeholder="Class objectives, details..."
                    value={classForm.description}
                    onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingClassStatus === "adding"}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-2.5 rounded-lg text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                >
                  {addingClassStatus === "adding" ? "Creating..." : "Add Class to Catalog"}
                </button>

                {addingClassStatus === "success" && (
                  <p className="text-center text-green-600 text-xs font-bold mt-2">Class added successfully! 🎉</p>
                )}
              </form>
            </div>

            {/* Existing Classes Catalog */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-extrabold text-gray-900 text-lg border-b pb-3">Active Classes List</h3>
              
              {loadingClasses ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border p-8">
                  මෙතෙක් කිසිදු පන්තියක් ඇතුළත් කර නැත.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {classes.map((cls) => (
                    <div key={cls.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-extrabold rounded uppercase tracking-wider">
                            {cls.batch}
                          </span>
                          <span className="font-bold text-gray-900 text-sm">LKR {cls.price}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 text-base">{cls.title}</h4>
                        <p className="text-xs text-gray-400">Target Month: {cls.month}</p>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed truncate">
                        {cls.description || "No description provided."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* 3. SLIP APPROVALS TAB                                    */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === "approvals" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Pending Slip Payments Approval</h2>

            {loadingPayments ? (
              <div className="flex justify-center p-12">
                <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border p-8">
                අනුමත කිරීමට බලාපොරොත්තුවෙන් පවතින ගෙවීම් රිසිට්පත් කිසිවක් නැත!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingPayments.map((pay) => (
                  <div key={pay.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      {/* Thumbnail view of slip */}
                      <div
                        onClick={() => setZoomedSlip(pay.slipImage)}
                        className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden cursor-zoom-in relative border-b"
                      >
                        <img
                          src={pay.slipImage}
                          alt="Slip Thumbnail"
                          className="h-full w-full object-contain hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-bold py-1 px-2.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                          🔍 Click to zoom
                        </span>
                      </div>

                      {/* Payment and student details */}
                      <div className="p-5 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                            Student ID: {pay.studentId}
                          </p>
                          <h4 className="font-extrabold text-gray-900 text-base">{pay.studentName}</h4>
                        </div>
                        
                        <div className="bg-gray-50 border rounded-xl p-3 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Class:</span>
                            <span className="font-semibold text-gray-800">{pay.classTitle}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount:</span>
                            <span className="font-bold text-gray-800">LKR {pay.price}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Date:</span>
                            <span className="text-gray-500 font-mono">
                              {pay.submittedAt ? new Date(pay.submittedAt).toLocaleString() : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Approve / Reject buttons */}
                    <div className="p-5 pt-0 flex gap-3">
                      <button
                        onClick={() => handleRejectPayment(pay.id)}
                        className="flex-1 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs rounded-lg transition-colors border border-red-200"
                      >
                        Reject Slip
                      </button>
                      <button
                        onClick={() => handleApprovePayment(pay.id)}
                        className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition-colors"
                      >
                        Approve &amp; Activate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. STUDENT PROFILE VIEWER MODAL (ADMIN ONLY)            */}
      {/* ──────────────────────────────────────────────────────── */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border max-w-xl w-full shadow-2xl overflow-hidden relative">
            <div className="bg-purple-700 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold">Detailed Student Profile</h3>
                <p className="text-purple-100 text-xs mt-1">ID: <b>{viewingStudent.studentId || "N/A"}</b></p>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-white/80 hover:text-white font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-4 border-b pb-4 mb-4">
                {viewingStudent.profileImage ? (
                  <img
                    src={viewingStudent.profileImage}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xl">
                    {viewingStudent.firstName?.[0]}{viewingStudent.lastName?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base">
                    {viewingStudent.firstName} {viewingStudent.lastName}
                  </h4>
                  <p className="text-xs text-gray-400">{viewingStudent.email}</p>
                </div>
              </div>

              {/* Data list grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Mobile:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.mobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">WhatsApp:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.whatsapp || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Other Mobile:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.otherMobile || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">NIC:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.nic || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Batch:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.batch || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">School:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.school || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Home City:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.homeCity || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Address:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.address || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Gender:</span>
                  <span className="font-semibold text-gray-800">{viewingStudent.gender || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Birthday:</span>
                  <span className="font-semibold text-gray-800 font-mono">{viewingStudent.birthday || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZOOMED SLIP IMAGE VIEW MODAL ── */}
      {zoomedSlip && (
        <div
          onClick={() => setZoomedSlip(null)}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomedSlip}
              alt="Zoomed Slip"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border"
            />
            <button
              onClick={() => setZoomedSlip(null)}
              className="absolute top-4 right-4 bg-black/60 text-white font-extrabold text-lg w-10 h-10 rounded-full flex items-center justify-center shadow backdrop-blur-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

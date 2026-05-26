import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { auth } from "../config/firebase";
import { signOut } from "firebase/auth";
import {
  getStudentProfile,
  saveStudentProfile,
  getClasses,
  submitPayment,
  getStudentPayments,
  confirmTuteDelivery
} from "../db/firestoreService";
import ImageCropModal from "./ImageCropModal";

export default function StudentDashboard({ onNavigate, initialStudentData, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabFromPath = () => {
    const path = location.pathname;
    if (path.endsWith("/profile")) return "profile";
    if (path.endsWith("/student-id")) return "studentId";
    if (path.endsWith("/ongoing")) return "ongoingClass";
    if (path.endsWith("/purchase")) return "purchaseClass";
    if (path.endsWith("/bank")) return "bankDetails";
    if (path.endsWith("/payments")) return "payments";
    if (path.endsWith("/live")) return "liveClasses";
    if (path.endsWith("/tute-tracking")) return "tuteTracking";
    return "dashboard"; // default
  };

  const activeTab = tabFromPath();
  const [student, setStudent] = useState(initialStudentData || null);
  const [profileForm, setProfileForm] = useState(null);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBatchTab, setSelectedBatchTab] = useState("2026AL"); // "2026AL", "2027AL", "2028AL", "2026Rapid"
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // For Buy Dialog
  const [buyingClass, setBuyingClass] = useState(null);
  const [slipImage, setSlipImage] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [modalError, setModalError] = useState("");
  
  // Tute delivery modal form inputs
  const [tuteRequired, setTuteRequired] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");

  // Secure YouTube Media Player state
  const [activeCourseMedia, setActiveCourseMedia] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const iframeRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Mobile sidebar & user dropdown state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Image crop modal state
  const [cropSrc, setCropSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Disable right-click site-wide
  useEffect(() => {
    const noContext = (e) => e.preventDefault();
    document.addEventListener("contextmenu", noContext);
    return () => document.removeEventListener("contextmenu", noContext);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // listen to YouTube postMessages
  useEffect(() => {
    const handleYTMessage = (event) => {
      if (!event.origin.includes("youtube.com") && !event.origin.includes("youtube-nocookie.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "onStateChange") {
          if (data.info && data.info.playerState !== undefined) {
            setIsPlaying(data.info.playerState === 1);
          }
        }
        if (data.event === "infoDelivery" && data.info) {
          if (data.info.currentTime !== undefined) {
            setCurrentTime(data.info.currentTime);
          }
          if (data.info.duration !== undefined) {
            setDuration(data.info.duration);
          }
        }
      } catch (e) {}
    };
    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, []);

  // Poll for time when playing
  useEffect(() => {
    let timer;
    if (isPlaying && iframeRef.current) {
      timer = setInterval(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "listening" }),
            "*"
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }),
            "*"
          );
        }
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Reset playback info when course media changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [activeCourseMedia]);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Toggle play/pause by posting command to YouTube IFrame API
  const togglePlayPause = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const cmd = isPlaying ? "pauseVideo" : "playVideo";
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: cmd, args: [] }),
        "*"
      );
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullScreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [newTime, true] }),
        "*"
      );
    }
  };
  // Nested class details page state
  const [selectedClassDetails, setSelectedClassDetails] = useState(null);

  // Profile save status
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Load student profile on mount if not provided
  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (user && !student) {
        try {
          const data = await getStudentProfile(user.uid);
          if (data) {
            setStudent(data);
            setProfileForm(data);
          }
        } catch (error) {
          console.error("Error fetching student profile:", error);
        }
      }
    };
    fetchProfile();
  }, [student]);

  // Sync profile form when student loads
  useEffect(() => {
    if (student) {
      setProfileForm(student);
    }
  }, [student]);

  // Load Catalog Classes
  const loadClassesCatalog = async () => {
    setLoadingClasses(true);
    try {
      const allCls = await getClasses();
      setClasses(allCls);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Load Payments
  const loadPaymentsLog = async () => {
    setLoadingPayments(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const payLog = await getStudentPayments(user.uid);
        setPayments(payLog);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Set delivery defaults when buy class modal opens
  useEffect(() => {
    if (buyingClass && student) {
      setDeliveryAddress(student.address || "");
      setDeliveryPhone(student.mobile || "");
      setTuteRequired(true);
    }
  }, [buyingClass, student]);

  useEffect(() => {
    loadClassesCatalog();
    loadPaymentsLog();
  }, []);

  // Sync data loading with path change
  useEffect(() => {
    const currentTab = tabFromPath();
    if (currentTab === "purchaseClass") loadClassesCatalog();
    if (currentTab === "payments" || currentTab === "ongoingClass" || currentTab === "tuteTracking") loadPaymentsLog();
  }, [location.pathname]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    let route = "/dashboard/home";
    if (tab === "profile") route = "/dashboard/profile";
    else if (tab === "studentId") route = "/dashboard/student-id";
    else if (tab === "ongoingClass") route = "/dashboard/ongoing";
    else if (tab === "purchaseClass") route = "/dashboard/purchase";
    else if (tab === "bankDetails") route = "/dashboard/bank";
    else if (tab === "payments") route = "/dashboard/payments";
    else if (tab === "liveClasses") route = "/dashboard/live";
    else if (tab === "tuteTracking") route = "/dashboard/tute-tracking";
    navigate(route);
  };

  // Profile Form Change
  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  // Profile Form Submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const user = auth.currentUser;
      if (user) {
        await saveStudentProfile(user.uid, profileForm);
        setStudent(profileForm);
        setProfileMsg("Profile එක සාර්ථකව යාවත්කාලීන කරන ලදී!");
      }
    } catch (err) {
      setProfileMsg("Error: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Image Upload and convert to Base64
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Image Upload for Student Profile Photo — opens crop modal
  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropSrc(reader.result);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Called when user confirms crop
  const handleCropDone = async (croppedBase64) => {
    setShowCropModal(false);
    setCropSrc(null);
    if (!croppedBase64 || !student) return;
    try {
      const user = auth.currentUser;
      if (user) {
        const updated = { ...student, profileImage: croppedBase64 };
        await saveStudentProfile(user.uid, updated);
        setStudent(updated);
        setProfileForm(updated);
        setProfileMsg("ඡායාරූපය සාර්ථකව යාවත්කාලීන කරන ලදී!");
      }
    } catch (err) {
      console.error("Error saving profile photo:", err);
      setProfileMsg("Error: " + err.message);
    }
  };

  // Submit Payment Slip
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    if (!slipImage) {
      setModalError("කරුණාකර රිසිට්පතේ ඡායාරූපය (Slip Image) ඇතුළත් කරන්න.");
      return;
    }
    if (tuteRequired && (!deliveryAddress || !deliveryPhone)) {
      setModalError("කරුණාකර නිබන්ධන එවිය යුතු ලිපිනය සහ දුරකථන අංකය ඇතුළත් කරන්න.");
      return;
    }
    setSubmittingPayment(true);
    try {
      const user = auth.currentUser;
      if (user && student) {
        const paymentPayload = {
          studentUid: user.uid,
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId || "N/A",
          classId: buyingClass.id,
          classTitle: buyingClass.title,
          price: buyingClass.price,
          month: buyingClass.month || "N/A",
          slipImage: slipImage,
          tuteRequired: tuteRequired,
          deliveryAddress: tuteRequired ? deliveryAddress : "",
          deliveryPhone: tuteRequired ? deliveryPhone : "",
          deliveryStatus: tuteRequired ? "Pending" : "None",
          homeCity: student.homeCity || "N/A"
        };
        await submitPayment(paymentPayload);
        setPaymentSuccess(true);
        loadPaymentsLog();
        setTimeout(() => {
          setPaymentSuccess(false);
          setBuyingClass(null);
          setSlipImage("");
          setModalError("");
          handleTabChange("payments");
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setModalError("පද්ධති දෝෂයකි: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Generate and download/print receipt invoice
  const handleDownloadInvoice = (pay) => {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      alert("පොප්-අප් බ්ලොක් කර ඇත! කරුණාකර පොප්-අප් සඳහා අවසර දෙන්න.");
      return;
    }

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${pay.classTitle}</title>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans+Sinhala:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', 'Noto Sans Sinhala', sans-serif;
            background-color: #ffffff;
            color: #1a202c;
            padding: 40px;
            margin: 0;
          }
          .invoice-container {
            max-width: 700px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #edf2f7;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo {
            width: 36px;
            height: 36px;
            background-color: #e53e3e;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 900;
            font-size: 20px;
          }
          .company-name {
            font-size: 24px;
            font-weight: 800;
            color: #1a202c;
            letter-spacing: -0.5px;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-title h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            color: #e53e3e;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .invoice-title p {
            margin: 5px 0 0 0;
            font-size: 11px;
            color: #a0aec0;
            font-weight: 600;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
          }
          .info-block h3 {
            margin: 0 0 10px 0;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #a0aec0;
            font-weight: 800;
          }
          .info-block p {
            margin: 4px 0;
            font-size: 13px;
            font-weight: 600;
            color: #4a5568;
          }
          .info-block .highlight {
            font-size: 15px;
            font-weight: 800;
            color: #1a202c;
          }
          .table-container {
            margin-bottom: 40px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background-color: #f7fafc;
            color: #718096;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #edf2f7;
          }
          td {
            padding: 16px;
            font-size: 13px;
            color: #2d3748;
            border-bottom: 1px solid #edf2f7;
          }
          .amount-col {
            text-align: right;
            font-weight: 700;
          }
          .total-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .total-box {
            width: 250px;
            background-color: #f7fafc;
            border-radius: 12px;
            padding: 20px;
            box-sizing: border-box;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
            color: #718096;
            font-weight: 600;
          }
          .total-row.grand {
            font-size: 16px;
            color: #1a202c;
            font-weight: 800;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 60px;
            border-top: 1px dashed #e2e8f0;
            padding-top: 30px;
            text-align: center;
          }
          .barcode-mock {
            height: 35px;
            background: linear-gradient(90deg, #000 2px, transparent 2px, #000 5px, transparent 7px, #000 8px, transparent 8px, #000 12px, transparent 15px);
            background-size: 25px 100%;
            margin: 0 auto 10px auto;
            width: 200px;
            opacity: 0.8;
          }
          .footer-text {
            font-size: 10px;
            color: #a0aec0;
            font-weight: 600;
          }
          .print-btn {
            display: block;
            width: 100%;
            max-width: 200px;
            margin: 30px auto 0 auto;
            padding: 10px 20px;
            background-color: #e53e3e;
            color: white;
            font-weight: 700;
            font-size: 13px;
            text-align: center;
            border-radius: 8px;
            cursor: pointer;
            border: none;
            box-shadow: 0 4px 6px rgba(229, 62, 62, 0.2);
          }
          @media print {
            .print-btn {
              display: none;
            }
            body {
              padding: 0;
            }
            .invoice-container {
              border: none;
              box-shadow: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="logo-container">
              <div class="logo">C</div>
              <div class="company-name">Echem.lk</div>
            </div>
            <div class="invoice-title">
              <h1>Invoice</h1>
              <p>ID: ${pay.id.substring(0, 10).toUpperCase()}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-block">
              <h3>Billed To (සිසුවාගේ තොරතුරු)</h3>
              <p class="highlight">${pay.studentName}</p>
              <p>Student ID: ${pay.studentId}</p>
              <p>Student UID: ${pay.studentUid.substring(0, 8).toUpperCase()}</p>
            </div>
            <div class="info-block" style="text-align: right;">
              <h3>Billing Information</h3>
              <p>Invoice Date: ${pay.submittedAt ? new Date(pay.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
              <p>Payment Method: Bank Transfer / Slip</p>
              <p>Status: <span style="color: #38a169; font-weight: 800;">PAID &amp; APPROVED</span></p>
            </div>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Description (විස්තරය)</th>
                  <th style="text-align: right;">Month</th>
                  <th style="text-align: right;">Amount (LKR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 700;">
                    ${pay.classTitle}<br>
                    <span style="font-size: 10px; font-weight: 600; color: #a0aec0; display: inline-block; margin-top: 4px;">
                      LMS Monthly Class Access Fee
                    </span>
                  </td>
                  <td style="text-align: right; font-weight: 600; color: #4a5568;">${pay.month}</td>
                  <td class="amount-col">LKR ${pay.price}.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-box">
              <div class="total-row">
                <span>Subtotal</span>
                <span>LKR ${pay.price}.00</span>
              </div>
              <div class="total-row">
                <span>Tax / Service Fee</span>
                <span>LKR 0.00</span>
              </div>
              <div class="total-row grand">
                <span>Grand Total</span>
                <span>LKR ${pay.price}.00</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="barcode-mock"></div>
            <p class="footer-text">Thank you for learning with Sujith Chemistry Education at CM.ECHEM.LK!</p>
            <p class="footer-text" style="margin-top: 5px;">This is a system generated digital invoice. No signature is required.</p>
          </div>
        </div>

        <button class="print-btn" onclick="window.print()">Print / Save PDF</button>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  // Confirm delivery receipt
  const handleConfirmDelivery = async (paymentId) => {
    if (window.confirm("ඔබට මෙම නිබන්ධන කට්ටලය ලැබුණු බව තහවුරු කිරීමට අවශ්‍යද?")) {
      try {
        await confirmTuteDelivery(paymentId);
        alert("ලැබුණු බව සාර්ථකව තහවුරු කරන ලදී! ස්තූතියි.");
        loadPaymentsLog();
      } catch (err) {
        alert("තහවුරු කිරීම අසාර්ථකයි: " + err.message);
      }
    }
  };

  // Filter approved classes for "Ongoing Class" tab
  const approvedClassIds = payments
    .filter((p) => p.status === "approved")
    .map((p) => p.classId);

  const myOngoingClasses = classes.filter((c) => approvedClassIds.includes(c.id));

  // Get Initials for Avatar
  const getInitials = () => {
    if (!student) return "E";
    return `${student.firstName?.[0] || ""}${student.lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-800 relative">

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200
          flex flex-col justify-between z-50 transition-transform duration-300 ease-in-out
          lg:static lg:w-64 lg:translate-x-0 lg:flex lg:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-black text-lg">S</span>
              </div>
              <span className="text-gray-900 font-extrabold text-xl tracking-tight">SKCHEM.COM</span>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items — scrollable on mobile */}
          <nav className="p-4 space-y-6 overflow-y-auto flex-1">
            {/* Student Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Student</p>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => handleTabChange("dashboard")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "dashboard"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange("profile")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "profile"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    My Profile
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange("studentId")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "studentId"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a3 3 0 100-6 3 3 0 000 6zm5-3h3m-3 4h3" /></svg>
                    My Student ID
                  </button>
                </li>
              </ul>
            </div>

            {/* Classes Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Classes</p>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => handleTabChange("liveClasses")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "liveClasses"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Live Classes
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange("ongoingClass")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "ongoingClass"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Ongoing Class
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange("tuteTracking")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "tuteTracking"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Tute Tracking
                  </button>
                </li>
              </ul>
            </div>

            {/* Purchase Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Purchase</p>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => handleTabChange("bankDetails")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "bankDetails"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    Bank Details
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange("purchaseClass")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "purchaseClass"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    Purchase Class
                  </button>
                </li>
              </ul>
            </div>

            {/* Payments Section */}
            <div>
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Payments</p>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => handleTabChange("payments")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === "payments"
                        ? "bg-red-50 text-red-600 shadow-sm"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    My Payments
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        {/* User Profile Info Footer in Sidebar */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            {student?.profileImage ? (
              <img src={student.profileImage} alt="Avatar" className="w-10 h-10 rounded-full object-cover border" />
            ) : (
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                {getInitials()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{student ? `${student.firstName} ${student.lastName}` : "Student Profile"}</p>
              <p className="text-xs text-gray-400 truncate">{student?.studentId ? `ID: ${student.studentId}` : "Unverified"}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:overflow-y-auto">
        {/* ── Top Header ── */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger - mobile only */}
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              aria-label="Toggle Sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="hidden sm:block text-sm text-gray-400 font-medium">
              {new Date().toLocaleDateString('si-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Icon */}
            <div className="relative cursor-pointer text-gray-500 hover:text-gray-800">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            </div>

            {/* User Dropdown */}
            <div className="relative border-l border-gray-200 pl-3" ref={userMenuRef}>
              <button
                id="user-menu-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {student?.profileImage ? (
                  <img src={student.profileImage} alt="avatar" className="w-8 h-8 rounded-lg object-cover border-2 border-red-200" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-extrabold text-xs">
                    {getInitials()}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[120px] truncate">
                  {student?.firstName || "Student"}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Panel */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
                  {/* User info header */}
                  <div className="px-5 py-4 bg-gradient-to-br from-red-50 to-rose-100 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {student?.profileImage ? (
                        <img src={student.profileImage} alt="avatar" className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white font-extrabold text-sm shadow">
                          {getInitials()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 text-sm truncate">
                          {student ? `${student.firstName} ${student.lastName}` : "Student"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{student?.email || ""}</p>
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          ID: {student?.studentId || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Menu items */}
                  <div className="p-2">
                    <button
                      id="dropdown-profile-btn"
                      onClick={() => { setUserMenuOpen(false); handleTabChange("profile"); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </button>
                    <button
                      id="dropdown-studentid-btn"
                      onClick={() => { setUserMenuOpen(false); handleTabChange("studentId"); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a3 3 0 100-6 3 3 0 000 6zm5-3h3m-3 4h3" />
                      </svg>
                      Student ID Card
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      id="dropdown-logout-btn"
                      onClick={() => { setUserMenuOpen(false); onLogout && onLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Sub-view Container ── */}
        <main className="p-4 md:p-8 flex-1">
          {/* ──────────────────────────────────────────────────────── */}
          {/* 1. DASHBOARD VIEW                                        */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Welcome banner */}
              <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 space-y-2">
                  <h2 className="text-3xl font-extrabold">Good Morning, {student?.firstName || "Theekshana"}! 🎉</h2>
                  <p className="text-red-100 max-w-xl text-sm leading-relaxed">
                    SKCHEM.COM වෙත සාදරයෙන් පිළිගනිමු! අද දවසේ ඔබගේ රසායන විද්‍යා පන්ති හා අධ්‍යයන කටයුතු පහතින් කළමනාකරණය කරගන්න. Let's start learning!
                  </p>
                </div>
                {/* Visual decorative graphic */}
                <div className="absolute right-0 bottom-0 opacity-15 pointer-events-none transform translate-y-6 translate-x-6">
                  <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                  </svg>
                </div>
              </div>

              {/* Grid Quick Navigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. My Classes */}
                <div
                  onClick={() => handleTabChange("ongoingClass")}
                  className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-gray-900 text-lg">MY CLASSES</h3>
                      <p className="text-gray-400 text-xs">ඔබ දැනට මිලදී ගෙන අනුමත පන්ති සියල්ල මෙතැනින් බලන්න.</p>
                    </div>
                  </div>
                  <span className="text-red-600 font-bold text-sm inline-flex items-center gap-1 mt-4">
                    Go to Classes →
                  </span>
                </div>

                {/* 2. Purchase Classes */}
                <div
                  onClick={() => handleTabChange("purchaseClass")}
                  className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 shadow-inner">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-gray-900 text-lg">PURCHASE CLASSES</h3>
                      <p className="text-gray-400 text-xs">නව මාසික රසායන විද්‍යා පන්ති සඳහා මෙතැනින් ලියාපදිංචි වී ගෙවීම් කරන්න.</p>
                    </div>
                  </div>
                  <span className="text-red-600 font-bold text-sm inline-flex items-center gap-1 mt-4">
                    View Catalog →
                  </span>
                </div>

                {/* 3. Telegram Support */}
                <a
                  href="https://t.me/sujithchemistry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-inner">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-gray-900 text-lg">TELEGRAM SUPPORT</h3>
                      <p className="text-gray-400 text-xs">තාක්ෂණික ගැටළු සහ පන්ති සම්බන්ධීකරණය සඳහා Telegram සමූහයට එකතු වන්න.</p>
                    </div>
                  </div>
                  <span className="text-blue-600 font-bold text-sm inline-flex items-center gap-1 mt-4">
                    Join Telegram Group →
                  </span>
                </a>
              </div>

              {/* Exam Reports / Performance Section */}
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Exam Reports</h3>
                <p className="text-gray-400 text-xs mb-6">පන්ති වාර විභාග ලකුණු ප්‍රගති සටහන (Mock Results Trend)</p>

                {/* Aesthetic Graphic Line Chart SVG */}
                <div className="h-64 bg-gray-50 rounded-xl p-4 flex flex-col justify-between border relative overflow-hidden">
                  <div className="flex-1 flex items-end gap-10 px-8 relative z-10 h-full">
                    {/* Simulated bars */}
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">45%</span>
                      <div className="w-full bg-blue-400 rounded-t-lg shadow-sm" style={{ height: "45%" }} />
                      <span className="text-xs font-bold text-gray-400">Exam 01</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">62%</span>
                      <div className="w-full bg-blue-500 rounded-t-lg shadow-sm" style={{ height: "62%" }} />
                      <span className="text-xs font-bold text-gray-400">Exam 02</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">55%</span>
                      <div className="w-full bg-teal-400 rounded-t-lg shadow-sm" style={{ height: "55%" }} />
                      <span className="text-xs font-bold text-gray-400">Exam 03</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">78%</span>
                      <div className="w-full bg-red-500 rounded-t-lg shadow-sm" style={{ height: "78%" }} />
                      <span className="text-xs font-bold text-gray-400">Exam 04</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">90%</span>
                      <div className="w-full bg-red-600 rounded-t-lg shadow-sm animate-pulse" style={{ height: "90%" }} />
                      <span className="text-xs font-bold text-gray-400">Current</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 2. ONGOING APPROVED CLASSES VIEW                         */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "ongoingClass" && (
            <div className="space-y-6">
              {/* ── NESTED CLASS DETAILS PAGE ── */}
              {selectedClassDetails ? (
                <div className="space-y-6">
                  {/* Back button & Header */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedClassDetails(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors border"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                      Back to My Classes
                    </button>
                    <div className="h-4 w-px bg-gray-200" />
                    <div>
                      <span className="text-xs text-gray-400">Viewing:</span>
                      <span className="ml-1 text-sm font-extrabold text-gray-800">{selectedClassDetails.title}</span>
                    </div>
                  </div>

                  {/* Class Header Banner */}
                  <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-extrabold rounded-full uppercase tracking-wider inline-block">ACTIVE</span>
                      <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mt-1">{selectedClassDetails.month} Class</p>
                      <h2 className="text-xl font-black">{selectedClassDetails.title}</h2>
                      <p className="text-gray-400 text-xs">Batch: {selectedClassDetails.batch} · Chemistry</p>
                    </div>
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                  </div>

                  {/* Content Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                     {/* 1. RECORDED VIDEO LECTURES */}
                     <div className="space-y-4">
                       <div className="flex items-center gap-2 mb-1">
                         <div className="w-5 h-5 bg-red-100 rounded flex items-center justify-center">
                           <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                         </div>
                         <h3 className="font-extrabold text-gray-900 text-sm">Recorded Video Lectures</h3>
                       </div>

                       {(() => {
                         const classVideos = selectedClassDetails.videos || [];
                         if (classVideos.length > 0) {
                           return (
                             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                               {classVideos.map((vid, vIdx) => (
                                 <div
                                   key={vIdx}
                                   onClick={() => {
                                     setActiveCourseMedia({
                                       ...selectedClassDetails,
                                       youtubeLink: vid.youtubeLink,
                                       youtubeCaption: vid.caption || ""
                                     });
                                     setIsPlaying(false);
                                   }}
                                   className="bg-white border-2 border-gray-200 hover:border-red-400 hover:shadow-md rounded-2xl p-4 cursor-pointer transition-all flex items-center gap-4"
                                 >
                                   <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-red-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                     <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                   </div>
                                   <div className="min-w-0 flex-1">
                                     <h4 className="font-bold text-gray-900 text-xs truncate">{vid.caption || `Lecture Video ${vIdx + 1}`}</h4>
                                     <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Click to watch video</p>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           );
                         } else if (selectedClassDetails.youtubeLink) {
                           // Fallback to single youtubeLink
                           return (
                             <div
                               onClick={() => {
                                 setActiveCourseMedia(selectedClassDetails);
                                 setIsPlaying(false);
                               }}
                               className="bg-white border-2 border-gray-200 hover:border-red-400 hover:shadow-md rounded-2xl p-4 cursor-pointer transition-all flex items-center gap-4"
                             >
                               <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-red-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                 <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                               </div>
                               <div className="min-w-0 flex-1">
                                 <h4 className="font-bold text-gray-900 text-xs truncate">{selectedClassDetails.youtubeCaption || "Recorded Video Lesson"}</h4>
                                 <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Click to watch video</p>
                               </div>
                             </div>
                           );
                         } else {
                           return (
                             <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-gray-400 text-xs font-semibold">
                               📹 Video lecture not yet uploaded by admin.
                             </div>
                           );
                         }
                       })()}
                     </div>

                    {/* 2. LIVE ZOOM CLASS CARD */}
                    <div className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all ${
                      selectedClassDetails.zoomLink
                        ? "border-blue-200 hover:border-blue-400 hover:shadow-lg"
                        : "border-gray-100 opacity-70"
                    }`}>
                      {/* Card Thumbnail */}
                      <div className="h-36 bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(96,165,250,0.3)_0%,transparent_70%)]" />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                          {selectedClassDetails.zoomLink ? (
                            <span className="text-white text-xs font-bold uppercase tracking-wider animate-pulse">🔴 Live Now</span>
                          ) : (
                            <span className="text-blue-200 text-xs font-bold uppercase tracking-wider">Zoom Class</span>
                          )}
                        </div>
                      </div>
                      {/* Card Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </div>
                          <h3 className="font-extrabold text-gray-900 text-sm">Live Zoom Class</h3>
                          {selectedClassDetails.zoomLink && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-extrabold rounded uppercase animate-pulse">LIVE</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed flex-1">
                          {selectedClassDetails.zoomCaption || (selectedClassDetails.zoomLink ? "Live class is now active. Join now!" : "Live class is not currently streaming. Check back later.")}
                        </p>
                        {selectedClassDetails.zoomLink ? (
                          <a
                            href={selectedClassDetails.zoomLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Join Live Zoom Class
                          </a>
                        ) : (
                          <div className="mt-4 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 text-xs font-bold py-2.5 rounded-xl">
                            Not Streaming Yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── CLASS LIST VIEW ── */
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-extrabold text-gray-900">Available My Classes for Chemistry</h2>
                    <p className="text-gray-400 text-sm">ඔබ හට අධ්‍යයනය කළ හැකි පන්ති පහතින් දැක්වේ (Approved by Admin).</p>
                  </div>

                  {loadingPayments ? (
                    <div className="flex justify-center p-12">
                      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : myOngoingClasses.length === 0 ? (
                    <div className="bg-white border rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <h3 className="font-extrabold text-gray-800 text-xl">සක්‍රීය පන්ති කිසිවක් නැත!</h3>
                      <p className="text-gray-400 text-sm">
                        ඔබ තවමත් කිසිදු පන්තියක් මිලදී ගෙන නොමැත, නැතහොත් ඔබ මිලදී ගත් පන්තිය පරිපාලක (Admin) විසින් අනුමත කිරීමට බලාපොරොත්තුවෙන් පවතී.
                      </p>
                      <button
                        onClick={() => handleTabChange("purchaseClass")}
                        className="inline-flex bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow transition-colors"
                      >
                        Purchase Class පිටුවට යන්න
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {myOngoingClasses.map((cls) => (
                        <div key={cls.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer" onClick={() => setSelectedClassDetails(cls)}>
                          <div>
                            {/* Class Cover Image Placeholder */}
                            <div className="h-44 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-6 text-center text-white relative">
                              <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                ACTIVE
                              </div>
                              {cls.zoomLink && (
                                <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                                  🔴 LIVE
                                </div>
                              )}
                              <div>
                                <p className="text-sm uppercase font-bold text-yellow-400 tracking-widest">{cls.month} Class</p>
                                <h4 className="font-black text-lg mt-1">{cls.title}</h4>
                              </div>
                            </div>

                            <div className="p-5 space-y-2">
                              <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>Batch: {cls.batch}</span>
                                <span>Type: Chemistry</span>
                              </div>
                              {/* Content status indicators */}
                              <div className="flex gap-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  cls.youtubeLink ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-400"
                                }`}>
                                  {cls.youtubeLink ? "📹 Video" : "No Video"}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  cls.zoomLink ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
                                }`}>
                                  {cls.zoomLink ? "🔴 Live" : "No Live"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="px-5 pb-5">
                            <div className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              View Class
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 3. PURCHASE CLASS CATALOG VIEW                           */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "purchaseClass" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-extrabold text-gray-900">All Chemistry Classes | SKCHEM.COM</h2>
                <p className="text-gray-400 text-sm">පහත දක්වා ඇති ඕනෑම පන්තියක් සඳහා ගෙවීම් රිසිට්පත් මෙතැනින් ඉදිරිපත් කරන්න.</p>
              </div>

              {/* Alert Message Box */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-xs leading-relaxed flex items-start gap-2.5">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>
                  කිසියම් පන්තියක් සඳහා Online ආකාරයෙන් සම්බන්ධ වන ශිෂ්‍යන් පමණක් වෙබ් අඩවිය මඟින් මුදල් ගෙවීම් සිදුකරන්න. සියලුම පන්ති සඳහා භෞතිකව සම්බන්ධ වන්නේ නම් අදාළ භෞතික ආයතනයෙන් පන්ති ගාස්තු ගෙවා කාඩ් පත ලබා ගන්න.
                </p>
              </div>

              {/* AL Batch Filter Tabs */}
              <div className="bg-amber-400 rounded-xl p-1 flex overflow-x-auto shadow-sm">
                {["2026AL", "2027AL", "2028AL", "2026Rapid"].map((batch) => (
                  <button
                    key={batch}
                    onClick={() => setSelectedBatchTab(batch)}
                    className={`flex-1 min-w-[100px] text-center font-bold text-sm py-2.5 px-4 rounded-lg transition-all ${
                      selectedBatchTab === batch
                        ? "bg-black text-white shadow"
                        : "text-gray-900 hover:bg-amber-300"
                    }`}
                  >
                    {batch === "2026Rapid" ? "2026 Rapid" : `${batch.substring(0, 4)} A/L`}
                  </button>
                ))}
              </div>

              {/* Catalog Grid */}
              {loadingClasses ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : classes.filter((c) => c.batch === selectedBatchTab).length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  මෙම කාණ්ඩයට (Batch) අදාළ පන්ති කිසිවක් දැනට ඇතුළත් කර නොමැත. (Admin updates only)
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {classes
                    .filter((c) => c.batch === selectedBatchTab)
                    .map((cls) => {
                      // Check if already purchased
                      const paymentObj = payments.find((p) => p.classId === cls.id);
                      const isPending = paymentObj?.status === "pending";
                      const isApproved = paymentObj?.status === "approved";

                      return (
                        <div key={cls.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                          <div>
                            {/* Visual Class Header cover */}
                            <div className="h-44 bg-gradient-to-tr from-gray-950 to-gray-800 flex flex-col justify-between p-5 text-white">
                              <div className="flex justify-between items-center">
                                <span className="bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                  CHEMISTRY
                                </span>
                                <span className="text-yellow-400 font-extrabold text-sm">LKR {cls.price}</span>
                              </div>
                              <div>
                                <p className="text-xs uppercase text-gray-400 font-medium">Batch: {cls.batch} · {cls.month || "June"}</p>
                                <h4 className="font-extrabold text-lg mt-0.5">{cls.title}</h4>
                              </div>
                            </div>

                            <div className="p-5">
                              <p className="text-xs text-gray-400 leading-relaxed">
                                {cls.description || "මෙම පාඨමාලාවට අදාළව සියලුම දේශන වීඩියෝ දර්ශන, නිබන්ධන සහ විභාග ප්‍රශ්න පත්‍ර මෙම LMS එක හරහා ඔබට ලබාදේ."}
                              </p>
                            </div>
                          </div>

                          <div className="p-5 pt-0">
                            {isApproved ? (
                              <button
                                disabled
                                className="w-full bg-green-100 text-green-700 font-bold text-xs py-2.5 rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                APPROVED &amp; UNLOCKED
                              </button>
                            ) : isPending ? (
                              <button
                                disabled
                                className="w-full bg-amber-100 text-amber-700 font-bold text-xs py-2.5 rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
                              >
                                <div className="w-3.5 h-3.5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                                PENDING APPROVAL
                              </button>
                            ) : (
                              <button
                                onClick={() => setBuyingClass(cls)}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black text-sm py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                Buy Course / Pay Slip
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 4. BANK DETAILS VIEW                                     */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "bankDetails" && (
            <div className="space-y-6 max-w-2xl mx-auto bg-white border border-gray-200 p-8 rounded-2xl shadow-sm">
              <div className="border-b pb-4">
                <h2 className="text-2xl font-extrabold text-gray-900">Bank Accounts for Money Transfers</h2>
                <p className="text-gray-400 text-sm mt-1">පහත දක්වා ඇති බැංකු ගිණුම්වලට පන්ති ගාස්තු තැන්පත් කර රිසිට්පත මෙහි upload කරන්න.</p>
              </div>

              <div className="space-y-6">
                {/* Bank account card 1 */}
                <div className="border-l-4 border-red-600 bg-red-50/50 p-5 rounded-r-xl space-y-2">
                  <span className="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    Commercial Bank
                  </span>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-400">Account Name:</span>
                    <span className="font-semibold text-gray-800">Sujith Chemistry Education</span>
                    <span className="text-gray-400">Account Number:</span>
                    <span className="font-bold text-red-600 tracking-wider">8009234851</span>
                    <span className="text-gray-400">Branch:</span>
                    <span className="font-semibold text-gray-800">Gampaha</span>
                  </div>
                </div>

                {/* Bank account card 2 */}
                <div className="border-l-4 border-yellow-500 bg-yellow-50/50 p-5 rounded-r-xl space-y-2">
                  <span className="bg-yellow-500 text-gray-950 font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    People's Bank
                  </span>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <span className="text-gray-400">Account Name:</span>
                    <span className="font-semibold text-gray-800">S. D. S. Liyanage</span>
                    <span className="text-gray-400">Account Number:</span>
                    <span className="font-bold text-yellow-700 tracking-wider">0452395178593</span>
                    <span className="text-gray-400">Branch:</span>
                    <span className="font-semibold text-gray-800">Colombo Fort</span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-50 border rounded-xl p-5 text-xs text-gray-500 space-y-2">
                  <p className="font-bold text-gray-700">📌 ගෙවීම් කිරීමෙන් පසු අනුගමනය කළ යුතු පියවර:</p>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>බැංකු කවුන්ටරයෙන් ලැබුණු Slip එක හෝ Online Transfer එකක සාර්ථක Screenshot එකක් පැහැදිලිව ලබාගන්න.</li>
                    <li>පසුව අපගේ <b>"Purchase Class"</b> පිටුව වෙත ගොස් අදාළ මාසයේ පන්තිය යටතේ ඇති <b>"Buy Course"</b> බොත්තම ඔබන්න.</li>
                    <li>එහිදී ලැබෙන form එකට එම Slip Image එක ලබා දී Submit කරන්න.</li>
                    <li>පැය 24ක් ඇතුළත අපගේ පරිපාලක මණ්ඩලය (Admin Panel) මඟින් ගෙවීම පරීක්ෂා කර පන්තිය සක්‍රීය කර දෙනු ඇත!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 5. MY PAYMENTS LOG VIEW                                  */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-extrabold text-gray-900">My Payments history</h2>
                  <p className="text-gray-400 text-sm">ඔබ මෙතෙක් සිදු කරන ලද පන්ති ගෙවීම් පිළිබඳ විස්තර මෙතැනින් පිරික්සන්න.</p>
                </div>
                <button
                  onClick={loadPaymentsLog}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 px-3 rounded-lg border shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" /></svg>
                  Refresh
                </button>
              </div>

              {loadingPayments ? (
                <div className="flex justify-center p-12">
                  <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border p-8">
                  කිසිදු ගෙවීම් රිසිට්පතක් (Slip) මෙතෙක් ඉදිරිපත් කර නොමැත.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-700">
                      <thead className="bg-gray-50 border-b font-extrabold text-xs uppercase text-gray-400 tracking-wider">
                        <tr>
                          <th className="py-4 px-6">Class Title</th>
                          <th className="py-4 px-6">Amount</th>
                          <th className="py-4 px-6">Submitted Date</th>
                          <th className="py-4 px-6">Slip View</th>
                          <th className="py-4 px-6 text-center">Status</th>
                          <th className="py-4 px-6 text-center">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {payments.map((pay) => (
                          <tr key={pay.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold text-gray-900">{pay.classTitle}</td>
                            <td className="py-4 px-6 text-gray-900">LKR {pay.price}</td>
                            <td className="py-4 px-6 text-gray-500 text-xs">
                              {pay.submittedAt ? new Date(pay.submittedAt).toLocaleDateString() : "Date Unknown"}
                            </td>
                            <td className="py-4 px-6">
                              {pay.slipImage ? (
                                <a
                                  href={pay.slipImage}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-600 hover:text-red-700 underline font-semibold text-xs flex items-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                  View Slip
                                </a>
                              ) : (
                                <span className="text-gray-300">No Image</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {pay.status === "approved" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full">
                                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                                  APPROVED
                                </span>
                              ) : pay.status === "rejected" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full">
                                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                  REJECTED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              {pay.status === "approved" ? (
                                <button
                                  onClick={() => handleDownloadInvoice(pay)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors inline-flex items-center gap-1 shadow-sm"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  Invoice
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
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
          {/* 6. MY PROFILE EDIT VIEW                                  */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "profile" && profileForm && (
            <div className="space-y-6 max-w-3xl mx-auto bg-white border border-gray-200 p-8 rounded-2xl shadow-sm">
              {/* Profile Header: avatar + name + upload */}
              <div className="border-b pb-6 flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar container */}
                <div className="relative group flex-shrink-0">
                  <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-white shadow-xl ring-4 ring-red-500/20 transition-all duration-300 group-hover:ring-red-500/40 relative">
                    {student?.profileImage ? (
                      <img
                        src={student.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white text-4xl font-black">
                        {getInitials()}
                      </div>
                    )}
                    {/* Hover upload overlay (desktop) */}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-300 text-[10px] font-bold">
                      <svg className="w-5 h-5 mb-1 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      CHANGE PHOTO
                      <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                    </label>
                  </div>
                  
                  {/* Mobile camera badge */}
                  <label
                    className="absolute bottom-0 right-0 w-9 h-9 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors border-2 border-white md:hidden"
                    title="Change Profile Photo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    </svg>
                    <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                  </label>
                </div>

                {/* Name / ID / Guidelines info */}
                <div className="flex-1 text-center md:text-left space-y-2">
                  <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
                      {student ? `${student.firstName} ${student.lastName}` : "Student Profile"}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
                      {student?.studentId && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                          ID: {student.studentId}
                        </span>
                      )}
                      {student?.batch && (
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
                          {student.batch}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Photo guidelines card */}
                  <div className="bg-gray-50 border rounded-xl p-4 text-xs text-gray-600 text-left space-y-1.5 max-w-xl">
                    <p className="font-bold text-gray-800 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ප්‍රෝෆයිල් පින්තූරය ඇතුලත් කිරීමේ උපදෙස්:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                      <li>ඔබගේ මුහුණ පැහැදිලිව පෙනෙන ඡායාරූපයක් (Portrait) තෝරාගන්න.</li>
                      <li>ඡායාරූපය ඇතුලත් කිරීමේදී අවශ්‍ය පරිදි එය කපා සකස් කිරීමට (Crop) හැකිවේ.</li>
                      <li>මෙම ඡායාරූපය ඔබගේ <b>Virtual Student ID</b> පත සඳහා ස්වයංක්‍රීයව භාවිත කෙරේ.</li>
                    </ul>
                    <div className="pt-2">
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:border-red-500 hover:text-red-600 text-gray-700 text-xs font-bold rounded-lg cursor-pointer shadow-sm transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload Photo
                        <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {profileMsg}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={profileForm.firstName}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={profileForm.lastName}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      disabled
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                    <select
                      name="gender"
                      value={profileForm.gender}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Mobile */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile</label>
                    <input
                      type="text"
                      name="mobile"
                      value={profileForm.mobile}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      name="whatsapp"
                      value={profileForm.whatsapp}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Other Mobile */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Other Mobile</label>
                    <input
                      type="text"
                      name="otherMobile"
                      value={profileForm.otherMobile || ""}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* NIC */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">NIC Number</label>
                    <input
                      type="text"
                      name="nic"
                      value={profileForm.nic}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Batch */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">AL Batch</label>
                    <select
                      name="batch"
                      value={profileForm.batch}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    >
                      <option value="2026AL">2026 A/L</option>
                      <option value="2027AL">2027 A/L</option>
                      <option value="2028AL">2028 A/L</option>
                      <option value="2026Rapid">2026 Rapid</option>
                    </select>
                  </div>

                  {/* School */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">School</label>
                    <input
                      type="text"
                      name="school"
                      value={profileForm.school}
                      onChange={handleProfileChange}
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Home City */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Home City / Town</label>
                    <input
                      type="text"
                      name="homeCity"
                      value={profileForm.homeCity}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Home Address</label>
                    <input
                      type="text"
                      name="address"
                      value={profileForm.address}
                      onChange={handleProfileChange}
                      required
                      className="w-full px-4 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3 px-6 rounded-lg transition-colors text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    {savingProfile ? "Saving Profile..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 7. STUDENT VIRTUAL ID CARD VIEW                         */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "studentId" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Left Column: Verification Checklist */}
              <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Student Verification Center</h3>
                  <p className="text-gray-400 text-xs mt-1">Student ID එක සක්‍රීය වීමට පහත සඳහන් සියලුම තොරතුරු අනිවාර්ය වේ.</p>
                </div>

                <div className="space-y-4">
                  {/* Item 1: Mobile */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Mobile Number</p>
                        <p className="text-sm font-semibold text-gray-800">{student?.mobile || "N/A"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Verified</span>
                  </div>

                  {/* Item 2: Email */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Email Address</p>
                        <p className="text-sm font-semibold text-gray-800 truncate max-w-[180px]">{student?.email || "N/A"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Verified</span>
                  </div>

                  {/* Item 3: Profile Photo */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Profile Photo</p>
                        <p className="text-sm font-semibold text-gray-800">Uploaded</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Uploaded</span>
                  </div>

                  {/* Item 4: NIC */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">NIC: {student?.nic || "N/A"}</p>
                        <p className="text-sm font-semibold text-gray-800">National ID Card Details</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">APPROVED</span>
                  </div>

                  {/* Item 5: Address (replacing Location) */}
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Address: {student?.address || "N/A"}</p>
                        <p className="text-sm font-semibold text-gray-800">{student?.homeCity || "N/A"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Verified</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Virtual ID Card */}
              <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-md flex items-center justify-center">
                <div className="w-80 bg-gradient-to-b from-gray-50 to-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden text-center flex flex-col items-center p-6 relative">
                  {/* Top color accent */}
                  <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-red-600 to-yellow-500" />

                  {/* Header Title */}
                  <div className="flex items-center gap-1.5 mb-4">
                    <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center shadow-sm">
                      <span className="text-white font-black text-xs">S</span>
                    </div>
                    <span className="text-gray-900 font-extrabold text-sm tracking-tight">SKCHEM.COM</span>
                  </div>

                  {/* Profile Picture */}
                  <div className="relative mb-3">
                    {student?.profileImage ? (
                      <img src={student.profileImage} alt="ID" className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-md mx-auto" />
                    ) : (
                      <div className="w-28 h-28 bg-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold shadow-md mx-auto">
                        {getInitials()}
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 w-4.5 h-4.5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center text-white text-[9px] font-bold">✓</span>
                  </div>

                  {/* Name and Details */}
                  <h4 className="font-extrabold text-lg text-gray-800 truncate w-full px-2">{student ? `${student.firstName} ${student.lastName}` : "Theekshana Viduranga"}</h4>
                  <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-gray-100 rounded px-2.5 py-0.5 uppercase mt-1">
                    {student?.batch || "2026AL"} STUDENT
                  </span>

                  {/* Student ID Code */}
                  <div className="my-4 py-2 px-6 bg-red-50 border border-red-100 rounded-xl w-full">
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 font-medium">Student ID Number</p>
                    <p className="text-2xl font-black text-red-600 tracking-widest font-mono mt-0.5">
                      {student?.studentId || "25891789"}
                    </p>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center space-y-2 mt-4">
                    <div className="p-4 bg-white border-2 border-red-500/30 rounded-2xl shadow-lg">
                      <QRCodeSVG
                        value={`SKCHEM.COM\nID: ${student?.studentId || "N/A"}\nName: ${student ? `${student.firstName} ${student.lastName}` : "N/A"}\nBatch: ${student?.batch || "N/A"}`}
                        size={220}
                        level={"H"}
                        includeMargin={true}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-extrabold tracking-widest font-mono uppercase">
                      Scan ID to Verify
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 8. LIVE CLASSES TAB VIEW                                 */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "liveClasses" && (
            <div className="max-w-xl mx-auto bg-white border border-gray-200 p-8 rounded-2xl shadow-sm text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 animate-pulse">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Live Chemistry Broadcast</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  ඔබ මිලදී ගත් පන්තිවලට අදාළ සජීවී දේශන සබැඳි (Live Stream Broadcast Zoom Links) මෙතැනින් ලබාගත හැක.
                </p>
              </div>

              {(() => {
                const liveClassItems = classes.filter(
                  (c) => approvedClassIds.includes(c.id) && c.zoomLink
                );

                if (liveClassItems.length === 0) {
                  return (
                    <div className="p-6 bg-gray-50 border rounded-xl space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">සක්‍රීය සජීවී විකාශන නොමැත</p>
                      <p className="text-sm text-gray-600">ඔබ මිලදී ගත් පන්ති සඳහා දැනට සක්‍රීය Zoom සබැඳි කිසිවක් ඇතුළත් කර නොමැත.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ඔබගේ සක්‍රීය සජීවී දේශන සබැඳි:</p>
                    {liveClassItems.map((c) => (
                      <div key={c.id} className="p-5 border rounded-2xl bg-gray-50/50 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-gray-800 text-sm">{c.title}</h4>
                            <p className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold inline-block uppercase mt-1">LIVE BROADCAST</p>
                          </div>
                          <span className="text-xs text-gray-400 font-medium">Batch: {c.batch}</span>
                        </div>
                        {c.zoomCaption && (
                          <p className="text-xs text-gray-500 bg-white p-3 rounded-lg border leading-relaxed">
                            📢 {c.zoomCaption}
                          </p>
                        )}
                        <a
                          href={c.zoomLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-center w-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-lg transition-colors shadow-sm animate-bounce"
                        >
                          Join Live Stream (Zoom)
                        </a>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* 7.5 TUTE TRACKINGS VIEW                                  */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === "tuteTracking" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-extrabold text-gray-900">Tute Trackings</h2>
                <p className="text-gray-400 text-sm">Tute Delivery සම්බන්ධ විස්තර පහතින් දැක්වේ..</p>
              </div>

              {/* Green Confirmation Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-xs font-semibold leading-relaxed flex items-center gap-2.5">
                <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 flex-shrink-0 text-xs">👍</span>
                <p>
                  ඔබට නිබන්ධන කට්ටලය ලැබුණු පසු <span className="font-bold text-emerald-700">confirm</span> බොත්තම Click කර නිබන්ධන කට්ටලය ලැබුණු බව තහවුරු කරන්න.
                </p>
              </div>

              {/* Blue Warning Banner */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sky-800 text-xs leading-relaxed">
                <p>
                  නිබන්ධන ඔබ ප්‍රදේශයේ කූරියර් ශාඛාව දක්වා පැමිණ ඇති නම් ඒ ඒ ශාඛාවට අයත් දුරකථන අංකය ලබාගෙන එය අමතා තොරතුරු ලබාගැනීමට හැක. දුරකථන අංක ලබා ගැනීම සඳහා <span className="font-bold text-sky-700">Traking Site</span> භාවිතා කරන්න.
                </p>
              </div>

              {/* Grey Courier Contact Info Banner */}
              <div className="bg-gray-50 border rounded-xl p-5 text-xs text-gray-600 space-y-2">
                <p className="font-bold text-gray-700">
                  ඒ සම්බන්ධ වෙනත් ගැටළු වේ නම් පහත අංකය හරහා කූරියර් ආයතනය අමතා තොරතුරු ලබාගැනීමට ඔබට හැකියාව පවතිී.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-semibold mt-1">
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">PromptXpress Hotline:</span> <span className="text-red-600">0114422733</span></div>
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">Pronto Hotline:</span> <span className="text-red-600">0112102700</span></div>
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">Speed Post Hotline:</span> <span className="text-red-600">0112320700</span></div>
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">Turbo Delivery Hotline:</span> <span className="text-red-600">0778569547</span></div>
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">Ayu Express Hotline:</span> <span className="text-red-600">0723130468</span></div>
                  <div className="flex justify-between border-b pb-1.5"><span className="text-gray-400">lexpress Hotline:</span> <span className="text-red-600">0761410777</span></div>
                </div>
              </div>

              {/* Tracking Table */}
              {(() => {
                const trackedPayments = payments.filter((p) => p.status === "approved" && p.tuteRequired);

                if (trackedPayments.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border p-8">
                      දැනට තැපැල් කිරීමට කිසිදු නිබන්ධනයක් ඉල්ලුම් කර නොමැත.
                    </div>
                  );
                }

                return (
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-700">
                        <thead className="bg-gray-50 border-b font-extrabold text-xs uppercase text-gray-400 tracking-wider">
                          <tr>
                            <th className="py-4 px-6">#</th>
                            <th className="py-4 px-6">Tute (පන්තිය)</th>
                            <th className="py-4 px-6">TrakingID</th>
                            <th className="py-4 px-6">Traking Site</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6">Date</th>
                            <th className="py-4 px-6 text-center">Confirmed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium">
                          {trackedPayments.map((pay, index) => (
                            <tr key={pay.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-4 px-6 font-bold text-gray-400">{index + 1}</td>
                              <td className="py-4 px-6 font-bold text-gray-900">{pay.classTitle}</td>
                              <td className="py-4 px-6">
                                {pay.trackingId ? (
                                  <span className="font-mono text-purple-600 font-extrabold tracking-wider bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                                    {pay.trackingId}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs font-semibold uppercase bg-gray-100 px-2 py-0.5 rounded">Tute Not Available</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                {pay.courierLink ? (
                                  <a
                                    href={pay.courierLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold rounded-lg border border-blue-200 transition-colors inline-flex items-center gap-1 shadow-sm"
                                  >
                                    🔗 Tracking Site
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                {pay.deliveryStatus === "Delivered" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-bold rounded-full">
                                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                                    Delivered
                                  </span>
                                ) : pay.deliveryStatus === "Shipped" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    Shipped
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-gray-500 text-xs font-mono">
                                {pay.shippedAt ? new Date(pay.shippedAt).toLocaleDateString() : pay.approvedAt ? new Date(pay.approvedAt).toLocaleDateString() : "Pending"}
                              </td>
                              <td className="py-4 px-6 text-center">
                                {pay.studentConfirmed ? (
                                  <span className="text-green-600 font-extrabold text-xs inline-flex items-center gap-1">
                                    ✓ Received
                                  </span>
                                ) : pay.deliveryStatus === "Shipped" ? (
                                  <button
                                    onClick={() => handleConfirmDelivery(pay.id)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all"
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {/* ── Site Footer ── */}
        <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center flex-shrink-0">
          <p className="text-xs font-bold text-gray-700 tracking-wide">
            SKCHEM.COM - Sujith K Kumara
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
            Copyright &copy; Theekshana Viduranga <span className="font-mono">&lt;/&gt;</span>
          </p>
        </footer>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 9. BUY COURSE & SLIP UPLOAD DIALOG (MODAL)               */}
      {/* ──────────────────────────────────────────────────────── */}
      {buyingClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border max-w-md w-full shadow-2xl overflow-hidden relative">
            <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6">
              <h3 className="text-lg font-extrabold">පන්ති ගාස්තු ගෙවීම් රිසිට්පත</h3>
              <p className="text-red-100 text-xs mt-1">
                Course: <b>{buyingClass.title}</b> (LKR {buyingClass.price})
              </p>
            </div>

            {paymentSuccess ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h4 className="font-extrabold text-gray-900 text-lg">රිසිට්පත සාර්ථකව ඉදිරිපත් කරන ලදී!</h4>
                <p className="text-gray-400 text-xs">
                  පරිපාලක (Admin) මණ්ඩලය විසින් පරීක්ෂා කිරීමෙන් පසු පැය 24ක් ඇතුළත ඔබේ පන්තිය සක්‍රීය කරනු ඇත.
                </p>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-lg flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{modalError}</span>
                  </div>
                )}
                
                {/* Bank Account Info reminder */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[11px] text-red-700 leading-relaxed">
                  මුදල් තැන්පත් කිරීමට බැංකු ගිණුම් අංක <b>"Bank Details"</b> ටැබ් එකෙන් ලබාගන්න.
                </div>

                {/* File picker */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Upload Slip Image (JPG/PNG)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-red-500 transition-colors bg-gray-50/50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      required
                      className="hidden"
                      id="slip-image-picker"
                    />
                    <label htmlFor="slip-image-picker" className="cursor-pointer space-y-2 block">
                      {slipImage ? (
                        <div className="relative inline-block">
                          <img
                            src={slipImage}
                            alt="Slip Preview"
                            className="h-32 object-contain rounded-lg border bg-white shadow-sm"
                          />
                          <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 text-xs cursor-pointer shadow">✕</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <svg className="w-10 h-10 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <p className="text-xs font-semibold text-red-600">Choose Image File</p>
                          <p className="text-[10px] text-gray-400">Drag &amp; drop or click to upload</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Tute Delivery section */}
                <div className="border-t pt-4 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer uppercase">
                    <input
                      type="checkbox"
                      checked={tuteRequired}
                      onChange={(e) => setTuteRequired(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span>Tute Delivery (නිබන්ධන නිවසටම ගෙන්වා ගැනීමට අවශ්‍යයි)</span>
                  </label>
                  
                  {tuteRequired && (
                    <div className="space-y-3 bg-gray-50 p-3 rounded-xl border">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Delivery Address (නිබන්ධන එවිය යුතු ලිපිනය)
                        </label>
                        <input
                          type="text"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          required={tuteRequired}
                          placeholder="නිවසේ ලිපිනය ඇතුළත් කරන්න..."
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                          Delivery Contact Number (දුරකථන අංකය)
                        </label>
                        <input
                          type="text"
                          value={deliveryPhone}
                          onChange={(e) => setDeliveryPhone(e.target.value)}
                          required={tuteRequired}
                          placeholder="දුරකථන අංකය ඇතුළත් කරන්න..."
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBuyingClass(null);
                      setSlipImage("");
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg text-sm transition-colors border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-200 text-gray-900 font-black py-2.5 rounded-lg text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                  >
                    {submittingPayment ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Slip"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 10. SECURE COURSE MEDIA PLAYER (MODAL)                   */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeCourseMedia && (() => {
        let videoId = "";
        const link = activeCourseMedia.youtubeLink || "";
        if (link.includes("youtube.com/watch")) {
          try {
            const urlParams = new URLSearchParams(new URL(link).search);
            videoId = urlParams.get("v") || "";
          } catch(e) { videoId = ""; }
        } else if (link.includes("youtu.be/")) {
          videoId = link.split("youtu.be/")[1]?.split("?")[0] || "";
        } else if (link.includes("youtube.com/embed/")) {
          videoId = link.split("youtube.com/embed/")[1]?.split("?")[0] || "";
        } else {
          videoId = link;
        }

        return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full border shadow-2xl relative">
              
              {/* Header */}
              <div className="bg-gray-900 text-white p-5 flex justify-between items-center border-b border-gray-800">
                <div>
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-extrabold rounded uppercase tracking-wider">
                    {activeCourseMedia.batch} · CHEMISTRY
                  </span>
                  <h3 className="text-base font-extrabold mt-1">{activeCourseMedia.title}</h3>
                </div>
                <button
                  onClick={() => { setActiveCourseMedia(null); setIsPlaying(false); }}
                  className="text-gray-400 hover:text-white font-extrabold text-lg bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Video Box */}
              <div
                ref={playerContainerRef}
                className="bg-black relative aspect-video flex items-center justify-center border-b overflow-hidden group"
                onContextMenu={(e) => e.preventDefault()}
              >
                {!videoId ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm font-bold p-8 text-center space-y-2">
                    <p>🎥 වීඩියෝවක් ඇතුළත් කර නොමැත.</p>
                    <p className="text-xs text-gray-500 font-medium">කරුණාකර පසුව නැවත පරීක්ෂා කරන්න.</p>
                  </div>
                ) : (
                  <>
                    <iframe
                      ref={iframeRef}
                      src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&fs=0&controls=0&color=white&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                      title="Course Lecture Video"
                      className="absolute inset-0 w-full h-full border-none pointer-events-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                    
                    {/* Video canvas overlay - clicks toggle play/pause */}
                    <div 
                      className="absolute inset-0 bg-transparent cursor-pointer"
                      onClick={togglePlayPause}
                    />

                    {/* Premium Custom Control Bar */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 pt-10 flex flex-col gap-2 transition-all duration-300 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 z-20">
                      
                      {/* Seek / Progress Bar */}
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          value={currentTime}
                          onChange={handleSeekChange}
                          className="flex-1 accent-red-600 h-1 rounded-full cursor-pointer bg-white/30 hover:h-1.5 transition-all"
                        />
                      </div>

                      <div className="flex items-center justify-between text-white text-xs font-bold">
                        {/* Play/Pause & Time */}
                        <div className="flex items-center gap-4">
                          <button
                            onClick={togglePlayPause}
                            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                            title={isPlaying ? "Pause" : "Play"}
                          >
                            {isPlaying ? (
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" d="M18 19h-4V5h4v14zm-8 0H6V5h4v14z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>

                          <span className="font-mono text-gray-200">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        </div>

                        {/* Fullscreen Button */}
                        <button
                          onClick={toggleFullScreen}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                          title="Fullscreen"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Caption & Notice Box */}
              <div className="p-6 bg-gray-50 space-y-2">
                <h4 className="font-extrabold text-gray-900 text-sm">දේශන සටහන / Caption:</h4>
                <p className="text-xs text-gray-600 leading-relaxed bg-white p-4 rounded-xl border font-medium">
                  {activeCourseMedia.youtubeCaption || "මෙම දේශනයට අදාළ විශේෂ සටහන් කිසිවක් සපයා නොමැත."}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Image Crop Modal ── */}
      {showCropModal && cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onCrop={handleCropDone}
          onCancel={() => { setShowCropModal(false); setCropSrc(null); }}
        />
      )}
    </div>
  );
}

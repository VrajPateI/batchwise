import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    FileText,
    ClipboardCheck,
    Settings,
    LogOut,
    Building2,
    MoreVertical, // Added for the "3 dots" trigger
    X, // Added for closing the sidebar
    UserPlus,
    LineChart,
    TrendingUp,
    HelpCircle,
    ArrowLeft // Added for Back Button
} from 'lucide-react';

export default function AdminLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();

    // --- STATE FOR SIDEBAR VISIBILITY ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // --- STATE FOR INSTITUTE BRANDING ---
    const [instituteDetails, setInstituteDetails] = useState({
        name: localStorage.getItem('institute_name') || 'Batchwise',
        logo: localStorage.getItem('institute_logo') || '/favicon.png'
    });

    // --- STATE FOR HELP MODAL ---
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    // --- CLOSE SIDEBAR ON ROUTE CHANGE (Mobile) ---
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

    // --- FETCH INSTITUTE DATA ---
    useEffect(() => {
        async function fetchInstituteInfo() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('profiles')
                    .select('institutes(name, logo_url)')
                    .eq('id', user.id)
                    .single();

                if (data?.institutes) {
                    const { name, logo_url } = data.institutes;
                    setInstituteDetails({ name, logo: logo_url });
                    localStorage.setItem('institute_name', name);
                    if (logo_url) localStorage.setItem('institute_logo', logo_url);
                }
            } catch (err) {
                console.error("Error fetching institute details:", err);
            }
        }
        fetchInstituteInfo();
    }, []);

    const handleLogout = async () => {
        if (window.confirm("Are you sure you want to log out?")) {
            await supabase.auth.signOut();
            localStorage.clear();
            navigate('/login');
        }
    };

    // --- HELPER: MOBILE BOTTOM NAV ITEM ---
    const MobileNavItem = ({ to, icon: Icon, label, isMain }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex flex-col items-center justify-end w-full pb-2 pt-1 transition-all duration-200 relative ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <div className={`
                    transition-all duration-200 flex items-center justify-center
                    ${isMain
                        ? 'bg-indigo-600 text-white rounded-full p-3.5 -mt-10 mb-1 shadow-xl shadow-indigo-200 border-[5px] border-slate-50'
                        : `mb-0.5 p-1 rounded-xl ${isActive ? 'bg-indigo-50' : ''}`
                    }
                `}>
                    <Icon size={isMain ? 24 : 20} strokeWidth={isActive || isMain ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-medium leading-none ${isMain ? 'font-bold text-indigo-700 translate-y-1' : ''}`}>
                    {label}
                </span>
            </Link>
        );
    };

    // --- HELPER: DESKTOP SIDEBAR LINK ---
    const DesktopNavItem = ({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                    }`}
            >
                <Icon size={20} />
                <span>{label}</span>
            </Link>
        );
    };

    // --- BRAND LOGO COMPONENT ---
    const BrandLogo = () => (
        <div className="flex items-center gap-3">
            {instituteDetails.logo ? (
                <img
                    src={instituteDetails.logo}
                    alt="Logo"
                    className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100"
                />
            ) : (
                <img
                    src="/favicon.png"
                    alt="Batchwise Logo"
                    className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100"
                />
            )}
            <span className="font-bold text-slate-800 text-lg tracking-tight whitespace-nowrap">
                {instituteDetails.name}
            </span>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex">

            {/* --- MOBILE SIDEBAR BACKDROP --- */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* --- SIDEBAR NAVIGATION (Responsive) --- */}
            <aside className={`
                fixed inset-y-0 left-0 z-[70] min-w-[280px] w-auto bg-white border-r border-slate-200 flex flex-col 
                transition-transform duration-300 shadow-2xl lg:static lg:shadow-none lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
            `}>
                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                    <BrandLogo />
                    {/* Close Button (Mobile Only) */}
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                    <DesktopNavItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <DesktopNavItem to="/admin/strategic" icon={LineChart} label="Strategic View" />

                    <DesktopNavItem to="/admin/students" icon={Users} label="Students" />
                    <DesktopNavItem to="/admin/add-student" icon={UserPlus} label="Add Student" />
                    <DesktopNavItem to="/admin/promote" icon={TrendingUp} label="Promote Students" />

                    <DesktopNavItem to="/admin/fees" icon={CreditCard} label="Fee Collection" />
                    <DesktopNavItem to="/admin/attendance" icon={ClipboardCheck} label="Attendance" />
                    <DesktopNavItem to="/admin/tests" icon={FileText} label="Exams & Results" />

                    <DesktopNavItem to="/admin/settings" icon={Settings} label="Settings" />
                    <DesktopNavItem to="/help" icon={HelpCircle} label="Help" />
                </div>

                {/* Logout Button */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors font-medium text-sm"
                    >
                        <LogOut size={20} />
                        <span>Log Out</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

                {/* Mobile Top Header */}
                <header className="h-16 lg:hidden bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
                    <BrandLogo />

                    {/* 3 DOTS MENU TRIGGER */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="text-slate-500 hover:text-indigo-600 bg-slate-50 p-2 rounded-full border border-slate-100 active:scale-95 transition-transform"
                    >
                        <MoreVertical size={20} />
                    </button>
                </header>

                {/* Scrollable Page Content */}
                <div className={`flex-1 overflow-y-auto px-4 lg:px-8 pb-28 lg:pb-8 ${location.pathname === '/admin/dashboard' ? 'pt-0' : 'pt-4 lg:pt-8'}`}>
                    {/* BACK BUTTON (Visible on all pages except Dashboard) */}
                    {/* NAVIGATION HEADER (Visible on all pages except Dashboard) */}
                    {location.pathname !== '/admin/dashboard' && (
                        <div className="mb-4 flex items-center justify-between">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsHelpOpen(true)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="Help"
                                >
                                    <HelpCircle size={18} />
                                </button>
                                <Link
                                    to="/admin/settings"
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="Settings"
                                >
                                    <Settings size={18} />
                                </Link>
                            </div>
                        </div>
                    )}
                    {children}

                    {/* --- CONTEXTUAL HELP MODAL --- */}
                    {isHelpOpen && (
                        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsHelpOpen(false)}>
                            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                                <h3 className="font-bold text-lg text-slate-800 mb-2 flex items-center gap-2">
                                    <HelpCircle size={20} className="text-indigo-600" />
                                    Page Guide
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                                    {(() => {
                                        const path = location.pathname;
                                        if (path.includes('/students') || path.includes('/add-student')) return "Click + New Student to register. Type a name in the Search Bar to edit profiles. Use Filter to see specific batches.";
                                        if (path.includes('/fees')) return "Log manual payments via Record Transaction. For online payments, use the Pending Requests tab to Approve/Reject proofs.";
                                        if (path.includes('/attendance')) return "Select Batch and Date. Tap student names to toggle Absent (Red) or Leave (Orange). Click Save Record.";
                                        if (path.includes('/tests')) return "Step 1: Schedule Exam. Step 2: Open the exam to enter marks. Step 3: Publish Results for parents.";
                                        if (path.includes('/settings')) return "Click Create Batch for new groups. Open a batch card to Add Student to that schedule.";
                                        return "Navigate to a specific page to see help instructions.";
                                    })()}
                                </p>
                                <button
                                    onClick={() => setIsHelpOpen(false)}
                                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition"
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* --- MOBILE ISLAND NAVIGATION (Bottom Fixed) --- */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-4">
                <div className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl shadow-slate-300/50 rounded-2xl w-[95%] max-w-sm px-1 py-1 flex justify-between items-end h-16">

                    {/* Left Buttons */}
                    <MobileNavItem to="/admin/students" icon={Users} label="Students" />
                    <MobileNavItem to="/admin/fees" icon={CreditCard} label="Fees" />

                    {/* MIDDLE MAIN BUTTON (Dashboard) */}
                    <MobileNavItem to="/admin/dashboard" icon={LayoutDashboard} label="Home" isMain={true} />

                    {/* Right Buttons */}
                    <MobileNavItem to="/admin/attendance" icon={ClipboardCheck} label="Attend" />
                    <MobileNavItem to="/admin/tests" icon={FileText} label="Exams" />

                </div>
            </div>

        </div>
    );
}
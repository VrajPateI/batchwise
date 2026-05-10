import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    IndianRupee,
    AlertTriangle,
    TrendingUp,
    Plus,
    List,
    Settings,
    Bell,
    Calendar,
    User,
    Clock,
    HelpCircle,
    X,
    ChevronRight
} from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();

    // Stats State
    const [stats, setStats] = useState({
        totalStudents: 0,
        collectedRevenue: 0,
        pendingFees: 0,
        activePercentage: 0,
        newStudentsThisMonth: 0,
        estMonthlyRevenue: 0,
        topDefaulters: [],
        recentPayments: [], // For Revenue Modal
        newAdmissionsList: [], // For Students Modal
        completingSoon: 0
    });

    const [loading, setLoading] = useState(true);

    // Modal State
    const [selectedInsight, setSelectedInsight] = useState(null); // 'REVENUE', 'PENDING', 'STUDENTS', 'MONTHLY'

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    async function fetchDashboardStats() {
        try {
            setLoading(true);

            // 1. Fetch Students
            const { data: students, error } = await supabase
                .from('students')
                .select('name, total_fee_package, paid_amount, created_at, batch_name')
                .order('created_at', { ascending: false });

            if (error) throw error;

            let totalStudents = students.length;
            let collected = 0;
            let total = 0;
            let newStudents = 0;
            let newRevenue = 0;
            let completingCount = 0;
            let defaultersList = [];
            let newAdmissionsList = [];

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const elevenMonthsAgo = new Date();
            elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

            students.forEach(s => {
                const fee = s.total_fee_package || 0;
                const paid = s.paid_amount || 0;
                const pending = fee - paid;
                const joinDate = new Date(s.created_at);

                collected += paid;
                total += fee;

                // Logic for Lists
                if (pending > 0) defaultersList.push({ name: s.name, amount: pending, batch: s.batch_name });
                if (joinDate >= startOfMonth) {
                    newStudents++;
                    newRevenue += fee;
                    newAdmissionsList.push(s);
                }
                if (joinDate < elevenMonthsAgo) completingCount++;
            });

            // Sorting
            defaultersList.sort((a, b) => b.amount - a.amount);

            // 2. Fetch Recent Payments (Simulated via paid_amount for now, or fetch actual transaction table if it existed)
            // Since we don't have a separate transactions table yet, we'll just use student list for the popup demo

            const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;

            setStats({
                totalStudents,
                collectedRevenue: collected,
                pendingFees: total - collected,
                activePercentage: percentage,
                newStudentsThisMonth: newStudents,
                estMonthlyRevenue: newRevenue,
                topDefaulters: defaultersList,
                newAdmissionsList: newAdmissionsList,
                completingSoon: completingCount
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const formatIndianCurrency = (num) => {
        if (!num) return '₹0';
        if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
        if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
        if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
        return `₹${num}`;
    };

    const CircleChart = ({ percent, colorClass }) => {
        const radius = 30;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        return (
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="transform -rotate-90 w-full h-full">
                    <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                    <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={colorClass} />
                </svg>
                <span className="absolute text-xs font-bold text-slate-700">{percent}%</span>
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="flex flex-col h-[calc(100vh-6rem)]">

                {/* HEADER */}
                <div className="flex justify-between items-center mb-2 px-2 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Overview</h1>
                        <p className="text-xs text-slate-500">Welcome back, Admin</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Help Button */}
                        <Link to="/help" className="bg-white p-2 rounded-full border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 transition">
                            <HelpCircle size={18} />
                        </Link>
                        {/* Bell Notification */}
                        <div className="bg-white p-2 rounded-full border border-slate-200 shadow-sm relative">
                            <Bell size={18} className="text-slate-400" />
                            <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
                        </div>
                    </div>
                </div>

                {/* --- CAROUSEL (Clickable Cards) --- */}
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 hide-scrollbar px-1 items-start h-auto shrink-0">

                    {/* 1. MONTHLY INSIGHTS */}
                    <div
                        onClick={() => setSelectedInsight('MONTHLY')}
                        className="min-w-[90%] snap-center bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between h-60 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 z-0 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="max-w-[70%]">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider truncate">This Month</p>
                                <h2 className="text-3xl font-bold text-blue-600 mt-1 tracking-tight">
                                    {loading ? '...' : `+${stats.newStudentsThisMonth}`}
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">New Admissions</p>
                            </div>
                            <div className="p-3 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-200 shrink-0"><Calendar size={24} /></div>
                        </div>
                        <div className="relative z-10 mt-auto bg-blue-50 rounded-xl p-3 border border-blue-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-blue-800">Est. Revenue</span>
                            <span className="text-sm text-blue-700 font-bold">{formatIndianCurrency(stats.estMonthlyRevenue)}</span>
                        </div>
                    </div>

                    {/* 2. PENDING FEES */}
                    <div
                        onClick={() => setSelectedInsight('PENDING')}
                        className="min-w-[90%] snap-center bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between h-60 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-8 -mt-8 z-0 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="max-w-[70%]">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider truncate">Total Pending</p>
                                <h2 className="text-3xl font-bold text-rose-600 mt-1 tracking-tight">
                                    {loading ? '...' : formatIndianCurrency(stats.pendingFees)}
                                </h2>
                            </div>
                            <div className="p-3 bg-rose-500 rounded-xl text-white shadow-lg shadow-rose-200 shrink-0"><AlertTriangle size={24} /></div>
                        </div>
                        <div className="relative z-10 mt-auto bg-rose-50 rounded-xl p-3 border border-rose-100 text-rose-700 text-xs font-bold flex justify-between items-center">
                            <span>{stats.topDefaulters.length} Students Pending</span>
                            <ChevronRight size={16} />
                        </div>
                    </div>

                    {/* 3. STUDENTS STATS */}
                    <div
                        onClick={() => setSelectedInsight('STUDENTS')}
                        className="min-w-[90%] snap-center bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between h-60 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 z-0 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="max-w-[70%]">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider truncate">Students</p>
                                <h2 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{loading ? '...' : stats.totalStudents}</h2>
                            </div>
                            <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-200 shrink-0"><TrendingUp size={24} /></div>
                        </div>
                        <div className="relative z-10 grid grid-cols-2 gap-2 mt-4">
                            <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                                <p className="text-[10px] text-emerald-600 font-bold uppercase">New (Month)</p>
                                <p className="text-lg font-bold text-emerald-700">+{stats.newStudentsThisMonth}</p>
                            </div>
                            <div className="bg-amber-50 p-2 rounded-xl border border-amber-100">
                                <p className="text-[10px] text-amber-600 font-bold uppercase flex items-center gap-1"><Clock size={10} /> Ending Soon</p>
                                <p className="text-lg font-bold text-amber-700">{stats.completingSoon}</p>
                            </div>
                        </div>
                    </div>

                    {/* 4. TOTAL REVENUE */}
                    <div
                        onClick={() => setSelectedInsight('REVENUE')}
                        className="min-w-[90%] snap-center bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between h-60 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 z-0 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10 flex justify-between items-start">
                            <div className="max-w-[70%]">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider truncate">Revenue</p>
                                <h2 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{loading ? '...' : formatIndianCurrency(stats.collectedRevenue)}</h2>
                            </div>
                            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200 shrink-0"><IndianRupee size={24} /></div>
                        </div>
                        <div className="relative z-10 flex items-center gap-5 mt-2">
                            <CircleChart percent={stats.activePercentage} colorClass="text-indigo-600" />
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 font-medium truncate">Recovered</p>
                                <p className="text-sm font-semibold text-slate-700 truncate">{stats.activePercentage}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- BOTTOM ACTIONS --- */}
                <div className="grid grid-cols-2 gap-3 mt-4 px-2 pb-6">
                    <Link to="/admin/add-student" className="h-20 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-1 active:bg-indigo-100 transition shadow-sm">
                        <Plus size={28} className="text-indigo-600" />
                        <span className="font-bold text-indigo-700 text-xs">Add New</span>
                    </Link>
                    <Link to="/admin/students" className="h-20 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 active:bg-slate-50 transition shadow-sm">
                        <List size={28} className="text-slate-500" />
                        <span className="font-medium text-slate-600 text-xs">Student List</span>
                    </Link>
                    <Link to="/admin/tests" className="h-20 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 active:bg-slate-50 transition shadow-sm">
                        <div className="relative"><AlertTriangle size={28} className="text-slate-500" /><div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></div></div>
                        <span className="font-medium text-slate-600 text-xs">Exams</span>
                    </Link>
                    <Link to="/admin/settings" className="h-20 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 active:bg-slate-50 transition shadow-sm">
                        <Settings size={28} className="text-slate-500" />
                        <span className="font-medium text-slate-600 text-xs">Settings</span>
                    </Link>
                </div>

                {/* --- INSIGHT POPUP MODAL --- */}
                {selectedInsight && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[80vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="font-bold text-lg text-slate-800">
                                    {selectedInsight === 'PENDING' && "Pending Fees Breakdown"}
                                    {selectedInsight === 'MONTHLY' && "This Month's Admissions"}
                                    {selectedInsight === 'REVENUE' && "Revenue Details"}
                                    {selectedInsight === 'STUDENTS' && "Student Insights"}
                                </h3>
                                <button onClick={() => setSelectedInsight(null)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {selectedInsight === 'PENDING' && (
                                    stats.topDefaulters.length === 0
                                        ? <p className="text-center text-slate-400 py-10">No pending fees.</p>
                                        : stats.topDefaulters.map((s, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                                                    <p className="text-[10px] text-slate-500">{s.batch}</p>
                                                </div>
                                                <span className="font-bold text-rose-600">{formatIndianCurrency(s.amount)}</span>
                                            </div>
                                        ))
                                )}

                                {selectedInsight === 'MONTHLY' && (
                                    stats.newAdmissionsList.length === 0
                                        ? <p className="text-center text-slate-400 py-10">No new students this month.</p>
                                        : stats.newAdmissionsList.map((s, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(s.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className="font-bold text-blue-600">{formatIndianCurrency(s.total_fee_package)}</span>
                                            </div>
                                        ))
                                )}

                                {(selectedInsight === 'REVENUE' || selectedInsight === 'STUDENTS') && (
                                    <div className="text-center py-10 text-slate-400">
                                        <p>Detailed breakdown available in Reports.</p>
                                        <button onClick={() => navigate('/admin/students')} className="mt-4 text-indigo-600 font-bold text-sm underline">Go to Student List</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { ScrollReveal } from '../components/ScrollReveal';
import { supabase } from '../supabaseClient';
import {
    IndianRupee,
    TrendingUp,
    Plus,
    HelpCircle,
    Calendar,
    User,
    Clock,
    ArrowRight,
    X,
    CheckCircle,
    ArrowUpRight
} from 'lucide-react';

import CountUp from 'react-countup';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart as RechartsLineChart,
    Line
} from 'recharts';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const formatIndianCurrency = (num) => {
    if (!num) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(num);
};

// Debugging Imports


const SafeCountUp = (props) => {
    const Component = CountUp?.default || CountUp;
    if (typeof Component !== 'function' && typeof Component !== 'object') return <span>{props.end}</span>;
    return <Component {...props} />;
};
// Use Skeleton directly for now, assuming it might be fine, or wrapper it too if needed.
const SafeSkeleton = (props) => {
    const Component = Skeleton?.default || Skeleton;
    return <Component {...props} />;
}

export default function AdminDashboard() {
    const navigate = useNavigate();

    // --- STATE ---
    const [stats, setStats] = useState({
        totalStudents: 0,
        collectedRevenue: 0,
        pendingFees: 0,
        activePercentage: 0,
        newStudentsThisMonth: 0,
        estMonthlyRevenue: 0,
        monthlyCollectionPercentage: 0,
        topDefaulters: [],
        newAdmissionsList: [],
        completingSoon: 0
    });

    // Chart Data State (Last 6 Months)
    const [chartData, setChartData] = useState([]);

    const [loading, setLoading] = useState(true);
    const [activeModal, setActiveModal] = useState(null);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('institute_id')
                    .eq('id', user.id)
                    .single();

                if (profile?.institute_id) {
                    fetchDashboardStats(profile.institute_id);
                }
            }
        };
        init();
    }, []);

    async function fetchDashboardStats(instituteId) {
        try {
            setLoading(true);

            // 1. Get the REAL total count (Bypasses the 1000 limit)
            const { count: totalCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('institute_id', instituteId);

            // 2. Get the REAL Financial Sums (using a RPC or select)
            // Note: For 2000+ students, a small SQL function (RPC) is faster, 
            // but for now, we'll fetch the numbers only.
            const { data: allFinanceData } = await supabase
                .from('students')
                .select('total_fee_package, paid_amount, created_at')
                .eq('institute_id', instituteId)
                .limit(5000); // Raise the limit for stats calculation

            if (!allFinanceData) return;

            let collected = 0;
            let total = 0;
            let newStudents = 0;
            let newRevenue = 0;
            let newCollected = 0;
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // --- CHART AGGREGATION ---
            const monthsMap = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = d.toLocaleString('default', { month: 'short' });
                monthsMap[key] = { month: key, revenue: 0, students: 0 };
            }

            allFinanceData.forEach(s => {
                const fee = s.total_fee_package || 0;
                const paid = s.paid_amount || 0;
                const joinDate = new Date(s.created_at);
                const monthKey = joinDate.toLocaleString('default', { month: 'short' });

                collected += paid;
                total += fee;

                if (joinDate >= startOfMonth) {
                    newStudents++;
                    newRevenue += fee;
                    newCollected += paid;
                }

                if (monthsMap[monthKey]) {
                    monthsMap[monthKey].revenue += fee;
                    monthsMap[monthKey].students += 1;
                }
            });

            // 3. Get the "Top Defaulters" separately (snappy & limited)
            const { data: defaulters } = await supabase
                .from('students')
                .select('name, total_fee_package, paid_amount, batch_name')
                .eq('institute_id', instituteId)
                .gt('pending_payment', 0) // Only fetch those who owe money
                .order('pending_payment', { ascending: false })
                .limit(5);

            setStats({
                totalStudents: totalCount, // Correct count (2000)
                collectedRevenue: collected,
                pendingFees: total - collected,
                activePercentage: total > 0 ? Math.round((collected / total) * 100) : 0,
                newStudentsThisMonth: newStudents,
                estMonthlyRevenue: newRevenue,
                monthlyCollectionPercentage: newRevenue > 0 ? Math.round((newCollected / newRevenue) * 100) : 0,
                topDefaulters: defaulters?.map(d => ({
                    name: d.name,
                    amount: d.total_fee_package - d.paid_amount,
                    batch: d.batch_name
                })) || [],
                newAdmissionsList: [], // You can fetch this separately if needed
                completingSoon: 0
            });

            setChartData(Object.values(monthsMap));
            setLoading(false);
        } catch (error) {
            console.error('Error:', error);
            setLoading(false);
        }
    }

    // --- CHART COMPONENTS ---
    const BarChart = ({ data }) => {
        return (
            <div className="h-48 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 10, fontWeight: 'bold' }}
                            dy={10}
                        />
                        <YAxis
                            hide={true}
                        />
                        <Tooltip
                            cursor={{ fill: '#F1F5F9' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value) => [formatIndianCurrency(value), 'Revenue']}
                        />
                        <Bar
                            dataKey="revenue"
                            fill="#6366F1"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                            animationDuration={1500}
                        />
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Kept for future reference if needed, although not currently used in the main view
    const LineChart = ({ data }) => {
        return (
            <div className="h-48 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 10, fontWeight: 'bold' }}
                            dy={10}
                        />
                        <YAxis hide={true} />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="students"
                            stroke="#10B981"
                            strokeWidth={3}
                            dot={{ fill: 'white', stroke: '#10B981', r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                        />
                    </RechartsLineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="pb-20">

                {/* --- HEADER (Glassmorphism) --- */}
                <div className="backdrop-blur-xl bg-white/50 sticky top-0 z-40 border-b border-white/20 -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 mb-6 flex justify-between items-center shadow-sm transition-all duration-300">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
                        <p className="text-xs text-slate-500 font-medium">Overview & Analytics</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveModal('HELP')} className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm">
                            <HelpCircle size={20} />
                        </button>
                    </div>
                </div>

                {/* --- STATS GRID --- */}
                <ScrollReveal>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        {/* CARD 1: TOTAL STUDENTS */}
                        <div onClick={() => navigate('/admin/students')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-indigo-200 transition-all cursor-pointer">
                            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><User size={48} className="text-indigo-600" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><User size={16} /></div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Students</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">
                                {loading ? <SafeSkeleton width={60} /> : <SafeCountUp end={stats.totalStudents} duration={2.5} />}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded">
                                <TrendingUp size={10} />
                                {loading ? <SafeSkeleton width={30} /> : `+${stats.newStudentsThisMonth} this month`}
                            </div>
                        </div>

                        {/* CARD 2: REVENUE */}
                        <div onClick={() => setActiveModal('REVENUE')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-emerald-200 transition-all cursor-pointer">
                            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><IndianRupee size={48} className="text-emerald-600" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><IndianRupee size={16} /></div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Collection</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">
                                {loading ? <SafeSkeleton width={80} /> : <span>₹<SafeCountUp end={stats.collectedRevenue} separator="," duration={2.5} /></span>}
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-medium text-slate-400">
                                <span>Est: ₹{loading ? <SafeSkeleton width={40} inline /> : stats.estMonthlyRevenue.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* CARD 3: PENDING FEES */}
                        <div onClick={() => navigate('/admin/fees')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-rose-200 transition-all cursor-pointer">
                            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={48} className="text-rose-600" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Clock size={16} /></div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Fees</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">
                                {loading ? <SafeSkeleton width={80} /> : <span>₹<SafeCountUp end={stats.pendingFees} separator="," duration={2.5} /></span>}
                            </div>
                            <div className="text-[10px] text-rose-500 font-medium mt-1">
                                Action Needed
                            </div>
                        </div>

                        {/* CARD 4: ENDING SOON */}
                        <div onClick={() => setActiveModal('EXPIRING')} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-amber-200 transition-all cursor-pointer">
                            <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={48} className="text-amber-600" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Calendar size={16} /></div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ending Soon</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-800">
                                {loading ? <SafeSkeleton width={40} /> : <SafeCountUp end={stats.completingSoon} duration={2.5} />}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                Terms ending this month
                            </div>
                        </div>
                    </div>
                </ScrollReveal>

                {/* --- VERTICAL STACK --- */}
                <div className="space-y-5">

                    {/* 1. MONTHLY INSIGHTS */}
                    <ScrollReveal delay={0.2}>
                        <div
                            onClick={() => setActiveModal('MONTHLY')}
                            className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
                        >
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar size={16} className="text-blue-200" />
                                            <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">This Month</span>
                                        </div>
                                        <h2 className="text-4xl font-bold mt-1">+{stats.newStudentsThisMonth}</h2>
                                        <p className="text-blue-100 text-sm">New Admissions</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                                        <TrendingUp size={24} className="text-white" />
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <p className="text-[10px] text-blue-200 uppercase font-bold">Revenue Projection</p>
                                            <p className="text-xl font-bold">{formatIndianCurrency(stats.estMonthlyRevenue)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-emerald-300 font-bold">{stats.monthlyCollectionPercentage}% Collected</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-400 h-full rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-1000"
                                            style={{ width: `${stats.monthlyCollectionPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>



                    {/* 3. PAYMENT REMINDERS (Replaces "Action Needed") */}
                    <ScrollReveal delay={0.3}>
                        <div
                            onClick={() => setActiveModal('PENDING')}
                            className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 cursor-pointer active:scale-95 transition-transform"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                                        <Clock size={18} />
                                    </div>
                                    Payment Reminders
                                </h3>
                                <span className="text-xs font-bold text-purple-600">View Details</span>
                            </div>
                            <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
                                <p className="text-[10px] font-bold text-purple-400 uppercase mb-3 tracking-wider">Upcoming Collections</p>
                                <div className="space-y-3">
                                    {stats.topDefaulters.length === 0 ? (
                                        <div className="text-center py-4 text-purple-400 text-xs font-medium flex flex-col items-center gap-1">
                                            <CheckCircle size={16} />
                                            <span>All clear! No pending fees.</span>
                                        </div>
                                    ) : (
                                        stats.topDefaulters.map((s, i) => (
                                            <div key={i} className="flex justify-between items-center pb-2 border-b border-purple-100 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-purple-500 shadow-sm border border-purple-50">
                                                        {s.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{s.name}</p>
                                                        <p className="text-[10px] text-purple-400 font-medium">{s.batch}</p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-purple-600">{formatIndianCurrency(s.amount)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>



                    {/* 5. ADD BUTTON */}
                    <Link to="/admin/add-student" className="group flex items-center justify-between bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl shadow-slate-200 active:scale-95 transition-all mt-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-full"><Plus size={24} className="text-white" /></div>
                            <div className="text-left">
                                <p className="font-bold text-lg">Add New Student</p>
                                <p className="text-xs text-slate-400 font-medium">Create profile & set fees</p>
                            </div>
                        </div>
                        <div className="bg-white/10 p-2 rounded-full group-hover:bg-white/20 transition"><ArrowRight size={20} /></div>
                    </Link>

                    {/* --- PROMOTE BUTTON (Start) --- */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <Link
                            to="/admin/promote"
                            className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                        >
                            <ArrowUpRight size={16} />
                            Promote / Move Batch
                        </Link>
                        <p className="text-[10px] text-slate-400 text-center mt-1.5 px-2">
                            Move students to next class & reset fees for the new year.
                        </p>
                    </div>
                    {/* --- PROMOTE BUTTON (End) --- */}

                </div>

                {/* --- ANALYTICS MODAL --- */}
                {activeModal && (
                    <div
                        className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
                        onClick={() => setActiveModal(null)}
                    >
                        <div className="flex min-h-full items-end md:items-center justify-center p-4 text-center sm:p-0">

                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="relative transform overflow-hidden bg-white w-full max-w-md rounded-2xl p-6 text-left shadow-xl transition-all animate-in slide-in-from-bottom-10 my-4 mb-32"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">
                                            {activeModal === 'REVENUE' && 'Financial Growth'}
                                            {activeModal === 'STUDENTS' && 'Student Intake'}
                                            {activeModal === 'PENDING' && 'Pending Dues'}
                                            {activeModal === 'MONTHLY' && 'New Admissions'}
                                            {activeModal === 'HELP' && 'Help & Guide'}
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium">Detailed Insights</p>
                                    </div>
                                    <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content Body */}
                                <div className="space-y-6">

                                    {activeModal === 'REVENUE' && (
                                        <>
                                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                                <p className="text-xs font-bold text-indigo-400 uppercase mb-1">New Business Value</p>
                                                <p className="text-3xl font-bold text-indigo-900">{formatIndianCurrency(stats.estMonthlyRevenue)}</p>
                                                <p className="text-[10px] text-indigo-400 mt-1">Total fee value of students joined this month</p>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Revenue Trend</h3>
                                                <BarChart data={chartData} />
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2">Monthly Breakdown</h3>
                                                {chartData.slice().reverse().map((d, i) => (
                                                    <div key={i} className="flex justify-between items-center py-2">
                                                        <span className="font-bold text-slate-600">{d.month}</span>
                                                        <span className="font-mono text-sm font-bold text-slate-800">{formatIndianCurrency(d.revenue)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {activeModal === 'STUDENTS' && (
                                        <>
                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6">
                                                <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Total Active</p>
                                                <p className="text-3xl font-bold text-emerald-900">{stats.totalStudents}</p>
                                                <p className="text-[10px] text-emerald-500 mt-1">Students across all batches</p>
                                            </div>

                                            {/* LineChart Component is not defined, removed to avoid crash */}
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-3">Recent Admissions</h3>
                                                {chartData.slice().reverse().map((d, i) => (
                                                    <div key={i} className="flex justify-between items-center py-2">
                                                        <span className="font-bold text-slate-600">{d.month}</span>
                                                        <span className="flex items-center gap-1 font-mono text-sm font-bold text-emerald-600">
                                                            <Plus size={12} /> {d.students}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {activeModal === 'PENDING' && (
                                        <div className="space-y-3">
                                            {stats.topDefaulters && stats.topDefaulters.length > 0 ? (
                                                stats.topDefaulters.map((s, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100">
                                                        <div>
                                                            <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                                                            <p className="text-[10px] text-slate-500">{s.batch}</p>
                                                        </div>
                                                        <span className="font-bold text-purple-600">{formatIndianCurrency(s.amount)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-10 text-slate-400">All fees collected!</div>
                                            )}
                                        </div>
                                    )}

                                    {activeModal === 'MONTHLY' && (
                                        <div className="space-y-3">
                                            {stats.newAdmissionsList && stats.newAdmissionsList.length > 0 ? (
                                                stats.newAdmissionsList.map((s, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                        <div>
                                                            <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                                                            <p className="text-[10px] text-slate-500">{s.batch_name}</p>
                                                        </div>
                                                        {/* <div className="text-right">
                                                            <p className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString()}</p>
                                                        </div> */}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-10 text-slate-400">No new admissions this month.</div>
                                            )}
                                        </div>
                                    )}

                                    {activeModal === 'EXPIRING' && (
                                        <div className="text-center py-10 text-slate-400">
                                            <p>No subscriptions expiring soon.</p>

                                        </div>
                                    )}

                                    {activeModal === 'HELP' && (
                                        <div className="space-y-4">
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                                                    <div className="p-1 bg-indigo-100 text-indigo-600 rounded"><HelpCircle size={14} /></div>
                                                    Quick Guide
                                                </h3>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    Tap any Statistic Card to jump directly to that report. Review the 'Action Center' list at the bottom—click the Verify button on pending claims to clear tasks.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setActiveModal(null)}
                                                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-200 active:scale-95 transition-all mt-2"
                                            >
                                                Back to Dashboard
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
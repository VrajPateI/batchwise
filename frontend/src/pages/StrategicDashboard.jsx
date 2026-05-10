import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import {
    Loader,
    Users,
    IndianRupee,
    AlertCircle,
    UserCheck,
    TrendingUp,
    PieChart,
    ArrowUpRight,
    CheckCircle,
    Clock,
    MoreHorizontal
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart as RePie,
    Pie
} from 'recharts';

export default function StrategicDashboard() {
    const [instituteId, setInstituteId] = useState(null);

    useEffect(() => {
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('institute_id').eq('id', user.id).single();
                if (profile) setInstituteId(profile.institute_id);
            }
        };
        getProfile();
    }, []);

    const { metrics, loading, error } = useDashboardMetrics(instituteId);

    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader className="animate-spin text-indigo-600" size={32} />
                <p className="text-slate-400 text-sm font-medium animate-pulse">Syncing real-time metrics...</p>
            </div>
        </div>
    );

    // Prepare Data for Charts
    const walletData = metrics.wallet.revenueTrend.length > 0 ? metrics.wallet.revenueTrend : [{ month: 'No Data', revenue: 0 }];
    const batchData = metrics.classroom.batchDistribution.length > 0 ? metrics.classroom.batchDistribution : [{ name: 'No Batches', count: 0 }];

    // Donut Data
    const recoveryData = [
        { name: 'Collected', value: metrics.wallet.collected },
        { name: 'Pending', value: metrics.wallet.pending }
    ];
    const COLORS = ['#10b981', '#f43f5e']; // Emerald, Rose


    const formatCurrency = (val) => {
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
        return `₹${val}`;
    };

    return (
        <AdminLayout>
            <div className="pb-10 animate-in fade-in duration-500">
                {/* HERO HEADER */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Strategic Overview</h1>
                    <p className="text-xs text-slate-500 font-medium">Real-time pulse of your institute.</p>
                </div>

                {/* ZONE 1: THE PULSE */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {/* Card 1: Total Students */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                                <Users size={20} />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{metrics.pulse.totalStudents}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Active Students</p>
                        </div>
                    </div>

                    {/* Card 2: Today's Collection */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                                <IndianRupee size={20} />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(metrics.pulse.todaysCollection)}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Today's Collection</p>
                        </div>
                    </div>

                    {/* Card 3: Pending Claims */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${metrics.pulse.pendingClaims > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                <AlertCircle size={20} />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{metrics.pulse.pendingClaims}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Pending Claims</p>
                        </div>
                    </div>

                    {/* Card 4: Avg Attendance */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <div className="relative z-10">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                                <UserCheck size={20} />
                            </div>
                            <h3 className="text-3xl font-bold text-slate-800">{metrics.pulse.avgAttendance}%</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Avg Attendance (Today)</p>
                        </div>
                    </div>
                </div>

                {/* ZONE 2: THE WALLET */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Area Chart */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-indigo-600" /> Revenue Trend
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Monthly fee package value (Last 6 Months)</p>
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={walletData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        hide={true} // Clean look
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        formatter={(val) => [`₹${val.toLocaleString()}`, "Revenue"]}
                                    />
                                    {/* Monotone for smooth curve */}
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRev)"
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Donut Chart */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                                <PieChart size={18} className="text-emerald-600" /> Recovery
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">Collected vs Pending</p>
                        </div>

                        <div className="h-48 w-full relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePie>
                                    <Pie
                                        data={recoveryData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {recoveryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val) => [`₹${val.toLocaleString()}`]} contentStyle={{ borderRadius: '10px' }} />
                                </RePie>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-slate-400">TOTAL</span>
                                <span className="text-sm font-bold text-slate-800">{formatCurrency(metrics.wallet.collected + metrics.wallet.pending)}</span>
                            </div>
                        </div>

                        <div className="space-y-3 mt-2">
                            <div className="flex justify-between items-center p-2 bg-emerald-50/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-xs font-bold text-slate-600">Collected</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-600">{formatCurrency(metrics.wallet.collected)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-rose-50/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    <span className="text-xs font-bold text-slate-600">Pending</span>
                                </div>
                                <span className="text-xs font-bold text-rose-500">{formatCurrency(metrics.wallet.pending)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ZONE 3 & 4 GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ZONE 3: CLASSROOM (Active Batches) */}
                    <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 text-orange-600 flex items-center gap-2">
                                    <Users size={18} /> Classroom Distribution
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">Student strength by batch</p>
                            </div>
                        </div>

                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={batchData} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none' }}
                                    />
                                    <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]}>
                                        {/* Optional: Add gradient or varying colors */}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ZONE 4: ACTION CENTER */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Clock size={18} className="text-purple-600" /> Action Center
                        </h3>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {metrics.actions.pendingClaimsList.length === 0 && metrics.actions.expiringStudents.length === 0 && (
                                <div className="text-center py-10 text-slate-400 text-xs">No pending actions. Great job!</div>
                            )}

                            {/* Pending Claims */}
                            {metrics.actions.pendingClaimsList.map((item) => (
                                <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 font-bold border border-slate-100">
                                            {item.students?.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{item.students?.name || 'Unknown'}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Claimed ₹{item.amount}</p>
                                        </div>
                                    </div>
                                    <a href="/admin/fees" className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors">
                                        <ArrowUpRight size={16} />
                                    </a>
                                </div>
                            ))}

                            {/* Expiring Students */}
                            {metrics.actions.expiringStudents.map((item) => (
                                <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between group hover:border-amber-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold border border-amber-100">
                                            <Clock size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                            <p className="text-[10px] text-amber-500 font-medium">Renew Subscription</p>
                                        </div>
                                    </div>
                                    <button className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition-colors">
                                        Check
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </AdminLayout>
    );
}

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    CheckCircle,
    XCircle,
    CreditCard,
    Calendar,
    AlertCircle,
    X,
    Info,
    PieChart,
    FileText,
    Clock,
    MapPin,
    Send,
    Loader,
    Hash, // Icon for Ref Number
    TrendingUp,
    BarChart2
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { supabase } from '../supabaseClient';

class ResultErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Chart Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-40 w-full mb-4 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 italic">Chart unavailable</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function StudentPortal() {
    const { secret_id } = useParams();

    // --- STATES ---
    const [student, setStudent] = useState(null);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Academic Data
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ total: 0, present: 0, percentage: 0 });
    const [examResults, setExamResults] = useState([]);
    const [allExamResults, setAllExamResults] = useState([]); // For Summary Chart
    const [upcomingTests, setUpcomingTests] = useState([]);

    // UI States
    const [showPayment, setShowPayment] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Payment Form States
    const [payAmount, setPayAmount] = useState('');
    const [upiRef, setUpiRef] = useState('');
    const [submittingClaim, setSubmittingClaim] = useState(false);

    // --- PROMOTION STATES (NEW) ---
    const [promoSubjects, setPromoSubjects] = useState([]);
    const [selectedPromoSubjects, setSelectedPromoSubjects] = useState([]);
    const [promoting, setPromoting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [secret_id]);

    // --- FETCH PROMOTION SUBJECTS (NEW) ---
    useEffect(() => {
        if (student?.is_promoting && student?.promotion_target_batch) {
            fetchPromoSubjects(student.promotion_target_batch);
        }
    }, [student]);

    async function fetchData() {
        try {
            setLoading(true);

            // --- SECURE RPC CALL ---
            // Instead of 5 separate queries, we call ONE secure function.
            // This function is "SECURITY DEFINER" so it bypasses RLS on the tables,
            // but internally validates the secret_slug.
            const { data, error } = await supabase.rpc('get_student_portal_data', { p_slug: secret_id });

            if (error) throw error;
            if (!data || !data.student) throw new Error("Invalid Student");

            // --- 1. SET STUDENT & INSTITUTE ---
            setStudent({
                ...data.student,
                institutes: data.institute // Attach institute details to student object for UI compatibility
            });

            // --- 2. SET SETTINGS ---
            if (data.settings) setSettings(data.settings);

            // --- 3. SET ATTENDANCE ---
            // RPC return raw rows, we calculate stats here
            const attHistory = data.attendance || [];
            setAttendanceHistory(attHistory.slice(0, 5));

            const workingDays = attHistory.filter(r => r.status !== 'holiday');
            const presentDays = workingDays.filter(r => r.status === 'present');
            const total = workingDays.length;
            const percentage = total > 0 ? Math.round((presentDays.length / total) * 100) : 0;
            setAttendanceStats({ total, present: presentDays.length, percentage });

            // --- 4. SET RESULTS ---
            setExamResults(data.recent_marks || []);
            setAllExamResults(data.all_marks || []);

            // --- 5. SET UPCOMING ---
            setUpcomingTests(data.upcoming_tests || []);

            // Default Pay Amount Logic (Preserved)
            const stud = data.student;
            const pending = (stud.total_fee_package || 0) - (stud.paid_amount || 0);
            if (stud.monthly_installment_plan) {
                setPayAmount('2000');
            } else {
                setPayAmount(pending.toString());
            }

        } catch (err) {
            console.error(err);
            setError("Invalid Link");
        } finally {
            setLoading(false);
        }
    }

    // --- HELPER: Fetch Subjects & Rates ---
    const fetchPromoSubjects = async (batchName) => {
        const { data } = await supabase
            .from('subjects')
            .select('name, default_fee') // <--- NOW FETCHING FEE
            .eq('institute_id', student.institute_id)
            .eq('batch_name', batchName);

        if (data) {
            setPromoSubjects(data); // <--- Store the whole object {name: 'Math', default_fee: 5000}
        }
    };

    // --- HANDLER: Notify Admin (Updated for RPC) ---
    const handlePaymentClaim = async () => {
        if (!payAmount || parseInt(payAmount) <= 0) return alert("Please enter a valid amount");
        if (!upiRef || upiRef.length < 4) return alert("Please enter the 12-digit UPI Reference Number / Transaction ID");

        setSubmittingClaim(true);
        try {
            const { error } = await supabase.rpc('submit_payment_claim', {
                p_secret_slug: secret_id,
                p_amount: parseInt(payAmount),
                p_upi_ref: upiRef
            });

            if (error) throw error;

            setStudent({ ...student, pending_payment: parseInt(payAmount) });
            setShowPayment(false);
            setUpiRef('');
            alert("Payment Submitted! Admin will verify using your Reference Number.");

        } catch (err) {
            console.error(err);
            alert("Error submitting claim: " + err.message);
        } finally {
            setSubmittingClaim(false);
        }
    };

    // --- PROMOTION HANDLERS (NEW) ---
    const handleConfirmPromotion = async () => {
        if (selectedPromoSubjects.length === 0) return alert("Please select at least one subject.");

        const confirmMsg = `Join ${student.promotion_target_batch} with ${selectedPromoSubjects.length} subjects?`;
        if (!window.confirm(confirmMsg)) return;

        setPromoting(true);
        try {
            const { error } = await supabase.rpc('student_confirm_promotion', {
                p_student_id: student.id,
                p_selected_subjects: selectedPromoSubjects
            });

            if (error) throw error;
            alert(`🎉 Welcome to ${student.promotion_target_batch}!`);
            window.location.reload();

        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setPromoting(false);
        }
    };

    const handleDiscontinue = async () => {
        if (!window.confirm("WARNING: This will cancel your admission. Are you sure you want to Discontinue?")) return;

        setPromoting(true);
        try {
            const { error } = await supabase.rpc('student_discontinue', {
                p_student_id: student.id
            });
            if (error) throw error;
            alert("Admission Discontinued.");
            window.location.reload();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setPromoting(false);
        }
    };

    const togglePromoSubject = (sub) => {
        setSelectedPromoSubjects(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
    };

    // --- CALCULATIONS ---
    const totalFees = student?.total_fee_package || 0;
    const paidFees = student?.paid_amount || 0;
    const pendingFees = totalFees - paidFees;
    const feeProgress = totalFees > 0 ? (paidFees / totalFees) * 100 : 0;
    const isVerificationPending = student?.pending_payment > 0;

    // --- UPI URL ---
    const getUpiUrl = () => {
        if (!settings?.upi_id) return '';
        const name = encodeURIComponent("Tuition Fees");
        return `upi://pay?pa=${settings.upi_id}&pn=${name}&am=${payAmount}&cu=INR`;
    };

    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiUrl())}`;

    if (loading) return <div className="h-screen flex items-center justify-center text-slate-500 font-medium">Loading Student Portal...</div>;
    if (error || !student) return <div className="p-10 text-center text-rose-500 font-bold bg-rose-50 h-screen flex items-center justify-center">{error || "Student Not Found"}</div>;

    return (
        <div className="min-h-screen bg-slate-50 pb-8 relative font-sans selection:bg-indigo-100">

            {/* --- HERO HEADER --- */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 text-white rounded-b-[2rem] shadow-xl mb-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                    <div>
                        <p className="text-indigo-200 text-[10px] uppercase tracking-widest font-bold mb-1 opacity-90">
                            {student.institutes?.name || 'Student Portal'}
                        </p>
                        <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] backdrop-blur-sm font-medium border border-white/10">
                                {student.batch_name || 'No Batch'}
                            </span>
                            {student.monthly_installment_plan && (
                                <span className="bg-purple-500/30 px-2 py-0.5 rounded text-[10px] backdrop-blur-sm text-purple-100 font-medium border border-purple-400/30 flex items-center gap-1">
                                    <Clock size={10} /> Monthly Plan
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20 overflow-hidden shadow-sm">
                        {student.institutes?.logo_url ? (
                            <img src={student.institutes.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl">🎓</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-4 max-w-md mx-auto space-y-5">

                {/* --- 0. UPCOMING EXAM ALERT --- */}
                {upcomingTests.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 p-3 rounded-xl flex items-center gap-3 relative overflow-hidden shadow-sm">
                        <div className="bg-white p-2 rounded-lg shadow-sm text-orange-600 z-10"><Calendar size={20} /></div>
                        <div className="z-10">
                            <p className="text-[9px] font-bold text-orange-700 uppercase tracking-wide">Upcoming Exam</p>
                            <h3 className="font-bold text-slate-800 text-sm">{upcomingTests[0].name}</h3>
                            <p className="text-[10px] text-slate-600 font-medium mt-0.5">{upcomingTests[0].subject_name} • {new Date(upcomingTests[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <div className="absolute -right-4 -bottom-8 w-20 h-20 bg-orange-400/10 rounded-full blur-xl"></div>
                    </div>
                )}

                {/* --- ERROR: PAYMENT REJECTED ALERT --- */}
                {student.last_payment_status === 'rejected' && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 shadow-sm">
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600 mt-0.5">
                            <XCircle size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-rose-700 text-sm">Payment Declined</h3>
                            {student.last_payment_remarks && (
                                <div className="mt-1.5 bg-white/60 border border-rose-100 p-2 rounded text-xs font-medium text-rose-800 italic">
                                    " {student.last_payment_remarks} "
                                </div>
                            )}
                            <p className="text-xs text-rose-600 mt-1.5 leading-relaxed">
                                Please check your Transaction ID or try again.
                            </p>
                        </div>
                    </div>
                )}

                {/* --- 1. FEE STATUS CARD --- */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><CreditCard size={16} /></div>
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Fee Status</h2>
                    </div>

                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5 font-medium">{student.monthly_installment_plan ? "Installment Due" : "Pending Amount"}</span>
                            <span className={`text-2xl font-bold ${pendingFees > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                                ₹{pendingFees > 0 ? (student.monthly_installment_plan ? "Due Now" : pendingFees.toLocaleString()) : "Paid"}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Total Package</span>
                            <span className="text-xs font-bold text-slate-800">₹{totalFees.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${pendingFees > 0 ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${feeProgress}%` }}></div>
                    </div>

                    {isVerificationPending ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-700">
                                <Clock size={16} />
                                <span className="text-xs font-bold">Verification Pending</span>
                            </div>
                            <span className="text-xs font-bold text-amber-800">₹{student.pending_payment.toLocaleString()}</span>
                        </div>
                    ) : pendingFees > 0 ? (
                        <div className="grid grid-cols-[1.5fr_1fr] gap-3">
                            <button onClick={() => setShowPayment(true)} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs">
                                <span>{student.monthly_installment_plan ? "Pay Installment" : "Pay Full Fees"}</span>
                                <CreditCard size={14} />
                            </button>
                            <button onClick={() => setShowHelp(true)} className="w-full bg-white text-slate-500 border border-slate-200 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-slate-50">
                                <Info size={14} /> Help
                            </button>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 text-emerald-700 text-center py-2.5 rounded-lg font-bold text-xs border border-emerald-100 flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> All Fees Paid! 🎉
                        </div>
                    )}
                </div>

                {/* --- 2. PERFORMANCE ANALYTICS (NEW) --- */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp size={16} /></div>
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Performance Analytics</h2>
                    </div>

                    {allExamResults.length > 0 ? (
                        <>
                            {/* CHART */}
                            <ResultErrorBoundary>
                                <div className="h-40 w-full mb-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={allExamResults.map(r => ({
                                            name: r.tests.name,
                                            score: Math.round((r.marks_obtained / r.tests.total_marks) * 100)
                                        }))}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" hide />
                                            <YAxis hide domain={[0, 100]} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '10px' }}
                                                labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                                formatter={(value) => [`${value}%`, 'Score']}
                                            />
                                            <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </ResultErrorBoundary>

                            {/* STATS */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tests</p>
                                    <p className="text-sm font-bold text-slate-700">{allExamResults.length}</p>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Average</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {Math.round(allExamResults.reduce((acc, curr) => acc + (curr.marks_obtained / curr.tests.total_marks) * 100, 0) / allExamResults.length)}%
                                    </p>
                                </div>
                                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                                    <p className="text-[9px] font-bold text-emerald-600/70 uppercase mb-0.5">Highest</p>
                                    <p className="text-sm font-bold text-emerald-700">
                                        {Math.max(...allExamResults.map(r => Math.round((r.marks_obtained / r.tests.total_marks) * 100)))}%
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-[10px] italic">Not enough data for analytics.</div>
                    )}
                </div>

                {/* --- 3. EXAM RESULTS LIST (RECENT 10) --- */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><FileText size={16} /></div>
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Report Card (Recent)</h2>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Last 10 Tests</span>
                    </div>
                    {examResults.length > 0 ? (
                        <div className="space-y-2">
                            {examResults.map((result, idx) => {
                                const marks = result.marks_obtained;
                                const total = result.tests.total_marks;
                                const percent = (marks / total) * 100;
                                let badgeClass = "text-indigo-600 bg-indigo-50 border-indigo-100";
                                if (percent < 35) badgeClass = "text-rose-600 bg-rose-50 border-rose-100";
                                else if (percent >= 80) badgeClass = "text-emerald-600 bg-emerald-50 border-emerald-100";

                                return (
                                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-50 hover:border-slate-100 transition-colors">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-xs">{result.tests.name}</h3>
                                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{result.tests.subject_name} <span className="mx-1.5 opacity-30">|</span> {new Date(result.tests.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded-md font-bold text-xs border ${badgeClass} min-w-[3.5rem] text-center`}>
                                            {marks} <span className="text-[9px] opacity-70">/ {total}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-[10px] border border-dashed border-slate-200 rounded-lg bg-slate-50/50">No marks updated yet.</div>
                    )}
                </div>

                {/* --- 3. ATTENDANCE & INSIGHTS (NEW) --- */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><PieChart size={16} /></div>
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Attendance Insights</h2>
                    </div>

                    {attendanceStats.total > 0 ? (
                        <>
                            {/* 1. YEARLY STATS GRID */}
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {/* Total Days */}
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Working Days</p>
                                    <p className="text-lg font-bold text-slate-700">{attendanceStats.total}</p>
                                </div>
                                {/* Days Present */}
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                    <p className="text-[9px] font-bold text-emerald-600/70 uppercase mb-1">Present</p>
                                    <p className="text-lg font-bold text-emerald-700">{attendanceStats.present}</p>
                                </div>
                                {/* Attendance % */}
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center relative overflow-hidden">
                                    <div className="relative z-10">
                                        <p className="text-[9px] font-bold text-indigo-600/70 uppercase mb-1">Score</p>
                                        <p className="text-lg font-bold text-indigo-700">{attendanceStats.percentage}%</p>
                                    </div>
                                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-indigo-200/50 rounded-full blur-xl"></div>
                                </div>
                            </div>

                            {/* 2. LAST 5 DAYS TIMELINE */}
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                                    <Calendar size={10} /> Last 5 Days Trend
                                </h3>
                                <div className="flex justify-between items-end">
                                    {[...attendanceHistory].reverse().map((record) => {
                                        const isPresent = record.status === 'present';
                                        const isAbsent = record.status === 'absent';
                                        const isHoliday = record.status === 'holiday';
                                        return (
                                            <div key={record.id} className="flex flex-col items-center gap-2 group">
                                                <div className={`
                                                    w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300
                                                    ${isPresent ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : ''}
                                                    ${isAbsent ? 'bg-rose-50 border-rose-100 text-rose-600' : ''}
                                                    ${isHoliday ? 'bg-amber-50 border-amber-100 text-amber-500' : ''}
                                                `}>
                                                    {isPresent && <CheckCircle size={18} />}
                                                    {isAbsent && <XCircle size={18} />}
                                                    {isHoliday && <Clock size={18} />}
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).split(' ')[0]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                            No attendance records found for this year.
                        </div>
                    )}
                </div>

                {/* --- 4. ABOUT SECTION --- */}
                {settings?.about_text && (
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-2 opacity-60">
                            <MapPin size={14} />
                            <h2 className="text-[10px] font-bold uppercase tracking-wide">About Institute</h2>
                        </div>
                        <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                            {settings.about_text}
                        </div>
                    </div>
                )}
            </div>

            {/* --- PAYMENT MODAL --- */}
            {showPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-800">Make Payment</h2>
                                <p className="text-[10px] text-slate-500">Step 1: Pay via UPI • Step 2: Notify Admin</p>
                            </div>
                            <button onClick={() => setShowPayment(false)} className="p-1.5 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={16} /></button>
                        </div>
                        {settings?.upi_id ? (
                            <div className="text-center space-y-4">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Enter Amount to Pay (₹)</label>
                                    <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full text-center text-2xl font-bold border-b-2 border-indigo-100 focus:border-indigo-500 outline-none pb-1 text-slate-800" />
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block shadow-sm">
                                    <img src={qrCodeImage} alt="Payment QR" className="w-32 h-32 mix-blend-multiply" />
                                </div>
                                <div className="text-left">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                                        <Hash size={10} /> Transaction Ref / UPI ID
                                    </label>
                                    <input type="text" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="e.g. 123456789012" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-2 pt-2">
                                    <a href={getUpiUrl()} className="bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-all text-sm">
                                        <span>Pay ₹{payAmount} via UPI</span>
                                        <CreditCard size={16} />
                                    </a>
                                    <button onClick={handlePaymentClaim} disabled={submittingClaim} className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm mt-4 ${!upiRef ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white active:scale-95'}`}>
                                        {submittingClaim ? <Loader className="animate-spin" size={16} /> : <><Send size={16} /> Submit Claim</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <AlertCircle className="mx-auto text-amber-500 mb-2" size={32} />
                                <p>Admin has not set up UPI yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- PROMOTION POPUP MODAL (NEW) --- */}
            {student?.is_promoting && (
                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                                🚀
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">New Session Started!</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                You are being promoted to <br />
                                <span className="text-indigo-600 font-bold text-lg">{student.promotion_target_batch}</span>
                            </p>
                        </div>

                        {/* Subject Selection */}
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Your Subjects</label>
                            <div className="space-y-2">
                                {promoSubjects.length > 0 ? promoSubjects.map(sub => (
                                    <div
                                        key={sub.name}
                                        onClick={() => togglePromoSubject(sub.name)}
                                        className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all
                                            ${selectedPromoSubjects.includes(sub.name) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'}
                                        `}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${selectedPromoSubjects.includes(sub.name) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                            {selectedPromoSubjects.includes(sub.name) && <CheckCircle size={14} />}
                                        </div>

                                        {/* Name & Price */}
                                        <div className="flex-1 flex justify-between items-center">
                                            <span className="text-sm font-bold text-slate-700">{sub.name}</span>
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                {sub.default_fee > 0 ? `₹${sub.default_fee.toLocaleString()}` : 'Free'}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-xs text-rose-500 italic">No subjects found for this batch. Contact Admin.</p>
                                )}
                            </div>
                        </div>

                        {/* Total Estimator (Optional nice touch) */}
                        {selectedPromoSubjects.length > 0 && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                                <span className="text-xs font-bold text-slate-500">Estimated Annual Fee:</span>
                                <span className="text-sm font-bold text-slate-800">
                                    ₹{promoSubjects
                                        .filter(s => selectedPromoSubjects.includes(s.name))
                                        .reduce((sum, s) => sum + (s.default_fee || 0), 0)
                                        .toLocaleString()
                                    }
                                </span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={handleConfirmPromotion}
                                disabled={promoting || selectedPromoSubjects.length === 0}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {promoting ? 'Updating Profile...' : 'Confirm & Enter Dashboard'}
                            </button>

                            <button
                                onClick={handleDiscontinue}
                                disabled={promoting}
                                className="w-full text-rose-500 text-xs font-bold py-3 hover:bg-rose-50 rounded-xl transition-colors"
                            >
                                ⚠️ I want to Discontinue Admission
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* --- HELP MODAL --- */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base text-slate-800">Instructions</h3>
                            <button onClick={() => setShowHelp(false)} className="bg-slate-100 p-1.5 rounded-full"><X size={16} /></button>
                        </div>
                        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                            <p><strong className="text-slate-800 block mb-0.5">1. Make Payment</strong> Enter the amount and scan QR.</p>
                            <p><strong className="text-slate-800 block mb-0.5">2. Copy Ref Number</strong> Copy the 12-digit UPI Ref No.</p>
                            <p><strong className="text-slate-800 block mb-0.5">3. Paste & Submit</strong> Paste below and click Submit Claim.</p>
                        </div>
                        <button onClick={() => setShowHelp(false)} className="mt-5 w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs">Got it</button>
                    </div>
                </div>
            )}
        </div>
    );
}
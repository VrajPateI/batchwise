import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    Search,
    CheckCircle,
    X,
    CreditCard,
    Calendar,
    AlertCircle,
    MessageCircle,
    ArrowRight,
    Clock,
    ThumbsUp,
    ThumbsDown,
    Hash,
    Loader
} from 'lucide-react';

export default function FeeManager() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('All');
    const [batches, setBatches] = useState([]);

    // Modals
    const [selectedStudent, setSelectedStudent] = useState(null); // For Normal Collection
    const [reviewStudent, setReviewStudent] = useState(null); // For Approval Flow
    const [requestDetails, setRequestDetails] = useState(null); // Stores UPI Ref for the review modal

    const [amount, setAmount] = useState('');
    const [processing, setProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    async function fetchStudents() {
        try {
            setLoading(true);

            // 1. Get Current User
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // 2. Get their Institute ID
            const { data: profile } = await supabase
                .from('profiles')
                .select('institute_id')
                .eq('id', user.id)
                .single();

            if (!profile?.institute_id) throw new Error("No institute linked");

            // 3. Fetch Students ONLY for this Institute
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('institute_id', profile.institute_id) // <--- EXPLICIT FILTER ADDED
                .order('name');

            if (error) throw error;
            setStudents(data);
            const uniqueBatches = ['All', ...new Set(data.map(s => s.batch_name).filter(Boolean))];
            setBatches(uniqueBatches);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    // 1. Add state for the rejection modal
    const [rejectModal, setRejectModal] = useState({ show: false, requestId: null, studentPhone: null });
    const [rejectReason, setRejectReason] = useState("");

    // 2. The function when Admin clicks the Red "Reject" button
    const handleRejectClick = (req) => {
        // Open the modal instead of rejecting immediately
        setRejectModal({ show: true, requestId: req.id, studentPhone: req.students?.parent_phone });
        setRejectReason("Transaction ID incorrect"); // Default text
    };

    // 3. The function to Confirm Rejection (Calls the SQL Function)
    const confirmReject = async () => {
        // 1. Validation
        if (!rejectModal.requestId) return alert("Error: Missing Request ID");
        if (!rejectReason) return alert("Please give a reason.");

        setProcessing(true);

        try {
            // 2. The RPC Call
            const { error } = await supabase.rpc('process_payment_decision', {
                p_request_id: rejectModal.requestId,
                p_status: 'rejected',
                p_remarks: rejectReason
            });

            if (error) throw error;

            // 3. IMPORTANT: Update Local State immediately so Admin sees the change
            // We find the student associated with this request and reset their pending_payment
            const studentIdToUpdate = students.find(s => s.pending_payment > 0 && s.parent_phone === rejectModal.studentPhone)?.id;

            if (studentIdToUpdate) {
                setStudents(prev => prev.map(s =>
                    s.id === studentIdToUpdate
                        ? { ...s, pending_payment: 0, last_payment_status: 'rejected', last_payment_remarks: rejectReason }
                        : s
                ));
            } else {
                // Fallback: Refresh all data if we can't find the student easily
                fetchStudents();
            }

            // 4. WhatsApp Notification
            if (rejectModal.studentPhone) {
                const msg = `Hi, your payment verification failed. Reason: ${rejectReason}. Please check the portal.`;
                const url = `https://wa.me/${rejectModal.studentPhone}?text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank');
            }

            alert("Payment Rejected & Remarks Saved.");

            // 5. Cleanup
            setRejectModal({ show: false, requestId: null, studentPhone: null });
            setRejectReason("");

        } catch (err) {
            console.error("Reject Error:", err);
            alert("Error rejecting payment: " + err.message);
        } finally {
            setProcessing(false);
        }
    };
    // --- 1. HANDLE REVIEW CLICK (Fetch UPI Ref) ---
    const openReviewModal = async (student) => {
        setReviewStudent(student);
        setRequestDetails(null); // Clear previous data

        try {
            // Fetch the pending request for this student to get UPI Ref
            // Note: student.id check is sufficient here since we filtered students above
            const { data, error } = await supabase
                .from('payment_requests')
                .select('*')
                .eq('student_id', student.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // Use maybeSingle to avoid errors if no request exists

            if (data) {
                setRequestDetails(data);
            } else {
                // Fallback if no request record found but status is pending
                setRequestDetails({ upi_ref_id: 'Manual Claim / Not Provided' });
            }
        } catch (err) {
            console.error("Error fetching request details:", err);
            setRequestDetails({ upi_ref_id: 'Error fetching details' });
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!selectedStudent || !amount || parseInt(amount) <= 0) return alert("Invalid amount");
        setProcessing(true);
        try {
            const currentPaid = selectedStudent.paid_amount || 0;
            const payAmount = parseInt(amount);
            const newPaid = currentPaid + payAmount;

            if (newPaid > selectedStudent.total_fee_package) {
                alert(`Error: Amount exceeds total pending fees.`);
                setProcessing(false);
                return;
            }

            // UPDATE: Also set last_payment_status to 'approved' to clear any errors
            const { error } = await supabase.from('students')
                .update({
                    paid_amount: newPaid,
                    last_payment_status: 'approved',
                    pending_payment: 0
                })
                .eq('id', selectedStudent.id);

            if (error) throw error;

            setStudents(students.map(s => s.id === selectedStudent.id ? { ...s, paid_amount: newPaid, last_payment_status: 'approved', pending_payment: 0 } : s));
            setPaymentSuccess({ amount: payAmount, studentName: selectedStudent.name, phone: selectedStudent.parent_phone, newPending: selectedStudent.total_fee_package - newPaid });
            setProcessing(false);
        } catch (error) {
            alert('Error: ' + error.message);
            setProcessing(false);
        }
    };

    // --- 3. APPROVAL LOGIC ---
    const handleApproval = async (approve) => {
        setProcessing(true);
        try {
            // A. Update the 'payment_requests' table
            if (requestDetails && requestDetails.id) {
                await supabase
                    .from('payment_requests')
                    .update({ status: approve ? 'approved' : 'rejected' })
                    .eq('id', requestDetails.id);
            }

            // B. Update the 'students' table
            const updates = {};
            if (approve) {
                const newPaid = (reviewStudent.paid_amount || 0) + (reviewStudent.pending_payment || 0);
                updates.paid_amount = newPaid;
                updates.pending_payment = 0;
                updates.last_payment_status = 'approved';
            } else {
                updates.pending_payment = 0;
                updates.last_payment_status = 'rejected';
            }

            const { error } = await supabase.from('students').update(updates).eq('id', reviewStudent.id);
            if (error) throw error;

            setStudents(students.map(s => s.id === reviewStudent.id ? { ...s, ...updates } : s));

            if (approve) {
                setPaymentSuccess({
                    amount: reviewStudent.pending_payment,
                    studentName: reviewStudent.name,
                    phone: reviewStudent.parent_phone,
                    newPending: reviewStudent.total_fee_package - ((reviewStudent.paid_amount || 0) + reviewStudent.pending_payment)
                });
            } else {
                // Optional: You could show a small toast here
            }

            setReviewStudent(null);
            setRequestDetails(null);

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const closeModals = () => {
        setSelectedStudent(null);
        setReviewStudent(null);
        setAmount('');
        setPaymentSuccess(null);
        setRequestDetails(null);
    };

    const sendWhatsAppReceipt = () => {
        if (!paymentSuccess) return;
        const message = `Dear Parent, Received payment of ₹${paymentSuccess.amount} for ${paymentSuccess.studentName}. Remaining Due: ₹${paymentSuccess.newPending}. Thank you.`;
        // Normalize phone: Ensure it starts with 91 but doesn't double it
        let cleanPhone = paymentSuccess.phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const filteredStudents = students.filter(s => {
        const matchesName = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBatch = selectedBatch === 'All' || s.batch_name === selectedBatch;
        return matchesName && matchesBatch;
    });

    return (
        <AdminLayout>
            <div className="pb-20">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Fee Collection</h1>
                    <p className="text-xs text-slate-500 font-medium">Record payments & verify requests.</p>
                </div>

                {/* FILTERS */}
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm mb-4 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input type="text" placeholder="Search student..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none font-medium text-slate-700" />
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                    {batches.map(batch => (
                        <button key={batch} onClick={() => setSelectedBatch(batch)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedBatch === batch ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{batch}</button>
                    ))}
                </div>

                {/* LIST */}
                <div className="space-y-3">
                    {loading ? <p className="text-center text-slate-400 text-sm py-10">Loading...</p> : filteredStudents.map(student => {
                        const total = student.total_fee_package || 0;
                        const paid = student.paid_amount || 0;
                        const pending = total - paid;
                        const isPaid = pending <= 0;
                        const percentage = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                        const hasPendingClaim = student.pending_payment > 0;

                        return (
                            <div key={student.id} className={`bg-white p-4 rounded-2xl shadow-sm border ${hasPendingClaim ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'} relative overflow-hidden group`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800">{student.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{student.batch_name}</span>
                                            {hasPendingClaim && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200"><Clock size={10} /> Approval Needed</span>}
                                        </div>
                                    </div>

                                    {hasPendingClaim ? (
                                        <button onClick={() => openReviewModal(student)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-amber-200 transition-all flex items-center gap-1.5 animate-pulse">
                                            Review
                                        </button>
                                    ) : isPaid ? (
                                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full border border-emerald-100"><CheckCircle size={20} /></div>
                                    ) : (
                                        <button onClick={() => setSelectedStudent(student)} className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-1.5">
                                            <CreditCard size={16} /> Collect
                                        </button>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <div className="flex justify-between text-[11px] font-bold mb-1.5">
                                        <span className={isPaid ? "text-emerald-600" : "text-indigo-600"}>Paid: ₹{paid.toLocaleString()}</span>
                                        <span className="text-slate-400">Total: ₹{total.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${isPaid ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* --- NORMAL PAYMENT MODAL --- */}
                {selectedStudent && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
                        <div className="bg-white w-full md:max-w-sm rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="font-bold text-lg text-slate-800">Add Payment</h3><p className="text-xs text-slate-500 font-medium">For {selectedStudent.name}</p></div>
                                <button onClick={closeModals} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20} /></button>
                            </div>
                            <form onSubmit={handlePayment}>
                                <div className="mb-8">
                                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Enter Amount</label>
                                    <div className="relative group">
                                        <span className="absolute left-0 top-1 text-3xl font-bold text-slate-300 group-focus-within:text-indigo-600 transition-colors">₹</span>
                                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="w-full text-4xl font-bold p-1 pl-8 border-b-2 border-slate-200 focus:border-indigo-600 focus:outline-none text-slate-800 bg-transparent placeholder:text-slate-200 transition-colors" placeholder="0" />
                                    </div>
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-3 pb-24 sm:pb-0">
                                    <button type="button" onClick={closeModals} className="w-full sm:flex-1 bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                                    <button type="submit" disabled={processing || !amount} className="w-full sm:flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-70 disabled:active:scale-100">{processing ? 'Saving...' : 'Confirm Payment'} {!processing && <ArrowRight size={18} />}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- APPROVAL MODAL --- */}
                {reviewStudent && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
                        <div className="bg-white w-full md:max-w-sm rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                            <div className="flex justify-between items-center mb-6">
                                <div><h3 className="font-bold text-lg text-slate-800">Verify Payment</h3><p className="text-xs text-slate-500 font-medium">Claim by {reviewStudent.name}</p></div>
                                <button onClick={closeModals} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><X size={20} /></button>
                            </div>

                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-6 text-center">
                                <p className="text-xs font-bold text-amber-600 uppercase mb-1">Student Claims To Have Paid</p>
                                <p className="text-3xl font-bold text-amber-800">₹{reviewStudent.pending_payment.toLocaleString()}</p>
                            </div>

                            {/* --- UPI REF DISPLAY --- */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase mb-2">
                                    <span>Transaction Details</span>
                                    {requestDetails ? <span className="text-indigo-600">Synced</span> : <span className="text-slate-300">Fetching...</span>}
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg border border-slate-100 text-slate-400">
                                        <Hash size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">UPI Reference ID</p>
                                        <p className="text-sm font-bold text-slate-700 break-all">
                                            {requestDetails ? requestDetails.upi_ref_id : <Loader className="animate-spin text-slate-400" size={12} />}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pb-24 sm:pb-0">
                                <button onClick={() => handleApproval(true)} disabled={processing} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                    <ThumbsUp size={18} /> Approve & Update
                                </button>
                                {/* Updated Reject Button to Trigger Remark Modal */}
                                <button
                                    onClick={() => {
                                        closeModals(); // Close current review modal
                                        setRejectModal({ show: true, requestId: requestDetails.id, studentPhone: reviewStudent.parent_phone }); // Open Reject Modal
                                    }}
                                    disabled={processing}
                                    className="w-full bg-white text-rose-600 border-2 border-rose-100 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-50 active:scale-95 transition-all"
                                >
                                    <ThumbsDown size={18} /> Reject
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* --- SUCCESS MODAL --- */}
                {paymentSuccess && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
                        <div className="bg-white w-full md:max-w-sm rounded-t-[2rem] md:rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in"><CheckCircle size={32} /></div>
                            <h3 className="text-xl font-bold text-slate-800">Payment Recorded!</h3>
                            <p className="text-sm text-slate-500 mt-1 mb-6">Received ₹{paymentSuccess.amount} for {paymentSuccess.studentName}</p>
                            <div className="space-y-3 pb-24 sm:pb-0">
                                <button onClick={sendWhatsAppReceipt} className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all"><MessageCircle size={20} /> Send Receipt on WhatsApp</button>
                                <button onClick={closeModals} className="w-full bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-200">Close</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
            {/* --- REJECT REASON MODAL (Add this to feemanager.jsx) --- */}
            {rejectModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800">Reject Payment</h3>
                            <button
                                onClick={() => setRejectModal({ show: false, requestId: null, studentPhone: null })}
                                className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-500 mb-4">
                            Please provide a reason for rejection. This will be sent to the student.
                        </p>

                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g., Transaction ID not matching, Amount incorrect..."
                            className="w-full h-24 p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rose-500 resize-none mb-4"
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setRejectModal({ show: false, requestId: null, studentPhone: null })}
                                className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                disabled={processing || !rejectReason}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70"
                            >
                                {processing ? <Loader className="animate-spin" size={18} /> : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
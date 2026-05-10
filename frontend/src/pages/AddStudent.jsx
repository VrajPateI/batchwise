import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    User,
    Phone,
    BookOpen,
    CheckSquare,
    Square,
    Calculator,
    Save,
    Calendar,
    CheckCircle,
    Share2
} from 'lucide-react';

export default function AddStudent() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // --- STATE 1: Data from DB ---
    const [allSubjects, setAllSubjects] = useState([]);
    const [batches, setBatches] = useState([]);

    // --- STATE 2: Form Data ---
    const [formData, setFormData] = useState({
        name: '',
        parent_phone: '',      // <--- CHANGED from 'whatsapp'
        batch_name: '',        // <--- CHANGED from 'batch'
        enrolled_subjects: [],
        discount: 0,
        monthly_installment: false
    });

    // --- STATE 3: Fee Calculations ---
    const [baseFee, setBaseFee] = useState(0);
    const [finalFee, setFinalFee] = useState(0);

    // --- STATE 4: Success Screen ---
    const [successData, setSuccessData] = useState(null);

    // --- 1. LOAD SUBJECTS & BATCHES ---
    useEffect(() => {
        fetchSubjects();
    }, []);

    async function fetchSubjects() {
        const { data, error } = await supabase.from('subjects').select('*');
        if (!error && data) {
            setAllSubjects(data);
            const uniqueBatches = [...new Set(data.map(item => item.batch_name))];
            setBatches(uniqueBatches);
        }
    }

    // --- 2. HANDLE BATCH CHANGE ---
    const handleBatchChange = (e) => {
        const batch = e.target.value;
        setFormData({
            ...formData,
            batch_name: batch,
            enrolled_subjects: [], // Reset subjects
            discount: 0
        });
        setBaseFee(0);
    };

    // --- 3. TOGGLE SUBJECTS ---
    const toggleSubject = (subjectName, fee) => {
        const currentSubjects = formData.enrolled_subjects;
        let newSubjects = [];
        let feeChange = 0;

        if (currentSubjects.includes(subjectName)) {
            newSubjects = currentSubjects.filter(s => s !== subjectName);
            feeChange = -fee;
        } else {
            newSubjects = [...currentSubjects, subjectName];
            feeChange = fee;
        }

        setFormData({ ...formData, enrolled_subjects: newSubjects });
        setBaseFee(prev => prev + feeChange);
    };

    // --- 4. AUTO-CALCULATE FEE ---
    useEffect(() => {
        const total = Math.max(0, baseFee - Number(formData.discount));
        setFinalFee(total);
    }, [baseFee, formData.discount]);

    // --- 5. GENERATE MAGIC SLUG ---
    const generateSlug = () => {
        // e.g., "k92m-x5p1"
        return Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6);
    };

    // --- 6. SUBMIT TO DB ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.batch_name || formData.enrolled_subjects.length === 0) {
            alert("Please fill Name, Batch and select at least one Subject.");
            return;
        }

        setLoading(true);
        try {
            const newSlug = generateSlug();

            // Clean phone number (remove non-digits)
            const cleanPhone = formData.parent_phone.replace(/\D/g, '');

            const { error } = await supabase.from('students').insert({
                name: formData.name,
                parent_phone: cleanPhone,      // <--- Correct Column Name
                batch_name: formData.batch_name, // <--- Correct Column Name
                enrolled_subjects: formData.enrolled_subjects,
                total_fee_package: finalFee,
                monthly_installment_plan: formData.monthly_installment,
                paid_amount: 0,
                secret_slug: newSlug           // <--- Critical for Magic Link
            });

            if (error) throw error;

            // Show Success Screen
            const magicLink = `${window.location.origin}/student/${newSlug}`;
            setSuccessData({
                name: formData.name,
                link: magicLink,
                phone: cleanPhone
            });

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- 7. SHARE ON WHATSAPP ---
    const shareOnWhatsapp = () => {
        if (!successData) return;
        const message = `Namaste! Welcome to TuitionPro. Here is ${successData.name}'s personal dashboard to check fees and results: ${successData.link}`;
        let cleanPhone = successData.phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const currentBatchSubjects = allSubjects.filter(s => s.batch_name === formData.batch_name);

    return (
        <AdminLayout>
            <div className="pb-20">

                {/* PAGE HEADER */}
                <div className="mb-4">
                    <h1 className="text-xl font-bold text-slate-800">New Admission</h1>
                    <p className="text-xs text-slate-500">Create profile & set fee package.</p>
                </div>

                {/* --- CONDITIONAL RENDER: FORM vs SUCCESS --- */}
                {successData ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center shadow-lg animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-emerald-800 mb-1">Admission Confirmed!</h2>
                        <p className="text-xs text-emerald-600 mb-6">Student profile created successfully.</p>

                        <div className="bg-white p-3 rounded-xl border border-emerald-200 mb-6 shadow-sm">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Magic Link Generated</p>
                            <code className="text-xs font-mono text-slate-700 break-all select-all block">
                                {successData.link}
                            </code>
                        </div>

                        <button
                            onClick={shareOnWhatsapp}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-transform active:scale-95"
                        >
                            <Share2 size={20} /> Share on WhatsApp
                        </button>

                        <button
                            onClick={() => {
                                setSuccessData(null);
                                setFormData({
                                    name: '', parent_phone: '', batch_name: '', enrolled_subjects: [], discount: 0, monthly_installment: false
                                });
                                setBaseFee(0);
                            }}
                            className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-800 underline"
                        >
                            + Add Another Student
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* 1. PERSONAL DETAILS */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                <User size={12} /> Student Details
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Full Name</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full text-sm p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Rahul Sharma"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Parent's WhatsApp</label>
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                        <input
                                            required
                                            type="tel"
                                            maxLength={10}
                                            className="w-full text-sm p-2 pl-9 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                            placeholder="98765xxxxx"
                                            value={formData.parent_phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                setFormData({ ...formData, parent_phone: val });
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. ACADEMIC SELECTION */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                <BookOpen size={12} /> Course Selection
                            </h3>

                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-slate-600 mb-1">Select Batch</label>
                                <select
                                    required
                                    className="w-full text-sm p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                                    value={formData.batch_name}
                                    onChange={handleBatchChange}
                                >
                                    <option value="">-- Choose Class --</option>
                                    {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            {formData.batch_name && (
                                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                    {currentBatchSubjects.map((sub) => {
                                        const isSelected = formData.enrolled_subjects.includes(sub.name);
                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => toggleSubject(sub.name, sub.default_fee)}
                                                className={`cursor-pointer p-2 rounded-lg border flex flex-col justify-between transition-all ${isSelected ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{sub.name}</span>
                                                    {isSelected ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-300" />}
                                                </div>
                                                <span className="text-[10px] text-slate-500 mt-1">₹{sub.default_fee}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 3. FEE CALCULATOR */}
                        {formData.batch_name && (
                            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    <Calculator size={12} /> Fee Package
                                </h3>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Base Total</span>
                                        <span>₹{baseFee}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">Discount (₹)</span>
                                        <input
                                            type="number"
                                            className="w-20 p-1 text-right text-black rounded text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                                            value={formData.discount}
                                            onChange={e => setFormData({ ...formData, discount: e.target.value })}
                                        />
                                    </div>

                                    <div className="h-px bg-slate-700 my-2"></div>

                                    <div className="flex justify-between items-center font-bold text-lg">
                                        <span className="text-emerald-400">Final Package</span>
                                        <span>₹{finalFee}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} className="text-indigo-400" />
                                        <div>
                                            <p className="text-xs font-bold">Monthly Installments</p>
                                            <p className="text-[9px] text-slate-400">Allow parent to pay part-by-part</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.monthly_installment}
                                            onChange={e => setFormData({ ...formData, monthly_installment: e.target.checked })}
                                        />
                                        <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* SUBMIT BUTTON */}
                        <button
                            disabled={loading}
                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                            {loading ? 'Processing...' : (
                                <>
                                    <Save size={18} /> Confirm Admission
                                </>
                            )}
                        </button>

                    </form>
                )}
            </div>
        </AdminLayout>
    );
}
import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    ArrowRight,
    CheckSquare,
    Square,
    CheckCircle,
    ArrowUpRight,
    Send,
    TrendingUp
} from 'lucide-react';

export default function PromotePage() {
    const [loading, setLoading] = useState(false);
    const [instituteId, setInstituteId] = useState(null);

    // Lists
    const [existingBatches, setExistingBatches] = useState([]); // Source
    const [targetBatches, setTargetBatches] = useState([]);     // Destination

    // Selection
    const [sourceBatch, setSourceBatch] = useState('');
    const [targetBatch, setTargetBatch] = useState('');

    // Data
    const [students, setStudents] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('institute_id').eq('id', user.id).single();

            if (profile) {
                setInstituteId(profile.institute_id);
                fetchMetaData(profile.institute_id);
            }
        };
        init();
    }, []);

    const fetchMetaData = async (instId) => {
        // 1. Source Batches (From Students Table)
        const { data: sourceData } = await supabase
            .from('students')
            .select('batch_name')
            .eq('institute_id', instId);

        if (sourceData) {
            setExistingBatches([...new Set(sourceData.map(i => i.batch_name))].filter(Boolean));
        }

        // 2. Target Batches (From SUBJECTS Table - Single Source of Truth)
        const { data: targetData } = await supabase
            .from('subjects')
            .select('batch_name')
            .eq('institute_id', instId);

        if (targetData) {
            setTargetBatches([...new Set(targetData.map(i => i.batch_name))].filter(Boolean));
        }
    };

    // Fetch Students for Source Batch
    useEffect(() => {
        if (!sourceBatch || !instituteId) return;
        const loadStudents = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('students')
                .select('id, name, is_promoting, total_fee_package, paid_amount') // Fetch financial data for surplus check
                .eq('institute_id', instituteId)
                .eq('batch_name', sourceBatch)
                .order('name');
            if (data) {
                setStudents(data);
                setSelectedIds([]);
            }
            setLoading(false);
        };
        loadStudents();
    }, [sourceBatch, instituteId]);

    const toggleSelectAll = () => setSelectedIds(selectedIds.length === students.length ? [] : students.map(s => s.id));
    const toggleStudent = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // --- ENABLE PROMOTION HANDLER ---
    const handleEnablePromotion = async () => {
        if (!targetBatch || selectedIds.length === 0) return alert("Select Target Batch and Students.");

        const confirmMsg = `Enable promotion for ${selectedIds.length} students to join "${targetBatch}"? \n\nNote: Any surplus fees will automatically carry forward.`;
        if (!window.confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const { error } = await supabase.rpc('admin_enable_promotion', {
                p_student_ids: selectedIds,
                p_target_batch: targetBatch,
                p_institute_id: instituteId
            });

            if (error) throw error;
            alert("Success! Students will see the popup next time they login.");

            // Refresh List
            setSourceBatch('');
            setTargetBatch('');
            setSelectedIds([]);
            setStudents([]);
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="pb-32 lg:pb-12 max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <ArrowUpRight className="text-indigo-600" /> Batch Promotion
                    </h1>
                    <p className="text-xs text-slate-500 font-medium ml-8">Enable students to upgrade themselves.</p>
                </div>

                {/* CONTROLS */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Current Batch</label>
                        <select className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" value={sourceBatch} onChange={e => setSourceBatch(e.target.value)}>
                            <option value="">Select...</option>
                            {existingBatches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center justify-center"><ArrowRight className="text-slate-300" /></div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Target Batch</label>
                        <select className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-sm text-indigo-900" value={targetBatch} onChange={e => setTargetBatch(e.target.value)}>
                            <option value="">Select Destination...</option>
                            {targetBatches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {targetBatches.length === 0 && <p className="text-[10px] text-slate-400 mt-1 italic">Add subjects to a new batch to see it here.</p>}
                    </div>
                </div>

                {/* LIST */}
                {sourceBatch && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
                        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                                {selectedIds.length === students.length ? <CheckSquare /> : <Square />} Select All
                            </button>
                            <span className="text-xs text-slate-500">{selectedIds.length} Selected</span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
                            {students.map(student => {
                                const surplus = (student.paid_amount || 0) - (student.total_fee_package || 0);
                                const hasSurplus = surplus > 0;

                                return (
                                    <div key={student.id} onClick={() => toggleStudent(student.id)} className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center ${selectedIds.includes(student.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            {selectedIds.includes(student.id) ? <CheckCircle className="text-indigo-600" size={20} /> : <Square className="text-slate-300" size={20} />}
                                            <div>
                                                <p className="font-bold text-sm text-slate-700">{student.name}</p>
                                                {/* STATUS BADGES */}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {student.is_promoting && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold">Pending Student Action</span>}

                                                    {/* SURPLUS INDICATOR */}
                                                    {hasSurplus && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded font-bold flex items-center gap-1">
                                                            <TrendingUp size={10} /> Credit: ₹{surplus} (Will Carry Forward)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ACTION BUTTON */}
                {selectedIds.length > 0 && (
                    <div className="fixed bottom-24 left-6 right-6 md:relative md:bottom-auto md:left-auto md:right-auto z-40">
                        <button onClick={handleEnablePromotion} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                            {loading ? 'Saving...' : <><Send size={18} /> Enable Student Popups</>}
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
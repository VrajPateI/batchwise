import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    CreditCard,
    Save,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    BookOpen
} from 'lucide-react';

export default function SettingsPage() {
    // --- STATE 1: APP SETTINGS ---
    const [appSettings, setAppSettings] = useState({ upi_id: '', payment_link: '', about_text: '' });
    const [appSettingsId, setAppSettingsId] = useState(null);
    const [instituteId, setInstituteId] = useState(null); // <--- Store Institute ID
    const [appLoading, setAppLoading] = useState(false);
    const [showAppSettings, setShowAppSettings] = useState(false);

    // --- STATE 2: BATCHES & SUBJECTS ---
    const [subjects, setSubjects] = useState([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [expandedBatch, setExpandedBatch] = useState(null);

    // New Batch Creation State
    const [isCreatingBatch, setIsCreatingBatch] = useState(false);
    const [newBatchName, setNewBatchName] = useState("");

    // --- INITIAL LOAD ---
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // 1. Get Institute ID for the logged-in user
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('institute_id')
                    .eq('id', user.id)
                    .single();

                if (profile?.institute_id) {
                    setInstituteId(profile.institute_id);
                    fetchAppSettings(profile.institute_id);
                    fetchSubjects(profile.institute_id);
                }
            }
        };
        init();
    }, []);

    // ------------------------------------------
    // PART 1: APP SETTINGS LOGIC (UPI/LINKS)
    // ------------------------------------------
    async function fetchAppSettings(instId) {
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('*')
                .eq('institute_id', instId) // <--- Specific Filter
                .single();

            if (data) {
                setAppSettings({
                    upi_id: data.upi_id || '',
                    payment_link: data.payment_link || '',
                    about_text: data.about_text || ''
                });
                setAppSettingsId(data.id);
            }
        } catch (error) {

        }
    }

    const saveAppSettings = async (e) => {
        e.preventDefault();
        setAppLoading(true);
        try {
            const updates = {
                ...appSettings,
                institute_id: instituteId, // <--- Ensure it links to institute
                updated_at: new Date()
            };

            // If we have an ID, update that specific row. If not, it creates a new one.
            if (appSettingsId) updates.id = appSettingsId;

            // Upsert looks for a match on the Primary Key (id) OR a Unique Constraint (institute_id)
            const { data, error } = await supabase
                .from('app_settings')
                .upsert(updates, { onConflict: 'institute_id' }) // <--- Prevent Duplicates
                .select()
                .single();

            if (error) throw error;
            if (data) setAppSettingsId(data.id);
            alert("App settings saved successfully!");
        } catch (error) {
            alert("Error saving settings: " + error.message);
        }
        setAppLoading(false);
    };

    // ------------------------------------------
    // PART 2: ACADEMIC LOGIC (BATCHES/SUBJECTS)
    // ------------------------------------------
    async function fetchSubjects(instId) {
        setLoadingSubjects(true);
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('institute_id', instId) // <--- Secure Filter
            .order('batch_name');

        if (!error) setSubjects(data || []);
        setLoadingSubjects(false);
    }

    const groupedBatches = subjects.reduce((acc, subject) => {
        const batch = subject.batch_name;
        if (!acc[batch]) acc[batch] = [];
        acc[batch].push(subject);
        return acc;
    }, {});

    // --- CRUD OPERATIONS ---

    // 1. ADD NEW BATCH
    const handleCreateBatch = async () => {
        if (!newBatchName.trim()) return;
        const { error } = await supabase.from('subjects').insert({
            name: "New Subject",
            batch_name: newBatchName,
            institute_id: instituteId, // <--- Link to Institute
            default_fee: 0
        });
        if (!error) {
            setNewBatchName("");
            setIsCreatingBatch(false);
            fetchSubjects(instituteId);
        }
    };

    // 2. ADD SUBJECT TO EXISTING BATCH
    const handleAddSubject = async (batchName) => {
        const { error } = await supabase.from('subjects').insert({
            name: "New Subject",
            batch_name: batchName,
            institute_id: instituteId, // <--- Link to Institute
            default_fee: 0
        });
        if (!error) fetchSubjects(instituteId);
    };

    // 3. UPDATE SUBJECT (Live Edit)
    const handleUpdateSubject = async (id, field, value) => {
        const updatedSubjects = subjects.map(s => s.id === id ? { ...s, [field]: value } : s);
        setSubjects(updatedSubjects);

        await supabase.from('subjects').update({ [field]: value }).eq('id', id);
    };

    // 4. DELETE SUBJECT
    const handleDeleteSubject = async (id) => {
        if (!window.confirm("Delete this subject?")) return;
        await supabase.from('subjects').delete().eq('id', id);
        fetchSubjects(instituteId);
    };

    // 5. DELETE ENTIRE BATCH
    const handleDeleteBatch = async (batchName) => {
        if (!window.confirm(`Delete ENTIRE batch "${batchName}" and all its subjects?`)) return;
        await supabase.from('subjects').delete()
            .eq('batch_name', batchName)
            .eq('institute_id', instituteId);
        fetchSubjects(instituteId);
    };

    return (
        <AdminLayout>
            <div className="pb-20"> {/* Padding for scrolling */}

                {/* PAGE TITLE */}
                <div className="mb-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Configurations</h1>
                        <p className="text-[10px] text-slate-500">Fees, Batches & App Data</p>
                    </div>
                </div>

                {/* --- SECTION 1: APP CONFIG (Collapsible) --- */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
                    <button
                        onClick={() => setShowAppSettings(!showAppSettings)}
                        className="w-full flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 transition"
                    >
                        <div className="flex items-center gap-2">
                            <CreditCard size={16} className="text-indigo-600" />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Payment & App Settings</span>
                        </div>
                        {showAppSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showAppSettings && (
                        <form onSubmit={saveAppSettings} className="p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                            {/* UPI */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">UPI ID (for QR Code)</label>
                                <input
                                    type="text"
                                    className="w-full text-xs p-2 rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. tuition@oksbi"
                                    value={appSettings.upi_id}
                                    onChange={e => setAppSettings({ ...appSettings, upi_id: e.target.value })}
                                />
                            </div>
                            {/* About */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">About Institute</label>
                                <textarea
                                    className="w-full text-xs p-2 rounded border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    rows="4"
                                    value={appSettings.about_text}
                                    onChange={e => setAppSettings({ ...appSettings, about_text: e.target.value })}
                                    placeholder="Describe your institute...&#10;• We provide best coaching&#10;• 100% Results"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Tip: Use enters to create new lines.
                                </p>
                            </div>
                            <button disabled={appLoading} className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2">
                                <Save size={14} /> {appLoading ? "Saving..." : "Save Settings"}
                            </button>
                        </form>
                    )}
                </div>

                {/* --- SECTION 2: BATCH MANAGER --- */}
                <div className="flex justify-between items-end mb-2 px-1">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batches & Fees</h2>
                    <button
                        onClick={() => setIsCreatingBatch(!isCreatingBatch)}
                        className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold border border-indigo-100 flex items-center gap-1"
                    >
                        <Plus size={12} /> New Batch
                    </button>
                </div>

                {/* NEW BATCH FORM */}
                {isCreatingBatch && (
                    <div className="bg-indigo-50 p-3 rounded-xl mb-3 border border-indigo-100 flex gap-2">
                        <input
                            autoFocus
                            type="text"
                            className="flex-1 text-xs p-2 rounded border border-indigo-200 outline-none"
                            placeholder="Batch Name (e.g. 11th Commerce)"
                            value={newBatchName}
                            onChange={e => setNewBatchName(e.target.value)}
                        />
                        <button onClick={handleCreateBatch} className="bg-indigo-600 text-white px-3 rounded text-xs font-bold">Add</button>
                    </div>
                )}

                {/* BATCH LIST (ACCORDION) */}
                {loadingSubjects ? (
                    <div className="text-center py-8 text-xs text-slate-400">Loading academic data...</div>
                ) : Object.keys(groupedBatches).length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed rounded-xl">No batches found. Create one!</div>
                ) : (
                    <div className="space-y-3">
                        {Object.keys(groupedBatches).map((batchName) => (
                            <div key={batchName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

                                {/* BATCH HEADER (CLICK TO EXPAND) */}
                                <div
                                    className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${expandedBatch === batchName ? 'bg-indigo-50 border-b border-indigo-100' : 'hover:bg-slate-50'}`}
                                    onClick={() => setExpandedBatch(expandedBatch === batchName ? null : batchName)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${expandedBatch === batchName ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                            <BookOpen size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">{batchName}</h3>
                                            <p className="text-[10px] text-slate-500">{groupedBatches[batchName].length} Subjects</p>
                                        </div>
                                    </div>
                                    {expandedBatch === batchName ? <ChevronUp size={16} className="text-indigo-500" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </div>

                                {/* BATCH CONTENT (SUBJECTS TABLE) */}
                                {expandedBatch === batchName && (
                                    <div className="p-3 bg-white animate-in slide-in-from-top-2">

                                        {/* Table Header */}
                                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">
                                            <div className="col-span-6">Subject</div>
                                            <div className="col-span-4">Fee (₹)</div>
                                            <div className="col-span-2 text-right">Action</div>
                                        </div>

                                        {/* Rows */}
                                        <div className="space-y-2">
                                            {groupedBatches[batchName].map((subject) => (
                                                <div key={subject.id} className="grid grid-cols-12 gap-2 items-center">

                                                    {/* Subject Name Input */}
                                                    <div className="col-span-6">
                                                        <input
                                                            type="text"
                                                            className="w-full text-xs font-medium text-slate-700 p-1.5 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-400 outline-none transition-colors"
                                                            value={subject.name}
                                                            onChange={(e) => handleUpdateSubject(subject.id, 'name', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Fee Input */}
                                                    <div className="col-span-4 relative">
                                                        <span className="absolute left-2 top-1.5 text-slate-400 text-[10px]">₹</span>
                                                        <input
                                                            type="number"
                                                            className="w-full text-xs font-mono text-slate-700 p-1.5 pl-4 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:border-indigo-400 outline-none transition-colors"
                                                            value={subject.default_fee}
                                                            onChange={(e) => handleUpdateSubject(subject.id, 'default_fee', e.target.value)}
                                                        />
                                                    </div>

                                                    {/* Delete Button */}
                                                    <div className="col-span-2 text-right">
                                                        <button
                                                            onClick={() => handleDeleteSubject(subject.id)}
                                                            className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                                            <button
                                                onClick={() => handleDeleteBatch(batchName)}
                                                className="text-[10px] text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1"
                                            >
                                                <Trash2 size={12} /> Delete Batch
                                            </button>
                                            <button
                                                onClick={() => handleAddSubject(batchName)}
                                                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-indigo-700 flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Add Subject
                                            </button>
                                        </div>

                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
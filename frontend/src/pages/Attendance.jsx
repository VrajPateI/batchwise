import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    Calendar,
    CheckCircle,
    XCircle,
    Sun,
    Save,
    Users,
    BookOpen,
    Filter,
    Hash // <--- New Icon for Count
} from 'lucide-react';

export default function Attendance() {
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);

    // Metadata States
    const [batches, setBatches] = useState([]);
    const [subjects, setSubjects] = useState([]);

    // Filters
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Attendance Buffer
    const [attendance, setAttendance] = useState({});

    // Institute Context
    const [instituteId, setInstituteId] = useState(null);

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
                    setInstituteId(profile.institute_id);
                    fetchBatches(profile.institute_id);
                }
            }
        };
        init();
    }, []);

    async function fetchBatches(instId) {
        const { data } = await supabase
            .from('subjects')
            .select('batch_name')
            .eq('institute_id', instId);

        if (data) {
            const unique = [...new Set(data.map(i => i.batch_name))];
            setBatches(unique);
            if (unique.length > 0) setSelectedBatch(unique[0]);
        }
    }

    // When Batch Changes -> Fetch Subjects
    useEffect(() => {
        if (selectedBatch && instituteId) {
            fetchSubjectsForBatch();
            setSelectedSubject('All');
        }
    }, [selectedBatch, instituteId]);

    async function fetchSubjectsForBatch() {
        const { data } = await supabase
            .from('subjects')
            .select('name')
            .eq('institute_id', instituteId)
            .eq('batch_name', selectedBatch);

        if (data) {
            const uniqueSub = [...new Set(data.map(s => s.name))];
            setSubjects(uniqueSub);
        }
    }

    // Main Data Fetcher
    useEffect(() => {
        if (selectedBatch && instituteId) fetchStudentsAndAttendance();
    }, [selectedBatch, selectedSubject, selectedDate, instituteId]);

    async function fetchStudentsAndAttendance() {
        setLoading(true);
        try {
            // 1. Get All Students in this Batch
            const { data: allBatchStudents, error } = await supabase
                .from('students')
                .select('id, name')
                .eq('institute_id', instituteId)
                .eq('batch_name', selectedBatch)
                .order('name');

            if (error) throw error;

            let finalStudentList = allBatchStudents || [];

            // 2. APPLY SUBJECT FILTER
            if (selectedSubject !== 'All') {
                const { data: validStudentIds } = await supabase
                    .from('student_subjects')
                    .select('student_id')
                    .eq('institute_id', instituteId)
                    .eq('batch_name', selectedBatch)
                    .eq('subject_name', selectedSubject);

                if (validStudentIds) {
                    const validIdsSet = new Set(validStudentIds.map(v => v.student_id));
                    finalStudentList = finalStudentList.filter(s => validIdsSet.has(s.id));
                }
            }

            // 3. Get Existing Attendance
            const { data: attData } = await supabase
                .from('attendance')
                .select('student_id, status')
                .eq('institute_id', instituteId)
                .eq('batch_name', selectedBatch)
                .eq('date', selectedDate);

            // 4. Merge Data
            const buffer = {};
            finalStudentList.forEach(s => buffer[s.id] = 'present');

            if (attData) {
                attData.forEach(a => {
                    if (buffer[a.student_id]) {
                        buffer[a.student_id] = a.status;
                    }
                });
            }

            setStudents(finalStudentList);
            setAttendance(buffer);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const mark = (id, status) => {
        setAttendance(prev => ({ ...prev, [id]: status }));
    };

    const markAll = (status) => {
        const newBuffer = { ...attendance };
        students.forEach(s => newBuffer[s.id] = status);
        setAttendance(newBuffer);
    };

    const handleSave = async () => {
        setLoading(true);
        const upsertData = students.map(s => ({
            student_id: s.id,
            institute_id: instituteId,
            batch_name: selectedBatch,
            date: selectedDate,
            status: attendance[s.id]
        }));

        if (upsertData.length === 0) {
            alert("No students to save.");
            setLoading(false);
            return;
        }

        const { error } = await supabase
            .from('attendance')
            .upsert(upsertData, { onConflict: 'student_id, date' });

        setLoading(false);
        if (error) alert("Error: " + error.message);
        else alert("Attendance Saved! ✅");
    };

    return (
        <AdminLayout>
            <div className="pb-40">

                {/* HEADER */}
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Attendance</h1>
                        <p className="text-xs text-slate-500">Filtered by Batch & Subject</p>
                    </div>

                    {/* --- NEW: HEAD COUNT BADGE --- */}
                    <div className="hidden md:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg shadow-slate-200">
                        <Hash size={18} className="text-slate-400" />
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Head Count</p>
                            <p className="text-lg font-bold leading-none">{students.length}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="hidden md:flex bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 items-center gap-2 active:scale-95 transition-transform"
                    >
                        <Save size={18} /> {loading ? "Saving..." : "Save"}
                    </button>
                </div>

                {/* FILTERS CARD */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><Calendar size={10} /> Date</label>
                            <input type="date" className="w-full font-bold text-slate-700 outline-none border-b border-slate-200 pb-1 text-[12px] bg-transparent" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><Users size={10} /> Batch</label>
                            <select className="w-full font-bold text-slate-700 outline-none border-b border-slate-200 pb-1 bg-transparent text-[12px]" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                                {batches.length === 0 && <option>No Batches</option>}
                                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><BookOpen size={10} /> Subject Filter</label>
                            <select className={`w-full font-bold outline-none border-b pb-1 bg-transparent text-[12px] transition-colors ${selectedSubject !== 'All' ? 'text-indigo-600 border-indigo-200' : 'text-slate-700 border-slate-200'}`} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                                <option value="All">Show All Students</option>
                                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* --- MOBILE HEAD COUNT --- */}
                <div className="flex md:hidden justify-between items-center mb-4 px-1">
                    <div className="text-xs font-bold text-slate-500">
                        Total Students: <span className="text-slate-900 text-base">{students.length}</span>
                    </div>
                </div>

                {/* ACTIONS & LIST */}
                {students.length > 0 && (
                    <div className="flex justify-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                        <button onClick={() => markAll('present')} className="whitespace-nowrap text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 hover:bg-emerald-100 transition">All Present</button>
                        <button onClick={() => markAll('absent')} className="whitespace-nowrap text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 hover:bg-rose-100 transition">All Absent</button>
                    </div>
                )}

                <div className="space-y-2">
                    {students.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Filter className="mx-auto mb-2 opacity-50" size={24} />
                            <p className="text-sm font-bold">No students found.</p>
                            <p className="text-[10px] mt-1">Try changing the Subject Filter or Batch.</p>
                        </div>
                    ) : (
                        students.map((student) => {
                            const status = attendance[student.id] || 'present';
                            return (
                                <div key={student.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center hover:border-indigo-200 transition-colors animate-in slide-in-from-bottom-2">
                                    <span className="font-semibold text-slate-700 text-sm truncate pr-2">{student.name}</span>
                                    <div className="flex gap-1 bg-slate-50 p-1 rounded-lg shrink-0">
                                        <button onClick={() => mark(student.id, 'present')} className={`p-2 rounded-md transition-all ${status === 'present' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><CheckCircle size={18} /></button>
                                        <button onClick={() => mark(student.id, 'absent')} className={`p-2 rounded-md transition-all ${status === 'absent' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}><XCircle size={18} /></button>
                                        <button onClick={() => mark(student.id, 'holiday')} className={`p-2 rounded-md transition-all ${status === 'holiday' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400'}`}><Sun size={18} /></button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                <div className="fixed bottom-24 left-0 right-0 px-6 md:hidden z-40">
                    <button onClick={handleSave} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        {loading ? 'Saving...' : <><Save size={20} /> Save Attendance</>}
                    </button>
                </div>

            </div>
        </AdminLayout>
    );
}
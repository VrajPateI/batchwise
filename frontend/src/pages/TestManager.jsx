import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import {
    Plus,
    Calendar,
    ChevronRight,
    Save,
    X,
    MessageCircle,
    Copy,
    Users,
    AlertCircle
} from 'lucide-react';

export default function TestManager() {
    const [loading, setLoading] = useState(false);
    const [tests, setTests] = useState([]);

    // --- MODES ---
    // 'LIST', 'CREATE', 'GRADE'
    const [viewMode, setViewMode] = useState('LIST');

    // --- INSTITUTE STATE ---
    const [instituteId, setInstituteId] = useState(null);

    // --- CREATE TEST STATE ---
    const [batches, setBatches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filteredSubjects, setFilteredSubjects] = useState([]);
    const [newTest, setNewTest] = useState({
        name: '',
        date: new Date().toISOString().split('T')[0],
        batch_name: '',
        subject_name: '',
        total_marks: 20
    });

    // --- GRADING STATE ---
    const [selectedTest, setSelectedTest] = useState(null);
    const [studentsForTest, setStudentsForTest] = useState([]);
    const [marksBuffer, setMarksBuffer] = useState({}); // { student_id: marks }

    // --- INITIAL LOAD ---
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
                    fetchTests(profile.institute_id);
                    fetchMetaData(profile.institute_id);
                }
            }
        };
        init();
    }, []);

    // 1. FETCH ALL TESTS (Secure)
    async function fetchTests(instId) {
        setLoading(true);
        const { data, error } = await supabase
            .from('tests')
            .select('*')
            .eq('institute_id', instId) // <--- SECURE FILTER
            .order('date', { ascending: false });
        if (!error) setTests(data || []);
        setLoading(false);
    }

    // 2. FETCH DROPDOWN DATA (Secure)
    async function fetchMetaData(instId) {
        const { data } = await supabase
            .from('subjects')
            .select('*')
            .eq('institute_id', instId); // <--- SECURE FILTER

        if (data) {
            setSubjects(data);
            const uniqueBatches = [...new Set(data.map(s => s.batch_name))];
            setBatches(uniqueBatches);
        }
    }

    // 3. HANDLE BATCH SELECTION
    const handleBatchSelect = (batch) => {
        setNewTest({ ...newTest, batch_name: batch, subject_name: '' });
        const relevant = subjects.filter(s => s.batch_name === batch);
        setFilteredSubjects(relevant);
    };

    // 4. CREATE NEW TEST (Secure)
    const handleCreateTest = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Add institute_id to the new test object
        const testToCreate = {
            ...newTest,
            institute_id: instituteId
        };

        const { error } = await supabase.from('tests').insert(testToCreate);

        if (!error) {
            fetchTests(instituteId); // Refresh list
            setViewMode('LIST');
            setNewTest({
                name: '',
                date: new Date().toISOString().split('T')[0],
                batch_name: '',
                subject_name: '',
                total_marks: 20
            });
        } else {
            alert(error.message);
        }
        setLoading(false);
    };

    // 5. OPEN GRADING MODE (Secure)
    const openGrading = async (test) => {
        setSelectedTest(test);
        setViewMode('GRADE');
        setLoading(true);

        try {
            // A. Get Students (Secure)
            const { data: students } = await supabase
                .from('students')
                .select('id, name, parent_phone')
                .eq('institute_id', instituteId) // <--- SECURE FILTER
                .eq('batch_name', test.batch_name)
                .order('name');

            // B. Get Existing Marks (Secure)
            // Note: RLS on exam_marks should handle security, but explicit filtering is safer
            const { data: existingMarks } = await supabase
                .from('exam_marks')
                .select('student_id, marks_obtained')
                .eq('institute_id', instituteId) // <--- SECURE FILTER
                .eq('test_id', test.id);

            // C. Map to Buffer
            const initialBuffer = {};
            if (existingMarks) {
                existingMarks.forEach(m => {
                    initialBuffer[m.student_id] = m.marks_obtained;
                });
            }
            setMarksBuffer(initialBuffer);
            setStudentsForTest(students || []);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // 6. HANDLE MARK INPUT (With Validation)
    const updateMark = (studentId, value) => {
        // Allow empty string to clear input
        if (value === '') {
            setMarksBuffer(prev => ({ ...prev, [studentId]: '' }));
            return;
        }

        const numValue = parseFloat(value);
        if (numValue < 0) return;

        setMarksBuffer(prev => ({
            ...prev,
            [studentId]: value
        }));
    };

    // 7. SAVE MARKS (Secure)
    const saveMarks = async () => {
        setLoading(true);

        // Validation Check before saving
        for (const student of studentsForTest) {
            const mark = marksBuffer[student.id];
            if (mark && parseFloat(mark) > selectedTest.total_marks) {
                alert(`Error: Marks for ${student.name} (${mark}) cannot exceed total marks (${selectedTest.total_marks}).`);
                setLoading(false);
                return;
            }
        }

        const upsertData = Object.keys(marksBuffer)
            .filter(studentId => marksBuffer[studentId] !== '' && marksBuffer[studentId] !== undefined)
            .map(studentId => ({
                test_id: selectedTest.id,
                student_id: studentId,
                institute_id: instituteId, // <--- CRITICAL FOR RLS
                marks_obtained: marksBuffer[studentId]
            }));

        if (upsertData.length === 0) {
            setLoading(false);
            return;
        }

        const { error } = await supabase
            .from('exam_marks')
            .upsert(upsertData, { onConflict: 'test_id, student_id' });

        setLoading(false);
        if (error) alert("Error saving: " + error.message);
        else alert("Marks Saved Successfully!");
    };

    // 8. SEND INDIVIDUAL WHATSAPP
    const sendWhatsApp = (student) => {
        const marks = marksBuffer[student.id];
        if (!marks) return alert("Please enter and save marks first.");

        const message = `Dear Parent, ${student.name} scored ${marks}/${selectedTest.total_marks} in the ${selectedTest.subject_name} test (${selectedTest.name}).`;
        const url = `https://wa.me/91${student.parent_phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    // 9. COPY CLASS RESULT (For Group)
    const copyGroupReport = () => {
        let report = `*Result: ${selectedTest.name} (${selectedTest.subject_name})*\n`;
        studentsForTest.forEach(student => {
            const m = marksBuffer[student.id] || 'AB';
            report += `${student.name}: ${m}/${selectedTest.total_marks}\n`;
        });

        navigator.clipboard.writeText(report);
        alert("Class result copied to clipboard! You can paste it in the WhatsApp Group.");
    };

    return (
        <AdminLayout>
            <div className="pb-20">

                {/* --- HEADER --- */}
                {viewMode === 'LIST' && (
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Test Manager</h1>
                            <p className="text-xs text-slate-500">Schedule exams & enter results.</p>
                        </div>
                        <button
                            onClick={() => setViewMode('CREATE')}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                        >
                            <Plus size={16} /> Schedule Test
                        </button>
                    </div>
                )}

                {/* --- MODE 1: CREATE TEST FORM --- */}
                {viewMode === 'CREATE' && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h2 className="font-bold text-lg text-slate-800">New Exam</h2>
                            <button onClick={() => setViewMode('LIST')} className="p-2 bg-slate-50 rounded-full text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTest} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Batch</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                        value={newTest.batch_name}
                                        onChange={(e) => handleBatchSelect(e.target.value)}
                                        required
                                    >
                                        <option value="">Select Batch</option>
                                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Subject</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                        value={newTest.subject_name}
                                        onChange={(e) => setNewTest({ ...newTest, subject_name: e.target.value })}
                                        required
                                        disabled={!newTest.batch_name}
                                    >
                                        <option value="">Select Subject</option>
                                        {filteredSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Test Name</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none"
                                        placeholder="e.g. Unit Test 1"
                                        value={newTest.name}
                                        onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Total Marks</label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none"
                                        value={newTest.total_marks}
                                        onChange={(e) => setNewTest({ ...newTest, total_marks: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none font-sans"
                                    value={newTest.date}
                                    onChange={(e) => setNewTest({ ...newTest, date: e.target.value })}
                                    required
                                />
                            </div>

                            <button disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-md mt-2">
                                {loading ? "Scheduling..." : "Create Schedule"}
                            </button>
                        </form>
                    </div>
                )}

                {/* --- MODE 2: TEST LIST --- */}
                {viewMode === 'LIST' && (
                    <div className="space-y-3">
                        {loading ? <div className="text-center text-slate-400 py-10">Loading exams...</div> :
                            tests.length === 0 ? <div className="text-center text-slate-400 py-10">No tests scheduled.</div> :
                                tests.map((test) => (
                                    <div
                                        key={test.id}
                                        onClick={() => openGrading(test)}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group active:scale-95 transition-transform cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                                                        {test.batch_name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <Calendar size={10} /> {new Date(test.date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-slate-800">{test.name}</h3>
                                                <p className="text-xs text-slate-500 font-medium">{test.subject_name} • {test.total_marks} Marks</p>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-full text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                    </div>
                )}

                {/* --- MODE 3: GRADING INTERFACE --- */}
                {viewMode === 'GRADE' && selectedTest && (
                    <div className="animate-in slide-in-from-bottom-4">
                        {/* Header Sticky */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 sticky top-0 z-20">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h2 className="font-bold text-slate-800">{selectedTest.name}</h2>
                                    <p className="text-xs text-slate-500">Max Marks: {selectedTest.total_marks}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={copyGroupReport}
                                        className="bg-indigo-50 text-indigo-600 p-2 rounded-lg active:scale-95 transition-transform"
                                        title="Copy Class Report"
                                    >
                                        <Copy size={18} />
                                    </button>
                                    <button
                                        onClick={saveMarks}
                                        disabled={loading}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-transform"
                                    >
                                        {loading ? "..." : <><Save size={14} /> Save</>}
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setViewMode('LIST')} className="text-[10px] text-slate-400 underline">
                                Cancel & Go Back
                            </button>
                        </div>

                        {/* Student List Inputs */}
                        <div className="space-y-2">
                            {studentsForTest.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                    <Users size={32} className="mx-auto mb-2 opacity-20" />
                                    <p>No students found in {selectedTest.batch_name}.</p>
                                </div>
                            ) : (
                                studentsForTest.map((student) => {
                                    const currentMark = marksBuffer[student.id] || '';
                                    const isInvalid = parseFloat(currentMark) > selectedTest.total_marks;

                                    return (
                                        <div key={student.id} className={`bg-white p-3 rounded-xl border flex justify-between items-center transition-colors ${isInvalid ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isInvalid ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-slate-700 block">{student.name}</span>
                                                    {isInvalid && <span className="text-[9px] text-red-500 flex items-center gap-1"><AlertCircle size={8} /> Invalid Marks</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="relative w-16">
                                                    <input
                                                        type="number"
                                                        className={`w-full p-2 text-center font-bold rounded-lg border outline-none focus:ring-2 transition-all ${isInvalid ? 'border-red-300 text-red-600 focus:ring-red-200' :
                                                            currentMark === '' ? 'border-slate-200 bg-slate-50' :
                                                                'border-indigo-200 bg-white ring-indigo-100 text-indigo-700'
                                                            }`}
                                                        placeholder="-"
                                                        value={currentMark}
                                                        onChange={(e) => updateMark(student.id, e.target.value)}
                                                    />
                                                </div>

                                                {/* WhatsApp Individual Button */}
                                                <button
                                                    onClick={() => sendWhatsApp(student)}
                                                    className="bg-[#25D366] text-white p-2 rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-transform"
                                                    title="Send via WhatsApp"
                                                >
                                                    <MessageCircle size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
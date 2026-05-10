import React, { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { ScrollReveal } from '../components/ScrollReveal';
import {
    Search,
    RefreshCw,
    ArrowUpDown,
    ExternalLink,
    Trash2,
    Phone,
    BookOpen,
    Edit,
    X,
    Save,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';

export default function StudentList() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    // --- FILTER & PAGINATION STATE ---
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [batchFilter, setBatchFilter] = useState('');
    const [feeStatusFilter, setFeeStatusFilter] = useState('all'); // 'all', 'due', 'paid'

    // --- STATE FOR EDIT MODAL ---
    const [editingStudent, setEditingStudent] = useState(null);
    const [availableBatches, setAvailableBatches] = useState([]); // <--- New state for batches
    const [isUpdating, setIsUpdating] = useState(false);

    // --- 1. FETCH DATA (SECURED FOR MULTI-TENANT) ---
    const fetchStudents = async () => {
        setLoading(true);
        try {
            // A. Get the Current User
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // B. Get their Institute ID
            const { data: profile } = await supabase
                .from('profiles')
                .select('institute_id')
                .eq('id', user.id)
                .single();

            if (!profile?.institute_id) throw new Error("No institute linked to user");

            // C. Fetch Students ONLY for this Institute
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('institute_id', profile.institute_id) // <--- EXPLICIT FILTER
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStudents(data || []);

            // D. Fetch Available Batches (from subjects table)
            const { data: batchData } = await supabase
                .from('subjects')
                .select('batch_name')
                .eq('institute_id', profile.institute_id);

            if (batchData) {
                // Extract unique batch names
                const uniqueBatches = [...new Set(batchData.map(item => item.batch_name))];
                setAvailableBatches(uniqueBatches);
            }

        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    // --- 2. DELETE STUDENT ---
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This will delete all their marks and fee records.`)) return;

        try {
            const { error } = await supabase.from('students').delete().eq('id', id);
            if (error) throw error;
            fetchStudents(); // Refresh list
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    };

    // --- 3. UPDATE STUDENT ---
    const handleUpdate = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from('students')
                .update({
                    name: editingStudent.name,
                    batch_name: editingStudent.batch_name,
                    parent_phone: editingStudent.parent_phone,
                    total_fee_package: editingStudent.total_fee_package
                })
                .eq('id', editingStudent.id);

            if (error) throw error;

            setEditingStudent(null);
            fetchStudents(); // Refresh list to show updates
        } catch (err) {
            alert("Error updating: " + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    // --- 3. SORTING LOGIC ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedStudents = useMemo(() => {
        let sortableStudents = [...students];

        if (sortConfig.key) {
            sortableStudents.sort((a, b) => {
                let aValue, bValue;

                // Handle Calculated "Due" Amount
                if (sortConfig.key === 'due') {
                    aValue = (a.total_fee_package || 0) - (a.paid_amount || 0);
                    bValue = (b.total_fee_package || 0) - (b.paid_amount || 0);
                }
                // Handle Numbers
                else if (['total_fee_package', 'paid_amount'].includes(sortConfig.key)) {
                    aValue = parseFloat(a[sortConfig.key]) || 0;
                    bValue = parseFloat(b[sortConfig.key]) || 0;
                }
                // Handle Text (Name, Batch)
                else {
                    aValue = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
                    bValue = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableStudents;
    }, [students, sortConfig]);

    // --- 4. FILTERING LOGIC ---
    const filteredStudents = sortedStudents.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (student.batch_name && student.batch_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (student.parent_phone && student.parent_phone.includes(searchTerm));

        const matchesBatch = batchFilter ? student.batch_name === batchFilter : true;

        const total = parseFloat(student.total_fee_package) || 0;
        const paid = parseFloat(student.paid_amount) || 0;
        const due = total - paid;

        let matchesFeeStatus = true;
        if (feeStatusFilter === 'due') matchesFeeStatus = due > 0;
        if (feeStatusFilter === 'paid') matchesFeeStatus = due <= 0;

        return matchesSearch && matchesBatch && matchesFeeStatus;
    });

    // --- 5. PAGINATION LOGIC ---
    const totalPages = Math.ceil(filteredStudents.length / pageSize);
    const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Reset page to 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, batchFilter, feeStatusFilter]);

    // Helper Component for Sort Icons
    const SortHeader = ({ label, columnKey, align = "left" }) => (
        <th
            onClick={() => handleSort(columnKey)}
            className={`px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors text-${align} whitespace-nowrap`}
        >
            <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
                {label}
                <ArrowUpDown size={12} className={`text-slate-400 ${sortConfig.key === columnKey ? 'text-indigo-600' : ''}`} />
            </div>
        </th>
    );

    return (
        <AdminLayout>
            <div className="pb-20 flex flex-col h-[calc(100vh-2rem)]">

                {/* HEADER & SEARCH */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Student Database</h1>
                        <p className="text-xs text-slate-500">Manage admissions and fees.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search Name, Batch, Phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={fetchStudents}
                            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
                            title="Refresh List"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="mb-4 flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm">
                        <Filter size={16} />
                        <span className="font-semibold">Filters:</span>
                    </div>
                    
                    <select 
                        value={batchFilter}
                        onChange={(e) => setBatchFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-indigo-500 bg-white"
                    >
                        <option value="">All Batches</option>
                        {availableBatches.map((batch, i) => (
                            <option key={i} value={batch}>{batch}</option>
                        ))}
                    </select>

                    <select 
                        value={feeStatusFilter}
                        onChange={(e) => setFeeStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-indigo-500 bg-white"
                    >
                        <option value="all">All Fee Status</option>
                        <option value="due">Fees Due</option>
                        <option value="paid">Fees Paid (No Dues)</option>
                    </select>

                    <div className="flex-1"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Rows per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-indigo-500 bg-white"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {/* TABLE */}
                {loading ? (
                    <div className="flex justify-center items-center h-64 text-slate-500 text-sm">
                        <RefreshCw className="animate-spin mr-2" size={16} /> Loading students...
                    </div>
                ) : (
                    <ScrollReveal>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left text-xs md:text-sm text-slate-600">
                                    <thead className="bg-slate-50 uppercase text-slate-500 font-bold border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <SortHeader label="Name" columnKey="name" />
                                            <SortHeader label="Batch" columnKey="batch_name" />
                                            <th className="px-4 py-3 whitespace-nowrap">Contact</th>
                                            <SortHeader label="Total Fees" columnKey="total_fee_package" align="right" />
                                            <SortHeader label="Paid" columnKey="paid_amount" align="right" />
                                            <SortHeader label="Due" columnKey="due" align="right" />
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedStudents.length > 0 ? (
                                            paginatedStudents.map((student) => {
                                                const total = parseFloat(student.total_fee_package) || 0;
                                                const paid = parseFloat(student.paid_amount) || 0;
                                                const due = total - paid;
                                                const portalLink = `/student/${student.secret_slug}`;

                                                return (
                                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors group">

                                                        {/* Name */}
                                                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                                            {student.name}
                                                        </td>

                                                        {/* Batch */}
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded-md font-medium w-fit border border-indigo-100">
                                                                <BookOpen size={10} />
                                                                {student.batch_name || "N/A"}
                                                            </span>
                                                        </td>

                                                        {/* Phone */}
                                                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                                                            <div className="flex items-center gap-1">
                                                                <Phone size={12} />
                                                                {student.parent_phone ? (
                                                                    <a href={`tel:${student.parent_phone}`} className="hover:text-indigo-600 hover:underline transition-colors">
                                                                        {student.parent_phone}
                                                                    </a>
                                                                ) : (
                                                                    "-"
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Financials */}
                                                        <td className="px-4 py-3 text-right font-medium">₹{total.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-emerald-600">₹{paid.toLocaleString()}</td>
                                                        <td className={`px-4 py-3 text-right font-bold ${due > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                            ₹{due.toLocaleString()}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button
                                                                    onClick={() => setEditingStudent(student)}
                                                                    className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                    title="Edit Student"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <Link
                                                                    to={portalLink}
                                                                    target="_blank"
                                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Open Student Portal"
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </Link>
                                                                <button
                                                                    onClick={() => handleDelete(student.id, student.name)}
                                                                    className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                    title="Delete Student"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Search size={24} className="opacity-20" />
                                                        <p>No students found.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-slate-500">
                                    Showing {filteredStudents.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} entries
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs text-slate-600 px-2 font-medium">Page {currentPage} of {totalPages || 1}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* --- EDIT STUDENT MODAL --- */}
                {editingStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg text-slate-800">Edit Student</h3>
                                <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Edit Form */}
                            <form onSubmit={handleUpdate} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Student Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingStudent.name}
                                        onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Batch</label>
                                    <input
                                        type="text"
                                        list="batch-suggestions" // <--- Connect to datalist
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingStudent.batch_name || ''}
                                        onChange={e => setEditingStudent({ ...editingStudent, batch_name: e.target.value })}
                                    />
                                    <datalist id="batch-suggestions">
                                        {availableBatches.map((batch, index) => (
                                            <option key={index} value={batch} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Parent Phone</label>
                                    <input
                                        type="tel"
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={editingStudent.parent_phone || ''}
                                        onChange={e => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Total Fee Package (₹)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                        value={editingStudent.total_fee_package || ''}
                                        onChange={e => setEditingStudent({ ...editingStudent, total_fee_package: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingStudent(null)}
                                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition flex justify-center items-center gap-2"
                                    >
                                        <Save size={16} />
                                        {isUpdating ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout >
    );
}
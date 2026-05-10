import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useDashboardMetrics = (instituteId) => {
    const [metrics, setMetrics] = useState({
        pulse: {
            totalStudents: 0,
            todaysCollection: 0,
            pendingClaims: 0,
            avgAttendance: 0
        },
        wallet: {
            revenueTrend: [],
            collected: 0,
            pending: 0
        },
        classroom: {
            batchDistribution: [],
            attendanceHistory: []
        },
        actions: {
            pendingClaimsList: [],
            expiringStudents: []
        }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!instituteId) return;

        const fetchMetrics = async () => {
            try {
                setLoading(true);
                const today = new Date().toISOString().split('T')[0];

                // --- 1. PULSE & WALLET DATA (FROM STUDENTS) ---
                const { data: students, error: studentError } = await supabase
                    .from('students')
                    .select('id, created_at, total_fee_package, paid_amount, batch_name')
                    .eq('institute_id', instituteId);

                if (studentError) throw studentError;

                // Aggregations
                let totalStudents = students.length;
                let totalCollected = 0;
                let totalFee = 0;
                let revenueByMonth = {};
                let batchCounts = {};

                // 6-Month Window
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
                sixMonthsAgo.setDate(1); // Start of month

                students.forEach(s => {
                    totalCollected += (s.paid_amount || 0);
                    totalFee += (s.total_fee_package || 0);

                    // Classroom: Batch Dist
                    const batch = s.batch_name || 'Unassigned';
                    batchCounts[batch] = (batchCounts[batch] || 0) + 1;

                    // Wallet: Revenue Trend (Based on Created At ~ Joining)
                    const joinDate = new Date(s.created_at);
                    if (joinDate >= sixMonthsAgo) {
                        const monthKey = joinDate.toLocaleString('default', { month: 'short' });
                        if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = 0;
                        revenueByMonth[monthKey] += s.total_fee_package || 0;
                    }
                });

                // Format Trend Data
                const monthsOrder = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    monthsOrder.push(d.toLocaleString('default', { month: 'short' }));
                }
                const revenueTrend = monthsOrder.map(m => ({
                    month: m,
                    revenue: revenueByMonth[m] || 0
                }));

                // Format Batch Data
                const batchDistribution = Object.entries(batchCounts).map(([name, count]) => ({ name, count }));

                // --- 2. PULSE: PENDING CLAIMS ---
                const { data: pendingReqs, error: reqError } = await supabase
                    .from('payment_requests')
                    .select('id, amount, student_id, students(name), created_at')
                    .eq('status', 'pending')
                    .eq('students.institute_id', instituteId) // Join filter
                    .order('created_at', { ascending: false });

                // Note: The above join filter relies on Supabase resolving the relation. 
                // If RLS applies nicely, great. If not, we might need to filter manually if 'students' comes back null.
                // Assuming standard setup:

                // --- 3. PULSE: TODAY'S COLLECTION (Approved Requests Updated Today) ---
                // "Today's Collection" -> Sum of requests approved today + explicitly filtered direct entries if possible (none existing).
                const { data: todaysApproved, error: todayError } = await supabase
                    .from('payment_requests')
                    .select('amount')
                    .eq('status', 'approved')
                    .gte('updated_at', `${today}T00:00:00`)
                    .lte('updated_at', `${today}T23:59:59`);

                // Note: If cross-table join failed for pendingReqs, filter here:
                const validPendingReqs = pendingReqs ? pendingReqs.filter(r => r.students) : [];

                const todaysCollection = todaysApproved ? todaysApproved.reduce((sum, r) => sum + (r.amount || 0), 0) : 0;


                // --- 4. PULSE & CLASSROOM: ATTENDANCE ---
                // Avg Attendance Today
                const { data: todayAtt, error: attError } = await supabase
                    .from('attendance')
                    .select('status')
                    .eq('institute_id', instituteId)
                    .eq('date', today);

                let avgAttendance = 0;
                if (todayAtt && todayAtt.length > 0) {
                    const present = todayAtt.filter(r => r.status === 'present').length;
                    avgAttendance = Math.round((present / todayAtt.length) * 100);
                }

                // Attendance Grid (Last 7 Days) - Simplified: Just fetch counts by date
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                const dateStr7 = sevenDaysAgo.toISOString().split('T')[0];

                const { data: histAtt } = await supabase
                    .from('attendance')
                    .select('date, status')
                    .eq('institute_id', instituteId)
                    .gte('date', dateStr7)
                    .order('date', { ascending: true });

                const attHistoryMap = {};
                if (histAtt) {
                    histAtt.forEach(r => {
                        if (!attHistoryMap[r.date]) attHistoryMap[r.date] = { date: r.date, present: 0, absent: 0, total: 0 };
                        attHistoryMap[r.date].total++;
                        if (r.status === 'present') attHistoryMap[r.date].present++;
                        else if (r.status === 'absent') attHistoryMap[r.date].absent++;
                    });
                }
                const attendanceHistory = Object.values(attHistoryMap).sort((a, b) => new Date(a.date) - new Date(b.date));


                // --- 5. ACTION CENTER: EXPIRING SUB (Approx) ---
                // Students joined > 11 months ago
                const elevenMonthsAgo = new Date();
                elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

                const expiringStudents = students
                    .filter(s => new Date(s.created_at) < elevenMonthsAgo)
                    .slice(0, 5)
                    .map(s => ({ ...s, type: 'expiring' }));


                setMetrics({
                    pulse: {
                        totalStudents,
                        todaysCollection,
                        pendingClaims: validPendingReqs.length,
                        avgAttendance
                    },
                    wallet: {
                        revenueTrend,
                        collected: totalCollected,
                        pending: totalFee - totalCollected
                    },
                    classroom: {
                        batchDistribution,
                        attendanceHistory
                    },
                    actions: {
                        pendingClaimsList: validPendingReqs.slice(0, 5).map(r => ({ ...r, type: 'claim' })),
                        expiringStudents
                    }
                });

            } catch (err) {
                console.error("Dashboard Metrics Error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [instituteId]);

    return { metrics, loading, error };
};

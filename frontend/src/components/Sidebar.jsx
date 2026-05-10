import React from 'react';
import { LayoutDashboard, Users, IndianRupee, Settings, LogOut, ArrowUpRight, BookOpen, Clock } from 'lucide-react'; // Added icons
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
        { icon: Users, label: 'Students', path: '/admin/students' },
        { icon: IndianRupee, label: 'Fees', path: '/admin/fees' },
        { icon: Clock, label: 'Attendance', path: '/admin/attendance' },
        { icon: BookOpen, label: 'Tests', path: '/admin/tests' },
        { icon: ArrowUpRight, label: 'Promote', path: '/admin/promote' }, // <--- NEW LINK
        { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col sticky top-0">
            {/* Brand Logo */}
            <div className="p-6 border-b border-slate-100">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    Tuition<span className="text-indigo-600">Pro</span>
                </h1>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${location.pathname === item.path
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <item.icon size={20} />
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-slate-100">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <LogOut size={20} />
                    Sign Out
                </button>
            </div>
        </div>
    );
}

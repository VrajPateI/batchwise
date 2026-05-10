import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function PrivateRoute() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Listen for changes (e.g. if I sign out in another tab)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading Security...</div>;

    // If Session exists, Render the Page (Outlet). If not, Redirect to Login.
    return session ? <Outlet /> : <Navigate to="/login" replace />;
}
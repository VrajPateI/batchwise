import React from 'react';

export default function StatsCard({ title, value, subtext, icon: Icon, trend }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm ring-1 ring-slate-900/5">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
                </div>
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Icon size={20} />
                </div>
            </div>
            <div className="mt-4 flex items-center text-xs">
                <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                    {trend}
                </span>
                <span className="text-slate-400 ml-2">{subtext}</span>
            </div>
        </div>
    );
}
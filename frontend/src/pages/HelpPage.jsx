import React from 'react';
import AdminLayout from '../components/AdminLayout';
import { HiUserAdd, HiCurrencyRupee, HiShare, HiQrcode } from 'react-icons/hi';

export default function HelpPage() {
    return (
        <AdminLayout>
            <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Help & Guide</h1>
                <p className="text-sm text-gray-500">How to use TuitionPro.</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6 pb-20">

                {/* Guide 1: Adding Students */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <HiUserAdd size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">1. How to Onboard a Student</h3>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                Go to the <strong>Add Student</strong> page. Enter their Name, WhatsApp Number, and Total Fees.
                                Once saved, the app generates a <strong>Magic Link</strong>.
                            </p>
                            <div className="mt-3 bg-blue-50/50 p-3 rounded border border-blue-100 text-xs text-blue-800">
                                <strong>Tip:</strong> Share this link via WhatsApp immediately. Parents need this link to see their dashboard.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Guide 2: Payments */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <HiCurrencyRupee size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">2. Collecting Fees</h3>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                When a parent pays you (via UPI or Cash), go to the <strong>Fee Manager</strong> page.
                                Find the student and click <strong>Collect</strong>. Enter the amount you received.
                            </p>
                            <ul className="mt-2 list-disc list-inside text-xs text-gray-500 space-y-1">
                                <li>The Student Portal updates instantly (Red → Green).</li>
                                <li>Your Dashboard revenue stats update automatically.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Guide 3: UPI Setup */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                            <HiQrcode size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">3. Setting up Payments</h3>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                Go to <strong>Settings</strong> and enter your UPI ID (e.g., <code>tuition@oksbi</code>).
                                This will automatically generate a QR Code on the parents' phones when they click "Pay Now".
                            </p>
                        </div>
                    </div>
                </div>

                {/* Support Contact */}
                <div className="text-center pt-6">
                    <p className="text-xs text-gray-400">App Version 1.0.0 • Developed by You</p>
                </div>

            </div>
        </AdminLayout>
    );
}
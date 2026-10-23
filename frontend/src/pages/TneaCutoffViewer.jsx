import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

import { API_BASE_URL } from '../config/apiConfig';

const API_URL = `${API_BASE_URL}/tnea-cutoffs`;

const COMMUNITIES = ['OC', 'BC', 'MBC', 'SC', 'ST'];
const CATEGORIES = ['Engineering', 'Arts', 'Medical'];

export default function TneaCutoffViewer() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [minCutoff, setMinCutoff] = useState('');
    const [maxCutoff, setMaxCutoff] = useState('');
    const [community, setCommunity] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);
    const [error, setError] = useState(null);

    const limitPerPage = 50;
    const years = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        const timer = setTimeout(() => {
            (async () => {
                setLoading(true);
                setError(null);
                try {
                    const res = await axios.get(`${API_URL}/search`, {
                        params: {
                            q: searchQuery,
                            minCutoff: minCutoff || 0,
                            maxCutoff: maxCutoff || 200,
                            community: community.toLowerCase(),
                            year: yearFilter,
                            course_category: categoryFilter,
                            page: currentPage,
                            limit: limitPerPage,
                        }
                    });

                    setData(res.data.data ?? []);
                    setTotalPages(res.data.totalPages || 1);
                    setTotalRows(res.data.totalRows || 0);
                } catch (err) {
                    console.error('Error fetching TNEA cutoffs:', err);
                    setError('Unable to load cutoff data. Please retry.');
                } finally {
                    setLoading(false);
                }
            })();
        }, 350);

        return () => clearTimeout(timer);
    }, [searchQuery, minCutoff, maxCutoff, community, yearFilter, categoryFilter, currentPage]);

    const resetPageAndReload = (setter) => (value) => {
        setter(value);
        setCurrentPage(1);
    };

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const startItem = totalRows === 0 ? 0 : (currentPage - 1) * limitPerPage + 1;
    const endItem = Math.min(currentPage * limitPerPage, totalRows);

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 text-center">
                    <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">Engineering Cutoff Data Viewer</motion.h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-blue-100">Search and analyze past TNEA counseling cutoffs to predict college chances.</p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 relative z-20 -mt-14 backdrop-blur-md bg-white/90">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Search College or Department</label>
                            <input
                                value={searchQuery}
                                onChange={(e) => resetPageAndReload(setSearchQuery)(e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none transition-shadow"
                                placeholder="Anna University, CSE, etc."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => resetPageAndReload(setCategoryFilter)(e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none bg-white"
                            >
                                <option value="">All Categories</option>
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                            <select
                                value={yearFilter}
                                onChange={(e) => resetPageAndReload(setYearFilter)(e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none bg-white"
                            >
                                <option value="">All Years</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Community</label>
                            <select
                                value={community}
                                onChange={(e) => resetPageAndReload(setCommunity)(e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none bg-white"
                            >
                                <option value="">All Fields</option>
                                {COMMUNITIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
                            <div className="w-1/2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Min Cutoff</label>
                                <input
                                    type="number"
                                    value={minCutoff}
                                    onChange={(e) => resetPageAndReload(setMinCutoff)(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none"
                                    placeholder="0"
                                />
                            </div>
                            <div className="w-1/2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Max Cutoff</label>
                                <input
                                    type="number"
                                    value={maxCutoff}
                                    onChange={(e) => resetPageAndReload(setMaxCutoff)(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2.5 px-3 border outline-none"
                                    placeholder="200"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 gap-2">
                        <h3 className="text-lg font-bold text-gray-800">Search Results</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="bg-indigo-100 text-indigo-800 font-semibold px-3 py-1 rounded-full">{totalRows} records</span>
                            <span>Showing {startItem}–{endItem} of {totalRows}</span>
                        </div>
                    </div>

                    {error && <p className="p-4 text-red-600 font-semibold">{error}</p>}

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">College</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Dept</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-blue-600 uppercase tracking-wider">Year</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-blue-600 uppercase tracking-wider">OC</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider">BC</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-purple-600 uppercase tracking-wider">MBC</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-pink-600 uppercase tracking-wider">SC</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-red-600 uppercase tracking-wider">ST</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-500">Loading records...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-500">No records found.</td></tr>
                                ) : data.map((row, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, delay: idx * 0.01 }}
                                        key={`${row.college_code}-${row.department}-${row._id || idx}`}
                                        className="hover:bg-indigo-50/30 transition-colors duration-150"
                                    >
                                        <td className="px-6 py-4 text-sm text-gray-600">{startItem + idx}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{row.college_code}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900" title={row.college_name}>{row.college_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{row.department}</td>
                                        <td className="px-6 py-4 text-sm text-center text-gray-700">{row.year}</td>
                                        <td className="px-6 py-4 text-sm text-center text-blue-700">{row.oc_cutoff}</td>
                                        <td className="px-6 py-4 text-sm text-center text-indigo-700">{row.bc_cutoff}</td>
                                        <td className="px-6 py-4 text-sm text-center text-purple-700">{row.mbc_cutoff}</td>
                                        <td className="px-6 py-4 text-sm text-center text-pink-700">{row.sc_cutoff}</td>
                                        <td className="px-6 py-4 text-sm text-center text-red-700">{row.st_cutoff}</td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 items-center justify-between bg-gray-50">
                        <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
                        <div className="flex gap-1 flex-wrap">
                            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1 || loading} className="px-3 py-1.5 text-sm font-semibold rounded border bg-white hover:bg-gray-100">First</button>
                            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className="px-3 py-1.5 text-sm font-semibold rounded border bg-white hover:bg-gray-100">Prev</button>
                            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loading} className="px-3 py-1.5 text-sm font-semibold rounded border bg-white hover:bg-gray-100">Next</button>
                            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages || loading} className="px-3 py-1.5 text-sm font-semibold rounded border bg-white hover:bg-gray-100">Last</button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

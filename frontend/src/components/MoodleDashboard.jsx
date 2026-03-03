import React from 'react';
import { LogOut, ExternalLink } from 'lucide-react';

const MoodleDashboard = ({ moodleData, onLogout }) => {
    // On déstructure les données reçues depuis App.jsx
    const { courses, loading, error } = moodleData;

    return (
        <div className="p-4 h-full overflow-y-auto">
            {/* Header Moodle */}

            <header className="flex justify-between items-end border-b-8 border-black pb-4 mb-6">
                                        <h1 className="text-5xl font-black uppercase italic">Moodle</h1>
                                    </header>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                <button 
                    onClick={onLogout} 
                    className="border-4 border-black p-2 font-black bg-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center gap-2 cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all"
                >
                    <LogOut size={18} strokeWidth={3} /> Déconnexion
                </button>
            </div>

            {/* États de chargement et d'erreur */}
            {loading && (
                <div className="border-4 border-black p-8 bg-yellow-300 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-xl font-black uppercase animate-pulse">Chargement de la FOAD...</span>
                </div>
            )}
            
            {error && (
                <div className="border-4 border-black p-8 bg-red-400 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-xl font-black text-white uppercase">{error}</span>
                </div>
            )}

            {/* Grille des cours Brutaliste */}
            {!loading && !error && courses.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
                    {courses.map(course => (
                        <div key={course.id} className="bg-white border-4 border-black flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:translate-x-[-4px] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all">
                            
                            {/* Image du cours */}
                            {course.image ? (
                                <div 
                                    className="w-full h-32 border-b-4 border-black bg-cover bg-center"
                                    style={{ backgroundImage: `url(${course.image})` }}
                                />
                            ) : (
                                <div className="w-full h-32 border-b-4 border-black bg-pink-200 flex items-center justify-center">
                                    <span className="font-black text-4xl opacity-30">📚</span>
                                </div>
                            )}
                            
                            {/* Infos */}
                            <div className="p-4 flex-1 flex flex-col">
                                <span className="text-[10px] font-black text-white bg-black px-2 py-1 uppercase self-start mb-2">
                                    {course.category || "Général"}
                                </span>
                                <h2 className="text-lg font-black leading-tight mb-4">{course.name}</h2>
                                
                                <div className="mt-auto pt-4">
                                    <a 
                                        href={course.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-pink-300 border-2 border-black py-2 font-black uppercase hover:bg-pink-400 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
                                    >
                                        Ouvrir <ExternalLink size={18} strokeWidth={3} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MoodleDashboard; 
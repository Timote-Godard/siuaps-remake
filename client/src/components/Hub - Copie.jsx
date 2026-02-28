import React, { useState, useEffect } from 'react';
import { LogOut, Dumbbell, Mail, BookOpen, MapPin, Clock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EntDashboard from './EntDashboard';

const Hub = ({ studentName, onSelect, onLogout }) => {
    const [isEdtFocus, setIsEdtFocus] = useState(false);
    const [nextCourse, setNextCourse] = useState(null);

    useEffect(() => {
        const fetchNextCourse = async () => {
            const saved = localStorage.getItem('ent_selected_resources');
            if (!saved) return;
            const resources = JSON.parse(saved);
            if (resources.length === 0) return;

            try {
                const ids = resources.map(r => r.id).join(',');
                const res = await fetch(`http://localhost:5000/api/agenda-merged?resources=${ids}`);
                const data = await res.json();
                
                if (data.success && data.agenda.length > 0) {
                    const now = new Date();
                    const upcoming = data.agenda.find(c => new Date(c.fin) > now);
                    setNextCourse(upcoming || data.agenda[0]); 
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchNextCourse();
    }, []);

    const formatTime = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return `${d.getHours()}H${String(d.getMinutes()).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-[#F0F0F0] font-mono selection:bg-yellow-300 relative">
            
            {/* 1. L'ÉCRAN HUB (Reste toujours en fond) */}
            <div className="max-w-3xl mx-auto p-4 sm:p-8 flex flex-col gap-6 relative z-10">
                {/* HEADER */}
                <div className="flex justify-between items-end mb-4 border-b-4 border-black pb-4">
                    <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none">
                        Salut, <br/>
                        <span className="text-blue-600">{studentName?.split(' ')[0]}</span>
                    </h1>
                    <button 
                        onClick={onLogout}
                        className="border-4 border-black p-2 bg-white hover:bg-red-400 hover:text-white transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                        <LogOut size={24} strokeWidth={3} />
                    </button>
                </div>

                {/* GRILLE BENTO BOX */}
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    
                    {/* WIDGET AGENDA (La brique de départ) */}
                    <motion.div 
                        layoutId="edt-container" // 👈 LE LIEN MAGIQUE EST ICI
                        onClick={() => setIsEdtFocus(true)}
                        className="col-span-2 cursor-pointer border-4 border-black bg-yellow-300 p-5 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-shadow flex flex-col justify-between relative overflow-hidden group"
                    >
                        <div className="absolute -right-6 -top-6 bg-black text-yellow-300 p-4 rounded-full group-hover:scale-110 transition-transform duration-300">
                            <ArrowRight size={32} strokeWidth={4} className="mt-4 mr-4" />
                        </div>
                        
                        <span className="bg-black text-white px-3 py-1 text-[10px] sm:text-xs font-black uppercase w-fit mb-4">
                            {nextCourse ? "Prochain Cours" : "Emploi du temps"}
                        </span>
                        
                        <div>
                            <h2 className="text-2xl sm:text-4xl font-black uppercase leading-tight pr-10 mb-4">
                                {nextCourse ? nextCourse.titre : "Ouvrir l'agenda"}
                            </h2>
                            {nextCourse && (
                                <div className="flex items-center gap-4 text-sm sm:text-base font-bold">
                                    <p className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1"><Clock size={16} /> {formatTime(nextCourse.debut)}</p>
                                    <p className="flex items-center gap-1 bg-white border-2 border-black px-2 py-1 truncate max-w-[150px]"><MapPin size={16} /> {nextCourse.salle}</p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* AUTRES WIDGETS */}
                    <button 
                        onClick={() => onSelect('SIUAPS')}
                        className="col-span-1 text-left cursor-pointer border-4 border-black bg-pink-300 p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform flex flex-col justify-between aspect-square sm:aspect-auto sm:h-48 group"
                    >
                        <div className="bg-white border-4 border-black w-12 h-12 flex items-center justify-center rounded-full group-hover:rotate-12 transition-transform mb-auto">
                            <Dumbbell size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-black uppercase mb-1">Sport</h2>
                            <p className="font-bold text-[10px] sm:text-xs uppercase opacity-80">Gérer absences</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => alert("Mails en construction")}
                        className="col-span-1 text-left cursor-pointer border-4 border-black bg-cyan-300 p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform flex flex-col justify-between aspect-square sm:aspect-auto sm:h-48 group relative"
                    >
                        <div className="bg-white border-4 border-black w-12 h-12 flex items-center justify-center rounded-full group-hover:-rotate-12 transition-transform mb-auto">
                            <Mail size={24} strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-black uppercase mb-1">Mails</h2>
                            <p className="font-bold text-[10px] sm:text-xs uppercase opacity-80">Zimbra</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* 2. LE MODE FOCUS (L'arrivée en Plein Écran) */}
            <AnimatePresence>
                {isEdtFocus && (
                    <>
                        {/* Voile gris en arrière plan (optionnel mais propre) */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/10 z-40 backdrop-blur-sm"
                            onClick={() => setIsEdtFocus(false)} // Ferme si on clique à côté
                        />
                        
                        {/* L'EDT Complet qui s'étend */}
                        <motion.div 
                            layoutId="edt-container" // 👈 LE MÊME ID QUE LE WIDGET !
                            className="fixed inset-0 z-50 bg-[#F0F0F0] overflow-y-auto m-0 sm:m-4 sm:border-4 sm:border-black sm:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
                        >
                            <EntDashboard onBack={() => setIsEdtFocus(false)} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
};

export default Hub;
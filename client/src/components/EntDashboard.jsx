import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Loader2, ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import ressources from '../assets/ressources_rennes1.json';

const EntDashboard = ({ onBack }) => {
    // --- ÉTATS ---
    const [selectedResources, setSelectedResources] = useState(() => {
        const saved = localStorage.getItem('ent_selected_resources');
        return saved ? JSON.parse(saved) : [];
    });
    const [agenda, setAgenda] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [now, setNow] = useState(new Date());

    // Gestion de la semaine (Lundi de référence)
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        return monday;
    });

    // Jour mobile (0-4)
    const [currentDayIndex, setCurrentDayIndex] = useState(() => {
        const today = new Date().getDay();
        return (today >= 1 && today <= 5) ? today - 1 : 0;
    });

    // --- PARAMÈTRES GRILLE ---
    const START_HOUR = 8;
    const END_HOUR = 20;
    const HOUR_HEIGHT = 90; // Augmenté pour plus de lisibilité
    const touchStartX = useRef(null);

    // --- LOGIQUE DE NAVIGATION ---
    const goToNext = () => {
        if (window.innerWidth < 768) {
            if (currentDayIndex === 4) {
                const nextMonday = new Date(currentWeekStart);
                nextMonday.setDate(nextMonday.getDate() + 7);
                setCurrentWeekStart(nextMonday);
                setCurrentDayIndex(0);
            } else {
                setCurrentDayIndex(prev => prev + 1);
            }
        } else {
            const next = new Date(currentWeekStart);
            next.setDate(next.getDate() + 7);
            setCurrentWeekStart(next);
        }
    };

    const goToPrev = () => {
        if (window.innerWidth < 768) {
            if (currentDayIndex === 0) {
                const prevMonday = new Date(currentWeekStart);
                prevMonday.setDate(prevMonday.getDate() - 7);
                setCurrentWeekStart(prevMonday);
                setCurrentDayIndex(4);
            } else {
                setCurrentDayIndex(prev => prev - 1);
            }
        } else {
            const prev = new Date(currentWeekStart);
            prev.setDate(prev.getDate() - 7);
            setCurrentWeekStart(prev);
        }
    };

    // --- SWIPE ---
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (!touchStartX.current) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goToNext();
            else goToPrev();
        }
        touchStartX.current = null;
    };

    // --- CALCULS ---
    const daysOfWeek = useMemo(() => {
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            return {
                label: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'][i],
                date: d,
                iso: d.toLocaleDateString('en-CA') // Format YYYY-MM-DD stable
            };
        });
    }, [currentWeekStart]);

    // Positionnement des cours (Sécurisé contre les "Invalid Date")
    const calculateStyles = (startStr, endStr) => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start) || isNaN(end)) return { display: 'none' };

        const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

        return {
            top: `${(startMinutes / 60) * HOUR_HEIGHT}px`,
            height: `${(durationMinutes / 60) * HOUR_HEIGHT}px`,
        };
    };

    // Position de la barre rouge
    const currentTimeTop = useMemo(() => {
        const h = now.getHours();
        const m = now.getMinutes();
        if (h < START_HOUR || h >= END_HOUR) return null;
        return ((h - START_HOUR) * 60 + m) / 60 * HOUR_HEIGHT;
    }, [now]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        localStorage.setItem('ent_selected_resources', JSON.stringify(selectedResources));
        if (selectedResources.length > 0) fetchMergedAgenda();
    }, [selectedResources, currentWeekStart]);

    const fetchMergedAgenda = async () => {
        setLoading(true);
        try {
            const ids = selectedResources.map(r => r.id).join(',');
            const res = await fetch(`http://localhost:5000/api/agenda-merged?resources=${ids}`);
            const data = await res.json();
            if (data.success) setAgenda(data.agenda);
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    return (
        <div className="p-2 sm:p-6 min-h-screen bg-[#F0F0F0] font-mono text-black">
            <div className="max-w-7xl mx-auto">
                
                {/* HEADER DYNAMIQUE : Priorité au jour sur Mobile */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <button onClick={onBack} className="border-2 border-black p-2 font-black uppercase hover:bg-black hover:text-white flex items-center gap-2 transition-all">
                        <ArrowLeft size={18} /> Hub
                    </button>

                    <div className="flex items-center gap-4">
                        <button onClick={goToPrev} className="border-4 border-black p-1 hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 transition-all"><ChevronLeft size={24} /></button>
                        
                        <div className="text-center min-w-[200px]">
                            <span className="font-black uppercase block text-[10px] opacity-60">
                                {window.innerWidth < 768 ? "Planning du jour" : "Aperçu Semaine"}
                            </span>
                            <span className="font-black text-lg sm:text-xl italic uppercase">
                                {window.innerWidth < 768 
                                    ? `${daysOfWeek[currentDayIndex].label} ${daysOfWeek[currentDayIndex].date.getDate()} ${daysOfWeek[currentDayIndex].date.toLocaleDateString('fr-FR', {month:'short'})}`
                                    : `${daysOfWeek[0].date.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} - ${daysOfWeek[4].date.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`
                                }
                            </span>
                        </div>

                        <button onClick={goToNext} className="border-4 border-black p-1 hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 transition-all"><ChevronRight size={24} /></button>
                    </div>

                    <div className="relative w-full md:w-64">
                        <input 
                            type="text" placeholder="Filtrer matieres..." 
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border-2 border-black p-2 font-bold uppercase text-xs outline-none focus:bg-yellow-200"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="h-96 border-4 border-black flex flex-col items-center justify-center bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <Loader2 className="animate-spin mb-4" size={48} />
                        <span className="font-black uppercase italic">Calcul des flux...</span>
                    </div>
                ) : (
                    <div 
                        className="relative flex border-4 border-black bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* ÉCHELLE HORAIRE (ORDONNÉE) */}
                        <div className="w-12 sm:w-20 border-r-4 border-black bg-gray-50 flex-shrink-0 z-20">
                            <div className="h-10 border-b-4 border-black flex items-center justify-center bg-black text-white text-[10px] font-bold">HORAIRE</div>
                            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                <div key={i} style={{ height: HOUR_HEIGHT }} className="relative border-b border-black/5">
                                    <span className="absolute -top-3 left-0 w-full text-center text-[10px] font-black">{(START_HOUR + i)}H</span>
                                </div>
                            ))}
                        </div>

                        {/* GRILLE DES JOURS */}
                        <div className="flex-1 flex overflow-hidden relative">
                            {daysOfWeek.map((day, dIdx) => {
                                const isVisible = window.innerWidth >= 768 || currentDayIndex === dIdx;
                                if (!isVisible) return null;

                                // Filtrage précis des cours pour ce jour spécifique
                                const dayEvents = agenda.filter(e => {
                                    const d = new Date(e.debut);
                                    return d.toLocaleDateString('en-CA') === day.iso;
                                });
                                const isToday = new Date().toLocaleDateString('en-CA') === day.iso;

                                return (
                                    <div key={day.iso} className="flex-1 border-r-2 border-black/10 relative">
                                        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                                            
                                            {/* Lignes de repère horizontales */}
                                            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                                <div key={i} style={{ height: HOUR_HEIGHT }} className="border-b border-black/5 w-full"></div>
                                            ))}

                                            {/* BARRE ROUGE TEMPS RÉEL */}
                                            {isToday && currentTimeTop !== null && (
                                                <div 
                                                    style={{ top: `${currentTimeTop}px` }} 
                                                    className="absolute left-0 w-full h-[2px] bg-red-600 z-30 pointer-events-none flex items-center"
                                                >
                                                    <div className="w-3 h-3 bg-red-600 rounded-full -ml-1.5 border-2 border-black"></div>
                                                </div>
                                            )}

                                            {/* RENDU DES COURS ABSOLUS */}
                                            {dayEvents.map((course, cIdx) => (
                                                <div key={cIdx} 
                                                     style={calculateStyles(course.debut, course.fin)}
                                                     className="absolute left-1 right-1 border-2 border-black bg-white p-1 sm:p-2 overflow-hidden hover:z-40 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-50 transition-all">
                                                    <div className="bg-black text-white text-[8px] px-1 font-bold inline-block mb-1">
                                                        {new Date(course.debut).getHours()}H{String(new Date(course.debut).getMinutes()).padStart(2, '0')}
                                                    </div>
                                                    <h4 className="font-black text-[9px] sm:text-[10px] leading-tight uppercase mb-1 break-words">{course.titre}</h4>
                                                    <div className="flex items-center gap-1 text-[8px] font-bold opacity-60 truncate">
                                                        <MapPin size={8} strokeWidth={3} /> {course.salle}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EntDashboard;
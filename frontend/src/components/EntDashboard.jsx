import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Loader2, ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SetupWizard from './SetupWizard';
import ressources from '../assets/ressources_rennes1.json';

// 🎨 1. PALETTE DE COULEURS NÉOBRUTALISTES
const NEO_COLORS = [
    'bg-pink-300', 'bg-cyan-300', 'bg-green-400', 'bg-purple-300',
    'bg-orange-300', 'bg-blue-300', 'bg-rose-300', 'bg-lime-300', 'bg-yellow-300'
];

const getCourseColor = (title) => {
    if (!title) return 'bg-white';
    const coreTitle = title.split(' ')[0].toLowerCase(); 
    let hash = 0;
    for (let i = 0; i < coreTitle.length; i++) {
        hash = coreTitle.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEO_COLORS.length;
    return NEO_COLORS[index];
};

// 🧠 NOUVEAU : Algorithme de calcul des chevauchements de cours
const layoutEvents = (events) => {
    if (!events || events.length === 0) return [];
    
    // 1. Trier les événements par heure de début
    const sorted = [...events].sort((a, b) => new Date(a.debut) - new Date(b.debut));
    
    // 2. Grouper les événements qui se chevauchent
    let lastEventEnding = null;
    const groups = [];
    let currentGroup = [];

    sorted.forEach(ev => {
        const start = new Date(ev.debut);
        const end = new Date(ev.fin);

        if (lastEventEnding !== null && start >= lastEventEnding) {
            // Pas de chevauchement avec le groupe précédent, on boucle
            groups.push(currentGroup);
            currentGroup = [];
            lastEventEnding = null;
        }

        currentGroup.push(ev);
        if (lastEventEnding === null || end > lastEventEnding) {
            lastEventEnding = end;
        }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    // 3. Assigner des colonnes (gauche/droite) dans chaque groupe
    groups.forEach(group => {
        let columns = [];
        group.forEach(ev => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastEvent = columns[i][columns[i].length - 1];
                if (new Date(lastEvent.fin) <= new Date(ev.debut)) {
                    columns[i].push(ev);
                    ev.column = i;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                ev.column = columns.length;
                columns.push([ev]);
            }
        });

        const numColumns = columns.length;
        group.forEach(ev => {
            ev.numColumns = numColumns; // Nombre total de colonnes pour ce créneau
        });
    });

    return sorted;
};

const EntDashboard = ({ onBack }) => {
    const [selectedResources, setSelectedResources] = useState(() => {
        const saved = localStorage.getItem('ent_selected_resources');
        return saved ? JSON.parse(saved) : [];
    });

    const [showWizard, setShowWizard] = useState(selectedResources.length === 0);
    const [agenda, setAgenda] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [now, setNow] = useState(new Date());
    const [direction, setDirection] = useState(0);

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0,0,0,0);
        return monday;
    });

    const handleSetupComplete = (newSelections) => {
        setSelectedResources(newSelections);
        setShowWizard(false);
    };

    const [currentDayIndex, setCurrentDayIndex] = useState(() => {
        const today = new Date().getDay();
        return (today >= 1 && today <= 5) ? today - 1 : 0;
    });

    const START_HOUR = 8;
    const END_HOUR = 20;
    const HOUR_HEIGHT = 90; 
    const touchStartX = useRef(null);

    const goToNext = () => {
        setDirection(1);
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
        setDirection(-1);
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

    const daysOfWeek = useMemo(() => {
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(currentWeekStart);
            d.setDate(d.getDate() + i);
            return {
                label: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'][i],
                date: d,
                iso: d.toLocaleDateString('en-CA')
            };
        });
    }, [currentWeekStart]);

    // 🌟 MISE À JOUR : calculateStyles utilise la nouvelle structure calculée !
    const calculateStyles = (course) => {
        const start = new Date(course.debut);
        const end = new Date(course.fin);
        if (isNaN(start) || isNaN(end)) return { display: 'none' };

        const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
        const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

        const top = (startMinutes / 60) * HOUR_HEIGHT;
        const height = (durationMinutes / 60) * HOUR_HEIGHT;

        // Positionnement dynamique (Largeur réduite s'il y a des doublons)
        const numCols = course.numColumns || 1;
        const colIdx = course.column || 0;

        return {
            top: `${top}px`,
            height: `${height}px`,
            left: `calc(${(colIdx / numCols) * 100}% + 4px)`,
            width: `calc(${100 / numCols}% - 12px)`, // On laisse 12px pour l'ombre du néobrutalisme
        };
    };

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

    const slideVariants = {
        enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { zIndex: 1, x: 0, opacity: 1 },
        exit: (direction) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0 })
    };

    const animationKey = window.innerWidth < 768 ? currentDayIndex : currentWeekStart.toISOString();

    if (showWizard) {
        return (
            <SetupWizard 
                data={ressources}
                initialSelections={selectedResources}
                onComplete={handleSetupComplete}
                onClose={() => {
                    if (selectedResources.length > 0) setShowWizard(false);
                    else onBack(); 
                }}
            />
        );
    }

    return (
        <div className="p-4 min-h-screen bg-yellow-200 font-mono text-black">
            <div className="max-w-7xl mx-auto">
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <button onClick={onBack} className="self-start md:hidden border-3 border-black p-2 hover:bg-black hover:text-white transition-colors cursor-pointer font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none">
                        <ArrowLeft size={20} />
                    </button>

                    <div className="flex items-center gap-4">
                        <button onClick={goToPrev} className="border-3 border-black p-1 hover:translate-y-[-2px] hover:translate-x-[-2px] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"><ChevronLeft size={24} /></button>
                        
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

                        <button onClick={goToNext} className="border-3 border-black p-1 hover:translate-y-[-2px] hover:translate-x-[-2px] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"><ChevronRight size={24} /></button>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64 flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" placeholder="Filtrer matieres..." 
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full border-2 border-black p-2 pl-8 font-bold uppercase text-xs outline-none focus:bg-yellow-200"
                            />
                        </div>
                        {/* BOUTON SETTINGS DANS LA BARRE SUPERIEURE */}
                        <button onClick={() => setShowWizard(true)} className="border-2 border-black p-2 bg-cyan-300 hover:bg-cyan-400 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                <div 
                    className="relative flex border-3 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }} 
                >
                    <div className="w-12 pt-3 sm:w-20 border-r-2 border-black bg-gray-50 flex-shrink-0 z-20">
                        {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                            <div key={i} style={{ height: HOUR_HEIGHT }} className="relative border-b border-black/5">
                                <span className="absolute -top-3 left-0 w-full text-center text-[10px] font-black">{(START_HOUR + i)}H</span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2 flex-1 relative overflow-hidden">
                        <AnimatePresence initial={false} custom={direction}>
                            <motion.div
                                key={animationKey}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }} 
                                className="absolute inset-0 flex"
                            >
                                {daysOfWeek.map((day, dIdx) => {
                                    const isVisible = window.innerWidth >= 768 || currentDayIndex === dIdx;
                                    if (!isVisible) return null;

                                    const dayEvents = agenda.filter(e => {
                                        const d = new Date(e.debut);
                                        return d.toLocaleDateString('en-CA') === day.iso && 
                                               e.titre.toLowerCase().includes(searchTerm.toLowerCase());
                                    });
                                    
                                    // 🚀 ON PASSE NOS EVENEMENTS DANS L'ALGORITHME DE CHEVAUCHEMENT !
                                    const laidOutEvents = layoutEvents(dayEvents);
                                    const isToday = new Date().toLocaleDateString('en-CA') === day.iso;

                                    return (
                                        <div key={day.iso} className="flex-1 border-r-2 border-black/10 relative">
                                            
                                            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                                                <div key={i} style={{ height: HOUR_HEIGHT, top: i * HOUR_HEIGHT }} className="absolute border-b border-black/5 w-full"></div>
                                            ))}

                                            {isToday && currentTimeTop !== null && (
                                                <div 
                                                    style={{ top: `${currentTimeTop}px` }} 
                                                    className="absolute left-0 w-full h-[2px] bg-red-600 z-30 pointer-events-none flex items-center"
                                                >
                                                    <div className="w-3 h-3 bg-red-600 rounded-full -ml-1.5 border-2 border-black"></div>
                                                </div>
                                            )}

                                            {/* RENDU DES COURS ABSOLUS */}
                                            {loading ? "" : 
                                                laidOutEvents.map((course, cIdx) => (
                                                    <div key={cIdx} 
                                                        style={calculateStyles(course)}
                                                        // 💡 J'ai supprimé "left-1 right-1" de Tailwind car position gérée en inline maintenant !
                                                        className={`absolute border-2 border-black p-1 sm:p-2 overflow-hidden hover:z-40 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer ${getCourseColor(course.titre)}`}
                                                    >
                                                        <div className="bg-black text-white text-[8px] px-1 font-bold inline-block mb-1">
                                                            {new Date(course.debut).getHours()}H{String(new Date(course.debut).getMinutes()).padStart(2, '0')}
                                                        </div>
                                                        <h4 className="font-black text-[9px] sm:text-[10px] leading-tight uppercase mb-1 break-words">{course.titre}</h4>
                                                        <div className="flex items-center gap-1 text-[8px] font-bold opacity-80 truncate bg-white/50 w-fit px-1 border border-black">
                                                            <MapPin size={8} strokeWidth={3} /> {course.salle}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EntDashboard;
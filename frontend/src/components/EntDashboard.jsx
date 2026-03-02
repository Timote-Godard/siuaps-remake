import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Loader2, ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SetupWizard from './SetupWizard';
import ressources from '../assets/ressources_rennes1.json';

// 🎨 1. PALETTE DE COULEURS NÉOBRUTALISTES
// 🎨 1. PALETTE DE COULEURS NÉOBRUTALISTES
const NEO_COLORS = [
    'bg-pink-300', 'bg-cyan-300', 'bg-green-400', 'bg-purple-300',
    'bg-orange-300', 'bg-blue-300', 'bg-rose-300', 'bg-lime-300', 'bg-yellow-300'
];

// 🛠️ 2. DICTIONNAIRE DE CUSTOMISATION DES COURS
// Ajoute tes mots-clés (en minuscules) et l'URL de l'image correspondante
const COURSE_RULES = [
    {
        keywords: ['ts', 'typescript'],
        bgImage: 'url("https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg")',
        // bgImage: 'url("src/assets/edna.png")',
        color: 'bg-blue-400'
    },
    {
        keywords: ['react', 'web'],
        bgImage: 'url("https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg")',
        color: 'bg-cyan-300'
    },
    {
        keywords: ['sport', 'eps', 'siuaps'],
        bgImage: 'url("https://cdn-icons-png.flaticon.com/512/553/553823.png")', // Icône d'haltère
        color: 'bg-green-400'
    },
    {
        keywords: ['math', 'analyse', 'algèbre'],
        bgImage: 'url("https://cdn-icons-png.flaticon.com/512/1046/1046229.png")', // Icône math
        color: 'bg-red-300'
    }
];

// 🧠 3. LE DISTRIBUTEUR DE STYLES
const getCourseTheme = (title) => {
    if (!title) return { colorClass: 'bg-white', bgImage: null };
    
    const lowerTitle = title.toLowerCase();

    // 1. On cherche si le titre matche avec une de nos règles custom
    for (let rule of COURSE_RULES) {
        if (rule.keywords.some(kw => lowerTitle.includes(kw))) {
            return { colorClass: rule.color, bgImage: rule.bgImage };
        }
    }

    // 2. Si aucune règle ne correspond, on génère une couleur aléatoire (ton ancien système)
    const coreTitle = title.split(' ')[0].toLowerCase(); 
    let hash = 0;
    for (let i = 0; i < coreTitle.length; i++) {
        hash = coreTitle.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NEO_COLORS.length;
    return { colorClass: NEO_COLORS[index], bgImage: null };
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
    const END_HOUR = 21;
    const HOUR_HEIGHT = 60; 
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
                <header className="flex justify-between items-end border-b-8 border-black pb-4 mb-6">
                        <h1 className="text-5xl font-black uppercase italic">Agenda</h1>
                        <button onClick={() => setShowWizard(true)} className="relative right-0 top-0 border-2 border-black p-2 bg-white hover:bg-black hover:text-white cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
                            <Settings size={18} />
                        </button>
                    </header>
                
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 ]">

                    

                    <div className="flex items-center gap-4">
                        <button onClick={goToPrev} className="bg-white border-3 border-black p-1 hover:translate-y-[-2px] hover:translate-x-[-2px] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"><ChevronLeft size={24} /></button>
                        
                        <div className="text-center min-w-[200px]">
                            <span className="font-black uppercase block text-sm opacity-60">
                                {window.innerWidth < 768 ? "Planning du jour" : "Aperçu Semaine"}
                            </span>
                            <span className="font-black text-3xl sm:text-xl italic uppercase">
                                {window.innerWidth < 768 
                                    ? `${daysOfWeek[currentDayIndex].label} ${daysOfWeek[currentDayIndex].date.getDate()} ${daysOfWeek[currentDayIndex].date.toLocaleDateString('fr-FR', {month:'short'})}`
                                    : `${daysOfWeek[0].date.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} - ${daysOfWeek[4].date.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`
                                }
                            </span>
                        </div>

                        <button onClick={goToNext} className="bg-white border-3 border-black p-1 hover:translate-y-[-2px] hover:translate-x-[-2px] cursor-pointer hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"><ChevronRight size={24} /></button>
                    </div>

                </div>

                <div 
                    className="relative flex overflow-hidden"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }} 
                >
                    <div className="w-12 pt-3 mr-2 sm:w-20 border-r-2 border-black flex-shrink-0 z-20">
                        {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                            <div key={i} style={{ height: HOUR_HEIGHT }} className="relative border-b border-black/5">
                                <span className="absolute -top-3 left-0 w-full text-center text-[10px] font-black">{(START_HOUR + i)}H</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 relative overflow-hidden">
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
                                        <div key={day.iso} className="flex-1 mt-2 border-r-2 border-black/10 relative">
                                            
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
    laidOutEvents.map((course, cIdx) => {
        // 🌟 On récupère le thème (couleur + image éventuelle)
        const theme = getCourseTheme(course.titre);

        return (
            <div key={cIdx} 
                style={calculateStyles(course)}
                className={`absolute border-2 border-black p-1 sm:p-2 overflow-hidden hover:z-40 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-1 transition-all cursor-pointer ${theme.colorClass}`}
            >
                {/* 🎨 L'IMAGE DE FOND EN FILIGRANE */}
                {theme.bgImage && (
                    <div 
                        className="absolute bottom-[-10px] right-[-10px] w-16 h-16 opacity-30 -rotate-12 bg-no-repeat bg-contain bg-center pointer-events-none"
                        style={{ backgroundImage: theme.bgImage }}
                    />
                )}

                {/* 📝 LE CONTENU (Au dessus de l'image grâce au z-10) */}
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                    <div className="bg-black text-white text-[8px] px-1 font-bold w-fit mb-1">
                        {new Date(course.debut).getHours()}H{String(new Date(course.debut).getMinutes()).padStart(2, '0')}
                    </div>
                    
                    <h4 className="font-black text-[9px] sm:text-[10px] leading-tight uppercase mb-1 break-words">
                        {course.titre}
                    </h4>
                    
                    <div className="mt-auto flex items-center gap-1 text-[12px] font-bold opacity-90 truncate bg-white border border-black px-1 w-fit shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <MapPin size={8} strokeWidth={3} /> {course.salle}
                    </div>
                </div>
            </div>
        );
    })
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
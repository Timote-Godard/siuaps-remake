import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react';

const SetupWizard = ({ data, initialSelections = [], onComplete, onClose }) => {
    // path : mémorise les dossiers ouverts [{id, name, children}, ...]
    const [path, setPath] = useState([]); 
    // selections : mémorise les matières finales cochées
    const [selections, setSelections] = useState(initialSelections);
    // direction : pour l'animation (1 = on avance, -1 = on recule)
    const [direction, setDirection] = useState(1);

    // Les options affichées à l'écran : soit la racine (data), soit les enfants du dernier dossier
    const currentOptions = path.length === 0 ? data : path[path.length - 1].children;

    // --- ACTIONS ---
    const handleSelectNode = (option) => {
        if (option.children && option.children.length > 0) {
            // 📂 C'est un dossier : on plonge dedans
            setDirection(1);
            setPath([...path, option]);
        } else {
            // 🎯 C'est une ressource finale (une feuille) : on la coche ou décoche
            const isAlreadySelected = selections.some(s => s.id === option.id);
            if (isAlreadySelected) {
                setSelections(selections.filter(s => s.id !== option.id));
            } else {
                setSelections([...selections, { id: option.id, name: option.name }]);
            }
        }
    };

    const handleBack = () => {
        if (path.length === 0) {
            onClose(); // Ferme le tunnel si on est tout en haut
        } else {
            setDirection(-1);
            setPath(path.slice(0, -1)); // Remonte d'un niveau
        }
    };

    // --- ANIMATIONS FRAMER MOTION ---
    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 })
    };

    return (
        <div className="fixed inset-0 z-50 bg-yellow-200 flex flex-col font-mono text-black">
            
            {/* HEADER DU TUNNEL */}
            <div className="bg-white border-b-4 border-black p-4 flex items-center gap-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)] z-10 relative">
                <button 
                    onClick={handleBack} 
                    className="p-2 border-4 border-black bg-white hover:bg-black hover:text-white transition-colors cursor-pointer active:translate-y-1 active:translate-x-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none"
                >
                    {path.length === 0 ? <X size={24} strokeWidth={3} /> : <ArrowLeft size={24} strokeWidth={3} />}
                </button>
                
                <div className="flex-1 truncate">
                    <span className="text-[10px] font-black uppercase opacity-60 block">
                        Étape {path.length + 1}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate">
                        {path.length === 0 ? "Choisis ta ressource" : path[path.length - 1].name}
                    </h1>
                </div>
            </div>

            {/* CONTENU ANIMÉ */}
            <div className="flex-1 relative overflow-hidden bg-yellow-200">
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={path.length} // L'animation se joue quand la profondeur change
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute inset-0 overflow-y-auto p-4 sm:p-8 pb-32"
                    >
                        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                            {currentOptions?.map((option) => {
                                // On détermine si l'option est un dossier ou un fichier final
                                const isLeaf = !option.children || option.children.length === 0;
                                const isSelected = selections.some(s => s.id === option.id);

                                return (
                                    <button 
                                        key={option.id}
                                        onClick={() => handleSelectNode(option)}
                                        className={`flex items-center justify-between p-4 border-4 border-black text-left transition-all cursor-pointer group active:translate-y-1 active:translate-x-1 active:shadow-none
                                            ${isSelected 
                                                ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                                                : 'bg-white hover:bg-yellow-100 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
                                            }`}
                                    >
                                        <span className="font-bold text-lg uppercase pr-4 leading-tight">
                                            {option.name}
                                        </span>
                                        
                                        {/* Icône dynamique (Dossier vs Checkbox) */}
                                        {isLeaf ? (
                                            <div className={`shrink-0 w-8 h-8 border-4 border-black rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-green-400 text-black border-white' : 'bg-white text-transparent'}`}>
                                                <Check size={16} strokeWidth={4} />
                                            </div>
                                        ) : (
                                            <ChevronRight size={28} strokeWidth={3} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* BOUTON VALIDATION FLOTTANT (Apparaît si on a sélectionné au moins une matière) */}
            {selections.length > 0 && (
                <div className="absolute bottom-0 left-0 w-full p-4 bg-white border-t-4 border-black z-20 shadow-[0px_-8px_20px_rgba(0,0,0,0.1)]">
                    <button 
                        onClick={() => onComplete(selections)}
                        className="w-full max-w-3xl mx-auto bg-green-400 border-4 border-black p-4 font-black text-xl uppercase tracking-widest flex items-center justify-center gap-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none hover:bg-green-300 transition-all cursor-pointer"
                    >
                        <Check size={28} strokeWidth={4} />
                        Générer mon planning ({selections.length})
                    </button>
                </div>
            )}
        </div>
    );
};

export default SetupWizard;
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Check, Loader2, History } from 'lucide-react'; // Ajout de l'icône History

const Validations = ({ url, onBack }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [presentStudents, setPresentStudents] = useState(new Set());
    const [justClicked, setJustClicked] = useState(null);
    
    // 1. NOUVEL ÉTAT : Mode Archive
    const [isArchiveMode, setIsArchiveMode] = useState(false);

    // Fonction pour recharger les données (utile quand on change de mode)
    const fetchCreneaux = async (useArchive) => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:5000/api/validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: url, 
                    archive: useArchive // On envoie le mode au backend
                })
            });
            const result = await res.json();
            
            if (result.success) {
                setData(result.slots);
                // Mise à jour des présences (ton code actuel...)
                const alreadyChecked = new Set();
                result.slots.forEach(slot => {
                    slot.students.forEach(student => {
                        if (student.isChecked) alreadyChecked.add(student.id);
                    });
                });
                setPresentStudents(alreadyChecked);
            }
        } catch (error) {
            console.error("Erreur :", error);
        } finally {
            setLoading(false);
        }
    };


    const getFirstMatchingStudent = () => {
        const filteredStudents = groupedBlocks[0].studentsList.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        return filteredStudents[0];
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm !== '') {
            const studentToValidate = getFirstMatchingStudent();
            
            if (studentToValidate) {
                // On simule un clic sur sa carte !
                toggleStudent(studentToValidate); 
                // On vide la barre instantanément pour le prochain
                setSearchTerm(''); 
            }
        }
    };

    // Charger au montage
    useEffect(() => {
        if (url) fetchCreneaux(isArchiveMode);
    }, [url]);

    // 2. ACTION : Quand on clique sur le bouton Archive
    const handleToggleArchive = () => {
        const nextMode = !isArchiveMode;
        setIsArchiveMode(nextMode);
        fetchCreneaux(nextMode); // On relance le scraping avec le nouveau mode
    };

    // ====================================================================
    // 🧠 LA MAGIE EST ICI : FUSION DES CRÉNEAUX EN "BLOCS" (Midi / Soir)
    // ====================================================================
    const groupedBlocks = useMemo(() => {
        if (!data) return [];
        const blocks = {};

        data.forEach(slot => {
            // On sépare le Midi (12h-14h) du Soir (18h-20h)
            const isMidi = slot.horaire.includes('12:00') || slot.horaire.includes('13:00');
            const shift = isMidi ? 'MIDI' : 'SOIR';
            const blockKey = `${slot.date}_${shift}`; // Ex: "lundi 16 février 2026_SOIR"


            const maintenant = new Date();
            const heure = maintenant.getHours();
            
            if (!(heure < 16 ^ shift === "SOIR") && !isArchiveMode) return

            

            if (!blocks[blockKey]) {
                blocks[blockKey] = {
                    id: blockKey,
                    date: slot.date,
                    shift: shift,
                    slotsOriginaux: [], // On garde les infos des créneaux pour le backend
                    etudiantsUniques: {} // Dictionnaire des étudiants
                };
            }

            blocks[blockKey].slotsOriginaux.push(slot);

            // On regroupe les étudiants par leur NOM
            slot.students.forEach(student => {
                if (!blocks[blockKey].etudiantsUniques[student.name]) {
                    blocks[blockKey].etudiantsUniques[student.name] = {
                        name: student.name,
                        avatar: student.avatar,
                        initials: student.initials,
                        // On stocke TOUTES ses inscriptions (ex: il peut en avoir une pour 18h et une pour 19h)
                        inscriptions: [] 
                    };
                }
                
                blocks[blockKey].etudiantsUniques[student.name].inscriptions.push({
                    slotId: slot.id, // L'ID temporaire du créneau
                    appointmentId: student.id, // L'ID de la checkbox Moodle
                    horaire: slot.horaire,
                    actionUrl: slot.actionUrl
                });
            });
        });

        // On convertit le dictionnaire en tableau propre pour l'affichage, trié par ordre alphabétique
        return Object.values(blocks).map(block => ({
            ...block,
            studentsList: Object.values(block.etudiantsUniques).sort((a, b) => {
                const aPresent = a.inscriptions.every(ins => presentStudents.has(ins.appointmentId));
                const bPresent = b.inscriptions.every(ins => presentStudents.has(ins.appointmentId));

                const aSortValue = (justClicked === a.name) ? false : aPresent;
                const bSortValue = (justClicked === b.name) ? false : bPresent;
                
                if (aSortValue !== bSortValue) {
                    return aSortValue ? 1 : -1;
                }
                return a.name.localeCompare(b.name);
            })
        }));
    }, [data, presentStudents, justClicked]);

    // ====================================================================
    // 🚀 LE MEGA-CLIC : VALIDE TOUTES LES HEURES D'UN ÉTUDIANT D'UN COUP
    // ====================================================================
    const toggleStudent = async (student) => {
        // Est-ce qu'il est déjà validé pour TOUTES ses heures ?
        const isFullyPresent = student.inscriptions.every(ins => presentStudents.has(ins.appointmentId));
        const newSet = new Set(presentStudents);

        setJustClicked(student.name);
        
        // Si oui, on décoche tout. Si non, on coche tout !
        student.inscriptions.forEach(ins => {
            if (isFullyPresent) newSet.delete(ins.appointmentId);
            else newSet.add(ins.appointmentId);
        });
        setPresentStudents(newSet); // Mise à jour instantanée de l'UI

        await new Promise(resolve => setTimeout(resolve, 100));
        
        setJustClicked(null);

        // On doit dire à Node.js de sauvegarder chaque créneau touché
        // (Ex: S'il a 18h et 19h, on fait 2 requêtes invisibles au SIUAPS)
        const slotsToUpdate = [...new Set(student.inscriptions.map(ins => ins.slotId))];
        

        slotsToUpdate.forEach(async (slotId) => {
            const originalSlot = data.find(s => s.id === slotId);
            // On recalcule qui est présent pour CE créneau précis
            const presentIdsForThisSlot = originalSlot.students
                .map(s => s.id)
                .filter(id => newSet.has(id));

            try {
                await fetch('http://localhost:5000/api/save-attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        actionUrl: originalSlot.actionUrl, 
                        presentIds: presentIdsForThisSlot 
                    })
                });
            } catch (error) {
                console.error("Erreur de sauvegarde :", error);
            }
        });
    };

    return (
        <div className="animate-in slide-in-from-right duration-500 bg-white p-2 sm:p-4 min-h-[500px] flex flex-col relative pb-10">
            
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 border-2 border-black p-2 font-black uppercase cursor-pointer hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1">
                    <ArrowLeft size={20} strokeWidth={3} /> Retour
                </button>

                {/* 3. LE BOUTON ARCHIVE */}
                <button 
                    onClick={handleToggleArchive}
                    className={`cursor-pointer hover:bg-purple-500 active:shadow-none active:translate-x-1 active:translate-y-1 hover:text-white flex items-center gap-2 border-2 border-black p-2 font-black uppercase transition-all
                        ${isArchiveMode 
                            ? 'bg-purple-500 text-white shadow-none translate-x-1 translate-y-1' 
                            : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'
                        }`}
                >
                    <History size={20} strokeWidth={3} />
                    Charger Archives
                </button>
            </div>

            {/* BARRE DE RECHERCHE */}
            <div className="sticky top-0 z-10 bg-white py-2 mb-6">
                <div className="relative flex items-center w-full">
                    <Search className="absolute left-3 text-gray-500" size={24} strokeWidth={3} />
                    <input 
                        type="text" 
                        placeholder="Chercher un étudiant..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full border-4 border-black p-4 pl-12 text-lg font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none transition-colors placeholder:text-gray-400 uppercase"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin mb-2" size={40} />
                    <p className="font-bold uppercase italic text-sm">Synchronisation SIUAPS...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* ON MAPPE SUR NOS NOUVEAUX BLOCS (Midi/Soir) */}
                    {groupedBlocks.map((block) => {
                        const filteredStudents = block.studentsList.filter(student => 
                            student.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );

                        if (filteredStudents.length === 0) return null;


                        

                        return (
                            <div key={block.id} className="border-4 border-black p-4 bg-gray-50 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                
                                <div className="mb-6 border-b-4 border-black pb-2 flex justify-between items-end">
                                    <div>
                                        <span className="text-xs font-black uppercase bg-black text-white px-2 py-1 tracking-widest">
                                            {block.date}
                                        </span>
                                        <h3 className="font-black text-2xl mt-1 uppercase">SESSION {block.shift}</h3>
                                    </div>
                                    <span className="text-sm font-black bg-yellow-300 border-2 border-black px-2 py-1">
                                        {filteredStudents.length} INSCRITS
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filteredStudents.map((student,index) => {
                                        // On vérifie s'il est coché partout où il est inscrit
                                        const isFullyPresent = student.inscriptions.every(ins => presentStudents.has(ins.appointmentId));

                                        return (
                                            <button 
                                                key={`${student.name}-${index}`} 
                                                onClick={() => toggleStudent(student)}
                                                className={`flex flex-col gap-2 border-4 border-black p-3 text-left transition-all active:translate-y-1 active:translate-x-1 active:shadow-none
                                                    ${isFullyPresent ? 'bg-green-400 shadow-[inset_0_4px_4px_rgba(0,0,0,0.2)] translate-y-1 translate-x-1' : 'cursor-pointer bg-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100'}
                                                `}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {student.avatar ? (
                                                            <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full border-2 border-black object-cover bg-white" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full border-2 border-black bg-blue-500 flex items-center justify-center font-black text-white text-xs">
                                                                {student.initials || student.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <p className="font-black text-sm uppercase truncate">{student.name}</p>
                                                    </div>

                                                    <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border-4 border-black rounded-full transition-colors ${isFullyPresent ? 'bg-black text-white' : 'bg-white text-transparent'}`}>
                                                        <Check size={16} strokeWidth={5} />
                                                    </div>
                                                </div>

                                                {/* PETITES PILULES POUR MONTRER LES HEURES */}
                                                <div className="flex flex-wrap gap-1 mt-1 pl-13">
                                                    {student.inscriptions.map((ins,i) => (
                                                        <span key={`pilule-${ins.appointmentId}-${i}`} className={`text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black ${presentStudents.has(ins.appointmentId) ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                            {ins.horaire.split('-')[0].trim()} {/* Affiche juste "18:00" ou "19:00" */}
                                                        </span>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Validations;
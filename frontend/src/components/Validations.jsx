import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Search, Check, Loader2, History } from 'lucide-react';

const Validations = ({ url, onBack }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Les 3 états vitaux
    const [presentStudents, setPresentStudents] = useState(new Set()); // Pour Moodle
    const [justClicked, setJustClicked] = useState(null);
    const [siuapsValidated, setSiuapsValidated] = useState(new Set());
    
    const [isArchiveMode, setIsArchiveMode] = useState(false);
    // 🌟 NOUVEL ÉTAT POUR LA RECHERCHE DES OUBLIS
    const [missingSearch, setMissingSearch] = useState("");

    // 🌟 On ajoute le paramètre searchMissingName
    const fetchCreneaux = async (useArchive, searchMissingName = "") => {
        try {
            setLoading(true);
            const res = await fetch('/api/validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // credentials: 'include', // (Si tu as activé la sécurité)
                body: JSON.stringify({ 
                    url: url, 
                    archive: useArchive,
                    searchMissing: searchMissingName // 🌟 On l'envoie au Node.js
                })
            });
            const result = await res.json();
            
            if (result.success) {
                setData(result.slots);
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
        if (!groupedBlocks || groupedBlocks.length === 0) return null;
        const filteredStudents = groupedBlocks[0].studentsList.filter(student => 
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return filteredStudents[0];
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm !== '') {
            const studentToValidate = getFirstMatchingStudent();
            if (studentToValidate) {
                toggleStudent(studentToValidate); 
                setSearchTerm(''); 
            }
        }
    };

    useEffect(() => {
        if (url) fetchCreneaux(isArchiveMode);
    }, [url]);

    // 🌟 NOUVELLE ACTION : Exécuter la recherche d'oublis
    const executeMissingSearch = () => {
        if (missingSearch.trim() !== "") {
            setIsArchiveMode(true);
            fetchCreneaux(true, missingSearch.trim()); // On fouille les archives avec le nom
        } else {
            setIsArchiveMode(false);
            fetchCreneaux(false, ""); // On remet à zéro
        }
    };

    // ====================================================================
    // FUSION DES CRÉNEAUX EN "BLOCS" (Midi / Soir)
    // ====================================================================
    const groupedBlocks = useMemo(() => {
        if (!data) return [];
        const blocks = {};

        data.forEach(slot => {
            const isMidi = slot.horaire.includes('12:00') || slot.horaire.includes('13:00');
            const shift = isMidi ? 'MIDI' : 'SOIR';
            const blockKey = `${slot.date}_${shift}`;

            const maintenant = new Date();
            const heure = maintenant.getHours();
            
            // Filtre de l'heure (sauf si mode archive)
            if (!(heure < 16 ^ shift === "SOIR") && !isArchiveMode) return;

            if (!blocks[blockKey]) {
                blocks[blockKey] = {
                    id: blockKey,
                    date: slot.date,
                    shift: shift,
                    slotsOriginaux: [],
                    etudiantsUniques: {}
                };
            }

            blocks[blockKey].slotsOriginaux.push(slot);

            slot.students.forEach(student => {
                if (!blocks[blockKey].etudiantsUniques[student.name]) {
                    blocks[blockKey].etudiantsUniques[student.name] = {
                        name: student.name,
                        staticId: student.staticId, // L'ID indestructible pour SIUAPS
                        avatar: student.avatar,
                        initials: student.initials,
                        inscriptions: [] 
                    };
                }
                
                blocks[blockKey].etudiantsUniques[student.name].inscriptions.push({
                    slotId: slot.id, 
                    appointmentId: student.id, 
                    horaire: slot.horaire,
                    actionUrl: slot.actionUrl
                });
            });
        });

        return Object.values(blocks).map(block => ({
            ...block,
            studentsList: Object.values(block.etudiantsUniques).sort((a, b) => {
                const aPresent = a.inscriptions.every(ins => presentStudents.has(ins.appointmentId));
                const bPresent = b.inscriptions.every(ins => presentStudents.has(ins.appointmentId));

                const aSortValue = (justClicked === a.name) ? false : aPresent;
                const bSortValue = (justClicked === b.name) ? false : bPresent;
                
                if (aSortValue !== bSortValue) return aSortValue ? 1 : -1;
                return a.name.localeCompare(b.name);
            })
        }));
    }, [data, presentStudents, justClicked, isArchiveMode]);


    const toggleStudent = async (student) => {
        const isChecking = student.inscriptions.some(ins => !presentStudents.has(ins.appointmentId)); 
        const newSet = new Set(presentStudents);

        setJustClicked(student.name);
        
        student.inscriptions.forEach(ins => {
            if (!isChecking) newSet.delete(ins.appointmentId);
            else newSet.add(ins.appointmentId);
        });
        setPresentStudents(newSet); // MAJ UI instantanée (La carte devient noire)

        await new Promise(resolve => setTimeout(resolve, 100));
        setJustClicked(null);

        const locationId = url?.includes('7140') ? 2 : (url?.includes('7141') ? 1 : null);
        const slotsToUpdate = [...new Set(student.inscriptions.map(ins => ins.slotId))];
        
        // 🌟 LA RÈGLE D'OR : On est sur le créneau actuel UNIQUEMENT si on n'est pas en mode archive
        // (Le filtrage Midi/Soir de la journée est déjà géré par ton useMemo)
        const isCurrentSlot = !isArchiveMode;

        slotsToUpdate.forEach(async (slotId) => {
            const originalSlot = data.find(s => s.id === slotId);
            const presentIdsForThisSlot = originalSlot.students
                .map(s => s.id)
                .filter(id => newSet.has(id));

            const specificInscription = student.inscriptions.find(ins => ins.slotId === slotId);

            try {
                const res = await fetch('/api/save-attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        actionUrl: originalSlot.actionUrl, 
                        presentIds: presentIdsForThisSlot,
                        locationId: locationId,
                        // 🎯 On ne demande le script SIUAPS QUE si on coche ET qu'on est en direct !
                        targetStudentId: (isChecking && isCurrentSlot) ? student.staticId : null, 
                        studentName: student.name  
                    })
                });

                // ✅ Ajout Visuel du "✓" vert SEULEMENT si SIUAPS a été appelé (donc en direct)
                if (res.ok && isChecking && isCurrentSlot) {
                    setSiuapsValidated(prev => new Set(prev).add(specificInscription.appointmentId));
                } else if (!isChecking) {
                    setSiuapsValidated(prev => {
                        const next = new Set(prev);
                        next.delete(specificInscription.appointmentId);
                        return next;
                    });
                }
            } catch (error) {
                console.error("Erreur de sauvegarde :", error);
            }
        });
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-white min-h-screen flex flex-col shadow-[0px_0px_20px_rgba(0,0,0,0.1)]">
            
            <div className="sticky top-0 z-30 bg-white border-b-4 border-black mb-5 pb-4 pt-4 px-4 sm:px-6">
                <div className='flex mb-4 items-center'>
                    <div className="flex items-center mb-4 gap-4">
                        <button onClick={onBack} className="shrink-0 hover:text-white hover:bg-black cursor-pointer flex items-center justify-center w-12 h-12 border-4 border-black font-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
                            <ArrowLeft size={24} strokeWidth={4} />
                        </button>
                        <h1 className="font-black uppercase text-2xl sm:text-3xl tracking-tight leading-none">
                            Valider <br/> Creneaux
                        </h1>
                    </div>

                    <div className={`ml-auto flex items-center h-12 border-4 border-black transition-all 
                        ${missingSearch.trim() ? 'shadow-none translate-x-1 translate-y-1' : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white focus-within:translate-x-1 focus-within:translate-y-1 focus-within:shadow-none'}`}
                    >
                        <input 
                            type="text"
                            placeholder="Oublis (Nom)..."
                            value={missingSearch}
                            onChange={(e) => {
                                const val = e.target.value;
                                setMissingSearch(val);

                                if (val === "" && isArchiveMode) {
                                    setIsArchiveMode(false);
                                    fetchCreneaux(false, "");
                                }
                            }}

                            onKeyDown={(e) => e.key === 'Enter' && executeMissingSearch()}
                            className="h-full px-2 sm:px-3 w-28 sm:w-48 outline-none font-black uppercase text-xs sm:text-sm placeholder:text-gray-400 bg-white"
                        />
                        <button 
                            onClick={executeMissingSearch}
                            className={`h-full px-3 border-l-4 border-black flex items-center justify-center transition-colors 
                                ${isArchiveMode && missingSearch.trim() ? 'bg-purple-500 text-white' : 'bg-yellow-300 hover:bg-yellow-400 text-black'}`}
                        >
                            <History size={20} strokeWidth={4} />
                        </button>
                    </div>
                </div>
            
                <div className="sticky top-0 z-10 bg-white py-2">
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
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin mb-2" size={40} />
                    <p className="font-bold uppercase italic text-sm">Synchronisation SIUAPS...</p>
                </div>
            ) : (
                <div className="space-y-8 mr-[8px]">
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
                                    {filteredStudents.map((student, index) => {
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

                                                {/* 🌟 ICI LE CODE A ÉTÉ MIS À JOUR POUR AFFICHER LE V VERT ! */}
                                                <div className="flex flex-wrap gap-1 mt-1 pl-13">
                                                    {student.inscriptions.map((ins, i) => {
                                                        const isPresent = presentStudents.has(ins.appointmentId);
                                                        const isSiuapsOk = siuapsValidated.has(ins.appointmentId);

                                                        return (
                                                            <span key={`pilule-${ins.appointmentId}-${i}`} 
                                                                className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black transition-colors ${isPresent ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}
                                                            >
                                                                {ins.horaire.split('-')[0].trim()}
                                                                
                                                                {/* Le ✓ vert apparaît quand le serveur confirme l'action */}
                                                                {isPresent && isSiuapsOk && (
                                                                    <Check size={12} className="text-green-400 drop-shadow-[1px_1px_0_rgba(0,0,0,1)]" strokeWidth={4} />
                                                                )}
                                                            </span>
                                                        );
                                                    })}
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
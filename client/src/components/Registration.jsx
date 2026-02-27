import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Loader2, MapPin, Clock, Users, ChevronDown } from 'lucide-react';

const Registration = ({ onBack }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // 🧠 LE SECRET EST ICI : Au lieu d'un Set() qui garde tout ouvert, 
    // on stocke juste le nom de l'UNIQUE activité ouverte.
    const [activeActivity, setActiveActivity] = useState(null);

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:5000/api/registration-data');
            const data = await res.json();
            if (data.success) setActivities(data.activities);
        } catch (error) {
            console.error("Erreur :", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchActivities(); }, []);

    // La nouvelle fonction toggle : elle ouvre ou ferme, mais s'assure qu'une seule est ouverte
    const toggleActivity = (activityName) => {
        setActiveActivity(prev => prev === activityName ? null : activityName);
    };

    const handleEnrol = async (enrolUrl) => {
        // ... (Ton code d'inscription reste identique)
    };

    const filteredActivities = activities.filter(activity => 
        activity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.slots.some(slot => slot.day.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const textColors = ['text-yellow-900', 'text-cyan-900', 'text-pink-900', 'text-purple-900'];
    const bgColors = ['bg-yellow-300', 'bg-cyan-300', 'bg-pink-300', 'bg-purple-300'];
    const hoverColors = ['md:hover:bg-yellow-300', 'md:hover:bg-cyan-300', 'md:hover:bg-pink-300', 'md:hover:bg-purple-300'];
    const bgSecondColors = ['bg-yellow-100', 'bg-cyan-100', 'bg-pink-100', 'bg-purple-100'];

    return (
        // 📱 CONTENEUR MOBILE-FIRST : max-w-2xl garde une largeur parfaite même sur PC
        <div className="w-full max-w-2xl mx-auto bg-white min-h-screen flex flex-col shadow-[0px_0px_20px_rgba(0,0,0,0.1)]">
            
            {/* EN-TÊTE FIXE (Sticky) */}
            <div className="sticky top-0 z-30 bg-white border-b-4 border-black pb-4 pt-4 px-4 sm:px-6">
                <div className="flex items-center mb-4 gap-4">
                    <button onClick={onBack} className="shrink-0 hover:text-white hover:bg-black cursor-pointer flex items-center justify-center w-12 h-12 border-4 border-black font-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">
                        <ArrowLeft size={24} strokeWidth={4} />
                    </button>
                    <h1 className="font-black uppercase text-2xl sm:text-3xl tracking-tight leading-none">
                        Catalogue<br/>Sports
                    </h1>
                </div>

                {/* BARRE DE RECHERCHE OPTIMISÉE POUCE */}
                <div className="relative flex items-center w-full">
                    <Search className="absolute left-4 text-black" size={24} strokeWidth={4} />
                    <input 
                        type="text" 
                        placeholder="EX: BADMINTON, MARDI..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border-4 border-black p-4 pl-14 text-lg font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none transition-colors placeholder:text-gray-400 uppercase rounded-none"
                    />
                </div>
            </div>

            <div className="flex-1 p-4 sm:px-6 pb-24 bg-gray-50">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin mb-4" size={48} strokeWidth={3} />
                        <p className="font-black uppercase text-lg text-gray-500">Chargement...</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredActivities.length === 0 ? (
                            <p className="text-center font-black uppercase py-10 text-gray-400 text-xl">Rien trouvé.</p>
                        ) : (
                            filteredActivities.map((activity, idx) => {
                                const isOpen = activeActivity === activity.name;
                                const headerColor = bgColors[idx % bgColors.length];
                                const footerColor = bgSecondColors[idx % bgSecondColors.length];
                                const textColor = textColors[idx % textColors.length];
                                const mdHoverColor = hoverColors[idx % hoverColors.length];
                                
                                return (
                                    <div key={activity.name} className={`border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white transition-all ${isOpen ? 'shadow-none translate-x-1 translate-y-1' : 'md:hover:translate-y-[-2px] md:hover:translate-x-[-2px] md:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}`}>
                                        
                                        {/* LE BOUTON ACCORDÉON GÉANT */}
                                        <button 
                                            onClick={() => toggleActivity(activity.name)}
                                            className={`${mdHoverColor}  cursor-pointer w-full flex justify-between items-center p-4 sm:p-5 text-left transition-colors ${isOpen ? headerColor : 'bg-white'}`}
                                        >
                                            <div className="pr-4">
                                                <h2 className="text-xl sm:text-2xl font-black uppercase leading-tight mb-1">{activity.name}</h2>
                                                <p className="text-xs sm:text-sm font-bold text-black/60 uppercase">
                                                    {activity.slots.length} créneaux
                                                </p>
                                            </div>
                                            <motion.div
                                                animate={{ rotate: isOpen ? 180 : 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="shrink-0 bg-white border-4 border-black w-10 h-10 flex items-center justify-center rounded-full"
                                            >
                                                <ChevronDown size={24} strokeWidth={4} />
                                            </motion.div>
                                        </button>

                                        {/* LE CORPS DE L'ACCORDÉON */}
                                        <AnimatePresence>
                                            {isOpen && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden border-t-4 border-black bg-gray-100"
                                                >
                                                    <div className={`p-4 flex flex-col gap-4 ${footerColor}`}>
                                                        
                                                        {activity.description && (
                                                            <div className="p-3 bg-white border-2 border-dashed border-black text-sm font-bold italic">
                                                                {activity.description}
                                                            </div>
                                                        )}
                                                        
                                                        {/* LA LISTE DES CRÉNEAUX */}
                                                        {activity.slots.map((slot, index) => (
                                                            <div key={index} className="border-4 border-black p-4 bg-white flex flex-col">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className= {`${headerColor} border-2 border-black ${textColor}  px-3 py-1 text-sm font-black uppercase`}>
                                                                        {slot.day}
                                                                    </span>
                                                                    {slot.typeTags?.[0] && (
                                                                        <span className="px-2 py-1 text-[10px] font-black border-2 border-black uppercase bg-yellow-200">
                                                                            {slot.typeTags[0].label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                
                                                                <h3 className="font-black text-xl uppercase mb-3">
                                                                    {slot.startTime} - {slot.endTime}
                                                                </h3>
                                                                
                                                                <div className="flex flex-col gap-2 text-xs font-bold uppercase text-gray-700 mb-4">
                                                                    <div className="flex items-center gap-2"><MapPin size={16} /> <span className="truncate">{slot.location}</span></div>
                                                                    <div className="flex items-center gap-2"><Clock size={16} /> {slot.level}</div>
                                                                    <div className={`flex w-fit items-center gap-2 px-2 py-1 border-2 border-black ${slot.placesClass?.includes('success') ? 'bg-green-300' : 'bg-orange-200'}`}>
                                                                        <Users size={16} /> {slot.places}
                                                                    </div>
                                                                </div>

                                                                {/* BOUTON D'ACTION GÉANT */}
                                                                <button 
                                                                    onClick={() => handleEnrol(slot.enrolUrl)}
                                                                    className="cursor-pointer w-full md:hover:translate-y-[-2px] md:hover:translate-x-[-2px] md:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:bg-green-400 bg-green-200 text-black font-black text-lg py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:active:shadow-none md:active:translate-x-1 md:active:translate-y-1 transition-all uppercase"
                                                                >
                                                                    S'inscrire
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Registration;
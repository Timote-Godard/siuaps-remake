import React, { useState, useEffect } from 'react';
import ressources from '../assets/ressources_rennes1.json'; // Ton fichier JSON

const EntDashboard = () => {
    const [selectedId, setSelectedId] = useState(localStorage.getItem('user_resource_id') || "");
    const [agenda, setAgenda] = useState([]);
    const [loading, setLoading] = useState(false);

    // Dès qu'un ID est sélectionné, on charge l'agenda
    useEffect(() => {
        if (selectedId) {
            localStorage.setItem('user_resource_id', selectedId);
            fetchAgenda(selectedId);
        }
    }, [selectedId]);

    const fetchAgenda = async (id) => {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/agenda/${id}`);
        const data = await res.json();
        if (data.success) setAgenda(data.agenda);
        setLoading(false);
    };

    return (
        <div className="p-8">
            <h1 className="text-5xl font-black uppercase mb-8">Mon Planning</h1>

            {/* SÉLECTEUR DE GROUPE */}
            <div className="mb-10">
                <label className="block font-black uppercase mb-2">Choisis ton groupe :</label>
                <select 
                    value={selectedId} 
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="border-4 border-black p-3 font-bold w-full max-w-md bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                    <option value="">-- Sélectionne ta filière --</option>
                    {ressources.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            {/* AFFICHAGE DES COURS */}
            {loading ? (
                <p className="animate-pulse font-black uppercase">Chargement du calendrier...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {agenda.map((c, i) => (
                        <div key={i} className="border-4 border-black p-4 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                            <p className="font-black text-cyan-600">{new Date(c.debut).toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long'})}</p>
                            <h3 className="text-xl font-black uppercase">{c.titre}</h3>
                            <p className="font-bold">📍 {c.salle}</p>
                            <p className="font-bold">⏰ {new Date(c.debut).getHours()}h{String(new Date(c.debut).getMinutes()).padStart(2, '0')}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EntDashboard;
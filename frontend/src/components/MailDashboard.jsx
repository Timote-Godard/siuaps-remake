import React, { useState } from 'react';
import { Mail, User, ArrowLeft, Loader2, X } from 'lucide-react';

const MailDashboard = ({ mailData }) => {
    const { loading, recentMails, unreadCount } = mailData;
    const [selectedMail, setSelectedMail] = useState(null);
    const [bodyLoading, setBodyLoading] = useState(false);

    // Fonction pour ouvrir un mail
    const handleOpenMail = async (mail) => {
        setBodyLoading(true);
        setSelectedMail({ ...mail, body: '' }); // On prépare l'affichage
        
        try {
            const res = await fetch(`http://localhost:5000/api/mail/${mail.id}`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setSelectedMail(prev => ({ ...prev, body: data.body }));
            }
        } catch (err) {
            console.error("Erreur lecture:", err);
        } finally {
            setBodyLoading(false);
        }
    };

    const renderTextWithLinks = (text) => {
    // On cherche les patterns "Texte [LIEN: url]" ou "Texte [ url | Texte ]" (Format Zimbra brut)
    
    // Regex pour détecter les liens formatés par notre backend ou par Zimbra
    const linkRegex = /\[LIEN:\s*(http[^\]]+)\]|\[\s*(http[^|\s]+)\s*\|\s*([^\]]+)\]/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        // Ajoute le texte AVANT le lien
        parts.push(text.slice(lastIndex, match.index));

        // Gestion des deux formats de liens
        let url = match[1] || match[2];
        let linkText = match[3] || "Ouvrir le lien";

        // Ajoute le lien cliquable style Néobrutaliste
        parts.push(
            <a 
                key={match.index} 
                href={url} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block bg-blue-300 border-2 border-black px-1 font-bold mx-1 hover:bg-cyan-300 hover:-translate-y-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform"
            >
                {linkText}
            </a>
        );
        lastIndex = linkRegex.lastIndex;
    }

    // Ajoute la fin du texte
    parts.push(text.slice(lastIndex));

    return parts;
};

    if (loading) return <div className="p-10 font-black uppercase animate-pulse">Relève...</div>;

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto bg-blue-200 h-full">
            {/* VUE LISTE */}
            {!selectedMail ? (
                <>
                    <header className="flex justify-between items-end border-b-8 border-black pb-4 mb-6">
                        <h1 className="text-5xl font-black uppercase italic">Mails</h1>
                        <span className="bg-cyan-300 border-4 border-black px-4 py-1 font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {unreadCount}
                        </span>
                    </header>

                    <div className="grid gap-4">
                        {recentMails.map((mail) => (
                            <div 
                                key={mail.id} 
                                onClick={() => handleOpenMail(mail)}
                                className={`cursor-pointer border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all
                                ${mail.isUnread ? 'bg-white font-black' : 'bg-gray-50 opacity-80'}`}
                            >
                                <div className="flex justify-between text-[10px] uppercase mb-1">
                                    <span className="truncate max-w-[150px]">{mail.sender}</span>
                                    <span>{mail.date}</span>
                                </div>
                                <h2 className="text-lg leading-tight">{mail.subject}</h2>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                /* VUE LECTURE (L'email ouvert) */
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <button 
                        onClick={() => setSelectedMail(null)}
                        className="mb-6 flex items-center gap-2 bg-black text-white px-4 py-2 font-black uppercase hover:bg-blue-300 hover:text-black border-4 border-black transition-colors"
                    >
                        <ArrowLeft size={20} strokeWidth={3} /> Retour
                    </button>

                    <div className="bg-white border-8 border-black p-6 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                        <h1 className="text-2xl sm:text-4xl font-black uppercase mb-4 leading-none">
                            {selectedMail.subject}
                        </h1>
                        
                        <div className="flex items-center gap-2 border-b-4 border-black pb-4 mb-6">
                            <div className="bg-cyan-300 border-2 border-black p-2 rounded-full">
                                <User size={20} strokeWidth={3} />
                            </div>
                            <div>
                                <p className="font-black uppercase text-xs">De: {selectedMail.sender}</p>
                                <p className="text-[10px] font-bold opacity-60 italic">{selectedMail.date}</p>
                            </div>
                        </div>

                        {bodyLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="animate-spin" size={48} strokeWidth={3} />
                                <p className="font-black uppercase">Chargement du contenu...</p>
                            </div>
                        ) : (
                            <div className="bg-white border-4 border-black p-4 sm:p-8 max-h-[600px] overflow-y-auto shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.1)] relative">
                                
                                {/* 🎨 LE STYLE NÉOBRUTALISTE FORCÉ */}
                                <style>{`
                                    .neo-mail-content {
                                        font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
                                        color: black;
                                        word-wrap: break-word;
                                    }
                                    
                                    /* Suppression des tables invisibles utilisées pour la mise en page (ex: JobTeaser) */
                                    .neo-mail-content table {
                                        width: 100% !important;
                                        display: block;
                                    }
                                    .neo-mail-content tbody, .neo-mail-content tr, .neo-mail-content td {
                                        display: block;
                                        width: 100% !important;
                                    }

                                    /* Les Titres */
                                    .neo-mail-content h1, .neo-mail-content h2, .neo-mail-content h3 {
                                        font-weight: 900;
                                        text-transform: uppercase;
                                        border-bottom: 4px solid black;
                                        padding-bottom: 8px;
                                        margin-top: 24px;
                                        margin-bottom: 16px;
                                        line-height: 1.1;
                                    }
                                    .neo-mail-content h1 { font-size: 1.8rem; background-color: #67e8f9; display: inline-block; padding: 4px 8px; border: 4px solid black; box-shadow: 4px 4px 0px 0px black; }
                                    .neo-mail-content h2 { font-size: 1.5rem; }
                                    
                                    /* Le Texte courant */
                                    .neo-mail-content p, .neo-mail-content div {
                                        font-weight: 500;
                                        margin-bottom: 12px;
                                        line-height: 1.6;
                                        font-size: 1.05rem;
                                    }
                                    
                                    /* Surlignage du texte important */
                                    .neo-mail-content b, .neo-mail-content strong {
                                        font-weight: 900;
                                        background-color: #fef08a;
                                        padding: 0 4px;
                                        border-radius: 2px;
                                    }

                                    /* Les Liens (Boutons stylés) */
                                    .neo-mail-content a {
                                        color: black;
                                        font-weight: 900;
                                        text-decoration: none;
                                        background-color: #fde047;
                                        border: 2px solid black;
                                        padding: 2px 6px;
                                        box-shadow: 2px 2px 0px 0px black;
                                        display: inline-block;
                                        margin: 4px 0;
                                        transition: transform 0.1s, box-shadow 0.1s;
                                        word-break: break-all;
                                    }
                                    .neo-mail-content a:hover {
                                        transform: translate(2px, 2px);
                                        box-shadow: 0px 0px 0px 0px black;
                                        background-color: #67e8f9;
                                    }

                                    /* Les Listes */
                                    .neo-mail-content ul {
                                        list-style-type: square;
                                        padding-left: 24px;
                                        margin-bottom: 16px;
                                        font-weight: 700;
                                    }
                                    .neo-mail-content li { margin-bottom: 8px; }
                                    
                                    /* Les images (On limite la taille pour éviter que ça déborde) */
                                    .neo-mail-content img {
                                        max-width: 100%;
                                        height: auto;
                                        border: 4px solid black;
                                        box-shadow: 4px 4px 0px 0px black;
                                        margin: 16px 0;
                                    }
                                `}</style>

                                <div 
                                    className="neo-mail-content"
                                    dangerouslySetInnerHTML={{ __html: `<base href="https://partage.univ-rennes1.fr/" target="_blank" />` + selectedMail.body }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MailDashboard;
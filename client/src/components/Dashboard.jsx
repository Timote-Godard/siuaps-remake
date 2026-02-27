    import React, { useState } from 'react';
import { ClipboardClock, Dumbbell, BookOpen, UserRound, ArrowLeft } from 'lucide-react';

const Dashboard = ({ userData, onBack, onNavigateToSlots, onNavigateToRegistration }) => {

    const [activeTab, setActiveTab] = useState("rdv");
    // Variables de style pour simplifier le JSX
    const bgButtonActif = "bg-green-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]";
    const textButtonActif = "text-white md:translate-y-[4px] md:translate-x-[4px] md:shadow-none"; 
    const textButtonInActif = "text-gray-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:hover:translate-y-[-2px] md:hover:translate-x-[-2px] md:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]";
    const bgButtonHover = "hover:bg-green-100 bg-white hover:cursor-pointer";
    

    const bgButtonClickable = "active:text-white md:active:translate-y-[4px] md:active:translate-x-[4px] md:active:shadow-none hover:cursor-pointer text-black hover:bg-green-600 hover:text-white md:hover:translate-y-[-2px] md:hover:translate-x-[-2px] md:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]";

    

    return (
        // min-h-screen + flex + justify-center pour le centrage absolu
        <div className='relative min-w-screen min-h-screen pb-24 md:pb-0 bg-[url("src/assets/bgImage.jpg")] bg-cover bg-center bg-fixed flex flex-col justify-center items-center'>
            
            {/* Overlay léger pour la lisibilité si l'image est trop claire/sombre */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-3xl p-4 font-sans animate-in fade-in duration-100">
                
                {/* EN-TÊTE */}
                <header className="m    b-6 flex flex-col gap-4">

                    <button onClick={onBack} className="flex items-center gap-2 border-4 border-black text-white cursor-pointer font-black uppercase mb-4 ...">
                        <ArrowLeft size={20} /> Retour au Hub
                    </button>
                    {/* Infos profil */}
                    <div className="flex items-center w-full gap-4 bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h1 className="text-2xl sm:text-3xl font-bold italic tracking-tight">
                            Bonjour {userData?.name?.split(' ')[0] || "Étudiant"} !
                        </h1>
                    </div>

                    {/* Action principale */}
                    <div className='bg-white p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'>
                        <button 
                            onClick={onNavigateToRegistration}
                            className={`cursor-pointer bg-green-200 border-3 border-black px-4 py-3 font-bold w-full ${bgButtonClickable} transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
                        >
                            S'INSCRIRE À UNE ACTIVITÉ
                        </button>
                    </div>
                </header>

                {/* NAVIGATION */}
                

                {/* CONTENU PRINCIPAL */}
                <main className='bg-white p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:min-h-[700px] min-h-[400px]'>

                    <nav className="fixed bottom-0 left-0 w-full flex justify-center z-50 md:relative md:bottom-auto md:left-auto md:mb-6 md:z-10">
                    <div className="w-full max-w-3xl flex h-20 md:h-16 gap-3">
                        {[
                            { id: 'rdv', label: 'Agenda', icon: <ClipboardClock size={20} /> },
                            { id: 'activites', label: 'Sports', icon: <Dumbbell size={20} /> },
                            { id: 'enseignements', label: 'Cours', icon: <BookOpen size={20} /> },
                            { id: 'profil', label: 'Profil', icon: <UserRound size={20} /> }
                        ].map((tab) => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex flex-col justify-center items-center transition-all duration-100 border-2 border-black md:border-2 
                                    ${activeTab === tab.id ? bgButtonActif + " " + textButtonActif : bgButtonClickable + " " + textButtonInActif}`}
                            >
                                {tab.icon}
                                <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>
                    
                    {/* SECTION : Rendez-vous */}
                    {activeTab === 'rdv' && (
                        <section className="animate-in slide-in-from-bottom-2">
                            <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">PROCHAINS COURS</h2>

                            {userData.agenda.map((item, index) => (
                                <article key={index} className="border-2 border-black p-4 mb-4 flex justify-center items-center">
                                    <div>
                                        <h3 className="font-bold text-lg uppercase">{item.title}</h3>
                                        <p className="text-sm text-gray-500 pr-1">{item.type}</p>
                                    </div>
                                </article>
                            ))}
                            
                            
                            {/* <article className="border-2 border-black p-4 mb-4 flex justify-between items-center group hover:bg-gray-50 transition-colors">
                                <div>
                                    <h3 className="font-bold text-lg uppercase">Escalade</h3>
                                    <p className="text-gray-600">Jeudi 18 Novembre — 18h30</p>
                                    <p className="text-sm font-medium">📍 Halle des sports</p>
                                </div>
                                <div className="text-2xl">🧗</div>
                            </article> */}
                        </section>
                    )}

                    {/* SECTION : Activités */}
                    {activeTab === 'activites' && (
                        <section className="animate-in slide-in-from-bottom-2">
                            <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">MES INSCRIPTIONS</h2>
                            {userData.activites.map((item, index) => (
                                <article key={index} className="border-2 border-black p-4 mb-4 flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg uppercase">{item.title}</h3>
                                        <p className="text-sm text-gray-500 pr-1">{item.type}</p>
                                    </div>
                                    {item.paymentStatus ? <span className={`border-2 border-black px-3 py-1 text-xs uppercase font-black  ${item.paymentStatus === "paiement à effectuer" ? "bg-rose-600 text-white" : "bg-green-600 text-white"}`}>{item.paymentStatus}</span> : ""}
                                    
                                </article>
                            ))}
                            
                        </section>
                    )}

                    {/* SECTION : Enseignements */}
                    {activeTab === 'enseignements' && (
                        <section className="animate-in slide-in-from-bottom-2">
                            <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">MES ENSEIGNEMENTS</h2>
                            {userData.cours.map((item, index) => (
                                item.title === "Musculation" 
                                
                                ? 

                                <article key={index} className='border-2 border-black md:p-4 py-4 px-2 mb-4 flex flex flex-row items-center'>
                                    <h3 className='w-full font-bold text-lg ml-1 uppercase'>{item.title}</h3>
                                    <div className='flex flex-row w-full md:w-auto justify-end gap-2'>
                                        <button 
                                            // ON MET LE VRAI LIEN DU PLANNING BEAULIEU ICI
                                            onClick={() => onNavigateToSlots('/mod/scheduler/view.php?id=7140')} 
                                            className={`${bgButtonClickable} border-2 md:transition md:duration-100 border-black p-2 md:p-4 flex-1 md:flex-none flex justify-center items-center border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
                                        >
                                            <span className="font-bold text-sm md:text-lg uppercase">Beaulieu</span>
                                        </button>

                                        <button 
                                            // ON MET LE VRAI LIEN DU PLANNING VILLEJEAN ICI
                                            onClick={() => onNavigateToSlots('/mod/scheduler/view.php?id=7141')} 
                                            className={`${bgButtonClickable} border-2 md:transition md:duration-100 border-black p-2 md:p-4 flex-1 md:flex-none flex justify-center items-center border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}
                                        >
                                            <span className="font-bold text-sm md:text-lg uppercase">Villejean</span>
                                        </button>
                                    </div>
                                </article>

                                :


                                <article key={index}>
                                    <a href={item.link} className={`${bgButtonClickable} border-2 border-black p-4 mb-4 flex justify-between items-center`}>
                                        <h3 className="font-bold text-lg uppercase">{item.title}</h3>
                                    </a>
                                </article>
                            ))}
                            
                        </section>
                    )}

                    {/* SECTION : Profil / Déconnexion */}
                    {activeTab === 'profil' && (
                        <section className="animate-in slide-in-from-bottom-2">
                            <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">MON COMPTE</h2>
                            <div className="space-y-4">
                                <button className="w-full text-left p-4 border-2 border-black font-bold hover:bg-gray-100 transition-colors">
                                    MES INFOS PERSONNELLES
                                </button>
                            </div>
                        </section>
                    )}
                </main>
            </div>

            {/* NAVIGATION FIXE AVEC SHADOW TOP */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t-4 border-black flex justify-center z-50 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.15)]">
                <div className="w-full max-w-3xl flex h-20">
                    {[
                        { id: 'rdv', label: 'Agenda', icon: <ClipboardClock size={20} /> },
                        { id: 'activites', label: 'Sports', icon: <Dumbbell size={20} /> },
                        { id: 'enseignements', label: 'Cours', icon: <BookOpen size={20} /> },
                        { id: 'profil', label: 'Profil', icon: <UserRound size={20} /> }
                    ].map((tab) => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col justify-center items-center gap-1 transition-all duration-100 border-r border-black last:border-r-0
                                ${activeTab === tab.id ? bgButtonActif + " " + textButtonActif : bgButtonHover + " " + textButtonInActif}`}
                        >
                            {tab.icon}
                            <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
};

export default Dashboard;
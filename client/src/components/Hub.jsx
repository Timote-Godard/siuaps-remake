import React, { useState, useEffect } from 'react';
import { CalendarDays, Dumbbell, Mail, BookOpen } from 'lucide-react';
import EntDashboard from './EntDashboard';
import SiuapsDashboard from './SiuapsDashboard';
import MailDashboard from './MailDashboard'; // 👈 On importe le nouveau dashboard

const Hub = ({ userData, onLogout }) => {
    const [activeTab, setActiveTab] = useState('AGENDA');
    const [mailData, setMailData] = useState({ unreadCount: 0, recentMails: [], loading: true });

    useEffect(() => {
        const fetchMails = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/mails', {
                    credentials: 'include' 
                });
                const data = await res.json();
                
                if (data.success) {
                    setMailData({
                        unreadCount: data.unreadCount,
                        recentMails: data.recentMails,
                        loading: false
                    });
                } else {
                    setMailData(prev => ({ ...prev, loading: false }));
                }
            } catch (err) {
                setMailData(prev => ({ ...prev, loading: false }));
            }
        };
        fetchMails();
    }, []);

    return (
        <div className="h-screen w-screen flex flex-col bg-[#F0F0F0] overflow-hidden selection:bg-yellow-300">
            
            <div className="flex-1 overflow-y-auto md:pb-20 sm:pb-0"> 
                
                {activeTab === 'AGENDA' && (
                    <EntDashboard onBack={onLogout} />
                )}

                {activeTab === 'SPORT' && (
                    <SiuapsDashboard userData={userData} /> 
                )}

                {/* 🌟 ICI : ON REMPLACE LE BOUTON PAR LE DASHBOARD COMPLET */}
                {activeTab === 'MAILS' && (
                    <MailDashboard mailData={mailData} />
                )}

                {activeTab === 'MOODLE' && (
                    <div className="h-full flex items-center justify-center border-4 border-black m-4 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <a href="https://moodle.univ-rennes1.fr" target="_blank" rel="noreferrer" className="text-4xl font-black uppercase underline hover:text-green-600">
                            Ouvrir Moodle
                        </a>
                    </div>
                )}
            </div>

            <nav className="fixed bottom-0 left-0 w-full bg-white border-black flex z-50 shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] sm:static sm:shadow-none sm:border-t-0 sm:border-b-4">
                
                <NavButton 
                    id="AGENDA" current={activeTab} setTab={setActiveTab} 
                    icon={<CalendarDays size={24} strokeWidth={3} />} label="Agenda" bg="bg-yellow-300"
                />
                <NavButton 
                    id="SPORT" current={activeTab} setTab={setActiveTab} 
                    icon={<Dumbbell size={24} strokeWidth={3} />} label="Sport" bg="bg-pink-300"
                />
                
                {/* BOUTON NAV MAILS AVEC INDICATEUR */}
                <NavButton 
                    id="MAILS" current={activeTab} setTab={setActiveTab} 
                    icon={
                        <div className="relative">
                            <Mail size={24} strokeWidth={3} />
                            {mailData.unreadCount > 0 && (
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 border border-black rounded-full" />
                            )}
                        </div>
                    } 
                    label="Mails" bg="bg-cyan-300"
                />

                <NavButton 
                    id="MOODLE" current={activeTab} setTab={setActiveTab} 
                    icon={<BookOpen size={24} strokeWidth={3} />} label="Moodle" bg="bg-green-400"
                />
                
            </nav>
        </div>
    );
};

const NavButton = ({ id, current, setTab, icon, label, bg }) => {
    const isActive = current === id;
    return (
        <button 
            onClick={() => setTab(id)}
            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 border-r-4 border-black last:border-r-0 transition-all cursor-pointer
                ${isActive ? `${bg}` : 'bg-white hover:bg-gray-100'}`}
        >
            <div className={isActive ? "scale-110 transition-transform" : "opacity-70"}>
                {icon}
            </div>
            <span className={`text-[10px] font-black uppercase ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {label}
            </span>
        </button>
    );
};

export default Hub;
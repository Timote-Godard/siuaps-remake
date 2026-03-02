import React, { useState, useEffect } from 'react';
import { CalendarDays, Dumbbell, Mail, BookOpen, LogOut } from 'lucide-react';
import EntDashboard from './EntDashboard';
import SiuapsDashboard from './SiuapsDashboard';
import MailDashboard from './MailDashboard';
import MoodleDashboard from './MoodleDashboard'; // 👈 On importe le MoodleDashboard

const Hub = ({ userData, mailData, moodleData, onLogout, activeTab, setActiveTab, onNavigateToSlots, onNavigateToRegistration, activeTabSiuaps, setActiveTabSiuaps }) => {
    
    return (
        <div className="h-screen w-screen flex flex-col bg-[#F0F0F0] overflow-hidden selection:bg-yellow-300">
            
            <div className="flex-1 overflow-y-auto md:pb-20 sm:pb-0"> 
                
                {activeTab === 'AGENDA' && (
                    <EntDashboard onBack={onLogout} />
                )}

                {activeTab === 'SPORT' && (
                    <SiuapsDashboard 
                        userData={userData}
                        onNavigateToSlots={onNavigateToSlots}
                        onNavigateToRegistration={onNavigateToRegistration}
                        activeTab={activeTabSiuaps}
                        setActiveTab={setActiveTabSiuaps}
                    /> 
                )}

                {activeTab === 'MAILS' && (
                    <MailDashboard mailData={mailData} />
                )}

                {/* 🌟 ICI : On passe la prop moodleData reçue de App.jsx */}
                {activeTab === 'MOODLE' && (
                    <MoodleDashboard moodleData={moodleData} onLogout={onLogout} />
                )}
            </div>

            <nav className="fixed bottom-0 left-0 w-full bg-white border-black flex z-50 shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] sm:static sm:shadow-none sm:border-t-0 sm:border-b-4">
                
                <NavButton 
                    id="AGENDA" current={activeTab} setTab={setActiveTab} 
                    icon={<CalendarDays size={24} strokeWidth={3} />} label="Agenda" bg="bg-yellow-300"
                />
                <NavButton 
                    id="SPORT" current={activeTab} setTab={setActiveTab} 
                    icon={<Dumbbell size={24} strokeWidth={3} />} label="Sport" bg="bg-green-400"
                />
                
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
                    icon={<BookOpen size={24} strokeWidth={3} />} label="Moodle" bg="bg-pink-300"
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
import React from 'react';
import { Trophy, GraduationCap, LogOut } from 'lucide-react';

const Hub = ({ studentName, onSelect, onLogout }) => {
    return (
        <div className="min-h-screen bg-white p-4 sm:p-8 flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">
            
            <div className="w-full flex justify-between items-center mb-12">
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
                    Bonjour, <br className="sm:hidden" />
                    <span className="text-black">{studentName}</span>
                </h1>
                
                <button 
                    onClick={onLogout}
                    className="cursor-pointer flex items-center gap-2 border-4 border-black p-2 sm:px-4 sm:py-2 font-black uppercase bg-white hover:bg-red-400 hover:text-black transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                    <LogOut size={20} strokeWidth={3} />
                    <span className="hidden sm:inline">Quitter</span>
                </button>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                
                {/* CARTE SIUAPS */}
                <button 
                    onClick={() => onSelect('SIUAPS')}
                    className="cursor-pointer text-left border-4 border-black bg-green-500 p-8 sm:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 active:shadow-none active:translate-x-2 active:translate-y-2 transition-all flex flex-col items-center md:items-start"
                >
                    <h2 className="text-4xl font-black uppercase mb-2 text-center md:text-left">Portail<br/>SIUAPS</h2>
                </button>

                {/* CARTE ENT */}
                <button 
                    onClick={() => onSelect('ENT')}
                    className="cursor-pointer text-left border-4 border-black bg-cyan-300 p-8 sm:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 active:shadow-none active:translate-x-2 active:translate-y-2 transition-all flex flex-col items-center md:items-start"
                >
                    <h2 className="text-4xl font-black uppercase mb-2 text-center md:text-left">Portail<br/>E.N.T.</h2>
                </button>

            </div>
        </div>
    );
};

export default Hub;
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import SiuapsDashboard from './components/SiuapsDashboard';
import Validations from './components/Validations'; 
import Registration from './components/Registration';
import Hub from './components/Hub';
import EntDashboard from './components/EntDashboard'; // À créer plus tard

const App = () => {
  const [userData, setUserData] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [activeTab, setActiveTab] = useState('AGENDA');
  const [activeTabSiuaps, setActiveTabSiuaps] = useState("rdv");
  
  // 🧭 LA BOUSSOLE DE L'APPLICATION (Au lieu des vieux booléens)
  // Valeurs possibles : 'LOGIN', 'HUB', 'SIUAPS_DASHBOARD', 'SIUAPS_VALIDATIONS', 'SIUAPS_REGISTRATION', 'ENT_DASHBOARD'
  const [currentStep, setCurrentStep] = useState('LOGIN'); 
  const [selectedUrl, setSelectedUrl] = useState(null); // Toujours utile pour passer l'URL aux validations
  const [mailData, setMailData] = useState({ unreadCount: 0, recentMails: [], loading: true });

  // 1. VÉRIFICATION AU LANCEMENT
  useEffect(() => {
    if (localStorage.getItem('siuaps_data')) {
      setIsCheckingSession(true);
      const checkSession = async () => {
        try {
          const res = await fetch('https://7c34f7875b6405.lhr.life/api/verify');
          const data = await res.json();

          if (data.success) {
            const savedData = localStorage.getItem('siuaps_data');
            if (savedData) {
              setUserData(JSON.parse(savedData));
              // Si connecté -> On va direct sur le HUB !
              setCurrentStep('HUB'); 
            }
          } else {
            // Si la session a expiré sur le serveur, on nettoie
            localStorage.removeItem('siuaps_data');
            setCurrentStep('LOGIN');
          }
        } catch (error) {
          console.error("Impossible de joindre le serveur", error);
        } finally {
          setIsCheckingSession(false);
        }
      };
      checkSession();
    }


    const fetchMails = async () => {
            try {
                const res = await fetch('https://7c34f7875b6405.lhr.life/api/mails', {
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


  // 2. ACTIONS GLOBALES
  const handleLogout = async () => {
    await fetch('https://7c34f7875b6405.lhr.life/api/logout', { method: 'POST' });
    setUserData(null);
    localStorage.removeItem('siuaps_data');
    setCurrentStep('LOGIN'); // Retour à la case départ
  };

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    localStorage.setItem('siuaps_data', JSON.stringify(data.user));
    setCurrentStep('HUB'); // Après le login -> Direction le HUB
  };

  // ÉCRAN DE CHARGEMENT BRUTALISTE
  if (isCheckingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white border-8 border-green-600">
        <h1 className="text-4xl font-green-600 uppercase tracking-tighter">SIUAPS</h1>
        <p className="font-bold text-sm bg-green-600 text-white px-2 py-1 mt-2 uppercase animate-pulse">Connexion automatique...</p>
      </div>
    );
  }

  // 3. LE ROUTEUR VISUEL (Très propre et facile à lire)
  return (
    <div className="app-container bg-white min-h-screen">
      
      {currentStep === 'LOGIN' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}

      {currentStep === 'HUB' && (
        <Hub 
          userData={userData}
          onLogout={handleLogout}
          onNavigateToSlots={(url) => { 
              setSelectedUrl(url); 
              setCurrentStep('SIUAPS_VALIDATIONS'); 
          }}
          mailData={mailData}
          setActiveTabSiuaps={setActiveTabSiuaps}
          activeTabSiuaps={activeTabSiuaps}

          setActiveTab={setActiveTab}
          activeTab={activeTab}
          onNavigateToRegistration={() => setCurrentStep('SIUAPS_REGISTRATION')}
        />
      )}

      {currentStep === 'SIUAPS_VALIDATIONS' && (
        <Validations 
          url={selectedUrl} 
          onBack={() => {setCurrentStep('HUB');}} 
        />
      )}

      {currentStep === 'SIUAPS_REGISTRATION' && (
        <Registration 
          onBack={() => setCurrentStep('HUB')} 
        />
      )}

    </div>
  );
};

export default App;
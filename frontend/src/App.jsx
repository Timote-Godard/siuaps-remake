import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import SiuapsDashboard from './components/SiuapsDashboard';
import Validations from './components/Validations'; 
import Registration from './components/Registration';
import Hub from './components/Hub';
// import EntDashboard from './components/EntDashboard'; // À créer plus tard

const App = () => {
  const [userData, setUserData] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [activeTab, setActiveTab] = useState('AGENDA');
  const [activeTabSiuaps, setActiveTabSiuaps] = useState("rdv");
  
  const [currentStep, setCurrentStep] = useState('LOGIN'); 
  const [selectedUrl, setSelectedUrl] = useState(null);
  
  const [mailData, setMailData] = useState({ unreadCount: 0, recentMails: [], loading: true });
  // 🌟 Modification ici : on prépare un bel état pour Moodle
  const [moodleData, setMoodleData] = useState({ courses: [], loading: true, error: null });

  // 🌟 NOUVELLE FONCTION : Charge les données secondaires une fois connecté
  const loadBackgroundData = async () => {
    // 1. Chargement des Mails
    const fetchMails = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/mails', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setMailData({ unreadCount: data.unreadCount, recentMails: data.recentMails, loading: false });
        } else {
          setMailData(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        setMailData(prev => ({ ...prev, loading: false }));
      }
    };

    // 2. Chargement de Moodle
    const fetchMoodle = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/moodle/courses', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setMoodleData({ courses: data.courses, loading: false, error: null });
        } else {
          setMoodleData({ courses: [], loading: false, error: data.error || "Erreur serveur" });
        }
      } catch (err) {
        setMoodleData({ courses: [], loading: false, error: "Impossible de joindre le serveur" });
      }
    };

    await fetchMails();
    await fetchMoodle();
  };

  // VÉRIFICATION AU LANCEMENT
  useEffect(() => {
    if (localStorage.getItem('siuaps_data')) {
      setIsCheckingSession(true);
      const checkSession = async () => {
        try {
          const res = await fetch('http://localhost:5000/api/verify');
          const data = await res.json();

          if (data.success) {
            const savedData = localStorage.getItem('siuaps_data');
            if (savedData) {
              setUserData(JSON.parse(savedData));
              setCurrentStep('HUB'); 
              loadBackgroundData(); // 🌟 Lancement des chargements invisibles
            }
          } else {
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
  }, []);


  // ACTIONS GLOBALES
  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/logout', { method: 'POST' });
    setUserData(null);
    localStorage.removeItem('siuaps_data');
    // On réinitialise les états
    setMailData({ unreadCount: 0, recentMails: [], loading: true });
    setMoodleData({ courses: [], loading: true, error: null });
    setCurrentStep('LOGIN');
  };

  const handleLoginSuccess = (data) => {
    setUserData(data.user);
    localStorage.setItem('siuaps_data', JSON.stringify(data.user));
    setCurrentStep('HUB'); 
    loadBackgroundData(); // 🌟 Lancement des chargements invisibles juste après le login
  };

  // ÉCRAN DE CHARGEMENT
  if (isCheckingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white border-8 border-green-600">
        <h1 className="text-4xl font-green-600 uppercase tracking-tighter">SIUAPS</h1>
        <p className="font-bold text-sm bg-green-600 text-white px-2 py-1 mt-2 uppercase animate-pulse">Connexion automatique...</p>
      </div>
    );
  }

  // LE ROUTEUR VISUEL
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
          moodleData={moodleData} // 🌟 On passe les données Moodle au Hub
          setActiveTabSiuaps={setActiveTabSiuaps}
          activeTabSiuaps={activeTabSiuaps}
          setActiveTab={setActiveTab}
          activeTab={activeTab}
          onNavigateToRegistration={() => setCurrentStep('SIUAPS_REGISTRATION')}
        />
      )}

      {currentStep === 'SIUAPS_VALIDATIONS' && (
        <Validations url={selectedUrl} onBack={() => {setCurrentStep('HUB');}} />
      )}

      {currentStep === 'SIUAPS_REGISTRATION' && (
        <Registration onBack={() => setCurrentStep('HUB')} />
      )}

    </div>
  );
};

export default App;
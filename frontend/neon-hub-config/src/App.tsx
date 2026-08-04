import React, { useState, useEffect } from 'react';
import './App.css'
import { BrowserRouter as Router } from 'react-router-dom';
import HubManagementUI from './components/HubManagementUI'
import NodeServices from './components/NodeServices';
import ConnectedDevices from './components/ConnectedDevices';
import HubUpdates from './components/HubUpdates';
import Header from './components/Header';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import LogoutButton from './components/LogoutButton';
import Advanced from './components/Advanced';

const AppContent: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'config');

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
  }, []);

  // The theme class must live on the document root, not just app-container:
  // index.css styles html/body (page background, buttons) and #root adds
  // padding around the app, so a root-level mismatch shows through as a
  // wrong-colored frame around the UI.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const toggleDarkMode = () => setIsDark(!isDark);

    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
      return <Login />;
    }

  return (
    <Router>
      <div className={`app-container ${isDark ? 'dark' : ''}`}>
        <Header isDark={isDark} toggleDarkMode={toggleDarkMode} />
        
        <div className="tab-navigation">
          <button onClick={() => setActiveTab('config')}>Configuration</button>
          <button onClick={() => setActiveTab('services')}>Node Services</button>
          <button onClick={() => setActiveTab('devices')}>Connected Devices</button>
          <button onClick={() => setActiveTab('updates')}>System Updates</button>
          <button onClick={() => setActiveTab('advanced')}>Advanced</button>
          <LogoutButton />
        </div>

        <div className="content-area">
          {activeTab === 'config' && <HubManagementUI isDark={isDark} />}
          {activeTab === 'services' && <NodeServices isDark={isDark} />}
          {activeTab === 'devices' && <ConnectedDevices isDark={isDark} />}
          {activeTab === 'updates' && <HubUpdates isDark={isDark} />}
          {activeTab === 'advanced' && <Advanced isDark={isDark} />}
        </div>
      </div>
    </Router>
  )
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
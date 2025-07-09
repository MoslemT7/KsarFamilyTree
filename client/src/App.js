import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import Header from './components/Header';
import FamilyTree from './components/FamilyTree';
import RelationPage from './components/RelationChecker';
import StatisticsDashboard from './components/StatisticsDashboard';
import SearchPage from './components/SearchPage';
import MainPage from './components/mainPage';
import Footer from './components/Footer';
import usePageTracking from './utils/trackers';
import './styles/app.css';
import 'react-toastify/dist/ReactToastify.css';


const App = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(prev => !prev);
  const location = useLocation();
  
  usePageTracking();
  const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
      window.scrollTo(0, 0);
    }, [pathname]);

    return null;
  };
  return (
    <div className="app-container">
       <ScrollToTop />
      <Header toggleMenu={toggleMenu} />
      

      <div className="main-container">
        <ToastContainer position="top-center" autoClose={2000} />
        <div className="content">
          <Routes>
            <Route path="" element={<MainPage />} />
            <Route path="familyTree" element={<FamilyTree />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="statistics" element={<StatisticsDashboard />} />
            <Route path="relationChecker" element={<RelationPage />} />
          </Routes>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default App;
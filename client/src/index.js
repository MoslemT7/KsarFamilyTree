import React from 'react';
import ReactDOM from 'react-dom/client'; // Use 'react-dom/client' in React 18+
import App from './App'; // Adjust if the App file is located elsewhere
import MainPage from './components/mainPage';

// Main App Component
const CommingSoon = () => {
  const styles = {
    container: {
      height: '100vh',
      backgroundColor: '#0e1a2b',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      textAlign: 'center'
    },
    heading: {
      fontSize: '3em',
      fontFamily: "Cairo"
    },
    paragraph: {
      fontSize: '1.2em',
      color: '#ccc'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🚧 قريبا ...</h1>

    </div>
  );
};


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


export default CommingSoon;

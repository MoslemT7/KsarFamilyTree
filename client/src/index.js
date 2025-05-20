import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider} from '@chakra-ui/react';
import App from './App';

const ComingSoonPhaseOne = () => {

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-text wave">...شيءٌ كبير قادم</div>
      <div className="coming-soon-orb"></div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ChakraProvider>
    <App />
  </ChakraProvider>
  </React.StrictMode>
);


export default ComingSoonPhaseOne;

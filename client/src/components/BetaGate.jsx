import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function BetaGate() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleAccess = () => {
    if (code === '06610326mos') {
      navigate('/06610326mos');
    } else {
      alert('رمز غير صحيح');
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h2>صفحة الوصول التجريبي</h2>
      <input
        type="text"
        placeholder="أدخل رمز الوصول"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button onClick={handleAccess}>دخول</button>
    </div>
  );
}

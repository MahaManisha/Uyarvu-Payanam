import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MaintenancePage from '../../pages/public/MaintenancePage';
import { API_BASE_URL } from '../../../config/apiConfig';

export default function MaintenanceGuard({ children }) {
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkMaintenance = async () => {
      try {
        // Use direct axios for public check to avoid interceptors potentially blocking
        const res = await axios.get(`${API_BASE_URL}/settings/public`, { timeout: 3500 });
        if (isMounted && res.data && res.data.maintenanceMode) {
          setMaintenance(true);
        }
      } catch (e) {
        // Silent fail: do not block the app if maintenance endpoint is unavailable or slow
        console.warn('Maintenance check skipped or unreachable:', e?.message || e);
      }
    };
    checkMaintenance();

    return () => {
      isMounted = false;
    };
  }, []);

  if (maintenance) return <MaintenancePage />;
  
  return children;
}

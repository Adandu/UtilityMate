import { useState, useEffect } from 'react';
import api from '../utils/api';
import { clearAuthToken, getAuthToken } from '../utils/authToken';

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  theme_pref: string;
  dashboard_config?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
      } catch {
        clearAuthToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, loading, setUser };
};

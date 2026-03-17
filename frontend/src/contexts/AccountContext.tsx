import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface TradingAccount {
  id: number;
  account_name: string;
  platform: string;
  broker_name: string;
  account_number: string;
  last_balance: number;
  last_equity: number;
  currency: string;
  is_default: boolean;
}

interface AccountContextType {
  currentAccount: TradingAccount | null;
  accounts: TradingAccount[];
  loading: boolean;
  switchAccount: (accountId: number) => void;
  refreshAccounts: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState<TradingAccount | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await axios.get('http://localhost:8000/api/v1/accounts-multi/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAccounts(response.data);
      
      // Set default account as current
      const defaultAccount = response.data.find((acc: TradingAccount) => acc.is_default);
      if (defaultAccount) {
        setCurrentAccount(defaultAccount);
      } else if (response.data.length > 0) {
        setCurrentAccount(response.data[0]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      setLoading(false);
    }
  };

  const switchAccount = async (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      setCurrentAccount(account);
      
      // Optionally set as default on backend
      try {
        const token = localStorage.getItem('access_token');
        await axios.post(
          `http://localhost:8000/api/v1/accounts-multi/${accountId}/set-default`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Failed to set default account:', error);
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <AccountContext.Provider value={{
      currentAccount,
      accounts,
      loading,
      switchAccount,
      refreshAccounts: fetchAccounts
    }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

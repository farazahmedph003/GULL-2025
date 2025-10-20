import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface TopupRequest {
  id: string;
  userId: string;
  userEmail: string;
  currentBalance: number;
  requestedAmount?: number;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
}

const STORAGE_KEY = 'topup_requests';

export const useTopupRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Load requests from localStorage
  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRequests(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading top-up requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRequests = useCallback((newRequests: TopupRequest[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequests));
      setRequests(newRequests);
    } catch (error) {
      console.error('Error saving top-up requests:', error);
    }
  }, []);

  // Create a new top-up request
  const createRequest = useCallback((currentBalance: number, requestedAmount?: number, message?: string) => {
    if (!user || !user.email) return false;

    const newRequest: TopupRequest = {
      id: `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      userEmail: user.email,
      currentBalance,
      requestedAmount,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRequests = [...requests, newRequest];
    saveRequests(updatedRequests);
    return true;
  }, [user, requests, saveRequests]);

  // Update request status (admin only)
  const updateRequestStatus = useCallback((requestId: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    const updatedRequests = requests.map(request => {
      if (request.id === requestId) {
        return {
          ...request,
          status,
          adminNotes,
          updatedAt: new Date().toISOString(),
        };
      }
      return request;
    });

    saveRequests(updatedRequests);
  }, [requests, saveRequests]);

  // Get pending requests count (for admin notification badge)
  const getPendingCount = useCallback(() => {
    return requests.filter(req => req.status === 'pending').length;
  }, [requests]);

  // Get user's own requests
  const getUserRequests = useCallback(() => {
    if (!user) return [];
    return requests.filter(req => req.userId === user.id);
  }, [user, requests]);

  // Get all requests (admin only)
  const getAllRequests = useCallback(() => {
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests]);

  return {
    requests,
    loading,
    createRequest,
    updateRequestStatus,
    getPendingCount,
    getUserRequests,
    getAllRequests,
  };
};

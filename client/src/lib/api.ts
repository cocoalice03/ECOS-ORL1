import { apiRequest } from "./queryClient";

// API functions for ECOS
export const api = {
  // Get all students assigned to training sessions (for teacher view)
  async getTeacherStudents(email: string): Promise<any> {
    const res = await apiRequest(
      "GET",
      `/api/teacher/students?email=${encodeURIComponent(email)}`
    );
    return await res.json();
  }
};

import { useQuery } from '@tanstack/react-query';

export const teacherApi = {
  getDashboard: async (email: string) => {
    const data = await apiRequest('GET', `/api/teacher/dashboard?email=${encodeURIComponent(email)}`);
    console.log('API dashboard response:', data);
    return data;
  },

  getScenarios: async (email: string) => {
    console.log('🔄 [DEBUG] teacherApi.getScenarios called with email:', email);
    const url = `/api/teacher/scenarios?email=${encodeURIComponent(email)}`;
    console.log('🔄 [DEBUG] API URL:', url);
    
    const data = await apiRequest('GET', url);
    console.log('📊 [DEBUG] teacherApi.getScenarios raw response:', data);
    console.log('📊 [DEBUG] teacherApi.getScenarios scenarios count:', data?.scenarios?.length || 0);
    return data;
  },

  getIndexes: async (email: string) => {
    console.log('API: Fetching indexes for email:', email);
    const url = `/api/admin/indexes?email=${encodeURIComponent(email)}`;
    console.log('API: Request URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('API: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API: Error response:', errorText);
      throw new Error(`Failed to fetch indexes: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('API: Indexes response data:', data);
    return data;
  },

  generateCriteria: async (email: string, textCriteria: string, scenarioId?: string | number) => {
    console.log('🔄 Generating criteria for teacher:', email);
    console.log('📝 Text criteria:', textCriteria.substring(0, 100) + '...');
    console.log('🆔 Scenario ID:', scenarioId);

    const data = await apiRequest('POST', '/api/teacher/generate-criteria', {
      email,
      textCriteria,
      scenarioId: scenarioId || undefined
    });

    console.log('✅ Criteria generation response:', data);
    return data;
  },

  updatePineconeIndex: async (email: string, scenarioId: string | number, pineconeIndex: string) => {
    console.log('🔄 Updating Pinecone index for scenario:', scenarioId, 'to index:', pineconeIndex);

    const data = await apiRequest('POST', '/api/teacher/update-pinecone-index', {
      email,
      scenarioId,
      pineconeIndex
    });

    console.log('✅ Pinecone index update response:', data);
    return data;
  },
};

// FirestoreService removed - using Supabase API instead

// Updated version to use Supabase API
export const useDashboardData = (email: string) => {
  return useQuery({
    queryKey: ['dashboard-data', email],
    queryFn: async () => {
      console.log('🔄 Fetching dashboard data for:', email);

      try {
        // Use new Supabase-based API endpoints
        const response = await teacherApi.getDashboard(email);
        console.log('📊 Dashboard data loaded:', response);
        return response;
      } catch (error) {
        console.error('❌ Dashboard data error:', error);
        throw error;
      }
    },
    enabled: !!email,
    retry: 1
  });
};

export const useAvailableIndexes = (email: string) => {
  return useQuery({
    queryKey: ['available-indexes', email],
    queryFn: async () => {
      const response = await fetch(`/api/admin/indexes?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch indexes');
      }

      const data = await response.json();
      return data.indexes || [];
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useTeacherStudents = (email: string) => {
  return useQuery({
    queryKey: ['teacher-students', email],
    queryFn: async () => {
      const data = await api.getTeacherStudents(email);
      return data.students || [];
    },
    enabled: !!email,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useTeacherScenarios = (email: string) => {
  return useQuery({
    queryKey: ['teacher-scenarios', email],
    queryFn: async () => {
      console.log('🔄 [DEBUG] Fetching teacher scenarios for email:', email);
      console.log('🔄 [DEBUG] Email is valid?', !!email);
      
      if (!email) {
        console.warn('❌ [DEBUG] No email provided to useTeacherScenarios');
        return [];
      }
      
      const data = await teacherApi.getScenarios(email);
      console.log('📊 [DEBUG] Raw API response:', data);
      console.log('📊 [DEBUG] Scenarios in response:', data?.scenarios);
      console.log('📊 [DEBUG] Number of scenarios:', data?.scenarios?.length || 0);
      
      const scenarios = data?.scenarios || [];
      console.log('📊 [DEBUG] Final scenarios array:', scenarios);
      return scenarios;
    },
    enabled: !!email,
    retry: 1,
    staleTime: 0, // Force fresh queries
    cacheTime: 0  // Don't cache results
  });
};
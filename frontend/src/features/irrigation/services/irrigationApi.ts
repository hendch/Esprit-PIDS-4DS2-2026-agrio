import axios from 'axios';
import { Platform } from 'react-native';


const API_BASE_URL = Platform.OS === 'android' ? 'http://192.168.1.16:8000' : 'http://192.168.1.16:8000';

export interface IrrigationDecisionResponse {
  decision: string;
}

export const irrigationApi = {
  checkIrrigation: async (crop: string, lat: number, lon: number): Promise<IrrigationDecisionResponse> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/check-irrigation`, {
        crop,
        lat,
        lon
      });
      return response.data;
    } catch (error) {
      console.error('Error checking irrigation API:', error);
      throw error;
    }
  },
};


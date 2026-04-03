import { httpClient } from "../../core/api/httpClient";

export type ScanResultDTO = {
  id: string;
  user_id: string;
  field_id: string | null;
  disease_name: string | null;
  confidence: number | null;
  severity: string | null;
  plant_name: string | null;
  is_healthy: boolean;
  guidance: string | null;
  scanned_at: string;
};

export type SaveScanPayload = {
  disease_name: string;
  confidence: number;
  severity: string;
  plant_name: string;
  is_healthy: boolean;
  guidance?: string;
  field_id?: string;
};

export async function saveScan(payload: SaveScanPayload): Promise<ScanResultDTO> {
  const { data } = await httpClient.post<ScanResultDTO>("/api/v1/disease/scan", payload);
  return data;
}

export async function fetchScanHistory(): Promise<ScanResultDTO[]> {
  const { data } = await httpClient.get<{ scans: ScanResultDTO[] }>("/api/v1/disease/history");
  return data.scans;
}

export async function fetchScanDetail(scanId: string): Promise<ScanResultDTO> {
  const { data } = await httpClient.get<ScanResultDTO>(`/api/v1/disease/scan/${scanId}`);
  return data;
}

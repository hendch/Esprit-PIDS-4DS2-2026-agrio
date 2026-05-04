import { Platform } from "react-native";

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

// ── Segmentation (online) ────────────────────────────────────

export type SegmentationRegion = {
  class_name: string;
  confidence: number;
  bbox: number[];
};

export type SegmentationResultDTO = {
  annotated_image: string; // base64 JPEG
  regions: SegmentationRegion[];
  total_regions: number;
};

/**
 * Send an image to the backend for YOLOv8 segmentation.
 * Returns annotated image (base64) + detected regions.
 */
export async function requestSegmentation(imageUri: string): Promise<SegmentationResultDTO> {
  const formData = new FormData();

  const fileName = imageUri.split("/").pop() ?? "photo.jpg";
  formData.append("image", {
    uri: Platform.OS === "android" ? imageUri : imageUri.replace("file://", ""),
    name: fileName,
    type: "image/jpeg",
  } as any);

  const { data } = await httpClient.post<SegmentationResultDTO>(
    "/api/v1/disease/segment",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000, // segmentation can take a few seconds
    },
  );
  return data;
}

// ── LLM advice + follow-up chat ─────────────────────────────

export type AdvicePayload = {
  disease_name: string;
  plant_name: string;
  confidence: number;
  severity: string;
  is_healthy: boolean;
  locale: "en" | "ar";
};

export type AdviceResponseDTO = {
  advice: string;
  source: "llm" | "fallback";
};

export async function requestAdvice(payload: AdvicePayload): Promise<AdviceResponseDTO> {
  const { data } = await httpClient.post<AdviceResponseDTO>(
    "/api/v1/disease/advice",
    payload,
    { timeout: 30_000 },
  );
  return data;
}

export type ChatTurnDTO = { role: "user" | "assistant"; content: string };

export type ChatRequestPayload = {
  message: string;
  history: ChatTurnDTO[];
  locale: "en" | "ar";
  original_advice?: string;
};

export type ChatResponseDTO = { reply: string };

export async function sendChatMessage(
  scanId: string,
  payload: ChatRequestPayload,
): Promise<ChatResponseDTO> {
  const { data } = await httpClient.post<ChatResponseDTO>(
    `/api/v1/disease/scan/${scanId}/chat`,
    payload,
    { timeout: 30_000 },
  );
  return data;
}

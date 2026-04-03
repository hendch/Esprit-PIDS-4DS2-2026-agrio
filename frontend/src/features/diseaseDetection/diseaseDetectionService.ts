import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import * as ImageManipulator from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import { Buffer } from 'buffer';

// Must match training preprocessing exactly
const MEAN = [0.485, 0.456, 0.406];
const STD  = [0.229, 0.224, 0.225];
const IMG_SIZE = 260;

const CLASS_NAMES = [
  "Apple__Apple_scab", "Apple__Black_rot", "Apple__Cedar_apple_rust", "Apple__healthy",
  "Blueberry__healthy", "Cherry_(including_sour)__Powdery_Mildew",
  "Cherry_(including_sour)__healthy", "Corn_(maize)__Cercospora_leaf_spot Gray_leaf_spot",
  "Corn_(maize)__Common_rust_", "Corn_(maize)__Northern_Leaf_Blight", "Corn_(maize)__healthy",
  "Grape__Black_rot", "Grape__Esca_(Black_Measles)",
  "Grape__Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape__healthy",
  "Orange__Haunglongbing_(Citrus_greening)", "Peach__Bacterial_spot", "Peach__healthy",
  "Potato__Early_blight", "Potato__Late_blight", "Potato__healthy",
  "Strawberry__Leaf_scorch", "Strawberry__healthy",
  "Tomato__Bacterial_spot", "Tomato__Early_blight", "Tomato__Late_blight",
  "Tomato__Leaf_Mold", "Tomato__Septoria_leaf_spot",
  "Tomato__Spider_mites Two-spotted_spider_mite", "Tomato__Tomato_mosaic_virus",
  "Tomato__healthy"
];

let model: TensorflowModel | null = null;

export async function loadModel(): Promise<void> {
  if (model) return;
  model = await loadTensorflowModel(
    require('../../../assets/model/efficientnet_plantvillage.tflite')
  );
  console.log('✅ TFLite model loaded');
}

export type DiagnosisResult = {
  name: string;
  displayName: string;
  confidence: number;
  plant: string;
  disease: string;
  isHealthy: boolean;
  top3: { name: string; displayName: string; confidence: number }[];
};

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

function formatClassName(raw: string): string {
  const parts = raw.split('__');
  const plant = parts[0].replace(/_/g, ' ');
  const condition = parts.length > 1
    ? parts[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
    : 'Unknown';
  return `${plant} - ${condition}`;
}

function parseClassName(raw: string): { plant: string; disease: string; isHealthy: boolean } {
  const parts = raw.split('__');
  const plant = parts[0].replace(/_/g, ' ');
  const disease = parts.length > 1 ? parts[1].replace(/_/g, ' ') : 'Unknown';
  return { plant, disease, isHealthy: disease.toLowerCase() === 'healthy' };
}

/**
 * Preprocess image: resize → decode JPEG → normalize with ImageNet stats
 * Output: Float32Array in NHWC format [1, 260, 260, 3]
 */
async function preprocessImage(imageUri: string): Promise<Float32Array> {
  // 1. Resize to 260x260 JPEG
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: IMG_SIZE, height: IMG_SIZE } }],
    { base64: true, format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
  );
  if (!resized.base64) throw new Error('Failed to resize image');

  // 2. Decode JPEG base64 → raw RGBA pixels
  const jpegBuffer = Buffer.from(resized.base64, 'base64');
  const { data: rgbaPixels, width, height } = jpeg.decode(jpegBuffer, { useTArray: true });

  // 3. Normalize: scale to [0,1] then apply ImageNet mean/std
  // Output format: [H, W, C] = [260, 260, 3] (channels-last for TFLite)
  const inputTensor = new Float32Array(IMG_SIZE * IMG_SIZE * 3);

  for (let i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
    const rgbaIdx = i * 4; // RGBA has 4 channels
    const rgbIdx = i * 3;  // our tensor has 3 channels

    // Scale 0-255 → 0-1, then normalize with ImageNet stats
    inputTensor[rgbIdx]     = ((rgbaPixels[rgbaIdx]     / 255.0) - MEAN[0]) / STD[0]; // R
    inputTensor[rgbIdx + 1] = ((rgbaPixels[rgbaIdx + 1] / 255.0) - MEAN[1]) / STD[1]; // G
    inputTensor[rgbIdx + 2] = ((rgbaPixels[rgbaIdx + 2] / 255.0) - MEAN[2]) / STD[2]; // B
  }

  return inputTensor;
}

export async function diagnoseImage(imageUri: string): Promise<DiagnosisResult> {
  if (!model) await loadModel();
  if (!model) throw new Error('Model failed to load');

  // Preprocess: resize + normalize (matches PyTorch training exactly)
  const inputTensor = await preprocessImage(imageUri);

  // Run inference
  const output = model.runSync([inputTensor]);
  const logits = Array.from(output[0] as Float32Array);

  // Apply softmax to get probabilities
  const probs = softmax(logits);

  // Sort by confidence
  const indexed = probs.map((p, i) => ({ index: i, prob: p }));
  indexed.sort((a, b) => b.prob - a.prob);

  const top3 = indexed.slice(0, 3).map(item => ({
    name: CLASS_NAMES[item.index],
    displayName: formatClassName(CLASS_NAMES[item.index]),
    confidence: Math.round(item.prob * 100),
  }));

  const bestIdx = indexed[0].index;
  const { plant, disease, isHealthy } = parseClassName(CLASS_NAMES[bestIdx]);

  return {
    name: CLASS_NAMES[bestIdx],
    displayName: formatClassName(CLASS_NAMES[bestIdx]),
    confidence: Math.round(indexed[0].prob * 100),
    plant,
    disease,
    isHealthy,
    top3,
  };
}
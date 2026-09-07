/**
 * modelLoader.ts — TensorFlow.js WebGL initializer & model singleton cache
 *
 * Responsibilities:
 *  1. Boot the WebGL backend (fastest in-browser GPU path)
 *  2. Load MoveNet MultiPose Lightning for real-time multi-person pose estimation
 *  3. Load COCO-SSD for vehicle & object detection (accident + weapon engines)
 *  4. Cache both models as module-level singletons so subsequent calls are instant
 *  5. Configure WebGL memory safeguards to prevent GPU memory leaks
 *
 * Usage (called once inside CameraFeed.tsx useEffect):
 *   const { poseDetector, objectDetector } = await loadModels();
 */

import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// ─────────────────────────────────────────────
// Singleton cache
// ─────────────────────────────────────────────

let _poseDetector: poseDetection.PoseDetector | null = null;
let _objectDetector: cocoSsd.ObjectDetection | null = null;
let _loadPromise: Promise<LoadedModels> | null = null;

export interface LoadedModels {
  /** MoveNet MultiPose Lightning — up to 6 persons, 17 keypoints each */
  poseDetector: poseDetection.PoseDetector;
  /** COCO-SSD — 80-class object detection for vehicles and handheld objects */
  objectDetector: cocoSsd.ObjectDetection;
}

// ─────────────────────────────────────────────
// WebGL Configuration
// ─────────────────────────────────────────────

/**
 * Configure WebGL backend for optimal real-time performance.
 * Called once before model loading.
 */
function configureWebGL(): void {
  // Avoid accumulating intermediate tensors — crucial for 15 FPS inference loops
  tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
  // Use float16 where possible for faster GPU throughput
  tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
  // Pack tensors to minimise texture lookups
  tf.env().set('WEBGL_PACK', true);
  // Enable convolution optimizations
  tf.env().set('WEBGL_CONV_IM2COL', true);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Load and cache TensorFlow.js models.
 *
 * On first call: boots WebGL, downloads & compiles both models (~5–8 s on a cold start).
 * On subsequent calls: returns the cached singletons immediately.
 *
 * @returns Promise resolving to { poseDetector, objectDetector }
 */
export async function loadModels(): Promise<LoadedModels> {
  // Return cache immediately if already loaded
  if (_poseDetector && _objectDetector) {
    return { poseDetector: _poseDetector, objectDetector: _objectDetector };
  }

  // Deduplicate concurrent callers — only one load flight at a time
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async (): Promise<LoadedModels> => {
    // 1. Set WebGL as the compute backend
    await tf.setBackend('webgl');
    await tf.ready();

    configureWebGL();

    console.info(
      '[ModelLoader] TF.js backend:', tf.getBackend(),
      '| WebGL version:', (tf.env().get('WEBGL_VERSION') as number)
    );

    // 2. Load MoveNet MultiPose Lightning in parallel with COCO-SSD
    const [poseDetector, objectDetector] = await Promise.all([
      poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
          // Enable tracking to give each detected person a stable ID across frames
          // (required by combatEngine for velocity vector computation)
          enableTracking: true,
          trackerType: poseDetection.TrackerType.BoundingBox,
          trackerConfig: {
            maxTracks: 6,         // Up to 6 simultaneous persons
            maxAge: 1000,         // Drop lost tracks after 1 s
            minSimilarity: 0.15,  // Low threshold for partial occlusion tolerance
          },
        } as poseDetection.MoveNetModelConfig
      ),
      cocoSsd.load({
        // 'lite_mobilenet_v2' is fastest; 'mobilenet_v2' is more accurate
        base: 'lite_mobilenet_v2',
      }),
    ]);

    _poseDetector = poseDetector;
    _objectDetector = objectDetector;

    const memInfo = tf.memory() as ReturnType<typeof tf.memory> & { numBytesInGPU?: number };
    console.info(
      '[ModelLoader] Models ready.',
      `| Tensors: ${memInfo.numTensors}`,
      `| GPU bytes: ${((memInfo.numBytesInGPU ?? 0) / 1024 / 1024).toFixed(1)} MB`
    );

    return { poseDetector: _poseDetector, objectDetector: _objectDetector };
  })();

  return _loadPromise;
}

/**
 * Dispose both model instances and clear the singleton cache.
 * Call this during component unmount or page navigation to release GPU memory.
 */
export function disposeModels(): void {
  _poseDetector?.dispose();
  _objectDetector?.dispose();
  _poseDetector = null;
  _objectDetector = null;
  _loadPromise = null;
  console.info('[ModelLoader] Models disposed and GPU memory released.');
}

/**
 * Returns true if both models are currently loaded and cached.
 */
export function areModelsLoaded(): boolean {
  return _poseDetector !== null && _objectDetector !== null;
}
